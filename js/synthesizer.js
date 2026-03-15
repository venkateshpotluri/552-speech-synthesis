'use strict';

/**
 * synthesizer.js
 *
 * Implements the "unit selection" speech synthesis algorithm:
 *
 *  1. The user's typed text is normalised (lower-cased, numbers expanded
 *     to words, punctuation stripped).
 *  2. A greedy longest-match search finds which recorded corpus units
 *     best cover the text from left to right.
 *  3. The matching audio blobs are loaded from storage and decoded into
 *     PCM audio buffers using the Web Audio API.
 *  4. The buffers are concatenated (with a short silence gap between
 *     units to mimic natural phrasing) and played back.
 *
 * The visualisation data returned by synthesize() allows the UI to
 * highlight exactly which units were used and which words were skipped
 * because no matching unit was available.
 */

class Synthesizer {
  /**
   * @param {Storage}  storage  - The storage instance for loading recordings.
   * @param {object}   corpus   - The CORPUS object from corpus.js.
   */
  constructor(storage, corpus) {
    this.storage = storage;
    this.corpus = corpus;
    /** @type {AudioContext|null} */
    this._audioContext = null;
    /** @type {AudioBufferSourceNode|null} */
    this._currentSource = null;
  }

  // ── Audio context ─────────────────────────────────────────────────

  /**
   * Returns (or lazily creates) the shared AudioContext.
   * AudioContext must be created after a user gesture on some browsers.
   */
  _getAudioContext() {
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    // Resume in case it was suspended (autoplay policy)
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    return this._audioContext;
  }

  // ── Text normalisation ────────────────────────────────────────────

  /**
   * Converts the user's typed text into a normalised form that can be
   * matched against corpus unit texts (which are all lower-case words).
   *
   * Steps performed:
   *   1. Lower-case everything.
   *   2. Expand flight numbers (e.g. "101" → "one zero one").
   *   3. Expand gate numbers (e.g. "gate 5" → "gate five").
   *   4. Expand time delays ("30 minutes" → "thirty minutes").
   *   5. Strip leftover punctuation.
   *
   * @param {string} text
   * @returns {string}
   */
  normalizeText(text) {
    let t = text.toLowerCase();

    // Expand flight numbers written as digits, e.g. "flight 101"
    t = t.replace(/\bflight\s+(\d{3})\b/g, (_m, num) => {
      return 'flight ' + num.split('').map(Synthesizer._digitWord).join(' ');
    });

    // Expand gate numbers, e.g. "gate 5" → "gate five"
    t = t.replace(/\bgate\s+(\d{1,2})\b/g, (_m, num) => {
      return 'gate ' + Synthesizer._smallNumberWord(parseInt(num, 10));
    });

    // Expand delay durations: "30 minutes" → "thirty minutes"
    t = t.replace(/\b(\d+)\s+minutes?\b/g, (_m, num) => {
      return Synthesizer._smallNumberWord(parseInt(num, 10)) + ' minutes';
    });

    // Expand delay hours: "1 hour" → "one hour"
    t = t.replace(/\b(\d+)\s+hours?\b/g, (_m, num) => {
      const n = parseInt(num, 10);
      return (
        Synthesizer._smallNumberWord(n) + (n === 1 ? ' hour' : ' hours')
      );
    });

    // Strip remaining punctuation (periods, commas, exclamation marks…)
    t = t.replace(/[.,!?;:'"()\-]/g, ' ');

    // Collapse multiple spaces
    t = t.replace(/\s+/g, ' ').trim();

    return t;
  }

  /**
   * Returns the word for a single digit 0–9.
   * @param {string} digit
   * @returns {string}
   */
  static _digitWord(digit) {
    return [
      'zero', 'one', 'two', 'three', 'four',
      'five', 'six', 'seven', 'eight', 'nine',
    ][parseInt(digit, 10)] || digit;
  }

  /**
   * Returns the word for small numbers (0–99).
   * Used for gate numbers and delay minutes/hours.
   * @param {number} n
   * @returns {string}
   */
  static _smallNumberWord(n) {
    const ones = [
      'zero', 'one', 'two', 'three', 'four', 'five',
      'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
      'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
      'seventeen', 'eighteen', 'nineteen',
    ];
    const tens = [
      '', '', 'twenty', 'thirty', 'forty', 'fifty',
      'sixty', 'seventy', 'eighty', 'ninety',
    ];

    if (n < 20) return ones[n] || String(n);
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  }

  // ── Unit selection ────────────────────────────────────────────────

  /**
   * Performs a greedy longest-match search over the normalised text.
   *
   * This is a simplified version of the unit selection algorithm used
   * in real speech synthesis. A full system would also consider:
   *   - acoustic similarity (target cost)
   *   - how smoothly units join together (join / concatenation cost)
   *   - prosodic context (pitch, duration)
   *
   * Our version finds the longest recorded corpus unit that matches the
   * start of the remaining text, takes it, and repeats. When no match
   * is found, the current word is marked as "unmatched" and skipped.
   *
   * @param {string}   normalizedText - Output of normalizeText().
   * @param {Set<string>} recordedIds - Set of unit IDs that have been recorded.
   * @returns {Array<{type:'match'|'unmatched', unit?: object, word?: string}>}
   */
  findBestSequence(normalizedText, recordedIds) {
    // Only consider units that have been recorded
    const available = this.corpus.units
      .filter((u) => recordedIds.has(u.id))
      // Sort longest-first so we prefer longer units (e.g. "attention
      // all passengers" over just "attention")
      .sort((a, b) => b.text.length - a.text.length);

    const result = [];
    let remaining = normalizedText.trim();

    while (remaining.length > 0) {
      remaining = remaining.trim();
      if (!remaining) break;

      // Try to find the longest unit that starts here
      let matched = false;
      for (const unit of available) {
        if (remaining === unit.text || remaining.startsWith(unit.text + ' ')) {
          result.push({ type: 'match', unit });
          remaining = remaining.slice(unit.text.length).trim();
          matched = true;
          break;
        }
      }

      if (!matched) {
        // Skip the first word; mark it as unmatched for the UI
        const spaceIdx = remaining.indexOf(' ');
        const word =
          spaceIdx === -1 ? remaining : remaining.slice(0, spaceIdx);
        result.push({ type: 'unmatched', word });
        remaining = spaceIdx === -1 ? '' : remaining.slice(spaceIdx + 1);
      }
    }

    return result;
  }

  // ── Audio loading & concatenation ─────────────────────────────────

  /**
   * Loads an audio blob from storage and decodes it into a Web Audio
   * API AudioBuffer (raw PCM samples).
   *
   * @param {string}       unitId
   * @param {AudioContext} audioCtx
   * @returns {Promise<AudioBuffer>}
   */
  async _loadBuffer(unitId, audioCtx) {
    const blob = await this.storage.loadRecording(unitId);
    if (!blob) throw new Error(`No recording found for unit "${unitId}".`);
    const arrayBuffer = await blob.arrayBuffer();
    return audioCtx.decodeAudioData(arrayBuffer);
  }

  /**
   * Concatenates multiple AudioBuffers into a single buffer, inserting
   * a short silence gap (100 ms) between each unit to prevent abrupt
   * joins.  All buffers are mixed down to mono.
   *
   * @param {AudioBuffer[]} buffers
   * @param {AudioContext}  audioCtx
   * @returns {AudioBuffer}
   */
  _concatenate(buffers, audioCtx) {
    const sampleRate = audioCtx.sampleRate;
    const gapSamples = Math.floor(0.08 * sampleRate); // 80 ms gap
    const totalLength =
      buffers.reduce((sum, b) => sum + b.length, 0) +
      gapSamples * (buffers.length - 1);

    const output = audioCtx.createBuffer(1, totalLength, sampleRate);
    const out = output.getChannelData(0);

    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      const buf = buffers[i];
      // Mix down to mono: average all channels
      const mono = new Float32Array(buf.length);
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const chData = buf.getChannelData(ch);
        for (let s = 0; s < chData.length; s++) {
          mono[s] += chData[s] / buf.numberOfChannels;
        }
      }
      out.set(mono, offset);
      offset += buf.length;
      if (i < buffers.length - 1) {
        offset += gapSamples; // silence gap is already zero-filled
      }
    }

    return output;
  }

  /**
   * Plays an AudioBuffer through the default audio output.
   * Returns a promise that resolves when playback finishes.
   *
   * @param {AudioBuffer}  buffer
   * @param {AudioContext} audioCtx
   * @returns {Promise<void>}
   */
  _play(buffer, audioCtx) {
    return new Promise((resolve) => {
      if (this._currentSource) {
        try { this._currentSource.stop(); } catch (_) { /* already stopped */ }
      }
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        this._currentSource = null;
        resolve();
      };
      source.start();
      this._currentSource = source;
    });
  }

  /**
   * Stops any currently playing synthesis output.
   */
  stop() {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch (_) { /* already stopped */ }
      this._currentSource = null;
    }
  }

  // ── Main entry point ──────────────────────────────────────────────

  /**
   * The full synthesis pipeline.
   *
   * 1. Normalise the input text.
   * 2. Find the best sequence of recorded units.
   * 3. Load & concatenate the audio.
   * 4. Play the result.
   *
   * @param {string}      text       - The user's typed announcement.
   * @param {Set<string>} recordedIds - Set of unit IDs that are recorded.
   * @param {Function}    onProgress  - Optional callback(message: string).
   * @returns {Promise<{
   *   normalizedText: string,
   *   sequence: Array,
   *   matchCount: number,
   *   unmatchedWords: string[]
   * }>}
   */
  async synthesize(text, recordedIds, onProgress) {
    const emit = (msg) => { if (onProgress) onProgress(msg); };

    emit('Analysing your text\u2026');
    const normalizedText = this.normalizeText(text);

    if (!normalizedText) {
      throw new Error('Please type something before synthesizing.');
    }

    emit('Selecting speech units\u2026');
    const sequence = this.findBestSequence(normalizedText, recordedIds);

    const matched = sequence.filter((s) => s.type === 'match');
    const unmatched = sequence
      .filter((s) => s.type === 'unmatched')
      .map((s) => s.word);

    if (matched.length === 0) {
      throw new Error(
        'None of the words in your text match any of your recordings. ' +
        'Try recording more phrases or using the example announcements.'
      );
    }

    emit(`Loading ${matched.length} recording${matched.length > 1 ? 's' : ''}\u2026`);
    const audioCtx = this._getAudioContext();

    const buffers = [];
    for (const item of matched) {
      const buf = await this._loadBuffer(item.unit.id, audioCtx);
      buffers.push(buf);
    }

    emit('Combining audio\u2026');
    const combined =
      buffers.length === 1 ? buffers[0] : this._concatenate(buffers, audioCtx);

    emit('Playing\u2026');
    await this._play(combined, audioCtx);

    return {
      normalizedText,
      sequence,
      matchCount: matched.length,
      unmatchedWords: unmatched,
    };
  }
}

if (typeof window !== 'undefined') {
  window.Synthesizer = Synthesizer;
}

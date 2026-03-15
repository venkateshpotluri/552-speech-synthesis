'use strict';

/**
 * Duration (in seconds) of the silence gap inserted between adjacent
 * synthesized phrase units.  Change this value to experiment with how
 * the gap length affects the naturalness of synthesized speech.
 */
const UNIT_GAP_SECONDS = 0.08; // 80 ms

/**
 * synthesizer.js
 *
 * Unit-selection speech synthesis using the user's own voice recordings.
 *
 * PIPELINE
 * ─────────
 * 1. NORMALISE   — lower-case the typed text, expand numbers to words.
 * 2. SELECT      — greedy longest-match finds which corpus units best cover
 *                  the text, matching against CORPUS.unitDefs.
 * 3. LOAD        — for each selected unit, find which sentence recording
 *                  contains it and call the Segmenter to extract the right
 *                  audio slice in the user's voice.
 * 4. CONCATENATE — join the slices with an 80 ms silence gap.
 * 5. PLAY        — send the combined buffer to the Web Audio API output.
 *
 * HOW STEP 3 WORKS
 * ─────────────────
 * The corpus defines 15 sentences, each with a "segments" array listing
 * the phrase units it contains.  When synthesis needs "to new york", it
 * searches the corpus for any sentence that has a segment with unitId
 * "dest-newyork", loads that sentence's recording, and asks the Segmenter
 * to cut out the slice corresponding to "to new york".
 *
 * In a professional system, the selection algorithm would choose the
 * BEST matching segment by comparing acoustic features (MFCCs, pitch,
 * duration) at the join boundary.  We simplify this by always using the
 * first available sentence.
 */

class Synthesizer {
  constructor(storage, corpus, segmenter) {
    this.storage   = storage;
    this.corpus    = corpus;
    this.segmenter = segmenter;

    this._audioContext  = null;
    this._currentSource = null;

    // Map: unitId -> [sentenceId, ...] built at start-up
    this._unitToSentences = this._buildUnitIndex();
  }

  // ── Index ─────────────────────────────────────────────────────────

  _buildUnitIndex() {
    const map = new Map();
    for (const sentence of this.corpus.sentences) {
      for (const seg of sentence.segments) {
        if (!map.has(seg.unitId)) map.set(seg.unitId, []);
        map.get(seg.unitId).push(sentence.id);
      }
    }
    return map;
  }

  // ── Audio context ─────────────────────────────────────────────────

  _getAudioContext() {
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    return this._audioContext;
  }

  // ── Text normalisation ────────────────────────────────────────────

  normalizeText(text) {
    let t = text.toLowerCase();

    // Flight numbers: "flight 101" → "flight one zero one"
    t = t.replace(/\bflight\s+(\d{3})\b/g, (_m, num) =>
      'flight ' + num.split('').map(Synthesizer._digitWord).join(' ')
    );

    // Gate numbers: "gate 5" → "gate five"
    t = t.replace(/\bgate\s+(\d{1,2})\b/g, (_m, n) =>
      'gate ' + Synthesizer._numWord(parseInt(n, 10))
    );

    // Delay: "30 minutes" → "thirty minutes"
    t = t.replace(/\b(\d+)\s+minutes?\b/g, (_m, n) =>
      Synthesizer._numWord(parseInt(n, 10)) + ' minutes'
    );

    // Delay: "1 hour" / "2 hours"
    t = t.replace(/\b(\d+)\s+hours?\b/g, (_m, n) => {
      const num = parseInt(n, 10);
      return Synthesizer._numWord(num) + (num === 1 ? ' hour' : ' hours');
    });

    // Strip punctuation, collapse spaces
    return t.replace(/[.,!?;:'"()\-]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  static _digitWord(d) {
    const words = ['zero','one','two','three','four','five','six','seven','eight','nine'];
    const idx = parseInt(d, 10);
    return (!isNaN(idx) && idx >= 0 && idx <= 9) ? words[idx] : d;
  }

  static _numWord(n) {
    const ones = ['zero','one','two','three','four','five','six','seven',
                  'eight','nine','ten','eleven','twelve','thirteen','fourteen',
                  'fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty',
                  'sixty','seventy','eighty','ninety'];
    if (n < 20) return ones[n] || String(n);
    const t = tens[Math.floor(n / 10)];
    const o = ones[n % 10];
    return o ? `${t} ${o}` : t;
  }

  // ── Unit selection ────────────────────────────────────────────────

  /**
   * Greedy longest-match: scans left-to-right, always taking the longest
   * matching unit that has at least one available recording.
   */
  selectUnits(normalizedText, recordedSentenceIds) {
    const available = Object.entries(this.corpus.unitDefs)
      .filter(([unitId]) =>
        (this._unitToSentences.get(unitId) || [])
          .some((sId) => recordedSentenceIds.has(sId))
      )
      .map(([unitId, text]) => ({ unitId, text }))
      .sort((a, b) => b.text.length - a.text.length); // longest first

    const result = [];
    let remaining = normalizedText.trim();

    while (remaining.length > 0) {
      remaining = remaining.trim();
      if (!remaining) break;

      let matched = false;
      for (const unit of available) {
        if (remaining === unit.text || remaining.startsWith(unit.text + ' ')) {
          result.push({ type: 'match', unitId: unit.unitId, unitText: unit.text });
          remaining = remaining.slice(unit.text.length).trim();
          matched = true;
          break;
        }
      }

      if (!matched) {
        const spaceIdx = remaining.indexOf(' ');
        const word = spaceIdx === -1 ? remaining : remaining.slice(0, spaceIdx);
        result.push({ type: 'unmatched', word });
        remaining = spaceIdx === -1 ? '' : remaining.slice(spaceIdx + 1);
      }
    }

    return result;
  }

  // ── Audio extraction ──────────────────────────────────────────────

  /**
   * Loads the recording of the sentence that contains this unit, then
   * uses the Segmenter to extract the phrase slice for this unit.
   */
  async _extractUnitAudio(unitId, recordedSentenceIds, audioCtx) {
    const sentenceIds = this._unitToSentences.get(unitId) || [];
    const available   = sentenceIds.filter((sId) => recordedSentenceIds.has(sId));

    if (available.length === 0) {
      throw new Error(`No recording found for unit "${unitId}".`);
    }

    const sentenceId  = available[0];
    const sentence    = this.corpus.sentences.find((s) => s.id === sentenceId);
    const blob        = await this.storage.loadRecording(sentenceId);
    if (!blob) throw new Error(`Sentence "${sentenceId}" not in storage.`);

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const segments = this.segmenter.segment(audioBuffer, sentence, audioCtx);
    const slice    = segments.find((s) => s.unitId === unitId);
    if (!slice) throw new Error(`Could not extract "${unitId}" from "${sentenceId}".`);

    return slice.buffer;
  }

  // ── Concatenation ─────────────────────────────────────────────────

  /**
   * Joins multiple mono AudioBuffers with a silence gap (UNIT_GAP_SECONDS) between each.
   */
  _concatenate(buffers, audioCtx) {
    const sr         = audioCtx.sampleRate;
    const gapSamples = Math.floor(UNIT_GAP_SECONDS * sr);
    const totalLen   = buffers.reduce((s, b) => s + b.length, 0) +
                       gapSamples * (buffers.length - 1);

    const out     = audioCtx.createBuffer(1, Math.max(1, totalLen), sr);
    const outData = out.getChannelData(0);
    let offset    = 0;

    for (let i = 0; i < buffers.length; i++) {
      outData.set(buffers[i].getChannelData(0), offset);
      offset += buffers[i].length;
      if (i < buffers.length - 1) offset += gapSamples;
    }

    return out;
  }

  // ── Playback ──────────────────────────────────────────────────────

  _play(buffer, audioCtx) {
    return new Promise((resolve) => {
      if (this._currentSource) {
        try { this._currentSource.stop(); } catch (_) {}
      }
      const source  = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => { this._currentSource = null; resolve(); };
      source.start();
      this._currentSource = source;
    });
  }

  stop() {
    if (this._currentSource) {
      try { this._currentSource.stop(); } catch (_) {}
      this._currentSource = null;
    }
  }

  // ── Main entry point ──────────────────────────────────────────────

  async synthesize(text, recordedSentenceIds, onProgress) {
    const emit = (msg) => { if (onProgress) onProgress(msg); };

    emit('Analysing your text\u2026');
    const normalizedText = this.normalizeText(text);

    if (!normalizedText) {
      throw new Error('Please type an announcement before clicking Synthesize.');
    }

    emit('Selecting speech units\u2026');
    const sequence = this.selectUnits(normalizedText, recordedSentenceIds);

    const matched   = sequence.filter((s) => s.type === 'match');
    const unmatched = sequence.filter((s) => s.type === 'unmatched').map((s) => s.word);

    if (matched.length === 0) {
      throw new Error(
        'None of the words in your text match any recorded phrases. ' +
        'Record more sentences, or try one of the example announcements.'
      );
    }

    emit(`Extracting ${matched.length} phrase${matched.length > 1 ? 's' : ''} from your recordings\u2026`);
    const audioCtx = this._getAudioContext();
    const buffers  = [];

    for (const item of matched) {
      const buf = await this._extractUnitAudio(item.unitId, recordedSentenceIds, audioCtx);
      buffers.push(buf);
    }

    emit('Combining phrases in your voice\u2026');
    const combined = buffers.length === 1
      ? buffers[0]
      : this._concatenate(buffers, audioCtx);

    emit('Playing\u2026');
    await this._play(combined, audioCtx);

    return { normalizedText, sequence, matchCount: matched.length, unmatchedWords: unmatched };
  }
}

if (typeof window !== 'undefined') {
  window.Synthesizer = Synthesizer;
}

'use strict';

/** Fallback dB floor for near-zero or silent RMS values. */
const SILENCE_DB_FLOOR = -100;

/** Conversion factor from milliseconds to seconds. */
const MS_PER_SEC = 1000;

/**
 * segmenter.js
 *
 * Extracts phrase-level audio segments from a full-sentence recording.
 *
 * HOW IT WORKS — THE TWO-PASS APPROACH
 * ──────────────────────────────────────
 * Pass 1 — Voice Activity Detection (VAD):
 *   The algorithm slides a short analysis window (20 ms) across the
 *   decoded audio and measures the RMS energy in each window.  Any
 *   window whose energy falls below a silence threshold is labelled
 *   "silence".  Consecutive silence windows that total more than
 *   MIN_SILENCE_MS milliseconds are treated as a phrase boundary.
 *
 *   This is exactly what professional speech synthesis tools like
 *   Festival and Festvox do — but they run the analysis on a server
 *   using Praat or the Edinburgh Speech Tools.  We do it here in the
 *   browser using the Web Audio API, which is less precise but good
 *   enough for this educational context.
 *
 * Pass 2 — Proportional fallback:
 *   If the VAD finds a different number of boundaries than expected
 *   (because speech was too fast, too continuous, or the room was noisy),
 *   the system falls back to splitting the audio proportionally based on
 *   the character count of each pre-defined segment text.  This is less
 *   accurate but always produces the right number of segments.
 *
 * WHAT A REAL SYSTEM DOES DIFFERENTLY
 * ─────────────────────────────────────
 * Production forced alignment uses a Hidden Markov Model (HMM) acoustic
 * model to find the exact time of every PHONEME boundary — not just silence
 * gaps.  Tools like the Montreal Forced Aligner or Praat can align speech
 * to text with ~20 ms accuracy.  Our silence-based approach has accuracy of
 * roughly ±200 ms, which is fine for learning but audibly imperfect.
 */

class Segmenter {
  /**
   * @param {object} options
   * @param {number} [options.silenceThresholdDb=-40]  RMS threshold (dB) below which audio is "silence"
   * @param {number} [options.minSilenceMs=80]         Minimum silence gap (ms) to count as a boundary
   * @param {number} [options.windowMs=20]             Analysis window size (ms)
   * @param {number} [options.paddingMs=30]            Extra silence padding stripped from each end
   */
  constructor(options = {}) {
    this.silenceThresholdDb = options.silenceThresholdDb ?? -40;
    this.minSilenceMs       = options.minSilenceMs       ?? 80;
    this.windowMs           = options.windowMs           ?? 20;
    this.paddingMs          = options.paddingMs          ?? 30;
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Segments an AudioBuffer according to the pre-defined units of a
   * corpus sentence.  Returns one extracted AudioBuffer per segment.
   *
   * @param {AudioBuffer} audioBuffer   - The full sentence recording.
   * @param {object}      sentence      - A CORPUS.sentences entry.
   * @param {AudioContext} audioContext - For creating output buffers.
   * @returns {{unitId: string, buffer: AudioBuffer, method: string}[]}
   *   method is 'vad' if VAD found the right boundaries, 'proportional' otherwise.
   */
  segment(audioBuffer, sentence, audioContext) {
    const segments    = sentence.segments;
    const numSegments = segments.length;

    // Try VAD segmentation
    const vadBoundaries = this._detectBoundaries(audioBuffer);

    let boundaries;
    let method;

    if (vadBoundaries.length === numSegments - 1) {
      // VAD found exactly the right number of internal boundaries ✓
      boundaries = vadBoundaries;
      method = 'vad';
    } else {
      // Fall back to proportional split
      boundaries = this._proportionalBoundaries(audioBuffer, segments);
      method = 'proportional';
    }

    // Convert boundary sample positions into extracted audio buffers
    const startPoints = [0, ...boundaries];
    const endPoints   = [...boundaries, audioBuffer.length];

    return segments.map((seg, i) => ({
      unitId: seg.unitId,
      buffer: this._extractSlice(audioBuffer, startPoints[i], endPoints[i], audioContext),
      method,
    }));
  }

  // ── VAD boundary detection ────────────────────────────────────────

  /**
   * Returns an array of sample positions that mark the MID-POINT of each
   * silence gap found in the audio.  The array has length (numSegments - 1)
   * if and only if exactly the right number of gaps was found.
   *
   * @param {AudioBuffer} audioBuffer
   * @returns {number[]} Sample-position boundaries (may not equal numSegments-1)
   */
  _detectBoundaries(audioBuffer) {
    const sr          = audioBuffer.sampleRate;
    const data        = audioBuffer.getChannelData(0);
    const windowSize  = Math.floor(this.windowMs / MS_PER_SEC * sr);
    const minSilWin   = Math.ceil(this.minSilenceMs / this.windowMs); // windows

    // 1. Compute RMS per analysis window
    const rmsWindows = [];
    for (let i = 0; i < data.length; i += windowSize) {
      const end = Math.min(i + windowSize, data.length);
      let sum = 0;
      for (let j = i; j < end; j++) sum += data[j] * data[j];
      const rms = Math.sqrt(sum / (end - i));
      const db  = rms > 1e-10 ? 20 * Math.log10(rms) : SILENCE_DB_FLOOR;
      rmsWindows.push({ startSample: i, db });
    }

    // 2. Label each window silence / speech
    const isSilence = rmsWindows.map(w => w.db < this.silenceThresholdDb);

    // 3. Find runs of consecutive silence windows long enough to be a gap
    const silenceRuns = [];
    let runStart = null;
    for (let i = 0; i <= isSilence.length; i++) {
      const silent = i < isSilence.length ? isSilence[i] : false;
      if (silent && runStart === null) {
        runStart = i;
      } else if (!silent && runStart !== null) {
        const len = i - runStart;
        if (len >= minSilWin) {
          // Boundary = mid-point of the silence run in samples
          const midWindow = Math.floor((runStart + i) / 2);
          silenceRuns.push(rmsWindows[midWindow].startSample);
        }
        runStart = null;
      }
    }

    return silenceRuns;
  }

  // ── Proportional fallback ─────────────────────────────────────────

  /**
   * Divides the audio proportionally based on the character count of each
   * segment's text.  Always produces exactly (numSegments - 1) boundaries.
   *
   * @param {AudioBuffer} audioBuffer
   * @param {object[]}    segments    - sentence.segments array
   * @returns {number[]} Internal boundary sample positions
   */
  _proportionalBoundaries(audioBuffer, segments) {
    const totalChars = segments.reduce((s, seg) => s + seg.text.length, 0);
    const totalSamples = audioBuffer.length;

    const boundaries = [];
    let accumulated = 0;

    for (let i = 0; i < segments.length - 1; i++) {
      accumulated += segments[i].text.length;
      const frac = accumulated / totalChars;
      boundaries.push(Math.floor(frac * totalSamples));
    }

    return boundaries;
  }

  // ── Audio slice extraction ────────────────────────────────────────

  /**
   * Extracts samples [startSample, endSample) from an AudioBuffer into a
   * new mono AudioBuffer, trimming leading and trailing silence padding.
   *
   * @param {AudioBuffer}  src
   * @param {number}       startSample
   * @param {number}       endSample
   * @param {AudioContext} audioContext
   * @returns {AudioBuffer}
   */
  _extractSlice(src, startSample, endSample, audioContext) {
    const sr      = src.sampleRate;
    const padding = Math.floor(this.paddingMs / MS_PER_SEC * sr);

    // Mix all channels down to mono
    const mono = new Float32Array(src.length);
    for (let ch = 0; ch < src.numberOfChannels; ch++) {
      const chData = src.getChannelData(ch);
      for (let i = 0; i < chData.length; i++) {
        mono[i] += chData[i] / src.numberOfChannels;
      }
    }

    const start = Math.min(startSample + padding, endSample);
    const end   = Math.max(endSample   - padding, start + 1);
    const len   = end - start;

    const out     = audioContext.createBuffer(1, Math.max(1, len), sr);
    const outData = out.getChannelData(0);
    for (let i = 0; i < len; i++) {
      outData[i] = mono[start + i] || 0;
    }

    return out;
  }
}

if (typeof window !== 'undefined') {
  window.Segmenter = Segmenter;
}

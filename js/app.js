'use strict';

/**
 * app.js  —  Main application controller.
 *
 * Manages step navigation, recording UI for full corpus sentences,
 * synthesis triggering, and the educational visualisations.
 */

class App {
  constructor() {
    this.segmenter   = new Segmenter();
    this.storage     = new Storage();
    this.recorder    = new AudioRecorder();
    this.synthesizer = new Synthesizer(this.storage, CORPUS, this.segmenter);

    /** Set of sentence IDs that have a saved recording. */
    this.recordedIds = new Set();

    /** Sentence ID currently being recorded (null if none). */
    this.activeRecordingId = null;

    /** Object URL cache: sentenceId → url string. */
    this._objectUrls = new Map();

    this.currentStep = 0;
    this.totalSteps  = 5; // steps 0 – 4
  }

  // ── Init ──────────────────────────────────────────────────────────

  async init() {
    try {
      await this.storage.init();
    } catch (err) {
      this._showGlobalError(
        'Could not open the voice database. Make sure browser storage is ' +
        'enabled and refresh the page. Detail: ' + err.message
      );
      return;
    }

    const ids = await this.storage.getAllRecordedIds();
    this.recordedIds = new Set(ids);

    this._buildRecordingUI();
    this._buildExampleButtons();
    this._bindNavigationButtons();
    this._bindSynthesisControls();
    this._bindResetButton();
    this._updateAllCards();
    this._refreshDatabaseView();
    this._showStep(0);
  }

  // ── Navigation ────────────────────────────────────────────────────

  _showStep(stepIndex) {
    this.currentStep = stepIndex;
    for (let i = 0; i < this.totalSteps; i++) {
      const panel   = document.getElementById(`step-${i}`);
      const navItem = document.getElementById(`step-nav-${i}`);
      if (!panel || !navItem) continue;
      if (i === stepIndex) {
        panel.removeAttribute('hidden');
        navItem.classList.add('active');
        navItem.setAttribute('aria-current', 'step');
      } else {
        panel.setAttribute('hidden', '');
        navItem.classList.remove('active');
        navItem.removeAttribute('aria-current');
      }
    }
    const heading = document.querySelector(`#step-${stepIndex} .step-heading`);
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus(); }
    this._updateNavButtons();
    if (stepIndex === 3) this._refreshDatabaseView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _updateNavButtons() {
    document.querySelectorAll('.btn-prev-step').forEach(
      (btn) => { btn.disabled = this.currentStep === 0; }
    );
    document.querySelectorAll('.btn-next-step').forEach(
      (btn) => { btn.disabled = this.currentStep === this.totalSteps - 1; }
    );
  }

  _bindNavigationButtons() {
    document.querySelectorAll('.btn-next-step').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (this.currentStep < this.totalSteps - 1) this._showStep(this.currentStep + 1);
      })
    );
    document.querySelectorAll('.btn-prev-step').forEach((btn) =>
      btn.addEventListener('click', () => {
        if (this.currentStep > 0) this._showStep(this.currentStep - 1);
      })
    );
  }

  // ── Recording UI ──────────────────────────────────────────────────

  _buildRecordingUI() {
    const wrapper = document.getElementById('recording-sentences-wrapper');
    if (!wrapper) return;

    // Group by category
    const byCategory = {};
    for (const sent of CORPUS.sentences) {
      if (!byCategory[sent.category]) byCategory[sent.category] = [];
      byCategory[sent.category].push(sent);
    }

    for (const [catKey, sentences] of Object.entries(byCategory)) {
      const catMeta = CORPUS.categories[catKey];
      if (!catMeta) continue;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.setAttribute('aria-labelledby', `cat-heading-${catKey}`);

      const h3  = document.createElement('h3');
      h3.id        = `cat-heading-${catKey}`;
      h3.className = 'category-heading';
      h3.innerHTML = `<span aria-hidden="true">${catMeta.icon}</span> ${catMeta.name}`;

      const desc  = document.createElement('p');
      desc.className   = 'category-description';
      desc.textContent = catMeta.description;

      const grid = document.createElement('div');
      grid.className = 'sentence-grid';
      grid.setAttribute('role', 'list');

      section.appendChild(h3);
      section.appendChild(desc);
      section.appendChild(grid);
      wrapper.appendChild(section);

      for (const sent of sentences) grid.appendChild(this._buildSentenceCard(sent));
    }
  }

  _buildSentenceCard(sentence) {
    const esc  = (s) => this._escapeHtml(s);
    const card = document.createElement('div');
    card.className  = 'sentence-card';
    card.id         = `sent-card-${sentence.id}`;
    card.setAttribute('role', 'listitem');

    card.innerHTML = `
      <div class="sent-card-top">
        <span class="sent-title">${esc(sentence.title)}</span>
        <span class="unit-status-badge not-recorded"
              id="status-badge-${sentence.id}">Not yet recorded</span>
      </div>
      <p class="unit-say-label">Say this complete sentence:</p>
      <p class="sent-phrase">&ldquo;${esc(sentence.text)}&rdquo;</p>
      <p class="unit-description">${esc(sentence.description)}</p>
      <details class="segments-preview">
        <summary>Phrase units this sentence covers (${sentence.segments.length})</summary>
        <ul class="segment-list" aria-label="Phrase units in this sentence">
          ${sentence.segments.map((seg) =>
            `<li class="segment-pill">${esc(seg.text)}</li>`
          ).join('')}
        </ul>
      </details>
      <div class="unit-controls"
           role="group"
           aria-label="Recording controls for: ${esc(sentence.title)}">
        <button class="btn btn-record"
                id="btn-record-${sentence.id}"
                data-sent-id="${sentence.id}"
                aria-label="Record: ${esc(sentence.title)}">
          <span aria-hidden="true">🎙</span> Record
        </button>
        <button class="btn btn-play"
                id="btn-play-${sentence.id}"
                data-sent-id="${sentence.id}"
                aria-label="Play your recording of: ${esc(sentence.title)}"
                disabled>
          <span aria-hidden="true">▶</span> Play back
        </button>
        <button class="btn btn-delete"
                id="btn-delete-${sentence.id}"
                data-sent-id="${sentence.id}"
                aria-label="Delete your recording of: ${esc(sentence.title)}"
                disabled>
          <span aria-hidden="true">✕</span> Delete
        </button>
      </div>
      <div class="unit-recording-indicator"
           id="recording-indicator-${sentence.id}"
           hidden aria-hidden="true">
        <span class="recording-dot"></span> Recording…
      </div>
      <div class="unit-feedback"
           role="status" aria-live="polite"
           id="feedback-${sentence.id}"></div>
    `;

    card.querySelector('.btn-record').addEventListener('click',
      (e) => this._handleRecordClick(e.currentTarget.dataset.sentId));
    card.querySelector('.btn-play').addEventListener('click',
      (e) => this._handlePlayClick(e.currentTarget.dataset.sentId));
    card.querySelector('.btn-delete').addEventListener('click',
      (e) => this._handleDeleteClick(e.currentTarget.dataset.sentId));

    return card;
  }

  // ── Recording handlers ────────────────────────────────────────────

  async _handleRecordClick(sentId) {
    if (this.recorder.isRecording && this.activeRecordingId === sentId) {
      await this._stopRecording(sentId);
    } else {
      if (this.recorder.isRecording) await this._stopRecording(this.activeRecordingId);
      await this._startRecording(sentId);
    }
  }

  async _startRecording(sentId) {
    const indicator = document.getElementById(`recording-indicator-${sentId}`);
    const feedback  = document.getElementById(`feedback-${sentId}`);
    const btn       = document.getElementById(`btn-record-${sentId}`);

    try {
      await this.recorder.startRecording();
    } catch (err) {
      this._setFeedback(feedback, 'error', err.message);
      return;
    }

    this.activeRecordingId = sentId;
    btn.innerHTML = '<span aria-hidden="true">⏹</span> Stop';
    btn.classList.add('recording');
    btn.setAttribute('aria-label', `Stop recording: ${this._sentTitle(sentId)}`);
    indicator.removeAttribute('hidden');
    indicator.removeAttribute('aria-hidden');
    this._setFeedback(feedback, 'info',
      'Recording… say the full sentence clearly, then click Stop.');

    document.getElementById(`btn-play-${sentId}`).disabled   = true;
    document.getElementById(`btn-delete-${sentId}`).disabled = true;
    this._updateProgressBar();
  }

  async _stopRecording(sentId) {
    if (!sentId) return;

    const indicator = document.getElementById(`recording-indicator-${sentId}`);
    const feedback  = document.getElementById(`feedback-${sentId}`);

    let blob;
    try {
      blob = await this.recorder.stopRecording();
    } catch (err) {
      this._setFeedback(feedback, 'error', 'Recording failed: ' + err.message);
      return;
    }

    this.activeRecordingId = null;
    indicator.setAttribute('hidden', '');
    indicator.setAttribute('aria-hidden', 'true');

    if (!blob || blob.size < 500) {
      this._setFeedback(feedback, 'warning',
        'The recording was too short — did you forget to say the full sentence? Please try again.');
      this._resetRecordButton(sentId);
      return;
    }

    try {
      await this.storage.saveRecording(sentId, blob);
    } catch (err) {
      this._setFeedback(feedback, 'error', 'Could not save: ' + err.message);
      this._resetRecordButton(sentId);
      return;
    }

    this.recordedIds.add(sentId);
    this._updateCard(sentId, true);
    this._setFeedback(feedback, 'success',
      'Saved! Click "Play back" to hear your recording, or "Re-record" if you need to redo it.');
    this._updateProgressBar();
    this._refreshDatabaseView();

    this._revokeObjectUrl(sentId);
    this._objectUrls.set(sentId, URL.createObjectURL(blob));
  }

  async _handlePlayClick(sentId) {
    const feedback = document.getElementById(`feedback-${sentId}`);
    const playBtn  = document.getElementById(`btn-play-${sentId}`);
    playBtn.disabled = true;
    this._setFeedback(feedback, 'info', 'Playing…');

    let url = this._objectUrls.get(sentId);
    if (!url) {
      const blob = await this.storage.loadRecording(sentId);
      if (!blob) {
        this._setFeedback(feedback, 'error', 'Recording not found.');
        playBtn.disabled = false;
        return;
      }
      url = URL.createObjectURL(blob);
      this._objectUrls.set(sentId, url);
    }

    const audio = new Audio(url);
    audio.onended = () => { playBtn.disabled = false; this._setFeedback(feedback, '', ''); };
    audio.onerror = () => {
      playBtn.disabled = false;
      this._setFeedback(feedback, 'error', 'Playback failed. Try re-recording.');
    };
    audio.play().catch((err) => {
      playBtn.disabled = false;
      this._setFeedback(feedback, 'error', 'Could not play: ' + err.message);
    });
  }

  async _handleDeleteClick(sentId) {
    if (!confirm(`Delete your recording of "${this._sentTitle(sentId)}"? This cannot be undone.`)) return;
    await this.storage.deleteRecording(sentId);
    this.recordedIds.delete(sentId);
    this._revokeObjectUrl(sentId);
    this._updateCard(sentId, false);
    const feedback = document.getElementById(`feedback-${sentId}`);
    this._setFeedback(feedback, 'info', 'Recording deleted.');
    this._updateProgressBar();
    this._refreshDatabaseView();
  }

  // ── Card helpers ──────────────────────────────────────────────────

  _updateCard(sentId, isRecorded) {
    const badge     = document.getElementById(`status-badge-${sentId}`);
    const playBtn   = document.getElementById(`btn-play-${sentId}`);
    const deleteBtn = document.getElementById(`btn-delete-${sentId}`);
    const card      = document.getElementById(`sent-card-${sentId}`);

    if (badge) {
      badge.textContent = isRecorded ? '✔ Recorded' : 'Not yet recorded';
      badge.className   = 'unit-status-badge ' + (isRecorded ? 'recorded' : 'not-recorded');
    }
    if (playBtn)   playBtn.disabled   = !isRecorded;
    if (deleteBtn) deleteBtn.disabled = !isRecorded;
    if (card)      card.classList.toggle('is-recorded', isRecorded);
    this._resetRecordButton(sentId);
  }

  _resetRecordButton(sentId) {
    const btn = document.getElementById(`btn-record-${sentId}`);
    if (!btn) return;
    const isRecorded = this.recordedIds.has(sentId);
    btn.innerHTML = `<span aria-hidden="true">🎙</span> ${isRecorded ? 'Re-record' : 'Record'}`;
    btn.classList.remove('recording');
    btn.setAttribute('aria-label', `${isRecorded ? 'Re-record' : 'Record'}: ${this._sentTitle(sentId)}`);
    btn.disabled = false;
  }

  _updateAllCards() {
    CORPUS.sentences.forEach((s) => this._updateCard(s.id, this.recordedIds.has(s.id)));
    this._updateProgressBar();
  }

  // ── Progress bar ──────────────────────────────────────────────────

  _updateProgressBar() {
    const total = CORPUS.sentences.length;
    const done  = this.recordedIds.size;
    const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

    const fill  = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const bar   = document.getElementById('progress-bar');

    if (fill)  fill.style.width     = pct + '%';
    if (label) label.textContent    = `${done} of ${total} sentences recorded (${pct}%)`;
    if (bar) {
      bar.setAttribute('aria-valuenow',  done);
      bar.setAttribute('aria-valuemax',  total);
      bar.setAttribute('aria-valuetext', `${done} of ${total} sentences recorded`);
    }
  }

  // ── Voice database view ───────────────────────────────────────────

  _refreshDatabaseView() {
    const container = document.getElementById('database-grid');
    if (!container) return;
    container.innerHTML = '';

    const total   = CORPUS.sentences.length;
    const done    = this.recordedIds.size;
    const summary = document.getElementById('database-summary');
    if (summary) {
      summary.textContent =
        `You have recorded ${done} of ${total} sentences. ` +
        (done === 0
          ? 'Go back to Step 2 to start recording.'
          : done < total
          ? 'You can record more, or continue to synthesize.'
          : 'All sentences recorded — your voice database is complete!');
    }

    for (const sent of CORPUS.sentences) {
      const isRecorded = this.recordedIds.has(sent.id);
      const chip = document.createElement('div');
      chip.className = `db-chip ${isRecorded ? 'db-chip--recorded' : 'db-chip--missing'}`;
      chip.setAttribute('role', 'listitem');
      chip.setAttribute('aria-label',
        `${sent.title}: ${isRecorded ? 'recorded' : 'not recorded'}`);
      chip.innerHTML = `
        <span class="db-chip-icon" aria-hidden="true">${isRecorded ? '✔' : '○'}</span>
        <span class="db-chip-text">${this._escapeHtml(sent.title)}</span>
        <span class="db-chip-cat">${CORPUS.categories[sent.category].name}</span>
      `;
      container.appendChild(chip);
    }
  }

  // ── Synthesis ─────────────────────────────────────────────────────

  _buildExampleButtons() {
    const container = document.getElementById('example-buttons');
    if (!container) return;
    CORPUS.examples.forEach((ex) => {
      const btn = document.createElement('button');
      btn.className   = 'btn btn-example';
      btn.textContent = ex.label;
      btn.setAttribute('aria-label', `Use example: ${ex.text}`);
      btn.addEventListener('click', () => {
        const ta = document.getElementById('synthesis-input');
        if (ta) { ta.value = ex.text; ta.dispatchEvent(new Event('input')); }
      });
      container.appendChild(btn);
    });
  }

  _bindSynthesisControls() {
    const synthesizeBtn = document.getElementById('btn-synthesize');
    const stopBtn       = document.getElementById('btn-stop');

    if (synthesizeBtn) synthesizeBtn.addEventListener('click', () => this._handleSynthesize());
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.synthesizer.stop();
        stopBtn.hidden = true;
        if (synthesizeBtn) synthesizeBtn.disabled = false;
        this._setSynthesisStatus('', '');
      });
    }

    const input = document.getElementById('synthesis-input');
    if (input) {
      input.addEventListener('input', () => {
        const counter = document.getElementById('char-count');
        if (counter) counter.textContent = `${input.value.length} characters`;
      });
    }
  }

  async _handleSynthesize() {
    const input         = document.getElementById('synthesis-input');
    const synthesizeBtn = document.getElementById('btn-synthesize');
    const stopBtn       = document.getElementById('btn-stop');

    const text = input ? input.value.trim() : '';
    if (!text) {
      this._setSynthesisStatus('error', 'Please type an announcement first.');
      if (input) input.focus();
      return;
    }

    if (this.recordedIds.size === 0) {
      this._setSynthesisStatus('error',
        'You have not recorded any sentences yet. Go back to Step 2 and record some sentences first.');
      return;
    }

    synthesizeBtn.disabled = true;
    stopBtn.hidden = false;

    try {
      const result = await this.synthesizer.synthesize(
        text,
        this.recordedIds,
        (msg) => this._setSynthesisStatus('info', msg)
      );

      this._showSynthesisResult(result);
      this._setSynthesisStatus(
        'success',
        `Done! Used ${result.matchCount} phrase${result.matchCount > 1 ? 's' : ''} from your recordings.` +
        (result.unmatchedWords.length > 0
          ? ` Words not found: "${result.unmatchedWords.join('", "')}".`
          : '')
      );
    } catch (err) {
      this._setSynthesisStatus('error', err.message);
    } finally {
      synthesizeBtn.disabled = false;
      stopBtn.hidden = true;
    }
  }

  _showSynthesisResult(result) {
    const container = document.getElementById('synthesis-visualization');
    const chips     = document.getElementById('synthesis-chips');
    if (!container || !chips) return;

    chips.innerHTML  = '';
    container.hidden = false;

    for (const item of result.sequence) {
      const chip = document.createElement('span');
      if (item.type === 'match') {
        chip.className = 'synth-chip synth-chip--match';
        // Find which sentence provided this unit
        const sentIds  = this.synthesizer._unitToSentences.get(item.unitId) || [];
        const sentId   = sentIds.find((sId) => this.recordedIds.has(sId));
        const sentence = sentId && CORPUS.sentences.find((s) => s.id === sentId);
        chip.setAttribute('aria-label',
          `Matched phrase "${item.unitText}"` +
          (sentence ? ` — from your recording: "${sentence.title}"` : ''));
        chip.innerHTML = `
          <span class="synth-chip-text">${this._escapeHtml(item.unitText)}</span>
          <span class="synth-chip-cat">${sentence ? this._escapeHtml(sentence.title) : 'recorded phrase'}</span>
        `;
      } else {
        chip.className = 'synth-chip synth-chip--unmatched';
        chip.setAttribute('aria-label', `Word not found in recordings: "${item.word}"`);
        chip.innerHTML = `
          <span class="synth-chip-text">${this._escapeHtml(item.word)}</span>
          <span class="synth-chip-cat">not found</span>
        `;
      }
      chips.appendChild(chip);
    }
  }

  _setSynthesisStatus(type, message) {
    const el = document.getElementById('synthesis-status');
    if (!el) return;
    el.textContent = message;
    el.className   = 'synthesis-status';
    if (type) el.classList.add(`synthesis-status--${type}`);
    el.hidden = !message;
  }

  // ── Reset ─────────────────────────────────────────────────────────

  _bindResetButton() {
    const btn = document.getElementById('btn-reset-all');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!confirm('Delete ALL recordings and start over? This cannot be undone.')) return;
      await this.storage.clearAll();
      this._objectUrls.forEach((url) => URL.revokeObjectURL(url));
      this._objectUrls.clear();
      this.recordedIds.clear();
      this._updateAllCards();
      this._refreshDatabaseView();
      this._showStep(0);
      const fb = document.getElementById('reset-feedback');
      if (fb) {
        fb.textContent = 'All recordings deleted.';
        fb.hidden = false;
        setTimeout(() => { fb.hidden = true; }, 4000);
      }
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────

  _setFeedback(el, type, message) {
    if (!el) return;
    el.textContent = message;
    el.className   = 'unit-feedback';
    if (type) el.classList.add(`unit-feedback--${type}`);
    el.hidden = !message;
  }

  _sentTitle(sentId) {
    const s = CORPUS.sentences.find((s) => s.id === sentId);
    return s ? s.title : sentId;
  }

  _revokeObjectUrl(sentId) {
    const url = this._objectUrls.get(sentId);
    if (url) { URL.revokeObjectURL(url); this._objectUrls.delete(sentId); }
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  _showGlobalError(msg) {
    const el = document.getElementById('global-error');
    if (el) { el.textContent = msg; el.hidden = false; } else alert(msg);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const unsupported = [];
  if (!window.indexedDB)     unsupported.push('IndexedDB (for storing recordings)');
  if (!window.MediaRecorder) unsupported.push('MediaRecorder (for voice recording)');
  if (!window.AudioContext && !window.webkitAudioContext)
    unsupported.push('Web Audio API (for playing synthesized speech)');

  if (unsupported.length > 0) {
    const el  = document.getElementById('global-error');
    const msg = 'Your browser does not support: ' + unsupported.join(', ') +
                '. Please use Chrome, Firefox, Edge, or Safari 14+.';
    if (el) { el.textContent = msg; el.hidden = false; } else alert(msg);
    return;
  }

  new App().init().catch((err) => console.error('App init failed:', err));
});

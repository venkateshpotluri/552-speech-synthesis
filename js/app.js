'use strict';

/**
 * app.js
 *
 * Main application controller.
 *
 * Manages:
 *  - Navigation between the five learning steps.
 *  - Rendering the recording UI for each corpus unit.
 *  - Wiring up record / stop / play / delete buttons.
 *  - Loading progress from IndexedDB on page load.
 *  - Running synthesis and showing the visualisation.
 */

class App {
  constructor() {
    this.storage = new Storage();
    this.recorder = new AudioRecorder();
    this.synthesizer = new Synthesizer(this.storage, CORPUS);

    /** Set of unit IDs that have a saved recording. */
    this.recordedIds = new Set();

    /** The unit whose record button is currently active. */
    this.activeRecordingUnitId = null;

    /** URL objects created for playback blobs – freed when no longer needed. */
    this._objectUrls = new Map();

    this.currentStep = 0;
    this.totalSteps = 5; // 0 … 4
  }

  // ── Initialisation ────────────────────────────────────────────────

  async init() {
    try {
      await this.storage.init();
    } catch (err) {
      this._showGlobalError(
        'Could not open the voice database in your browser. ' +
        'Please make sure cookies / storage are enabled and try refreshing the page. ' +
        'Technical detail: ' + err.message
      );
      return;
    }

    // Load which units have already been recorded
    const ids = await this.storage.getAllRecordedIds();
    this.recordedIds = new Set(ids);

    this._buildRecordingUI();
    this._buildExampleButtons();
    this._bindNavigationButtons();
    this._bindSynthesisControls();
    this._bindResetButton();
    this._updateAllUnitCards();
    this._refreshDatabaseView();
    this._showStep(0);
  }

  // ── Step navigation ───────────────────────────────────────────────

  _showStep(stepIndex) {
    this.currentStep = stepIndex;

    for (let i = 0; i < this.totalSteps; i++) {
      const panel = document.getElementById(`step-${i}`);
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

    // Move keyboard focus to the step heading for screen readers
    const heading = document.querySelector(`#step-${stepIndex} .step-heading`);
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }

    // Update prev/next button state
    this._updateNavButtons();

    // Refresh database view whenever the user enters that step
    if (stepIndex === 3) this._refreshDatabaseView();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  _updateNavButtons() {
    const prevBtns = document.querySelectorAll('.btn-prev-step');
    const nextBtns = document.querySelectorAll('.btn-next-step');

    prevBtns.forEach((btn) => {
      btn.disabled = this.currentStep === 0;
    });

    nextBtns.forEach((btn) => {
      btn.disabled = this.currentStep === this.totalSteps - 1;
    });
  }

  _bindNavigationButtons() {
    document.querySelectorAll('.btn-next-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.currentStep < this.totalSteps - 1) {
          this._showStep(this.currentStep + 1);
        }
      });
    });

    document.querySelectorAll('.btn-prev-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (this.currentStep > 0) {
          this._showStep(this.currentStep - 1);
        }
      });
    });
  }

  // ── Recording UI ──────────────────────────────────────────────────

  /**
   * Builds the recording card for every corpus unit and inserts them
   * into the category containers already present in the HTML.
   */
  _buildRecordingUI() {
    const categories = CORPUS.categories;

    // Create a container for each category
    const wrapper = document.getElementById('recording-units-wrapper');
    if (!wrapper) return;

    for (const [catKey, catMeta] of Object.entries(categories)) {
      const unitsInCat = CORPUS.units.filter((u) => u.category === catKey);
      if (unitsInCat.length === 0) continue;

      const section = document.createElement('section');
      section.className = 'category-section';
      section.setAttribute('aria-labelledby', `cat-heading-${catKey}`);

      const heading = document.createElement('h3');
      heading.id = `cat-heading-${catKey}`;
      heading.className = 'category-heading';
      heading.innerHTML = `<span aria-hidden="true">${catMeta.icon}</span> ${catMeta.name}`;

      const desc = document.createElement('p');
      desc.className = 'category-description';
      desc.textContent = catMeta.description;

      const grid = document.createElement('div');
      grid.className = 'unit-grid';
      grid.setAttribute('role', 'list');

      section.appendChild(heading);
      section.appendChild(desc);
      section.appendChild(grid);
      wrapper.appendChild(section);

      for (const unit of unitsInCat) {
        grid.appendChild(this._buildUnitCard(unit));
      }
    }
  }

  /**
   * Builds the DOM card for one corpus unit.
   * @param {object} unit
   * @returns {HTMLElement}
   */
  _buildUnitCard(unit) {
    const card = document.createElement('div');
    card.className = 'unit-card';
    card.id = `unit-card-${unit.id}`;
    card.setAttribute('role', 'listitem');

    const requiredBadge = unit.required
      ? '<span class="badge badge-required">Needed for examples</span>'
      : '';

    card.innerHTML = `
      <div class="unit-card-top">
        ${requiredBadge}
        <span class="unit-status-badge" id="status-badge-${unit.id}">
          Not yet recorded
        </span>
      </div>
      <p class="unit-say-label">Say:</p>
      <p class="unit-phrase" id="phrase-${unit.id}">&ldquo;${this._escapeHtml(unit.displayText)}&rdquo;</p>
      <p class="unit-description">${this._escapeHtml(unit.description)}</p>
      <div class="unit-controls" role="group"
           aria-label="Recording controls for: ${this._escapeHtml(unit.displayText)}">
        <button class="btn btn-record"
                id="btn-record-${unit.id}"
                data-unit-id="${unit.id}"
                aria-label="Record: ${this._escapeHtml(unit.displayText)}">
          <span aria-hidden="true">🎙</span> Record
        </button>
        <button class="btn btn-play"
                id="btn-play-${unit.id}"
                data-unit-id="${unit.id}"
                aria-label="Play recording of: ${this._escapeHtml(unit.displayText)}"
                disabled>
          <span aria-hidden="true">▶</span> Play
        </button>
        <button class="btn btn-delete"
                id="btn-delete-${unit.id}"
                data-unit-id="${unit.id}"
                aria-label="Delete recording of: ${this._escapeHtml(unit.displayText)}"
                disabled>
          <span aria-hidden="true">✕</span> Delete
        </button>
      </div>
      <div class="unit-recording-indicator" id="recording-indicator-${unit.id}" hidden aria-hidden="true">
        <span class="recording-dot"></span> Recording…
      </div>
      <div class="unit-feedback" role="status" aria-live="polite" id="feedback-${unit.id}"></div>
    `;

    // Wire up buttons
    card.querySelector('.btn-record').addEventListener('click', (e) =>
      this._handleRecordClick(e.currentTarget.dataset.unitId)
    );
    card.querySelector('.btn-play').addEventListener('click', (e) =>
      this._handlePlayClick(e.currentTarget.dataset.unitId)
    );
    card.querySelector('.btn-delete').addEventListener('click', (e) =>
      this._handleDeleteClick(e.currentTarget.dataset.unitId)
    );

    return card;
  }

  // ── Recording handlers ────────────────────────────────────────────

  async _handleRecordClick(unitId) {
    const btn = document.getElementById(`btn-record-${unitId}`);
    if (!btn) return;

    if (this.recorder.isRecording && this.activeRecordingUnitId === unitId) {
      // Stop recording
      await this._stopRecording(unitId);
    } else {
      // Start recording (stop any existing recording first)
      if (this.recorder.isRecording) {
        await this._stopRecording(this.activeRecordingUnitId);
      }
      await this._startRecording(unitId);
    }
  }

  async _startRecording(unitId) {
    const btn = document.getElementById(`btn-record-${unitId}`);
    const indicator = document.getElementById(`recording-indicator-${unitId}`);
    const feedback = document.getElementById(`feedback-${unitId}`);

    try {
      await this.recorder.startRecording();
    } catch (err) {
      this._setFeedback(feedback, 'error', err.message);
      return;
    }

    this.activeRecordingUnitId = unitId;

    btn.textContent = '';
    btn.innerHTML = '<span aria-hidden="true">⏹</span> Stop';
    btn.classList.add('recording');
    btn.setAttribute('aria-label', `Stop recording: ${this._unitDisplayText(unitId)}`);

    indicator.removeAttribute('hidden');
    indicator.removeAttribute('aria-hidden');
    this._setFeedback(feedback, 'info', 'Recording… click Stop when you are done.');

    // Disable play/delete while recording
    const playBtn = document.getElementById(`btn-play-${unitId}`);
    const deleteBtn = document.getElementById(`btn-delete-${unitId}`);
    if (playBtn) playBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;

    this._updateProgressBar();
  }

  async _stopRecording(unitId) {
    if (!unitId) return;

    const btn = document.getElementById(`btn-record-${unitId}`);
    const indicator = document.getElementById(`recording-indicator-${unitId}`);
    const feedback = document.getElementById(`feedback-${unitId}`);

    let blob;
    try {
      blob = await this.recorder.stopRecording();
    } catch (err) {
      this._setFeedback(feedback, 'error', 'Recording stopped unexpectedly: ' + err.message);
      return;
    }

    this.activeRecordingUnitId = null;

    indicator.setAttribute('hidden', '');
    indicator.setAttribute('aria-hidden', 'true');

    if (!blob || blob.size < 100) {
      this._setFeedback(feedback, 'warning', 'Recording was too short. Please try again.');
      this._resetRecordButton(unitId);
      return;
    }

    try {
      await this.storage.saveRecording(unitId, blob);
    } catch (err) {
      this._setFeedback(feedback, 'error', 'Could not save your recording: ' + err.message);
      this._resetRecordButton(unitId);
      return;
    }

    this.recordedIds.add(unitId);
    this._updateUnitCard(unitId, true);
    this._setFeedback(feedback, 'success', 'Recording saved! You can play it back or re-record if needed.');
    this._updateProgressBar();
    this._refreshDatabaseView();

    // Cache the object URL for quick playback
    this._revokeObjectUrl(unitId);
    this._objectUrls.set(unitId, URL.createObjectURL(blob));
  }

  async _handlePlayClick(unitId) {
    const feedback = document.getElementById(`feedback-${unitId}`);
    const playBtn = document.getElementById(`btn-play-${unitId}`);

    playBtn.disabled = true;
    this._setFeedback(feedback, 'info', 'Playing…');

    let url = this._objectUrls.get(unitId);
    if (!url) {
      const blob = await this.storage.loadRecording(unitId);
      if (!blob) {
        this._setFeedback(feedback, 'error', 'Recording not found.');
        playBtn.disabled = false;
        return;
      }
      url = URL.createObjectURL(blob);
      this._objectUrls.set(unitId, url);
    }

    const audio = new Audio(url);
    audio.onended = () => {
      playBtn.disabled = false;
      this._setFeedback(feedback, '', '');
    };
    audio.onerror = () => {
      playBtn.disabled = false;
      this._setFeedback(feedback, 'error', 'Could not play the recording.');
    };
    audio.play().catch((err) => {
      playBtn.disabled = false;
      this._setFeedback(feedback, 'error', 'Playback failed: ' + err.message);
    });
  }

  async _handleDeleteClick(unitId) {
    const unit = CORPUS.units.find((u) => u.id === unitId);
    const label = unit ? unit.displayText : unitId;

    if (!confirm(`Delete your recording of "${label}"? This cannot be undone.`)) {
      return;
    }

    await this.storage.deleteRecording(unitId);
    this.recordedIds.delete(unitId);
    this._revokeObjectUrl(unitId);
    this._updateUnitCard(unitId, false);

    const feedback = document.getElementById(`feedback-${unitId}`);
    this._setFeedback(feedback, 'info', 'Recording deleted. You can record again when ready.');
    this._updateProgressBar();
    this._refreshDatabaseView();
  }

  // ── Unit card state helpers ───────────────────────────────────────

  _updateUnitCard(unitId, isRecorded) {
    const badge = document.getElementById(`status-badge-${unitId}`);
    const recordBtn = document.getElementById(`btn-record-${unitId}`);
    const playBtn = document.getElementById(`btn-play-${unitId}`);
    const deleteBtn = document.getElementById(`btn-delete-${unitId}`);
    const card = document.getElementById(`unit-card-${unitId}`);

    if (badge) {
      badge.textContent = isRecorded ? '✔ Recorded' : 'Not yet recorded';
      badge.className =
        'unit-status-badge ' + (isRecorded ? 'recorded' : 'not-recorded');
    }

    this._resetRecordButton(unitId);

    if (playBtn) playBtn.disabled = !isRecorded;
    if (deleteBtn) deleteBtn.disabled = !isRecorded;

    if (card) {
      card.classList.toggle('is-recorded', isRecorded);
    }
  }

  _resetRecordButton(unitId) {
    const btn = document.getElementById(`btn-record-${unitId}`);
    if (!btn) return;
    const unit = CORPUS.units.find((u) => u.id === unitId);
    const label = unit ? unit.displayText : unitId;
    const isRecorded = this.recordedIds.has(unitId);

    btn.innerHTML = `<span aria-hidden="true">🎙</span> ${isRecorded ? 'Re-record' : 'Record'}`;
    btn.classList.remove('recording');
    btn.setAttribute('aria-label', `${isRecorded ? 'Re-record' : 'Record'}: ${label}`);
    btn.disabled = false;
  }

  _updateAllUnitCards() {
    CORPUS.units.forEach((unit) => {
      this._updateUnitCard(unit.id, this.recordedIds.has(unit.id));
    });
    this._updateProgressBar();
  }

  // ── Progress bar ──────────────────────────────────────────────────

  _updateProgressBar() {
    const total = CORPUS.units.length;
    const done = this.recordedIds.size;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const bar = document.getElementById('progress-bar');

    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `${done} of ${total} phrases recorded (${pct}%)`;
    if (bar) {
      bar.setAttribute('aria-valuenow', done);
      bar.setAttribute('aria-valuemax', total);
      bar.setAttribute('aria-valuetext', `${done} of ${total} phrases recorded`);
    }
  }

  // ── Voice database view ───────────────────────────────────────────

  _refreshDatabaseView() {
    const container = document.getElementById('database-grid');
    if (!container) return;

    container.innerHTML = '';

    const total = CORPUS.units.length;
    const done = this.recordedIds.size;

    const summary = document.getElementById('database-summary');
    if (summary) {
      summary.textContent =
        `You have recorded ${done} out of ${total} phrases. ` +
        (done === 0
          ? 'Go back to Step 2 to start recording.'
          : done < total
          ? 'You can go back to record more, or continue to synthesize.'
          : 'Your voice database is complete!');
    }

    for (const unit of CORPUS.units) {
      const isRecorded = this.recordedIds.has(unit.id);
      const chip = document.createElement('div');
      chip.className = `db-chip ${isRecorded ? 'db-chip--recorded' : 'db-chip--missing'}`;
      chip.setAttribute('role', 'listitem');
      chip.setAttribute(
        'aria-label',
        `${unit.displayText}: ${isRecorded ? 'recorded' : 'not recorded'}`
      );
      chip.innerHTML = `
        <span class="db-chip-icon" aria-hidden="true">${isRecorded ? '✔' : '○'}</span>
        <span class="db-chip-text">${this._escapeHtml(unit.displayText)}</span>
        <span class="db-chip-cat">${CORPUS.categories[unit.category].name}</span>
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
      btn.className = 'btn btn-example';
      btn.textContent = ex.label;
      btn.setAttribute('aria-label', `Use example: ${ex.text}`);
      btn.addEventListener('click', () => {
        const textarea = document.getElementById('synthesis-input');
        if (textarea) {
          textarea.value = ex.text;
          textarea.dispatchEvent(new Event('input'));
        }
      });
      container.appendChild(btn);
    });
  }

  _bindSynthesisControls() {
    const synthesizeBtn = document.getElementById('btn-synthesize');
    const stopBtn = document.getElementById('btn-stop');

    if (synthesizeBtn) {
      synthesizeBtn.addEventListener('click', () => this._handleSynthesize());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.synthesizer.stop();
        stopBtn.hidden = true;
        if (synthesizeBtn) synthesizeBtn.disabled = false;
        this._setSynthesisStatus('', '');
      });
    }

    // Character counter / input feedback
    const input = document.getElementById('synthesis-input');
    if (input) {
      input.addEventListener('input', () => {
        const counter = document.getElementById('char-count');
        if (counter) counter.textContent = `${input.value.length} characters`;
      });
    }
  }

  async _handleSynthesize() {
    const input = document.getElementById('synthesis-input');
    const synthesizeBtn = document.getElementById('btn-synthesize');
    const stopBtn = document.getElementById('btn-stop');

    const text = input ? input.value.trim() : '';
    if (!text) {
      this._setSynthesisStatus('error', 'Please type an announcement before clicking Synthesize.');
      if (input) input.focus();
      return;
    }

    if (this.recordedIds.size === 0) {
      this._setSynthesisStatus(
        'error',
        'You have not recorded any phrases yet. Go back to Step 2 and record some phrases first.'
      );
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
        `Done! Used ${result.matchCount} recorded phrase${result.matchCount > 1 ? 's' : ''}.` +
        (result.unmatchedWords.length > 0
          ? ` Could not find a match for: "${result.unmatchedWords.join('", "')}".`
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
    const chips = document.getElementById('synthesis-chips');
    if (!container || !chips) return;

    chips.innerHTML = '';
    container.hidden = false;

    for (const item of result.sequence) {
      const chip = document.createElement('span');
      if (item.type === 'match') {
        chip.className = 'synth-chip synth-chip--match';
        chip.setAttribute(
          'aria-label',
          `Matched unit: ${item.unit.displayText} (${CORPUS.categories[item.unit.category].name})`
        );
        chip.innerHTML = `
          <span class="synth-chip-text">${this._escapeHtml(item.unit.displayText)}</span>
          <span class="synth-chip-cat">${CORPUS.categories[item.unit.category].name}</span>
        `;
      } else {
        chip.className = 'synth-chip synth-chip--unmatched';
        chip.setAttribute('aria-label', `No match found for word: ${item.word}`);
        chip.innerHTML = `
          <span class="synth-chip-text">${this._escapeHtml(item.word)}</span>
          <span class="synth-chip-cat">no recording</span>
        `;
      }
      chips.appendChild(chip);
    }
  }

  _setSynthesisStatus(type, message) {
    const el = document.getElementById('synthesis-status');
    if (!el) return;
    el.textContent = message;
    el.className = 'synthesis-status';
    if (type) el.classList.add(`synthesis-status--${type}`);
    el.hidden = !message;
  }

  // ── Reset ─────────────────────────────────────────────────────────

  _bindResetButton() {
    const btn = document.getElementById('btn-reset-all');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (
        !confirm(
          'Delete ALL your recordings and start over? This cannot be undone.'
        )
      ) {
        return;
      }
      await this.storage.clearAll();
      this._objectUrls.forEach((url) => URL.revokeObjectURL(url));
      this._objectUrls.clear();
      this.recordedIds.clear();
      this._updateAllUnitCards();
      this._refreshDatabaseView();
      this._showStep(0);
      const feedback = document.getElementById('reset-feedback');
      if (feedback) {
        feedback.textContent = 'All recordings deleted. You can start fresh.';
        feedback.hidden = false;
        setTimeout(() => { feedback.hidden = true; }, 4000);
      }
    });
  }

  // ── Utilities ─────────────────────────────────────────────────────

  _setFeedback(el, type, message) {
    if (!el) return;
    el.textContent = message;
    el.className = 'unit-feedback';
    if (type) el.classList.add(`unit-feedback--${type}`);
    el.hidden = !message;
  }

  _unitDisplayText(unitId) {
    const unit = CORPUS.units.find((u) => u.id === unitId);
    return unit ? unit.displayText : unitId;
  }

  _revokeObjectUrl(unitId) {
    const url = this._objectUrls.get(unitId);
    if (url) {
      URL.revokeObjectURL(url);
      this._objectUrls.delete(unitId);
    }
  }

  _escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  _showGlobalError(message) {
    const el = document.getElementById('global-error');
    if (el) {
      el.textContent = message;
      el.hidden = false;
    } else {
      alert(message);
    }
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Check browser support before starting
  const unsupported = [];
  if (!window.indexedDB) unsupported.push('IndexedDB (for storing recordings)');
  if (!window.MediaRecorder) unsupported.push('MediaRecorder (for voice recording)');
  if (!window.AudioContext && !window.webkitAudioContext)
    unsupported.push('Web Audio API (for playing back synthesized speech)');

  if (unsupported.length > 0) {
    const el = document.getElementById('global-error');
    const msg =
      'Your browser does not support the following features required by this app: ' +
      unsupported.join(', ') +
      '. Please use a modern browser such as Chrome, Firefox, Edge, or Safari 14+.';
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    } else {
      alert(msg);
    }
    return;
  }

  const app = new App();
  app.init().catch((err) => {
    console.error('App failed to initialise:', err);
  });
});

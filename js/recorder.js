'use strict';

/**
 * recorder.js
 *
 * A wrapper around the browser's MediaRecorder API for capturing
 * voice recordings from the user's microphone.
 *
 * MediaRecorder is a standard Web API available in all modern
 * browsers. It captures audio in real time and produces a Blob
 * (a binary file) that can be stored and played back later.
 */

class AudioRecorder {
  constructor() {
    /** @type {MediaRecorder|null} */
    this.mediaRecorder = null;
    /** @type {BlobPart[]} */
    this.audioChunks = [];
    /** @type {MediaStream|null} */
    this.stream = null;
    /** @type {boolean} */
    this.isRecording = false;
  }

  /**
   * Asks the browser (and the user) for permission to use the
   * microphone. Returns true if permission was granted.
   *
   * @returns {Promise<boolean>}
   */
  async requestPermission() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      return true;
    } catch (err) {
      // Common reasons: user denied permission, no microphone found
      console.warn('Microphone permission denied:', err);
      return false;
    }
  }

  /**
   * Starts a new recording session.
   * Automatically requests microphone permission if not already granted.
   *
   * @throws {Error} If microphone permission is denied.
   * @returns {Promise<void>}
   */
  async startRecording() {
    if (!this.stream) {
      const granted = await this.requestPermission();
      if (!granted) {
        throw new Error(
          'Microphone permission was denied. Please allow microphone access in your browser settings and try again.'
        );
      }
    }

    this.audioChunks = [];

    const mimeType = AudioRecorder.getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};

    this.mediaRecorder = new MediaRecorder(this.stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    // Collect a new chunk every 100 ms so we get data even for very
    // short recordings.
    this.mediaRecorder.start(100);
    this.isRecording = true;
  }

  /**
   * Stops the current recording and returns the captured audio as a
   * Blob that can be stored or played back.
   *
   * @returns {Promise<Blob>}
   */
  async stopRecording() {
    return new Promise((resolve, reject) => {
      if (
        !this.mediaRecorder ||
        this.mediaRecorder.state === 'inactive'
      ) {
        reject(new Error('Recording is not active.'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType =
          this.mediaRecorder.mimeType ||
          AudioRecorder.getSupportedMimeType() ||
          'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });
        this.isRecording = false;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Releases the microphone so other applications can use it.
   * Call this when the user is done with all recordings.
   */
  release() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.isRecording = false;
  }

  /**
   * Returns the best audio MIME type supported by this browser.
   * Different browsers support different formats:
   *   Chrome / Edge / Firefox → audio/webm;codecs=opus
   *   Safari                  → audio/mp4
   *
   * @returns {string|null}
   */
  static getSupportedMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    for (const type of candidates) {
      if (
        typeof MediaRecorder !== 'undefined' &&
        MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }
    return null;
  }
}

if (typeof window !== 'undefined') {
  window.AudioRecorder = AudioRecorder;
}

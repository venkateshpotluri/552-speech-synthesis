'use strict';

/**
 * storage.js
 *
 * A simple wrapper around the browser's IndexedDB API for storing and
 * retrieving audio recordings.
 *
 * IndexedDB is used instead of localStorage because audio files can be
 * several megabytes each — localStorage has a strict size limit of
 * about 5 MB in most browsers, which would quickly fill up.
 *
 * All recordings are stored only on the user's device and are never
 * sent to any server.
 */

const DB_NAME = 'AirportVoiceBuilderDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

class Storage {
  constructor() {
    /** @type {IDBDatabase|null} */
    this.db = null;
  }

  /**
   * Opens (or creates) the IndexedDB database.
   * Must be called before any other method.
   * @returns {Promise<void>}
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'unitId' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onerror = (event) => {
        reject(
          new Error('Could not open the voice database: ' + event.target.error)
        );
      };
    });
  }

  /**
   * Saves an audio recording for a specific unit.
   * If a recording for that unit already exists it is overwritten.
   *
   * @param {string} unitId - The corpus unit identifier (e.g. "flight-101")
   * @param {Blob}   audioBlob - The recorded audio blob from MediaRecorder
   * @returns {Promise<void>}
   */
  async saveRecording(unitId, audioBlob) {
    const arrayBuffer = await audioBlob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        unitId,
        audioData: arrayBuffer,
        mimeType: audioBlob.type || 'audio/webm',
        timestamp: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = (e) =>
        reject(new Error('Could not save recording: ' + e.target.error));
    });
  }

  /**
   * Loads the audio recording for a specific unit.
   *
   * @param {string} unitId
   * @returns {Promise<Blob|null>} The audio blob, or null if not recorded yet.
   */
  async loadRecording(unitId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(unitId);
      request.onsuccess = (event) => {
        const record = event.target.result;
        if (record) {
          const blob = new Blob([record.audioData], {
            type: record.mimeType || 'audio/webm',
          });
          resolve(blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = (e) =>
        reject(new Error('Could not load recording: ' + e.target.error));
    });
  }

  /**
   * Returns an array of unit IDs that have been recorded.
   * @returns {Promise<string[]>}
   */
  async getAllRecordedIds() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onsuccess = (event) => resolve(Array.from(event.target.result));
      request.onerror = (e) =>
        reject(
          new Error('Could not read voice database: ' + e.target.error)
        );
    });
  }

  /**
   * Deletes the recording for a specific unit.
   * @param {string} unitId
   * @returns {Promise<void>}
   */
  async deleteRecording(unitId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(unitId);
      request.onsuccess = () => resolve();
      request.onerror = (e) =>
        reject(new Error('Could not delete recording: ' + e.target.error));
    });
  }

  /**
   * Deletes ALL recordings — effectively resets the voice database.
   * @returns {Promise<void>}
   */
  async clearAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = (e) =>
        reject(new Error('Could not clear voice database: ' + e.target.error));
    });
  }
}

if (typeof window !== 'undefined') {
  window.Storage = Storage;
}

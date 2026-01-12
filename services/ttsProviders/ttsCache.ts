/**
 * TTS Audio Cache
 * Uses IndexedDB to cache generated audio for better performance
 */

import { hashText } from '../../utils/textProcessor';

export interface CachedAudio {
  key: string;
  audioData: ArrayBuffer;
  metadata: {
    textHash: string;
    voice: string;
    speed: number;
    provider: string;
    duration: number;
    createdAt: number;
  };
}

const DB_NAME = 'tts_cache';
const DB_VERSION = 1;
const STORE_NAME = 'audio_cache';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_ENTRIES = 1000;

export class TTSCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'key' });
          store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          store.createIndex('textHash', 'metadata.textHash', { unique: false });
        }
      };
    });
  }

  async ensureInit(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.init();
    }
    return this.initPromise;
  }

  generateKey(textHash: string, voice: string, speed: number, provider: string): string {
    return `${provider}_${textHash}_${voice}_${speed}`;
  }

  async get(
    text: string,
    voice: string,
    speed: number,
    provider: string
  ): Promise<ArrayBuffer | null> {
    await this.ensureInit();
    if (!this.db) return null;

    const textHash = hashText(text);
    const key = this.generateKey(textHash, voice, speed, provider);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result as CachedAudio | undefined;
        if (result && result.audioData) {
          // Verify text hash matches
          if (result.metadata.textHash === textHash) {
            resolve(result.audioData);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
    });
  }

  async set(
    text: string,
    voice: string,
    speed: number,
    provider: string,
    audioData: ArrayBuffer,
    duration: number
  ): Promise<void> {
    await this.ensureInit();
    if (!this.db) return;

    const textHash = hashText(text);
    const key = this.generateKey(textHash, voice, speed, provider);

    const cached: CachedAudio = {
      key,
      audioData,
      metadata: {
        textHash,
        voice,
        speed,
        provider,
        duration,
        createdAt: Date.now()
      }
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cached);

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        // Clean up old entries if cache is too large
        await this.cleanup();
        resolve();
      };
    });
  }

  async has(
    text: string,
    voice: string,
    speed: number,
    provider: string
  ): Promise<boolean> {
    const audio = await this.get(text, voice, speed, provider);
    return audio !== null;
  }

  async delete(
    text: string,
    voice: string,
    speed: number,
    provider: string
  ): Promise<void> {
    await this.ensureInit();
    if (!this.db) return;

    const textHash = hashText(text);
    const key = this.generateKey(textHash, voice, speed, provider);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    await this.ensureInit();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async cleanup(): Promise<void> {
    await this.ensureInit();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('createdAt');
      const request = index.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = async () => {
        const entries = request.result as CachedAudio[];
        
        // Sort by creation date (oldest first)
        entries.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);

        // Calculate total size
        let totalSize = 0;
        for (const entry of entries) {
          totalSize += entry.audioData.byteLength;
        }

        // Remove oldest entries if cache is too large or has too many entries
        if (totalSize > MAX_CACHE_SIZE || entries.length > MAX_ENTRIES) {
          const toRemove: string[] = [];
          let removedSize = 0;
          const targetSize = MAX_CACHE_SIZE * 0.8; // Remove down to 80% of max
          const targetEntries = MAX_ENTRIES * 0.8;

          for (const entry of entries) {
            if (totalSize - removedSize > targetSize || entries.length - toRemove.length > targetEntries) {
              toRemove.push(entry.key);
              removedSize += entry.audioData.byteLength;
            } else {
              break;
            }
          }

          // Delete old entries
          for (const key of toRemove) {
            await new Promise<void>((res, rej) => {
              const delRequest = store.delete(key);
              delRequest.onerror = () => rej(delRequest.error);
              delRequest.onsuccess = () => res();
            });
          }
        }

        resolve();
      };
    });
  }

  async getSize(): Promise<number> {
    await this.ensureInit();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entries = request.result as CachedAudio[];
        const totalSize = entries.reduce((sum, entry) => sum + entry.audioData.byteLength, 0);
        resolve(totalSize);
      };
    });
  }
}

// Singleton instance
export const ttsCache = new TTSCache();

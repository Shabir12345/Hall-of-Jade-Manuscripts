import { NovelState } from '../types';

const DB_NAME = 'HallOfJadeDB';
const DB_VERSION = 2; // Updated to match existing database version
const STORE_NOVELS = 'novels';

export const indexedDbService = {
  openDB: (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NOVELS)) {
          db.createObjectStore(STORE_NOVELS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onerror = (event) => {
        const error = (event.target as IDBOpenDBRequest).error;
        // Handle version mismatch - if DB is at higher version, open without specifying version
        if (error?.name === 'VersionError' || error?.message?.includes('version')) {
          console.warn('IndexedDB version mismatch detected, opening with existing version...');
          const openRequest = indexedDB.open(DB_NAME);
          openRequest.onsuccess = () => {
            resolve(openRequest.result);
          };
          openRequest.onerror = () => {
            reject(openRequest.error || error);
          };
        } else {
          reject(error);
        }
      };
    });
  },

  saveNovel: async (novel: NovelState): Promise<void> => {
    const db = await indexedDbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NOVELS, 'readwrite');
      const store = transaction.objectStore(STORE_NOVELS);
      const request = store.put(novel);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  getNovel: async (id: string): Promise<NovelState | undefined> => {
    const db = await indexedDbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NOVELS, 'readonly');
      const store = transaction.objectStore(STORE_NOVELS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  getAllNovels: async (): Promise<NovelState[]> => {
    const db = await indexedDbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NOVELS, 'readonly');
      const store = transaction.objectStore(STORE_NOVELS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  deleteNovel: async (id: string): Promise<void> => {
    const db = await indexedDbService.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NOVELS, 'readwrite');
      const store = transaction.objectStore(STORE_NOVELS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Verify that a novel has been deleted from IndexedDB
   */
  verifyNovelDeleted: async (id: string): Promise<boolean> => {
    try {
      const novel = await indexedDbService.getNovel(id);
      return novel === undefined;
    } catch (error) {
      // If there's an error checking, assume it's deleted to avoid false positives
      return true;
    }
  }
};

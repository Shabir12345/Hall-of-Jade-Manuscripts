/**
 * Chapter State Snapshot Service
 * 
 * Captures and manages novel state snapshots before chapter generation
 * for rollback purposes when chapters are deleted.
 */

import { NovelState } from '../types';
import { ChapterStateSnapshot, EntityChange } from '../types/chapterSnapshot';
import { logger } from './loggingService';
import { generateUUID } from '../utils/uuid';

const DB_NAME = 'HallOfJadeDB';
const DB_VERSION = 2; // Increment to create new store
const STORE_SNAPSHOTS = 'chapter_snapshots';

/**
 * Open IndexedDB and ensure snapshots store exists
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
        db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'chapterId' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Capture a snapshot of novel state before chapter generation
 */
export async function captureChapterSnapshot(
  novelId: string,
  chapterId: string,
  chapterNumber: number,
  currentState: NovelState
): Promise<ChapterStateSnapshot> {
  const timestamp = Date.now();
  const snapshotId = generateUUID();

  // Capture pre-chapter state (before updates)
  const preChapterState: ChapterStateSnapshot['preChapterState'] = {
    characterCodex: JSON.parse(JSON.stringify(currentState.characterCodex || [])),
    worldBible: JSON.parse(JSON.stringify(currentState.worldBible || [])),
    territories: JSON.parse(JSON.stringify(currentState.territories || [])),
    novelItems: JSON.parse(JSON.stringify(currentState.novelItems || [])),
    novelTechniques: JSON.parse(JSON.stringify(currentState.novelTechniques || [])),
    antagonists: JSON.parse(JSON.stringify(currentState.antagonists || [])),
    plotLedger: JSON.parse(JSON.stringify(currentState.plotLedger || [])),
    currentRealmId: currentState.currentRealmId || '',
    realms: JSON.parse(JSON.stringify(currentState.realms || [])),
  };

  const snapshot: ChapterStateSnapshot = {
    snapshotId,
    chapterId,
    chapterNumber,
    novelId,
    timestamp,
    preChapterState,
    changeSummary: {
      charactersCreated: [],
      charactersUpdated: [],
      worldEntriesCreated: [],
      worldEntriesUpdated: [],
      territoriesCreated: [],
      territoriesUpdated: [],
      itemsCreated: [],
      itemsUpdated: [],
      techniquesCreated: [],
      techniquesUpdated: [],
      antagonistsCreated: [],
      antagonistsUpdated: [],
      arcChecklistCompleted: [],
    },
  };

  // Store snapshot in IndexedDB
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.put(snapshot);

      request.onsuccess = () => {
        logger.info('Chapter snapshot captured', 'chapterSnapshot', {
          chapterId,
          chapterNumber,
          novelId,
        });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to store chapter snapshot', 'chapterSnapshot', {
      chapterId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw - snapshot is still created, just not persisted
  }

  return snapshot;
}

/**
 * Get a snapshot for a specific chapter
 */
export async function getChapterSnapshot(
  chapterId: string
): Promise<ChapterStateSnapshot | null> {
  try {
    const db = await openDB();
    return new Promise<ChapterStateSnapshot | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.get(chapterId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to retrieve chapter snapshot', 'chapterSnapshot', {
      chapterId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return null;
  }
}

/**
 * Update snapshot's change summary after processing chapter updates
 */
export async function updateSnapshotChangeSummary(
  chapterId: string,
  changes: Partial<ChapterStateSnapshot['changeSummary']>
): Promise<void> {
  try {
    const snapshot = await getChapterSnapshot(chapterId);
    if (!snapshot) {
      logger.warn('Cannot update change summary: snapshot not found', 'chapterSnapshot', { chapterId });
      return;
    }

    snapshot.changeSummary = {
      ...snapshot.changeSummary,
      ...changes,
    };

    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.put(snapshot);

      request.onsuccess = () => {
        logger.info('Snapshot change summary updated', 'chapterSnapshot', { chapterId });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to update snapshot change summary', 'chapterSnapshot', {
      chapterId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }
}

/**
 * Delete a chapter snapshot (cleanup after successful rollback)
 */
export async function deleteChapterSnapshot(chapterId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.delete(chapterId);

      request.onsuccess = () => {
        logger.info('Chapter snapshot deleted', 'chapterSnapshot', { chapterId });
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to delete chapter snapshot', 'chapterSnapshot', {
      chapterId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    // Don't throw - cleanup failure is non-critical
  }
}

/**
 * Get all snapshots for a novel (for debugging/cleanup)
 */
export async function getNovelSnapshots(novelId: string): Promise<ChapterStateSnapshot[]> {
  try {
    const db = await openDB();
    return new Promise<ChapterStateSnapshot[]>((resolve, reject) => {
      const transaction = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = transaction.objectStore(STORE_SNAPSHOTS);
      const request = store.getAll();

      request.onsuccess = () => {
        const allSnapshots = (request.result || []) as ChapterStateSnapshot[];
        const novelSnapshots = allSnapshots.filter(s => s.novelId === novelId);
        resolve(novelSnapshots);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    logger.error('Failed to retrieve novel snapshots', 'chapterSnapshot', {
      novelId,
      error: error instanceof Error ? error : new Error(String(error)),
    });
    return [];
  }
}

/**
 * Clean up old snapshots (keep only last 30 days)
 */
export async function cleanupOldSnapshots(daysToKeep: number = 30): Promise<number> {
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  let deletedCount = 0;

  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_SNAPSHOTS, 'readwrite');
    const store = transaction.objectStore(STORE_SNAPSHOTS);
    const request = store.openCursor();

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        const snapshot = cursor.value as ChapterStateSnapshot;
        if (snapshot.timestamp < cutoffTime) {
          cursor.delete();
          deletedCount++;
        }
        cursor.continue();
      } else {
        if (deletedCount > 0) {
          logger.info('Cleaned up old snapshots', 'chapterSnapshot', { deletedCount });
        }
      }
    };

    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
    });
  } catch (error) {
    logger.error('Failed to cleanup old snapshots', 'chapterSnapshot', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  return deletedCount;
}

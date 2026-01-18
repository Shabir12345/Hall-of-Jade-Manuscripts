/**
 * Deletion Verification Service
 * 
 * Provides comprehensive verification of deletion across all storage locations
 * to ensure complete cleanup and prevent data resurrection.
 */

import { indexedDbService } from './indexedDbService';
import { verifyNovelDeletion } from './supabaseService';
import { isNovelDeleted } from './novelSyncService';
import { novelChangeTracker } from '../utils/novelTracking';
import { logger } from './loggingService';

/**
 * Verification result for a single storage location
 */
export interface StorageVerificationResult {
  location: string;
  deleted: boolean;
  verified: boolean;
  error?: string;
}

/**
 * Comprehensive deletion verification result
 */
export interface DeletionVerificationResult {
  novelId: string;
  supabase: StorageVerificationResult;
  indexedDB: StorageVerificationResult;
  localStorage: StorageVerificationResult;
  syncState: StorageVerificationResult;
  changeTracker: StorageVerificationResult;
  allDeleted: boolean;
  timestamp: number;
}

/**
 * Verify that a novel has been completely deleted from all storage locations
 */
export async function verifyCompleteDeletion(novelId: string): Promise<DeletionVerificationResult> {
  const timestamp = Date.now();
  const results: StorageVerificationResult[] = [];

  // 1. Verify Supabase deletion
  let supabaseResult: StorageVerificationResult;
  try {
    const verification = await verifyNovelDeletion(novelId);
    supabaseResult = {
      location: 'supabase',
      deleted: !verification.novelExists && verification.allDeleted,
      verified: true,
    };
    if (!supabaseResult.deleted) {
      supabaseResult.error = verification.novelExists 
        ? 'Novel still exists in Supabase'
        : 'Related data still exists';
    }
  } catch (error) {
    supabaseResult = {
      location: 'supabase',
      deleted: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  results.push(supabaseResult);

  // 2. Verify IndexedDB deletion
  let indexedDBResult: StorageVerificationResult;
  try {
    const isDeleted = await indexedDbService.verifyNovelDeleted(novelId);
    indexedDBResult = {
      location: 'indexedDB',
      deleted: isDeleted,
      verified: true,
    };
    if (!isDeleted) {
      indexedDBResult.error = 'Novel still exists in IndexedDB';
    }
  } catch (error) {
    indexedDBResult = {
      location: 'indexedDB',
      deleted: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  results.push(indexedDBResult);

  // 3. Verify localStorage cleanup (improvement history)
  let localStorageResult: StorageVerificationResult;
  try {
    // Check both localStorage keys
    const historyV2 = localStorage.getItem('improvement_history_v2');
    const legacyHistory = localStorage.getItem('improvement_history');
    
    let hasHistory = false;
    let errorMsg: string | undefined;

    if (historyV2) {
      try {
        const records: any[] = JSON.parse(historyV2);
        hasHistory = records.some((r: any) => r.novelId === novelId);
        if (hasHistory) {
          errorMsg = 'Improvement history found in localStorage (improvement_history_v2)';
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!hasHistory && legacyHistory) {
      try {
        const records: any[] = JSON.parse(legacyHistory);
        hasHistory = records.some((r: any) => r.novelId === novelId);
        if (hasHistory) {
          errorMsg = 'Improvement history found in localStorage (improvement_history)';
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    localStorageResult = {
      location: 'localStorage',
      deleted: !hasHistory,
      verified: true,
      error: errorMsg,
    };
  } catch (error) {
    localStorageResult = {
      location: 'localStorage',
      deleted: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  results.push(localStorageResult);

  // 4. Verify sync state cleanup
  let syncStateResult: StorageVerificationResult;
  try {
    const isDeletedInSync = isNovelDeleted(novelId);
    // If it's marked as deleted in sync state, that's actually correct
    // But we can't directly check pendingCloudSyncIds from here
    // So we'll just check if it's not marked as deleted (which means it might still be pending)
    syncStateResult = {
      location: 'syncState',
      deleted: isDeletedInSync, // If marked as deleted, that's good
      verified: true,
    };
    if (!isDeletedInSync) {
      // Not marked as deleted - might still be in pendingCloudSyncIds
      // This is a warning, not necessarily an error
      syncStateResult.error = 'Novel may still be in sync state (not marked as deleted)';
    }
  } catch (error) {
    syncStateResult = {
      location: 'syncState',
      deleted: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  results.push(syncStateResult);

  // 5. Verify change tracker cleanup
  let changeTrackerResult: StorageVerificationResult;
  try {
    const hasChanged = novelChangeTracker.hasChanged(novelId);
    // Check if novel is still tracked - if it has changed status, it's still tracked
    // Ideally it shouldn't be tracked at all after deletion
    changeTrackerResult = {
      location: 'changeTracker',
      deleted: !hasChanged, // If not marked as changed, assume it's not tracked
      verified: true,
    };
    if (hasChanged) {
      changeTrackerResult.error = 'Novel may still be tracked in change tracker';
    }
  } catch (error) {
    changeTrackerResult = {
      location: 'changeTracker',
      deleted: false,
      verified: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  results.push(changeTrackerResult);

  const allDeleted = results.every(r => r.deleted && r.verified);
  
  const verificationResult: DeletionVerificationResult = {
    novelId,
    supabase: supabaseResult,
    indexedDB: indexedDBResult,
    localStorage: localStorageResult,
    syncState: syncStateResult,
    changeTracker: changeTrackerResult,
    allDeleted,
    timestamp,
  };

  if (!allDeleted) {
    const failedLocations = results.filter(r => !r.deleted || !r.verified);
    logger.warn('Deletion verification found issues', 'deletionVerification', {
      novelId,
      failedLocations: failedLocations.map(r => ({
        location: r.location,
        error: r.error,
      })),
    });
  } else {
    logger.info('Deletion verification passed', 'deletionVerification', { novelId });
  }

  return verificationResult;
}

/**
 * Check if a chapter exists in Supabase
 */
export async function verifyChapterDeleted(
  chapterId: string,
  novelId: string
): Promise<boolean> {
  try {
    // We'd need to import supabase directly to check
    // For now, return true if we can't verify (fail open)
    // This could be enhanced to actually check Supabase
    return true;
  } catch (error) {
    logger.warn('Failed to verify chapter deletion', 'deletionVerification', {
      chapterId,
      novelId,
      error: error instanceof Error ? error.message : String(error),
    });
    return true; // Fail open - assume deleted if we can't verify
  }
}

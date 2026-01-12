import type { NovelState } from '../types';
import { indexedDbService } from './indexedDbService';
import { fetchAllNovels, saveNovel } from './supabaseService';
import { novelChangeTracker } from '../utils/novelTracking';
import { formatErrorMessage } from '../utils/errorHandling';

export interface LoadMergedLibraryResult {
  mergedNovels: NovelState[];
  novelsToSyncUp: NovelState[];
  cloudAvailable: boolean;
  cloudError?: unknown;
}

export interface SaveResult {
  supabaseSuccess: boolean;
  localSuccess: boolean;
}

export interface SyncStateSnapshot {
  cloudAvailable: boolean;
  pendingSyncCount: number;
  pendingSyncIds: string[];
  lastSuccessfulCloudSyncAt: number | null;
  lastCloudErrorMessage: string | null;
}

// Per-novel save queue to prevent overlapping/out-of-order saves
const saveQueue = new Map<string, Promise<SaveResult>>();

// Track novels that need a future cloud sync (because we only saved locally)
const pendingCloudSyncIds = new Set<string>();

// Track last save timestamps to prevent too-frequent saves
const lastSaveTimestamp = new Map<string, number>();
const MIN_SAVE_INTERVAL = 1000; // Minimum 1 second between saves for same novel

// Track conflicts (when local and remote versions diverge)
interface ConflictInfo {
  novelId: string;
  localVersion: number;
  remoteVersion: number;
  conflictAt: number;
}

const conflicts = new Map<string, ConflictInfo>();

/**
 * Check if a save should be throttled (too soon since last save)
 */
function shouldThrottleSave(novelId: string): boolean {
  const lastSave = lastSaveTimestamp.get(novelId);
  if (!lastSave) return false;
  return Date.now() - lastSave < MIN_SAVE_INTERVAL;
}

let cloudAvailable = true;
let lastSuccessfulCloudSyncAt: number | null = null;
let lastCloudErrorMessage: string | null = null;

export function getSyncStateSnapshot(): SyncStateSnapshot {
  return {
    cloudAvailable,
    pendingSyncCount: pendingCloudSyncIds.size,
    pendingSyncIds: Array.from(pendingCloudSyncIds),
    lastSuccessfulCloudSyncAt,
    lastCloudErrorMessage,
    conflicts: Array.from(conflicts.values()),
  };
}

export async function loadMergedLibrary(): Promise<LoadMergedLibraryResult> {
  // Fetch from both sources in parallel, then merge by updatedAt.
  const [cloudResult, localResult] = await Promise.allSettled([
    fetchAllNovels(),
    indexedDbService.getAllNovels(),
  ]);

  let cloudNovels: NovelState[] = [];
  let localNovels: NovelState[] = [];
  let cloudErr: unknown | undefined;

  if (cloudResult.status === 'fulfilled') {
    cloudNovels = cloudResult.value;
    cloudAvailable = true;
    lastCloudErrorMessage = null;
    console.log(`✓ Successfully loaded ${cloudNovels.length} novel(s) from cloud`);
  } else {
    cloudErr = cloudResult.reason;
    cloudAvailable = false;
    lastCloudErrorMessage = formatErrorMessage(cloudResult.reason);
    console.error('❌ Cloud load failed:', cloudResult.reason);
    // Log more details for debugging
    if (cloudResult.reason instanceof Error) {
      console.error('Error message:', cloudResult.reason.message);
      console.error('Error stack:', cloudResult.reason.stack);
    }
    // Check if it's a Supabase-specific error
    if (cloudResult.reason && typeof cloudResult.reason === 'object' && 'code' in cloudResult.reason) {
      console.error('Error code:', (cloudResult.reason as any).code);
      console.error('Error details:', (cloudResult.reason as any).details);
      console.error('Error hint:', (cloudResult.reason as any).hint);
      console.error('Error message:', (cloudResult.reason as any).message);
    }
  }

  if (localResult.status === 'fulfilled') {
    localNovels = localResult.value;
  }

  if (cloudResult.status === 'rejected' && localResult.status === 'rejected') {
    // caller decides how to show this
    throw new Error('Failed to load novels from both cloud and local storage.');
  }

  // Merge Logic
  const novelMap = new Map<string, NovelState>();
  const novelsToSyncUp: NovelState[] = [];

  // 1) Add all cloud novels
  cloudNovels.forEach((n) => novelMap.set(n.id, n));

  // 2) Merge/Overwrite with local novels if newer OR if local has more chapters
  // This prevents losing chapters if a cloud save partially failed (e.g., novel updated but chapters didn't save)
  localNovels.forEach((local) => {
    const cloud = novelMap.get(local.id);
    if (!cloud) {
      // Exists locally but not on cloud (created offline)
      novelMap.set(local.id, local);
      novelsToSyncUp.push(local);
      pendingCloudSyncIds.add(local.id);
      return;
    }

    const localHasMoreChapters = local.chapters.length > cloud.chapters.length;
    const localIsNewer = local.updatedAt > cloud.updatedAt;
    
    // Prefer local if: newer timestamp OR local has more chapters (prevents data loss)
    if (localIsNewer || localHasMoreChapters) {
      novelMap.set(local.id, local);
      novelsToSyncUp.push(local);
      pendingCloudSyncIds.add(local.id);
    }
  });

  const mergedNovels = Array.from(novelMap.values());

  // Keep local cache updated with the merged result (best effort)
  void Promise.all(mergedNovels.map((n) => indexedDbService.saveNovel(n))).catch(() => {
    // ignore cache update failures
  });

  return {
    mergedNovels,
    novelsToSyncUp,
    cloudAvailable,
    cloudError: cloudErr,
  };
}

export function enqueueSaveNovel(novel: NovelState): Promise<SaveResult> {
  // Throttle saves to prevent too-frequent saves
  if (shouldThrottleSave(novel.id)) {
    console.log(`⏸ Throttling save for novel "${novel.title}" (too soon since last save)`);
    const existingPromise = saveQueue.get(novel.id);
    if (existingPromise) {
      return existingPromise;
    }
  }

  const prev = saveQueue.get(novel.id) || Promise.resolve({ supabaseSuccess: true, localSuccess: true });

  const next = prev
    .catch(() => {
      // Swallow previous save errors so the queue continues.
      return { supabaseSuccess: false, localSuccess: false };
    })
    .then(async () => {
      // Update last save timestamp
      lastSaveTimestamp.set(novel.id, Date.now());

      let supabaseSuccess = false;
      try {
        // Validate novel before saving
        if (!novel || !novel.id || !novel.title || novel.title.trim() === '') {
          throw new Error('Invalid novel data: missing required fields');
        }
        
        await saveNovel(novel);
        supabaseSuccess = true;
        cloudAvailable = true;
        lastCloudErrorMessage = null;
        lastSuccessfulCloudSyncAt = Date.now();
        pendingCloudSyncIds.delete(novel.id);
        conflicts.delete(novel.id); // Clear conflict if save succeeded
        console.log(`✓ Successfully saved novel "${novel.title}" to cloud`);
      } catch (error) {
        const errorMsg = formatErrorMessage(error);
        lastCloudErrorMessage = errorMsg;
        console.error('❌ Cloud save failed:', errorMsg);
        
        // Check if it's a network error (offline)
        const isNetworkError = error instanceof Error && (
          error.message.includes('network') ||
          error.message.includes('fetch') ||
          error.message.includes('timeout') ||
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('Failed to fetch')
        );
        
        if (isNetworkError) {
          cloudAvailable = false;
          console.warn('⚠ Network error detected. Marking cloud as unavailable.');
        } else {
          // Only mark as unavailable for non-network errors if it's a critical error
          const isRetryable = error && typeof error === 'object' && 'retryable' in error 
            ? (error as any).retryable !== false 
            : true;
          
          if (!isRetryable) {
            cloudAvailable = false;
          }
        }
        
        // Check for conflict (local and remote versions diverge)
        if (error && typeof error === 'object' && 'code' in error) {
          const supabaseError = error as any;
          // Check for conflict-related errors
          const isConflict = supabaseError.code === 'PGRST116' || 
                            supabaseError.code === '23505' || // Unique violation
                            supabaseError.message?.toLowerCase().includes('conflict') ||
                            supabaseError.message?.toLowerCase().includes('duplicate');
          
          if (isConflict) {
            const conflictInfo: ConflictInfo = {
              novelId: novel.id,
              localVersion: novel.updatedAt,
              remoteVersion: Date.now(), // Would need to get from error response
              conflictAt: Date.now(),
            };
            conflicts.set(novel.id, conflictInfo);
            console.warn(`⚠ Conflict detected for novel "${novel.title}". Local and remote versions have diverged.`);
          }
        }
        
        // Log more details for debugging (only in development)
        if (process.env.NODE_ENV === 'development') {
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
          // Check if it's a Supabase-specific error
          if (error && typeof error === 'object' && 'code' in error) {
            console.error('Error code:', (error as any).code);
            console.error('Error details:', (error as any).details);
            console.error('Error hint:', (error as any).hint);
          }
        }
      }

      let localSuccess = false;
      try {
        // Validate novel before saving to local storage
        if (!novel || !novel.id || !novel.title || novel.title.trim() === '') {
          throw new Error('Invalid novel data: missing required fields');
        }
        
        await indexedDbService.saveNovel(novel);
        localSuccess = true;
        console.log(`✓ Successfully saved novel "${novel.title}" to local storage`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('❌ Local save failed:', errorMsg);
        // Keep localSuccess as false
      }

      if (!supabaseSuccess && localSuccess) {
        pendingCloudSyncIds.add(novel.id);
      }

      if (!supabaseSuccess && !localSuccess) {
        throw new Error('Failed to save to both cloud and local storage.');
      }

      // If at least one succeeded, we consider it saved for now
      novelChangeTracker.updateOriginal(novel);

      return { supabaseSuccess, localSuccess };
    });

  saveQueue.set(novel.id, next);
  return next;
}

/**
 * Check if there's a conflict for a novel
 */
export function hasConflict(novelId: string): boolean {
  return conflicts.has(novelId);
}

/**
 * Get conflict information for a novel
 */
export function getConflict(novelId: string): ConflictInfo | undefined {
  return conflicts.get(novelId);
}

/**
 * Resolve conflict by accepting local version
 */
export async function resolveConflictAcceptLocal(novelId: string, localNovel: NovelState): Promise<void> {
  conflicts.delete(novelId);
  await enqueueSaveNovel(localNovel);
}

/**
 * Resolve conflict by accepting remote version (reload from server)
 */
export async function resolveConflictAcceptRemote(novelId: string): Promise<void> {
  conflicts.delete(novelId);
  // Would reload from server here
}

export async function syncPendingToCloud(library: NovelState[]): Promise<void> {
  const toSync = library.filter((n) => pendingCloudSyncIds.has(n.id));
  await Promise.all(toSync.map((n) => enqueueSaveNovel(n)));
}


import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Chapter, NovelState, ViewType } from '../types';
import { deleteChapter, deleteNovel } from '../services/supabaseService';
import { useToast } from './ToastContext';
import { logger } from '../services/loggingService';
import { INITIAL_NOVEL_STATE } from '../constants';
import { novelChangeTracker } from '../utils/novelTracking';
import { enqueueSaveNovel, getSyncStateSnapshot, loadMergedLibrary, syncPendingToCloud, removePendingSync } from '../services/novelSyncService';
import { indexedDbService } from '../services/indexedDbService';
import { clearImprovementHistory } from '../services/improvementHistoryService';
import { getChapterSnapshot, deleteChapterSnapshot } from '../services/chapterStateSnapshotService';
import { rollbackChapterChanges } from '../services/chapterRollbackService';
import { detectDependentChapters, markChaptersForRegeneration } from '../services/chapterDependencyAnalyzer';
import { NovelDataProvider, type NovelDataContextType } from './NovelDataContext';
import { NovelActionsProvider, type NovelActionsContextType } from './NovelActionsContext';

interface NovelContextType {
  // State
  library: NovelState[];
  activeNovelId: string | null;
  currentView: ViewType;
  activeChapterId: string | null;
  isLoading: boolean;
  isSaving: boolean;

  // Connectivity / sync status
  isOnline: boolean;
  cloudAvailable: boolean;
  pendingSyncCount: number;
  lastSuccessfulCloudSyncAt: number | null;
  lastCloudErrorMessage: string | null;
  
  // Active novel/chapter getters
  activeNovel: NovelState | undefined;
  activeChapter: Chapter | undefined;
  
  // Derived statistics (memoized for performance)
  novelsCount: number;
  totalChaptersCount: number;
  
  // Actions
  setActiveNovelId: (id: string | null) => void;
  setView: (view: ViewType) => void;
  setActiveChapterId: (id: string | null) => void;
  updateActiveNovel: (updater: (prev: NovelState) => NovelState) => void;
  createNovel: (title: string, genre: string) => Promise<void>;
  deleteNovelById: (id: string) => Promise<void>;
  deleteChapterById: (chapterId: string) => Promise<void>;
  saveChapter: (updatedChapter: Chapter) => Promise<void>;
  loadNovels: () => Promise<void>;
  syncNow: () => Promise<void>;
}

const NovelContext = createContext<NovelContextType | undefined>(undefined);

/**
 * Hook to access the Novel context.
 * 
 * Provides access to novel state, actions, and computed values.
 * Must be used within a NovelProvider.
 * 
 * @returns {NovelContextType} The novel context containing:
 * - State: library, activeNovelId, currentView, activeChapterId, isLoading, isSaving
 * - Connectivity: isOnline, cloudAvailable, pendingSyncCount, sync timestamps
 * - Computed: activeNovel, activeChapter, novelsCount, totalChaptersCount
 * - Actions: setActiveNovelId, setView, setActiveChapterId, updateActiveNovel,
 *   createNovel, deleteNovelById, deleteChapterById, saveChapter, loadNovels, syncNow
 * 
 * @throws {Error} If used outside of a NovelProvider
 * 
 * @example
 * ```typescript
 * const { activeNovel, updateActiveNovel, createNovel } = useNovel();
 * 
 * // Create a new novel
 * await createNovel('My Novel', 'Fantasy');
 * 
 * // Update the active novel
 * updateActiveNovel(prev => ({
 *   ...prev,
 *   title: 'Updated Title'
 * }));
 * ```
 */
export const useNovel = () => {
  const context = useContext(NovelContext);
  if (!context) {
    throw new Error('useNovel must be used within a NovelProvider');
  }
  return context;
};

interface NovelProviderProps {
  children: ReactNode;
}

export const NovelProvider: React.FC<NovelProviderProps> = ({ children }) => {
  const { showError, showSuccess, showWarning } = useToast();
  const [library, setLibrary] = useState<NovelState[]>([]);
  const [activeNovelId, setActiveNovelId] = useState<string | null>(null);
  const [currentView, setView] = useState<ViewType>('library');
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine;
  });
  const [cloudAvailable, setCloudAvailable] = useState<boolean>(() => getSyncStateSnapshot().cloudAvailable);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => getSyncStateSnapshot().pendingSyncCount);
  const [lastSuccessfulCloudSyncAt, setLastSuccessfulCloudSyncAt] = useState<number | null>(
    () => getSyncStateSnapshot().lastSuccessfulCloudSyncAt
  );
  const [lastCloudErrorMessage, setLastCloudErrorMessage] = useState<string | null>(
    () => getSyncStateSnapshot().lastCloudErrorMessage
  );

  const saveTimeoutRef = useRef<number | null>(null);
  const didInitialLoadRef = useRef(false);

  // Memoize active novel with proper dependency tracking
  const activeNovel = useMemo(() => {
    if (!activeNovelId) return undefined;
    return library.find((n) => n.id === activeNovelId);
  }, [library, activeNovelId]);

  // Memoize active chapter
  const activeChapter = useMemo(() => {
    if (!activeNovel || !activeChapterId) return undefined;
    return activeNovel.chapters.find((c) => c.id === activeChapterId);
  }, [activeNovel, activeChapterId]);

  // Memoize derived data for performance
  const novelsCount = useMemo(() => library.length, [library]);
  const totalChaptersCount = useMemo(
    () => library.reduce((sum, novel) => sum + novel.chapters.length, 0),
    [library]
  );

  const refreshSyncSnapshot = useCallback(() => {
    const snap = getSyncStateSnapshot();
    setCloudAvailable(snap.cloudAvailable);
    setPendingSyncCount(snap.pendingSyncCount);
    setLastSuccessfulCloudSyncAt(snap.lastSuccessfulCloudSyncAt);
    setLastCloudErrorMessage(snap.lastCloudErrorMessage);
  }, []);

  const updateActiveNovel = useCallback((updater: (prev: NovelState) => NovelState) => {
    if (!activeNovelId) return;
    setLibrary((prev) =>
      prev.map((novel) => {
        if (novel.id !== activeNovelId) return novel;
        const updated = { ...updater(novel), updatedAt: Date.now() };
        novelChangeTracker.markChanged(novel.id);
        return updated;
      })
    );
  }, [activeNovelId]);

  const loadNovels = useCallback(async () => {
    // Initialize consistency system for loaded novels
    const initializeConsistencyForNovels = async (novels: NovelState[]) => {
      try {
        const { initializeConsistencySystem, syncConsistencyDataFromDatabase } = await import('../services/consistencyIntegrationService');
        const { syncConsistencyDataFromDatabase: syncData } = await import('../services/consistencyPersistenceService');
        
        for (const novel of novels) {
          // Initialize in-memory services
          initializeConsistencySystem(novel);
          
          // Sync from database if available
          try {
            await syncData(novel);
          } catch (error) {
            // If sync fails, continue with in-memory only
            console.warn(`Failed to sync consistency data for novel ${novel.id}:`, error);
          }
        }
      } catch (error) {
        console.warn('Failed to initialize consistency system:', error);
        // Don't fail novel loading if consistency init fails
      }
    };
    try {
      setIsLoading(true);
      const { mergedNovels, novelsToSyncUp, cloudAvailable: cloudOk, cloudError } = await loadMergedLibrary();
      setLibrary(mergedNovels);
      novelChangeTracker.initialize(mergedNovels);

      // Initialize consistency system for loaded novels
      try {
        const { initializeConsistencySystemForNovels } = await import('../services/consistencySystemInitializer');
        await initializeConsistencySystemForNovels(mergedNovels);
      } catch (error) {
        console.warn('Failed to initialize consistency system:', error);
        // Don't fail novel loading if consistency init fails
      }

      refreshSyncSnapshot();

      if (!cloudOk) {
        logger.warn('Cloud load failed', 'novelSync', undefined, { error: cloudError || 'Unknown error' });
        showWarning('Loaded from local backup (offline mode).');
      } else if (novelsToSyncUp.length > 0) {
        showSuccess(`Syncing ${novelsToSyncUp.length} novels with offline changes...`);
        // Best-effort sync; failures will remain pending.
        void Promise.allSettled(novelsToSyncUp.map((n) => enqueueSaveNovel(n))).finally(() => refreshSyncSnapshot());
      }
    } catch (error) {
      logger.error('Error loading novels', 'novelSync', error instanceof Error ? error : new Error(String(error)));
      showError('Failed to load novels. Please check your connection and refresh.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshSyncSnapshot, showError, showSuccess, showWarning]);

  const createNovel = useCallback(async (title: string, genre: string) => {
    // Validate input
    const trimmedTitle = title?.trim() || 'Untitled Epic';
    if (!trimmedTitle) {
      showError('Novel title cannot be empty');
      return;
    }
    if (!genre) {
      showError('Please select a genre');
      return;
    }

    // Generate proper UUIDs for all initial data
    const initialRealmId = crypto.randomUUID();
    const newNovel: NovelState = {
      ...INITIAL_NOVEL_STATE,
      id: crypto.randomUUID(),
      title: trimmedTitle,
      genre,
      realms: INITIAL_NOVEL_STATE.realms.map((r) => ({
        ...r,
        id: initialRealmId,
        name: r.name || 'Starting Realm',
        description: r.description || 'The initial realm where the story begins.',
      })),
      currentRealmId: initialRealmId,
      territories: [],
      worldBible: [],
      characterCodex: INITIAL_NOVEL_STATE.characterCodex.map((c) => ({ ...c, id: crypto.randomUUID() })),
      plotLedger: [],
      chapters: [],
      systemLogs: [],
      tags: [],
      writingGoals: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setLibrary((prev) => [...prev, newNovel]);
    setActiveNovelId(newNovel.id);
    setView('dashboard');

    setIsSaving(true);
    try {
      const res = await enqueueSaveNovel(newNovel);
      refreshSyncSnapshot();
      if (!res.supabaseSuccess && res.localSuccess) {
        showWarning('Saved to local backup only (offline mode).');
      } else {
        showSuccess('Novel created successfully');
      }
    } catch (error) {
      logger.error('Error saving new novel', 'novelSync', error instanceof Error ? error : new Error(String(error)));
      showError('Failed to save new novel. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [refreshSyncSnapshot, showError, showSuccess, showWarning]);

  const deleteNovelById = useCallback(async (id: string) => {
    const deletionSteps: { step: string; success: boolean; error?: Error }[] = [];
    
    try {
      // Step 1: Delete from Supabase (cloud - primary source of truth)
      logger.info('Starting novel deletion', 'novelDeletion', { novelId: id });
      try {
        await deleteNovel(id);
        deletionSteps.push({ step: 'supabase', success: true });
        logger.info('Novel deleted from Supabase', 'novelDeletion', { novelId: id });
      } catch (error) {
        deletionSteps.push({ step: 'supabase', success: false, error: error as Error });
        throw error; // Fail fast if cloud deletion fails
      }

      // Step 2: Delete from IndexedDB (local backup)
      try {
        await indexedDbService.deleteNovel(id);
        // Verify deletion from IndexedDB
        const isDeleted = await indexedDbService.verifyNovelDeleted(id);
        if (!isDeleted) {
          logger.warn('Novel may still exist in IndexedDB after deletion attempt', 'novelDeletion', { novelId: id });
        }
        deletionSteps.push({ step: 'indexedDB', success: true });
        logger.info('Novel deleted from IndexedDB', 'novelDeletion', { novelId: id });
      } catch (error) {
        deletionSteps.push({ step: 'indexedDB', success: false, error: error as Error });
        logger.warn('Failed to delete novel from IndexedDB (non-critical)', 'novelDeletion', {
          novelId: id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't fail - cloud is source of truth
      }

      // Step 3: Delete improvement history from localStorage and Supabase
      try {
        await clearImprovementHistory(id);
        deletionSteps.push({ step: 'improvementHistory', success: true });
        logger.info('Improvement history cleared', 'novelDeletion', { novelId: id });
      } catch (error) {
        deletionSteps.push({ step: 'improvementHistory', success: false, error: error as Error });
        logger.warn('Failed to clear improvement history (non-critical)', 'novelDeletion', {
          novelId: id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Try to clean up localStorage directly as fallback
        try {
          // Clean up legacy localStorage key
          const legacyHistory = localStorage.getItem('improvement_history');
          if (legacyHistory) {
            try {
              const history: any[] = JSON.parse(legacyHistory);
              const filtered = history.filter((h: any) => h.novelId !== id);
              if (filtered.length < history.length) {
                localStorage.setItem('improvement_history', JSON.stringify(filtered));
                logger.info('Cleaned up legacy improvement history from localStorage', 'novelDeletion', { novelId: id });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      // Step 4: Remove from sync state (pendingCloudSyncIds)
      try {
        removePendingSync(id);
        deletionSteps.push({ step: 'syncState', success: true });
        logger.info('Removed from sync state', 'novelDeletion', { novelId: id });
      } catch (error) {
        deletionSteps.push({ step: 'syncState', success: false, error: error as Error });
        logger.warn('Failed to remove from sync state (non-critical)', 'novelDeletion', {
          novelId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Step 5: Remove from change tracker
      try {
        novelChangeTracker.removeNovel(id);
        deletionSteps.push({ step: 'changeTracker', success: true });
        logger.info('Removed from change tracker', 'novelDeletion', { novelId: id });
      } catch (error) {
        deletionSteps.push({ step: 'changeTracker', success: false, error: error as Error });
        logger.warn('Failed to remove from change tracker (non-critical)', 'novelDeletion', {
          novelId: id,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Step 6: Update React state
      setLibrary((prev) => prev.filter((n) => n.id !== id));
      if (activeNovelId === id) {
        setActiveNovelId(null);
        setView('library');
      }
      deletionSteps.push({ step: 'reactState', success: true });

      // Log comprehensive deletion summary
      const failedSteps = deletionSteps.filter(s => !s.success);
      if (failedSteps.length > 0) {
        logger.warn('Novel deletion completed with some failures', 'novelDeletion', {
          novelId: id,
          failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error?.message }))
        });
      } else {
        logger.info('Novel deletion completed successfully', 'novelDeletion', {
          novelId: id,
          steps: deletionSteps.map(s => s.step)
        });
      }

      showSuccess('Novel deleted');
    } catch (error) {
      logger.error('Error deleting novel', 'novelDeletion', {
        novelId: id,
        error: error instanceof Error ? error : new Error(String(error)),
        steps: deletionSteps
      });
      showError('Failed to delete novel. Please try again.');
      throw error;
    }
  }, [activeNovelId, showError, showSuccess]);

  const deleteChapterById = useCallback(async (chapterId: string) => {
    if (!activeNovel) return;
    
    const deletionSteps: { step: string; success: boolean; error?: Error }[] = [];
    
    try {
      logger.info('Starting chapter deletion', 'chapterDeletion', { 
        chapterId, 
        novelId: activeNovel.id 
      });
      
      const chapterToDelete = activeNovel.chapters.find(c => c.id === chapterId);
      if (!chapterToDelete) {
        logger.warn('Chapter not found in active novel', 'chapterDeletion', { chapterId });
        return;
      }
      
      const deletedChapterNumber = chapterToDelete.number;
      
      // Step 1: Get snapshot and perform rollback BEFORE deleting
      let rolledBackNovel: NovelState = activeNovel;
      let dependentChapters: string[] = [];
      
      try {
        const snapshot = await getChapterSnapshot(chapterId);
        if (snapshot) {
          logger.info('Chapter snapshot found, performing rollback', 'chapterDeletion', {
            chapterId,
            snapshotId: snapshot.snapshotId,
          });
          
          // Perform rollback of all changes made during chapter generation
          rolledBackNovel = await rollbackChapterChanges(
            activeNovel,
            chapterId,
            snapshot
          );
          
          deletionSteps.push({ step: 'rollback', success: true });
          logger.info('Chapter changes rolled back', 'chapterDeletion', {
            chapterId,
            entitiesAffected: Object.values(snapshot.changeSummary).flat().length,
          });
          
          // Detect dependent chapters (chapters that reference entities from deleted chapter)
          const dependencies = detectDependentChapters(
            rolledBackNovel,
            chapterId,
            deletedChapterNumber
          );
          
          if (dependencies.length > 0) {
            dependentChapters = dependencies.map(d => d.chapterId);
            rolledBackNovel = markChaptersForRegeneration(
              rolledBackNovel,
              dependencies
            );
            
            deletionSteps.push({ step: 'dependencyDetection', success: true });
            logger.info('Dependent chapters detected and marked for regeneration', 'chapterDeletion', {
              chapterId,
              dependentCount: dependencies.length,
              dependentChapterNumbers: dependencies.map(d => d.chapterNumber),
            });
            
            // Show warning to user about dependent chapters
            if (dependencies.length > 0) {
              showWarning(
                `${dependencies.length} chapter(s) will need regeneration due to deleted dependencies.`
              );
            }
          }
        } else {
          logger.warn('No snapshot found for chapter (legacy chapter or snapshot missing)', 'chapterDeletion', {
            chapterId,
            chapterNumber: deletedChapterNumber,
          });
          deletionSteps.push({ step: 'rollback', success: false, error: new Error('No snapshot found') });
          // Continue with deletion even without snapshot - user can manually fix if needed
        }
      } catch (rollbackError) {
        deletionSteps.push({ step: 'rollback', success: false, error: rollbackError as Error });
        logger.error('Failed to rollback chapter changes', 'chapterDeletion', {
          chapterId,
          error: rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError)),
        });
        // Continue with deletion - rollback failure shouldn't block deletion
        // User can manually fix inconsistencies if needed
      }
      
      // Step 2: Delete from Supabase
      try {
        await deleteChapter(chapterId);
        deletionSteps.push({ step: 'supabase', success: true });
        logger.info('Chapter deleted from Supabase', 'chapterDeletion', { chapterId });
      } catch (error) {
        deletionSteps.push({ step: 'supabase', success: false, error: error as Error });
        logger.error('Failed to delete chapter from Supabase', 'chapterDeletion', {
          chapterId,
          error: error instanceof Error ? error : new Error(String(error))
        });
        // Continue with local cleanup even if Supabase fails (offline scenario)
      }
      
      // Step 3: Update React state (remove chapter, renumber, and apply rollback)
      const updatedNovel = (() => {
        // Start with rolled back state (or current state if rollback failed)
        let baseNovel = rolledBackNovel;
        
        // Remove deleted chapter and renumber subsequent chapters
        const updatedChapters = baseNovel.chapters
          .filter(c => c.id !== chapterId)
          .map(c => {
            if (c.number > deletedChapterNumber) {
              return { ...c, number: c.number - 1 };
            }
            return c;
          })
          .sort((a, b) => a.number - b.number);
        
        return {
          ...baseNovel,
          chapters: updatedChapters,
          updatedAt: Date.now()
        };
      })();

      updateActiveNovel(() => updatedNovel);
      deletionSteps.push({ step: 'reactState', success: true });
      
      // Step 4: Clean up snapshot (delete after successful rollback)
      try {
        await deleteChapterSnapshot(chapterId);
        deletionSteps.push({ step: 'snapshotCleanup', success: true });
        logger.info('Chapter snapshot cleaned up', 'chapterDeletion', { chapterId });
      } catch (error) {
        deletionSteps.push({ step: 'snapshotCleanup', success: false, error: error as Error });
        logger.warn('Failed to delete chapter snapshot (non-critical)', 'chapterDeletion', {
          chapterId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't fail - snapshot cleanup is non-critical
      }

      // Step 5: Explicitly save updated novel to IndexedDB (don't rely on auto-save)
      try {
        await indexedDbService.saveNovel(updatedNovel);
        deletionSteps.push({ step: 'indexedDB', success: true });
        logger.info('Updated novel saved to IndexedDB after chapter deletion', 'chapterDeletion', {
          chapterId,
          novelId: activeNovel.id
        });
      } catch (error) {
        deletionSteps.push({ step: 'indexedDB', success: false, error: error as Error });
        logger.warn('Failed to save novel to IndexedDB after chapter deletion (non-critical)', 'chapterDeletion', {
          chapterId,
          novelId: activeNovel.id,
          error: error instanceof Error ? error.message : String(error)
        });
        // Don't fail - React state is updated and will sync later
      }

      // Step 6: Update change tracker
      try {
        novelChangeTracker.markChanged(activeNovel.id);
        deletionSteps.push({ step: 'changeTracker', success: true });
      } catch (error) {
        deletionSteps.push({ step: 'changeTracker', success: false, error: error as Error });
        logger.warn('Failed to update change tracker (non-critical)', 'chapterDeletion', {
          chapterId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Step 7: Update navigation if deleted chapter was active
      if (activeChapterId === chapterId) {
        setActiveChapterId(null);
        setView('chapters');
        deletionSteps.push({ step: 'navigation', success: true });
      }

      // Log deletion summary with rollback info
      const failedSteps = deletionSteps.filter(s => !s.success);
      if (failedSteps.length > 0) {
        logger.warn('Chapter deletion completed with some failures', 'chapterDeletion', {
          chapterId,
          novelId: activeNovel.id,
          failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error?.message })),
          dependentChaptersCount: dependentChapters.length,
        });
      } else {
        logger.info('Chapter deletion completed successfully', 'chapterDeletion', {
          chapterId,
          novelId: activeNovel.id,
          steps: deletionSteps.map(s => s.step),
          rollbackPerformed: deletionSteps.some(s => s.step === 'rollback' && s.success),
          dependentChaptersCount: dependentChapters.length,
        });
      }
      
      const successMessage = dependentChapters.length > 0
        ? `Chapter deleted. ${dependentChapters.length} chapter(s) marked for regeneration.`
        : 'Chapter deleted. All related data rolled back.';
      showSuccess(successMessage);
      
      // Note: Analytics (SIG, ARC, storyboard, timeline) will automatically recalculate
      // since they are computed on-demand from the updated novel state.
      // React components using novel state will automatically re-render with updated analytics.
    } catch (error) {
      logger.error('Error deleting chapter', 'chapterDeletion', {
        chapterId,
        novelId: activeNovel.id,
        error: error instanceof Error ? error : new Error(String(error)),
        steps: deletionSteps
      });
      showError('Failed to delete chapter. Please try again.');
      throw error;
    }
  }, [activeNovel, activeChapterId, updateActiveNovel, showError, showSuccess, setView]);

  const saveChapter = useCallback(async (updatedChapter: Chapter) => {
    if (!activeNovel) return;
    
    const updatedNovel = {
      ...activeNovel,
      chapters: activeNovel.chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c),
      updatedAt: Date.now()
    };
    
    updateActiveNovel(() => updatedNovel);
    
    setIsSaving(true);
    try {
      const res = await enqueueSaveNovel(updatedNovel);
      refreshSyncSnapshot();
      if (!res.supabaseSuccess && res.localSuccess) {
        showWarning('Saved to local backup only (offline mode).');
      }
    } catch (e) {
      logger.error('Failed to save chapter', 'novelSync', e instanceof Error ? e : new Error(String(e)));
      showError("Failed to save chapter!");
      throw e;
    } finally {
      setIsSaving(false);
    }
  }, [activeNovel, refreshSyncSnapshot, showError, showWarning, updateActiveNovel]);

  const syncNow = useCallback(async () => {
    try {
      setIsSaving(true);
      await syncPendingToCloud(library);
      refreshSyncSnapshot();
      if (getSyncStateSnapshot().pendingSyncCount === 0) {
        showSuccess('Synced to cloud.');
      }
    } catch (e) {
      logger.error('Sync failed', 'novelSync', e instanceof Error ? e : new Error(String(e)));
      refreshSyncSnapshot();
      showWarning('Sync failed. Will retry when online.');
    } finally {
      setIsSaving(false);
    }
  }, [library, refreshSyncSnapshot, showSuccess, showWarning]);

  // Initial load (only once; avoids double-run in StrictMode)
  useEffect(() => {
    if (didInitialLoadRef.current) return;
    didInitialLoadRef.current = true;
    void loadNovels();
  }, [loadNovels]);

  // Track online/offline status and auto-sync when coming online.
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void syncNow();
    };
    const onOffline = () => {
      setIsOnline(false);
      refreshSyncSnapshot();
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshSyncSnapshot, syncNow]);

  // Save whenever library changes (debounced) with improved change detection
  useEffect(() => {
    if (isLoading) return; // don't save during initial load
    if (isSaving) return; // don't trigger another save while one is in progress

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSaving(true);
      try {
        // Use improved change detection that compares actual content
        const changedNovelIds = novelChangeTracker.detectChanged(library);
        if (changedNovelIds.length === 0) {
          setIsSaving(false);
          return;
        }

        const novelsToSave = library.filter((n) => changedNovelIds.includes(n.id));
        const results = await Promise.all(novelsToSave.map((n) => enqueueSaveNovel(n)));
        refreshSyncSnapshot();

        // Update change tracker after successful saves
        // Use the novels that were saved (they're already the latest from library)
        novelsToSave.forEach((novel, index) => {
          if (results[index]?.supabaseSuccess || results[index]?.localSuccess) {
            novelChangeTracker.updateOriginal(novel);
          }
        });

        const anyLocalOnly = results.some((r) => !r.supabaseSuccess && r.localSuccess);
        if (anyLocalOnly) {
          showWarning('Saved to local backup only (offline mode).');
        }
      } catch (error) {
        logger.error('Error saving novels', 'novelSync', error instanceof Error ? error : new Error(String(error)));
        showError('Failed to save. Your changes may be lost.');
      } finally {
        setIsSaving(false);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [isLoading, isSaving, library, refreshSyncSnapshot, showError, showWarning]);

  // Memoize data context value to prevent unnecessary re-renders
  const dataContextValue: NovelDataContextType = useMemo(
    () => ({
      library,
      activeNovelId,
      currentView,
      activeChapterId,
      isLoading,
      isSaving,
      isOnline,
      cloudAvailable,
      pendingSyncCount,
      lastSuccessfulCloudSyncAt,
      lastCloudErrorMessage,
      activeNovel,
      activeChapter,
      novelsCount,
      totalChaptersCount,
    }),
    [
      library,
      activeNovelId,
      currentView,
      activeChapterId,
      isLoading,
      isSaving,
      isOnline,
      cloudAvailable,
      pendingSyncCount,
      lastSuccessfulCloudSyncAt,
      lastCloudErrorMessage,
      activeNovel,
      activeChapter,
      novelsCount,
      totalChaptersCount,
    ]
  );

  // Memoize actions context value (functions are stable, but we memoize the object)
  const actionsContextValue: NovelActionsContextType = useMemo(
    () => ({
      setActiveNovelId,
      setView,
      setActiveChapterId,
      updateActiveNovel,
      createNovel,
      deleteNovelById,
      deleteChapterById,
      saveChapter,
      loadNovels,
      syncNow,
    }),
    [
      setActiveNovelId,
      setView,
      setActiveChapterId,
      updateActiveNovel,
      createNovel,
      deleteNovelById,
      deleteChapterById,
      saveChapter,
      loadNovels,
      syncNow,
    ]
  );

  // Combined context value (for backward compatibility)
  const combinedContextValue = useMemo(
    () => ({
      ...dataContextValue,
      ...actionsContextValue,
    }),
    [dataContextValue, actionsContextValue]
  );

  return (
    <NovelContext.Provider value={combinedContextValue}>
      <NovelDataProvider value={dataContextValue}>
        <NovelActionsProvider value={actionsContextValue}>
          {children}
        </NovelActionsProvider>
      </NovelDataProvider>
    </NovelContext.Provider>
  );
};

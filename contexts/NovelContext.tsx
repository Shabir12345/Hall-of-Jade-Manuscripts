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
import { enqueueSaveNovel, getSyncStateSnapshot, loadMergedLibrary, syncPendingToCloud } from '../services/novelSyncService';
import { indexedDbService } from '../services/indexedDbService';

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
    try {
      setIsLoading(true);
      const { mergedNovels, novelsToSyncUp, cloudAvailable: cloudOk, cloudError } = await loadMergedLibrary();
      setLibrary(mergedNovels);
      novelChangeTracker.initialize(mergedNovels);

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
    try {
      await deleteNovel(id);
      // Also remove from local backup to prevent resurrection on reload
      await indexedDbService.deleteNovel(id);

      setLibrary((prev) => prev.filter((n) => n.id !== id));
      if (activeNovelId === id) {
        setActiveNovelId(null);
        setView('library');
      }
      showSuccess('Novel deleted');
    } catch (error) {
      logger.error('Error deleting novel', 'novelSync', error instanceof Error ? error : new Error(String(error)));
      showError('Failed to delete novel. Please try again.');
      throw error;
    }
  }, [activeNovelId, showError, showSuccess]);

  const deleteChapterById = useCallback(async (chapterId: string) => {
    if (!activeNovel) return;
    
    try {
      await deleteChapter(chapterId);
      const chapterToDelete = activeNovel.chapters.find(c => c.id === chapterId);
      if (!chapterToDelete) return;
      
      const deletedChapterNumber = chapterToDelete.number;
      
      updateActiveNovel(prev => {
        const updatedChapters = prev.chapters
          .filter(c => c.id !== chapterId)
          .map(c => {
            if (c.number > deletedChapterNumber) {
              return { ...c, number: c.number - 1 };
            }
            return c;
          })
          .sort((a, b) => a.number - b.number);
        
        return {
          ...prev,
          chapters: updatedChapters
        };
      });
      
      if (activeChapterId === chapterId) {
        setActiveChapterId(null);
        setView('chapters');
      }
      
      showSuccess('Chapter deleted');
    } catch (error) {
      logger.error('Error deleting chapter', 'novelSync', error instanceof Error ? error : new Error(String(error)));
      showError('Failed to delete chapter. Please try again.');
      throw error;
    }
  }, [activeNovel, activeChapterId, updateActiveNovel, showError, showSuccess]);

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

    if (saveTimeoutRef.current) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      setIsSaving(true);
      try {
        // Use improved change detection that compares actual content
        const changedNovelIds = novelChangeTracker.detectChanged(library);
        if (changedNovelIds.length === 0) return;

        const novelsToSave = library.filter((n) => changedNovelIds.includes(n.id));
        const results = await Promise.all(novelsToSave.map((n) => enqueueSaveNovel(n)));
        refreshSyncSnapshot();

        // Update change tracker after successful saves
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
  }, [isLoading, library, refreshSyncSnapshot, showError, showWarning]);

  return (
    <NovelContext.Provider
      value={{
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
      }}
    >
      {children}
    </NovelContext.Provider>
  );
};

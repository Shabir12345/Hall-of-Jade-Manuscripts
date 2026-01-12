import React, { createContext, useContext, type ReactNode } from 'react';
import type { Chapter, NovelState, ViewType } from '../types';

/**
 * Context type for novel data (state that changes frequently)
 * This context contains all data properties that trigger re-renders when they change.
 */
export interface NovelDataContextType {
  // State (frequently changing)
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

  // Active novel/chapter getters (computed)
  activeNovel: NovelState | undefined;
  activeChapter: Chapter | undefined;

  // Derived statistics (computed)
  novelsCount: number;
  totalChaptersCount: number;
}

const NovelDataContext = createContext<NovelDataContextType | undefined>(undefined);

/**
 * Hook to access the Novel Data context.
 * 
 * Provides read-only access to novel state data (library, active novel/chapter, etc.).
 * This context is split from actions for performance optimization - components that
 * only need data won't re-render when actions change.
 * Must be used within a NovelDataProvider.
 * 
 * @returns {NovelDataContextType} The novel data context containing:
 * - State: library, activeNovelId, currentView, activeChapterId, isLoading, isSaving
 * - Connectivity: isOnline, cloudAvailable, pendingSyncCount, sync timestamps
 * - Computed: activeNovel, activeChapter, novelsCount, totalChaptersCount
 * 
 * @throws {Error} If used outside of a NovelDataProvider
 * 
 * @example
 * ```typescript
 * const { activeNovel, activeChapter, library, isLoading } = useNovelData();
 * 
 * // Use data without subscribing to action changes
 * if (isLoading) return <Loading />;
 * if (!activeNovel) return <EmptyState />;
 * 
 * return <div>{activeNovel.title}</div>;
 * ```
 */
export const useNovelData = () => {
  const context = useContext(NovelDataContext);
  if (!context) {
    throw new Error('useNovelData must be used within a NovelDataProvider');
  }
  return context;
};

/**
 * Provider component for novel data context
 * This should be used within NovelProvider
 */
export interface NovelDataProviderProps {
  children: ReactNode;
  value: NovelDataContextType;
}

export const NovelDataProvider: React.FC<NovelDataProviderProps> = ({ children, value }) => {
  return <NovelDataContext.Provider value={value}>{children}</NovelDataContext.Provider>;
};

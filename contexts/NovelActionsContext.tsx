import React, { createContext, useContext, type ReactNode } from 'react';
import type { Chapter, NovelState, ViewType } from '../types';

/**
 * Context type for novel actions (stable functions that don't change)
 * This context contains all action functions that are stable references.
 * Components using only actions won't re-render when data changes.
 */
export interface NovelActionsContextType {
  // Actions (stable functions)
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

const NovelActionsContext = createContext<NovelActionsContextType | undefined>(undefined);

/**
 * Hook to access the Novel Actions context.
 * 
 * Provides access to novel action methods (create, update, delete, sync, etc.).
 * This context is split from data for performance optimization - components that
 * only need actions won't re-render when data changes.
 * Must be used within a NovelActionsProvider.
 * 
 * @returns {NovelActionsContextType} The novel actions context containing:
 * - setActiveNovelId: Set the active novel ID
 * - setView: Change the current view
 * - setActiveChapterId: Set the active chapter ID
 * - updateActiveNovel: Update the active novel using an updater function
 * - createNovel: Create a new novel
 * - deleteNovelById: Delete a novel by ID
 * - deleteChapterById: Delete a chapter by ID
 * - saveChapter: Save a chapter
 * - loadNovels: Load all novels from database
 * - syncNow: Sync pending changes to cloud
 * 
 * @throws {Error} If used outside of a NovelActionsProvider
 * 
 * @example
 * ```typescript
 * const { createNovel, updateActiveNovel, deleteNovelById } = useNovelActions();
 * 
 * // Create a novel
 * await createNovel('My Novel', 'Fantasy');
 * 
 * // Update the active novel
 * updateActiveNovel(prev => ({ ...prev, title: 'New Title' }));
 * 
 * // Delete a novel
 * await deleteNovelById('novel-id');
 * ```
 */
export const useNovelActions = () => {
  const context = useContext(NovelActionsContext);
  if (!context) {
    throw new Error('useNovelActions must be used within a NovelActionsProvider');
  }
  return context;
};

/**
 * Provider component for novel actions context
 * This should be used within NovelProvider
 */
export interface NovelActionsProviderProps {
  children: ReactNode;
  value: NovelActionsContextType;
}

export const NovelActionsProvider: React.FC<NovelActionsProviderProps> = ({ children, value }) => {
  return <NovelActionsContext.Provider value={value}>{children}</NovelActionsContext.Provider>;
};

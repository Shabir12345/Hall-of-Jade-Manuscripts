import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ChapterGenerationModel = 'grok';

const STORAGE_KEY = 'apexforge.chapterGenerationModel';

export function getStoredChapterGenerationModel(): ChapterGenerationModel {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'grok') return raw;
  return 'grok'; // Default to Grok
}

export function setStoredChapterGenerationModel(model: ChapterGenerationModel): void {
  localStorage.setItem(STORAGE_KEY, model);
}

interface ChapterGenerationModelContextType {
  model: ChapterGenerationModel;
  setModel: (model: ChapterGenerationModel) => void;
}

const ChapterGenerationModelContext = createContext<ChapterGenerationModelContextType | undefined>(undefined);

/**
 * Hook to access the Chapter Generation Model context.
 * 
 * Provides access to the currently selected model for chapter generation (Grok)
 * and method to change it. The selected model is persisted to localStorage.
 * Must be used within a ChapterGenerationModelProvider.
 * 
 * @returns {ChapterGenerationModelContextType} The context containing:
 * - model: Currently selected model ('grok')
 * - setModel: Change the selected model (persists to localStorage)
 * 
 * @throws {Error} If used outside of a ChapterGenerationModelProvider
 * 
 * @example
 * ```typescript
 * const { model, setModel } = useChapterGenerationModel();
 * 
 * // Get current model
 * console.log('Current model:', model);
 * 
 * // Change model
 * setModel('grok');
 * ```
 */
export function useChapterGenerationModel(): ChapterGenerationModelContextType {
  const ctx = useContext(ChapterGenerationModelContext);
  if (!ctx) throw new Error('useChapterGenerationModel must be used within a ChapterGenerationModelProvider');
  return ctx;
}

export const ChapterGenerationModelProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [model, setModelState] = useState<ChapterGenerationModel>(() => {
    try {
      return getStoredChapterGenerationModel();
    } catch {
      // localStorage may be blocked; default safely.
      return 'grok';
    }
  });

  useEffect(() => {
    try {
      setStoredChapterGenerationModel(model);
    } catch {
      // ignore persistence failures
    }
  }, [model]);

  const value = useMemo<ChapterGenerationModelContextType>(() => {
    return {
      model,
      setModel: setModelState,
    };
  }, [model]);

  return <ChapterGenerationModelContext.Provider value={value}>{children}</ChapterGenerationModelContext.Provider>;
};

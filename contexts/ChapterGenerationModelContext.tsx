import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Chapter Generation Model Context
 * 
 * Controls which model is used for chapter generation.
 * Default is DeepSeek-V3.2 ("The Writer") which is trained on Chinese web fiction
 * and natively understands cultivation tropes.
 */

export type ChapterGenerationModel = 'deepseek';

const STORAGE_KEY = 'apexforge.chapterGenerationModel';

export function getStoredChapterGenerationModel(): ChapterGenerationModel {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    // Always return deepseek - it's the only option for chapter generation
    return 'deepseek';
  } catch {
    return 'deepseek';
  }
}

export function setStoredChapterGenerationModel(model: ChapterGenerationModel): void {
  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {
    // ignore persistence failures
  }
}

interface ChapterGenerationModelContextType {
  model: ChapterGenerationModel;
  setModel: (model: ChapterGenerationModel) => void;
}

const ChapterGenerationModelContext = createContext<ChapterGenerationModelContextType | undefined>(undefined);

/**
 * Hook to access the Chapter Generation Model context.
 * 
 * Provides access to the currently selected model for chapter generation.
 * DeepSeek-V3.2 is the default and recommended model for chapter generation
 * because it's trained on Chinese web fiction and understands cultivation tropes.
 * 
 * @returns {ChapterGenerationModelContextType} The context containing:
 * - model: Currently selected model ('deepseek')
 * - setModel: Change the selected model (persists to localStorage)
 * 
 * @throws {Error} If used outside of a ChapterGenerationModelProvider
 * 
 * @example
 * ```typescript
 * const { model, setModel } = useChapterGenerationModel();
 * 
 * // Get current model
 * console.log('Current model:', model); // 'deepseek'
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
      return 'deepseek';
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

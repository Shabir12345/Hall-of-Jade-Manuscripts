import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type LlmId = 'grok-4-1-fast-reasoning' | 'grok-4-1-fast-non-reasoning';

const STORAGE_KEY = 'apexforge.llm';

export function getStoredLlm(): LlmId {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === 'grok-4-1-fast-reasoning' || raw === 'grok-4-1-fast-non-reasoning') return raw;
  return 'grok-4-1-fast-reasoning';
}

export function setStoredLlm(llm: LlmId): void {
  localStorage.setItem(STORAGE_KEY, llm);
}

interface LlmContextType {
  llm: LlmId;
  setLlm: (llm: LlmId) => void;
}

const LlmContext = createContext<LlmContextType | undefined>(undefined);

/**
 * Hook to access the LLM (Large Language Model) context.
 * 
 * Provides access to the currently selected LLM and method to change it.
 * The selected LLM is persisted to localStorage and used for AI operations.
 * Must be used within an LlmProvider.
 * 
 * @returns {LlmContextType} The LLM context containing:
 * - llm: Currently selected LLM ('grok-4-1-fast-reasoning' | 'grok-4-1-fast-non-reasoning')
 * - setLlm: Change the selected LLM (persists to localStorage)
 * 
 * @throws {Error} If used outside of an LlmProvider
 * 
 * @example
 * ```typescript
 * const { llm, setLlm } = useLlm();
 * 
 * // Get current LLM
 * console.log('Current LLM:', llm);
 * 
 * // Change LLM
 * setLlm('grok-4-1-fast-reasoning');
 * ```
 */
export function useLlm(): LlmContextType {
  const ctx = useContext(LlmContext);
  if (!ctx) throw new Error('useLlm must be used within an LlmProvider');
  return ctx;
}

export const LlmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [llm, setLlmState] = useState<LlmId>(() => {
    try {
      return getStoredLlm();
    } catch {
      // localStorage may be blocked; default safely.
      return 'grok-4-1-fast-reasoning';
    }
  });

  useEffect(() => {
    try {
      setStoredLlm(llm);
    } catch {
      // ignore persistence failures
    }
  }, [llm]);

  const value = useMemo<LlmContextType>(() => {
    return {
      llm,
      setLlm: setLlmState,
    };
  }, [llm]);

  return <LlmContext.Provider value={value}>{children}</LlmContext.Provider>;
};


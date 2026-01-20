import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * LLM Context - Simplified Two-Model Architecture
 * 
 * This application uses two specialized LLMs:
 * 
 * 1. DeepSeek-V3.2 ("The Writer")
 *    - Trained on massive Chinese web fiction corpus
 *    - Natively understands cultivation tropes (Dantian, Tribulation Lightning, Jade Slips)
 *    - Used for: Chapter generation, Arc planning, Creative expansion, Prose editing
 * 
 * 2. Gemini Flash ("The Clerk")
 *    - Fast, cost-effective extraction model
 *    - Used for: State extraction, Lore Bible updates, Metadata processing
 * 
 * The model selection is handled automatically by the Model Orchestrator based on task type.
 * This context primarily tracks user preferences and provides UI state.
 */

export type LlmId = 'deepseek' | 'gemini';

export type LlmRole = 'writer' | 'clerk';

const STORAGE_KEY = 'apexforge.llm';

/**
 * Get the stored LLM preference (default: deepseek for writing tasks)
 */
export function getStoredLlm(): LlmId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'deepseek' || raw === 'gemini') return raw;
  } catch {
    // localStorage may be blocked
  }
  return 'deepseek'; // Default to DeepSeek for writing
}

/**
 * Store LLM preference
 */
export function setStoredLlm(llm: LlmId): void {
  try {
    localStorage.setItem(STORAGE_KEY, llm);
  } catch {
    // ignore persistence failures
  }
}

/**
 * Get human-readable name for an LLM
 */
export function getLlmDisplayName(llm: LlmId): string {
  switch (llm) {
    case 'deepseek':
      return 'DeepSeek-V3.2 (The Writer)';
    case 'gemini':
      return 'Gemini Flash (The Clerk)';
    default:
      return 'Unknown';
  }
}

/**
 * Get the role description for an LLM
 */
export function getLlmRole(llm: LlmId): LlmRole {
  return llm === 'deepseek' ? 'writer' : 'clerk';
}

/**
 * Get description of what each LLM does
 */
export function getLlmDescription(llm: LlmId): string {
  switch (llm) {
    case 'deepseek':
      return 'Trained on Chinese web fiction. Understands cultivation tropes natively. Used for chapter writing, arc planning, and creative tasks.';
    case 'gemini':
      return 'Fast and accurate. Used for state extraction, metadata processing, and Lore Bible updates.';
    default:
      return '';
  }
}

interface LlmContextType {
  /** Currently selected LLM for writing tasks (usually deepseek) */
  llm: LlmId;
  /** Change the selected LLM */
  setLlm: (llm: LlmId) => void;
  /** Get display name for an LLM */
  getDisplayName: (llm: LlmId) => string;
  /** Get description for an LLM */
  getDescription: (llm: LlmId) => string;
}

const LlmContext = createContext<LlmContextType | undefined>(undefined);

/**
 * Hook to access the LLM context.
 * 
 * Provides access to the current LLM selection and utility functions.
 * Note: The Model Orchestrator handles most routing automatically.
 * This context is primarily for UI display and user preferences.
 * 
 * @returns {LlmContextType} The LLM context
 * @throws {Error} If used outside of an LlmProvider
 * 
 * @example
 * ```typescript
 * const { llm, setLlm, getDisplayName } = useLlm();
 * 
 * // Get current LLM
 * console.log('Current LLM:', getDisplayName(llm));
 * 
 * // LLM selection is typically automatic, but can be overridden
 * setLlm('deepseek');
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
      return 'deepseek';
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
      getDisplayName: getLlmDisplayName,
      getDescription: getLlmDescription,
    };
  }, [llm]);

  return <LlmContext.Provider value={value}>{children}</LlmContext.Provider>;
};

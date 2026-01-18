/**
 * Context Window Manager
 * 
 * Provides model-specific context limits to optimize for different LLM capabilities.
 * Grok supports up to 2M tokens, allowing for much richer context than Claude's ~200K token limit.
 */

export type ModelProvider = 'claude' | 'grok';

export interface ContextLimits {
  /** Maximum context length in characters (approximate) */
  maxContextLength: number;
  /** Maximum token limit for input context (safety margin) */
  maxTokens: number;
  /** Number of recent full chapters to include */
  maxRecentChapters: number;
  /** Whether to include full history (all older chapters) */
  includeFullHistory: boolean;
  /** Whether to include full chapter text (not just summaries) */
  includeFullChapterText: boolean;
  /** Whether to skip aggressive compression */
  skipAggressiveCompression: boolean;
  /** Whether to include comprehensive character progression across all chapters */
  includeFullCharacterProgression: boolean;
  /** Whether to include all active plot threads from entire novel */
  includeAllActiveThreads: boolean;
}

/**
 * Returns context limits optimized for the specified model
 * 
 * Grok (2M token window):
 * - 500K characters (≈125K tokens) - conservative limit leaving room for output
 * - Up to 50 full recent chapters
 * - Full history summaries
 * - No aggressive compression needed
 * - Comprehensive character and thread tracking
 * 
 * Claude (~200K token window):
 * - 4K characters (current default)
 * - 4-5 recent chapters
 * - Aggressive compression when needed
 * - Standard context gathering
 */
export function getContextLimitsForModel(model: ModelProvider): ContextLimits {
  if (model === 'grok') {
    return {
      maxContextLength: 500000, // 500K characters ≈ 125K tokens (conservative, leaves room for output)
      maxTokens: 150000, // Safety margin, actual limit is 2M but we stay conservative
      maxRecentChapters: 50, // Include up to 50 recent chapters in full
      includeFullHistory: true, // Include summaries of all older chapters
      includeFullChapterText: true, // Include full text of recent chapters
      skipAggressiveCompression: true, // Don't need aggressive compression with 2M window
      includeFullCharacterProgression: true, // Track character progression across all chapters
      includeAllActiveThreads: true, // Include all active plot threads from entire novel
    };
  } else {
    // Claude (and other models with smaller context windows)
    return {
      maxContextLength: 4000, // Current default
      maxTokens: 8000, // Conservative for Claude's ~200K window
      maxRecentChapters: 5, // Current default
      includeFullHistory: false, // Only include recent chapters
      includeFullChapterText: false, // Use summaries for most chapters
      skipAggressiveCompression: false, // Need compression to fit within limits
      includeFullCharacterProgression: false, // Limited to recent chapters only
      includeAllActiveThreads: false, // Limited to active threads from recent chapters
    };
  }
}

/**
 * Estimates token count from character count (rough approximation)
 * Generally: 1 token ≈ 4 characters for English text
 */
export function estimateTokensFromChars(charCount: number): number {
  return Math.ceil(charCount / 4);
}

/**
 * Estimates character count from token count
 */
export function estimateCharsFromTokens(tokenCount: number): number {
  return tokenCount * 4;
}

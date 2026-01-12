/**
 * Token Estimator
 * Provides utilities to estimate token usage for prompts
 * Rough estimate: 1 token ≈ 4 characters for English text
 */

/**
 * Estimates token count for a given text
 * Uses rough approximation: 1 token ≈ 4 characters
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English
  // Add 20% buffer for JSON formatting, special characters, etc.
  return Math.ceil(text.length / 4 * 1.2);
}

/**
 * Estimates total token usage for a built prompt
 */
export function estimatePromptTokens(prompt: { systemInstruction: string; userPrompt: string }): {
  systemTokens: number;
  userTokens: number;
  totalTokens: number;
} {
  const systemTokens = estimateTokens(prompt.systemInstruction);
  const userTokens = estimateTokens(prompt.userPrompt);
  const totalTokens = systemTokens + userTokens;

  return {
    systemTokens,
    userTokens,
    totalTokens,
  };
}

/**
 * Gets a warning message if token usage is high
 */
export function getTokenWarning(totalTokens: number): string | null {
  if (totalTokens > 80000) {
    return '⚠️ Very high token usage (>80k). This may hit rate limits or be expensive.';
  } else if (totalTokens > 50000) {
    return '⚠️ High token usage (>50k). Consider reducing context.';
  } else if (totalTokens > 30000) {
    return 'ℹ️ Moderate token usage (>30k).';
  }
  return null;
}

/**
 * Logs token usage estimate (for debugging)
 */
export function logTokenEstimate(prompt: { systemInstruction: string; userPrompt: string }, context: string = ''): void {
  const estimate = estimatePromptTokens(prompt);
  const warning = getTokenWarning(estimate.totalTokens);
  
  console.log(`[Token Estimate${context ? ` - ${context}` : ''}]`, {
    system: estimate.systemTokens,
    user: estimate.userTokens,
    total: estimate.totalTokens,
    warning: warning || 'OK',
  });
  
  if (warning) {
    console.warn(warning);
  }
}
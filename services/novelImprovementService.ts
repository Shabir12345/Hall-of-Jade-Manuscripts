import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, ImprovementExecutionResult, ImprovementHistory } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { generateImprovementStrategy, analyzeCategoryWeaknesses } from './improvementStrategyGenerator';
import { executeImprovementStrategy } from './improvementExecutor';

/**
 * Novel Improvement Service
 * Main orchestration service that coordinates the entire improvement workflow
 */

/**
 * Main entry point: Improves novel based on request
 */
export async function improveNovel(
  state: NovelState,
  request: ImprovementRequest,
  onProgress?: (message: string, progress: number) => void
): Promise<{
  improvedState: NovelState;
  result: ImprovementExecutionResult;
  history: ImprovementHistory;
}> {
  // 1. Validate request
  const validation = validateRequest(state, request);
  if (!validation.valid) {
    throw new Error(`Invalid request: ${validation.errors.join('; ')}`);
  }
  
  onProgress?.('Analyzing novel weaknesses...', 5);
  
  // 2. Analyze current state
  const weaknesses = analyzeCategoryWeaknesses(state, request.category);
  const currentScore = weaknesses.overallScore;
  
  onProgress?.('Generating improvement strategy...', 15);
  
  // 3. Generate strategy
  const strategy = generateImprovementStrategy(state, {
    ...request,
    targetScore: request.targetScore || Math.min(100, currentScore + 20),
  });
  
  onProgress?.('Executing improvements...', 25);
  
  // 4. Execute strategy
  const executionResult = await executeImprovementStrategy(
    state,
    strategy,
    (msg, progress) => onProgress?.(msg, 25 + progress * 0.7)
  );
  
  onProgress?.('Validating improvements...', 95);
  
  // 5. Get improved state from execution result
  const improvedState = executionResult.updatedState || state;
  
  // 6. Save to history
  const history: ImprovementHistory = {
    id: generateUUID(),
    novelId: state.id,
    timestamp: Date.now(),
    category: request.category,
    request,
    strategy,
    result: executionResult,
    rolledBack: false,
  };
  
  await saveImprovementHistory(history);
  
  onProgress?.('Improvement complete!', 100);
  
  return {
    improvedState,
    result: executionResult,
    history,
  };
}

/**
 * Validates improvement request
 */
export function validateRequest(
  state: NovelState,
  request: ImprovementRequest
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate novel has chapters
  if (state.chapters.length === 0) {
    errors.push('Novel has no chapters to improve');
  }
  
  // Validate category
  const validCategories = [
    'excellence',
    'structure',
    'engagement',
    'character',
    'theme',
    'tension',
    'prose',
    'originality',
    'voice',
    'literary_devices',
    'market_readiness',
  ];
  if (!validCategories.includes(request.category)) {
    errors.push(`Invalid category: ${request.category}`);
  }
  
  // Validate target score
  if (request.targetScore !== undefined) {
    if (request.targetScore < 0 || request.targetScore > 100) {
      errors.push('Target score must be between 0 and 100');
    }
  }
  
  // Validate limits
  if (request.maxChaptersToInsert !== undefined && request.maxChaptersToInsert < 0) {
    errors.push('maxChaptersToInsert must be non-negative');
  }
  
  if (request.maxChaptersToEdit !== undefined && request.maxChaptersToEdit < 0) {
    errors.push('maxChaptersToEdit must be non-negative');
  }
  
  // Warnings
  if (state.chapters.length < 5) {
    warnings.push('Novel has few chapters; improvements may have limited impact');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Saves improvement to history
 * TODO: Implement database persistence
 */
async function saveImprovementHistory(history: ImprovementHistory): Promise<void> {
  // For now, just log to console
  // In production, this would save to database
  console.log('Improvement history:', {
    id: history.id,
    novelId: history.novelId,
    category: history.category,
    timestamp: new Date(history.timestamp).toISOString(),
    success: history.result.success,
    scoreImprovement: history.result.scoreImprovement,
  });
  
  // TODO: Implement database save
  // await supabase.from('improvement_history').insert(history);
}

/**
 * Gets improvement history for a novel
 * TODO: Implement database retrieval
 */
export async function getImprovementHistory(novelId: string): Promise<ImprovementHistory[]> {
  // TODO: Implement database retrieval
  // return await supabase.from('improvement_history').select('*').eq('novel_id', novelId);
  return [];
}

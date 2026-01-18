import { NovelState, Chapter } from '../types';
import { ImprovementStrategy, ImprovementAction, ImprovementExecutionResult, ImprovementActionResult, ValidationResult } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { editChapter } from './aiService';
import { generateNextChapter } from './aiService';
import { insertChapters } from './chapterInsertionService';
import { generateImprovementStrategy, analyzeCategoryWeaknesses } from './improvementStrategyGenerator';
import { WorldBibleExtractor } from './worldBibleExtractor';
import { DeltaGenerator, ChapterDelta } from './deltaGenerator';
import { ContinuityValidator } from './continuityValidator';
import { ContextManager } from './contextManager';
import { estimateTokens } from './promptEngine/tokenEstimator';
import { logTokenEstimate, getTokenWarning } from './promptEngine/tokenEstimator';
import { isJsonChapterContent, extractChapterContent } from '../utils/chapterContentRepair';

/**
 * Sanitizes chapter content to ensure it's plain text prose, not JSON or structured data
 * This is a safety layer to prevent JSON format issues
 */
function sanitizeChapterContent(content: string, originalContent: string): string {
  if (!content || typeof content !== 'string') {
    console.error('[Sanitize] Invalid content type:', typeof content);
    return originalContent;
  }

  // Check if content is JSON and extract plain text
  if (isJsonChapterContent(content)) {
    console.warn('[Sanitize] Detected JSON in content, extracting actual content');
    const extracted = extractChapterContent(content);
    if (extracted) {
      return extracted;
    } else {
      console.error('[Sanitize] Failed to extract content from JSON, using original');
      return originalContent;
    }
  }

  // Final check: if content still looks like JSON structure, try extraction again
  const trimmed = content.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}') && trimmed.length > 10) {
    console.warn('[Sanitize] Content appears to be JSON structure, attempting extraction');
    const extracted = extractChapterContent(content);
    if (extracted) {
      return extracted;
    }
  }

  return content;
}

/**
 * Improvement Executor
 * Executes improvement actions (edits, insertions, regenerations) with validation
 */

/**
 * Executes improvement strategy
 * @param onActionReady Optional callback for manual approval mode - called after each action is generated
 * @param approvedActionIds Optional set of action IDs that are pre-approved (for manual mode)
 */
export async function executeImprovementStrategy(
  state: NovelState,
  strategy: ImprovementStrategy,
  onProgress?: (message: string, progress: number) => void,
  onActionReady?: (actionId: string, result: ImprovementActionResult) => Promise<boolean>, // Returns true if approved
  approvedActionIds?: Set<string> // Pre-approved action IDs (for batch approval)
): Promise<ImprovementExecutionResult> {
  const startTime = Date.now();
  const originalScore = strategy.targetScore;
  
  onProgress?.('Preparing improvement execution...', 5);
  
  // Pre-execution validation
  const preValidation = validateStrategy(state, strategy);
  if (!preValidation.valid) {
    return {
      strategyId: strategy.id,
      category: strategy.category,
      success: false,
      actionsExecuted: 0,
      actionsSucceeded: 0,
      actionsFailed: 1,
      chaptersEdited: 0,
      chaptersInserted: 0,
      chaptersRegenerated: 0,
      scoreBefore: originalScore,
      scoreAfter: originalScore,
      scoreImprovement: 0,
      actionResults: [],
      failures: preValidation.errors.map(error => ({
        actionId: strategy.id,
        error,
      })),
      validationResults: {
        improvementsValidated: false,
        scoreImproved: false,
        allGoalsMet: false,
        warnings: preValidation.warnings,
      },
      summary: `Strategy validation failed: ${preValidation.errors.join('; ')}`,
      executionTime: Date.now() - startTime,
    };
  }
  
  // Convert strategy to actions
  onProgress?.('Converting strategy to actions...', 10);
  const actions = convertStrategyToActions(strategy);
  
  // Check if we need batching (many chapters to process)
  const editActionsCount = actions.filter(a => a.type === 'edit').length;
  const needsBatching = editActionsCount > 20;
  
  if (needsBatching) {
    onProgress?.(`Large batch detected (${editActionsCount} edits). Processing in batches of 10...`, 12);
  }
  
  if (actions.length === 0) {
    return {
      strategyId: strategy.id,
      category: strategy.category,
      success: false,
      actionsExecuted: 0,
      actionsSucceeded: 0,
      actionsFailed: 0,
      chaptersEdited: 0,
      chaptersInserted: 0,
      chaptersRegenerated: 0,
      scoreBefore: originalScore,
      scoreAfter: originalScore,
      scoreImprovement: 0,
      actionResults: [],
      failures: [],
      validationResults: {
        improvementsValidated: false,
        scoreImproved: false,
        allGoalsMet: false,
        warnings: ['No actions to execute'],
      },
      summary: 'No actions to execute',
      executionTime: Date.now() - startTime,
    };
  }
  
  // Extract World Bible constants once
  const constants = WorldBibleExtractor.extractStoryConstants(state);
  // Use compact prompt for large novels (auto-detects if needed)
  const constraintPrompt = WorldBibleExtractor.buildConstraintPrompt(constants, state.chapters.length > 30);
  
  // Track context delta (what chapters have changed) to avoid re-sending unchanged content
  const contextDelta = new Set<string>(); // Track chapter IDs that have been modified
  
  // Execute actions - use immutable state updates with batching if needed
  let currentState: NovelState = JSON.parse(JSON.stringify(state)); // Deep copy for immutability
  const actionResults: ImprovementActionResult[] = [];
  const failures: ImprovementExecutionResult['failures'] = [];
  let chaptersEdited = 0;
  let chaptersInserted = 0;
  let chaptersRegenerated = 0;
  
  // Batch processing for large numbers of edit actions
  const BATCH_SIZE = 10;
  const editActions = actions.filter(a => a.type === 'edit');
  const otherActions = actions.filter(a => a.type !== 'edit');
  
  // Process edit actions in batches if needed, with parallel processing for independent edits
  if (needsBatching && editActions.length > BATCH_SIZE) {
    const batches: ImprovementAction[][] = [];
    for (let i = 0; i < editActions.length; i += BATCH_SIZE) {
      batches.push(editActions.slice(i, i + BATCH_SIZE));
    }
    
    // Process each batch (with limited parallelism within batch)
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx];
      onProgress?.(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} edits)...`, 15 + (batchIdx / batches.length) * 65);
      
      // Process up to 3 independent edits in parallel (respecting rate limiter)
      const PARALLEL_LIMIT = 3;
      for (let i = 0; i < batch.length; i += PARALLEL_LIMIT) {
        const parallelBatch = batch.slice(i, i + PARALLEL_LIMIT);
        const progressBase = 15 + (batchIdx / batches.length) * 65 + (i / batch.length) * (65 / batches.length);
        const progressRange = (65 / batches.length) / (batch.length / PARALLEL_LIMIT);
        
        // Execute parallel batch (independent edits can run concurrently)
        // Note: Each edit operates on the same starting state, but we need to merge results properly
        const parallelPromises = parallelBatch.map((action, idx) => 
          executeSingleAction(
            currentState, // Use current state at batch start (all parallel edits see same state)
            action,
            constraintPrompt,
            progressBase + (idx / parallelBatch.length) * progressRange,
            progressRange / parallelBatch.length,
            onProgress,
            actionResults,
            failures,
            (updatedState) => {
              // For parallel edits, we need to merge changes rather than overwrite
              // Since edits are to different chapters, we can safely merge
              const mergedChapters = currentState.chapters.map(ch => {
                const updatedChapter = updatedState.chapters.find(uc => uc.id === ch.id);
                return updatedChapter || ch;
              });
              currentState = {
                ...currentState,
                chapters: mergedChapters,
              };
              chaptersEdited++;
            }
          )
        );
        
        // Wait for parallel batch to complete and merge all results
        const results = await Promise.all(parallelPromises);
        
        // Final merge of all parallel edits (in case any were missed in callbacks)
        const allUpdatedChapters = new Map<string, Chapter>();
        results.forEach((_, idx) => {
          const action = parallelBatch[idx];
          if (action.type === 'edit' && action.editAction) {
            const result = actionResults.find(r => r.chapterId === action.editAction!.chapterId);
            if (result && (result as any).newContent) {
              const chapter = currentState.chapters.find(ch => ch.id === action.editAction!.chapterId);
              if (chapter) {
                allUpdatedChapters.set(chapter.id, {
                  ...chapter,
                  content: (result as any).newContent,
                });
              }
            }
          }
        });
        
        // Apply all merged changes
        if (allUpdatedChapters.size > 0) {
          currentState = {
            ...currentState,
            chapters: currentState.chapters.map(ch => allUpdatedChapters.get(ch.id) || ch),
          };
        }
      }
    }
    
    // Process other actions (insert, regenerate) - typically fewer
    for (let i = 0; i < otherActions.length; i++) {
      const action = otherActions[i];
      const progress = 80 + (i / otherActions.length) * 10;
      await executeSingleAction(currentState, action, constraintPrompt, progress, 10 / otherActions.length, onProgress, actionResults, failures, (updatedState) => {
        currentState = updatedState;
        if (action.type === 'insert') chaptersInserted += (action.insertAction?.chapterCount || 0);
        if (action.type === 'regenerate') chaptersRegenerated++;
      });
    }
  } else {
    // Standard processing for smaller batches
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const progressBase = 15;
      const progressRange = 75;
      const progress = progressBase + (i / actions.length) * progressRange;
      
      await executeSingleAction(currentState, action, constraintPrompt, progress, progressRange / actions.length, onProgress, actionResults, failures, (updatedState) => {
        currentState = updatedState;
        if (action.type === 'edit') chaptersEdited++;
        if (action.type === 'insert') chaptersInserted += (action.insertAction?.chapterCount || 0);
        if (action.type === 'regenerate') chaptersRegenerated++;
      });
    }
  }
  
  // Helper function to execute a single action with proper state updates
  async function executeSingleAction(
    state: NovelState,
    action: ImprovementAction,
    constraintPrompt: string,
    progressBase: number,
    progressRange: number,
    onProgress: ((message: string, progress: number) => void) | undefined,
    actionResults: ImprovementActionResult[],
    failures: ImprovementExecutionResult['failures'],
    onStateUpdate: (updatedState: NovelState) => void
  ): Promise<void> {
    onProgress?.(`Executing ${action.type} action...`, progressBase);
    
    try {
      let result: ImprovementActionResult;
      
      switch (action.type) {
        case 'edit':
          result = await executeEditAction(state, action, constraintPrompt, (msg, p) => {
            onProgress?.(msg, progressBase + (p / 100) * progressRange);
          });
          
          // Check if approval is needed (manual mode)
          let isApproved = true;
          if (onActionReady && result.success) {
            isApproved = await onActionReady(action.id, result);
          } else if (approvedActionIds !== undefined) {
            isApproved = approvedActionIds.has(action.id);
          }
          
          // Only apply changes if approved
          if (result.success && result.changesApplied && result.chapterId && (result as any).newContent && isApproved) {
            const chapterIndex = state.chapters.findIndex(ch => ch.id === result.chapterId);
            if (chapterIndex >= 0) {
              // Track this chapter as modified in context delta
              contextDelta.add(result.chapterId);
              
              const updatedState = {
                ...state,
                chapters: state.chapters.map((ch, idx) =>
                  idx === chapterIndex ? { ...ch, content: (result as any).newContent } : ch
                ),
              };
              onStateUpdate(updatedState);
              
              // Validate continuity
              const updatedChapter = updatedState.chapters[chapterIndex];
              const continuity = ContinuityValidator.validateChapterContinuity(
                updatedChapter,
                updatedState.chapters.find(ch => ch.number === updatedChapter.number - 1) || null,
                updatedState.chapters.find(ch => ch.number === updatedChapter.number + 1) || null,
                updatedState
              );
              if (!continuity.valid && continuity.issues.length > 0) {
                onProgress?.(`Continuity warnings: ${continuity.issues.slice(0, 2).join('; ')}`, progressBase + progressRange * 0.9);
              }
            }
          } else if (!isApproved && result.success) {
            // Mark as not applied if rejected
            result.changesApplied = false;
            onProgress?.(`Improvement for Chapter ${result.chapterNumber} was rejected`, progressBase + progressRange * 0.9);
          }
          break;
          
        case 'insert':
          result = await executeInsertAction(state, action, constraintPrompt, (msg, p) => {
            onProgress?.(msg, progressBase + (p / 100) * progressRange);
          });
          
          // Check if approval is needed (manual mode)
          let isInsertApproved = true;
          if (onActionReady && result.success) {
            isInsertApproved = await onActionReady(action.id, result);
          } else if (approvedActionIds !== undefined) {
            isInsertApproved = approvedActionIds.has(action.id);
          }
          
          if (result.success && result.insertedChapters && isInsertApproved) {
            const insertedChaptersList = result.insertedChapters.map(chInfo => {
              return state.chapters.find(c => c.id === chInfo.id);
            }).filter(Boolean) as Chapter[];
            
            if (insertedChaptersList.length > 0) {
              const insertionResult = insertChapters(
                state,
                action.insertAction!.position,
                insertedChaptersList,
                { updateReferences: true, validateContinuity: true }
              );
              onStateUpdate(insertionResult.updatedState);
            }
          } else if (!isInsertApproved && result.success) {
            result.changesApplied = false;
            onProgress?.(`Chapter insertion was rejected`, progressBase + progressRange * 0.9);
          }
          break;
          
        case 'regenerate':
          result = await executeRegenerateAction(state, action, constraintPrompt, (msg, p) => {
            onProgress?.(msg, progressBase + (p / 100) * progressRange);
          });
          
          // Check if approval is needed (manual mode)
          let isRegenerateApproved = true;
          if (onActionReady && result.success) {
            isRegenerateApproved = await onActionReady(action.id, result);
          } else if (approvedActionIds !== undefined) {
            isRegenerateApproved = approvedActionIds.has(action.id);
          }
          
          if (result.success && result.changesApplied && result.chapterId && (result as any).newContent && isRegenerateApproved) {
            const chapterIndex = state.chapters.findIndex(ch => ch.id === result.chapterId);
            if (chapterIndex >= 0) {
              const updatedState = {
                ...state,
                chapters: state.chapters.map((ch, idx) =>
                  idx === chapterIndex
                    ? {
                        ...ch,
                        content: (result as any).newContent,
                        title: (result as any).newTitle || ch.title,
                        summary: (result as any).newSummary || ch.summary,
                        logicAudit: (result as any).newLogicAudit || ch.logicAudit,
                      }
                    : ch
                ),
              };
              onStateUpdate(updatedState);
              
              // Validate continuity
              const updatedChapter = updatedState.chapters[chapterIndex];
              const continuity = ContinuityValidator.validateChapterContinuity(
                updatedChapter,
                updatedState.chapters.find(ch => ch.number === updatedChapter.number - 1) || null,
                updatedState.chapters.find(ch => ch.number === updatedChapter.number + 1) || null,
                updatedState
              );
              if (!continuity.valid && continuity.issues.length > 0) {
                onProgress?.(`Continuity warnings: ${continuity.issues.slice(0, 2).join('; ')}`, progressBase + progressRange * 0.9);
              }
            }
          } else if (!isRegenerateApproved && result.success) {
            result.changesApplied = false;
            onProgress?.(`Regeneration for Chapter ${result.chapterNumber} was rejected`, progressBase + progressRange * 0.9);
          }
          break;
          
        default:
          result = {
            success: false,
            changesApplied: false,
            error: `Unknown action type: ${(action as any).type}`,
          };
      }
      
      actionResults.push(result);
      
      if (!result.success) {
        failures.push({
          actionId: action.id,
          error: result.error || 'Action failed',
          chapterNumber: result.chapterNumber,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result: ImprovementActionResult = {
        success: false,
        changesApplied: false,
        error: errorMessage,
      };
      actionResults.push(result);
      failures.push({
        actionId: action.id,
        error: errorMessage,
      });
    }
  }
  
  // Post-execution validation
  onProgress?.('Validating improvements...', 90);
  const validation = validateImprovements(state, currentState, strategy);
  
  // Validate World Bible constants (using constants extracted earlier)
  const allContent = currentState.chapters.map(ch => ch.content).join(' ');
  const violations = WorldBibleExtractor.validateAgainstConstants(allContent, constants);
  
  if (violations.some(v => v.severity === 'critical')) {
    validation.errors.push(...violations.filter(v => v.severity === 'critical').map(v => v.issue));
  } else {
    validation.warnings.push(...violations.filter(v => v.severity === 'warning').map(v => v.issue));
  }
  
  // Validate continuity
  const continuityValidation = ContinuityValidator.validateNovelContinuity(currentState);
  if (!continuityValidation.valid) {
    validation.warnings.push(`Continuity issues: ${continuityValidation.issues.slice(0, 3).join('; ')}`);
  }
  
  // Re-analyze to get new score
  const weaknesses = analyzeCategoryWeaknesses(currentState, strategy.category);
  const newScore = weaknesses.overallScore;
  const scoreImprovement = newScore - originalScore;
  
  const success = failures.length === 0 && validation.valid;
  
  onProgress?.('Improvement execution complete', 100);
  
  return {
    strategyId: strategy.id,
    category: strategy.category,
    success,
    actionsExecuted: actions.length,
    actionsSucceeded: actionResults.filter(r => r.success).length,
    actionsFailed: failures.length,
    chaptersEdited,
    chaptersInserted,
    chaptersRegenerated,
    scoreBefore: originalScore,
    scoreAfter: newScore,
    scoreImprovement,
    actionResults,
    failures,
    validationResults: {
      improvementsValidated: validation.valid,
      scoreImproved: scoreImprovement > 0,
      allGoalsMet: newScore >= strategy.goalScore,
      warnings: validation.warnings,
    },
    summary: generateExecutionSummary(strategy, actionResults, failures, scoreImprovement),
    executionTime: Date.now() - startTime,
    updatedState: currentState,
  };
}

/**
 * Validates strategy before execution
 */
function validateStrategy(state: NovelState, strategy: ImprovementStrategy): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate strategy has actions
  if (!strategy.editActions && !strategy.insertActions && !strategy.regenerateActions) {
    errors.push('Strategy has no actions to execute');
  }
  
  // Validate edit actions
  if (strategy.editActions) {
    strategy.editActions.forEach(action => {
      const chapter = state.chapters.find(ch => ch.id === action.chapterId);
      if (!chapter) {
        errors.push(`Edit action references non-existent chapter ID: ${action.chapterId}`);
      }
    });
  }
  
  // Validate insert actions
  if (strategy.insertActions) {
    strategy.insertActions.forEach(action => {
      if (action.position < 0 || action.position > state.chapters.length) {
        errors.push(`Insert action has invalid position: ${action.position}`);
      }
      if (action.chapterCount <= 0) {
        errors.push(`Insert action has invalid chapter count: ${action.chapterCount}`);
      }
    });
  }
  
  // Validate regenerate actions
  if (strategy.regenerateActions) {
    strategy.regenerateActions.forEach(action => {
      const chapter = state.chapters.find(ch => ch.id === action.chapterId);
      if (!chapter) {
        errors.push(`Regenerate action references non-existent chapter ID: ${action.chapterId}`);
      }
    });
  }
  
  // Warnings
  if (state.chapters.length === 0) {
    warnings.push('Novel has no chapters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Converts strategy to executable actions
 */
function convertStrategyToActions(strategy: ImprovementStrategy): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  
  // Convert edit actions
  if (strategy.editActions) {
    strategy.editActions.forEach(editAction => {
      actions.push({
        id: generateUUID(),
        type: 'edit',
        strategyId: strategy.id,
        editAction: {
          chapterId: editAction.chapterId,
          chapterNumber: editAction.chapterNumber,
          instruction: buildEditInstruction(editAction),
          targetSection: editAction.section,
          context: editAction.description,
        },
        status: 'pending',
      });
    });
  }
  
  // Convert insert actions
  if (strategy.insertActions) {
    strategy.insertActions.forEach(insertAction => {
      const instructions: string[] = [];
      for (let i = 0; i < insertAction.chapterCount; i++) {
        instructions.push(insertAction.purpose || 'Continue the story naturally');
      }
      
      actions.push({
        id: generateUUID(),
        type: 'insert',
        strategyId: strategy.id,
        insertAction: {
          position: insertAction.position,
          chapterCount: insertAction.chapterCount,
          instructions,
          bridgingContent: true,
        },
        status: 'pending',
      });
    });
  }
  
  // Convert regenerate actions
  if (strategy.regenerateActions) {
    strategy.regenerateActions.forEach(regenerateAction => {
      actions.push({
        id: generateUUID(),
        type: 'regenerate',
        strategyId: strategy.id,
        regenerateAction: {
          chapterId: regenerateAction.chapterId,
          chapterNumber: regenerateAction.chapterNumber,
          improvements: regenerateAction.improvements,
          preserveStructure: regenerateAction.preserveStructure,
        },
        status: 'pending',
      });
    });
  }
  
  return actions;
}

/**
 * Builds edit instruction from edit action
 */
function buildEditInstruction(editAction: ImprovementStrategy['editActions'][0]): string {
  let instruction = `Improve this chapter: ${editAction.description}\n\n`;
  instruction += `Focus on: ${editAction.section}\n`;
  instruction += `Improvement type: ${editAction.improvementType}\n`;
  return instruction;
}

/**
 * Executes edit action with World Bible constraints and delta support
 */
async function executeEditAction(
  state: NovelState,
  action: ImprovementAction,
  constraintPrompt: string,
  onProgress?: (message: string, progress: number) => void
): Promise<ImprovementActionResult> {
  if (!action.editAction) {
    return { success: false, changesApplied: false, error: 'Edit action data missing' };
  }
  
  const chapter = state.chapters.find(c => c.id === action.editAction!.chapterId);
  if (!chapter) {
    return { success: false, changesApplied: false, error: 'Chapter not found' };
  }
  
  onProgress?.(`Editing Chapter ${chapter.number}...`, 30);
  
  try {
    // Estimate token usage before LLM call
    const contextEstimate = ContextManager.estimateContextSize(state, {
      includeFullChapters: false,
      maxRecentChapters: 3,
      includeWorldBible: true,
      includeCharacterCodex: true,
      instruction: action.editAction.instruction,
      worldBibleConstraints: constraintPrompt,
    });
    
    const safetyCheck = ContextManager.isContextSafe(contextEstimate.totalTokens);
    if (!safetyCheck.safe) {
      onProgress?.(`Context too large, reducing...`, 35);
      // Use minimal context for this edit
      const minimalContext = ContextManager.getMinimalContextForEdit(chapter, state);
      // Re-estimate with minimal context
      const minimalEstimate = ContextManager.estimateContextSize(minimalContext.reducedState, {
        includeFullChapters: true,
        maxRecentChapters: minimalContext.reducedState.chapters.length,
        includeWorldBible: true,
        includeCharacterCodex: true,
        instruction: action.editAction.instruction,
        worldBibleConstraints: constraintPrompt,
      });
      
      if (getTokenWarning(minimalEstimate.totalTokens)) {
        onProgress?.(getTokenWarning(minimalEstimate.totalTokens) || '', 36);
      }
    } else if (safetyCheck.warning) {
      onProgress?.(safetyCheck.warning, 35);
    }
    
    // Use minimal context for editing to reduce token usage
    let contextToUse = state;
    if (contextEstimate.totalTokens > 50000) {
      // Use minimal context for this specific chapter edit
      const minimalContext = ContextManager.getMinimalContextForEdit(chapter, state);
      contextToUse = minimalContext.reducedState;
      onProgress?.(`Using minimal context for Chapter ${chapter.number} (${Math.round(minimalContext.estimatedTokens / 1000)}k tokens)`, 35);
    }
    
    // Enhance instruction with World Bible constraints
    const enhancedInstruction = `${action.editAction.instruction}\n\n${constraintPrompt}`;
    
    // Try to use delta generation for efficiency (if chapter is long enough)
    let editedContent: string;
    let retryCount = 0;
    const maxRetries = 2;
    
    while (retryCount <= maxRetries) {
      try {
        if (chapter.content.length > 2000 && action.editAction.targetSection !== 'throughout') {
          // For targeted edits, try delta approach
          onProgress?.(`Generating delta for Chapter ${chapter.number}...`, 40 + retryCount * 5);
          
          // First, get edited content
          editedContent = await editChapter(
            chapter.content,
            enhancedInstruction,
            contextToUse,
            chapter
          );
          
          // Generate delta
          const delta = DeltaGenerator.generateDelta(chapter.content, editedContent, chapter.id, chapter.number);
          
          // If delta is feasible, use it for future operations
          if (delta.fullContent) {
            // Delta too complex, use full content
            editedContent = delta.fullContent;
          } else if (delta.changes.length > 0) {
            // Delta available - content already set above
            onProgress?.(`Delta generated: ${delta.changes.length} change(s)`, 50);
          }
        } else {
          // For full edits or short chapters, use standard approach
          editedContent = await editChapter(
            chapter.content,
            enhancedInstruction,
            contextToUse,
            chapter
          );
        }
        
        if (!editedContent || editedContent === chapter.content) {
          return {
            success: false,
            changesApplied: false,
            error: 'Edit did not produce changes',
          };
        }
        
        // CRITICAL FIX: Validate that edited content is not accidentally JSON
        // This prevents a bug where the entire response was saved as content
        if (typeof editedContent !== 'string') {
          console.error('[Edit] Invalid editedContent type:', typeof editedContent);
          return {
            success: false,
            changesApplied: false,
            error: 'Edited content is invalid (not a string)',
          };
        }
        
        // Sanitize content to ensure it's plain text, not JSON
        editedContent = sanitizeChapterContent(editedContent, chapter.content);
        
        // If sanitization failed (returned original), the content was invalid
        if (editedContent === chapter.content && editedContent !== chapter.content) {
          // This shouldn't happen, but handle edge case
          return {
            success: false,
            changesApplied: false,
            error: 'Edited content could not be sanitized to plain text',
          };
        }
        
        // Validate against World Bible constants
        const constants = WorldBibleExtractor.extractStoryConstants(state);
        const violations = WorldBibleExtractor.validateAgainstConstants(editedContent, constants);
        
        if (violations.some(v => v.severity === 'critical')) {
          return {
            success: false,
            changesApplied: false,
            error: `World Bible violation: ${violations.find(v => v.severity === 'critical')?.issue}`,
          };
        }
        
        // Success - break retry loop
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const isContextError = errorMessage.toLowerCase().includes('token') || 
                              errorMessage.toLowerCase().includes('context') ||
                              errorMessage.toLowerCase().includes('too large');
        
        if (isContextError && retryCount < maxRetries) {
          retryCount++;
          onProgress?.(`Context error, retrying with reduced context (attempt ${retryCount + 1})...`, 40 + retryCount * 5);
          // Use even more reduced context on retry
          const moreReduced = ContextManager.reduceContextForImprovement(state, ContextManager['MINIMAL_TOKENS']);
          // Update contextToUse for next attempt
          // Note: We'd need to pass this through, but for now we'll just retry with original context
          continue;
        } else {
          throw error; // Re-throw if not context error or max retries reached
        }
      }
    }
    
    // Note: State update is handled by caller through returned result
    // The chapter content is updated in the returned result for the caller to apply
    
    // Calculate change metadata for tracking
    const wordsBefore = chapter.content.split(/\s+/).filter(w => w.length > 0).length;
    const wordsAfter = editedContent.split(/\s+/).filter(w => w.length > 0).length;
    
    return {
      success: true,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      changesApplied: true,
      newContentLength: editedContent.length,
      oldContentLength: chapter.content.length,
      newContent: editedContent, // Include edited content for caller to apply
      oldContent: chapter.content, // Include old content for diff viewing
      changeMetadata: {
        wordsBefore,
        wordsAfter,
        wordChange: wordsAfter - wordsBefore,
        explanation: action.editAction?.instruction || 'Content improved',
        confidence: 'medium',
      },
    };
  } catch (error) {
    return {
      success: false,
      changesApplied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Executes insert action with World Bible constraints
 */
async function executeInsertAction(
  state: NovelState,
  action: ImprovementAction,
  constraintPrompt: string,
  onProgress?: (message: string, progress: number) => void
): Promise<ImprovementActionResult> {
  if (!action.insertAction) {
    return { success: false, changesApplied: false, error: 'Insert action data missing' };
  }
  
  const position = action.insertAction.position;
  const chapterCount = action.insertAction.chapterCount;
  
  onProgress?.(`Generating ${chapterCount} new chapter(s)...`, 20);
  
  try {
    let currentState = state;
    const insertedChapters: Chapter[] = [];
    
    for (let i = 0; i < chapterCount; i++) {
      const baseInstruction = action.insertAction.instructions[i] || action.insertAction.instructions[0] || 'Continue the story naturally';
      // Enhance instruction with World Bible constraints
      const enhancedInstruction = `${baseInstruction}\n\n${constraintPrompt}`;
      
      onProgress?.(
        `Generating chapter ${i + 1} of ${chapterCount}...`,
        20 + (i * 60 / chapterCount)
      );
      
      // Estimate token usage before generation
      const contextEstimate = ContextManager.estimateContextSize(currentState, {
        includeFullChapters: false,
        maxRecentChapters: 4,
        includeWorldBible: true,
        includeCharacterCodex: true,
        instruction: enhancedInstruction,
      });
      
      const safetyCheck = ContextManager.isContextSafe(contextEstimate.totalTokens);
      if (safetyCheck.warning) {
        onProgress?.(safetyCheck.warning, 20 + (i * 60 / chapterCount) + 2);
      }
      
      // Generate chapter
      const result = await generateNextChapter(currentState, enhancedInstruction);
      
      // CRITICAL FIX: Validate and extract chapterContent to prevent JSON corruption
      // This ensures we never save the entire result object as content
      let chapterContent = result.chapterContent;
      if (!chapterContent || typeof chapterContent !== 'string') {
        console.error('[Insert] Invalid chapterContent from generateNextChapter:', typeof chapterContent);
        throw new Error('Generated chapter content is invalid (not a string)');
      }
      
      // Check if chapterContent is accidentally JSON (bug fix)
      if (isJsonChapterContent(chapterContent)) {
        console.warn('[Insert] Detected JSON in chapterContent, extracting actual content');
        const extracted = extractChapterContent(chapterContent);
        if (extracted) {
          chapterContent = extracted;
          console.log('[Insert] Successfully extracted actual chapter content from JSON');
        } else {
          console.error('[Insert] Failed to extract chapter content from JSON');
          throw new Error('Generated chapter content contains invalid JSON structure');
        }
      }
      
      // Validate generated content against constants
      const constants = WorldBibleExtractor.extractStoryConstants(state);
      const violations = WorldBibleExtractor.validateAgainstConstants(chapterContent, constants);
      
      if (violations.some(v => v.severity === 'critical')) {
        throw new Error(`World Bible violation in generated chapter: ${violations.find(v => v.severity === 'critical')?.issue}`);
      }
      
      const newChapter: Chapter = {
        id: generateUUID(),
        number: position + i + 1, // Will be adjusted during insertion
        title: result.chapterTitle,
        content: chapterContent, // Use validated/extracted content
        summary: result.chapterSummary || '',
        logicAudit: result.logicAudit,
        scenes: result.scenes || [],
        createdAt: Date.now(),
      };
      
      insertedChapters.push(newChapter);
      
      // Temporarily add to state for next generation context
      currentState = {
        ...currentState,
        chapters: [...currentState.chapters, newChapter],
      };
    }
    
    // Return inserted chapters - insertion will be handled by caller
    return {
      success: true,
      changesApplied: true,
      insertedChapters: insertedChapters.map(ch => ({
        id: ch.id,
        number: ch.number,
        title: ch.title,
      })),
    };
  } catch (error) {
    return {
      success: false,
      changesApplied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Executes regenerate action with World Bible constraints
 */
async function executeRegenerateAction(
  state: NovelState,
  action: ImprovementAction,
  constraintPrompt: string,
  onProgress?: (message: string, progress: number) => void
): Promise<ImprovementActionResult> {
  if (!action.regenerateAction) {
    return { success: false, changesApplied: false, error: 'Regenerate action data missing' };
  }
  
  const chapter = state.chapters.find(c => c.id === action.regenerateAction!.chapterId);
  if (!chapter) {
    return { success: false, changesApplied: false, error: 'Chapter not found' };
  }
  
  onProgress?.(`Regenerating Chapter ${chapter.number}...`, 30);
  
  try {
    const improvements = action.regenerateAction.improvements.join(', ');
    const baseInstruction = `Regenerate this chapter with the following improvements: ${improvements}`;
    // Enhance instruction with World Bible constraints
    const enhancedInstruction = `${baseInstruction}\n\n${constraintPrompt}`;
    
    // Estimate token usage before regeneration
    const contextEstimate = ContextManager.estimateContextSize(state, {
      includeFullChapters: false,
      maxRecentChapters: 4,
      includeWorldBible: true,
      includeCharacterCodex: true,
      instruction: enhancedInstruction,
    });
    
    const safetyCheck = ContextManager.isContextSafe(contextEstimate.totalTokens);
    if (safetyCheck.warning) {
      onProgress?.(safetyCheck.warning, 32);
    }
    
    // Generate new chapter content
    const result = await generateNextChapter(state, enhancedInstruction);
    
    // CRITICAL FIX: Validate and extract chapterContent to prevent JSON corruption
    // This ensures we never save the entire result object as content
    let chapterContent = result.chapterContent;
    if (!chapterContent || typeof chapterContent !== 'string') {
      console.error('[Regenerate] Invalid chapterContent from generateNextChapter:', typeof chapterContent);
      return {
        success: false,
        changesApplied: false,
        error: 'Generated chapter content is invalid (not a string)',
      };
    }
    
    // Sanitize content to ensure it's plain text, not JSON
    chapterContent = sanitizeChapterContent(chapterContent, chapter.content);
    
    if (!chapterContent || chapterContent.trim().length === 0) {
      return {
        success: false,
        changesApplied: false,
        error: 'Generated chapter content is empty after sanitization',
      };
    }
    
    // Validate against World Bible constants
    const constants = WorldBibleExtractor.extractStoryConstants(state);
    const violations = WorldBibleExtractor.validateAgainstConstants(chapterContent, constants);
    
    if (violations.some(v => v.severity === 'critical')) {
      return {
        success: false,
        changesApplied: false,
        error: `World Bible violation: ${violations.find(v => v.severity === 'critical')?.issue}`,
      };
    }
    
    // Return new content in result for caller to apply immutably
    return {
      success: true,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      chapterTitle: chapter.title,
      changesApplied: true,
      newContentLength: chapterContent.length,
      oldContentLength: chapter.content.length,
      newContent: chapterContent, // Use validated/extracted content
      oldContent: chapter.content,
      problemDescription: action.regenerateAction?.reason || action.regenerateAction?.improvements?.join(', ') || 'Chapter regeneration',
      sectionAffected: 'throughout',
      changeMetadata: {
        wordsBefore: chapter.content.split(/\s+/).filter(w => w.length > 0).length,
        wordsAfter: chapterContent.split(/\s+/).filter(w => w.length > 0).length,
        wordChange: chapterContent.split(/\s+/).filter(w => w.length > 0).length - chapter.content.split(/\s+/).filter(w => w.length > 0).length,
        explanation: `Regenerate chapter: ${action.regenerateAction?.improvements?.join(', ') || 'Improvements applied'}`,
        confidence: 'high',
      },
    };
  } catch (error) {
    return {
      success: false,
      changesApplied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Validates improvement results
 */
function validateImprovements(
  originalState: NovelState,
  improvedState: NovelState,
  strategy: ImprovementStrategy
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate chapter count didn't decrease unexpectedly
  if (improvedState.chapters.length < originalState.chapters.length) {
    errors.push('Chapter count decreased unexpectedly');
  }
  
  // Basic validation - more comprehensive validation would re-analyze
  if (improvedState.chapters.length === originalState.chapters.length && strategy.insertActions) {
    warnings.push('Insert actions specified but no chapters were added');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Generates execution summary
 */
function generateExecutionSummary(
  strategy: ImprovementStrategy,
  results: ImprovementActionResult[],
  failures: ImprovementExecutionResult['failures'],
  scoreImprovement: number
): string {
  const successful = results.filter(r => r.success).length;
  const failed = failures.length;
  
  let summary = `Executed ${results.length} action(s): ${successful} succeeded, ${failed} failed. `;
  
  if (scoreImprovement > 0) {
    summary += `Score improved by ${scoreImprovement.toFixed(1)} points.`;
  } else if (scoreImprovement < 0) {
    summary += `Score decreased by ${Math.abs(scoreImprovement).toFixed(1)} points.`;
  } else {
    summary += 'Score unchanged.';
  }
  
  return summary;
}

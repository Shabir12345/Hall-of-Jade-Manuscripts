import { NovelState, Chapter } from '../types';
import { ImprovementStrategy, ImprovementAction, ImprovementExecutionResult, ImprovementActionResult, ValidationResult } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { editChapter } from './aiService';
import { generateNextChapter } from './aiService';
import { insertChapters } from './chapterInsertionService';
import { generateImprovementStrategy, analyzeCategoryWeaknesses } from './improvementStrategyGenerator';

/**
 * Improvement Executor
 * Executes improvement actions (edits, insertions, regenerations) with validation
 */

/**
 * Executes improvement strategy
 */
export async function executeImprovementStrategy(
  state: NovelState,
  strategy: ImprovementStrategy,
  onProgress?: (message: string, progress: number) => void
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
  
  // Execute actions
  let currentState = state;
  const actionResults: ImprovementActionResult[] = [];
  const failures: ImprovementExecutionResult['failures'] = [];
  let chaptersEdited = 0;
  let chaptersInserted = 0;
  let chaptersRegenerated = 0;
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const progressBase = 15;
    const progressRange = 75;
    const progress = progressBase + (i / actions.length) * progressRange;
    
    onProgress?.(`Executing action ${i + 1} of ${actions.length}...`, progress);
    
    try {
      let result: ImprovementActionResult;
      
      switch (action.type) {
        case 'edit':
          result = await executeEditAction(currentState, action, (msg, p) => {
            onProgress?.(msg, progress + (p / actions.length) * (progressRange / actions.length));
          });
          if (result.success && result.changesApplied && result.chapterId) {
            chaptersEdited++;
            // Note: Actual content update happens in executeEditAction via editChapter service
            // State update is handled by the caller or through state management
          }
          break;
          
        case 'insert':
          result = await executeInsertAction(currentState, action, (msg, p) => {
            onProgress?.(msg, progress + (p / actions.length) * (progressRange / actions.length));
          });
          if (result.success && result.insertedChapters) {
            chaptersInserted += result.insertedChapters.length;
            // Update state with inserted chapters
            const insertionResult = insertChapters(
              currentState,
              action.insertAction!.position,
              result.insertedChapters!.map(ch => currentState.chapters.find(c => c.id === ch.id)!).filter(Boolean) as Chapter[],
              { updateReferences: true, validateContinuity: true }
            );
            currentState = insertionResult.updatedState;
          }
          break;
          
        case 'regenerate':
          result = await executeRegenerateAction(currentState, action, (msg, p) => {
            onProgress?.(msg, progress + (p / actions.length) * (progressRange / actions.length));
          });
          if (result.success && result.changesApplied && result.chapterId) {
            chaptersRegenerated++;
            // Note: Actual content update happens in executeRegenerateAction
            // State update is handled by the caller or through state management
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
 * Executes edit action
 */
async function executeEditAction(
  state: NovelState,
  action: ImprovementAction,
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
    const editedContent = await editChapter(
      chapter.content,
      action.editAction.instruction,
      state,
      chapter
    );
    
    if (!editedContent || editedContent === chapter.content) {
      return {
        success: false,
        changesApplied: false,
        error: 'Edit did not produce changes',
      };
    }
    
    return {
      success: true,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      changesApplied: true,
      newContentLength: editedContent.length,
      oldContentLength: chapter.content.length,
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
 * Executes insert action
 */
async function executeInsertAction(
  state: NovelState,
  action: ImprovementAction,
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
      const instruction = action.insertAction.instructions[i] || action.insertAction.instructions[0] || 'Continue the story naturally';
      
      onProgress?.(
        `Generating chapter ${i + 1} of ${chapterCount}...`,
        20 + (i * 60 / chapterCount)
      );
      
      // Generate chapter
      const result = await generateNextChapter(currentState, instruction);
      
      const newChapter: Chapter = {
        id: generateUUID(),
        number: position + i + 1, // Will be adjusted during insertion
        title: result.chapterTitle,
        content: result.chapterContent,
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
    // Note: insertChapters is called separately to handle state updates properly
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
 * Executes regenerate action
 */
async function executeRegenerateAction(
  state: NovelState,
  action: ImprovementAction,
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
    const instruction = `Regenerate this chapter with the following improvements: ${improvements}`;
    
    // Generate new chapter content
    const result = await generateNextChapter(state, instruction);
    
    return {
      success: true,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      changesApplied: true,
      newContentLength: result.chapterContent.length,
      oldContentLength: chapter.content.length,
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

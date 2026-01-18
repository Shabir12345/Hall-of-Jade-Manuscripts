import { NovelState } from '../types';
import { ImprovementRequest, ImprovementStrategy, ImprovementExecutionResult, ImprovementCategory, ChapterTargetingOptions } from '../types/improvement';
import { generateUUID } from '../utils/uuid';
import { WorldBibleExtractor, StoryConstants } from './worldBibleExtractor';
import { DeltaGenerator, ChapterDelta } from './deltaGenerator';
import { analyzeCategoryWeaknesses, generateImprovementStrategy } from './improvementStrategyGenerator';
import { executeImprovementStrategy } from './improvementExecutor';
import { ContextManager } from './contextManager';
import { validateImprovementsWithLLM, quickValidateChanges } from './improvementScorer';

/**
 * Optimization State - Tracks progress through optimization loop
 */
interface OptimizationState {
  iteration: number;
  currentScore: number;
  targetScore: number;
  previousScore: number;
  improvements: ImprovementExecutionResult[];
  constants: StoryConstants;
  stateSnapshots: NovelState[]; // For rollback capability
  scoreHistory: number[]; // Track score progression
  qualityMetrics: QualityMetrics;
}

/**
 * Quality Metrics - Detailed tracking of optimization progress
 */
interface QualityMetrics {
  chaptersImproved: number;
  chaptersUnchanged: number;
  chaptersRegressed: number;
  totalEdits: number;
  totalInsertions: number;
  totalRegenerations: number;
  averageEditSize: number;
  worldBibleViolations: number;
  continuityIssues: number;
}

/**
 * Optimization Result - Final result of optimization
 */
export interface OptimizationResult {
  improvedState: NovelState;
  finalScore: number;
  scoreImprovement: number;
  iterations: number;
  executionResults: ImprovementExecutionResult[];
  success: boolean;
  message: string;
  metrics?: QualityMetrics;
  scoreHistory?: number[];
  rolledBack?: boolean;
}

/**
 * Multi-category optimization options
 */
export interface MultiCategoryOptions {
  categories: ImprovementCategory[];
  priorityOrder?: 'sequential' | 'parallel' | 'by-score';
  stopOnFirstSuccess?: boolean;
}

/**
 * Narrative Optimization Engine (NOE)
 * Core engine that orchestrates the 4-stage recursive optimization loop
 */
export class NarrativeOptimizationEngine {
  private static readonly MAX_ITERATIONS = 3;
  private static readonly TARGET_SCORE_THRESHOLD = 90;
  private static readonly MIN_SCORE_IMPROVEMENT = 2; // Minimum improvement to continue

  /**
   * Main entry point: Optimizes novel based on category
   */
  static async optimizeNovel(
    state: NovelState,
    category: ImprovementCategory,
    targetScore?: number,
    onProgress?: (message: string, progress: number) => void
  ): Promise<OptimizationResult> {
    const startTime = Date.now();

    try {
      onProgress?.('Initializing optimization engine...', 0);

      // Extract World Bible constants once at the start
      const constants = WorldBibleExtractor.extractStoryConstants(state);
      onProgress?.('Story constants extracted', 5);
      
      // Check if we need context reduction for large novels
      const contextConfig = ContextManager.getOptimalContextConfig(state);
      if (state.chapters.length > 30) {
        onProgress?.('Large novel detected - optimizing context usage...', 6);
      }

      // Initialize optimization state with rollback support
      const optState: OptimizationState = {
        iteration: 0,
        currentScore: 0,
        targetScore: targetScore || this.TARGET_SCORE_THRESHOLD,
        previousScore: 0,
        improvements: [],
        constants,
        stateSnapshots: [JSON.parse(JSON.stringify(state))], // Initial snapshot for rollback
        scoreHistory: [],
        qualityMetrics: {
          chaptersImproved: 0,
          chaptersUnchanged: 0,
          chaptersRegressed: 0,
          totalEdits: 0,
          totalInsertions: 0,
          totalRegenerations: 0,
          averageEditSize: 0,
          worldBibleViolations: 0,
          continuityIssues: 0,
        },
      };

      // Initialize state comparison for validation (tracks changes across iterations)
      this.initializeStateComparison(state);
      
      // Stage 1: Initial assessment
      onProgress?.('Assessing current novel state...', 10);
      const initialAssessment = await this.assessCurrentState(state, category, onProgress);
      optState.currentScore = initialAssessment.score;
      optState.previousScore = initialAssessment.score;

      // Adjust target score if needed
      if (!targetScore) {
        optState.targetScore = Math.min(
          this.TARGET_SCORE_THRESHOLD,
          Math.max(optState.currentScore + 30, optState.currentScore + 10)
        );
      }

      // Track initial score
      optState.scoreHistory.push(optState.currentScore);

      onProgress?.(
        `Current score: ${optState.currentScore}/100, Target: ${optState.targetScore}/100`,
        15
      );

      // If already at target, return early
      if (optState.currentScore >= optState.targetScore) {
        return {
          improvedState: state,
          finalScore: optState.currentScore,
          scoreImprovement: 0,
          iterations: 0,
          executionResults: [],
          success: true,
          message: `Novel already meets target score of ${optState.targetScore}/100`,
          metrics: optState.qualityMetrics,
          scoreHistory: optState.scoreHistory,
        };
      }

      let currentState = state;
      let iteration = 0;

      // Recursive optimization loop
      // Progress allocation: 15% for setup, 75% for iterations (25% each for 3 max), 10% for final validation
      const PROGRESS_START = 15;
      const PROGRESS_PER_ITERATION = 25;
      
      while (iteration < this.MAX_ITERATIONS) {
        iteration++;
        optState.iteration = iteration;

        // Calculate progress base for this iteration (capped at 90%)
        const iterationProgressBase = Math.min(PROGRESS_START + ((iteration - 1) * PROGRESS_PER_ITERATION), 90);
        
        onProgress?.(
          `Optimization iteration ${iteration}/${this.MAX_ITERATIONS}...`,
          iterationProgressBase
        );

        // Stage 2: Generate optimization plan
        onProgress?.('Generating optimization plan...', Math.min(iterationProgressBase + 5, 92));
        const strategy = await this.generateOptimizationPlan(
          currentState,
          category,
          optState.targetScore,
          optState.constants,
          iteration,
          // Pass a scoped progress callback that won't exceed iteration bounds
          (msg, p) => onProgress?.(msg, Math.min(iterationProgressBase + (p * 0.1), 92)),
          undefined, // No chapter filtering for full novel optimization
          undefined
        );

        if (!strategy || strategy.editActions?.length === 0 && 
            strategy.insertActions?.length === 0 && 
            strategy.regenerateActions?.length === 0) {
          onProgress?.('No improvements needed in this iteration', Math.min(iterationProgressBase + 10, 92));
          break;
        }

        // Stage 3: Execute transformations
        onProgress?.('Executing improvements...', Math.min(iterationProgressBase + 8, 92));
        const executionResult = await this.executeTransformations(
          currentState,
          strategy,
          optState.constants,
          // Scope progress to iteration bounds
          (msg, p) => {
            const scaledProgress = iterationProgressBase + 8 + (p * 0.12); // 12% of iteration for execution
            onProgress?.(msg, Math.min(scaledProgress, 92));
          }
        );

        optState.improvements.push(executionResult);

        // Update quality metrics
        optState.qualityMetrics.totalEdits += executionResult.chaptersEdited || 0;
        optState.qualityMetrics.totalInsertions += executionResult.chaptersInserted || 0;
        optState.qualityMetrics.totalRegenerations += executionResult.chaptersRegenerated || 0;

        // Update state with improvements
        if (executionResult.updatedState) {
          currentState = executionResult.updatedState;
          // Save snapshot for potential rollback
          optState.stateSnapshots.push(JSON.parse(JSON.stringify(currentState)));
        }

        // Stage 4: Validate and check if we should iterate
        onProgress?.('Validating improvements...', Math.min(iterationProgressBase + 20, 92));
        const validation = await this.validateAndIterate(
          currentState,
          category,
          optState.currentScore,
          optState.targetScore,
          iteration,
          // Scope validation progress
          (msg, p) => onProgress?.(msg, Math.min(iterationProgressBase + 20 + (p * 0.05), 92))
        );

        optState.currentScore = validation.newScore;
        optState.previousScore = validation.previousScore;
        optState.scoreHistory.push(validation.newScore);

        onProgress?.(
          `Score: ${validation.previousScore} → ${validation.newScore} (${validation.scoreChange > 0 ? '+' : ''}${validation.scoreChange})`,
          Math.min(iterationProgressBase + 23, 92)
        );

        // QUALITY GATE: Rollback if score regressed significantly
        if (validation.scoreChange < -5) {
          onProgress?.(`Quality regression detected (${validation.scoreChange}). Rolling back...`, Math.min(iterationProgressBase + 24, 92));
          
          // Rollback to previous snapshot
          if (optState.stateSnapshots.length > 1) {
            const rollbackState = optState.stateSnapshots[optState.stateSnapshots.length - 2];
            currentState = JSON.parse(JSON.stringify(rollbackState));
            optState.stateSnapshots.pop(); // Remove failed snapshot
            optState.scoreHistory.pop(); // Remove regressed score
            optState.qualityMetrics.chaptersRegressed++;
            
            onProgress?.('Rolled back to previous state', Math.min(iterationProgressBase + 24, 92));
            
            // Try with more conservative approach next iteration
            continue;
          }
        }

        // Check if we've reached target or improvement is too small
        if (validation.newScore >= optState.targetScore) {
          onProgress?.('Target score achieved!', 95);
          return {
            improvedState: currentState,
            finalScore: validation.newScore,
            scoreImprovement: validation.newScore - initialAssessment.score,
            iterations: iteration,
            executionResults: optState.improvements,
            success: true,
            message: `Optimization complete: Score improved from ${initialAssessment.score} to ${validation.newScore}/100 in ${iteration} iteration(s)`,
            metrics: optState.qualityMetrics,
            scoreHistory: optState.scoreHistory,
          };
        }

        // If improvement is too small, stop iterating
        if (validation.scoreChange < this.MIN_SCORE_IMPROVEMENT && iteration > 1) {
          onProgress?.('Improvement rate too low, stopping optimization', 95);
          return {
            improvedState: currentState,
            finalScore: validation.newScore,
            scoreImprovement: validation.newScore - initialAssessment.score,
            iterations: iteration,
            executionResults: optState.improvements,
            success: true,
            message: `Optimization complete: Score improved from ${initialAssessment.score} to ${validation.newScore}/100. Further improvements would be marginal.`,
            metrics: optState.qualityMetrics,
            scoreHistory: optState.scoreHistory,
          };
        }

        // Continue to next iteration
        onProgress?.('Preparing for next optimization pass...', Math.min(iterationProgressBase + PROGRESS_PER_ITERATION - 1, 92));
      }

      // Max iterations reached
      const finalScore = optState.currentScore;
      return {
        improvedState: currentState,
        finalScore,
        scoreImprovement: finalScore - initialAssessment.score,
        iterations: iteration,
        executionResults: optState.improvements,
        success: true,
        message: `Optimization complete after ${iteration} iteration(s): Score improved from ${initialAssessment.score} to ${finalScore}/100`,
        metrics: optState.qualityMetrics,
        scoreHistory: optState.scoreHistory,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if error is context-related
      const isContextError = errorMessage.toLowerCase().includes('token') || 
                            errorMessage.toLowerCase().includes('context') ||
                            errorMessage.toLowerCase().includes('too large') ||
                            errorMessage.toLowerCase().includes('limit');
      
      if (isContextError) {
        onProgress?.(`Context error detected. Retrying with reduced context...`, 95);
        
        try {
          // Retry with minimal context
          const reducedContext = ContextManager.reduceContextForImprovement(state, ContextManager['MINIMAL_TOKENS']);
          const retryResult = await this.optimizeNovel(
            reducedContext.state,
            category,
            targetScore,
            onProgress
          );
          
          if (retryResult.success) {
            onProgress?.(`Optimization succeeded with reduced context`, 100);
            return retryResult;
          }
        } catch (retryError) {
          // If retry also fails, return error
          onProgress?.(`Retry with reduced context also failed`, 100);
        }
      }
      
      onProgress?.(`Error during optimization: ${errorMessage}`, 100);
      
      return {
        improvedState: state,
        finalScore: 0,
        scoreImprovement: 0,
        iterations: 0,
        executionResults: [],
        success: false,
        message: `Optimization failed: ${errorMessage}${isContextError ? ' (context-related - tried reduced context)' : ''}`,
      };
    }
  }

  /**
   * Stage 1: Assess current state
   * Runs analysis module and extracts weaknesses
   */
  private static async assessCurrentState(
    state: NovelState,
    category: ImprovementCategory,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{ score: number; weaknesses: any }> {
    try {
      onProgress?.('Running analysis module...', 10);
      
      // Use existing weakness analysis
      const weaknesses = analyzeCategoryWeaknesses(state, category);
      const score = weaknesses.overallScore;

      onProgress?.(
        `Analysis complete: ${category} score is ${score}/100`,
        12
      );

      return {
        score,
        weaknesses,
      };
    } catch (error) {
      console.error('Error in assessCurrentState:', error);
      throw new Error(`Failed to assess current state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stage 2: Generate optimization plan
   * Creates specific narrative interventions
   */
  private static async generateOptimizationPlan(
    state: NovelState,
    category: ImprovementCategory,
    targetScore: number,
    constants: StoryConstants,
    iteration: number,
    onProgress?: (message: string, progress: number) => void,
    targetChapterIds?: Set<string>,
    targetChapterNumbers?: Set<number>
  ): Promise<ImprovementStrategy | null> {
    try {
      onProgress?.(
        `Generating optimization plan for ${category} (iteration ${iteration})...`,
        15
      );

      // Use reduced context for large novels to optimize token usage
      let stateForStrategy = state;
      if (state.chapters.length > 30) {
        const reducedContext = ContextManager.reduceContextForImprovement(state, ContextManager['TARGET_TOKENS']);
        stateForStrategy = reducedContext.state;
        onProgress?.(`Using ${reducedContext.contextType} context (${reducedContext.chaptersIncluded.length} chapters, ${reducedContext.charactersIncluded.length} characters)`, 16);
      }

      // Create improvement request
      const request: ImprovementRequest = {
        category,
        targetScore,
        scope: iteration === 1 ? 'comprehensive' : 'focused', // First iteration is comprehensive, later are focused
      };

      // Generate strategy using existing generator
      // This will be enhanced later to use module-specific optimizers
      const strategy = generateImprovementStrategy(stateForStrategy, request);

      if (!strategy) {
        return null;
      }

      // Filter strategy to only target selected chapters if provided
      if (targetChapterIds && targetChapterIds.size > 0) {
        // Filter edit actions to only target chapters
        if (strategy.editActions) {
          strategy.editActions = strategy.editActions.filter(action => 
            targetChapterIds.has(action.chapterId)
          );
        }

        // Filter regenerate actions to only target chapters
        if (strategy.regenerateActions) {
          strategy.regenerateActions = strategy.regenerateActions.filter(action =>
            targetChapterIds.has(action.chapterId)
          );
        }

        // Filter insert actions - only allow inserts that are adjacent to target chapters
        // or between target chapters
        if (strategy.insertActions) {
          strategy.insertActions = strategy.insertActions.filter(action => {
            // Allow inserts if they're adjacent to target chapters
            const adjacentToTarget = targetChapterNumbers && (
              targetChapterNumbers.has(action.position) ||
              targetChapterNumbers.has(action.position + 1)
            );
            return adjacentToTarget || !targetChapterNumbers; // If no target numbers, allow all
          });
        }

        // Update chaptersAffected to only include target chapters
        if (targetChapterNumbers) {
          strategy.chaptersAffected = strategy.chaptersAffected.filter(num =>
            targetChapterNumbers.has(num)
          );
        } else if (targetChapterIds) {
          // Filter by chapter IDs
          const targetNums = new Set(
            state.chapters
              .filter(ch => targetChapterIds.has(ch.id))
              .map(ch => ch.number)
          );
          strategy.chaptersAffected = strategy.chaptersAffected.filter(num =>
            targetNums.has(num)
          );
        }
      }

      // Adjust strategy based on iteration
      // Later iterations should be more targeted
      if (iteration > 1) {
        // Focus on highest priority actions only
        if (strategy.editActions) {
          strategy.editActions = strategy.editActions
            .filter(action => {
              // Filter to only critical/high priority improvements
              return true; // For now, keep all - will be enhanced with priority system
            })
            .slice(0, 5); // Limit to 5 edits per iteration
        }
      }

      onProgress?.(
        `Plan generated: ${strategy.editActions?.length || 0} edits, ${strategy.insertActions?.length || 0} insertions, ${strategy.regenerateActions?.length || 0} regenerations`,
        18
      );

      return strategy;
    } catch (error) {
      console.error('Error in generateOptimizationPlan:', error);
      throw new Error(`Failed to generate optimization plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stage 3: Execute transformations
   * Applies edits/insertions/regenerations with World Bible constraints
   */
  private static async executeTransformations(
    state: NovelState,
    strategy: ImprovementStrategy,
    constants: StoryConstants,
    onProgress?: (message: string, progress: number) => void,
    onActionReady?: (actionId: string, result: any) => Promise<boolean>,
    approvedActionIds?: Set<string>
  ): Promise<ImprovementExecutionResult> {
    try {
      onProgress?.('Executing improvement strategy...', 20);

      // Execute strategy using existing executor
      // World Bible constraints will be added in enhancement phase
      const result = await executeImprovementStrategy(
        state,
        strategy,
        onProgress,
        onActionReady,
        approvedActionIds
      );

      return result;
    } catch (error) {
      console.error('Error in executeTransformations:', error);
      throw new Error(`Failed to execute transformations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Stage 4: Validate and iterate
   * Re-analyzes and determines if another iteration is needed
   */
  // Store previous state for comparison (module-level for LLM validation)
  private static previousStateForComparison: NovelState | null = null;
  
  private static async validateAndIterate(
    state: NovelState,
    category: ImprovementCategory,
    previousScore: number,
    targetScore: number,
    iteration: number,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{
    newScore: number;
    previousScore: number;
    scoreChange: number;
    shouldIterate: boolean;
    llmValidation?: {
      confidence: 'high' | 'medium' | 'low';
      summary: string;
      strengthsAdded: string[];
    };
  }> {
    try {
      onProgress?.('Re-analyzing improved novel...', 80);

      // First, run quick validation to detect actual changes
      const previousState = this.previousStateForComparison;
      let quickCheck = { chaptersChanged: 0, totalWordChange: 0, estimatedImprovement: 0 };
      
      if (previousState) {
        quickCheck = quickValidateChanges(previousState, state);
        console.log(`[NOE Validation] Quick check: ${quickCheck.chaptersChanged} chapters changed, ${quickCheck.totalWordChange} words difference`);
      }
      
      // Re-run heuristic analysis
      const weaknesses = analyzeCategoryWeaknesses(state, category);
      let heuristicScore = weaknesses.overallScore;
      
      // If heuristic score shows no improvement but we made changes, use LLM validation
      let finalScore = heuristicScore;
      let llmValidation: { confidence: 'high' | 'medium' | 'low'; summary: string; strengthsAdded: string[] } | undefined;
      
      if (quickCheck.chaptersChanged > 0 && quickCheck.totalWordChange !== 0) {
        // Changes were made - incorporate the estimated improvement
        // This ensures that actual content changes are reflected in the score
        const contentBonus = Math.min(15, quickCheck.estimatedImprovement);
        
        // If heuristic didn't detect improvement but content changed, add a bonus
        if (heuristicScore <= previousScore && contentBonus > 0) {
          finalScore = Math.min(100, heuristicScore + contentBonus);
          console.log(`[NOE Validation] Applied content bonus: ${heuristicScore} + ${contentBonus} = ${finalScore}`);
        }
        
        // Try LLM validation for better accuracy (but don't block on it)
        try {
          if (previousState) {
            onProgress?.('Running AI validation...', 82);
            const llmResult = await validateImprovementsWithLLM(
              previousState,
              state,
              category,
              (msg, p) => onProgress?.(msg, 80 + (p * 0.05))
            );
            
            // Use LLM score if it's more accurate (higher confidence)
            if (llmResult.confidence !== 'low') {
              // Blend LLM score with heuristic (60% LLM, 40% heuristic when confident)
              const blendFactor = llmResult.confidence === 'high' ? 0.6 : 0.4;
              finalScore = Math.round(
                llmResult.overallScore * blendFactor + finalScore * (1 - blendFactor)
              );
              
              llmValidation = {
                confidence: llmResult.confidence,
                summary: llmResult.summary,
                strengthsAdded: llmResult.qualityAssessment.strengthsAdded,
              };
              
              console.log(`[NOE Validation] LLM validation: ${llmResult.overallScore}, blended: ${finalScore}`);
            }
          }
        } catch (llmError) {
          console.warn('[NOE Validation] LLM validation failed, using heuristic:', llmError);
          // Continue with heuristic + content bonus score
        }
      }

      const scoreChange = finalScore - previousScore;
      
      // Store current state for next comparison
      this.previousStateForComparison = JSON.parse(JSON.stringify(state));

      onProgress?.(
        `Validation complete: Score ${previousScore} → ${finalScore} (${scoreChange > 0 ? '+' : ''}${scoreChange})`,
        85
      );

      // Determine if we should iterate
      const shouldIterate =
        iteration < this.MAX_ITERATIONS &&
        finalScore < targetScore &&
        scoreChange >= this.MIN_SCORE_IMPROVEMENT;

      return {
        newScore: finalScore,
        previousScore,
        scoreChange,
        shouldIterate,
        llmValidation,
      };
    } catch (error) {
      console.error('Error in validateAndIterate:', error);
      // Return previous score if validation fails
      return {
        newScore: previousScore,
        previousScore,
        scoreChange: 0,
        shouldIterate: false,
      };
    }
  }
  
  /**
   * Initialize state comparison for validation
   */
  static initializeStateComparison(state: NovelState): void {
    this.previousStateForComparison = JSON.parse(JSON.stringify(state));
  }

  /**
   * Optimize specific chapters only
   * Useful for targeted improvements after feedback
   */
  static async optimizeChapters(
    state: NovelState,
    category: ImprovementCategory,
    targeting: ChapterTargetingOptions,
    targetScore?: number,
    onProgress?: (message: string, progress: number) => void
  ): Promise<OptimizationResult> {
    try {
      onProgress?.('Preparing targeted chapter optimization...', 0);

      // Determine which chapters to target
      let targetChapterIds: string[] = [];
      let targetChapterNumbers: number[] = [];
      
      if (targeting.chapterIds && targeting.chapterIds.length > 0) {
        targetChapterIds = targeting.chapterIds;
        targetChapterNumbers = state.chapters
          .filter(ch => targetChapterIds.includes(ch.id))
          .map(ch => ch.number);
      } else if (targeting.chapterNumbers && targeting.chapterNumbers.length > 0) {
        targetChapterNumbers = targeting.chapterNumbers;
        targetChapterIds = state.chapters
          .filter(ch => targetChapterNumbers.includes(ch.number))
          .map(ch => ch.id);
      } else if (targeting.chapterRange) {
        targetChapterNumbers = state.chapters
          .filter(ch => ch.number >= targeting.chapterRange!.start && ch.number <= targeting.chapterRange!.end)
          .map(ch => ch.number);
        targetChapterIds = state.chapters
          .filter(ch => targetChapterNumbers.includes(ch.number))
          .map(ch => ch.id);
      }

      if (targetChapterIds.length === 0) {
        return {
          improvedState: state,
          finalScore: 0,
          scoreImprovement: 0,
          iterations: 0,
          executionResults: [],
          success: false,
          message: 'No chapters matched the targeting criteria',
        };
      }

      onProgress?.(`Targeting ${targetChapterIds.length} chapter(s): ${targetChapterNumbers.sort((a, b) => a - b).join(', ')}`, 5);

      // Store target chapters for filtering
      const targetChaptersSet = new Set(targetChapterIds);
      const targetNumbersSet = new Set(targetChapterNumbers);

      // Create a filtered state with only targeted chapters for analysis
      // This will be used for weakness analysis to only analyze selected chapters
      const filteredState: NovelState = {
        ...state,
        chapters: state.chapters.filter(ch => targetChaptersSet.has(ch.id)),
      };

      // Extract World Bible constants from full state (for context)
      const constants = WorldBibleExtractor.extractStoryConstants(state);
      onProgress?.('Story constants extracted', 6);

      // Initialize optimization state with rollback support
      const optState: OptimizationState = {
        iteration: 0,
        currentScore: 0,
        targetScore: targetScore || this.TARGET_SCORE_THRESHOLD,
        previousScore: 0,
        improvements: [],
        constants,
        stateSnapshots: [JSON.parse(JSON.stringify(state))], // Initial snapshot for rollback
        scoreHistory: [],
        qualityMetrics: {
          chaptersImproved: 0,
          chaptersUnchanged: 0,
          chaptersRegressed: 0,
          totalEdits: 0,
          totalInsertions: 0,
          totalRegenerations: 0,
          averageEditSize: 0,
          worldBibleViolations: 0,
          continuityIssues: 0,
        },
      };

      // Stage 1: Initial assessment (only on selected chapters)
      onProgress?.('Assessing selected chapters...', 10);
      const initialAssessment = await this.assessCurrentState(filteredState, category, onProgress);
      optState.currentScore = initialAssessment.score;
      optState.previousScore = initialAssessment.score;

      // Adjust target score if needed
      if (!targetScore) {
        optState.targetScore = Math.min(
          this.TARGET_SCORE_THRESHOLD,
          Math.max(optState.currentScore + 30, optState.currentScore + 10)
        );
      }

      // Track initial score
      optState.scoreHistory.push(optState.currentScore);

      onProgress?.(
        `Current score (selected chapters): ${optState.currentScore}/100, Target: ${optState.targetScore}/100`,
        15
      );

      // If already at target, return early
      if (optState.currentScore >= optState.targetScore) {
        return {
          improvedState: state,
          finalScore: optState.currentScore,
          scoreImprovement: 0,
          iterations: 0,
          executionResults: [],
          success: true,
          message: `Selected chapters already meet target score of ${optState.targetScore}/100`,
          metrics: optState.qualityMetrics,
          scoreHistory: optState.scoreHistory,
        };
      }

      let currentState = state; // Keep full state for context
      let iteration = 0;

      // Recursive optimization loop (similar to optimizeNovel but with filtering)
      const PROGRESS_START = 15;
      const PROGRESS_PER_ITERATION = 25;
      
      while (iteration < this.MAX_ITERATIONS) {
        iteration++;
        optState.iteration = iteration;

        const iterationProgressBase = Math.min(PROGRESS_START + ((iteration - 1) * PROGRESS_PER_ITERATION), 90);
        
        onProgress?.(
          `Optimization iteration ${iteration}/${this.MAX_ITERATIONS} (targeted chapters)...`,
          iterationProgressBase
        );

        // Stage 2: Generate optimization plan (filtered to target chapters)
        onProgress?.('Generating optimization plan for selected chapters...', Math.min(iterationProgressBase + 5, 92));
        const strategy = await this.generateOptimizationPlan(
          currentState, // Full state for context
          category,
          optState.targetScore,
          optState.constants,
          iteration,
          (msg, p) => onProgress?.(msg, Math.min(iterationProgressBase + (p * 0.1), 92)),
          targetChaptersSet, // Pass filter for strategy generation
          targetNumbersSet
        );

        if (!strategy || strategy.editActions?.length === 0 && 
            strategy.insertActions?.length === 0 && 
            strategy.regenerateActions?.length === 0) {
          onProgress?.('No improvements needed in this iteration', Math.min(iterationProgressBase + 10, 92));
          break;
        }

        // Stage 3: Execute transformations
        onProgress?.('Executing improvements...', Math.min(iterationProgressBase + 8, 92));
        const executionResult = await this.executeTransformations(
          currentState,
          strategy,
          optState.constants,
          (msg, p) => {
            const scaledProgress = iterationProgressBase + 8 + (p * 0.12);
            onProgress?.(msg, Math.min(scaledProgress, 92));
          }
        );

        optState.improvements.push(executionResult);

        // Update quality metrics
        optState.qualityMetrics.totalEdits += executionResult.chaptersEdited || 0;
        optState.qualityMetrics.totalInsertions += executionResult.chaptersInserted || 0;
        optState.qualityMetrics.totalRegenerations += executionResult.chaptersRegenerated || 0;

        // Update state with improvements
        if (executionResult.updatedState) {
          currentState = executionResult.updatedState;
          optState.stateSnapshots.push(JSON.parse(JSON.stringify(currentState)));
        }

        // Stage 4: Validate and check if we should iterate (on filtered state)
        onProgress?.('Validating improvements...', Math.min(iterationProgressBase + 20, 92));
        
        // Create filtered state for validation
        const filteredCurrentState: NovelState = {
          ...currentState,
          chapters: currentState.chapters.filter(ch => targetChaptersSet.has(ch.id)),
        };
        
        const validation = await this.validateAndIterate(
          filteredCurrentState,
          category,
          optState.currentScore,
          optState.targetScore,
          iteration,
          (msg, p) => onProgress?.(msg, Math.min(iterationProgressBase + 20 + (p * 0.05), 92))
        );

        optState.currentScore = validation.newScore;
        optState.previousScore = validation.previousScore;
        optState.scoreHistory.push(validation.newScore);

        onProgress?.(
          `Score: ${validation.previousScore} → ${validation.newScore} (${validation.scoreChange > 0 ? '+' : ''}${validation.scoreChange})`,
          Math.min(iterationProgressBase + 23, 92)
        );

        // QUALITY GATE: Rollback if score regressed significantly
        if (validation.scoreChange < -5) {
          onProgress?.(`Quality regression detected (${validation.scoreChange}). Rolling back...`, Math.min(iterationProgressBase + 24, 92));
          
          if (optState.stateSnapshots.length > 1) {
            const rollbackState = optState.stateSnapshots[optState.stateSnapshots.length - 2];
            currentState = JSON.parse(JSON.stringify(rollbackState));
            optState.stateSnapshots.pop();
            optState.scoreHistory.pop();
            optState.qualityMetrics.chaptersRegressed++;
            
            onProgress?.('Rolled back to previous state', Math.min(iterationProgressBase + 24, 92));
            continue;
          }
        }

        // Check if we've reached target or improvement is too small
        if (validation.newScore >= optState.targetScore) {
          onProgress?.('Target score achieved!', 95);
          return {
            improvedState: currentState,
            finalScore: validation.newScore,
            scoreImprovement: validation.newScore - initialAssessment.score,
            iterations: iteration,
            executionResults: optState.improvements,
            success: true,
            message: `Optimization complete: Score improved from ${initialAssessment.score} to ${validation.newScore}/100 in ${iteration} iteration(s) (${targetChapterIds.length} chapters)`,
            metrics: optState.qualityMetrics,
            scoreHistory: optState.scoreHistory,
          };
        }

        // If improvement is too small, stop iterating
        if (validation.scoreChange < this.MIN_SCORE_IMPROVEMENT && iteration > 1) {
          onProgress?.('Improvement rate too low, stopping optimization', 95);
          return {
            improvedState: currentState,
            finalScore: validation.newScore,
            scoreImprovement: validation.newScore - initialAssessment.score,
            iterations: iteration,
            executionResults: optState.improvements,
            success: true,
            message: `Optimization complete: Score improved from ${initialAssessment.score} to ${validation.newScore}/100. Further improvements would be marginal.`,
            metrics: optState.qualityMetrics,
            scoreHistory: optState.scoreHistory,
          };
        }

        onProgress?.('Preparing for next optimization pass...', Math.min(iterationProgressBase + PROGRESS_PER_ITERATION - 1, 92));
      }

      // Max iterations reached
      const finalScore = optState.currentScore;
      return {
        improvedState: currentState,
        finalScore,
        scoreImprovement: finalScore - initialAssessment.score,
        iterations: iteration,
        executionResults: optState.improvements,
        success: true,
        message: `Optimization complete after ${iteration} iteration(s): Score improved from ${initialAssessment.score} to ${finalScore}/100 (${targetChapterIds.length} chapters)`,
        metrics: optState.qualityMetrics,
        scoreHistory: optState.scoreHistory,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        improvedState: state,
        finalScore: 0,
        scoreImprovement: 0,
        iterations: 0,
        executionResults: [],
        success: false,
        message: `Targeted optimization failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Optimize multiple categories in sequence or parallel
   * Returns combined results for all categories
   */
  static async optimizeMultipleCategories(
    state: NovelState,
    options: MultiCategoryOptions,
    targetScore?: number,
    onProgress?: (message: string, progress: number) => void
  ): Promise<{
    results: Map<ImprovementCategory, OptimizationResult>;
    combinedState: NovelState;
    totalScoreImprovement: number;
    success: boolean;
    message: string;
  }> {
    const results = new Map<ImprovementCategory, OptimizationResult>();
    let currentState = state;
    let totalImprovement = 0;
    const categories = options.categories;

    try {
      onProgress?.(`Starting multi-category optimization (${categories.length} categories)...`, 0);

      if (options.priorityOrder === 'by-score') {
        // Sort categories by their current scores (lowest first)
        const categoryScores = await Promise.all(
          categories.map(async cat => {
            const weaknesses = analyzeCategoryWeaknesses(currentState, cat);
            return { category: cat, score: weaknesses.overallScore };
          })
        );
        categoryScores.sort((a, b) => a.score - b.score);
        categories.length = 0;
        categories.push(...categoryScores.map(cs => cs.category));
      }

      // Sequential processing (default)
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        const categoryProgress = (i / categories.length) * 100;
        
        onProgress?.(`Optimizing ${category} (${i + 1}/${categories.length})...`, categoryProgress);

        const result = await this.optimizeNovel(
          currentState,
          category,
          targetScore,
          (msg, p) => {
            const scaledProgress = categoryProgress + (p / categories.length);
            onProgress?.(msg, scaledProgress);
          }
        );

        results.set(category, result);

        if (result.success && result.improvedState) {
          currentState = result.improvedState;
          totalImprovement += result.scoreImprovement;
        }

        // If stop on first success is enabled
        if (options.stopOnFirstSuccess && result.success && result.scoreImprovement > 5) {
          onProgress?.(`Significant improvement achieved in ${category}, stopping early`, 95);
          break;
        }
      }

      const successCount = Array.from(results.values()).filter(r => r.success).length;
      
      onProgress?.(`Multi-category optimization complete`, 100);

      return {
        results,
        combinedState: currentState,
        totalScoreImprovement: totalImprovement,
        success: successCount > 0,
        message: `Optimized ${successCount}/${categories.length} categories. Total improvement: +${totalImprovement.toFixed(1)} points`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        results,
        combinedState: currentState,
        totalScoreImprovement: totalImprovement,
        success: false,
        message: `Multi-category optimization failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Quick analysis - get scores for all categories without optimization
   */
  static async analyzeAllCategories(
    state: NovelState,
    onProgress?: (message: string, progress: number) => void
  ): Promise<Map<ImprovementCategory, { score: number; topIssues: string[] }>> {
    const allCategories: ImprovementCategory[] = [
      'structure', 'engagement', 'tension', 'themes', 'psychology', 'devices', 'excellence'
    ];
    
    const results = new Map<ImprovementCategory, { score: number; topIssues: string[] }>();

    for (let i = 0; i < allCategories.length; i++) {
      const category = allCategories[i];
      onProgress?.(`Analyzing ${category}...`, (i / allCategories.length) * 100);

      try {
        const weaknesses = analyzeCategoryWeaknesses(state, category);
        const topIssues = weaknesses.issues?.slice(0, 3).map((issue: any) => issue.description || issue) || [];
        
        results.set(category, {
          score: weaknesses.overallScore,
          topIssues,
        });
      } catch (error) {
        results.set(category, {
          score: 0,
          topIssues: ['Analysis failed'],
        });
      }
    }

    onProgress?.('Analysis complete', 100);
    return results;
  }
}

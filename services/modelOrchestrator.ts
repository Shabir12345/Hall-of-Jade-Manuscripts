import { deepseekText, deepseekJson } from './deepseekService';
import { geminiText, geminiJson } from './geminiService';
import { logger } from './loggingService';
import { env } from '../utils/env';

/**
 * Model Orchestrator - Simplified Two-Model Architecture
 * 
 * DeepSeek-V3.2 ("The Writer"): 
 *   - Trained on massive Chinese web fiction corpus
 *   - Natively understands cultivation tropes (Dantian, Tribulation Lightning, Jade Slips, etc.)
 *   - Used for: Chapter generation, Arc/Saga planning, Creative expansion, Prose editing
 * 
 * Gemini 3 Flash ("The Clerk"):
 *   - Fast, cost-effective for state extraction
 *   - Used for: Metadata extraction, Lore Bible updates, Character/item tracking
 */

/**
 * Cost per 1M tokens (approximate, as of 2025)
 */
const MODEL_COSTS = {
  deepseek: {
    input: 0.14,  // $0.14 per 1M input tokens (cache miss)
    output: 0.28, // $0.28 per 1M output tokens
    // Note: Cache hit is $0.014/1M (90% cheaper)
  },
  gemini: {
    input: 0.10,  // $0.10 per 1M input tokens
    output: 0.40, // $0.40 per 1M output tokens
  },
};

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Estimates cost for a request
 */
function estimateCost(
  provider: 'deepseek' | 'gemini',
  inputText: string,
  outputText: string
): { inputCost: number; outputCost: number; totalCost: number; inputTokens: number; outputTokens: number } {
  const costs = MODEL_COSTS[provider];
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);

  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost, inputTokens, outputTokens };
}

/**
 * Task types that determine which model to use
 * 
 * DeepSeek ("The Writer") tasks - creative/narrative work:
 *   - prose_generation: Chapter writing
 *   - prose_editing: Chapter editing and revision
 *   - arc_planning: Story arc planning
 *   - creative_expansion: Expanding prose creatively
 *   - drafting: Initial drafts
 * 
 * Gemini ("The Clerk") tasks - extraction/metadata work:
 *   - metadata_extraction: Post-chapter state extraction
 *   - lore_dictation: Processing dictated lore entries
 *   - refine_spoken_input: Cleaning up voice input
 *   - style_critique: Style evaluation for critique-correction loop ("The Auto-Critic")
 */
export type TaskType =
  | 'prose_generation'      // DeepSeek - Chapter writing
  | 'prose_editing'         // DeepSeek - Chapter editing
  | 'metadata_extraction'   // Gemini - State extraction ("The Clerk")
  | 'drafting'              // DeepSeek - Initial drafts
  | 'arc_planning'          // DeepSeek - Story arc planning
  | 'creative_expansion'    // DeepSeek - Creative expansion
  | 'lore_dictation'        // Gemini - Processing lore entries
  | 'refine_spoken_input'   // Gemini - Voice input cleanup
  | 'style_critique';       // Gemini - Style critique for critique-correction loop

/**
 * MODEL ASSIGNMENTS
 * 
 * DeepSeek is now used for all tasks including prose and analytical extraction.
 */
const MODEL_ASSIGNMENTS: Record<TaskType, { provider: 'deepseek' | 'gemini'; model: string; description: string }> = {
  // DeepSeek "The Writer" tasks
  prose_generation: { provider: 'deepseek', model: 'deepseek-chat', description: 'Chapter generation' },
  prose_editing: { provider: 'deepseek', model: 'deepseek-chat', description: 'Prose editing and revision' },
  arc_planning: { provider: 'deepseek', model: 'deepseek-chat', description: 'Story arc planning' },
  creative_expansion: { provider: 'deepseek', model: 'deepseek-chat', description: 'Creative prose expansion' },
  drafting: { provider: 'deepseek', model: 'deepseek-chat', description: 'Initial drafting' },

  // All analytical tasks now use DeepSeek-chat ("The Clerk")
  metadata_extraction: { provider: 'deepseek', model: 'deepseek-chat', description: 'State extraction ("The Clerk")' },
  lore_dictation: { provider: 'deepseek', model: 'deepseek-chat', description: 'Lore dictation/expansion' },
  refine_spoken_input: { provider: 'deepseek', model: 'deepseek-chat', description: 'Polishing speech-to-text' },
  style_critique: { provider: 'deepseek', model: 'deepseek-chat', description: 'Literary style analysis' },
};

/**
 * Validates that required API keys are available
 */
function validateApiKey(provider: 'deepseek' | 'gemini'): void {
  if (provider === 'deepseek') {
    if (!env.deepseek?.apiKey) {
      throw new Error(
        `DEEPSEEK_API_KEY is required but not set. ` +
        `Please set DEEPSEEK_API_KEY in your .env.local file.`
      );
    }
  } else if (provider === 'gemini') {
    if (!env.gemini?.apiKey) {
      throw new Error(
        `GEMINI_API_KEY is required but not set. ` +
        `Please set GEMINI_API_KEY in your .env.local file.`
      );
    }
  }
}

/**
 * Routes a text generation task to the appropriate model
 * 
 * DeepSeek ("The Writer"): prose_generation, prose_editing, arc_planning, creative_expansion, drafting
 * Gemini ("The Clerk"): metadata_extraction, lore_dictation, refine_spoken_input
 */
export async function routeTextTask(
  taskType: TaskType,
  opts: {
    system?: string;
    user: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    cacheMetadata?: {
      cacheableContent: string;
      dynamicContent: string;
    };
  }
): Promise<string> {
  const assignment = MODEL_ASSIGNMENTS[taskType];
  if (!assignment) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  validateApiKey(assignment.provider);

  const startTime = Date.now();
  logger.info(`[${assignment.provider.toUpperCase()}] Routing ${taskType} (${assignment.description})`, 'modelOrchestrator');

  try {
    let result: string;

    if (assignment.provider === 'deepseek') {
      result = await deepseekText({
        model: 'deepseek-chat',
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature,
        topP: opts.topP,
        maxTokens: opts.maxTokens,
      });
    } else {
      result = await geminiText({
        model: 'gemini-2.5-flash',
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature,
        topP: opts.topP,
        maxTokens: opts.maxTokens,
        cacheMetadata: opts.cacheMetadata,
      });
    }

    const duration = Date.now() - startTime;
    logger.info(`[${assignment.provider.toUpperCase()}] Completed ${taskType} in ${duration}ms`, 'modelOrchestrator', {
      taskType,
      provider: assignment.provider,
      model: assignment.model,
      duration,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${assignment.provider.toUpperCase()}] Failed ${taskType} after ${duration}ms`, 'modelOrchestrator',
      error instanceof Error ? error : undefined,
      {
        taskType,
        provider: assignment.provider,
        model: assignment.model,
        duration,
      }
    );
    throw error;
  }
}

/**
 * Routes a JSON generation task to the appropriate model
 * 
 * DeepSeek ("The Writer"): prose_generation, prose_editing, arc_planning, creative_expansion, drafting
 * Gemini ("The Clerk"): metadata_extraction, lore_dictation, refine_spoken_input
 * 
 * @param overrideProvider - Optional override for prose_generation task (allows user to choose model)
 */
export async function routeJsonTask<T>(
  taskType: TaskType,
  opts: {
    system?: string;
    user: string;
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    cacheMetadata?: {
      cacheableContent: string;
      dynamicContent: string;
    };
    overrideProvider?: string; // Optional: 'deepseek' or 'gemini' to override default
  }
): Promise<T> {
  let assignment = MODEL_ASSIGNMENTS[taskType];
  if (!assignment) {
    throw new Error(`Unknown task type: ${taskType}`);
  }

  // Allow overriding provider for prose_generation task
  if (taskType === 'prose_generation' && opts.overrideProvider) {
    if (opts.overrideProvider === 'deepseek') {
      assignment = { provider: 'deepseek', model: 'deepseek-chat', description: 'Chapter generation (DeepSeek override)' };
    } else if (opts.overrideProvider === 'gemini') {
      assignment = { provider: 'gemini', model: 'gemini-2.5-flash', description: 'Chapter generation (Gemini override)' };
    }
    // Ignore invalid override values - use default
  }

  validateApiKey(assignment.provider);

  const startTime = Date.now();
  const inputText = (opts.system || '') + '\n' + opts.user;
  logger.info(`[${assignment.provider.toUpperCase()}] Routing ${taskType} JSON (${assignment.description})`, 'modelOrchestrator');

  try {
    let result: T;

    if (assignment.provider === 'deepseek') {
      result = await deepseekJson<T>({
        model: 'deepseek-chat',
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature,
        topP: opts.topP,
        maxTokens: opts.maxTokens,
      });
    } else {
      result = await geminiJson<T>({
        model: 'gemini-2.5-flash',
        system: opts.system,
        user: opts.user,
        temperature: opts.temperature,
        topP: opts.topP,
        maxTokens: opts.maxTokens,
        cacheMetadata: opts.cacheMetadata,
      });
    }

    const duration = Date.now() - startTime;
    const resultJson = JSON.stringify(result);
    const costEstimate = estimateCost(assignment.provider, inputText, resultJson);

    logger.info(`[${assignment.provider.toUpperCase()}] Completed ${taskType} JSON in ${duration}ms`, 'modelOrchestrator', {
      taskType,
      provider: assignment.provider,
      model: assignment.model,
      duration,
      costEstimate: {
        inputTokens: costEstimate.inputTokens,
        outputTokens: costEstimate.outputTokens,
        totalCost: costEstimate.totalCost.toFixed(6),
        inputCost: costEstimate.inputCost.toFixed(6),
        outputCost: costEstimate.outputCost.toFixed(6),
      },
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${assignment.provider.toUpperCase()}] Failed ${taskType} JSON after ${duration}ms`, 'modelOrchestrator',
      error instanceof Error ? error : undefined,
      {
        taskType,
        provider: assignment.provider,
        model: assignment.model,
        duration,
      }
    );
    throw error;
  }
}

/**
 * Gets the model assignment for a task type (for UI display)
 */
export function getModelAssignment(taskType: TaskType): { provider: string; model: string; description: string } {
  return MODEL_ASSIGNMENTS[taskType] || { provider: 'unknown', model: 'unknown', description: 'Unknown task' };
}

/**
 * Gets all model assignments (for UI display)
 */
export function getAllModelAssignments(): Record<TaskType, { provider: string; model: string; description: string }> {
  return MODEL_ASSIGNMENTS;
}

/**
 * Gets the provider role description
 */
export function getProviderRole(provider: 'deepseek' | 'gemini'): string {
  if (provider === 'deepseek') {
    return 'The Writer - DeepSeek-V3.2 trained on Chinese web fiction, understands cultivation tropes natively';
  }
  return 'The Clerk - Gemini Flash for fast, accurate state extraction and metadata processing';
}

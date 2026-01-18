import { grokText, grokJson } from './grokService';
import { logger } from './loggingService';
import { env } from '../utils/env';

/**
 * Cost per 1M tokens (approximate, as of 2024)
 */
const MODEL_COSTS = {
  claude: {
    input: 3.0,   // $3.00 per 1M input tokens
    output: 15.0, // $15.00 per 1M output tokens
  },
  gemini: {
    input: 0.10,  // $0.10 per 1M input tokens
    output: 0.40, // $0.40 per 1M output tokens
  },
  openai: {
    input: 15.0,  // $15.00 per 1M input tokens (GPT-5)
    output: 60.0, // $60.00 per 1M output tokens (GPT-5)
  },
  deepseek: {
    input: 0.20,  // $0.20 per 1M input tokens
    output: 0.60, // $0.60 per 1M output tokens
  },
  grok: {
    input: 0.20,  // $0.20 per 1M input tokens
    output: 0.50, // $0.50 per 1M output tokens (for reasoning variants)
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
  provider: string,
  inputText: string,
  outputText: string
): { inputCost: number; outputCost: number; totalCost: number; inputTokens: number; outputTokens: number } {
  const costs = MODEL_COSTS[provider as keyof typeof MODEL_COSTS] || MODEL_COSTS.grok;
  const inputTokens = estimateTokens(inputText);
  const outputTokens = estimateTokens(outputText);
  
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  const totalCost = inputCost + outputCost;
  
  return { inputCost, outputCost, totalCost, inputTokens, outputTokens };
}

/**
 * Task types that determine which model to use
 */
export type TaskType =
  | 'prose_generation'      // Grok - Best narrative flow
  | 'prose_editing'          // Grok - Maintains quality
  | 'metadata_extraction'    // Grok - Cost-effective for high-volume
  | 'drafting'               // Grok - High-volume, low-stakes
  | 'arc_planning'           // Grok - Complex planning
  | 'creative_expansion'      // Grok - Creative quality
  | 'lore_dictation'          // Grok - Cost-effective
  | 'refine_spoken_input';    // Grok - Cost-effective

/**
 * Model assignment map
 */
const MODEL_ASSIGNMENTS: Record<TaskType, { provider: string; model: string; required: boolean }> = {
  prose_generation: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  prose_editing: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  metadata_extraction: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  drafting: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  arc_planning: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  creative_expansion: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  lore_dictation: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
  refine_spoken_input: { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true },
};

/**
 * Validates that required API keys are available
 */
function validateApiKey(provider: string, required: boolean): void {
  let hasKey = false;
  
  if (provider === 'grok') {
    hasKey = !!env.grok?.apiKey;
  }
  
  if (required && !hasKey) {
    throw new Error(
      `XAI_API_KEY is required for ${provider} but is not set. ` +
      `Please set XAI_API_KEY in your .env.local file.`
    );
  }
}

/**
 * Routes a text generation task to the appropriate model
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
    cacheTtl?: '5m' | '1h'; // Cache TTL (5 minutes default, 1 hour optional)
  }
): Promise<string> {
  const assignment = MODEL_ASSIGNMENTS[taskType];
  if (!assignment) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  
  validateApiKey(assignment.provider, assignment.required);
  
  const startTime = Date.now();
  logger.info(`Routing ${taskType} to ${assignment.provider} (${assignment.model})`, 'modelOrchestrator');
  
  try {
    let result: string;
    
    switch (assignment.provider) {
      case 'grok':
        result = await grokText({
          system: opts.system,
          user: opts.user,
          temperature: opts.temperature,
          topP: opts.topP,
          maxTokens: opts.maxTokens,
          cacheMetadata: opts.cacheMetadata,
          cacheTtl: opts.cacheTtl,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${assignment.provider}`);
    }
    
    const duration = Date.now() - startTime;
    logger.info(`Completed ${taskType} in ${duration}ms using ${assignment.provider}`, 'modelOrchestrator', {
      taskType,
      provider: assignment.provider,
      model: assignment.model,
      duration,
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`Failed ${taskType} after ${duration}ms using ${assignment.provider}`, 'modelOrchestrator', 
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
 * @param overrideProvider - Optional override provider for prose_generation task (only 'grok' supported now)
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
    cacheTtl?: '5m' | '1h'; // Cache TTL (5 minutes default, 1 hour optional)
    overrideProvider?: string; // Override provider for prose_generation (only 'grok' supported now)
  }
): Promise<T> {
  let assignment = MODEL_ASSIGNMENTS[taskType];
  if (!assignment) {
    throw new Error(`Unknown task type: ${taskType}`);
  }
  
  // Allow overriding provider for prose_generation task (only grok supported now)
  if (taskType === 'prose_generation' && opts.overrideProvider) {
    const overrideProvider = opts.overrideProvider;
    if (overrideProvider === 'grok') {
      assignment = { provider: 'grok', model: 'grok-4-1-fast-reasoning', required: true };
    } else {
      throw new Error(`Invalid override provider for prose_generation: ${overrideProvider}. Only 'grok' is supported.`);
    }
  }
  
  validateApiKey(assignment.provider, assignment.required);
  
  const startTime = Date.now();
  const inputText = (opts.system || '') + '\n' + opts.user;
  logger.info(`Routing ${taskType} (JSON) to ${assignment.provider} (${assignment.model})`, 'modelOrchestrator');
  
  try {
    let result: T;
    
    switch (assignment.provider) {
      case 'grok':
        result = await grokJson<T>({
          system: opts.system,
          user: opts.user,
          temperature: opts.temperature,
          topP: opts.topP,
          maxTokens: opts.maxTokens,
          cacheMetadata: opts.cacheMetadata,
          cacheTtl: opts.cacheTtl,
        });
        break;
      default:
        throw new Error(`Unsupported provider: ${assignment.provider}`);
    }
    
    const duration = Date.now() - startTime;
    const resultJson = JSON.stringify(result);
    const costEstimate = estimateCost(assignment.provider, inputText, resultJson);
    
    logger.info(`Completed ${taskType} (JSON) in ${duration}ms using ${assignment.provider}`, 'modelOrchestrator', {
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
    logger.error(`Failed ${taskType} (JSON) after ${duration}ms using ${assignment.provider}`, 'modelOrchestrator',
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
export function getModelAssignment(taskType: TaskType): { provider: string; model: string; required: boolean } {
  return MODEL_ASSIGNMENTS[taskType] || { provider: 'unknown', model: 'unknown', required: false };
}

/**
 * Gets all model assignments (for UI display)
 */
export function getAllModelAssignments(): Record<TaskType, { provider: string; model: string; required: boolean }> {
  return MODEL_ASSIGNMENTS;
}

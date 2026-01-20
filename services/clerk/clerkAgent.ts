/**
 * Clerk Agent Service
 * 
 * The "Heavenly Record-Keeper" - an AI agent that maintains narrative consistency
 * by auditing each chapter and producing structured delta updates for the Lore Bible.
 */

import { NovelState, Chapter } from '../../types';
import { LoreBible } from '../../types/loreBible';
import {
  ClerkDelta,
  ClerkResult,
  ClerkConfig,
  ClerkRawResponse,
  DEFAULT_CLERK_CONFIG,
  ContinuityFlag,
} from '../../types/clerk';
import { geminiJson } from '../geminiService';
import { logger } from '../loggingService';
import { buildLoreBible } from '../loreBible/loreBibleService';
import { CLERK_SYSTEM_PROMPT, buildClerkUserPrompt, buildQuickClerkPrompt } from './clerkPrompts';
import { validateClerkDelta } from './auditValidators';

/**
 * Run the Clerk agent to audit a chapter and produce a delta update
 */
export async function runClerkAudit(
  state: NovelState,
  chapter: Chapter,
  config: Partial<ClerkConfig> = {}
): Promise<ClerkResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_CLERK_CONFIG, ...config };

  // Check if Clerk is enabled
  if (!finalConfig.enabled) {
    logger.debug('Clerk agent disabled, skipping audit', 'clerk');
    return {
      success: true,
      delta: null,
      validation: null,
      durationMs: Date.now() - startTime,
    };
  }

  logger.info(`Running Clerk audit for Chapter ${chapter.number}`, 'clerk', {
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
    model: finalConfig.model,
  });

  try {
    // Build or get current Lore Bible
    const currentBible = buildLoreBible(state, chapter.number - 1);

    // Build the prompt
    const userPrompt = buildClerkUserPrompt(currentBible, chapter, state);

    // Call Gemini
    const rawResponse = await geminiJson<ClerkRawResponse>({
      model: finalConfig.model,
      system: CLERK_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: finalConfig.temperature,
      maxTokens: finalConfig.maxTokens,
    });

    // Construct the delta
    const delta: ClerkDelta = {
      chapterNumber: chapter.number,
      timestamp: Date.now(),
      updates: rawResponse.updates || {},
      observations: {
        reasoning: rawResponse.observations?.reasoning || [],
        warnings: rawResponse.observations?.warnings || [],
        continuityFlags: normalizeFlags(rawResponse.observations?.continuityFlags || []),
      },
    };

    // Log observations if verbose
    if (finalConfig.verboseLogging) {
      logger.debug('Clerk observations', 'clerk', {
        reasoning: delta.observations.reasoning,
        warnings: delta.observations.warnings,
        flags: delta.observations.continuityFlags,
      });
    }

    // Validate the delta if enabled
    let validation = null;
    if (finalConfig.validateDeltas) {
      validation = validateClerkDelta(delta, currentBible, state);
      
      if (!validation.valid) {
        logger.warn('Clerk delta validation found issues', 'clerk', {
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }
    }

    // Log any continuity flags
    if (delta.observations.continuityFlags.length > 0) {
      const criticalFlags = delta.observations.continuityFlags.filter(f => f.severity === 'critical');
      if (criticalFlags.length > 0) {
        logger.warn('Clerk detected critical continuity issues', 'clerk', {
          flags: criticalFlags,
        });
      }
    }

    const durationMs = Date.now() - startTime;
    logger.info(`Clerk audit completed in ${durationMs}ms`, 'clerk', {
      chapterNumber: chapter.number,
      hasUpdates: Object.keys(delta.updates).length > 0,
      warningCount: delta.observations.warnings.length,
      flagCount: delta.observations.continuityFlags.length,
    });

    return {
      success: true,
      delta: validation?.valid !== false ? delta : validation.sanitizedDelta,
      validation,
      durationMs,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Clerk audit failed', 'clerk', error instanceof Error ? error : undefined, {
      chapterNumber: chapter.number,
      error: errorMessage,
    });

    return {
      success: false,
      delta: null,
      validation: null,
      error: errorMessage,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Run a quick/lightweight Clerk audit (for less critical chapters)
 */
export async function runQuickClerkAudit(
  state: NovelState,
  chapter: Chapter,
  config: Partial<ClerkConfig> = {}
): Promise<ClerkResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_CLERK_CONFIG, ...config };

  if (!finalConfig.enabled) {
    return {
      success: true,
      delta: null,
      validation: null,
      durationMs: Date.now() - startTime,
    };
  }

  try {
    const currentBible = buildLoreBible(state, chapter.number - 1);
    const userPrompt = buildQuickClerkPrompt(currentBible, chapter);

    const rawResponse = await geminiJson<ClerkRawResponse>({
      model: finalConfig.model,
      system: CLERK_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: finalConfig.temperature,
      maxTokens: 2048, // Smaller for quick audit
    });

    const delta: ClerkDelta = {
      chapterNumber: chapter.number,
      timestamp: Date.now(),
      updates: rawResponse.updates || {},
      observations: {
        reasoning: rawResponse.observations?.reasoning || ['Quick audit'],
        warnings: rawResponse.observations?.warnings || [],
        continuityFlags: normalizeFlags(rawResponse.observations?.continuityFlags || []),
      },
    };

    return {
      success: true,
      delta,
      validation: null, // Skip validation for quick audit
      durationMs: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      delta: null,
      validation: null,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Normalize continuity flags from raw response
 */
function normalizeFlags(rawFlags: unknown[]): ContinuityFlag[] {
  if (!Array.isArray(rawFlags)) return [];

  return rawFlags
    .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
    .map(f => ({
      type: normalizeType(f.type),
      severity: normalizeSeverity(f.severity),
      message: typeof f.message === 'string' ? f.message : 'Unknown issue',
      entities: Array.isArray(f.entities) ? f.entities.filter((e): e is string => typeof e === 'string') : undefined,
      suggestion: typeof f.suggestion === 'string' ? f.suggestion : undefined,
    }));
}

/**
 * Normalize flag type to valid enum value
 */
function normalizeType(type: unknown): ContinuityFlag['type'] {
  const validTypes: ContinuityFlag['type'][] = [
    'power_regression', 'item_inconsistency', 'character_status',
    'relationship_change', 'timeline_issue', 'plot_hole_risk',
    'unresolved_promise', 'cultivation_jump'
  ];
  
  if (typeof type === 'string' && validTypes.includes(type as ContinuityFlag['type'])) {
    return type as ContinuityFlag['type'];
  }
  return 'plot_hole_risk'; // Default
}

/**
 * Normalize severity to valid enum value
 */
function normalizeSeverity(severity: unknown): ContinuityFlag['severity'] {
  if (severity === 'info' || severity === 'warning' || severity === 'critical') {
    return severity;
  }
  return 'warning'; // Default
}

/**
 * Check if a delta has meaningful updates
 */
export function hasMeaningfulUpdates(delta: ClerkDelta): boolean {
  const updates = delta.updates;
  
  // Check protagonist updates
  if (updates.protagonist) {
    const p = updates.protagonist;
    if (p.cultivation || p.techniques?.length || p.inventory?.length ||
        p.emotionalState || p.physicalState || p.location || p.identity) {
      return true;
    }
  }

  // Check other updates
  if (updates.characters?.length) return true;
  if (updates.worldState && Object.keys(updates.worldState).length > 0) return true;
  if (updates.narrativeAnchors && Object.keys(updates.narrativeAnchors).length > 0) return true;
  if (updates.activeConflicts?.length) return true;
  if (updates.karmaDebts?.length) return true;
  if (updates.powerSystem && Object.keys(updates.powerSystem).length > 0) return true;

  return false;
}

/**
 * Get a summary of what the delta updates
 */
export function getDeltaSummary(delta: ClerkDelta): string {
  const parts: string[] = [];
  const updates = delta.updates;

  if (updates.protagonist) {
    const p = updates.protagonist;
    if (p.cultivation) parts.push('cultivation');
    if (p.techniques?.length) parts.push(`${p.techniques.length} techniques`);
    if (p.inventory?.length) parts.push(`${p.inventory.length} items`);
    if (p.emotionalState) parts.push('emotional state');
    if (p.physicalState) parts.push('physical state');
    if (p.location) parts.push('location');
  }

  if (updates.characters?.length) {
    parts.push(`${updates.characters.length} characters`);
  }

  if (updates.worldState && Object.keys(updates.worldState).length > 0) {
    parts.push('world state');
  }

  if (updates.narrativeAnchors) {
    parts.push('narrative anchors');
  }

  if (updates.activeConflicts?.length) {
    parts.push(`${updates.activeConflicts.length} conflicts`);
  }

  if (updates.karmaDebts?.length) {
    parts.push(`${updates.karmaDebts.length} karma debts`);
  }

  if (parts.length === 0) {
    return 'No updates';
  }

  return `Updates: ${parts.join(', ')}`;
}

/**
 * Merge multiple deltas (for batch processing)
 */
export function mergeDeltas(deltas: ClerkDelta[]): ClerkDelta {
  if (deltas.length === 0) {
    return {
      chapterNumber: 0,
      timestamp: Date.now(),
      updates: {},
      observations: { reasoning: [], warnings: [], continuityFlags: [] },
    };
  }

  if (deltas.length === 1) {
    return deltas[0];
  }

  // Sort by chapter number
  const sorted = [...deltas].sort((a, b) => a.chapterNumber - b.chapterNumber);
  const latest = sorted[sorted.length - 1];

  // Merge updates (later updates override earlier ones)
  const mergedUpdates = sorted.reduce((acc, delta) => {
    return deepMerge(acc, delta.updates);
  }, {} as ClerkDelta['updates']);

  // Combine observations
  const allReasoning = sorted.flatMap(d => d.observations.reasoning);
  const allWarnings = sorted.flatMap(d => d.observations.warnings);
  const allFlags = sorted.flatMap(d => d.observations.continuityFlags);

  return {
    chapterNumber: latest.chapterNumber,
    timestamp: Date.now(),
    updates: mergedUpdates,
    observations: {
      reasoning: allReasoning,
      warnings: Array.from(new Set(allWarnings)), // Dedupe
      continuityFlags: allFlags, // Keep all flags
    },
  };
}

/**
 * Deep merge helper for updates
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (Array.isArray(sourceValue)) {
      // For arrays, concatenate and dedupe by checking for objects with same id/name
      if (Array.isArray(targetValue)) {
        const merged = [...targetValue];
        for (const item of sourceValue) {
          if (typeof item === 'object' && item !== null) {
            const itemObj = item as Record<string, unknown>;
            const existingIndex = merged.findIndex(m => {
              if (typeof m !== 'object' || m === null) return false;
              const mObj = m as Record<string, unknown>;
              return (mObj.id && mObj.id === itemObj.id) ||
                     (mObj.name && mObj.name === itemObj.name);
            });
            if (existingIndex >= 0) {
              merged[existingIndex] = { ...merged[existingIndex] as object, ...itemObj };
            } else {
              merged.push(item);
            }
          } else {
            if (!merged.includes(item)) merged.push(item);
          }
        }
        result[key] = merged;
      } else {
        result[key] = sourceValue;
      }
    } else if (typeof sourceValue === 'object' && sourceValue !== null) {
      if (typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
        result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>);
      } else {
        result[key] = sourceValue;
      }
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result;
}

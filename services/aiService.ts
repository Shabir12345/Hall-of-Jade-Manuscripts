import type { Arc, ArcChecklistItem, Character, Chapter, NovelState, LogicAudit } from '../types';
import { SYSTEM_INSTRUCTION, QUALITY_CONFIG, CRITIQUE_CORRECTION_CONFIG } from '../constants';
import { applyCritiqueCorrectionLoop } from './critiqueCorrectionService';
import { getStoredLlm, type LlmId } from '../contexts/LlmContext';
import { getStoredChapterGenerationModel } from '../contexts/ChapterGenerationModelContext';
import { rateLimiter } from './rateLimiter';
import { routeTextTask, routeJsonTask } from './modelOrchestrator';
import { buildArcPrompt } from './promptEngine/writers/arcPromptWriter';
import { buildChapterPrompt } from './promptEngine/writers/chapterPromptWriter';
import { buildEditPrompt } from './promptEngine/writers/editPromptWriter';
import { buildExpansionPrompt } from './promptEngine/writers/expansionPromptWriter';
import { formatChapterContent } from '../utils/chapterFormatter';
import {
  validateChapterQuality as validateChapterGenerationQuality,
  validateChapterQuality,
  checkOriginalityPreparation
} from './chapterQualityValidator';
import {
  validateChapterQuality as validatePostGeneration,
  applyQuickFixes,
  type QualityReport
} from './postGenerationQualityService';
import { AppError, formatErrorMessage } from '../utils/errorHandling';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';
import { regenerateWithQualityCheck } from './chapterRegenerationService';
import { isJsonChapterContent, extractChapterContent } from '../utils/chapterContentRepair';
import { generateChapterWarnings, logChapterGenerationReport } from './chapterGenerationWarningService';
import { gatherMemoryEnhancedContext, injectMemoryContext } from './memory';
import { queryMemory } from './memory/memoryQueryService';
import { assembleContextWithBudget } from './memory/memoryTierManager';
import {
  runDirectorAgent,
  formatBeatSheetForPrompt,
  shouldRunDirector,
  recordTensionFromBeatSheet,
} from './director';
import { DirectorBeatSheet } from '../types/director';
import {
  shouldRunSimulation,
  runWorldSimulation,
  getLivingWorldStatus,
  saveLivingWorldStatus,
  addWorldEvents,
  injectLivingWorldContext,
  processChapterForDiscoveries,
  hasLivingWorldContent,
} from './livingWorld';
import { WorldEventInjectionContext, DEFAULT_WORLD_SIMULATION_CONFIG } from '../types/livingWorld';
import { shouldTriggerTribulationGate } from './tribulationGateDetector';
import { generateFatePaths } from './fatePathGenerator';
import { createGate, getGateConfig, buildGatePromptInjection, getGateById } from './tribulationGateService';
import { TribulationGate } from '../types/tribulationGates';
import { buildConsequenceReminder } from './gateConsequenceTracker';
import { generateFaceGraphContext, extractKarmaFromChapter, getFaceGraphConfig } from './faceGraph';
import type { FaceGraphContext } from '../types/faceGraph';
import { generateMarketContext } from './market';
import type { MarketContextResult } from './market/marketContextGenerator';
import { generateLoomDirective, runLoomClerkAudit } from './loom/loomIntegrationService';

// Legacy function kept for backward compatibility but no longer used for model selection
// Models are now selected automatically via the orchestrator based on task type
export function getActiveLlm(): LlmId {
  // Stored in localStorage by LlmProvider.
  try {
    return getStoredLlm();
  } catch {
    return 'deepseek';
  }
}

function sanitizePlainTextInsight(raw: string): string {
  if (!raw) return raw;
  let text = raw.trim();

  // Strip markdown code fences (``` or ```json ... ```)
  const fenceMatch = text.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fenceMatch?.[1]) {
    text = fenceMatch[1].trim();
  }

  const extractFromJson = (value: any): string | null => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) {
      const strings = value.filter(v => typeof v === 'string').slice(0, 3);
      return strings.length ? strings.join('\n\n') : null;
    }
    if (value && typeof value === 'object') {
      const preferredKeys = ['content', 'text', 'idea', 'insight', 'result', 'message'];
      for (const k of preferredKeys) {
        const v = (value as Record<string, unknown>)[k];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return null;
    }
    return null;
  };

  // If the whole output looks like JSON, try to parse and extract a likely text field.
  const looksJson =
    (text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'));
  if (looksJson) {
    try {
      const parsed = JSON.parse(text);
      const extracted = extractFromJson(parsed);
      if (extracted) return extracted.trim();
    } catch {
      // ignore
    }
  }

  // Best-effort extraction for common `{ "content": "..." }`-style output
  const contentMatch = text.match(/"content"\s*:\s*"([\s\S]*?)"\s*(?:,|\})/);
  if (contentMatch?.[1]) {
    return contentMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();
  }

  // Unwrap single quoted or double quoted full-string outputs
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text.trim();
}

function truncateForExtraction(text: string, maxChars: number): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars) + '\n\n[TRUNCATED]';
}

export type ChapterGenPhase =
  | 'quality_check'
  | 'quality_validation'
  | 'post_generation_validation'
  | 'regeneration_start'
  | 'regeneration_complete'
  | 'regeneration_error'
  | 'living_world_check'
  | 'living_world_simulation'
  | 'living_world_complete'
  | 'director_start'
  | 'director_complete'
  | 'tribulation_gate_check'
  | 'tribulation_gate_triggered'
  | 'tribulation_gate_generating'
  | 'tribulation_gate_ready'
  | 'face_graph_context'
  | 'market_context'
  | 'critique_start'
  | 'critique_evaluation'
  | 'critique_correction'
  | 'critique_complete'
  | 'prompt_build_start'
  | 'memory_context_gather'
  | 'prompt_build_end'
  | 'queue_estimate'
  | 'queue_dequeued'
  | 'llm_request_start'
  | 'llm_request_end'
  | 'parse_start'
  | 'parse_end';

export const refineSpokenInput = async (rawText: string): Promise<string> => {
  const prompt = `
You are an expert editor for Xianxia and high-fantasy web novels.

TASK:
1. Correct transcription errors (especially genre-specific terms like "qi", "dantian", "cultivation", "realms").
2. Organize the thoughts into a logical, professionally structured paragraph or list.
3. Maintain the specific genre jargon.
4. Keep the output as ONLY the refined text, no preamble or conversation.

RAW INPUT:
"${rawText}"
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () =>
      (await routeTextTask('refine_spoken_input', {
        user: prompt,
        temperature: 0.5,
      })) || rawText,
    `refine-voice-${rawText.substring(0, 50)}`
  );
};

export const processLoreDictation = async (
  rawText: string
): Promise<{ title: string; content: string; category: string }> => {

  // Skip API call if input is empty
  if (!rawText || rawText.trim().length < 5) {
    return { title: 'Untitled Entry', content: rawText, category: 'Other' };
  }

  const prompt = `
You are the "Omniscient System Clerk".
An author has dictated some lore for a Xianxia/Fantasy world.

RAW SPEECH: "${rawText}"

TASK:
1. Refine the text for clarity, logic, and genre accuracy.
2. Extract a suitable Title.
3. Assign it to one of these categories: Geography, Sects, PowerLevels, Laws, Systems, Techniques, Other.

Return ONLY a JSON object with this shape:
{"title": string, "content": string, "category": string}
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () => {
      const parsed = await routeJsonTask<{ title: string; content: string; category: string }>('lore_dictation', {
        user: prompt,
        temperature: 0.4,
      });

      return {
        title: parsed?.title || 'Untitled Entry',
        content: parsed?.content || rawText,
        category: parsed?.category || 'Other',
      };
    },
    `lore-${rawText.substring(0, 50)}`
  );
};

export const generateCreativeExpansion = async (
  type: string,
  currentText: string,
  state: NovelState
): Promise<string> => {
  try {
    const builtPrompt = await buildExpansionPrompt(state, type, currentText);

    const responseText = await rateLimiter.queueRequest(
      'refine',
      async () =>
        routeTextTask('creative_expansion', {
          system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          user: builtPrompt.userPrompt,
          temperature: 0.95,
          topP: 0.9,
        }),
      `expansion-${type}-${currentText.substring(0, 50)}`
    );

    return sanitizePlainTextInsight(responseText || currentText);
  } catch (error) {
    logger.error('Error in generateCreativeExpansion', 'ai', error instanceof Error ? error : new Error(String(error)));
    return currentText;
  }
};

/**
 * Generates the next chapter for a novel using AI
 * 
 * @param state - The current novel state including all chapters, characters, world, and arcs
 * @param userInstruction - Optional user instructions for the chapter (e.g., "Focus on character development")
 * @param opts - Optional callbacks for phase updates during generation
 * @returns Promise resolving to the generated chapter data including title, content, and updates
 * 
 * @example
 * ```typescript
 * const result = await generateNextChapter(novelState, "Introduce a new antagonist");
 * console.log(result.chapterTitle);
 * ```
 * 
 * @throws {AppError} If chapter generation fails or validation errors occur
 */
/**
 * Result type for chapter generation - can either be a chapter or a tribulation gate interrupt
 */
export type ChapterGenerationResult = {
  // Standard chapter generation result
  chapterTitle?: string;
  chapterContent?: string;
  chapterSummary?: string;
  logicAudit?: LogicAudit;
  wordCount?: number;
  characterUpdates?: Array<{
    name: string;
    updateType: string;
    newValue: string;
    targetName?: string;
  }>;
  worldUpdates?: Array<{
    title: string;
    content: string;
    category: string;
    isNewRealm: boolean;
  }>;
  territoryUpdates?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  // Tribulation Gate interrupt
  requiresUserChoice?: boolean;
  tribulationGate?: TribulationGate;
};

export const generateNextChapter = async (
  state: NovelState,
  userInstruction: string = '',
  opts?: {
    onPhase?: (phase: ChapterGenPhase, data?: Record<string, unknown>) => void;
    skipRegeneration?: boolean; // Set to true when called from regeneration to prevent infinite loops
    skipTribulationGate?: boolean; // Set to true when resuming after user makes gate choice
    resolvedGateId?: string; // If resuming from a gate, the ID of the resolved gate
  }
): Promise<ChapterGenerationResult | null> => {

  // Pre-generation quality checks
  const nextChapterNumber = state.chapters.length + 1;
  const qualityCheck = validateChapterGenerationQuality(state, nextChapterNumber);

  // NEW: Generate story health warnings using the smart warning system
  const warningReport = generateChapterWarnings(state, nextChapterNumber);

  // Log the comprehensive warning report
  logChapterGenerationReport(warningReport);

  // Log blockers as errors
  if (warningReport.blockers.length > 0) {
    warningReport.blockers.forEach(blocker => {
      logger.error(`[GENERATION BLOCKER] ${blocker.title}`, 'generation', undefined, {
        category: blocker.category,
        description: blocker.description,
        recommendation: blocker.recommendation,
        metric: blocker.metric,
      });
    });
  }

  // Log high-priority warnings
  const highWarnings = warningReport.warnings.filter(w => w.severity === 'high');
  if (highWarnings.length > 0) {
    highWarnings.forEach(warning => {
      logger.warn(`[GENERATION WARNING] ${warning.title}`, 'generation', {
        category: warning.category,
        description: warning.description,
        recommendation: warning.recommendation,
      });
    });
  }

  if (qualityCheck.suggestions && qualityCheck.suggestions.length > 0) {
    opts?.onPhase?.('quality_check', {
      qualityScore: qualityCheck.qualityScore,
      suggestions: qualityCheck.suggestions,
      // Include warning report data in phase callback
      warningReport: {
        overallHealth: warningReport.overallHealth,
        blockerCount: warningReport.blockers.length,
        warningCount: warningReport.warnings.length,
        threadSummary: warningReport.threadProgressionSummary,
        arcPosition: warningReport.arcPositionAnalysis,
      },
    });

    if (qualityCheck.warnings.length > 0) {
      logger.warn('Chapter generation quality warnings', 'ai', {
        warnings: qualityCheck.warnings
      });
    }
  }

  // NEW: Check and run Living World simulation if triggered
  let livingWorldInjectionContext: WorldEventInjectionContext | null = null;
  opts?.onPhase?.('living_world_check');

  try {
    const livingWorldStatus = getLivingWorldStatus(state.id);
    const simulationTrigger = shouldRunSimulation(
      state,
      nextChapterNumber,
      DEFAULT_WORLD_SIMULATION_CONFIG,
      livingWorldStatus.lastSimulationChapter
    );

    if (simulationTrigger) {
      opts?.onPhase?.('living_world_simulation', {
        trigger: simulationTrigger.type,
        chapter: simulationTrigger.triggerChapter,
      });

      const simulationStart = Date.now();

      logger.info('Living World simulation triggered', 'generation', {
        trigger: simulationTrigger.type,
        chapter: simulationTrigger.triggerChapter,
        lastSimulation: livingWorldStatus.lastSimulationChapter,
      });

      const simulationResult = await runWorldSimulation(state, simulationTrigger);

      if (simulationResult.success && simulationResult.events.length > 0) {
        // Add events to storage
        addWorldEvents(state.id, simulationResult.events);

        // Update status
        livingWorldStatus.lastSimulationChapter = nextChapterNumber;
        livingWorldStatus.nextScheduledSimulation = nextChapterNumber + DEFAULT_WORLD_SIMULATION_CONFIG.chapterInterval;
        saveLivingWorldStatus(state.id, livingWorldStatus);

        logger.info('Living World generated events', 'generation', {
          eventCount: simulationResult.events.length,
          trigger: simulationTrigger.type,
          durationMs: Date.now() - simulationStart,
        });
      }

      opts?.onPhase?.('living_world_complete', {
        durationMs: Date.now() - simulationStart,
        eventCount: simulationResult.events.length,
        success: simulationResult.success,
      });
    }
  } catch (livingWorldError) {
    logger.warn('Living World check/simulation failed, continuing without', 'generation', {
      error: livingWorldError instanceof Error ? livingWorldError.message : String(livingWorldError),
    });
  }

  // NEW: Run Director Agent to generate beat sheet for pacing control
  let directorBeatSheet: DirectorBeatSheet | null = null;
  if (shouldRunDirector(state)) {
    opts?.onPhase?.('director_start');
    const directorStart = Date.now();

    try {
      const directorResult = await runDirectorAgent(state, userInstruction);

      if (directorResult.success && directorResult.beatSheet) {
        directorBeatSheet = directorResult.beatSheet;
        logger.info('Director generated beat sheet', 'generation', {
          beatCount: directorBeatSheet.beats.length,
          arcPhase: directorBeatSheet.arcPosition.arcPhase,
          arcProgress: directorBeatSheet.arcProgressPercent.toFixed(1) + '%',
          hasClimaxProtection: !!directorBeatSheet.climaxProtection?.isClimaxProximate,
          pacingGuidance: directorBeatSheet.pacingGuidance.overallPace,
          targetWordCount: directorBeatSheet.pacingGuidance.targetWordCount,
        });
      } else if (directorResult.error) {
        logger.warn('Director agent failed, continuing without beat sheet', 'generation', {
          error: directorResult.error,
        });
      }

      opts?.onPhase?.('director_complete', {
        durationMs: Date.now() - directorStart,
        beatCount: directorBeatSheet?.beats.length || 0,
        arcPhase: directorBeatSheet?.arcPosition.arcPhase,
      });
    } catch (directorError) {
      logger.warn('Director agent threw error, continuing without beat sheet', 'generation', {
        error: directorError instanceof Error ? directorError.message : String(directorError),
      });
      opts?.onPhase?.('director_complete', {
        durationMs: Date.now() - directorStart,
        error: true,
      });
    }
  }

  // NEW: Check for Tribulation Gate trigger (unless skipping or resuming from a gate)
  let resolvedGateInjection: string | null = null;

  if (!opts?.skipTribulationGate) {
    opts?.onPhase?.('tribulation_gate_check');

    try {
      const gateConfig = getGateConfig(state.id);

      if (gateConfig.enabled) {
        const gateDetection = shouldTriggerTribulationGate(
          state,
          directorBeatSheet,
          userInstruction,
          gateConfig
        );

        if (gateDetection.shouldTrigger && gateDetection.triggerType) {
          opts?.onPhase?.('tribulation_gate_triggered', {
            triggerType: gateDetection.triggerType,
            situation: gateDetection.situation,
            confidence: gateDetection.confidence,
          });

          logger.info('Tribulation Gate triggered', 'generation', {
            triggerType: gateDetection.triggerType,
            confidence: gateDetection.confidence,
            reason: gateDetection.reason,
          });

          // Generate fate paths
          opts?.onPhase?.('tribulation_gate_generating');

          const fatePaths = await generateFatePaths(
            state,
            gateDetection.triggerType,
            gateDetection.situation,
            gateDetection.protagonistName,
            gateDetection.context
          );

          // Create and persist the gate
          const gate = createGate(
            state.id,
            nextChapterNumber,
            gateDetection.triggerType,
            gateDetection.situation,
            gateDetection.context,
            gateDetection.protagonistName,
            fatePaths,
            gateDetection.arcId,
            gateDetection.relatedThreadIds
          );

          opts?.onPhase?.('tribulation_gate_ready', {
            gateId: gate.id,
            pathCount: fatePaths.length,
          });

          // Return early - the caller needs to show the gate UI and get user choice
          return {
            requiresUserChoice: true,
            tribulationGate: gate,
          };
        } else {
          logger.debug('Tribulation Gate check passed, no trigger', 'generation', {
            reason: gateDetection.reason,
            confidence: gateDetection.confidence,
          });
        }
      }
    } catch (gateError) {
      logger.warn('Tribulation Gate check failed, continuing without', 'generation', {
        error: gateError instanceof Error ? gateError.message : String(gateError),
      });
    }
  } else if (opts?.resolvedGateId) {
    // Resuming from a resolved gate - inject the chosen path into the prompt
    try {
      const resolvedGate = getGateById(opts.resolvedGateId);
      if (resolvedGate && resolvedGate.status === 'resolved') {
        resolvedGateInjection = buildGatePromptInjection(resolvedGate);
        logger.info('Injecting resolved Tribulation Gate into prompt', 'generation', {
          gateId: resolvedGate.id,
          selectedPathId: resolvedGate.selectedPathId,
          triggerType: resolvedGate.triggerType,
        });
      }
    } catch (gateInjectError) {
      logger.warn('Failed to inject resolved gate, continuing without', 'generation', {
        error: gateInjectError instanceof Error ? gateInjectError.message : String(gateInjectError),
      });
    }
  }

  // NEW: Generate Heavenly Loom directive before building prompt
  let loomDirective: string | null = null;
  try {
    opts?.onPhase?.('loom_director_start');
    const directiveStart = Date.now();

    loomDirective = await generateLoomDirective(state, userInstruction, {
      enabled: true,
      onPhase: (phase, data) => {
        // Map Loom phases to our phase callbacks
        if (phase === 'loom_director_start') {
          opts?.onPhase?.('loom_director_start', data);
        } else if (phase === 'loom_director_complete') {
          opts?.onPhase?.('loom_director_complete', data);
        }
      },
    });

    if (loomDirective) {
      logger.info('Heavenly Loom directive generated', 'loom', {
        directiveLength: loomDirective.length,
      });
    }

    opts?.onPhase?.('loom_director_complete', {
      directiveGenerated: !!loomDirective,
      durationMs: Date.now() - directiveStart,
    });
  } catch (loomError) {
    logger.warn('Heavenly Loom directive generation failed, continuing without', 'loom', {
      error: loomError instanceof Error ? loomError.message : String(loomError),
    });
  }

  opts?.onPhase?.('prompt_build_start');
  const promptStart = Date.now();

  // OPTIMIZATION: Build prompt components in parallel where possible
  const selectedModel = getStoredChapterGenerationModel();

  // Start parallel operations for prompt building
  const basePromptPromise = buildChapterPrompt(state, userInstruction);
  const memoryContextPromise = opts?.onPhase ? (async () => {
    opts?.onPhase?.('memory_context_gather');
    try {
      const memoryContext = await queryMemory(state, {
        depth: 3,
        tokenBudget: 4000,
        characterId: state.characterCodex.find(c => c.isProtagonist)?.id
      });
      return memoryContext;
    } catch (memoryError) {
      logger.warn('Failed to gather memory context, continuing without', 'generation', {
        error: memoryError instanceof Error ? memoryError.message : String(memoryError),
      });
      return null;
    }
  })() : Promise.resolve(null);

  // Wait for base prompt to complete
  let builtPrompt = await basePromptPromise;

  // Process memory context in parallel with other optimizations
  const memoryContext = await memoryContextPromise;
  if (memoryContext) {
    // Use the optimized memory context assembly
    const assembledMemory = assembleContextWithBudget(memoryContext, 4000);
    builtPrompt = {
      ...builtPrompt,
      systemInstruction: builtPrompt.systemInstruction + '\n\n' + assembledMemory,
    };

    logger.info('Injected hierarchical memory context', 'generation', {
      totalTokenCount: memoryContext.totalTokenCount,
      retrievalDuration: memoryContext.retrievalDuration,
    });
  }

  // NEW: Inject Director beat sheet into the prompt for pacing control
  if (directorBeatSheet) {
    const beatSheetBlock = formatBeatSheetForPrompt(directorBeatSheet);

    // Add beat sheet to system instruction for authoritative guidance
    builtPrompt = {
      ...builtPrompt,
      systemInstruction: builtPrompt.systemInstruction + '\n\n' + beatSheetBlock,
    };

    logger.info('Injected Director beat sheet into prompt', 'generation', {
      beatCount: directorBeatSheet.beats.length,
      mandatoryBeats: directorBeatSheet.beats.filter(b => b.mandatory).length,
      targetWordCount: directorBeatSheet.pacingGuidance.targetWordCount,
      pacingGuidance: directorBeatSheet.pacingGuidance.overallPace,
    });
  }

  // NEW: Inject resolved Tribulation Gate choice into the prompt
  if (resolvedGateInjection) {
    builtPrompt = {
      ...builtPrompt,
      systemInstruction: builtPrompt.systemInstruction + '\n\n' + resolvedGateInjection,
      userPrompt: resolvedGateInjection + '\n\n' + builtPrompt.userPrompt,
    };

    logger.info('Injected Tribulation Gate choice into prompt', 'generation');
  }

  // NEW: Inject Tribulation Gate consequence reminder into the prompt
  try {
    const consequenceReminder = buildConsequenceReminder(state.id);
    if (consequenceReminder) {
      builtPrompt = {
        ...builtPrompt,
        systemInstruction: builtPrompt.systemInstruction + '\n\n' + consequenceReminder,
      };

      logger.info('Injected consequence reminder into prompt', 'generation');
    }
  } catch (consequenceError) {
    logger.warn('Failed to inject consequence reminder, continuing without', 'generation', {
      error: consequenceError instanceof Error ? consequenceError.message : String(consequenceError),
    });
  }

  // NEW: Inject Living World events context into the prompt
  if (hasLivingWorldContent(state.id)) {
    try {
      const recentChapters = state.chapters.slice(-3);
      const { prompt: enhancedPrompt, injectionContext } = injectLivingWorldContext(
        builtPrompt,
        state.id,
        nextChapterNumber,
        recentChapters
      );

      if (injectionContext.formattedContext) {
        builtPrompt = enhancedPrompt;
        livingWorldInjectionContext = injectionContext;

        logger.info('Injected Living World context into prompt', 'generation', {
          eventsToDiscover: injectionContext.eventsToDiscover.length,
          pendingEvents: injectionContext.pendingEventCount,
          urgentEvents: injectionContext.urgentEvents.length,
        });
      }
    } catch (livingWorldInjectError) {
      logger.warn('Failed to inject Living World context, continuing without', 'generation', {
        error: livingWorldInjectError instanceof Error ? livingWorldInjectError.message : String(livingWorldInjectError),
      });
    }
  }

  // NEW: Inject Face Graph (karma/reputation) context into the prompt
  let faceGraphContext: FaceGraphContext | null = null;
  try {
    const faceConfig = await getFaceGraphConfig(state.id);

    if (faceConfig.enabled) {
      // Get characters likely present in this chapter (from recent context)
      const recentChapterCharacters = new Set<string>();
      const recentChapters = state.chapters.slice(-3);

      // Extract character IDs from recent chapters and current arc
      for (const chapter of recentChapters) {
        // Check for character mentions in content
        for (const char of state.characterCodex) {
          if (chapter.content.toLowerCase().includes(char.name.toLowerCase())) {
            recentChapterCharacters.add(char.id);
          }
        }
      }

      // Add protagonist
      const protagonist = state.characterCodex.find(c => c.isProtagonist);
      if (protagonist) {
        recentChapterCharacters.add(protagonist.id);
      }

      // Add characters from active threads (via relatedEntityId if it's a character)
      const activeThreads = (state.storyThreads || []).filter(t => t.status === 'active');
      for (const thread of activeThreads) {
        if (thread.relatedEntityId && thread.relatedEntityType === 'character') {
          recentChapterCharacters.add(thread.relatedEntityId);
        }
      }

      if (recentChapterCharacters.size > 0) {
        faceGraphContext = await generateFaceGraphContext(
          state,
          Array.from(recentChapterCharacters),
          nextChapterNumber,
          protagonist?.id
        );

        if (faceGraphContext.formattedContext) {
          builtPrompt = {
            ...builtPrompt,
            systemInstruction: builtPrompt.systemInstruction + '\n\n' + faceGraphContext.formattedContext,
          };

          logger.info('Injected Face Graph context into prompt', 'generation', {
            unresolvedKarma: faceGraphContext.unresolvedKarma.length,
            activeBloodFeuds: faceGraphContext.activeBloodFeuds.length,
            unpaidDebts: faceGraphContext.unpaidDebts.length,
            pendingRipples: faceGraphContext.pendingRipples.length,
          });
        }
      }
    }
  } catch (faceGraphError) {
    logger.warn('Failed to inject Face Graph context, continuing without', 'generation', {
      error: faceGraphError instanceof Error ? faceGraphError.message : String(faceGraphError),
    });
  }

  // NEW: Inject Market/Economic context into the prompt for price consistency
  let marketContextResult: MarketContextResult | null = null;
  try {
    if (state.globalMarketState && state.globalMarketState.currencies.length > 0) {
      const previousContent = state.chapters.slice(-2).map(c => c.content).join('\n');

      marketContextResult = generateMarketContext(state, {
        userInstructions: userInstruction,
        previousContent,
        chapterOutline: directorBeatSheet ?
          directorBeatSheet.beats.map(b => b.description).join('. ') : undefined,
      });

      if (marketContextResult.shouldInclude && marketContextResult.contextBlock) {
        builtPrompt = {
          ...builtPrompt,
          systemInstruction: builtPrompt.systemInstruction + '\n\n' + marketContextResult.contextBlock,
        };

        logger.info('Injected Market context into prompt', 'generation', {
          sceneType: marketContextResult.sceneType,
          relevantItems: marketContextResult.relevantItems.length,
          priceWarnings: marketContextResult.priceWarnings.length,
        });
      }
    }
  } catch (marketError) {
    logger.warn('Failed to inject Market context, continuing without', 'generation', {
      error: marketError instanceof Error ? marketError.message : String(marketError),
    });
  }

  // NEW: Inject story health constraints into the prompt
  if (warningReport.promptConstraints.length > 0 || warningReport.blockers.length > 0) {
    // Collect specific stalled threads that MUST be addressed
    const stalledThreads = warningReport.blockers
      .filter(b => b.category === 'thread_progression' && b.title.includes('Stalled'))
      .map(b => b.affectedEntities[0]?.name)
      .filter(Boolean);

    const criticalThreads = warningReport.blockers
      .filter(b => b.category === 'resolution_urgency' && b.title.includes('Exceeded Max Age'))
      .map(b => b.affectedEntities[0]?.name)
      .filter(Boolean);

    // Build a prioritized list of threads to address (max 3 for focus)
    const threadsToAddress = [...new Set([...stalledThreads, ...criticalThreads])].slice(0, 3);

    // Build system-level constraints (more authoritative placement)
    const systemConstraints = [
      '',
      '╔══════════════════════════════════════════════════════════════════╗',
      '║  MANDATORY STORY HEALTH REQUIREMENTS - MUST BE FOLLOWED         ║',
      '╚══════════════════════════════════════════════════════════════════╝',
      '',
      `STORY HEALTH SCORE: ${warningReport.overallHealth}/100 (${warningReport.overallHealth < 30 ? 'CRITICAL - REQUIRES IMMEDIATE ACTION' : warningReport.overallHealth < 60 ? 'WARNING - NEEDS IMPROVEMENT' : 'ACCEPTABLE'})`,
      `ARC POSITION: ${warningReport.arcPositionAnalysis.positionName} (${warningReport.arcPositionAnalysis.progressPercentage}% through story)`,
      '',
    ];

    // Add specific thread requirements if there are stalled threads
    if (threadsToAddress.length > 0) {
      systemConstraints.push(
        '⚠️ THREAD PROGRESSION REQUIREMENTS (NON-NEGOTIABLE):',
        `The following ${threadsToAddress.length} story thread(s) are stalled and MUST be addressed in this chapter:`,
        ''
      );
      threadsToAddress.forEach((thread, i) => {
        systemConstraints.push(`  ${i + 1}. "${thread}" - Include dialogue, action, or significant reference to this thread`);
      });
      systemConstraints.push(
        '',
        'For each thread above, you MUST include at least ONE of:',
        '  • A scene directly involving this thread',
        '  • Character dialogue about this thread',
        '  • A plot development that advances this thread',
        '  • A meaningful reference that shows the thread is still active',
        ''
      );
    }

    // Add general constraints
    systemConstraints.push(
      '📋 ADDITIONAL REQUIREMENTS:',
      ...warningReport.promptConstraints.map((c, i) => `  ${i + 1}. ${c}`),
      '',
      '📊 CURRENT THREAD STATUS:',
      `  • Active threads: ${warningReport.threadProgressionSummary.activeThreads}`,
      `  • Stalled threads needing attention: ${warningReport.threadProgressionSummary.stalledThreads}`,
      `  • At risk of plot holes: ${warningReport.threadProgressionSummary.atRiskOfPlotHole}`,
      `  • Recent progressions: ${warningReport.threadProgressionSummary.progressedRecently}`,
      '',
      '════════════════════════════════════════════════════════════════════',
      ''
    );

    const constraintBlock = systemConstraints.join('\n');

    // Add constraints to BOTH system instruction and user prompt for emphasis
    builtPrompt = {
      ...builtPrompt,
      systemInstruction: builtPrompt.systemInstruction + constraintBlock,
      userPrompt: constraintBlock + builtPrompt.userPrompt,
    };

    logger.info('Added story health constraints to prompt', 'generation', {
      constraintCount: warningReport.promptConstraints.length,
      blockerCount: warningReport.blockers.length,
      threadsToAddress,
      overallHealth: warningReport.overallHealth,
    });
  }

  // NEW: Inject Heavenly Loom directive into the prompt
  if (loomDirective) {
    builtPrompt = {
      ...builtPrompt,
      systemInstruction: builtPrompt.systemInstruction + '\n\n' + loomDirective,
      userPrompt: loomDirective + '\n\n' + builtPrompt.userPrompt,
    };

    logger.info('Injected Heavenly Loom directive into prompt', 'loom', {
      directiveLength: loomDirective.length,
    });
  }

  const promptBuildMs = Date.now() - promptStart;
  opts?.onPhase?.('prompt_build_end', { promptBuildMs });

  // Keep the same phase keys so App.tsx logging continues to work (we'll rename UI strings later).
  const estimatedWaitMs = rateLimiter.getEstimatedWaitTime('generate');
  opts?.onPhase?.('queue_estimate', { estimatedWaitMs });

  let queueWaitMs: number | undefined;
  let requestDurationMs: number | undefined;

  const result = await rateLimiter.queueRequest(
    'generate',
    async () => {
      opts?.onPhase?.('llm_request_start');
      const start = Date.now();
      // selectedModel is already retrieved above for prompt building

      // Enhanced JSON schema with explicit word count requirement
      const jsonSchemaInstruction =
        '\n\n⚠️ CRITICAL WORD COUNT REQUIREMENT: The chapterContent field MUST contain AT LEAST 1500 words. This is NON-NEGOTIABLE. Before generating, plan for 1800-2200 words to ensure you meet the minimum. Count your words before finalizing.\n\n' +
        'Return ONLY a JSON object with this exact shape:\n' +
        '{' +
        '"logicAudit":{"startingValue":string,"theFriction":string,"theChoice":string,"resultingValue":string,"causalityType":string},' +
        '"chapterTitle":string,' +
        '"chapterContent":string (MUST BE AT LEAST 1500 WORDS - aim for 1800-2200 words),' +
        '"chapterSummary":string,' +
        '"wordCount":number (count the words in chapterContent and report here - MUST be >= 1500),' +
        '"characterUpdates":[{"name":string,"updateType":"new"|"cultivation"|"skill"|"item"|"status"|"notes"|"relationship"|"appearance"|"location","newValue":string,"targetName":string}],' +
        '"worldUpdates":[{"title":string,"content":string,"category":string,"isNewRealm":boolean}],' +
        '"territoryUpdates":[{"name":string,"type":string,"description":string}]' +
        '}';

      const json = await routeJsonTask<{
        logicAudit?: LogicAudit;
        chapterTitle?: string;
        chapterContent?: string;
        chapterSummary?: string;
        wordCount?: number;
        characterUpdates?: Array<{
          name: string;
          updateType: string;
          newValue: string;
          targetName?: string;
        }>;
        worldUpdates?: Array<{
          title: string;
          content: string;
          category: string;
          isNewRealm: boolean;
        }>;
        territoryUpdates?: Array<{
          name: string;
          type: string;
          description: string;
        }>;
      }>('prose_generation', {
        system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
        user: builtPrompt.userPrompt + jsonSchemaInstruction,
        // AI Detection Evasion: Higher temperature for more human-like unpredictability
        temperature: 1.0, // Grok API maximum is 1.0 (temperature and topP cannot both be specified)
        // Grok output can be large; allow ample tokens for 1500+ word chapters
        // 1500 words ≈ 2000 tokens, so we need at least 3000 tokens for content + JSON overhead
        maxTokens: 8192,
        // Pass cache metadata if available (JSON instruction is dynamic, so append to dynamic content)
        cacheMetadata: builtPrompt.cacheMetadata && builtPrompt.cacheMetadata.canUseCaching ? {
          cacheableContent: builtPrompt.cacheMetadata.cacheableContent,
          dynamicContent: (builtPrompt.cacheMetadata.dynamicContent || '') + jsonSchemaInstruction,
        } : undefined,
        // Override provider based on user selection
        overrideProvider: selectedModel,
      });
      requestDurationMs = Date.now() - start;
      opts?.onPhase?.('llm_request_end', { requestDurationMs });
      return json;
    },
    `generate-${state.id}-${state.chapters.length + 1}`,
    {
      onDequeued: (info) => {
        queueWaitMs = info.queueWaitMs;
        opts?.onPhase?.('queue_dequeued', { queueWaitMs });
      },
      onFinished: () => { },
      onError: (info) => {
        console.warn('LLM request failed in rate limiter', info);
      },
    }
  );

  opts?.onPhase?.('parse_start');
  // grokJson already parses; still validate required fields
  if (!result?.chapterTitle || !result?.chapterContent) {
    // Provide more context about what was received
    const receivedFields = result ? Object.keys(result) : [];
    const hasLogicAudit = result?.logicAudit ? 'yes' : 'no';
    const resultPreview = result ? JSON.stringify(result).substring(0, 200) : 'null';

    throw new Error(
      `LLM response missing required fields (chapterTitle or chapterContent).\n` +
      `Response may be truncated or incomplete.\n` +
      `Fields received: ${receivedFields.length > 0 ? receivedFields.join(', ') : 'none'}\n` +
      `Has logicAudit: ${hasLogicAudit}\n` +
      `Response preview: ${resultPreview}...\n` +
      `This usually indicates the response was truncated due to token limits. Try increasing maxTokens.`
    );
  }

  // CRITICAL: Validate that chapterContent is not accidentally JSON
  // This prevents a bug where the entire response was saved as content
  if (isJsonChapterContent(result.chapterContent)) {
    logger.warn('Detected JSON in chapterContent, attempting to extract actual content', 'ai');
    const actualContent = extractChapterContent(result.chapterContent);
    if (actualContent) {
      result.chapterContent = actualContent;
      logger.info('Successfully extracted actual chapter content from JSON', 'ai');
    } else {
      logger.error('Failed to extract chapter content from JSON response', 'ai');
      throw new Error('LLM response contains JSON in chapterContent field instead of prose');
    }
  }

  // Format chapter content for professional structure and punctuation
  const originalContent = result.chapterContent;
  result.chapterContent = formatChapterContent(result.chapterContent);

  if (originalContent !== result.chapterContent) {
    logger.debug('Chapter content formatted: structure and punctuation improvements applied', 'ai');
  }

  // Validate minimum word count (1500 words) - after formatting
  let wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;

  // If reported wordCount from AI differs significantly from actual, log it
  if (result.wordCount && Math.abs(result.wordCount - wordCount) > 50) {
    logger.debug('AI reported word count differs from actual', 'ai', {
      reported: result.wordCount,
      actual: wordCount
    });
  }

  if (wordCount < 1500) {
    logger.warn('Generated chapter below minimum word count', 'ai', {
      wordCount,
      minimum: 1500
    });

    // Attempt to expand the content to meet minimum
    // This is a fallback - the prompt should enforce word count
    if (!opts?.skipRegeneration) {
      const wordsNeeded = 1500 - wordCount;
      const targetWordCount = Math.max(1600, wordCount + Math.ceil(wordsNeeded * 1.3)); // Target 30% above the gap
      const originalWordCount = wordCount;

      logger.info('Attempting to expand chapter content to meet minimum word count', 'ai', {
        currentWordCount: wordCount,
        wordsNeeded,
        targetWordCount
      });

      try {
        const expansionPrompt = `You are a prose expansion specialist. A chapter has been written but is too short at ${wordCount} words. It needs to be at least ${targetWordCount} words (minimum acceptable: 1500).

GAP TO FILL: You need to add approximately ${wordsNeeded + 100} more words.

=== CURRENT CHAPTER CONTENT ===
${result.chapterContent}
=== END OF CHAPTER ===

EXPANSION TASK: Expand this chapter to ${targetWordCount}+ words by enriching the existing prose.

SPECIFIC EXPANSION TECHNIQUES TO USE:
1. SENSORY DETAILS: Add what characters see, hear, smell, taste, and feel
2. CHARACTER INTERIORITY: Add thoughts, feelings, memories, and internal reactions
3. DIALOGUE EXPANSION: Extend conversations with more back-and-forth, subtext, and non-verbal cues
4. ENVIRONMENTAL DESCRIPTION: Describe the setting in more detail
5. ACTION BEATS: Add small physical actions during dialogue (gestures, movements, expressions)
6. PACING: Add beats and pauses where characters process information

CRITICAL RULES:
- DO NOT change plot events or story outcome
- DO NOT add new scenes - only expand existing ones
- DO NOT add meta-commentary or summary statements
- DO NOT pad with filler - every addition must serve the story
- MAINTAIN the existing writing voice and style
- FOCUS expansion on the weakest/thinnest sections

OUTPUT: Return ONLY the expanded chapter as plain text. No JSON, no markdown headers, no word count reporting.`;

        const expandedContent = await routeTextTask('prose_editing', {
          system: `${SYSTEM_INSTRUCTION}\n\nYou are expanding prose to meet a word count requirement. Your expansion must feel natural and integrated, not artificially padded. Focus on adding depth and richness to existing scenes.`,
          user: expansionPrompt,
          temperature: 0.85, // Slightly lower for more controlled expansion
          maxTokens: 5000, // Increased to allow for longer output
        });

        if (expandedContent) {
          const expandedWordCount = expandedContent.split(/\s+/).filter((word: string) => word.length > 0).length;
          // Accept expansion if it added at least 50 words and is closer to the target
          if (expandedWordCount > originalWordCount + 50) {
            result.chapterContent = formatChapterContent(expandedContent);
            wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;
            logger.info('Successfully expanded chapter content', 'ai', {
              originalWordCount,
              expandedWordCount,
              newWordCount: wordCount,
              wordsAdded: wordCount - originalWordCount
            });

            // If still below minimum after first expansion, try one more time
            if (wordCount < 1500) {
              logger.info('First expansion still below minimum, attempting second expansion', 'ai', {
                currentWordCount: wordCount,
                stillNeeded: 1500 - wordCount
              });

              const secondExpansionPrompt = `This chapter is still ${1500 - wordCount} words short of the 1500 word minimum. Current word count: ${wordCount}.

=== CHAPTER CONTENT ===
${result.chapterContent}
=== END ===

Add more detail to reach AT LEAST 1500 words. Focus on:
- Character inner monologue and emotional responses
- Sensory descriptions of the environment
- Small character actions and gestures
- Extended dialogue where appropriate

Return ONLY the expanded text.`;

              const secondExpansion = await routeTextTask('prose_editing', {
                system: SYSTEM_INSTRUCTION,
                user: secondExpansionPrompt,
                temperature: 0.9,
                maxTokens: 5000,
              });

              if (secondExpansion) {
                const secondWordCount = secondExpansion.split(/\s+/).filter((word: string) => word.length > 0).length;
                if (secondWordCount > wordCount) {
                  result.chapterContent = formatChapterContent(secondExpansion);
                  wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;
                  logger.info('Second expansion completed', 'ai', {
                    finalWordCount: wordCount,
                    meetsMinimum: wordCount >= 1500
                  });
                }
              }
            }
          } else {
            logger.warn('Expansion did not add sufficient content', 'ai', {
              originalWordCount,
              expandedWordCount,
              wordsAdded: expandedWordCount - originalWordCount
            });
          }
        }
      } catch (expansionError) {
        logger.warn('Failed to expand chapter content', 'ai', {
          error: expansionError instanceof Error ? expansionError.message : String(expansionError)
        });
        // Continue with original content if expansion fails
      }
    }
  } else {
    logger.debug('Chapter word count meets requirement', 'ai', {
      wordCount,
      minimum: 1500
    });
  }

  // Post-generation quality check and fixes
  const chapterForQuality: Chapter = {
    id: generateUUID(),
    number: state.chapters.length + 1,
    title: result.chapterTitle || 'Untitled Chapter',
    content: result.chapterContent || '',
    summary: result.chapterSummary || '',
    logicAudit: result.logicAudit,
    scenes: [],
    createdAt: Date.now()
  };

  const qualityReport = await validatePostGeneration(chapterForQuality);

  if (qualityReport.issues.length > 0 && !opts?.skipRegeneration) {
    logger.info('Post-generation quality issues detected', 'ai', {
      issueCount: qualityReport.issues.length,
      overallScore: qualityReport.overallScore,
      needsRegeneration: qualityReport.needsRegeneration
    });

    // Apply quick fixes for minor issues
    if (!qualityReport.needsRegeneration) {
      const fixedChapter = applyQuickFixes(chapterForQuality, qualityReport.issues);
      result.chapterContent = fixedChapter.content;

      logger.info('Applied quick fixes to chapter', 'ai', {
        fixesApplied: qualityReport.issues.length
      });
    }
  }

  // NEW: Critique-Correction Loop - Auto-Critic Agent using Gemini Flash
  // Evaluates the chapter against a Style Rubric and iteratively refines prose quality
  if (CRITIQUE_CORRECTION_CONFIG.enabled && !opts?.skipRegeneration) {
    try {
      opts?.onPhase?.('critique_start', {
        rubricId: 'literary_xianxia', // Default rubric
        rubricName: 'Literary Xianxia',
      });

      logger.info('Starting Critique-Correction Loop', 'critique', {
        chapterTitle: result.chapterTitle,
        wordCount,
      });

      // Determine which rubric to use (default to literary_xianxia)
      // Could be customized per-novel via state.novelStyleConfig in the future
      const rubricId = (state as any).novelStyleConfig?.activeRubricId || 'literary_xianxia';

      const critiqueResult = await applyCritiqueCorrectionLoop(
        result.chapterContent,
        result.chapterTitle || 'Untitled',
        result.chapterSummary || '',
        rubricId,
        {
          onPhase: (phase, data) => {
            // Map critique phases to our phase callbacks
            if (phase === 'critique_evaluation') {
              opts?.onPhase?.('critique_evaluation', data);
            } else if (phase === 'correction_application') {
              opts?.onPhase?.('critique_correction', data);
            } else if (phase === 'loop_complete') {
              opts?.onPhase?.('critique_complete', data);
            }
          },
          onProgress: (message, progress) => {
            logger.debug(message, 'critique', { progress });
          },
          onCritiqueResult: (critique, iteration) => {
            logger.info('Critique iteration result', 'critique', {
              iteration,
              overallScore: critique.overallScore,
              issueCount: critique.issues.length,
              passesThreshold: critique.passesThreshold,
            });
          },
        },
        CRITIQUE_CORRECTION_CONFIG
      );

      // Update chapter content with critique-corrected version
      if (critiqueResult.success && critiqueResult.finalContent !== result.chapterContent) {
        result.chapterContent = critiqueResult.finalContent;

        // Update word count after critique corrections
        wordCount = result.chapterContent.split(/\s+/).filter((word: string) => word.length > 0).length;

        logger.info('Critique-Correction Loop completed successfully', 'critique', {
          iterations: critiqueResult.iterations,
          finalScore: critiqueResult.finalCritique.overallScore,
          threshold: critiqueResult.finalCritique.threshold,
          estimatedCost: `$${critiqueResult.estimatedCost.toFixed(4)}`,
          totalTimeMs: critiqueResult.totalTimeMs,
          wordCountAfter: wordCount,
        });
      } else {
        logger.info('Critique-Correction Loop completed (no changes needed or disabled)', 'critique', {
          iterations: critiqueResult.iterations,
          finalScore: critiqueResult.finalCritique.overallScore,
          passedOnFirstTry: critiqueResult.iterations === 1 && critiqueResult.finalCritique.passesThreshold,
        });
      }

      opts?.onPhase?.('critique_complete', {
        success: critiqueResult.success,
        iterations: critiqueResult.iterations,
        finalScore: critiqueResult.finalCritique.overallScore,
        estimatedCost: critiqueResult.estimatedCost,
      });
    } catch (critiqueError) {
      logger.warn('Critique-Correction Loop failed, continuing without', 'critique', {
        error: critiqueError instanceof Error ? critiqueError.message : String(critiqueError),
      });
      // Continue with original content if critique fails
    }
  }

  // Post-generation quality validation with comprehensive checks
  let finalChapter: Chapter | null = null;
  try {
    const generatedChapter: Chapter = {
      id: generateUUID(),
      number: state.chapters.length + 1,
      title: result.chapterTitle || 'Untitled',
      content: result.chapterContent || '',
      summary: result.chapterSummary || '',
      logicAudit: result.logicAudit,
      scenes: [],
      createdAt: Date.now(),
    };

    finalChapter = generatedChapter;

    // Comprehensive quality validation
    opts?.onPhase?.('post_generation_validation');
    const qualityMetrics = await validateChapterQuality(generatedChapter, state);

    // Enhanced: Save context snapshot
    try {
      const { saveContextSnapshot } = await import('./consistencyIntegrationService');

      // Get entities that were likely in context
      const previousChapter = state.chapters[state.chapters.length - 1];
      const entitiesIncluded = previousChapter
        ? state.characterCodex
          .filter(c => previousChapter.content.slice(-1000).toLowerCase().includes(c.name.toLowerCase()))
          .map(c => c.id)
        : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);

      await saveContextSnapshot(
        state.id,
        generatedChapter.id,
        generatedChapter.number,
        {
          chapterNumber: generatedChapter.number,
          chapterTitle: generatedChapter.title,
          entitiesIncluded
        },
        entitiesIncluded,
        Math.ceil(builtPrompt.userPrompt.length / 4) // Rough token estimate
      );
    } catch (error) {
      console.warn('Failed to save context snapshot:', error);
      // Don't fail generation if snapshot save fails
    }

    opts?.onPhase?.('quality_validation', {
      qualityScore: qualityMetrics.qualityCheck.qualityScore,
      originalityScore: qualityMetrics.originalityScore.overallOriginality,
      narrativeCraftScore: qualityMetrics.narrativeCraftScore.overallCraftScore,
      voiceConsistencyScore: qualityMetrics.voiceConsistencyScore,
      warnings: qualityMetrics.warnings,
      errors: qualityMetrics.qualityCheck.errors,
      suggestions: qualityMetrics.qualityCheck.suggestions,
      shouldRegenerate: qualityMetrics.shouldRegenerate,
    });

    // Check if regeneration is needed (skip if called from within regeneration to prevent infinite loops)
    if (qualityMetrics.shouldRegenerate && QUALITY_CONFIG.enabled && !opts?.skipRegeneration) {
      opts?.onPhase?.('regeneration_start', {
        reasons: qualityMetrics.regenerationReasons,
        attempt: 1,
      });

      try {
        const regenerationResult = await regenerateWithQualityCheck(
          generatedChapter,
          state,
          qualityMetrics,
          QUALITY_CONFIG
        );

        if (regenerationResult.success && regenerationResult.chapter) {
          finalChapter = regenerationResult.chapter;
          opts?.onPhase?.('regeneration_complete', {
            success: true,
            attempts: regenerationResult.attempts,
            finalMetrics: regenerationResult.finalMetrics,
          });

          // Update result with regenerated chapter data
          result.chapterTitle = finalChapter.title;
          result.chapterContent = finalChapter.content;
          result.chapterSummary = finalChapter.summary;
          result.logicAudit = finalChapter.logicAudit;

          logger.info('Successfully regenerated chapter', 'ai', {
            attempts: regenerationResult.attempts,
            originalOriginality: qualityMetrics.originalityScore.overallOriginality,
            finalOriginality: regenerationResult.finalMetrics?.originalityScore.overallOriginality,
          });
        } else {
          opts?.onPhase?.('regeneration_complete', {
            success: false,
            attempts: regenerationResult.attempts,
            reason: 'Regeneration did not improve quality sufficiently',
          });
          logger.warn('Regeneration completed but quality not improved', 'ai', {
            attempts: regenerationResult.attempts,
          });
        }
      } catch (regenerationError) {
        const errorMessage = regenerationError instanceof Error
          ? regenerationError.message || regenerationError.toString() || 'Unknown error'
          : regenerationError
            ? String(regenerationError)
            : 'Unknown error';
        logger.error(
          'Error during regeneration',
          'ai',
          regenerationError instanceof Error ? regenerationError : undefined,
          {
            error: errorMessage,
            stack: regenerationError instanceof Error ? regenerationError.stack : undefined,
          }
        );
        opts?.onPhase?.('regeneration_error', {
          error: errorMessage,
        });
        // Continue with original chapter if regeneration fails
      }
    }

    // Log quality metrics
    if (qualityMetrics.qualityCheck.errors.length > 0) {
      logger.error('Chapter quality validation errors', 'ai', undefined, {
        errors: qualityMetrics.qualityCheck.errors,
      });
    }
    if (qualityMetrics.warnings.length > 0) {
      logger.warn('Chapter quality validation warnings', 'ai', {
        warnings: qualityMetrics.warnings.slice(0, 5),
      });
    }

    // Log quality scores
    logger.debug('Chapter quality metrics', 'ai', {
      originality: qualityMetrics.originalityScore.overallOriginality,
      narrativeCraft: qualityMetrics.narrativeCraftScore.overallCraftScore,
      voiceConsistency: qualityMetrics.voiceConsistencyScore,
    });
  } catch (error) {
    logger.warn('Error in post-generation quality validation', 'ai', {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // NEW: Process Living World event discoveries from generated chapter
  if (livingWorldInjectionContext && livingWorldInjectionContext.eventsToDiscover.length > 0) {
    try {
      const generatedChapter: Chapter = {
        id: generateUUID(),
        number: nextChapterNumber,
        title: result.chapterTitle,
        content: result.chapterContent,
        summary: result.chapterSummary || '',
        logicAudit: result.logicAudit,
        scenes: [],
        createdAt: Date.now(),
      };

      const discoveryResult = processChapterForDiscoveries(
        state.id,
        generatedChapter,
        livingWorldInjectionContext
      );

      if (discoveryResult.discoveredEventIds.length > 0) {
        logger.info('Living World events discovered in chapter', 'generation', {
          discoveredCount: discoveryResult.discoveredEventIds.length,
          remainingUndiscovered: discoveryResult.remainingUndiscovered,
          chapter: nextChapterNumber,
        });
      }
    } catch (discoveryError) {
      logger.warn('Failed to process Living World event discoveries', 'generation', {
        error: discoveryError instanceof Error ? discoveryError.message : String(discoveryError),
      });
    }
  }

  opts?.onPhase?.('parse_end', { parseMs: 0 });

  // Save tension tracking data from Director beat sheet
  if (directorBeatSheet) {
    try {
      const tensionEntry = recordTensionFromBeatSheet(state, directorBeatSheet);
      // The actual state update should be handled by the caller since we don't mutate state here
      // We log the tension data for debugging purposes
      logger.debug('Tension data recorded from beat sheet', 'director', {
        chapterNumber: nextChapterNumber,
        startTension: tensionEntry.startTension,
        endTension: tensionEntry.endTension,
        arcPhase: tensionEntry.arcPhase,
      });

      // Return tension data in the result for the caller to save
      (result as any).tensionData = tensionEntry;
    } catch (tensionError) {
      logger.warn('Failed to record tension data', 'director', {
        error: tensionError instanceof Error ? tensionError.message : String(tensionError),
      });
    }
  }

  // NEW: Extract karma events from generated chapter (Face Graph)
  try {
    const faceConfig = await getFaceGraphConfig(state.id);

    if (faceConfig.enabled && faceConfig.autoExtractKarma) {
      const generatedChapterForKarma: Chapter = {
        id: generateUUID(),
        number: nextChapterNumber,
        title: result.chapterTitle,
        content: result.chapterContent,
        summary: result.chapterSummary || '',
        logicAudit: result.logicAudit,
        scenes: [],
        createdAt: Date.now(),
      };

      // Extract karma asynchronously (don't block return)
      extractKarmaFromChapter(state, generatedChapterForKarma, {
        minSeverity: 'moderate', // Only extract notable events
      }).then(karmaEvents => {
        if (karmaEvents.length > 0) {
          logger.info('Karma events extracted from chapter', 'faceGraph', {
            eventCount: karmaEvents.length,
            chapter: nextChapterNumber,
            events: karmaEvents.map(e => `${e.actorName} ${e.actionType} ${e.targetName}`),
          });
        }
      }).catch(err => {
        logger.warn('Async karma extraction failed', 'faceGraph', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  } catch (karmaError) {
    logger.warn('Failed to initiate karma extraction', 'faceGraph', {
      error: karmaError instanceof Error ? karmaError.message : String(karmaError),
    });
  }

  // NEW: Run Heavenly Loom Clerk audit after chapter generation
  try {
    opts?.onPhase?.('loom_clerk_start');
    const auditStart = Date.now();

    const generatedChapterForLoom: Chapter = {
      id: generateUUID(),
      number: nextChapterNumber,
      title: result.chapterTitle,
      content: result.chapterContent,
      summary: result.chapterSummary || '',
      logicAudit: result.logicAudit,
      scenes: [],
      createdAt: Date.now(),
    };

    const updatedThreads = await runLoomClerkAudit(state, generatedChapterForLoom, {
      enabled: true,
      onPhase: (phase, data) => {
        // Map Loom phases to our phase callbacks
        if (phase === 'loom_clerk_start') {
          opts?.onPhase?.('loom_clerk_start', data);
        } else if (phase === 'loom_clerk_complete') {
          opts?.onPhase?.('loom_clerk_complete', data);
        }
      },
    });

    if (updatedThreads.length > 0) {
      // Include updated threads in result for caller to save
      (result as any).loomThreadUpdates = updatedThreads;

      logger.info('Heavenly Loom Clerk audit completed', 'loom', {
        threadsUpdated: updatedThreads.length,
        durationMs: Date.now() - auditStart,
      });
    }

    opts?.onPhase?.('loom_clerk_complete', {
      threadsUpdated: updatedThreads.length,
      durationMs: Date.now() - auditStart,
    });
  } catch (loomAuditError) {
    logger.warn('Heavenly Loom Clerk audit failed, continuing without', 'loom', {
      error: loomAuditError instanceof Error ? loomAuditError.message : String(loomAuditError),
    });
  }

  return result;
};

export type PostChapterExtraction = {
  characterUpserts: Array<{
    name: string;
    isNew?: boolean;
    set?: {
      age?: string;
      personality?: string;
      currentCultivation?: string;
      notes?: string;
      status?: string;
      appearance?: string;
      background?: string;
      goals?: string[];
      flaws?: string[];
    };
    addSkills?: string[]; // @deprecated - Use techniqueUpdates instead
    addItems?: string[]; // @deprecated - Use itemUpdates instead
    relationships?: Array<{
      targetName: string;
      type: string;
      history?: string;
      impact?: string;
    }>;
  }>;
  worldEntryUpserts: Array<{
    title: string;
    category: string;
    content: string;
  }>;
  territoryUpserts: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  itemUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    itemId?: string; // If updating existing
    category: 'Treasure' | 'Equipment' | 'Consumable' | 'Essential';
    description?: string;
    addPowers?: string[];
    characterName: string; // Which character possesses it
  }>;
  techniqueUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    techniqueId?: string; // If updating existing
    category: 'Core' | 'Important' | 'Standard' | 'Basic';
    type: 'Cultivation' | 'Combat' | 'Support' | 'Secret' | 'Other';
    description?: string;
    addFunctions?: string[];
    characterName: string;
    masteryLevel?: string;
  }>;
  scenes: Array<{
    number: number;
    title: string;
    summary: string;
    contentExcerpt: string; // First ~500 chars of scene content
  }>;
  arcChecklistProgress: {
    arcId: string | null;
    completedItemIds: string[];
    notes?: string;
  } | null;
  antagonistUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    antagonistId?: string; // If updating existing
    type: 'individual' | 'group' | 'system' | 'society' | 'abstract';
    description?: string;
    motivation?: string;
    powerLevel?: string;
    status: 'active' | 'defeated' | 'transformed' | 'dormant' | 'hinted';
    threatLevel: 'low' | 'medium' | 'high' | 'extreme';
    durationScope: 'chapter' | 'arc' | 'novel' | 'multi_arc';
    presenceType?: 'direct' | 'mentioned' | 'hinted' | 'influence';
    significance?: 'major' | 'minor' | 'foreshadowing';
    relationshipWithProtagonist?: {
      relationshipType: 'primary_target' | 'secondary_target' | 'ally_of_antagonist' | 'neutral';
      intensity: 'rival' | 'enemy' | 'nemesis' | 'opposition';
    };
    arcRole?: 'primary' | 'secondary' | 'background' | 'hinted';
    notes?: string;
  }>;
  systemUpdates?: Array<{
    name: string;
    action: 'create' | 'update';
    systemId?: string; // If updating existing
    characterName: string; // The protagonist who owns this system
    type?: 'cultivation' | 'game' | 'cheat' | 'ability' | 'interface' | 'evolution' | 'other';
    category?: 'core' | 'support' | 'evolution' | 'utility' | 'combat' | 'passive';
    description?: string;
    currentLevel?: string;
    currentVersion?: string;
    status?: 'active' | 'dormant' | 'upgraded' | 'merged' | 'deactivated';
    addFeatures?: string[]; // New features discovered/added
    upgradeFeatures?: string[]; // Features that were upgraded
    presenceType?: 'direct' | 'mentioned' | 'hinted' | 'used';
    significance?: 'major' | 'minor' | 'foreshadowing';
    notes?: string;
  }>;
  threadUpdates?: Array<{
    title: string;
    type: 'enemy' | 'technique' | 'item' | 'location' | 'sect' | 'promise' | 'mystery' | 'relationship' | 'power' | 'quest' | 'revelation' | 'conflict' | 'alliance';
    action: 'create' | 'update' | 'resolve';
    threadId?: string; // If updating existing
    description?: string;
    priority?: 'critical' | 'high' | 'medium' | 'low';
    status?: 'active' | 'paused' | 'resolved' | 'abandoned';
    eventType: 'introduced' | 'progressed' | 'resolved' | 'hinted';
    eventDescription: string;
    significance: 'major' | 'minor' | 'foreshadowing';
    relatedEntityName?: string; // Name of related character/item/etc
    relatedEntityType?: string;
    resolutionNotes?: string; // If resolving
    satisfactionScore?: number; // If resolving (0-100)
  }>;
};

export const extractPostChapterUpdates = async (
  state: NovelState,
  newChapter: Chapter,
  activeArc: Arc | null
): Promise<PostChapterExtraction> => {
  try {
    // always use enhanced extraction prompt for better results
    const systemPrompt =
      `You are a meticulous narrative analyst tasked with extracting structured data from a chapter of a cultivation fantasy novel.

CRITICAL OBJECTIVE: The Novel's Codex must be kept in perfect sync with the narrative. You must extract EVERY significant entity, update, and plot thread.

Your extraction targets:

1. **CHARACTERS (High Priority)**:
   - Identify ALL characters mentioned, whether by name, title (e.g., "Elder Zhang"), or role.
   - For NEW characters: Extract appearance, personality, cultivation level, and background.
   - For EXISTING characters: track ANY changes in status, cultivation, location, or relationships.
   - **Relationships**: Link characters together (friends, enemies, family, mentors).

2. **STORY THREADS & PLOT**:
   - Track ongoing plot lines (Conflicts, Mysteries, Promises, Quests).
   - Update the status of existing threads (progressed, resolved).
   - Create NEW threads for new plot points introduced.

3. **WORLD BUILDING**:
   - New locations (Territories), organizations (Sects), or history.
   - Laws of the world or power systems.

4. **ITEMS & TECHNIQUES**:
   - New treasures or weapons found/used.
   - New martial arts or spells (Techniques) learned or displayed.
   - Track who possesses/masters them.

5. **ANTAGONISTS**:
   - Identify threats, their power levels, and motivations.

Be EXTREMELY THOROUGH. If a character is mentioned by name, they should likely be in the Codex. If a named move is used, it should be a Technique.`;

    // Build context from existing state
    const characterContext = state.characterCodex.map(char =>
      `- ${char.name} (${char.currentCultivation || 'Unknown cultivation'}, ${char.status})`
    ).join('\n');

    const itemsContext = state.novelItems?.map(item =>
      `- ${item.name} (${item.category})`
    ).join('\n') || 'No items recorded yet.';

    const techniquesContext = state.novelTechniques?.map(tech =>
      `- ${tech.name} (${tech.category} - ${tech.type})`
    ).join('\n') || 'No techniques recorded yet.';

    const arcContext = activeArc ?
      `Current Arc: ${activeArc.title}\nArc Checklist: ${activeArc.checklist?.map(item => `- ${item.id}: ${item.completed ? '✅' : '❌'}`).join('\n') || 'No checklist items'}` :
      'No active arc.';

    const userPrompt = `CHAPTER ${newChapter.number}: ${newChapter.title}

${newChapter.content || newChapter.summary || ''}

---

EXISTING CONTEXT:

CHARACTERS:
${characterContext}

ITEMS:
${itemsContext}

TECHNIQUES:
${techniquesContext}

${arcContext}

---

Extract all updates from this chapter. Return ONLY a JSON object with this exact structure:

{
  "characterUpserts": [
    {
      "name": "Character Name",
      "isNew": false,
      "set": {
        "age": "Updated age if changed",
        "personality": "Updated personality if changed", 
        "currentCultivation": "Updated cultivation if changed",
        "status": "Alive/Deceased/Unknown",
        "appearance": "Physical description if new/changed",
        "background": "Background info if new/changed",
        "goals": "Goals if new/changed",
        "flaws": "Flaws if new/changed",
        "notes": "General notes about character"
      },
      "relationships": [
        {
          "targetName": "Other Character Name",
          "type": "relationship type (friend, enemy, mentor, etc)",
          "history": "How this relationship developed",
          "impact": "Impact on the story"
        }
      ]
    }
  ],
  "worldEntryUpserts": [
    {
      "title": "Entry Title",
      "category": "Geography/Sects/PowerLevels/Laws/Systems/Techniques/Other",
      "content": "Detailed description"
    }
  ],
  "territoryUpserts": [
    {
      "name": "Territory Name",
      "type": "Empire/Kingdom/Neutral/Hidden", 
      "description": "Description of the territory"
    }
  ],
  "itemUpdates": [
    {
      "name": "Item Name",
      "action": "create/update",
      "category": "Treasure/Equipment/Consumable/Essential",
      "description": "Item description",
      "addPowers": ["Power 1", "Power 2"],
      "characterName": "Character who possesses it"
    }
  ],
  "techniqueUpdates": [
    {
      "name": "Technique Name",
      "action": "create/update", 
      "category": "Core/Important/Standard/Basic",
      "type": "Cultivation/Combat/Support/Secret/Other",
      "description": "Technique description",
      "addFunctions": ["Function 1", "Function 2"],
      "characterName": "Character who uses it",
      "masteryLevel": "Novice/Intermediate/Advanced/Master"
    }
  ],
  "scenes": [
    {
      "number": 1,
      "title": "Scene Title",
      "summary": "Brief summary of what happens",
      "contentExcerpt": "First 500 characters of scene content"
    }
  ],
  "arcChecklistProgress": {
    "arcId": ${activeArc ? `"${activeArc.id}"` : 'null'},
    "completedItemIds": ["id1", "id2"],
    "notes": "Notes about arc progress"
  },
  "antagonistUpdates": [
    {
      "name": "Antagonist Name",
      "action": "create/update",
      "type": "individual/group/system/society/abstract",
      "description": "Description of antagonist",
      "motivation": "Their motivation",
      "powerLevel": "Power level description",
      "status": "active/defeated/transformed/dormant/hinted",
      "threatLevel": "low/medium/high/extreme",
      "durationScope": "chapter/arc/novel/multi_arc",
      "relationshipWithProtagonist": {
        "relationshipType": "primary_target/secondary_target/ally_of_antagonist/neutral",
        "intensity": "rival/enemy/nemesis/opposition"
      },
      "arcRole": "primary/secondary/background/hinted",
      "notes": "Additional notes"
    }
  ],
  "threadUpdates": [
    {
      "title": "Thread Title",
      "type": "enemy/technique/item/location/sect/promise/mystery/relationship/power/quest/revelation/conflict/alliance",
      "action": "create/update/resolve",
      "description": "Thread description",
      "priority": "critical/high/medium/low",
      "status": "active/paused/resolved/abandoned",
      "eventType": "introduced/progressed/resolved/hinted",
      "eventDescription": "What happened to this thread",
      "significance": "major/minor/foreshadowing",
      "relatedEntityName": "Related character/item/etc",
      "relatedEntityType": "Character/Item/Technique/etc"
    }
  ]
}

IMPORTANT: 
- Only include information explicitly mentioned in the chapter
- For empty arrays, return [] not null
- If no changes for a section, return an empty object/array as appropriate
- Do not invent details or make assumptions beyond what's in the text`;

    // Use the model orchestrator to call Gemini for extraction
    const result = await routeJsonTask<PostChapterExtraction>('metadata_extraction', {
      system: systemPrompt,
      user: userPrompt,
      temperature: 0.3, // Lower temperature for more consistent extraction
      maxTokens: 8192, // Allow for large responses
    });

    // Log what was extracted for debugging
    console.log(`[extractPostChapterUpdates] Chapter ${newChapter.number} extraction results:`, {
      characterUpserts: result.characterUpserts?.length || 0,
      worldEntryUpserts: result.worldEntryUpserts?.length || 0,
      territoryUpserts: result.territoryUpserts?.length || 0,
      itemUpdates: result.itemUpdates?.length || 0,
      techniqueUpdates: result.techniqueUpdates?.length || 0,
      scenes: result.scenes?.length || 0,
      antagonistUpdates: result.antagonistUpdates?.length || 0,
      threadUpdates: result.threadUpdates?.length || 0,
      arcChecklistProgress: result.arcChecklistProgress?.completedItemIds?.length || 0
    });

    if (result.characterUpserts && result.characterUpserts.length > 0) {
      console.log(`[extractPostChapterUpdates] Character updates:`, result.characterUpserts.map(u => ({ name: u.name, isNew: u.isNew, relationships: u.relationships?.length || 0 })));
    }

    return result;
  } catch (error) {
    logger.error('Post-chapter extraction failed; returning empty extraction', 'ai',
      error instanceof Error ? error : new Error(String(error)),
      {
        chapterId: newChapter.id,
      }
    );

    return {
      characterUpserts: [],
      worldEntryUpserts: [],
      territoryUpserts: [],
      itemUpdates: [],
      techniqueUpdates: [],
      scenes: [],
      arcChecklistProgress: null,
      antagonistUpdates: [],
      systemUpdates: [],
      threadUpdates: [],
    };
  }
};

export const planArc = async (state: NovelState) => {
  const builtPrompt = await buildArcPrompt(state);

  return rateLimiter.queueRequest(
    'plan',
    async () =>
      routeJsonTask<{ arcTitle: string; arcDescription: string; targetChapters?: number }>('arc_planning', {
        system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
        user:
          builtPrompt.userPrompt +
          '\n\nReturn ONLY a JSON object with this shape:\n' +
          '{"arcTitle": string, "arcDescription": string, "targetChapters": number (optional, optimal number of chapters for this arc based on complexity and scope, range 5-30)}',
      }),
    `plan-arc-${state.id}`
  );
};

export const editChapter = async (
  chapterContent: string,
  instruction: string,
  state: NovelState,
  chapter: Chapter
) => {
  if (!instruction || instruction.trim().length === 0) return chapterContent;

  try {
    const builtPrompt = await buildEditPrompt(state, chapter, instruction);

    // Truncate very long chapters before sending.
    let contentToSend = chapterContent;
    if (chapterContent.length > 10000) {
      const firstPart = chapterContent.substring(0, 4000);
      const lastPart = chapterContent.substring(chapterContent.length - 2000);
      contentToSend = `${firstPart}\n\n[... middle section omitted for token efficiency ...]\n\n${lastPart}`;
    } else if (chapterContent.length > 5000) {
      const firstPart = chapterContent.substring(0, 3000);
      const lastPart = chapterContent.substring(chapterContent.length - 1500);
      contentToSend = `${firstPart}\n\n[... middle section ...]\n\n${lastPart}`;
    }

    const fullPrompt = `${builtPrompt.userPrompt}\n\n[CHAPTER CONTENT TO EDIT]\n${contentToSend}`;

    const result = await rateLimiter.queueRequest(
      'edit',
      async () =>
        (await routeTextTask('prose_editing', {
          system: builtPrompt.systemInstruction || SYSTEM_INSTRUCTION,
          user: fullPrompt,
          // AI Detection Evasion: Higher temperature for editing to catch and fix any remaining AI-like patterns
          temperature: 1.0, // Claude API maximum is 1.0 (temperature and topP cannot both be specified)
        })) || chapterContent,
      `edit-${chapter.id}-${instruction.substring(0, 30)}`
    );

    // CRITICAL: Validate and extract plain text content (not JSON)
    if (!result || typeof result !== 'string') {
      console.error('[Edit] Invalid result type:', typeof result);
      return chapterContent;
    }

    // Check if result is accidentally JSON and extract plain text
    if (isJsonChapterContent(result)) {
      console.warn('[Edit] Detected JSON in edit result, extracting actual content');
      const extracted = extractChapterContent(result);
      if (extracted) {
        return extracted;
      } else {
        console.error('[Edit] Failed to extract chapter content from JSON');
        return chapterContent; // Return original on failure
      }
    }

    return result;
  } catch (error) {
    logger.error('Error in editChapter', 'ai', error instanceof Error ? error : new Error(String(error)));
    if (error instanceof AppError) {
      throw error;
    }
    // For edit operations, return original content on error to allow user to continue
    throw new AppError(
      formatErrorMessage(error) || 'Failed to edit chapter',
      'EDIT_ERROR',
      undefined,
      true
    );
  }
};

// Portrait generation and TTS features use Grok for all AI operations

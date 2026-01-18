import type { Arc, ArcChecklistItem, Character, Chapter, NovelState, LogicAudit } from '../types';
import { SYSTEM_INSTRUCTION, QUALITY_CONFIG } from '../constants';
import { getStoredLlm, type LlmId } from '../contexts/LlmContext';
import { getStoredChapterGenerationModel } from '../contexts/ChapterGenerationModelContext';
import { rateLimiter } from './rateLimiter';
import { routeTextTask, routeJsonTask } from './modelOrchestrator';
import { buildArcPrompt } from './promptEngine/writers/arcPromptWriter';
import { buildChapterPrompt } from './promptEngine/writers/chapterPromptWriter';
import { buildEditPrompt } from './promptEngine/writers/editPromptWriter';
import { buildExpansionPrompt } from './promptEngine/writers/expansionPromptWriter';
import { formatChapterContent } from '../utils/chapterFormatter';
import { validateChapterGenerationQuality, validateChapterQuality } from './chapterQualityValidator';
import { AppError, formatErrorMessage } from '../utils/errorHandling';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';
import { regenerateWithQualityCheck } from './chapterRegenerationService';
import { isJsonChapterContent, extractChapterContent } from '../utils/chapterContentRepair';
import { generateChapterWarnings, logChapterGenerationReport } from './chapterGenerationWarningService';

// Legacy function kept for backward compatibility but no longer used for model selection
// Models are now selected automatically via the orchestrator based on task type
export function getActiveLlm(): LlmId {
  // Stored in localStorage by LlmProvider.
  try {
    return getStoredLlm();
  } catch {
    return 'grok-4-1-fast-reasoning';
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
  return trimmed.slice(0, maxChars) + '\n\n[... truncated ...]';
}

export type ChapterGenPhase =
  | 'quality_check'
  | 'quality_validation'
  | 'post_generation_validation'
  | 'regeneration_start'
  | 'regeneration_complete'
  | 'regeneration_error'
  | 'prompt_build_start'
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
export const generateNextChapter = async (
  state: NovelState,
  userInstruction: string = '',
  opts?: {
    onPhase?: (phase: ChapterGenPhase, data?: Record<string, unknown>) => void;
    skipRegeneration?: boolean; // Set to true when called from regeneration to prevent infinite loops
  }
) => {

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
  
  if (qualityCheck.suggestions.length > 0) {
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

  opts?.onPhase?.('prompt_build_start');
  const promptStart = Date.now();
  // Get the selected chapter generation model from storage early to pass to prompt builder
  const selectedModel = getStoredChapterGenerationModel();
  let builtPrompt = await buildChapterPrompt(state, userInstruction, selectedModel);
  
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
        '"characterUpdates":[{"name":string,"updateType":string,"newValue":string,"targetName":string}],' +
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
        // Use 5-minute default TTL (can be changed to '1h' for 1-hour cache)
        // Grok: Uses automatic prefix caching (TTL parameter is for compatibility/structure)
        cacheTtl: '5m',
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
      onFinished: () => {},
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
  
  opts?.onPhase?.('parse_end', { parseMs: 0 });

  return result;
};

export type PostChapterExtraction = {
  characterUpserts: Array<{
    name: string;
    isNew?: boolean;
    set?: Partial<Pick<Character, 'age' | 'personality' | 'currentCultivation' | 'notes' | 'status' | 'appearance' | 'background' | 'goals' | 'flaws'>>;
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

  const safeChecklist: ArcChecklistItem[] = activeArc?.checklist || [];

  const prompt = `
You are the "Omniscient System Clerk" for a Xianxia/Fantasy novel writing tool.

TASK:
Given the latest generated chapter, produce structured UPDATES that should be merged into:
1) Character Codex
2) World Bible
3) Territories
4) Items and Techniques (with smart deduplication)
5) Antagonists (opponents, threats, conflicts - with smart recognition)
6) Scenes (break the chapter into logical scenes)
7) Active Arc progress checklist

CRITICAL RULES:
- Prefer UPDATING existing entities rather than creating duplicates.
- For items/techniques: CHECK if an item/technique already exists before creating a new entry. Use fuzzy matching (e.g., "Jade Slip", "jade slip", "Jade-Slip" refer to the same item).
- If an item/technique exists but has new powers/functions, use "update" action with addPowers/addFunctions.
- When unsure, be conservative (fewer, higher-quality updates).
- Return ONLY valid JSON that matches the schema below. No markdown.

ACTIVE ARC:
${activeArc ? `- id: ${activeArc.id}\n- title: ${activeArc.title}\n- description: ${truncateForExtraction(activeArc.description || '', 500)}\n- checklistItems: ${safeChecklist.map(i => `${i.id}::${i.label}::${i.completed ? 'completed' : 'open'}`).join(' | ')}` : 'None'}

LATEST CHAPTER:
- number: ${newChapter.number}
- title: ${newChapter.title}
- summary: ${truncateForExtraction(newChapter.summary || '', 1200)}
- content: ${truncateForExtraction(newChapter.content || '', 15000)}

IMPORTANT: Pay special attention to plot-critical character developments:
- If the chapter reveals a character is reincarnated/transmigrated (has memories from past life, was reborn, soul transfer, etc.), this MUST be added to their "background" field
- If the chapter reveals a character possesses or discovers a system (cheat ability, game interface, special power system, etc.), this MUST be added to their "notes" field
- These are critical plot points that should ALWAYS be extracted, even if the character only appears briefly in the chapter

EXISTING CHARACTERS (names + key fields):
${state.characterCodex
  .slice(0, 80)
  .map(c => `- ${c.name} | cultivation=${truncateForExtraction(c.currentCultivation || '', 40)} | status=${c.status} | appearance=${truncateForExtraction(c.appearance || '', 60)} | goals=${truncateForExtraction(c.goals || '', 60)} | flaws=${truncateForExtraction(c.flaws || '', 60)} | notes=${truncateForExtraction(c.notes || '', 120)}`)
  .join('\n')}

EXISTING WORLD BIBLE TITLES:
${state.worldBible
  .slice(0, 120)
  .map(w => `- [${w.category}] ${w.title}`)
  .join('\n')}

EXISTING TERRITORIES:
${state.territories
  .slice(0, 120)
  .map(t => `- ${t.name} (${t.type})`)
  .join('\n')}

EXISTING ITEMS (canonical names for deduplication):
${state.novelItems && state.novelItems.length > 0
  ? state.novelItems
      .slice(0, 100)
      .map(item => `- ${item.name} (${item.category}) | powers: ${item.powers.slice(0, 3).join(', ')}`)
      .join('\n')
  : 'None'}

EXISTING TECHNIQUES (canonical names for deduplication):
${state.novelTechniques && state.novelTechniques.length > 0
  ? state.novelTechniques
      .slice(0, 100)
      .map(tech => `- ${tech.name} (${tech.category} ${tech.type}) | functions: ${tech.functions.slice(0, 3).join(', ')}`)
      .join('\n')
  : 'None'}

EXISTING ANTAGONISTS (for recognition and updates):
${state.antagonists && state.antagonists.length > 0
  ? state.antagonists
      .slice(0, 50)
      .map(ant => `- ${ant.name} (${ant.type}, ${ant.status}, ${ant.threatLevel} threat) | ${ant.motivation ? `motivation: ${ant.motivation.substring(0, 60)}` : ''}`)
      .join('\n')
  : 'None'}

EXISTING CHARACTER SYSTEMS (for recognition and updates):
${state.characterSystems && state.characterSystems.length > 0
  ? state.characterSystems
      .slice(0, 50)
      .map(sys => `- ${sys.name} (${sys.type}, ${sys.category}, ${sys.status}) | ${sys.description ? `description: ${sys.description.substring(0, 60)}` : ''} | Features: ${sys.features.length}`)
      .join('\n')
  : 'None'}

⚠️ EXISTING STORY THREADS (CRITICAL - Match progressions to these existing threads):
${state.storyThreads && state.storyThreads.length > 0
  ? state.storyThreads
      .filter(t => t.status === 'active')
      .slice(0, 30)
      .map(thread => `- "${thread.title}" (${thread.type}, ${thread.priority} priority, last ch.${thread.lastUpdatedChapter}) | ${thread.description ? thread.description.substring(0, 80) : 'No description'}`)
      .join('\n')
  : 'None'}
${state.storyThreads && state.storyThreads.filter(t => t.status === 'active').length > 30 ? `... and ${state.storyThreads.filter(t => t.status === 'active').length - 30} more active threads` : ''}

CRITICAL THREAD MATCHING INSTRUCTIONS:
- When the chapter references ANY of the above active threads, you MUST include it in threadUpdates with action="update"
- Use the EXACT thread title from the list above for matching
- If a thread is mentioned, referenced, or progressed in ANY way, report it as "progressed" with eventType="progressed"
- Even minor references or mentions count as progression - include them
- If you see content related to an existing thread but with a slightly different name, match it to the existing thread
- Priority should be to UPDATE existing threads rather than creating new ones

ITEM CATEGORIZATION GUIDE:
- Treasure: Magical artifacts, powerful items with special properties (e.g., "Jade Slip", "Sword of Heaven", "Phoenix Feather")
- Equipment: Tools, weapons, armor, regular items (e.g., "Iron Sword", "Cultivation Robes", "Storage Ring")
- Consumable: Food, pills, talismans, one-time use items (e.g., "Healing Pill", "Spirit Fruit", "Escape Talisman")
- Essential: Basic necessities, mundane items (e.g., "dried meat", "water skin", "torch", "rope")

TECHNIQUE CATEGORIZATION GUIDE:
- Category (importance):
  * Core: Fundamental cultivation methods, signature moves, main techniques (e.g., "Nine Heavens Divine Art", "Phoenix Rebirth Technique")
  * Important: Significant abilities, key skills (e.g., "Wind Sword Art", "Spirit Sense")
  * Standard: Common techniques, widely used (e.g., "Basic Sword Art", "Energy Gathering")
  * Basic: Entry-level skills (e.g., "Qi Circulation", "Meditation")
- Type (function):
  * Cultivation: Methods for advancing cultivation realm
  * Combat: Battle techniques, attacks, defenses
  * Support: Healing, buffs, utility abilities
  * Secret: Hidden techniques, forbidden arts
  * Other: Miscellaneous techniques

ITEMS/TECHNIQUES UPDATE LOGIC:
- If item/technique name matches existing (fuzzy match): use "update" action with addPowers/addFunctions
- If item/technique is completely new: use "create" action with full details
- CRITICAL: EVERY itemUpdate MUST include "characterName" (the exact name of the character who possesses it)
- CRITICAL: EVERY techniqueUpdate MUST include "characterName" (the exact name of the character who masters it)
- Always include category and characterName
- For techniques: include type and masteryLevel (e.g., "Novice", "Intermediate", "Expert", "Master")
- If an item/technique appears in the chapter but no specific character is mentioned, omit it from itemUpdates/techniqueUpdates

ANTAGONIST EXTRACTION GUIDELINES:
- Identify ANY opposing forces, threats, or conflicts mentioned or hinted at in the chapter
- Check existing antagonists list FIRST - if an antagonist already exists, use "update" action
- Types: individual (single person), group (organization/faction), system (laws/rules), society (cultural), abstract (concept/force)
- Status: active (currently opposing), defeated (resolved), transformed (changed role), dormant (inactive but relevant), hinted (foreshadowed)
- Threat Level: low (minor obstacle), medium (significant challenge), high (major threat), extreme (existential danger)
- Duration Scope: chapter (single chapter), arc (one story arc), novel (entire novel), multi_arc (multiple arcs but not entire novel)
- For new antagonists: provide description, motivation, power level, and threat assessment
- For existing antagonists appearing: update status, power level if changed, and add chapter appearance notes
- Presence Type: direct (physically present), mentioned (referenced), hinted (subtle foreshadowing), influence (affecting events indirectly)
- Significance: major (primary conflict), minor (secondary), foreshadowing (future threat)
- If antagonist is related to protagonist: specify relationshipWithProtagonist with type and intensity
- If active arc exists: specify arcRole (primary, secondary, background, hinted)

CHARACTER INFORMATION EXTRACTION GUIDELINES:
CRITICAL: You MUST extract character updates from the ENTIRE chapter content, not just the beginning. Scan through all sections systematically.

- Update ALL character information fields when they appear or change ANYWHERE in the chapter:
  * appearance: Physical description, visible changes (wounds, transformations, new features, clothing changes)
  * background: Origin story updates, new backstory revelations, past events mentioned
  * goals: Shifting motivations, new objectives, changed desires, character aspirations
  * flaws: Revealed weaknesses, character defects shown, vulnerabilities exposed, character limitations
  * currentCultivation: Realm/level changes, breakthroughs, cultivation progress (e.g., "Second Level of Qi Condensation", "Foundation Establishment")
  * personality: Notable personality shifts, character development, behavioral changes
  * age: Time passage if mentioned (e.g., "years later", "aged significantly")
  * status: Life/death changes, significant state changes (Alive/Deceased/Unknown)
  * notes: Special abilities, systems, unique traits, plot-critical information discovered in the chapter
- Extract information even if character appears briefly - update what you can detect
- MANDATORY: For EVERY character mentioned in the chapter, check if they appear in the existing character list and update their information if any details changed
- MANDATORY: Include character updates in "characterUpserts" even if the character only appears in one sentence - any new information should be extracted
- For realm/cultivation progression: Capture exact realm names and levels as stated in the chapter
- For appearance: Update when character's physical description changes or new details are revealed
- For background: Add new revelations to existing background information, ESPECIALLY reincarnation/transmigration events, origin story revelations, and major backstory discoveries
- For goals: Update when character's objectives or motivations shift
- For flaws: Update when character weaknesses or limitations are shown or revealed
- CRITICAL: For plot-critical character discoveries, ALWAYS update character fields:
  * Reincarnation/Transmigration: If a character is revealed to be reincarnated or has memories from a past life, add this to "background" field with details about their previous identity and the reincarnation event
  * Special Abilities: Any unique powers, cheat abilities, or special traits revealed should be added to "notes" field
  * Origin Revelations: Major revelations about character origin, true identity, or hidden past should be added to "background" field
- When in doubt about where information belongs: Use "background" for past/origin information, and "notes" for current abilities/systems/traits

CHARACTER SYSTEM EXTRACTION GUIDELINES:
- Identify ANY systems that help the main character (cultivation systems, game interfaces, cheat abilities, special powers, etc.)
- Check existing systems list FIRST - if a system already exists, use "update" action
- Types: cultivation (cultivation technique system), game (game-like interface), cheat (cheat ability), ability (special ability), interface (UI system), evolution (evolution system), other
- Categories: core (main/essential system), support (supporting system), evolution (growth/progression system), utility (utility features), combat (combat-related), passive (passive abilities)
- Status: active (currently in use), dormant (inactive but available), upgraded (recently enhanced), merged (combined with another system), deactivated (no longer functional)
- CRITICAL: EVERY systemUpdate MUST include "characterName" (the exact name of the protagonist who owns this system)
- For NEW systems: use "create" action with name, type, category, description, characterName
- For EXISTING systems: use "update" action with systemId or matching name
- Track feature discovery: If new features/abilities are discovered, add them to "addFeatures" array
- Track feature upgrades: If existing features are upgraded/improved, add them to "upgradeFeatures" array
- Track level/version changes: If system level or version changes, include in currentLevel/currentVersion
- Presence Type: direct (system actively used), mentioned (referenced), hinted (subtle mention), used (features used but system not explicitly mentioned)
- Significance: major (significant system activity), minor (minor usage), foreshadowing (hint of future system use)
- Extract system information when:
  * A character discovers/activates a system
  * A system's interface appears or is described
  * New features/abilities are unlocked
  * Existing features are upgraded or improved
  * System level/version increases
  * System merges with another system or transforms

SCENE BREAKDOWN INSTRUCTIONS:
- Break the chapter into 2-5 logical scenes based on location shifts, time jumps, or major plot beats.
- Each scene should have: a clear title, a brief summary, and the first ~500 characters of that scene's content from the chapter.
- Scenes should be numbered sequentially starting from 1.

STORY THREAD EXTRACTION GUIDELINES (CRITICAL FOR STORY HEALTH):
⚠️ Thread progression is CRITICAL for story health. Chapters without thread updates indicate stagnation.
⚠️ ALWAYS check the "EXISTING STORY THREADS" list above FIRST before creating new threads.
⚠️ When chapter content relates to an existing thread, use action="update" with the exact title from the existing threads list.

- Identify narrative threads that are introduced, progressed, or resolved in this chapter
- Thread types:
  * enemy: Antagonist/opposition threads (rivalries, conflicts with enemies)
  * technique: Technique-related threads (learning/mastering techniques, technique evolution)
  * item: Item-related threads (powerful items, artifacts, treasures with ongoing significance)
  * location: Territory/location threads (places of importance, locations with ongoing plot relevance)
  * sect: Sect/organization threads (sect politics, organization conflicts, sect relationships)
  * promise: Character promises that need fulfillment (vows, commitments, agreements between characters)
  * mystery: Mysteries that need solving (unsolved questions, hidden truths, unexplained events)
  * relationship: Relationship threads between characters (romance, friendship, rivalry, family bonds)
  * power: Power progression/cultivation threads (realm breakthroughs, cultivation goals, power scaling)
  * quest: Quests or missions (objectives, tasks, goals that need completion)
  * revelation: Secrets/revelations that need revealing (hidden identities, backstories, plot twists)
  * conflict: Ongoing conflicts that need resolution (disputes, wars, tensions between groups)
  * alliance: Alliances/partnerships that form/break (temporary alliances, betrayals, partnerships)
- For NEW threads: use action "create" with eventType "introduced"
- For EXISTING threads: use action "update" with eventType "progressed" or "resolved"
- Link threads to related entities when possible (character names, item names, technique names, location names, sect names)
- Priority levels: critical (must address soon), high (important), medium (standard), low (background)
- Significance: major (significant development), minor (small update), foreshadowing (hint for future)
- When resolving a thread: include resolutionNotes and satisfactionScore (0-100)
- Thread titles should be descriptive and specific (e.g., "The Jade Slip's Hidden Power", "Rivalry with Elder Zhang", "Mystery of the Ancient Sect", "Promise to Find the Lost Artifact", "Revelation of Protagonist's True Identity")
- IMPORTANT: Extract ALL significant narrative threads, not just obvious ones. Look for:
  * Character promises or commitments mentioned
  * Mysteries or unanswered questions introduced
  * Relationship developments or changes
  * Power progression milestones or goals
  * Quests or missions assigned
  * Secrets hinted at or partially revealed
  * Conflicts that emerge or escalate
  * Alliances that form or break

Return ONLY a JSON object with this exact shape:
{
  "characterUpserts": [
    {
      "name": string,
      "isNew": boolean (optional),
      "set": { "age"?: string, "personality"?: string, "currentCultivation"?: string, "notes"?: string, "status"?: "Alive"|"Deceased"|"Unknown", "appearance"?: string, "background"?: string, "goals"?: string, "flaws"?: string } (optional),
      "addSkills": string[] (optional),
      "addItems": string[] (optional),
      "relationships": [
        { "targetName": string, "type": string, "history"?: string, "impact"?: string }
      ] (optional)
    }
  ],
  "worldEntryUpserts": [
    { "title": string, "category": string, "content": string }
  ],
  "territoryUpserts": [
    { "name": string, "type": string, "description": string }
  ],
  "itemUpdates": [
    { 
      "name": string, 
      "action": "create"|"update", 
      "itemId": string (optional, if updating existing),
      "category": "Treasure"|"Equipment"|"Consumable"|"Essential",
      "description": string (optional),
      "addPowers": string[] (optional, new abilities discovered),
      "characterName": string
    }
  ] (optional),
  "techniqueUpdates": [
    {
      "name": string,
      "action": "create"|"update",
      "techniqueId": string (optional, if updating existing),
      "category": "Core"|"Important"|"Standard"|"Basic",
      "type": "Cultivation"|"Combat"|"Support"|"Secret"|"Other",
      "description": string (optional),
      "addFunctions": string[] (optional, new abilities discovered),
      "characterName": string,
      "masteryLevel": string (optional, e.g., "Novice", "Expert", "Master")
    }
  ] (optional),
  "scenes": [
    { "number": number (1-based), "title": string, "summary": string, "contentExcerpt": string }
  ],
  "arcChecklistProgress": {
    "arcId": string|null,
    "completedItemIds": string[],
    "notes": string (optional)
  } | null,
  "antagonistUpdates": [
    {
      "name": string,
      "action": "create"|"update",
      "antagonistId": string (optional, if updating existing),
      "type": "individual"|"group"|"system"|"society"|"abstract",
      "description": string (optional),
      "motivation": string (optional),
      "powerLevel": string (optional),
      "status": "active"|"defeated"|"transformed"|"dormant"|"hinted",
      "threatLevel": "low"|"medium"|"high"|"extreme",
      "durationScope": "chapter"|"arc"|"novel"|"multi_arc",
      "presenceType": "direct"|"mentioned"|"hinted"|"influence" (optional),
      "significance": "major"|"minor"|"foreshadowing" (optional),
      "relationshipWithProtagonist": {
        "relationshipType": "primary_target"|"secondary_target"|"ally_of_antagonist"|"neutral",
        "intensity": "rival"|"enemy"|"nemesis"|"opposition"
      } (optional),
      "arcRole": "primary"|"secondary"|"background"|"hinted" (optional),
      "notes": string (optional)
    }
  ] (optional),
  "systemUpdates": [
    {
      "name": string,
      "action": "create"|"update",
      "systemId": string (optional, if updating existing),
      "characterName": string,
      "type": "cultivation"|"game"|"cheat"|"ability"|"interface"|"evolution"|"other" (optional),
      "category": "core"|"support"|"evolution"|"utility"|"combat"|"passive" (optional),
      "description": string (optional),
      "currentLevel": string (optional),
      "currentVersion": string (optional),
      "status": "active"|"dormant"|"upgraded"|"merged"|"deactivated" (optional),
      "addFeatures": string[] (optional, new features discovered/added),
      "upgradeFeatures": string[] (optional, features that were upgraded),
      "presenceType": "direct"|"mentioned"|"hinted"|"used" (optional),
      "significance": "major"|"minor"|"foreshadowing" (optional),
      "notes": string (optional)
    }
  ] (optional),
  "threadUpdates": [
    {
      "title": string,
      "type": "enemy"|"technique"|"item"|"location"|"sect"|"promise"|"mystery"|"relationship"|"power"|"quest"|"revelation"|"conflict"|"alliance",
      "action": "create"|"update"|"resolve",
      "threadId": string (optional, if updating existing),
      "description": string (optional),
      "priority": "critical"|"high"|"medium"|"low" (optional),
      "status": "active"|"paused"|"resolved"|"abandoned" (optional),
      "eventType": "introduced"|"progressed"|"resolved"|"hinted",
      "eventDescription": string,
      "significance": "major"|"minor"|"foreshadowing",
      "relatedEntityName": string (optional),
      "relatedEntityType": string (optional),
      "resolutionNotes": string (optional, if resolving),
      "satisfactionScore": number (optional, 0-100, if resolving)
    }
  ] (optional)
}
  `.trim();

  return rateLimiter.queueRequest(
    'refine',
    async () => {
      const parsed = await routeJsonTask<PostChapterExtraction>('metadata_extraction', {
        system: SYSTEM_INSTRUCTION,
        user: prompt,
        temperature: 0.3,
        maxTokens: 8192, // Grok maximum output tokens (uses full 2M input context + 8K output)
      });

      const extraction: PostChapterExtraction = {
        characterUpserts: parsed?.characterUpserts || [],
        worldEntryUpserts: parsed?.worldEntryUpserts || [],
        territoryUpserts: parsed?.territoryUpserts || [],
        itemUpdates: parsed?.itemUpdates || [],
        techniqueUpdates: parsed?.techniqueUpdates || [],
        antagonistUpdates: parsed?.antagonistUpdates || [],
        scenes: parsed?.scenes || [],
        arcChecklistProgress: parsed?.arcChecklistProgress ?? null,
        threadUpdates: parsed?.threadUpdates || [],
      };

      // Log extraction results for debugging
      logger.debug('Extraction completed', 'chapterGeneration', {
        chapterId: newChapter.id,
        chapterNumber: newChapter.number,
        characterUpsertsCount: extraction.characterUpserts.length,
        characterUpserts: extraction.characterUpserts.map(u => ({
          name: u.name,
          hasSet: !!u.set,
          fieldsInSet: u.set ? Object.keys(u.set) : [],
          hasAddSkills: !!u.addSkills?.length,
          hasAddItems: !!u.addItems?.length,
        })),
        worldEntryUpsertsCount: extraction.worldEntryUpserts.length,
        territoryUpsertsCount: extraction.territoryUpserts.length,
        itemUpdatesCount: extraction.itemUpdates?.length || 0,
        techniqueUpdatesCount: extraction.techniqueUpdates?.length || 0,
      });

      return extraction;
    },
    `postchapter-extract-${state.id}-${newChapter.number}`
  );
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


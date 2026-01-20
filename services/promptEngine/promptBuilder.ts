import { NovelState, PromptContext, BuiltPrompt, PromptBuilderConfig } from '../../types';
import { gatherPromptContext, getTruncatedCharacterCodex, getTruncatedWorldBible } from './contextGatherer';
import { getStyleGuidelines, getStyleConstraints } from './styleAnalyzer';
import { getPromptRules, getGenreConventions } from './promptRules';
import { estimateTokens } from './tokenEstimator';
import { analyzePromptForCaching } from '../promptCacheAnalyzer';
import { createCacheMetadata } from '../promptCacheService';
import type { CacheProvider } from '../../types/cache';
import { getContextLimitsForModel, type ModelProvider } from '../contextWindowManager';

/**
 * Prompt Builder
 * 
 * Dynamically constructs professional prompts following best practices.
 * Handles context gathering, section prioritization, and dynamic compression
 * to fit within token limits while preserving critical information.
 * 
 * Features:
 * - Intelligent context truncation
 * - Section prioritization for compression
 * - Token estimation for accurate sizing
 * - Dynamic prompt optimization
 * 
 * @example
 * ```typescript
 * const prompt = await buildPrompt(novelState, {
 *   role: 'Master novelist',
 *   taskDescription: 'Generate next chapter',
 *   userInstruction: 'Focus on character development',
 * });
 * ```
 */

const DEFAULT_CONFIG: PromptBuilderConfig = {
  includeFullContext: false,
  maxContextLength: 12000, // Increased from 3000 to 12000 (≈3000 tokens, safe for modern models)
  prioritizeRecent: true,
  includeStyleGuidelines: true,
  includeCharacterDevelopment: true,
  includeStoryProgression: true,
  includeArcHistory: false,
};

/**
 * Section priority levels for compression (higher = more important)
 */
interface SectionWithPriority {
  section: string;
  priority: number;
  canTruncate: boolean;
}

/**
 * Compresses prompt sections to fit within maxLength while preserving critical information
 * Improved algorithm that intelligently truncates sections instead of stopping early
 */
function compressContext(sections: string[], maxLength: number): string[] {
  const criticalKeywords = ['ROLE:', '[TASK]', '[OUTPUT FORMAT]', '[CONSTRAINTS'];
  
  // High priority: Critical sections that must be preserved
  // Medium-high: Recent chapters, character codex, continuity bridge
  // Medium: Story context, arc context, world bible
  // Lower: Older summaries, literary principles (these can be truncated more)
  
  const sectionsWithPriority: SectionWithPriority[] = sections.map(section => {
    // Determine priority based on content
    if (criticalKeywords.some(keyword => section.includes(keyword))) {
      return { section, priority: 10, canTruncate: false }; // Critical, cannot truncate
    } else if (section.includes('CHAPTER TRANSITION') || section.includes('[CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT]')) {
      return { section, priority: 10, canTruncate: false }; // Critical, cannot truncate - this is the most important section
    } else if (section.includes('[RECENT CHAPTERS]')) {
      return { section, priority: 9, canTruncate: true }; // Very important, but can truncate
    } else if (section.includes('[CHARACTER CODEX') || section.includes('[CURRENT ARC]')) {
      return { section, priority: 8, canTruncate: true };
    } else if (section.includes('[STORY CONTEXT]') || section.includes('[ACTIVE PLOT THREADS]')) {
      return { section, priority: 7, canTruncate: true };
    } else if (section.includes('[WORLD BIBLE') || section.includes('[CURRENT STORY STATE]')) {
      return { section, priority: 6, canTruncate: true };
    } else if (section.includes('[CHARACTER DEVELOPMENT') || section.includes('[STORY PROGRESSION]')) {
      return { section, priority: 5, canTruncate: true };
    } else if (section.includes('FORESHADOWING') || section.includes('EMOTIONAL PAYOFF') || 
               section.includes('PACING') || section.includes('SYMBOLISM')) {
      return { section, priority: 4, canTruncate: true };
    } else if (section.includes('[FACE GRAPH') || section.includes('SOCIAL NETWORK') ||
               section.includes('KARMA') || section.includes('BLOOD FEUD') || 
               section.includes('FACE DEBT')) {
      return { section, priority: 7, canTruncate: true }; // High priority - important for character interactions
    } else if (section.includes('[COMPLETED ARCS]') || section.includes('[CHAPTER SUMMARY')) {
      return { section, priority: 3, canTruncate: true }; // Can truncate more
    } else if (section.includes('[GENRE CONVENTIONS]') || section.includes('[LITERARY PRINCIPLES]')) {
      return { section, priority: 2, canTruncate: true }; // Lower priority, can truncate significantly
    } else {
      return { section, priority: 5, canTruncate: true }; // Default medium priority
    }
  });
  
  // Sort by priority (highest first)
  sectionsWithPriority.sort((a, b) => b.priority - a.priority);
  
  const compressed: string[] = [];
  let totalLength = 0;
  const minSectionLength = 50; // Minimum length for a meaningful section
  
  // First pass: Add sections that fit completely
  const remaining: SectionWithPriority[] = [];
  for (const item of sectionsWithPriority) {
    const sectionWithNewline = item.section + '\n';
    if (totalLength + sectionWithNewline.length <= maxLength) {
      compressed.push(item.section);
      totalLength += sectionWithNewline.length;
    } else {
      remaining.push(item);
    }
  }
  
  // Second pass: Intelligently truncate remaining sections to fit as much as possible
  for (const item of remaining) {
    const availableSpace = maxLength - totalLength - 30; // Reserve space for truncation indicator
    if (availableSpace < minSectionLength) {
      // Not enough space for meaningful content
      break;
    }
    
    if (!item.canTruncate) {
      // Critical section that cannot be truncated - skip if it doesn't fit
      continue;
    }
    
    // Try to truncate at a good point (sentence or line break)
    let truncated = item.section.substring(0, Math.min(availableSpace, item.section.length));
    
    // Find the best truncation point (prefer sentence endings, then line breaks)
    const lastPeriod = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    const lastNewline = truncated.lastIndexOf('\n');
    const sentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
    const bestBreak = sentenceEnd > 0 && sentenceEnd > availableSpace * 0.6 
      ? sentenceEnd + 1 
      : lastNewline > availableSpace * 0.7 
        ? lastNewline + 1 
        : availableSpace;
    
    if (bestBreak < item.section.length) {
      truncated = truncated.substring(0, bestBreak);
      const truncationIndicator = item.section.length > truncated.length 
        ? '\n…[truncated for length]' 
        : '';
      compressed.push(truncated + truncationIndicator);
      totalLength += truncated.length + truncationIndicator.length + 1; // +1 for newline
    } else {
      // Section fits completely
      compressed.push(item.section);
      totalLength += item.section.length + 1;
    }
    
    // If we've used up most of the space, stop adding more
    if (totalLength >= maxLength * 0.95) {
      break;
    }
  }
  
  return compressed;
}

/**
 * Builds a professional prompt for AI generation
 * 
 * @param modelInfo - Optional model provider information to optimize context limits
 *                    When Grok is used, context limits are significantly increased to leverage 2M token window
 */
export async function buildPrompt(
  state: NovelState,
  task: {
    role: string;
    taskDescription: string;
    userInstruction?: string;
    outputFormat?: string;
    specificConstraints?: string[];
  },
  config: Partial<PromptBuilderConfig> = {},
  modelInfo?: { provider: ModelProvider }
): Promise<BuiltPrompt> {
  // Get model-specific context limits if model info is provided
  const modelLimits = modelInfo ? getContextLimitsForModel(modelInfo.provider) : null;
  
  // Merge default config with model-specific limits and user config
  const finalConfig: PromptBuilderConfig = {
    ...DEFAULT_CONFIG,
    // Apply model-specific limits if available, otherwise use defaults
    maxContextLength: modelLimits?.maxContextLength ?? config.maxContextLength ?? DEFAULT_CONFIG.maxContextLength,
    includeFullContext: modelLimits?.includeFullHistory ?? config.includeFullContext ?? DEFAULT_CONFIG.includeFullContext,
    ...config, // User config overrides (but model limits take precedence for key fields)
  };

  const truncate = (text: string | undefined | null, max: number) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  };
  
  // Calculate maxRecentChapters based on model limits
  const maxRecentChapters = modelLimits 
    ? Math.min(modelLimits.maxRecentChapters, state.chapters.length)
    : (finalConfig.prioritizeRecent ? 4 : 5);
  
  // Gather context with optimized settings based on model capabilities
  const context = await gatherPromptContext(state, {
    includeFullHistory: finalConfig.includeFullContext,
    maxRecentChapters: maxRecentChapters,
    includeStyleProfile: finalConfig.includeStyleGuidelines,
    includeCharacterDevelopment: finalConfig.includeCharacterDevelopment,
    includeStoryProgression: finalConfig.includeStoryProgression,
    includeArcHistory: finalConfig.includeArcHistory ?? false,
    // Model-specific options for enhanced context
    includeFullCharacterProgression: modelLimits?.includeFullCharacterProgression ?? false,
    includeAllActiveThreads: modelLimits?.includeAllActiveThreads ?? false,
    includeFullChapterText: modelLimits?.includeFullChapterText ?? false,
  });

  // Get prompt rules
  const rules = getPromptRules(state);
  const genreConventions = getGenreConventions(state.genre);

  // Build prompt sections
  const promptSections: string[] = [];

  // 1. Role Definition
  promptSections.push(`ROLE: ${task.role}\n`);

  // 2. CRITICAL STATE (from enhanced context) - Highest priority
  if ((context as any).criticalState) {
    promptSections.push((context as any).criticalState);
    promptSections.push('');
  }

  // 3. CHAPTER TRANSITION - Critical Context (MUST BE EARLY AND PROMINENT)
  if (context.continuityBridge) {
    promptSections.push(context.continuityBridge);
    promptSections.push('');
  }

  // 3.5. COMPREHENSIVE THREAD CONTEXT (CRITICAL - MUST BE PROMINENT)
  if (context.comprehensiveThreadContext) {
    promptSections.push(context.comprehensiveThreadContext);
    promptSections.push('');
  }
  
  // 4. POWER PROGRESSION (from enhanced context)
  if ((context as any).powerProgression) {
    promptSections.push((context as any).powerProgression);
    promptSections.push('');
  }
  
  // 5. RELATIONSHIP NETWORK (from enhanced context)
  if ((context as any).relationshipNetwork) {
    promptSections.push((context as any).relationshipNetwork);
    promptSections.push('');
  }

  // 3. Story Context
  promptSections.push('[STORY CONTEXT]');
  promptSections.push(`Novel: "${context.storyState.title}"`);
  promptSections.push(`Genre: ${context.storyState.genre}`);
  if (context.storyState.grandSaga) {
    // Show full Grand Saga (up to 800 chars for better context)
    const grandSagaText = context.storyState.grandSaga.length > 800 
      ? context.storyState.grandSaga.substring(0, 800) + '...'
      : context.storyState.grandSaga;
    promptSections.push(`Grand Saga: ${grandSagaText}`);
    
    // Add Grand Saga characters section if available
    if (context.grandSagaCharacters && context.grandSagaCharacters.length > 0) {
      promptSections.push(`\nGrand Saga Characters: ${context.grandSagaCharacters.map(c => c.name).join(', ')}`);
      promptSections.push('NOTE: These characters from the Grand Saga should be featured prominently in the story.');
    }
    if (context.grandSagaExtractedNames && context.grandSagaExtractedNames.length > 0) {
      promptSections.push(`Potential Grand Saga Characters (not yet in codex): ${context.grandSagaExtractedNames.map(e => e.name).join(', ')}`);
    }
  }
  if (context.storyState.currentRealm) {
    promptSections.push(`Current Realm: ${context.storyState.currentRealm.name} - ${context.storyState.currentRealm.description.substring(0, 300)}`);
  }
  if (context.storyState.territories.length > 0) {
    promptSections.push(`Territories: ${context.storyState.territories.map(t => t.name).join(', ')}`);
  }
  promptSections.push('');

  // 7. Narrative Context (Arc Information)
  if (context.narrativeContext.activeArc) {
    promptSections.push('[CURRENT ARC]');
    const arcDesc = context.narrativeContext.activeArc.description || '';
    const oneSentenceGoal = arcDesc.split(/[\.\!\?]\s/)[0] || arcDesc;
    promptSections.push(`"${context.narrativeContext.activeArc.title}": ${arcDesc}`);
    if (typeof context.narrativeContext.activeArc.startedAtChapter === 'number') {
      promptSections.push(`Arc started at chapter: ${context.narrativeContext.activeArc.startedAtChapter}`);
    }
    if (oneSentenceGoal.trim()) {
      promptSections.push(`Arc mandate (1 sentence): ${oneSentenceGoal.trim()}`);
    }
    promptSections.push('');
  }

  // Only include last 2 completed arcs to save tokens
  if (context.narrativeContext.completedArcs.length > 0) {
    promptSections.push('[COMPLETED ARCS - Recent Only]');
    context.narrativeContext.completedArcs.slice(-2).forEach(arc => { // Only last 2
      promptSections.push(`"${arc.title}": ${arc.description.substring(0, 200)}`); // Increased from 150 to 200
    });
    promptSections.push('');
  }

  // RECENT CHAPTERS - Include summaries only (full ending is in CHAPTER TRANSITION section)
  promptSections.push('[RECENT CHAPTERS]');
  if (context.narrativeContext.recentChapters.length > 0) {
    const recentChapters = context.narrativeContext.recentChapters;
    const mostRecentChapter = recentChapters[recentChapters.length - 1];
    const otherRecentChapters = recentChapters.slice(0, -1);

    // Show most recent chapter with summary only (full ending is in CHAPTER TRANSITION section)
    promptSections.push(`Ch ${mostRecentChapter.number}: ${mostRecentChapter.title}`);
    if (mostRecentChapter.summary) {
      promptSections.push(`Summary: ${truncate(mostRecentChapter.summary, 600)}`);
    }
    if (mostRecentChapter.logicAudit) {
      promptSections.push(`Logic: ${mostRecentChapter.logicAudit.resultingValue} (${mostRecentChapter.logicAudit.causalityType})`);
    }
    promptSections.push(`(Note: Full chapter ending, character states, and immediate situation are in [CHAPTER TRANSITION - CRITICAL CONTINUITY CONTEXT] section above.)`);
    promptSections.push('');

    // Show other recent chapters as summaries
    if (otherRecentChapters.length > 0) {
      otherRecentChapters.forEach(chapter => {
        promptSections.push(`Ch ${chapter.number}: ${chapter.title}`);
        promptSections.push(`Summary: ${chapter.summary ? truncate(chapter.summary, 400) : 'No summary available.'}`);
        if (chapter.logicAudit) {
          promptSections.push(`Logic: ${chapter.logicAudit.resultingValue} (${chapter.logicAudit.causalityType})`);
        }
        promptSections.push('');
      });
    }
  } else {
    promptSections.push('No recent chapters. This is the beginning of the story.');
    promptSections.push('');
  }

  // CURRENT STORY STATE (NEW)
  if (context.storyStateSummary) {
    promptSections.push('[CURRENT STORY STATE]');
    promptSections.push(context.storyStateSummary);
    promptSections.push('');
  }

  // OPEN PLOT POINTS (Comprehensive tracking of unresolved storylines)
  if (context.openPlotPointsContext) {
    promptSections.push(context.openPlotPointsContext);
    promptSections.push('');
  } else {
    // Fallback to active plot threads if comprehensive context not available
    if (context.activePlotThreads && context.activePlotThreads.length > 0) {
      promptSections.push('[ACTIVE PLOT THREADS]');
      context.activePlotThreads.slice(0, 8).forEach(thread => {
        promptSections.push(`- ${truncate(thread, 200)}`);
      });
      promptSections.push('');
    }

    // HIGH-PRIORITY PLOT THREADS (MANDATORY)
    if (context.highPriorityPlotThreads && context.highPriorityPlotThreads.length > 0) {
      promptSections.push('[HIGH-PRIORITY PLOT THREADS - MANDATORY RESOLUTION]');
      promptSections.push('CRITICAL: You MUST address or resolve at least ONE of the following high-priority plot threads in this chapter:');
      context.highPriorityPlotThreads.slice(0, 5).forEach(thread => {
        promptSections.push(`- ${truncate(thread, 200)}`);
      });
      promptSections.push('These threads represent promised meetings, character commitments, character pursuits, or unresolved checklist items that cannot be ignored.');
      promptSections.push('');
    }
  }

  // Only include older chapters summary if it's concise (limit to last 10 chapters)
  if (context.narrativeContext.olderChaptersSummary && 
      context.narrativeContext.olderChaptersSummary !== 'No previous chapters.' &&
      context.narrativeContext.olderChaptersSummary.length < 1500) { // Increased from 1000 to 1500 chars
    promptSections.push('[CHAPTER SUMMARY - Older Chapters]');
    promptSections.push(context.narrativeContext.olderChaptersSummary.substring(0, 1200)); // Increased from 800 to 1200 chars
    promptSections.push('');
  }

  // 4. COMPREHENSIVE CHARACTER CONTEXT (for characters appearing in chapter)
  if (context.comprehensiveCharacterContext && context.comprehensiveCharacterContext.length > 0) {
    // Add comprehensive character context for each character appearing
    context.comprehensiveCharacterContext.forEach(charContext => {
      promptSections.push(charContext.formattedContext);
      promptSections.push('');
    });
  } else if (finalConfig.includeCharacterDevelopment && context.characterContext.codex.length > 0) {
    // Fallback to truncated codex if comprehensive context not available
    promptSections.push('[CHARACTER CODEX - Relevant Characters Only]');
    // Pass state to getTruncatedCharacterCodex so it can include Grand Saga characters
    const truncatedCodex = getTruncatedCharacterCodex(
      context.characterContext.codex,
      context.narrativeContext.recentChapters,
      8, // Limit to 8 most relevant characters
      state // Pass state to enable Grand Saga character inclusion
    );
    // Compact JSON to reduce token overhead
    promptSections.push(JSON.stringify(truncatedCodex));
    
    // Add note about Grand Saga characters if applicable
    if (context.grandSagaCharacters && context.grandSagaCharacters.length > 0 && context.narrativeContext.recentChapters.length === 0) {
      promptSections.push('\nNOTE: Characters from the Grand Saga are prioritized above. They should be featured in this arc.');
    }
    
    promptSections.push('');

    // Add character development insights (only for main characters)
    if (context.characterContext.developmentMetrics.length > 0) {
      promptSections.push('[CHARACTER DEVELOPMENT STATE]');
      context.characterContext.developmentMetrics.slice(0, 4).forEach(metric => { // Increased from 3 to 4
        promptSections.push(`${metric.characterName}: ${metric.arcProgression.stage} stage`);
      });
      promptSections.push('');
    }
  }

  // 5. World Bible (only most relevant entries - improved with semantic relevance)
  if (context.storyState.worldBible.length > 0) {
    promptSections.push('[WORLD BIBLE - Current Realm (Key Entries Only)]');
    const truncatedBible = getTruncatedWorldBible(
      context.storyState.worldBible, 
      8, // Increased from 6 to 8 entries
      context.narrativeContext.recentChapters,
      context.activePlotThreads || []
    );
    // Compact JSON to reduce token overhead
    promptSections.push(JSON.stringify(truncatedBible));
    promptSections.push('');
  }

  // 6. Style Guidelines
  if (finalConfig.includeStyleGuidelines && context.styleContext.profile) {
    promptSections.push(getStyleGuidelines(state));
    promptSections.push('');
  }

  // 7. STORY PROGRESSION ANALYSIS (Comprehensive)
  if (context.storyProgressionAnalysis) {
    promptSections.push(context.storyProgressionAnalysis);
    promptSections.push('');
  } else if (finalConfig.includeStoryProgression) {
    // Fallback to basic progression metrics if comprehensive analysis not available
    const progression = context.narrativeContext.progressionMetrics;
    promptSections.push('[STORY PROGRESSION]');
    promptSections.push(`Current Tension Level: ${progression.tensionCurve.currentLevel} (${progression.tensionCurve.trend} trend)`);
    if (progression.arcStructure.length > 0) {
      const activeArcStructure = progression.arcStructure.find(a => 
        context.narrativeContext.activeArc?.id === a.arcId
      );
      if (activeArcStructure) {
        promptSections.push(`Current Arc Stage: ${activeArcStructure.stage} (${activeArcStructure.completionPercentage}% complete)`);
      }
    }
    promptSections.push('');
  }

  // 7.5. Arc Context (if available and requested)
  if (context.arcContext && finalConfig.includeArcHistory !== false) {
    // This is handled separately in arcPromptWriter, but we can add a summary here
    // The full arc context is already included in the task description when building arc prompts
    if (context.arcContext.arcSummaries.length > 0) {
      promptSections.push('[ARC HISTORY SUMMARY]');
      const recentArc = context.arcContext.arcSummaries.find(s => s.tier === 'recent');
      if (recentArc) {
        promptSections.push(`Most Recent Arc: "${recentArc.title}" - ${truncate(recentArc.description, 150)}`);
        promptSections.push(`Tension: ${recentArc.tensionCurve.startLevel} → ${recentArc.tensionCurve.endLevel}`);
        if (recentArc.unresolvedElements.length > 0) {
          promptSections.push(`Unresolved Elements: ${recentArc.unresolvedElements.length} (see detailed context above)`);
        }
      }
      promptSections.push(`Total Completed Arcs: ${context.arcContext.arcSummaries.length}`);
      promptSections.push('');
    }
  }

  // 7.6. Antagonist Context
  if (context.antagonistContext) {
    promptSections.push(context.antagonistContext);
    promptSections.push('');
  }

  // 7.6.5. System Context
  if (context.systemContext) {
    promptSections.push(context.systemContext);
    promptSections.push('');
  }

  // 7.7. Foreshadowing Context
  if (context.foreshadowingContext) {
    promptSections.push(context.foreshadowingContext);
    promptSections.push('');
  }

  // 7.8. Emotional Payoff Context
  if (context.emotionalPayoffContext) {
    promptSections.push(context.emotionalPayoffContext);
    promptSections.push('');
  }

  // 7.9. Pacing Context
  if (context.pacingContext) {
    promptSections.push(context.pacingContext);
    promptSections.push('');
  }

  // 7.10. Symbolism Context
  if (context.symbolismContext) {
    promptSections.push(context.symbolismContext);
    promptSections.push('');
  }

  // 7.11. Face Graph Context (Social Network Memory - Karma, Feuds, Debts)
  if (context.faceGraphContext) {
    promptSections.push(context.faceGraphContext);
    promptSections.push('');
  }

  // 8. Genre Conventions
  if (genreConventions.length > 0) {
    promptSections.push('[GENRE CONVENTIONS]');
    genreConventions.forEach(convention => {
      promptSections.push(`- ${convention}`);
    });
    promptSections.push('');
  }

  // 9. Literary Principles (only most critical)
  promptSections.push('[LITERARY PRINCIPLES - Apply These]');
  rules.literaryPrinciples.slice(0, 4).forEach(principle => { // Increased from 3 to 4
    promptSections.push(`- ${principle}`);
  });
  promptSections.push('');

  // 10. Task Definition
  promptSections.push('[TASK]');
  promptSections.push(task.taskDescription);
  if (task.userInstruction) {
    promptSections.push(`\nUser Instruction: ${task.userInstruction}`);
  }
  promptSections.push('');

  // 11. Constraints
  promptSections.push('[CONSTRAINTS & REQUIREMENTS]');
  
  // Style constraints
  if (finalConfig.includeStyleGuidelines) {
    const styleConstraints = getStyleConstraints(state);
    styleConstraints.forEach(constraint => {
      promptSections.push(`- ${constraint}`);
    });
  }

  // Task-specific constraints
  if (task.specificConstraints) {
    task.specificConstraints.forEach(constraint => {
      promptSections.push(`- ${constraint}`);
    });
  }

  // Output quality standards (only most critical)
  rules.outputQualityStandards.slice(0, 3).forEach(standard => { // Increased from 2 to 3
    promptSections.push(`- ${standard}`);
  });

  promptSections.push('');

  // 12. Output Format
  if (task.outputFormat) {
    promptSections.push('[OUTPUT FORMAT]');
    promptSections.push(task.outputFormat);
  }

  // Combine all sections
  let userPrompt = promptSections.join('\n');
  
  // Apply dynamic compression if needed (using token estimation for better accuracy)
  const estimatedTokens = estimateTokens(userPrompt);
  const maxTokens = Math.floor(finalConfig.maxContextLength / 4 * 1.2); // Convert char limit to approximate token limit
  const shouldSkipCompression = modelLimits?.skipAggressiveCompression ?? false;
  
  // Only compress if we exceed limits AND compression is not skipped (e.g., for Grok with large context window)
  if (!shouldSkipCompression && finalConfig.maxContextLength > 0 && (userPrompt.length > finalConfig.maxContextLength || estimatedTokens > maxTokens)) {
    const originalLength = userPrompt.length;
    const originalTokens = estimatedTokens;
    
    const compressedSections = compressContext(promptSections, finalConfig.maxContextLength);
    userPrompt = compressedSections.join('\n');
    
    // Log compression statistics
    const compressedTokens = estimateTokens(userPrompt);
    const compressionRatio = userPrompt.length / originalLength;
    const tokenCompressionRatio = compressedTokens / originalTokens;
    
    if (compressionRatio < 0.8 || tokenCompressionRatio < 0.8) {
      console.warn(
        `Prompt compressed: ${originalLength.toLocaleString()} chars (${originalTokens.toLocaleString()} tokens) → ` +
        `${userPrompt.length.toLocaleString()} chars (${compressedTokens.toLocaleString()} tokens) ` +
        `(${Math.round(compressionRatio * 100)}% of original, ${Math.round(tokenCompressionRatio * 100)}% tokens)`
      );
    } else {
      console.log(
        `Prompt size: ${userPrompt.length.toLocaleString()} chars (${compressedTokens.toLocaleString()} tokens)`
      );
    }
  } else if (shouldSkipCompression) {
    // Log context size for large context windows (Grok)
    console.log(
      `Prompt size (${modelInfo?.provider ?? 'unknown'}): ${userPrompt.length.toLocaleString()} chars (${estimatedTokens.toLocaleString()} tokens) ` +
      `[Using large context window - no compression applied]`
    );
  }

  // Create context summary
  const contextSummary = `Novel: ${context.storyState.title} | Chapters: ${state.chapters.length} | Characters: ${context.characterContext.codex.length} | Realm: ${context.storyState.currentRealm?.name || 'None'}`;

  // Analyze prompt for caching (try Claude first, then Gemini)
  const finalUserPrompt = userPrompt.trim();
  let cacheMetadata: BuiltPrompt['cacheMetadata'] = undefined;
  
  // Try to create cache metadata for Grok
  try {
    for (const provider of ['grok'] as CacheProvider[]) {
      const cacheablePrompt = analyzePromptForCaching(
        { systemInstruction: '', userPrompt: finalUserPrompt, contextSummary },
        state,
        provider
      );
      
      if (cacheablePrompt && cacheablePrompt.canUseCaching) {
        const metadata = createCacheMetadata(
          state,
          cacheablePrompt.cacheableContent,
          cacheablePrompt.dynamicContent,
          provider
        );
        
        if (metadata) {
          cacheMetadata = {
            cacheableContent: metadata.cacheableContent,
            dynamicContent: metadata.dynamicContent,
            cacheKey: metadata.cacheKey,
            estimatedCacheableTokens: metadata.estimatedCacheableTokens,
            canUseCaching: metadata.canUseCaching,
            provider: metadata.provider,
          };
          break; // Use first provider that meets requirements
        }
      }
    }
  } catch (error) {
    // If cache analysis fails, continue without caching (non-critical)
    console.warn('[Prompt Cache] Failed to analyze prompt for caching:', error instanceof Error ? error.message : String(error));
  }

  return {
    systemInstruction: '', // Will be set by caller or use default
    userPrompt: finalUserPrompt,
    contextSummary,
    cacheMetadata,
  };
}

/**
 * Builds a simplified prompt for quick tasks (editing, expansion)
 */
export async function buildSimplifiedPrompt(
  state: NovelState,
  task: {
    role: string;
    taskDescription: string;
    userInstruction: string;
    contextSnippet?: string;
  }
): Promise<BuiltPrompt> {
  const context = await gatherPromptContext(state, {
    includeFullHistory: false,
    maxRecentChapters: 2,
    includeStyleProfile: true,
    includeCharacterDevelopment: false,
    includeStoryProgression: false,
  });

  const promptSections: string[] = [];

  promptSections.push(`ROLE: ${task.role}\n`);
  
  promptSections.push('[STORY CONTEXT]');
  promptSections.push(`Novel: "${context.storyState.title}" (${context.storyState.genre})`);
  if (context.storyState.currentRealm) {
    promptSections.push(`Current Realm: ${context.storyState.currentRealm.name}`);
  }
  promptSections.push('');

  if (context.styleContext.profile) {
    const styleGuidelines = getStyleGuidelines(state);
    promptSections.push(styleGuidelines);
    promptSections.push('');
  }

  if (task.contextSnippet) {
    promptSections.push('[RELEVANT CONTEXT]');
    promptSections.push(task.contextSnippet);
    promptSections.push('');
  }

  promptSections.push('[TASK]');
  promptSections.push(task.taskDescription);
  promptSections.push(`\nUser Instruction: ${task.userInstruction}`);

  const userPrompt = promptSections.join('\n');
  const contextSummary = `Novel: ${context.storyState.title} | Quick task`;

  return {
    systemInstruction: '',
    userPrompt: userPrompt.trim(),
    contextSummary,
  };
}
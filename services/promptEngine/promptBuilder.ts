import { NovelState, PromptContext, BuiltPrompt, PromptBuilderConfig } from '../../types';
import { gatherPromptContext, getTruncatedCharacterCodex, getTruncatedWorldBible } from './contextGatherer';
import { getStyleGuidelines, getStyleConstraints } from './styleAnalyzer';
import { getPromptRules, getGenreConventions } from './promptRules';
import { estimateTokens } from './tokenEstimator';

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
  config: Partial<PromptBuilderConfig> = {}
): Promise<BuiltPrompt> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const truncate = (text: string | undefined | null, max: number) => {
    if (!text) return '';
    return text.length > max ? text.substring(0, max) + '…' : text;
  };
  
  // Gather context with optimized settings
  const context = await gatherPromptContext(state, {
    includeFullHistory: finalConfig.includeFullContext,
    maxRecentChapters: finalConfig.prioritizeRecent ? 4 : 5, // Increased from 2 to 4 for better continuity
    includeStyleProfile: finalConfig.includeStyleGuidelines,
    includeCharacterDevelopment: finalConfig.includeCharacterDevelopment,
    includeStoryProgression: finalConfig.includeStoryProgression,
    includeArcHistory: finalConfig.includeArcHistory,
  });

  // Get prompt rules
  const rules = getPromptRules(state);
  const genreConventions = getGenreConventions(state.genre);

  // Build prompt sections
  const promptSections: string[] = [];

  // 1. Role Definition
  promptSections.push(`ROLE: ${task.role}\n`);

  // 2. CHAPTER TRANSITION - Critical Context (MUST BE EARLY AND PROMINENT)
  if (context.continuityBridge) {
    promptSections.push(context.continuityBridge);
    promptSections.push('');
  }

  // 3. Story Context
  promptSections.push('[STORY CONTEXT]');
  promptSections.push(`Novel: "${context.storyState.title}"`);
  promptSections.push(`Genre: ${context.storyState.genre}`);
  if (context.storyState.grandSaga) {
    promptSections.push(`Grand Saga: ${context.storyState.grandSaga.substring(0, 500)}`);
  }
  if (context.storyState.currentRealm) {
    promptSections.push(`Current Realm: ${context.storyState.currentRealm.name} - ${context.storyState.currentRealm.description.substring(0, 300)}`);
  }
  if (context.storyState.territories.length > 0) {
    promptSections.push(`Territories: ${context.storyState.territories.map(t => t.name).join(', ')}`);
  }
  promptSections.push('');

  // 4. Narrative Context (Arc Information)
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

  // ACTIVE PLOT THREADS (NEW)
  if (context.activePlotThreads && context.activePlotThreads.length > 0) {
    promptSections.push('[ACTIVE PLOT THREADS]');
    context.activePlotThreads.slice(0, 5).forEach(thread => {
      promptSections.push(`- ${truncate(thread, 200)}`);
    });
    promptSections.push('');
  }

  // Only include older chapters summary if it's concise (limit to last 10 chapters)
  if (context.narrativeContext.olderChaptersSummary && 
      context.narrativeContext.olderChaptersSummary !== 'No previous chapters.' &&
      context.narrativeContext.olderChaptersSummary.length < 1500) { // Increased from 1000 to 1500 chars
    promptSections.push('[CHAPTER SUMMARY - Older Chapters]');
    promptSections.push(context.narrativeContext.olderChaptersSummary.substring(0, 1200)); // Increased from 800 to 1200 chars
    promptSections.push('');
  }

  // 4. Character Context (only relevant characters)
  if (finalConfig.includeCharacterDevelopment && context.characterContext.codex.length > 0) {
    promptSections.push('[CHARACTER CODEX - Relevant Characters Only]');
    const truncatedCodex = getTruncatedCharacterCodex(
      context.characterContext.codex,
      context.narrativeContext.recentChapters,
      8 // Limit to 8 most relevant characters
    );
    // Compact JSON to reduce token overhead
    promptSections.push(JSON.stringify(truncatedCodex));
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

  // 7. Story Progression Context
  if (finalConfig.includeStoryProgression) {
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
  
  if (finalConfig.maxContextLength > 0 && (userPrompt.length > finalConfig.maxContextLength || estimatedTokens > maxTokens)) {
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
  }

  // Create context summary
  const contextSummary = `Novel: ${context.storyState.title} | Chapters: ${state.chapters.length} | Characters: ${context.characterContext.codex.length} | Realm: ${context.storyState.currentRealm?.name || 'None'}`;

  return {
    systemInstruction: '', // Will be set by caller or use default
    userPrompt: userPrompt.trim(),
    contextSummary,
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
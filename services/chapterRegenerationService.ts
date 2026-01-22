import { NovelState, Chapter, ChapterQualityMetrics, RegenerationConfig, RegenerationResult, BuiltPrompt } from '../types';
import { QUALITY_CONFIG } from '../constants';
import { buildChapterPrompt } from './promptEngine/writers/chapterPromptWriter';
import { generateNextChapter } from './aiService';
import { validateChapterQuality } from './chapterQualityValidator';
import { calculateAIDetectionScore, compareAIDetectionScores } from './aiDetectionScoreTracker';
import { generateUUID } from '../utils/uuid';
import { detectRepetitions } from './repetitionDetector';
import * as crypto from 'crypto';

/**
 * Chapter Regeneration Service
 * Handles automatic regeneration of chapters that fail critical quality checks
 */

/**
 * Determines if a chapter should be regenerated based on quality metrics
 */
export function shouldRegenerate(
  metrics: ChapterQualityMetrics,
  config: RegenerationConfig = QUALITY_CONFIG
): boolean {
  if (!config.enabled) {
    return false;
  }

  // Safety check - if metrics are malformed, don't regenerate
  if (!metrics || !metrics.originalityScore || !metrics.narrativeCraftScore) {
    console.warn('[Regeneration] Invalid metrics structure, skipping regeneration check');
    return false;
  }

  // Check critical thresholds
  if ((metrics.originalityScore.overallOriginality ?? 0) < config.criticalThresholds.originality) {
    return true;
  }

  if ((metrics.narrativeCraftScore.overallCraftScore ?? 0) < config.criticalThresholds.narrativeCraft) {
    return true;
  }

  if ((metrics.voiceConsistencyScore ?? 0) < config.criticalThresholds.voiceConsistency) {
    return true;
  }

  // Check for critical pattern detections
  if (metrics.originalityScore.genericPatternsDetected?.length > 0) {
    return true;
  }

  if (metrics.originalityScore.mechanicalStructuresDetected?.length > 0) {
    return true;
  }

  if (metrics.originalityScore.derivativeContentFlags?.length > 0) {
    return true;
  }

  return false;
}

/**
 * Builds enhanced constraints based on failure types
 */
function buildEnhancedConstraints(
  failures: string[],
  metrics: ChapterQualityMetrics,
  chapterContent?: string
): string[] {
  const constraints: string[] = [];

  // Check for specific repetition warnings
  if (chapterContent) {
    const repetitionReport = detectRepetitions(chapterContent);
    
    if (repetitionReport.repeatedPhrases.length > 0) {
      constraints.push('CRITICAL: AVOID REPETITION - The following phrases were repeated: ' + repetitionReport.repeatedPhrases.join(', ') + '. Use varied vocabulary and completely rephrase these concepts.');
      constraints.push('Track your key phrases and find synonyms or alternative expressions. Never use the exact same phrase more than once in 3 paragraphs.');
    }
    
    if (repetitionReport.overexplanationCount > 20) {
      constraints.push('CRITICAL: REDUCE EXPLANATION - Too many explanatory phrases detected (' + repetitionReport.overexplanationCount + '). Show, don\'t tell. Remove excessive because/since/as explanations.');
      constraints.push('Instead of explaining, demonstrate through action, dialogue, or sensory details. Let readers infer meaning.');
    }
    
    if (repetitionReport.paragraphsWithSimilarSentences > 5) {
      constraints.push('CRITICAL: VARY SENTENCE LENGTHS - ' + repetitionReport.paragraphsWithSimilarSentences + ' paragraphs have similar-length sentences.');
      constraints.push('Each paragraph MUST contain: 1-2 short sentences (3-5 words), 2-3 medium sentences (10-15 words), and 1 long sentence (25-30+ words).');
      constraints.push('Example: "He ran. The stones crumbled beneath his feet as he sprinted through the dark corridor, his heart pounding like a drum."');
    }
    
    if (repetitionReport.toneInconsistency) {
      constraints.push('CRITICAL: FIX TONE INCONSISTENCY - ' + repetitionReport.toneInconsistency);
      constraints.push('Maintain consistent tone throughout. If casual tone is intended, use natural dialogue and flowing descriptions.');
    }
  }

  // Originality failures
  if (metrics.originalityScore.overallOriginality < QUALITY_CONFIG.criticalThresholds.originality) {
    constraints.push('CRITICAL: Originality score is too low. Include more novel metaphors, unique imagery, and creative scene construction.');
    constraints.push('Avoid generic patterns and derivative content. Create fresh, unexpected comparisons and imagery.');
  }

  if (metrics.originalityScore.genericPatternsDetected?.length > 0) {
    constraints.push(`CRITICAL: Generic patterns detected: ${metrics.originalityScore.genericPatternsDetected.join(', ')}. Avoid these patterns completely.`);
  }

  if (metrics.originalityScore.mechanicalStructuresDetected?.length > 0) {
    constraints.push(`CRITICAL: Mechanical structures detected: ${metrics.originalityScore.mechanicalStructuresDetected.join(', ')}. Create more varied and natural structures.`);
  }

  if (metrics.originalityScore.derivativeContentFlags?.length > 0) {
    constraints.push(`CRITICAL: Derivative content detected: ${metrics.originalityScore.derivativeContentFlags.join(', ')}. Create original content instead.`);
  }

  // Narrative craft failures
  if (metrics.narrativeCraftScore.overallCraftScore < QUALITY_CONFIG.criticalThresholds.narrativeCraft) {
    constraints.push('CRITICAL: Narrative craft score is too low. Improve sentence variation, subtext, interiority, and dialogue naturalness.');
    
    if (metrics.narrativeCraftScore.burstinessScore < 60) {
      constraints.push('CRITICAL: Sentence length variation insufficient. Dramatically vary sentence lengths - mix very short (3-5 words) with longer (25-30+ words) sentences.');
    }
    
    if (metrics.narrativeCraftScore.subtextScore < 50) {
      constraints.push('CRITICAL: Insufficient subtext. Add at least 3 instances of subtext in dialogue or scenes. Characters should rarely say exactly what they mean.');
    }
    
    if (metrics.narrativeCraftScore.interiorityScore < 50) {
      constraints.push('CRITICAL: Insufficient character interiority. At least 40% of paragraphs should contain character thoughts, feelings, or internal reactions.');
    }
    
    if (metrics.narrativeCraftScore.dialogueNaturalnessScore < 50) {
      constraints.push('CRITICAL: Dialogue too formal. Add interruptions (12-18% of dialogue exchanges using dashes — or ellipses ...), ambiguity (maybe, perhaps, sort of, you know), and natural speech patterns. Characters should rarely speak perfectly - include incomplete thoughts and interruptions.');
      constraints.push('Examples of natural dialogue: "I was trying to—" "Not now!" he cut her off. OR "Maybe it\'s not what you think?" OR "Well, I sort of thought we could, you know, talk about this."');
    }
  }

  // Voice consistency failures
  if (metrics.voiceConsistencyScore < QUALITY_CONFIG.criticalThresholds.voiceConsistency) {
    constraints.push('CRITICAL: Voice consistency score is too low. Match the established authorial voice profile more closely.');
    constraints.push('Maintain sentence complexity, emotional tone, and stylistic quirks from previous chapters.');
  }

  // Specific issues from warnings - map to targeted constraints
  if (metrics.warnings?.length > 0) {
    // Transition quality warnings
    const transitionWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('transition') || 
      w.toLowerCase().includes('opening') ||
      w.toLowerCase().includes('chapter opening')
    );
    if (transitionWarnings.length > 0) {
      constraints.push('CRITICAL: Chapter transition issues detected. The first 2-3 sentences MUST explicitly reference or continue from the previous chapter\'s ending. Start with character action, dialogue, or thought - NOT description, weather, or time-of-day clichés.');
      constraints.push('Examples of good transitions: Reference the previous chapter\'s last situation directly. "His hand trembled as he reached for the doorknob..." (continuing from previous chapter\'s ending).');
    }
    
    // Dialogue naturalness warnings
    const dialogueWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('dialogue naturalness') || 
      w.toLowerCase().includes('dialogue may be too formal') ||
      w.toLowerCase().includes('low dialogue naturalness')
    );
    if (dialogueWarnings.length > 0) {
      constraints.push('CRITICAL: Dialogue naturalness issues detected. Add interruptions (use dashes — or ellipses ...), ambiguity (maybe, perhaps, sort of, you know, I think), and natural speech patterns. Include incomplete thoughts and varied character voices.');
      constraints.push('Target: 12-18% of dialogue exchanges should have interruptions. At least 30% should have subtext or ambiguity.');
    }
    
    // Overexplanation warnings
    const overexplanationWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('overexplanation') || 
      w.toLowerCase().includes('explanatory phrases')
    );
    if (overexplanationWarnings.length > 0) {
      constraints.push('CRITICAL: Overexplanation detected. Limit explanatory phrases (because, in order to, which meant that, this was because, the reason was) to fewer than 5 instances per 1500 words. Show actions and consequences rather than explaining them.');
      constraints.push('Example: Instead of "He was angry because she left" use "His knuckles whitened as he watched her go."');
    }
    
    // Emotional language warnings
    const emotionalWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('emotional language density') || 
      w.toLowerCase().includes('too neutral') ||
      w.toLowerCase().includes('low emotional')
    );
    if (emotionalWarnings.length > 0) {
      constraints.push('CRITICAL: Low emotional language density detected. Include emotional descriptors (furious, terrified, relieved, anxious, ecstatic, devastated) and sensory details (sights, sounds, smells, textures, tastes) in at least 30% of paragraphs. Avoid neutral, encyclopedia-like prose.');
      constraints.push('Examples: "The metallic taste of fear" instead of "He was afraid", "Her heart hammered" instead of "She was nervous".');
    }
    
    // Repetitive pattern warnings
    const repetitiveWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('repeated phrase') || 
      w.toLowerCase().includes('repetitive pattern') ||
      w.toLowerCase().includes('repeated sentence')
    );
    if (repetitiveWarnings.length > 0) {
      constraints.push('CRITICAL: Repetitive patterns detected. Actively vary sentence beginnings, word choices, and phrasing. Avoid repeating the same words or phrases within the chapter.');
      constraints.push('Examples of varied openings: Use character names, actions, dialogue, thoughts, prepositions, questions, etc. to start sentences.');
    }
    
    // Interiority warnings
    const interiorityWarnings = metrics.warnings.filter(w => 
      w.toLowerCase().includes('interiority') || 
      w.toLowerCase().includes('insufficient character interiority')
    );
    if (interiorityWarnings.length > 0) {
      constraints.push('CRITICAL: Insufficient character interiority detected. At least 40% of paragraphs should show what characters are thinking and feeling. Include internal thoughts, reactions, and emotional states throughout.');
    }
    
    // Other critical warnings
    const otherCriticalWarnings = metrics.warnings.filter(w => 
      (w.toLowerCase().includes('critical') || 
       w.toLowerCase().includes('low') ||
       w.toLowerCase().includes('insufficient')) &&
      !w.toLowerCase().includes('transition') &&
      !w.toLowerCase().includes('dialogue') &&
      !w.toLowerCase().includes('overexplanation') &&
      !w.toLowerCase().includes('emotional') &&
      !w.toLowerCase().includes('repetitive') &&
      !w.toLowerCase().includes('interiority')
    );
    if (otherCriticalWarnings.length > 0) {
      constraints.push(`IMPORTANT: Address these issues: ${otherCriticalWarnings.slice(0, 3).join('; ')}`);
    }
  }

  // Parse failures array for specific patterns
  if (failures.length > 0) {
    const failureText = failures.join(' ').toLowerCase();
    
    if (failureText.includes('burstiness')) {
      constraints.push('CRITICAL: Burstiness violations detected. Dramatically vary sentence lengths - mix very short (3-5 words) with longer (25-30+ words) sentences. Avoid sequences of similar-length sentences.');
    }
    
    if (failureText.includes('perplexity')) {
      constraints.push('CRITICAL: Perplexity violations detected. Use varied vocabulary - replace repeated words with synonyms. Occasionally use slightly less common but appropriate words to create unpredictability.');
    }
    
    if (failureText.includes('blacklist')) {
      constraints.push('CRITICAL: Blacklist violations detected. Avoid forbidden words and structures. Use visceral, specific verbs instead of vague ones (e.g., "shoved" instead of "pushed").');
    }
    
    if (failureText.includes('mechanical')) {
      constraints.push('CRITICAL: Mechanical structures detected. Create more varied and natural structures. Avoid formulaic patterns and repetitive constructions.');
    }
    
    if (failureText.includes('derivative')) {
      constraints.push('CRITICAL: Derivative content detected. Create original content with unique combinations. Avoid generic patterns and common tropes.');
    }
    
    // Thread progression failures
    if (failureText.includes('thread') || failureText.includes('stalled') || failureText.includes('plot hole')) {
      constraints.push('CRITICAL: Story thread progression issues detected. This chapter MUST progress at least 2 story threads meaningfully.');
      constraints.push('Include direct scenes, dialogue, or plot developments that advance stalled narrative threads.');
    }
    
    // Word count failures
    if (failureText.includes('word count') || failureText.includes('minimum word')) {
      constraints.push('CRITICAL: Word count insufficient. Write AT LEAST 1600 words. Include more sensory details, character interiority, and expanded dialogue.');
    }
    
    // Lexical balance failures
    if (failureText.includes('lexical balance') || failureText.includes('lexical density')) {
      constraints.push('CRITICAL: Lexical balance issues. Vary your vocabulary - use synonyms instead of repeating words. Mix common and less common words naturally.');
    }
  }

  return constraints;
}

/**
 * Regenerates a chapter with enhanced constraints
 */
async function regenerateChapter(
  chapter: Chapter,
  state: NovelState,
  failures: string[],
  config: RegenerationConfig,
  attemptNumber: number,
  userInstruction?: string
): Promise<Chapter> {
  // Build enhanced prompt with failure-specific constraints
  const basePrompt = await buildChapterPrompt(state, userInstruction || 'Regenerate with improved quality and originality');
  
  // Add enhanced constraints based on failures and chapter content
  const metrics: ChapterQualityMetrics = {
    chapterId: chapter.id,
    qualityCheck: {
      isValid: false,
      warnings: failures,
      suggestions: []
    },
    originalityScore: {
      overallOriginality: 50,
      genericPatternsDetected: [],
      mechanicalStructuresDetected: [],
      derivativeContentFlags: []
    },
    narrativeCraftScore: {
      overallCraftScore: 50,
      burstinessScore: 50,
      subtextScore: 50,
      interiorityScore: 50,
      dialogueNaturalnessScore: 50
    },
    voiceConsistencyScore: 50
  };
  
  const enhancedConstraints = buildEnhancedConstraints(failures, metrics, chapter.content);
  
  // Append constraints to the prompt
  const enhancedPrompt = {
    ...basePrompt,
    systemInstruction: basePrompt.systemInstruction + '\n\n' + enhancedConstraints.join('\n')
  };
  
  // Generate new chapter with enhanced constraints
  const result = await generateNextChapter(state, userInstruction || 'Regenerate with improved quality and originality');
  
  // Return the regenerated chapter
  return {
    ...chapter,
    content: result?.chapterContent || chapter.content,
    title: result?.chapterTitle || chapter.title,
    summary: result?.chapterSummary || chapter.summary,
    logicAudit: result?.logicAudit
  };
}

/**
 * Regenerates chapter with quality check loop
 */
export async function regenerateWithQualityCheck(
  chapter: Chapter,
  state: NovelState,
  metrics: ChapterQualityMetrics,
  config: RegenerationConfig = QUALITY_CONFIG
): Promise<RegenerationResult> {
  const regenerationHistory: Array<{
    attempt: number;
    metrics: ChapterQualityMetrics;
    reasons: string[];
  }> = [];

  let currentChapter = chapter;
  let currentMetrics = metrics;
  let attempts = 0;
  const maxAttempts = config.maxAttempts;

  while (attempts < maxAttempts && shouldRegenerate(currentMetrics, config)) {
    attempts++;
    
    console.log(`[Regeneration] Attempt ${attempts}/${maxAttempts} for chapter ${chapter.number}`);
    console.log(`[Regeneration] Reasons: ${currentMetrics.regenerationReasons?.join('; ') || 'No reasons specified'}`);

    try {
      // Record current attempt
      regenerationHistory.push({
        attempt: attempts,
        metrics: currentMetrics,
        reasons: [...(currentMetrics.regenerationReasons || [])],
      });

      // Regenerate chapter
      const regeneratedChapter = await regenerateChapter(
        currentChapter,
        state,
        currentMetrics.regenerationReasons || [],
        config,
        attempts
      );

      // Validate regenerated chapter
      const newMetrics = await validateChapterQuality(regeneratedChapter, state);

      // Check if regeneration improved quality compared to previous attempt
      const improved = 
        newMetrics.originalityScore.overallOriginality > currentMetrics.originalityScore.overallOriginality ||
        newMetrics.narrativeCraftScore.overallCraftScore > currentMetrics.narrativeCraftScore.overallCraftScore ||
        newMetrics.voiceConsistencyScore > currentMetrics.voiceConsistencyScore;

      currentChapter = regeneratedChapter;
      currentMetrics = newMetrics;

      if (improved && !shouldRegenerate(newMetrics, config)) {
        // Success - quality improved and no longer needs regeneration
        console.log(`[Regeneration] Success on attempt ${attempts} - quality improved`);
        return {
          success: true,
          chapter: currentChapter,
          attempts,
          finalMetrics: currentMetrics,
          regenerationHistory,
        };
      }

      // If we've reached max attempts, return best version
      if (attempts >= maxAttempts) {
        console.log(`[Regeneration] Max attempts reached (${maxAttempts})`);
        // Return the version with highest scores
        const bestMetrics = regenerationHistory
          .map(h => h.metrics)
          .concat([currentMetrics])
          .sort((a, b) => {
            const scoreA = a.originalityScore.overallOriginality + 
                          a.narrativeCraftScore.overallCraftScore + 
                          a.voiceConsistencyScore;
            const scoreB = b.originalityScore.overallOriginality + 
                          b.narrativeCraftScore.overallCraftScore + 
                          b.voiceConsistencyScore;
            return scoreB - scoreA;
          })[0];

        return {
          success: bestMetrics.originalityScore.overallOriginality > metrics.originalityScore.overallOriginality ||
                   bestMetrics.narrativeCraftScore.overallCraftScore > metrics.narrativeCraftScore.overallCraftScore,
          chapter: currentChapter,
          attempts,
          finalMetrics: currentMetrics,
          regenerationHistory,
        };
      }
    } catch (error) {
      console.error(`[Regeneration] Error on attempt ${attempts}:`, error);
      // Continue to next attempt or return current best
      if (attempts >= maxAttempts) {
        return {
          success: false,
          chapter: currentChapter,
          attempts,
          finalMetrics: currentMetrics,
          regenerationHistory,
        };
      }
    }
  }

  // If we exit the loop, check if we succeeded
  const success = !shouldRegenerate(currentMetrics, config);

  return {
    success,
    chapter: success ? currentChapter : chapter, // Return original if regeneration failed
    attempts,
    finalMetrics: currentMetrics,
    regenerationHistory,
  };
}

/**
 * Regenerates a chapter with improved AI detection evasion settings
 * This function uses all the enhanced AI detection techniques to regenerate existing chapters
 */
export async function regenerateChapterWithImprovedSettings(
  chapterId: string,
  state: NovelState,
  opts?: {
    onPhase?: (phase: string, data?: Record<string, unknown>) => void;
    onProgress?: (message: string, progress: number) => void;
  }
): Promise<{ success: boolean; chapter: Chapter; oldMetrics?: any; newMetrics?: any }> {
  const chapter = state.chapters.find(ch => ch.id === chapterId);
  if (!chapter) {
    throw new Error(`Chapter ${chapterId} not found`);
  }

  opts?.onProgress?.('Analyzing existing chapter...', 10);
  
  // Get old metrics for comparison
  const oldMetrics = await validateChapterQuality(chapter, state);
  const oldAIScore = calculateAIDetectionScore(chapter, oldMetrics);
  
  opts?.onProgress?.('Regenerating chapter with improved AI detection evasion...', 30);
  
  // Create a modified state that excludes the chapter we're regenerating
  // This allows us to regenerate it as if it's the next chapter
  const chaptersBefore = state.chapters.filter(ch => ch.number < chapter.number);
  const modifiedState: NovelState = {
    ...state,
    chapters: chaptersBefore,
  };
  
  // Generate new chapter using improved settings
  // The generateNextChapter function will use all the improved AI detection evasion techniques
  const { generateNextChapter } = await import('./aiService');
  
  const result = await generateNextChapter(modifiedState, 
    `Regenerate Chapter ${chapter.number} with improved human-like writing patterns. ` +
    `Apply all AI detection evasion techniques: vary sentence length dramatically, ` +
    `use diverse vocabulary, include sentence fragments, add dialogue interruptions, ` +
    `and ensure natural writing imperfections.`,
    {
      onPhase: (phase, data) => {
        opts?.onPhase?.(phase, data);
        if (phase === 'pass_4_humanization_end') {
          opts?.onProgress?.('Humanization pass complete', 80);
        }
      },
    }
  );
  
  if (!result) {
    throw new Error('Failed to regenerate chapter - generation returned null');
  }
  
  // Validate result structure
  if (!result.content || result.content.trim().length === 0) {
    throw new Error('Failed to regenerate chapter - generated content is empty');
  }
  
  opts?.onProgress?.('Validating regenerated chapter...', 90);
  
  // Create new chapter object (result is already a Chapter from generateNextChapter)
  const newChapter: Chapter = {
    id: chapter.id, // Keep same ID
    number: chapter.number, // Keep same number
    title: result.title || chapter.title,
    content: result.content,
    summary: result.summary || chapter.summary,
    logicAudit: result.logicAudit || chapter.logicAudit,
    scenes: chapter.scenes, // Preserve scenes
    createdAt: chapter.createdAt,
  };
  
  // Validate minimum word count
  const wordCount = newChapter.content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 1500) {
    console.warn(`[Regeneration] Regenerated chapter has only ${wordCount} words (minimum: 1500)`);
  }
  
  // Get new metrics
  const newMetrics = await validateChapterQuality(newChapter, state);
  const newAIScore = calculateAIDetectionScore(newChapter, newMetrics);
  
  // Compare AI detection scores
  const aiComparison = compareAIDetectionScores(oldAIScore, newAIScore);
  
  // Compare scores
  const improved = 
    newMetrics.originalityScore.overallOriginality > oldMetrics.originalityScore.overallOriginality ||
    newMetrics.narrativeCraftScore.overallCraftScore > oldMetrics.narrativeCraftScore.overallCraftScore ||
    newMetrics.voiceConsistencyScore > oldMetrics.voiceConsistencyScore ||
    (newMetrics.narrativeCraftScore.burstinessScore > oldMetrics.narrativeCraftScore.burstinessScore) ||
    (newMetrics.narrativeCraftScore.perplexityScore > oldMetrics.narrativeCraftScore.perplexityScore) ||
    aiComparison.improved; // AI detection score improvement
  
  opts?.onProgress?.('Regeneration complete', 100);
  
  // Log AI detection score comparison
  console.log(`[AI Detection] Old score: ${oldAIScore.overallScore}%, New score: ${newAIScore.overallScore}%`);
  if (aiComparison.improved) {
    console.log(`[AI Detection] Improved by ${aiComparison.improvementPercentage}%`);
    aiComparison.improvements.forEach(imp => console.log(`  - ${imp}`));
  }
  if (aiComparison.regressions?.length > 0) {
    console.log(`[AI Detection] Regressions:`);
    aiComparison.regressions.forEach(reg => console.log(`  - ${reg}`));
  }
  
  return {
    success: improved,
    chapter: newChapter,
    oldMetrics: { ...oldMetrics, aiDetectionScore: oldAIScore },
    newMetrics: { ...newMetrics, aiDetectionScore: newAIScore },
  };
}

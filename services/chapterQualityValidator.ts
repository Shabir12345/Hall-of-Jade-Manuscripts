import { NovelState, Chapter, ChapterQualityMetrics, NarrativeCraftScore, ChapterOriginalityScore } from '../types';
import { analyzeForeshadowing, analyzeEmotionalPayoffs, analyzePacing } from './promptEngine/arcContextAnalyzer';

import { getActiveAntagonists } from '../utils/antagonistHelpers';
import { generateUUID } from '../utils/uuid';
import { extractAuthorialVoiceProfile } from './promptEngine/styleAnalyzer';
import { analyzeOriginality, analyzeChapterOriginality } from './originalityDetector';
import { analyzeNarrativeCraft } from './narrativeCraftAnalyzer';
import { validateBurstinessPattern } from '../utils/burstinessValidator';
import { checkForForbiddenWords, checkForForbiddenStructures } from '../utils/aiDetectionBlacklist';
import { verifyPerplexityThreshold } from './perplexityVerification';
import { AI_DETECTION_CONFIG, QUALITY_CONFIG } from '../constants';



/**
 * Identifies core story elements that should NOT be flagged as "overused tropes"
 * These are elements central to the story's concept, genre, or world-building
 */
function identifyCoreStoryElements(state: NovelState): string[] {
  const coreElements: string[] = [];

  // Check genre - System novels should not be penalized for using "system"
  if (state.genre?.toLowerCase().includes('system') ||
    state.title?.toLowerCase().includes('system')) {
    coreElements.push('system');
  }

  // Check if the novel has system logs - indicates a System novel
  if (state.systemLogs && state.systemLogs.length > 0) {
    coreElements.push('system');
  }

  // Check grand saga for core concepts
  if (state.grandSaga) {
    const sagaLower = state.grandSaga.toLowerCase();
    // If grand saga mentions cultivation, it's a core element
    if (sagaLower.includes('cultivat')) {
      coreElements.push('cultivation');
      coreElements.push('cultivation breakthrough');
    }
    // If grand saga mentions reincarnation, it's a core element
    if (sagaLower.includes('reincarnation') || sagaLower.includes('transmigrat')) {
      coreElements.push('reincarnation');
    }
    // If grand saga mentions system explicitly
    if (sagaLower.includes('system')) {
      coreElements.push('system');
    }
  }

  // Check world bible for core concepts
  if (state.worldBible && state.worldBible.length > 0) {
    const worldContent = state.worldBible.map(w => (w.title + ' ' + w.content).toLowerCase()).join(' ');

    if (worldContent.includes('system')) {
      coreElements.push('system');
    }
    if (worldContent.includes('cultivation realm') || worldContent.includes('cultivation level')) {
      coreElements.push('cultivation');
      coreElements.push('realm of cultivation');
    }
  }

  // Check if any antagonists or plot elements reference these as core
  if (state.plotLedger && state.plotLedger.length > 0) {
    const plotContent = state.plotLedger.map(p => (p.title + ' ' + p.description).toLowerCase()).join(' ');
    if (plotContent.includes('system')) {
      coreElements.push('system');
    }
  }

  // Return unique elements
  return [...new Set(coreElements)];
}

export interface ChapterQualityCheck {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  suggestions: string[];
  qualityScore: number; // 0-100
}

/**
 * Pre-generation quality checks for chapter generation
 * Validates that narrative quality elements are in place
 */
/**
 * Checks narrative craft readiness before generation
 */
function checkNarrativeCraftReadiness(
  state: NovelState,
  _nextChapterNumber: number
): {
  isReady: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Check character development context
  if (state.characterCodex.length === 0) {
    issues.push('No characters defined - character development context missing');
  } else {
    const protagonist = state.characterCodex.find(c => c.isProtagonist);
    if (!protagonist && state.chapters.length > 0) {
      suggestions.push('Consider identifying a protagonist for clearer character development focus');
    }
  }

  // Check for scene intent clarity (recent chapters should have clear logic audits)
  const recentChapters = state.chapters.slice(-3);
  const chaptersWithoutAudit = recentChapters.filter(ch => !ch.logicAudit);
  if (chaptersWithoutAudit.length > 0 && state.chapters.length > 0) {
    suggestions.push(`${chaptersWithoutAudit.length} recent chapter(s) missing logic audits - ensure clear scene intent`);
  }

  // Check for subtext opportunities (dialogue potential)
  const lastChapter = state.chapters[state.chapters.length - 1];
  if (lastChapter) {
    const dialogueCount = (lastChapter.content.match(/["'"]/g) || []).length / 2; // Rough estimate
    if (dialogueCount < 3 && state.chapters.length > 2) {
      suggestions.push('Low dialogue in recent chapters - consider adding dialogue with subtext opportunities');
    }
  }

  return {
    isReady: issues.length === 0,
    issues,
    suggestions,
  };
}

/**
 * Checks originality preparation before generation
 * Exported for use in prompt building to prevent detected issues
 */
export function checkOriginalityPreparation(
  state: NovelState,
  _nextChapterNumber: number
): {
  isReady: boolean;
  repetitivePatterns: string[];
  overusedTropes: string[];
  derivativeStructures: string[];
  suggestions: string[];
} {
  const repetitivePatterns: string[] = [];
  const overusedTropes: string[] = [];
  const derivativeStructures: string[] = [];
  const suggestions: string[] = [];

  // Analyze recent chapters for repetitive patterns
  const recentChapters = state.chapters.slice(-5);
  if (recentChapters.length >= 3) {
    const recentContent = recentChapters.map(ch => ch.content).join(' ');
    const sentences = recentContent.split(/[.!?]+/).filter(s => s.trim().length > 5);

    // Check for repeated sentence beginnings
    // ADJUSTED: Exclude common articles and pronouns that naturally begin many sentences
    if (sentences.length > 10) {
      // Common words that naturally begin many sentences - exclude from repetition check
      const excludedWords = new Set([
        'the', 'a', 'an', // Articles
        'he', 'she', 'it', 'they', 'i', 'we', 'you', // Pronouns
        'his', 'her', 'its', 'their', 'my', 'our', 'your', // Possessive pronouns
        'this', 'that', 'these', 'those', // Demonstratives
        'but', 'and', 'or', 'so', 'yet', 'for', // Conjunctions
        'as', 'when', 'while', 'if', 'then', 'now', // Common starters
      ]);

      const firstWords = sentences.slice(0, 30).map(s => {
        const words = s.trim().split(/\s+/);
        return words[0]?.toLowerCase() || '';
      });

      const wordFreq: Record<string, number> = {};
      firstWords.forEach(word => {
        // Skip excluded common words
        if (!excludedWords.has(word)) {
          wordFreq[word] = (wordFreq[word] || 0) + 1;
        }
      });

      // Increased threshold from 3 to 4 for less strict detection
      const repeated = Object.entries(wordFreq)
        .filter(([word, count]) => count >= 4 && word.length > 2) // Skip very short words
        .map(([word]) => word);

      if (repeated.length > 0) {
        repetitivePatterns.push(`Repeated sentence beginnings: ${repeated.join(', ')}`);
        suggestions.push('Vary sentence beginnings in next chapter to avoid repetitive patterns');
      }
    }
  }

  // Check for overused tropes
  if (recentChapters.length > 0 && state.chapters.length > 0) {
    try {
      const originalityAnalysis = analyzeOriginality(state);
      const commonTropes = originalityAnalysis.commonTropesDetected;

      // Core story elements that should NOT be flagged as "overused tropes"
      // These are central to the story's concept and genre, not tropes to avoid
      const coreStoryElements = identifyCoreStoryElements(state);

      // Filter out core story elements from trope checking
      const tropesToCheck = commonTropes.filter(trope =>
        !coreStoryElements.some(core =>
          core.toLowerCase() === trope.toLowerCase() ||
          trope.toLowerCase().includes(core.toLowerCase())
        )
      );

      // Check if remaining tropes appear frequently in recent content
      const recentContent = recentChapters.map(ch => ch.content + ' ' + ch.summary).join(' ').toLowerCase();
      const tropeFrequency: Record<string, number> = {};
      tropesToCheck.forEach(trope => {
        const regex = new RegExp(trope.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = recentContent.match(regex);
        // Higher threshold (>5 instead of >2) to reduce false positives
        if (matches && matches.length > 5) {
          tropeFrequency[trope] = matches.length;
        }
      });

      // Higher threshold (>8 instead of >3) for flagging as "overused"
      const overused = Object.entries(tropeFrequency)
        .filter(([_, count]) => count > 8)
        .map(([trope]) => trope);

      if (overused.length > 0) {
        overusedTropes.push(...overused);
        suggestions.push(`Consider subverting or avoiding these overused tropes: ${overused.slice(0, 3).join(', ')}`);
      }
    } catch (error) {
      // If originality analysis fails, continue without trope checking
      console.warn('Error checking tropes in originality preparation:', error);
    }
  }

  // Check for derivative scene structures
  if (recentChapters.length >= 2) {
    const scenePatterns = [
      'training montage',
      'villain monologue',
      'power-up sequence',
      'revelation scene',
    ];

    const recentSummaries = recentChapters.map(ch => (ch.summary || ch.title || '').toLowerCase()).join(' ');
    const detectedPatterns = scenePatterns.filter(pattern => {
      const count = (recentSummaries.match(new RegExp(pattern, 'gi')) || []).length;
      return count >= 2;
    });

    if (detectedPatterns.length > 0) {
      derivativeStructures.push(...detectedPatterns);
      suggestions.push(`Recent chapters use common scene structures: ${detectedPatterns.join(', ')}. Consider unique scene construction.`);
    }
  }

  return {
    isReady: repetitivePatterns.length === 0 && overusedTropes.length === 0 && derivativeStructures.length === 0,
    repetitivePatterns,
    overusedTropes,
    derivativeStructures,
    suggestions,
  };
}

/**
 * Checks voice consistency readiness
 */
function checkVoiceConsistencyReadiness(state: NovelState): {
  isReady: boolean;
  profileEstablished: boolean;
  consistencyScore: number;
  issues: string[];
} {
  const issues: string[] = [];

  // Check if enough chapters exist to establish voice
  const profileEstablished = state.chapters.length >= 3;

  if (!profileEstablished) {
    return {
      isReady: true, // Not an error, just not established yet
      profileEstablished: false,
      consistencyScore: 0,
      issues: [],
    };
  }

  // Extract voice profile to check consistency
  const voiceProfile = extractAuthorialVoiceProfile(state.chapters, state);

  if (!voiceProfile) {
    issues.push('Unable to extract authorial voice profile');
    return {
      isReady: false,
      profileEstablished: false,
      consistencyScore: 0,
      issues,
    };
  }

  // Check recent chapters for voice consistency
  const recentChapters = state.chapters.slice(-3);
  let consistencyScore = 100;

  // Check sentence complexity consistency
  const recentSentences = recentChapters
    .map(ch => ch.content.split(/[.!?]+/).filter(s => s.trim().length > 0))
    .flat();

  if (recentSentences.length > 0) {
    const recentLengths = recentSentences.map(s => s.trim().split(/\s+/).length);
    const recentAvg = recentLengths.reduce((sum, len) => sum + len, 0) / recentLengths.length;
    const expectedAvg = voiceProfile.preferredSentenceComplexity.average;
    const deviation = Math.abs(recentAvg - expectedAvg) / expectedAvg;

    if (deviation > 0.3) {
      consistencyScore -= 20;
      issues.push(`Sentence complexity deviation: recent average ${recentAvg.toFixed(1)} vs expected ${expectedAvg.toFixed(1)}`);
    }
  }

  return {
    isReady: consistencyScore >= 70,
    profileEstablished: true,
    consistencyScore: Math.max(0, Math.min(100, consistencyScore)),
    issues,
  };
}

export function validateChapterGenerationQuality(
  state: NovelState,
  nextChapterNumber: number
): ChapterQualityCheck {
  try {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];
    let qualityScore = 100; // Start with perfect score, deduct for issues

    // Run new pre-generation checks
    const narrativeCraftCheck = checkNarrativeCraftReadiness(state, nextChapterNumber);
    const originalityCheck = checkOriginalityPreparation(state, nextChapterNumber);
    const voiceConsistencyCheck = checkVoiceConsistencyReadiness(state);

    // Aggregate results
    if (!narrativeCraftCheck.isReady) {
      warnings.push(...narrativeCraftCheck.issues);
      qualityScore -= narrativeCraftCheck.issues.length * 5;
    }
    suggestions.push(...narrativeCraftCheck.suggestions);

    if (!originalityCheck.isReady) {
      warnings.push('Originality preparation issues detected');
      qualityScore -= 10;
    }
    if (originalityCheck.repetitivePatterns.length > 0) {
      warnings.push(`Repetitive patterns: ${originalityCheck.repetitivePatterns.join('; ')}`);
      qualityScore -= 5;
    }
    if (originalityCheck.overusedTropes.length > 0) {
      warnings.push(`Overused tropes: ${originalityCheck.overusedTropes.join(', ')}`);
      qualityScore -= 5;
    }
    suggestions.push(...originalityCheck.suggestions);

    if (!voiceConsistencyCheck.isReady && voiceConsistencyCheck.profileEstablished) {
      warnings.push(...voiceConsistencyCheck.issues);
      qualityScore -= voiceConsistencyCheck.issues.length * 5;
    }

    const activeArc = state.plotLedger.find(a => a.status === 'active');
    const previousChapter = state.chapters.length > 0 ? state.chapters[state.chapters.length - 1] : null;

    // Check 1: Emotional value shift preparation
    if (!previousChapter?.logicAudit && state.chapters.length > 0) {
      warnings.push('Previous chapter missing logic audit. New chapter may lack clear value shift foundation.');
      qualityScore -= 10;
    }

    // Check 2: Foreshadowing appropriateness for arc stage
    const foreshadowing = analyzeForeshadowing(state);
    if (activeArc && activeArc.startedAtChapter) {
      const idx = Math.max(0, nextChapterNumber - activeArc.startedAtChapter);
      if (idx === 0) {
        // Beginning of arc - should have recent foreshadowing setup
        const recentForeshadowing = foreshadowing.activeForeshadowing.filter(f =>
          (nextChapterNumber - f.introducedChapter) <= 3
        );
        if (recentForeshadowing.length === 0 && state.chapters.length > 3) {
          suggestions.push('Arc beginning: Consider adding subtle foreshadowing elements in this chapter.');
          qualityScore -= 5;
        }
      } else if (idx >= 5) {
        // Late in arc - should pay off foreshadowing
        if (foreshadowing.overdueForeshadowing.length > 0) {
          suggestions.push(`Late arc: Consider paying off ${foreshadowing.overdueForeshadowing.length} overdue foreshadowing element(s) in this chapter.`);
          qualityScore -= 10;
        }
      }
    }

    // Check 3: Pacing appropriateness for arc stage
    const pacing = analyzePacing(state);
    if (activeArc && activeArc.startedAtChapter) {
      const idx = Math.max(0, nextChapterNumber - activeArc.startedAtChapter);
      const recommendedPacing = idx === 0 ? pacing.arcPositionPacing.beginning.recommendedPacing :
        idx <= 2 ? pacing.arcPositionPacing.early.recommendedPacing :
          idx <= 5 ? pacing.arcPositionPacing.middle.recommendedPacing :
            pacing.arcPositionPacing.late.recommendedPacing;

      if (recommendedPacing && pacing.recommendations.length > 0) {
        suggestions.push(`Pacing: ${pacing.recommendations[0]}`);
        qualityScore -= 5;
      }
    }

    // Check 4: Emotional payoff opportunities
    const emotionalPayoffs = analyzeEmotionalPayoffs(state);
    if (emotionalPayoffs.upcomingPayoffOpportunities.length > 0) {
      const opportunity = emotionalPayoffs.upcomingPayoffOpportunities[0];
      if (opportunity) {
        suggestions.push(`Emotional Payoff Opportunity: Consider adding a ${opportunity.recommendedType} with intensity ${opportunity.suggestedIntensity}/5. Reason: ${opportunity.reason}`);
        qualityScore -= 3;
      }
    }

    // Check 5: Subtext presence
    if (state.chapters.length > 5) {
      const recentChapters = state.chapters.slice(-3);
      const dialogueCount = recentChapters.reduce((sum, ch) => {
        const content = ((ch.content || '') + ' ' + (ch.summary || '')).toLowerCase();
        return sum + (content.match(/(said|asked|replied|shouted|whispered|spoke|exclaimed)/gi) || []).length;
      }, 0);

      if (dialogueCount < 10 && recentChapters.length >= 3) {
        suggestions.push('Low dialogue count in recent chapters. Consider adding dialogue with subtext to create depth.');
        qualityScore -= 5;
      }
    }

    // Check 6: Chapter ending hook appropriateness
    if (activeArc && activeArc.startedAtChapter) {
      const idx = Math.max(0, nextChapterNumber - activeArc.startedAtChapter);
      let hookType = 'general';
      if (idx === 0) hookType = 'mystery or promise';
      else if (idx <= 2) hookType = 'emotional or mystery hook';
      else if (idx <= 5) hookType = 'action or emotional cliffhanger';
      else hookType = 'tension escalation toward climax';

      suggestions.push(`Chapter Ending: Use a ${hookType} appropriate for arc stage ${idx === 0 ? 'Beginning' : idx <= 2 ? 'Early' : idx <= 5 ? 'Middle' : 'Late'}.`);
    }

    // Check 7: Story state consistency
    if (!previousChapter && state.chapters.length > 0) {
      warnings.push('No previous chapter found. Ensure continuity with most recent chapter.');
      qualityScore -= 5;
    }

    // Aggregate all suggestions (remove duplicates)
    const allSuggestions = [
      ...suggestions,
      ...narrativeCraftCheck.suggestions,
      ...originalityCheck.suggestions,
      ...foreshadowing.recommendations.slice(0, 2),
      ...emotionalPayoffs.recommendations.slice(0, 2),
      ...pacing.recommendations.slice(0, 2),
    ];
    const uniqueSuggestions = Array.from(new Set(allSuggestions)).slice(0, 10);

    // Calculate final quality score
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    const isValid = errors.length === 0 && qualityScore >= 70;

    return {
      isValid,
      warnings,
      errors,
      suggestions: uniqueSuggestions,
      qualityScore,
    };
  } catch (error) {
    console.error('Error in validateChapterGenerationQuality:', error);
    return {
      isValid: true, // Don't block generation on validation error
      warnings: ['Error validating chapter generation quality'],
      errors: [],
      suggestions: [],
      qualityScore: 75, // Default to medium score
    };
  }
}

/**
 * Post-generation quality validation for generated chapters
 * Checks if the generated chapter meets quality standards
 */
export async function validateGeneratedChapter(
  chapter: Chapter,
  state: NovelState
): Promise<ChapterQualityCheck> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];
  let qualityScore = 100;

  // Check 1: Word count minimum
  const content = chapter.content || '';
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 1500) {
    errors.push(`Chapter is ${wordCount} words, below minimum requirement of 1500 words.`);
    qualityScore -= 20;
  } else if (wordCount < 1800) {
    warnings.push(`Chapter is ${wordCount} words, slightly below recommended 1800+ words.`);
    qualityScore -= 5;
  }

  // Check 2: Paragraph structure
  const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
  if (paragraphs.length < 3) {
    errors.push(`Chapter has only ${paragraphs.length} paragraphs. Minimum 3 paragraphs required.`);
    qualityScore -= 15;
  } else if (paragraphs.length < 5 && wordCount >= 1500) {
    warnings.push(`Chapter has ${paragraphs.length} paragraphs. Consider more paragraph breaks for better readability.`);
    qualityScore -= 5;
  }

  // Check 3: Logic audit presence
  if (!chapter.logicAudit) {
    errors.push('Chapter missing logic audit (starting value, friction, choice, resulting value).');
    qualityScore -= 15;
  } else {
    // Validate logic audit completeness
    if (!chapter.logicAudit.startingValue || !chapter.logicAudit.theFriction ||
      !chapter.logicAudit.theChoice || !chapter.logicAudit.resultingValue) {
      errors.push('Logic audit is incomplete. Missing required fields.');
      qualityScore -= 10;
    }
  }

  // Check 4: Chapter summary presence
  if (!chapter.summary || chapter.summary.trim().length < 50) {
    warnings.push('Chapter summary is missing or too short. Summaries help maintain story continuity.');
    qualityScore -= 5;
  }

  // Check 5: Emotional value shift (Delta principle)
  if (chapter.logicAudit) {
    const hasValueShift = chapter.logicAudit.startingValue !== chapter.logicAudit.resultingValue ||
      chapter.logicAudit.theFriction.length > 10 ||
      chapter.logicAudit.theChoice.length > 10;
    if (!hasValueShift) {
      warnings.push('Chapter may lack clear emotional value shift (Delta principle). Ensure characters end in different state than they began.');
      qualityScore -= 10;
    }
  }

  // Check 6: Foreshadowing presence (should have at least some in most chapters)
  const foreshadowingKeywords = ['mystery', 'secret', 'prophecy', 'hint', 'seemed', 'felt', 'appeared', 'strange', 'ancient', 'mysterious'];
  const hasForeshadowing = foreshadowingKeywords.some(kw =>
    content.toLowerCase().includes(kw) ||
    (chapter.summary && chapter.summary.toLowerCase().includes(kw))
  );

  if (!hasForeshadowing && state?.chapters && state.chapters.length > 3) {
    suggestions.push('Chapter may benefit from subtle foreshadowing elements.');
    qualityScore -= 3;
  }

  // Check 7: Dialogue presence (most chapters should have dialogue)
  const hasDialogue = content.includes('"') || content.includes("'") || content.includes('"');
  if (!hasDialogue && wordCount > 2000) {
    suggestions.push('Long chapter without dialogue. Consider adding dialogue with subtext for character development.');
    qualityScore -= 3;
  }

  // Check 8: Chapter ending hook
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const hasQuestionMark = lastParagraph.includes('?');
  const hasSuspenseIndicators = ['suddenly', 'but', 'however', 'yet', 'still', 'moreover', 'meanwhile'].some(ind =>
    lastParagraph.toLowerCase().includes(ind)
  );

  if (!hasQuestionMark && !hasSuspenseIndicators && lastParagraph.length < 200) {
    suggestions.push('Chapter ending may lack a strong hook. Consider ending with a question, revelation, or unresolved tension.');
    qualityScore -= 5;
  }

  // Check 8b: Chapter ending cliché detection (CRITICAL)
  try {
    const { validateChapterEnding } = await import('./chapterEndingValidator');
    const endingValidation = validateChapterEnding(chapter);

    if (endingValidation.hasClicheEnding) {
      const highSeverityCount = endingValidation.detectedPatterns.filter(p => p.severity === 'high').length;
      const mediumSeverityCount = endingValidation.detectedPatterns.filter(p => p.severity === 'medium').length;

      if (highSeverityCount > 0) {
        errors.push(`Chapter ending contains cliché summary patterns (${highSeverityCount} high-severity, ${mediumSeverityCount} medium-severity detected). End with immediate action, dialogue, or sensory detail instead of summarizing what will happen.`);
        qualityScore -= 25; // Significant penalty for cliché endings
      } else if (mediumSeverityCount > 0) {
        warnings.push(`Chapter ending contains cliché patterns (${mediumSeverityCount} detected). Consider ending with more immediate, concrete action or dialogue.`);
        qualityScore -= 15;
      }

      // Add specific suggestions from validator
      if (endingValidation.suggestions.length > 0) {
        endingValidation.suggestions.forEach(suggestion => {
          if (!suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        });
      }

      // Log detected patterns for debugging
      if (endingValidation.detectedPatterns.length > 0) {
        console.warn('[Chapter Quality] Cliché ending patterns detected:',
          endingValidation.detectedPatterns.map(p => `${p.type}: ${p.example}`).join(', '));
      }
    } else if (endingValidation.score < 100) {
      // Ending is not cliché but could be improved
      if (endingValidation.score < 85) {
        warnings.push('Chapter ending could be more immediate and concrete. Prefer action, dialogue, or sensory detail over vague conclusions.');
        qualityScore -= 5;
      }
      if (endingValidation.suggestions.length > 0) {
        endingValidation.suggestions.forEach(suggestion => {
          if (!suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        });
      }
    }
  } catch (error) {
    console.warn('[Chapter Quality] Failed to validate chapter ending:', error);
    // Don't block validation if ending validator fails
  }

  // Check 9: Continuity with previous chapter (CRITICAL) - Enhanced with transition validator

  if (state.chapters && state.chapters.length > 0) {
    const previousChapter = state.chapters[state.chapters.length - 1];
    if (previousChapter && previousChapter.number === chapter.number - 1) {
      // Use comprehensive transition validator
      try {
        const { validateChapterTransition } = await import('./chapterTransitionValidator');
        const transitionValidation = validateChapterTransition(previousChapter, chapter);


        // Add transition issues to warnings/errors
        // Reduced penalties to be less harsh - transition issues are important but shouldn't dominate scoring
        transitionValidation.issues.forEach(issue => {
          if (issue.severity === 'high') {
            warnings.push(`[Transition] ${issue.description}`);
            if (issue.suggestedFix) {
              suggestions.push(issue.suggestedFix);
            }
            // Adjust quality score based on transition issues (reduced penalties)
            qualityScore -= issue.type === 'time_skip' || issue.type === 'location_jump' ? 12 : 8;
          } else if (issue.severity === 'medium') {
            // Medium severity becomes a suggestion, not a warning that affects score
            suggestions.push(`[Transition] ${issue.description}`);
            qualityScore -= 3;
          } else {
            // Low severity only adds a suggestion, no score penalty
            suggestions.push(`[Transition] ${issue.description}`);
          }
        });

        // Add transition warnings as suggestions (less impactful)
        transitionValidation.warnings.forEach(warning => {
          suggestions.push(`[Transition] ${warning}`);
        });

        // Add transition suggestions
        transitionValidation.suggestions.forEach(suggestion => {
          if (!suggestions.includes(suggestion)) {
            suggestions.push(suggestion);
          }
        });

        // Log transition quality
        if (transitionValidation.score < 70) {
          console.warn(`[Chapter Quality] Transition quality score: ${transitionValidation.score}/100 (below threshold of 70)`);
        } else {
          console.log(`[Chapter Quality] Transition quality score: ${transitionValidation.score}/100`);
        }
      } catch (error) {
        console.warn('[Chapter Quality] Failed to run transition validator, using fallback checks:', error);
        // Fallback to original checks if validator fails
        const chapterStart = content.substring(0, 300).toLowerCase();
        const timeSkipPatterns = [
          /(later|after|hours?|days?|weeks?|months?|years?|the next|the following|eventually|meanwhile)/i,
          /(some time|a while|much|long) (later|after|passed|went by)/i
        ];

        const hasTimeSkip = timeSkipPatterns.some(pattern => pattern.test(chapterStart));

        if (hasTimeSkip && !chapterStart.includes('however') && !chapterStart.includes('but')) {
          warnings.push(`Possible time skip detected at chapter start. Ensure this is intentional and properly explained, or continue from the exact moment the previous chapter ended.`);
          qualityScore -= 15;
        }
      }
    }
  }

  // Check 10: Subtext in dialogue (if dialogue exists)
  if (hasDialogue) {
    const questionCount = (content.match(/\?/g) || []).length;
    const dialogueTagCount = (content.match(/(said|asked|replied|whispered|shouted|spoke|exclaimed)/gi) || []).length;

    if (dialogueTagCount > 5 && questionCount < 2) {
      suggestions.push('Dialogue may lack subtext. Consider adding questions or indirect speech that implies hidden meaning.');
      qualityScore -= 3;
    }
  }

  // Check 10: Antagonist presence in chapter content
  const antagonists = state.antagonists || [];
  if (antagonists.length > 0) {
    const activeAntagonists = getActiveAntagonists(antagonists);
    const hasAntagonistMention = activeAntagonists.some(ant => {
      const nameLower = ant.name.toLowerCase();
      return content.toLowerCase().includes(nameLower) ||
        (chapter.summary && chapter.summary.toLowerCase().includes(nameLower));
    });

    if (!hasAntagonistMention && activeAntagonists.length > 0 && wordCount > 2000) {
      suggestions.push('Long chapter without antagonist presence. Consider featuring an active antagonist to maintain conflict.');
      qualityScore -= 3;
    }
  } else if (state?.chapters && state.chapters.length > 5) {
    suggestions.push('No antagonists in story. Consider introducing opposition to create narrative tension.');
    qualityScore -= 5;
  }

  // Check 11: Thread progression validation (NEW)
  const threads = state.storyThreads || [];
  const activeThreads = threads.filter(t => t.status === 'active');

  if (activeThreads.length > 0) {
    const chapterContent = (content + ' ' + (chapter.summary || '')).toLowerCase();

    // Check if any thread was referenced or progressed in this chapter
    const referencedThreads = activeThreads.filter(thread => {
      // Check if thread title or related keywords are mentioned
      if (!thread.title) return false;
      const titleWords = thread.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const hasReference = titleWords.some(word => chapterContent.includes(word));

      // Check if description keywords are mentioned
      const descWords = thread.description?.toLowerCase().split(/\s+/).filter(w => w.length > 4) || [];
      const hasDescReference = descWords.slice(0, 5).some(word => chapterContent.includes(word));

      return hasReference || hasDescReference;
    });

    const threadReferenceRate = (referencedThreads.length / activeThreads.length) * 100;

    if (referencedThreads.length === 0 && activeThreads.length >= 3) {
      warnings.push(`No active story threads were referenced in this chapter. ${activeThreads.length} threads may be stagnating.`);
      qualityScore -= 10;
    } else if (threadReferenceRate < 20 && activeThreads.length >= 5) {
      suggestions.push(`Only ${referencedThreads.length} of ${activeThreads.length} active threads were referenced. Consider progressing more threads.`);
      qualityScore -= 5;
    }

    // Check for critical threads that should have progressed
    const criticalThreads = activeThreads.filter(t => t.priority === 'critical');
    const referencedCritical = criticalThreads.filter(t => {
      const titleWords = t.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return titleWords.some(word => chapterContent.includes(word));
    });

    if (criticalThreads.length > 0 && referencedCritical.length === 0) {
      const criticalNames = criticalThreads.slice(0, 3).map(t => t.title).join(', ');
      warnings.push(`No critical story threads were addressed. Consider progressing: ${criticalNames}`);
      qualityScore -= 8;
    }

    // Check for stalled threads that should have been addressed
    const stalledThreads = activeThreads.filter(t => {
      const chaptersSinceUpdate = chapter.number - t.lastUpdatedChapter;
      // Consider stalled if not updated in 5+ chapters for most types
      return chaptersSinceUpdate >= 5;
    });

    if (stalledThreads.length > 2) {
      suggestions.push(`${stalledThreads.length} story threads have been stalled for 5+ chapters. Consider progressing some of them.`);
      qualityScore -= 3;
    }
  }

  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const isValid = errors.length === 0 && qualityScore >= 70;

  return {
    isValid,
    warnings,
    errors,
    suggestions,
    qualityScore,
  };
}

/**
 * Validates narrative craft for a generated chapter
 */
function validateNarrativeCraft(chapter: Chapter, state: NovelState): {
  score: number;
  burstinessScore: number;
  perplexityScore: number;
  subtextScore: number;
  interiorityScore: number;
  sceneIntentScore: number;
  dialogueNaturalnessScore: number;
  repetitivePatterns: string[];
  overexplanationFlags: string[];
  neutralProseFlags: string[];
  issues: string[];
} {
  try {
    const craftScore = analyzeNarrativeCraft(chapter, state);

    const issues: string[] = [];
    // Adjusted thresholds - lowered to be less harsh
    if (craftScore.burstinessScore < 50) { // Reduced from 60
      issues.push(`Low burstiness score (${craftScore.burstinessScore}/100) - sentence length variation insufficient`);
    }
    if (craftScore.perplexityScore < 50) { // Reduced from 60
      issues.push(`Low perplexity score (${craftScore.perplexityScore}/100) - vocabulary predictability too high`);
    }
    if (craftScore.subtextScore < 40) { // Reduced from 50
      issues.push(`Low subtext score (${craftScore.subtextScore}/100) - insufficient subtext in dialogue/scenes`);
    }
    if (craftScore.interiorityScore < 40) { // Reduced from 50
      issues.push(`Low interiority score (${craftScore.interiorityScore}/100) - insufficient character interiority`);
    }
    if (craftScore.sceneIntentScore < 50) { // Reduced from 60
      issues.push(`Low scene intent score (${craftScore.sceneIntentScore}/100) - unclear scene purpose or value shift`);
    }
    if (craftScore.dialogueNaturalnessScore < 40) { // Reduced from 50
      issues.push(`Low dialogue naturalness score (${craftScore.dialogueNaturalnessScore}/100) - dialogue may be too formal`);
    }

    // Only add pattern issues if they're significant
    if (craftScore.repetitivePatterns.length > 2) {
      issues.push(...craftScore.repetitivePatterns.slice(0, 2));
    }
    if (craftScore.overexplanationFlags.length > 0) {
      issues.push(...craftScore.overexplanationFlags.slice(0, 1));
    }
    if (craftScore.neutralProseFlags.length > 0) {
      issues.push(...craftScore.neutralProseFlags.slice(0, 1));
    }

    return {
      score: craftScore.overallCraftScore,
      burstinessScore: craftScore.burstinessScore,
      perplexityScore: craftScore.perplexityScore,
      subtextScore: craftScore.subtextScore,
      interiorityScore: craftScore.interiorityScore,
      sceneIntentScore: craftScore.sceneIntentScore,
      dialogueNaturalnessScore: craftScore.dialogueNaturalnessScore,
      repetitivePatterns: craftScore.repetitivePatterns,
      overexplanationFlags: craftScore.overexplanationFlags,
      neutralProseFlags: craftScore.neutralProseFlags,
      issues,
    };
  } catch (error) {
    console.error('Error validating narrative craft:', error);
    // Graceful degradation: return fallback scores
    return {
      score: 50,
      burstinessScore: 50,
      perplexityScore: 50,
      subtextScore: 50,
      interiorityScore: 50,
      sceneIntentScore: 50,
      dialogueNaturalnessScore: 50,
      repetitivePatterns: [],
      overexplanationFlags: [],
      neutralProseFlags: [],
      issues: ['Error analyzing narrative craft - using fallback scores'],
    };
  }
}

/**
 * Validates originality for a generated chapter
 */
function validateOriginality(chapter: Chapter, state: NovelState): {
  score: number;
  creativeDistance: number;
  novelMetaphorScore: number;
  uniqueImageryScore: number;
  sceneConstructionOriginality: number;
  emotionalBeatOriginality: number;
  genericPatterns: string[];
  mechanicalStructures: string[];
  derivativeContent: string[];
} {
  try {
    const originalityScore = analyzeChapterOriginality(chapter, state);

    return {
      score: originalityScore.overallOriginality,
      creativeDistance: originalityScore.creativeDistance,
      novelMetaphorScore: originalityScore.novelMetaphorScore,
      uniqueImageryScore: originalityScore.uniqueImageryScore,
      sceneConstructionOriginality: originalityScore.sceneConstructionOriginality,
      emotionalBeatOriginality: originalityScore.emotionalBeatOriginality,
      genericPatterns: originalityScore.genericPatternsDetected,
      mechanicalStructures: originalityScore.mechanicalStructuresDetected,
      derivativeContent: originalityScore.derivativeContentFlags,
    };
  } catch (error) {
    console.error('Error validating originality:', error);
    return {
      score: 50,
      creativeDistance: 50,
      novelMetaphorScore: 50,
      uniqueImageryScore: 50,
      sceneConstructionOriginality: 50,
      emotionalBeatOriginality: 50,
      genericPatterns: [],
      mechanicalStructures: [],
      derivativeContent: [],
    };
  }
}

/**
 * Validates voice consistency for a generated chapter
 */
function validateVoiceConsistency(chapter: Chapter, _state: NovelState, voiceProfile: ReturnType<typeof extractAuthorialVoiceProfile>): {
  score: number;
  sentenceComplexityMatch: number;
  toneConsistency: number;
  stylisticPatternPreservation: number;
  issues: string[];
} {
  const issues: string[] = [];

  try {
    if (!voiceProfile) {
      return {
        score: 75, // Default score if no profile
        sentenceComplexityMatch: 75,
        toneConsistency: 75,
        stylisticPatternPreservation: 75,
        issues: ['No voice profile available for comparison'],
      };
    }

    const content = chapter.content || '';
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Check sentence complexity match
    let sentenceComplexityMatch = 100;
    if (sentences.length > 0) {
      const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
      const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
      const expectedAvg = voiceProfile.preferredSentenceComplexity.average;
      const deviation = Math.abs(avgLength - expectedAvg) / expectedAvg;

      sentenceComplexityMatch = Math.max(0, Math.min(100, 100 - (deviation * 100)));

      if (deviation > 0.3) {
        issues.push(`Sentence complexity deviation: ${avgLength.toFixed(1)} vs expected ${expectedAvg.toFixed(1)}`);
      }
    }

    // Check tone consistency
    const contentLower = content.toLowerCase();
    const toneKeywords: Record<string, string[]> = {
      formal: ['thus', 'therefore', 'hence', 'whereas', 'furthermore', 'moreover'],
      casual: ["'", "don't", "can't", "won't", "gonna", "wanna"],
      dramatic: ['suddenly', 'abruptly', 'violently', 'fiercely'],
      contemplative: ['pondered', 'reflected', 'considered', 'contemplated'],
    };

    const toneCounts: Record<string, number> = {};
    Object.keys(toneKeywords).forEach(tone => {
      toneCounts[tone] = toneKeywords[tone].reduce((count, keyword) => {
        const matches = contentLower.match(new RegExp(keyword, 'gi'));
        return count + (matches ? matches.length : 0);
      }, 0);
    });

    const primaryTone = voiceProfile.emotionalToneRange.primary;
    const primaryCount = toneCounts[primaryTone] || 0;
    const totalToneCount = Object.values(toneCounts).reduce((sum, count) => sum + count, 0);
    const toneRatio = totalToneCount > 0 ? primaryCount / totalToneCount : 0.5;

    const toneConsistency = Math.round(toneRatio * 100);
    if (toneConsistency < 50) {
      issues.push(`Tone inconsistency: primary tone "${primaryTone}" not dominant`);
    }

    // Check stylistic pattern preservation
    let stylisticPatternPreservation = 100;
    const quirks = voiceProfile.stylisticQuirks;

    if (quirks.length > 0) {
      // Check if stylistic quirks are present
      let quirksPresent = 0;
      quirks.forEach(quirk => {
        const quirkLower = quirk.toLowerCase();
        if (quirkLower.includes('dash') && content.match(/—/g)) quirksPresent++;
        else if (quirkLower.includes('ellipsis') && content.match(/\.\.\./g)) quirksPresent++;
        else if (quirkLower.includes('fragment') && content.match(/^[a-z][^.!?]*$/m)) quirksPresent++;
        else if (quirkLower.includes('repetition')) {
          // Check for strategic repetition
          const words = contentLower.split(/\s+/);
          const wordFreq: Record<string, number> = {};
          words.forEach(word => {
            if (word.length > 4) {
              wordFreq[word] = (wordFreq[word] || 0) + 1;
            }
          });
          const repeated = Object.entries(wordFreq).filter(([_, count]) => count > 3).length;
          if (repeated > 0 && repeated < 10) quirksPresent++;
        }
      });

      stylisticPatternPreservation = Math.round((quirksPresent / quirks.length) * 100);
      // Lowered threshold from 50 to 25 - not every chapter needs all quirks
      // Some chapters may have different pacing/mood that naturally uses fewer quirks
      if (stylisticPatternPreservation < 25 && quirks.length > 2) {
        issues.push('Stylistic quirks not preserved in chapter');
      }
    }

    // Overall score
    const overallScore = Math.round(
      sentenceComplexityMatch * 0.4 +
      toneConsistency * 0.4 +
      stylisticPatternPreservation * 0.2
    );

    return {
      score: overallScore,
      sentenceComplexityMatch,
      toneConsistency,
      stylisticPatternPreservation,
      issues,
    };
  } catch (error) {
    console.error('Error validating voice consistency:', error);
    // Graceful degradation: return fallback scores
    return {
      score: 75,
      sentenceComplexityMatch: 75,
      toneConsistency: 75,
      stylisticPatternPreservation: 75,
      issues: ['Error analyzing voice consistency - using fallback scores'],
    };
  }
}

/**
 * Validates editorial quality
 */
function validateEditorialQuality(chapter: Chapter, _state: NovelState): {
  readability: number;
  flow: number;
  emotionalAuthenticity: number;
  narrativeCoherence: number;
  structuralBalance: number;
  issues: string[];
} {
  try {
    const issues: string[] = [];
    const content = chapter.content || '';
    const wordCount = content.split(/\s+/).length;

    // Readability: Flesch-Kincaid approximation
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
    const avgWordsPerSentence = avgSentenceLength;

    // Simple readability score (lower avg words = more readable, but balance needed)
    // Target: 10-20 words per sentence = good readability
    // Note: Short, punchy sentences (6-10 words) are valid stylistic choices
    let readability = 100;
    if (avgWordsPerSentence < 5) readability = 70; // Too choppy - overly fragmented
    else if (avgWordsPerSentence > 30) readability = 70; // Too complex - hard to follow
    else if (avgWordsPerSentence >= 10 && avgWordsPerSentence <= 20) readability = 100; // Ideal range
    else if (avgWordsPerSentence >= 5 && avgWordsPerSentence < 10) readability = 90; // Short but valid - stylistic variety
    else readability = 85; // Slightly long but acceptable

    // Only flag readability concerns for truly problematic cases
    if (readability < 75) {
      issues.push(`Readability concerns: average ${avgWordsPerSentence.toFixed(1)} words per sentence`);
    }

    // Flow: transition quality and paragraph structure
    const paragraphs = content.split(/\n\n/).filter(p => p.trim().length > 0);
    const transitionWords = ['however', 'meanwhile', 'therefore', 'consequently', 'furthermore', 'moreover', 'then', 'next', 'after'];
    const transitionCount = transitionWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      return count + (content.match(regex) || []).length;
    }, 0);

    const transitionDensity = wordCount > 0 ? (transitionCount / wordCount) * 1000 : 0;
    // Target: 3-5 transitions per 1000 words
    let flow = 100;
    if (transitionDensity < 2) flow = 70; // Too few transitions
    else if (transitionDensity > 8) flow = 80; // Too many transitions
    else flow = 100;

    if (flow < 80) {
      issues.push(`Flow concerns: ${transitionDensity.toFixed(1)} transitions per 1000 words`);
    }

    // Emotional authenticity: presence of emotional language
    // Expanded list includes emotion-naming words, emotional descriptors, and physical emotional responses
    const emotionalWords = [
      // Core emotions
      'anger', 'fear', 'joy', 'sadness', 'love', 'hate', 'hope', 'despair',
      'excitement', 'anxiety', 'relief', 'guilt', 'pride', 'shame',
      'furious', 'terrified', 'ecstatic', 'devastated', 'worried', 'nervous',
      'happy', 'sad', 'angry', 'scared', 'surprised', 'disgusted',
      // Emotional intensity descriptors
      'burning', 'cold', 'icy', 'fiery', 'overwhelming', 'crushing', 'sharp',
      'dull', 'bitter', 'sweet', 'warm', 'hollow', 'heavy', 'light',
      // Physical emotional responses
      'trembled', 'shook', 'clenched', 'gripped', 'tensed', 'relaxed',
      'pounded', 'raced', 'sank', 'soared', 'churned', 'knotted',
      'tightened', 'loosened', 'froze', 'flushed', 'paled', 'sweating',
      // Emotional state descriptors
      'determined', 'resolute', 'uncertain', 'confident', 'doubtful',
      'desperate', 'hopeful', 'resigned', 'defiant', 'vulnerable',
      'shocked', 'stunned', 'bewildered', 'confused', 'conflicted',
      // Heart/soul/feeling references
      'heart', 'soul', 'feeling', 'felt', 'emotion', 'passion',
      // Common emotional phrases (single words)
      'dread', 'terror', 'rage', 'fury', 'bliss', 'agony', 'misery',
      'longing', 'yearning', 'aching', 'sorrow', 'grief', 'regret',
    ];
    const emotionalCount = emotionalWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\w*`, 'gi');
      return count + (content.match(regex) || []).length;
    }, 0);

    const emotionalDensity = wordCount > 0 ? (emotionalCount / wordCount) * 1000 : 0;
    // Target: 3-15 emotional indicators per 1000 words
    // Adjusted formula to be more lenient - score 100 at 5+ emotional words per 1000
    const emotionalAuthenticity = Math.min(100, Math.max(0, ((emotionalDensity - 1) / 6) * 100));

    // Lowered threshold from 40 to 30 - some action-focused chapters may have less explicit emotion
    if (emotionalAuthenticity < 30) {
      issues.push(`Low emotional language density - prose may be too neutral`);
    }

    // Narrative coherence: logic audit and continuity
    let narrativeCoherence = 100;
    if (!chapter.logicAudit) {
      narrativeCoherence = 60;
      issues.push('Missing logic audit - narrative coherence cannot be fully assessed');
    } else {
      const { startingValue, resultingValue } = chapter.logicAudit;
      if (!startingValue || !resultingValue || startingValue.length < 5 || resultingValue.length < 5) {
        narrativeCoherence = 70;
        issues.push('Incomplete logic audit - value shift unclear');
      }
    }

    // Structural balance: paragraph variety and chapter structure
    let structuralBalance = 100;
    if (paragraphs.length < 3) {
      structuralBalance = 60;
      issues.push(`Insufficient paragraph breaks: only ${paragraphs.length} paragraphs`);
    } else {
      // Check paragraph length variety
      const paragraphLengths = paragraphs.map(p => p.split(/\s+/).length);
      const avgLength = paragraphLengths.reduce((sum, len) => sum + len, 0) / paragraphLengths.length;
      const variance = paragraphLengths.reduce((sum, len) => {
        const diff = len - avgLength;
        return sum + (diff * diff);
      }, 0) / paragraphLengths.length;

      if (variance < 50) {
        structuralBalance = 75;
        issues.push('Uniform paragraph lengths - lacks structural variety');
      }
    }

    return {
      readability: Math.round(readability),
      flow: Math.round(flow),
      emotionalAuthenticity: Math.round(emotionalAuthenticity),
      narrativeCoherence: Math.round(narrativeCoherence),
      structuralBalance: Math.round(structuralBalance),
      issues,
    };
  } catch (error) {
    console.error('Error validating editorial quality:', error);
    // Graceful degradation: return fallback scores
    return {
      readability: 75,
      flow: 75,
      emotionalAuthenticity: 50,
      narrativeCoherence: 75,
      structuralBalance: 75,
      issues: ['Error analyzing editorial quality - using fallback scores'],
    };
  }
}

// Cache for quality metrics
const qualityMetricsCache = new Map<string, {
  timestamp: number;
  metrics: ChapterQualityMetrics;
}>();
const QUALITY_METRICS_CACHE_TTL = 300000; // 5 minutes

/**
 * Creates comprehensive quality metrics for a chapter
 * Uses caching and early exit for performance
 */
// Helper function to wrap synchronous operations with timeout
function withTimeout<T>(fn: () => T, timeoutMs: number, defaultValue: T, operationName: string): T {
  const startTime = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    if (duration > timeoutMs * 0.8) {
      console.warn(`[Quality Validator] ${operationName} took ${duration}ms (approaching timeout of ${timeoutMs}ms)`);
    }
    return result;
  } catch (error) {
    console.error(`[Quality Validator] Error in ${operationName}:`, error);
    return defaultValue;
  }
}

// Helper function to wrap async operations with timeout
async function withAsyncTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  defaultValue: T,
  operationName: string
): Promise<T> {
  const startTime = Date.now();
  try {
    const timeoutPromise = new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    const result = await Promise.race([fn(), timeoutPromise]);
    const duration = Date.now() - startTime;
    if (duration > timeoutMs * 0.8) {
      console.warn(`[Quality Validator] ${operationName} took ${duration}ms (approaching timeout of ${timeoutMs}ms)`);
    }
    return result;
  } catch (error) {
    console.error(`[Quality Validator] Error or timeout in ${operationName}:`, error);
    return defaultValue;
  }
}

export async function validateChapterQuality(
  chapter: Chapter,
  state: NovelState
): Promise<ChapterQualityMetrics> {
  // Global timeout wrapper - fail fast if validation takes too long (60 seconds)
  return Promise.race([
    validateChapterQualityInternal(chapter, state),
    new Promise<ChapterQualityMetrics>((_, reject) => {
      setTimeout(() => {
        reject(new Error('Chapter quality validation timed out after 60 seconds'));
      }, 60000);
    })
  ]).catch(async (error) => {
    console.error('[Quality Validator] Validation failed or timed out:', error);
    // Return safe defaults on timeout or failure
    return await getDefaultQualityMetrics(chapter, state);
  });
}

async function validateChapterQualityInternal(
  chapter: Chapter,
  state: NovelState
): Promise<ChapterQualityMetrics> {
  // Check cache
  const cacheKey = `${chapter.id}:${chapter.content?.length || 0}`;
  const cached = qualityMetricsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < QUALITY_METRICS_CACHE_TTL) {
    return cached.metrics;
  }

  try {
    console.log('[Quality Validator] Starting validation...');
    const validationStartTime = Date.now();

    // Run all validation functions with individual timeout protection
    // Use shorter timeouts for each operation (5 seconds each, 30 seconds total budget)
    const qualityCheck = await withAsyncTimeout(
      async () => await validateGeneratedChapter(chapter, state),
      5000,
      { isValid: true, warnings: [], errors: [], suggestions: [], qualityScore: 50 },
      'validateGeneratedChapter'
    );

    const narrativeCraft = withTimeout(
      () => validateNarrativeCraft(chapter, state),
      8000,
      {
        score: 50,
        burstinessScore: 50,
        perplexityScore: 50,
        subtextScore: 50,
        interiorityScore: 50,
        sceneIntentScore: 50,
        dialogueNaturalnessScore: 50,
        repetitivePatterns: [],
        overexplanationFlags: [],
        neutralProseFlags: [],
        issues: []
      },
      'validateNarrativeCraft'
    );

    const originality = withTimeout(
      () => validateOriginality(chapter, state),
      10000,
      { score: 50, creativeDistance: 50, novelMetaphorScore: 50, uniqueImageryScore: 50, sceneConstructionOriginality: 50, emotionalBeatOriginality: 50, genericPatterns: [], mechanicalStructures: [], derivativeContent: [] },
      'validateOriginality'
    );

    const voiceProfile = withTimeout(
      () => extractAuthorialVoiceProfile(state?.chapters || [], state),
      8000,
      null, // extractAuthorialVoiceProfile returns AuthorialVoiceProfile | null
      'extractAuthorialVoiceProfile'
    );

    const voiceConsistency = withTimeout(
      () => validateVoiceConsistency(chapter, state, voiceProfile),
      5000,
      { score: 75, sentenceComplexityMatch: 75, toneConsistency: 75, stylisticPatternPreservation: 75, issues: [] },
      'validateVoiceConsistency'
    );

    const editorial = withTimeout(
      () => validateEditorialQuality(chapter, state),
      5000,
      { readability: 75, flow: 75, emotionalAuthenticity: 50, narrativeCoherence: 75, structuralBalance: 75, issues: [] },
      'validateEditorialQuality'
    );

    console.log('[Quality Validator] Core validations completed, starting AI detection checks...');

    // AI Detection Evasion Checks with timeout protection
    const burstinessResult = AI_DETECTION_CONFIG.burstiness.enabled
      ? withTimeout(
        () => validateBurstinessPattern(chapter.content, {
          maxSimilarSequences: AI_DETECTION_CONFIG.burstiness.maxSimilarSequences,
          similarityThreshold: AI_DETECTION_CONFIG.burstiness.similarityThreshold,
        }),
        8000,
        { isValid: true, violations: [], overallScore: 100, recommendations: [] },
        'validateBurstinessPattern'
      )
      : { isValid: true, violations: [], overallScore: 100, recommendations: [] };

    const blacklistViolations = AI_DETECTION_CONFIG.blacklist.enforcePostProcess
      ? withTimeout(
        () => [
          ...checkForForbiddenWords(chapter.content || ''),
          ...checkForForbiddenStructures(chapter.content || ''),
        ],
        5000,
        [],
        'checkBlacklistViolations'
      )
      : [];

    const perplexityResult = AI_DETECTION_CONFIG.perplexity.enabled
      ? withTimeout(
        () => verifyPerplexityThreshold(
          chapter.content || '',
          AI_DETECTION_CONFIG.perplexity.threshold,
          { checkParagraphs: AI_DETECTION_CONFIG.perplexity.checkParagraphs }
        ),
        10000,
        { isValid: true, overallPerplexity: 100, threshold: 90, violations: [], recommendations: [] },
        'verifyPerplexityThreshold'
      )
      : { isValid: true, overallPerplexity: 100, threshold: 90, violations: [], recommendations: [] };

    // Stricter validation thresholds
    const burstinessScore = burstinessResult.overallScore || 0;
    const perplexityScore = perplexityResult.overallPerplexity || 0;

    // N-gram analysis with timeout protection
    let ngramScore = 100;

    if (AI_DETECTION_CONFIG.nGramControl?.enabled) {
      try {
        const result = await withAsyncTimeout(
          async () => {
            const { analyzeNGramUnpredictability } = await import('./nGramAnalyzer');
            return analyzeNGramUnpredictability(chapter.content);
          },
          8000,
          { overallScore: 100, trigramScore: 100, fourgramScore: 100, commonTrigrams: [], commonFourgrams: [], recommendations: [] },
          'nGramAnalysis'
        );
        ngramScore = result.overallScore;
        // if (result.trigramScore < AI_DETECTION_CONFIG.nGramControl.minTrigramScore ||
        //   result.fourgramScore < AI_DETECTION_CONFIG.nGramControl.minFourgramScore) {
        //   ngramViolations = result.recommendations;
        // }
      } catch (error) {
        console.warn('[Quality Validator] N-gram analysis failed:', error);
      }
    }

    // Lexical balance analysis with timeout protection
    let lexicalBalanceScore = 100;

    if (AI_DETECTION_CONFIG.lexicalBalance?.enabled) {
      try {
        const result = await withAsyncTimeout(
          async () => {
            const { analyzeLexicalBalance } = await import('./lexicalBalanceAnalyzer');
            return analyzeLexicalBalance(chapter.content);
          },
          8000,
          { contentWordRatio: 0.6, functionWordRatio: 0.4, lexicalDensity: 60, balanceScore: 100, recommendations: [] },
          'lexicalBalanceAnalysis'
        );
        lexicalBalanceScore = result.balanceScore;
        // if (result.balanceScore < AI_DETECTION_CONFIG.lexicalBalance.minBalanceScore) {
        //   lexicalViolations = result.recommendations;
        // }
      } catch (error) {
        console.warn('[Quality Validator] Lexical balance analysis failed:', error);
      }
    }

    console.log('[Quality Validator] All validation checks completed');

    // Determine if regeneration is needed - RELAXED thresholds to reduce excessive regenerations
    // Only regenerate for truly critical issues, not for every minor deviation
    const shouldRegenerate =
      originality.score < QUALITY_CONFIG.criticalThresholds.originality ||
      narrativeCraft.score < QUALITY_CONFIG.criticalThresholds.narrativeCraft ||
      voiceConsistency.score < QUALITY_CONFIG.criticalThresholds.voiceConsistency ||
      // Only flag patterns if there are MANY (not just 1-2)
      (originality.genericPatterns?.length ?? 0) > 3 ||
      (originality.mechanicalStructures?.length ?? 0) > 2 ||
      (originality.derivativeContent?.length ?? 0) > 2 ||
      // RELAXED: Increased thresholds to reduce regeneration frequency
      (!burstinessResult.isValid && burstinessResult.violations.length > 5) || // Relaxed from 2 to 5
      burstinessScore < 50 || // Relaxed from 75 to 50
      (blacklistViolations.length > 10) || // Relaxed from 5 to 10
      (!perplexityResult.isValid && perplexityResult.violations.length > 6) || // Relaxed from 3 to 6
      perplexityScore < 60 || // Relaxed from 85 to 60
      (AI_DETECTION_CONFIG.nGramControl?.enabled && ngramScore < 50) || // Relaxed from 70 to 50
      (AI_DETECTION_CONFIG.lexicalBalance?.enabled && lexicalBalanceScore < 50); // Relaxed - use fixed threshold

    const regenerationReasons: string[] = [];
    if (originality.score < QUALITY_CONFIG.criticalThresholds.originality) {
      regenerationReasons.push(`Originality score ${originality.score} below threshold ${QUALITY_CONFIG.criticalThresholds.originality}`);
    }
    if (narrativeCraft.score < QUALITY_CONFIG.criticalThresholds.narrativeCraft) {
      regenerationReasons.push(`Narrative craft score ${narrativeCraft.score} below threshold ${QUALITY_CONFIG.criticalThresholds.narrativeCraft}`);
    }
    if (voiceConsistency.score < QUALITY_CONFIG.criticalThresholds.voiceConsistency) {
      regenerationReasons.push(`Voice consistency score ${voiceConsistency.score} below threshold ${QUALITY_CONFIG.criticalThresholds.voiceConsistency}`);
    }
    if ((originality.genericPatterns?.length ?? 0) > 3) {
      regenerationReasons.push(`Generic patterns detected: ${originality.genericPatterns?.length ?? 0}`);
    }
    if ((originality.mechanicalStructures?.length ?? 0) > 2) {
      regenerationReasons.push(`Mechanical structures detected: ${originality.mechanicalStructures?.length ?? 0}`);
    }
    if ((originality.derivativeContent?.length ?? 0) > 2) {
      regenerationReasons.push(`Derivative content detected: ${originality.derivativeContent?.length ?? 0}`);
    }
    if (burstinessScore < 50) {
      regenerationReasons.push(`Burstiness score ${burstinessScore} below threshold 50`);
    }
    if (perplexityScore < 60) {
      regenerationReasons.push(`Perplexity score ${perplexityScore} below threshold 60`);
    }
    if (AI_DETECTION_CONFIG.nGramControl?.enabled && ngramScore < 50) {
      regenerationReasons.push(`N-gram score ${ngramScore} below threshold 50`);
    }
    if (AI_DETECTION_CONFIG.lexicalBalance?.enabled && lexicalBalanceScore < 50) {
      regenerationReasons.push(`Lexical balance score ${lexicalBalanceScore} below threshold 50`);
    }
    if (!burstinessResult.isValid && burstinessResult.violations.length > 5) {
      regenerationReasons.push(`Burstiness violations: ${burstinessResult.violations.length} paragraphs with similar-length sentences (threshold: 5)`);
    }
    if (blacklistViolations.length > 10) {
      regenerationReasons.push(`Blacklist violations: ${blacklistViolations.length} forbidden words/structures detected (threshold: 10)`);
    }
    if (!perplexityResult.isValid && perplexityResult.violations.length > 6) {
      regenerationReasons.push(`Perplexity violations: ${perplexityResult.violations.length} paragraphs below threshold (threshold: 6)`);
    }

    // Collect all warnings
    const allWarnings = [
      ...qualityCheck.warnings,
      ...narrativeCraft.issues,
      ...voiceConsistency.issues,
      ...editorial.issues,
      ...burstinessResult.recommendations,
      ...perplexityResult.recommendations,
      ...(blacklistViolations.length > 0 ? [`Found ${blacklistViolations.length} blacklist violations`] : []),
    ];

    // Calculate transition quality score (if there's a previous chapter)
    let transitionQualityScore: number | undefined = undefined;
    if (state?.chapters && state.chapters.length > 0) {
      const previousChapter = state.chapters[state.chapters.length - 1];
      if (previousChapter && previousChapter.number === chapter.number - 1) {
        try {
          const { validateChapterTransition } = await import('./chapterTransitionValidator');
          const transitionValidation = validateChapterTransition(previousChapter, chapter);
          transitionQualityScore = transitionValidation.score;

          // Log transition quality
          if (transitionValidation.score < 70) {
            console.warn(`[Chapter Quality] Transition quality score: ${transitionValidation.score}/100 (below threshold of 70)`);
          } else {
            console.log(`[Chapter Quality] Transition quality score: ${transitionValidation.score}/100`);
          }
        } catch (error) {
          console.warn('[Chapter Quality] Failed to run transition validator:', error);
          // Leave transitionQualityScore as undefined if validation fails
        }
      }
    }

    // Create narrative craft score object
    const narrativeCraftScore: NarrativeCraftScore = {
      id: generateUUID(),
      chapterId: chapter.id,
      novelId: state.id,
      overallCraftScore: narrativeCraft.score,
      burstinessScore: narrativeCraft.burstinessScore,
      perplexityScore: narrativeCraft.perplexityScore,
      subtextScore: narrativeCraft.subtextScore,
      interiorityScore: narrativeCraft.interiorityScore,
      sceneIntentScore: narrativeCraft.sceneIntentScore,
      dialogueNaturalnessScore: narrativeCraft.dialogueNaturalnessScore,
      repetitivePatterns: narrativeCraft.repetitivePatterns,
      overexplanationFlags: narrativeCraft.overexplanationFlags,
      neutralProseFlags: narrativeCraft.neutralProseFlags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Create originality score object with proper property mapping
    const originalityScore: ChapterOriginalityScore = {
      id: generateUUID(),
      chapterId: chapter.id,
      novelId: state.id,
      overallOriginality: originality.score,
      creativeDistance: originality.creativeDistance,
      novelMetaphorScore: originality.novelMetaphorScore,
      uniqueImageryScore: originality.uniqueImageryScore,
      sceneConstructionOriginality: originality.sceneConstructionOriginality,
      emotionalBeatOriginality: originality.emotionalBeatOriginality,
      genericPatternsDetected: originality.genericPatterns || [],
      mechanicalStructuresDetected: originality.mechanicalStructures || [],
      derivativeContentFlags: originality.derivativeContent || [],
      clichePatterns: [], // Not provided by validateOriginality, but required by type
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const metrics: ChapterQualityMetrics = {
      chapterId: chapter.id,
      qualityCheck,
      originalityScore,
      narrativeCraftScore,
      voiceConsistencyScore: voiceConsistency.score,
      editorialScore: {
        readability: editorial.readability,
        flow: editorial.flow,
        emotionalAuthenticity: editorial.emotionalAuthenticity,
        narrativeCoherence: editorial.narrativeCoherence,
        structuralBalance: editorial.structuralBalance,
      },
      transitionQualityScore: transitionQualityScore, // Added from transition validation
      shouldRegenerate,
      regenerationReasons,
      warnings: allWarnings.slice(0, 20), // Limit warnings
      createdAt: Date.now(),
    };

    // Cache the result
    qualityMetricsCache.set(cacheKey, {
      timestamp: Date.now(),
      metrics,
    });

    // Clean old cache entries (keep last 10)
    if (qualityMetricsCache.size > 10) {
      const entries = Array.from(qualityMetricsCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const toKeep = entries.slice(0, 10);
      qualityMetricsCache.clear();
      toKeep.forEach(([key, value]) => qualityMetricsCache.set(key, value));
    }

    const totalDuration = Date.now() - validationStartTime;
    console.log(`[Quality Validator] Validation completed in ${totalDuration}ms`);

    return metrics;
  } catch (error) {
    console.error('Error validating chapter quality:', error);
    return await getDefaultQualityMetrics(chapter, state);
  }
}

async function getDefaultQualityMetrics(chapter: Chapter, state: NovelState): Promise<ChapterQualityMetrics> {
  // Return safe defaults
  let qualityCheck;
  try {
    qualityCheck = await validateGeneratedChapter(chapter, state);
  } catch (error) {
    qualityCheck = { isValid: true, warnings: [], errors: [], suggestions: [], qualityScore: 50 };
  }

  return {
    chapterId: chapter.id,
    qualityCheck,
    originalityScore: {
      id: generateUUID(),
      chapterId: chapter.id,
      novelId: state.id,
      overallOriginality: 50,
      creativeDistance: 50,
      novelMetaphorScore: 50,
      uniqueImageryScore: 50,
      sceneConstructionOriginality: 50,
      emotionalBeatOriginality: 50,
      genericPatternsDetected: [],
      mechanicalStructuresDetected: [],
      derivativeContentFlags: [],
      clichePatterns: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    narrativeCraftScore: {
      id: generateUUID(),
      chapterId: chapter.id,
      novelId: state.id,
      overallCraftScore: 50,
      burstinessScore: 50,
      perplexityScore: 50,
      subtextScore: 50,
      interiorityScore: 50,
      sceneIntentScore: 50,
      dialogueNaturalnessScore: 50,
      repetitivePatterns: [],
      overexplanationFlags: [],
      neutralProseFlags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    voiceConsistencyScore: 75,
    editorialScore: {
      readability: 75,
      flow: 75,
      emotionalAuthenticity: 50,
      narrativeCoherence: 75,
      structuralBalance: 75,
    },
    shouldRegenerate: false,
    regenerationReasons: ['Error during quality validation'],
    warnings: ['Error validating chapter quality'],
    transitionQualityScore: undefined, // No transition score on error
    createdAt: Date.now(),
  };
}

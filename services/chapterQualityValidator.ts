import { NovelState, Chapter, Arc } from '../types';
import { analyzeForeshadowing, analyzeEmotionalPayoffs, analyzePacing } from './promptEngine/arcContextAnalyzer';
import * as arcAnalyzerModule from './promptEngine/arcContextAnalyzer';
import { getActiveAntagonists, getPrimaryAntagonist } from '../utils/antagonistHelpers';
import { generateUUID } from '../utils/uuid';

// Cache for expensive analysis operations
const analysisCache = new Map<string, {
  timestamp: number;
  data: unknown;
}>();
const CACHE_TTL = 60000; // 1 minute

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
export function validateChapterGenerationQuality(
  state: NovelState,
  nextChapterNumber: number
): ChapterQualityCheck {
  try {
    const warnings: string[] = [];
    const errors: string[] = [];
    const suggestions: string[] = [];
    let qualityScore = 100; // Start with perfect score, deduct for issues
    
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
      
      if (pacing.recommendations.length > 0) {
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
        const content = (ch.content + ' ' + (ch.summary || '')).toLowerCase();
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
    
    // Calculate final quality score
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    
    const isValid = errors.length === 0 && qualityScore >= 70;
    
    return {
      isValid,
      warnings,
      errors,
      suggestions: [...suggestions, ...foreshadowing.recommendations.slice(0, 2), ...emotionalPayoffs.recommendations.slice(0, 2), ...pacing.recommendations.slice(0, 2)].slice(0, 10),
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
export function validateGeneratedChapter(
  chapter: Chapter,
  state: NovelState
): ChapterQualityCheck {
  const warnings: string[] = [];
  const errors: string[] = [];
  const suggestions: string[] = [];
  let qualityScore = 100;
  
  // Check 1: Word count minimum
  const wordCount = chapter.content.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 1500) {
    errors.push(`Chapter is ${wordCount} words, below minimum requirement of 1500 words.`);
    qualityScore -= 20;
  } else if (wordCount < 1800) {
    warnings.push(`Chapter is ${wordCount} words, slightly below recommended 1800+ words.`);
    qualityScore -= 5;
  }
  
  // Check 2: Paragraph structure
  const paragraphs = chapter.content.split(/\n\n/).filter(p => p.trim().length > 0);
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
    chapter.content.toLowerCase().includes(kw) || 
    (chapter.summary && chapter.summary.toLowerCase().includes(kw))
  );
  
  if (!hasForeshadowing && state.chapters.length > 3) {
    suggestions.push('Chapter may benefit from subtle foreshadowing elements.');
    qualityScore -= 3;
  }
  
  // Check 7: Dialogue presence (most chapters should have dialogue)
  const hasDialogue = chapter.content.includes('"') || chapter.content.includes("'") || chapter.content.includes('"');
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
  
  // Check 9: Continuity with previous chapter (CRITICAL)
  if (state.chapters.length > 0) {
    const previousChapter = state.chapters[state.chapters.length - 1];
    if (previousChapter && previousChapter.number === chapter.number - 1) {
      // Check for time skip indicators at chapter start
      const chapterStart = chapter.content.substring(0, 300).toLowerCase();
      const timeSkipPatterns = [
        /(later|after|hours?|days?|weeks?|months?|years?|the next|the following|eventually|meanwhile)/i,
        /(some time|a while|much|long) (later|after|passed|went by)/i
      ];
      
      const hasTimeSkip = timeSkipPatterns.some(pattern => pattern.test(chapterStart));
      
      // Check if characters from previous chapter ending are mentioned in new chapter start
      const prevEnding = previousChapter.content.split(/\s+/).slice(-100).join(' ').toLowerCase();
      const prevCharacters = state.characterCodex.filter(char => 
        prevEnding.includes(char.name.toLowerCase())
      );
      
      const chapterStartText = chapter.content.substring(0, 500).toLowerCase();
      const mentionsPrevCharacters = prevCharacters.length > 0 && 
        prevCharacters.some(char => chapterStartText.includes(char.name.toLowerCase()));
      
      // Check for location continuity
      const locationKeywords = ['realm', 'sect', 'palace', 'temple', 'forest', 'mountain', 'city', 'village', 'room', 'chamber', 'hall'];
      const prevLocationMatches = locationKeywords.filter(kw => prevEnding.includes(kw));
      const currLocationMatches = locationKeywords.filter(kw => chapterStartText.includes(kw));
      const hasLocationContinuity = prevLocationMatches.length === 0 || 
        prevLocationMatches.some(loc => currLocationMatches.includes(loc));
      
      if (hasTimeSkip && !chapterStart.includes('however') && !chapterStart.includes('but')) {
        warnings.push(`Possible time skip detected at chapter start. Ensure this is intentional and properly explained, or continue from the exact moment the previous chapter ended.`);
        qualityScore -= 15;
      }
      
      if (!mentionsPrevCharacters && prevCharacters.length > 0 && chapterStartText.length > 100) {
        warnings.push(`Chapter start may lack continuity with previous chapter. Previous chapter ended with ${prevCharacters.map(c => c.name).join(', ')}, but they are not immediately mentioned in this chapter.`);
        qualityScore -= 10;
      }
      
      if (!hasLocationContinuity && prevLocationMatches.length > 0) {
        warnings.push(`Possible location change without transition. Previous chapter location context (${prevLocationMatches.join(', ')}) may not match chapter start.`);
        qualityScore -= 5;
      }
      
      // Positive check: Does chapter start acknowledge previous chapter's ending?
      const transitionIndicators = ['immediately', 'at once', 'instantly', 'right away', 'without delay', 'then', 'next'];
      const hasSmoothTransition = transitionIndicators.some(ind => chapterStart.includes(ind)) ||
        (prevCharacters.length > 0 && mentionsPrevCharacters) ||
        chapterStart.length < 150; // Very short start might indicate continuation
      
      if (!hasSmoothTransition && !hasTimeSkip && chapterStart.length > 150) {
        suggestions.push(`Chapter start could better acknowledge the previous chapter's ending. Consider starting with immediate continuation of the previous scene.`);
      }
    }
  }
  
  // Check 10: Subtext in dialogue (if dialogue exists)
  if (hasDialogue) {
    const questionCount = (chapter.content.match(/\?/g) || []).length;
    const dialogueTagCount = (chapter.content.match(/(said|asked|replied|whispered|shouted|spoke|exclaimed)/gi) || []).length;
    
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
      return chapter.content.toLowerCase().includes(nameLower) ||
             (chapter.summary && chapter.summary.toLowerCase().includes(nameLower));
    });
    
    if (!hasAntagonistMention && activeAntagonists.length > 0 && wordCount > 2000) {
      suggestions.push('Long chapter without antagonist presence. Consider featuring an active antagonist to maintain conflict.');
      qualityScore -= 3;
    }
  } else if (state.chapters.length > 5) {
    suggestions.push('No antagonists in story. Consider introducing opposition to create narrative tension.');
    qualityScore -= 5;
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

import { NovelState } from '../../types';
import { ImprovementStrategy, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeProseQuality } from '../proseQualityService';
import { analyzeOriginality } from '../originalityDetector';
import { analyzeVoiceUniqueness } from '../voiceAnalysisService';
import { StructureOptimizer } from './structureOptimizer';
import { EngagementOptimizer } from './engagementOptimizer';
import { TensionOptimizer } from './tensionOptimizer';
import { ThemeOptimizer } from './themeOptimizer';
import { PsychologyOptimizer } from './psychologyOptimizer';
import { DeviceOptimizer } from './deviceOptimizer';
import { ContextManager } from '../contextManager';

/**
 * Excellence Optimizer
 * Comprehensive optimizer that applies linguistic de-patterning and AI-detection avoidance
 * Also applies all other optimizers in sequence for comprehensive improvement
 */
export class ExcellenceOptimizer {
  /**
   * Analyzes weaknesses across all excellence dimensions
   * Uses context optimization for large novels
   */
  static analyzeWeaknesses(state: NovelState): {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }>;
  } {
    const proseQuality = analyzeProseQuality(state);
    const originality = analyzeOriginality(state);
    const voiceAnalysis = analyzeVoiceUniqueness(state);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check prose quality
    if (proseQuality.overallProseScore < 70) {
      issues.push({
        type: 'prose_quality',
        description: `Prose quality is ${proseQuality.overallProseScore}/100`,
        severity: proseQuality.overallProseScore < 50 ? 'high' : 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Improve prose quality: sentence variety, vocabulary, show/tell balance',
      });
    }

    // Check burstiness (sentence variation)
    if (proseQuality.sentenceVarietyScore < 60) {
      issues.push({
        type: 'burstiness',
        description: `Sentence variety (burstiness) is ${proseQuality.sentenceVarietyScore}/100`,
        severity: 'high',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Vary sentence length dramatically: mix very short and long sentences',
      });
    }

    // Check perplexity (vocabulary variation)
    if (proseQuality.vocabularySophisticationScore < 60) {
      issues.push({
        type: 'perplexity',
        description: `Vocabulary sophistication (perplexity) is ${proseQuality.vocabularySophistication}/100`,
        severity: 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Vary vocabulary: use synonyms, avoid repetition, include less common words',
      });
    }

    // Check originality
    if (originality.overallOriginality < 60) {
      issues.push({
        type: 'originality',
        description: `Originality is ${originality.overallOriginality}/100`,
        severity: originality.commonTropesDetected.length > 10 ? 'high' : 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Reduce clichés and common tropes, add unique elements',
      });
    }

    // Check voice uniqueness
    if (voiceAnalysis.novelVoice.distinctivenessScore < 70) {
      issues.push({
        type: 'voice',
        description: `Voice distinctiveness is ${voiceAnalysis.novelVoice.distinctivenessScore}/100`,
        severity: 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Enhance unique narrative voice and writing style',
      });
    }

    // Check for AI-isms (from blacklist)
    const aiIsmChapters = this.detectAIisms(state);

    if (aiIsmChapters.length > 0) {
      issues.push({
        type: 'ai_isms',
        description: `AI-like patterns detected in ${aiIsmChapters.length} chapter(s)`,
        severity: 'high',
        chaptersAffected: aiIsmChapters,
        fix: 'Remove AI-isms and make prose more human-like',
      });
    }

    // Calculate overall excellence score (weighted average)
    const overallScore = (
      proseQuality.overallProseScore * 0.30 +
      originality.overallOriginality * 0.25 +
      voiceAnalysis.novelVoice.distinctivenessScore * 0.20 +
      (proseQuality.sentenceVarietyScore + proseQuality.vocabularySophistication) / 2 * 0.25
    );

    return {
      score: Math.round(overallScore),
      issues,
    };
  }

  /**
   * Detects AI-isms (patterns that make text feel AI-generated)
   */
  private static detectAIisms(state: NovelState): number[] {
    const aiIsmChapters: number[] = [];

    // Common AI-isms (simplified - full list would be in blacklist)
    const aiPatterns = [
      'it is important to note',
      'in conclusion',
      'furthermore',
      'moreover',
      'it should be noted',
      'as previously mentioned',
      'in other words',
      'to put it simply',
    ];

    state.chapters.forEach((chapter) => {
      const content = chapter.content || '';
      const lowerContent = content.toLowerCase();

      const patternCount = aiPatterns.filter(pattern => lowerContent.includes(pattern)).length;
      
      // If multiple AI patterns found, mark as having AI-isms
      if (patternCount > 2) {
        aiIsmChapters.push(chapter.number);
      }
    });

    return aiIsmChapters;
  }

  /**
   * Generates comprehensive improvement interventions
   * Applies all optimizers in sequence for excellence
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    // Get strategies from all optimizers
    const structureStrategy = StructureOptimizer.generateInterventions(state, weaknesses, targetScore);
    const engagementStrategy = EngagementOptimizer.generateInterventions(state, weaknesses, targetScore);
    const tensionStrategy = TensionOptimizer.generateInterventions(state, weaknesses, targetScore);
    const themeStrategy = ThemeOptimizer.generateInterventions(state, weaknesses, targetScore);
    const psychologyStrategy = PsychologyOptimizer.generateInterventions(state, weaknesses, targetScore);
    const deviceStrategy = DeviceOptimizer.generateInterventions(state, weaknesses, targetScore);

    // Combine all edit actions
    const allEditActions = [
      ...(structureStrategy.editActions || []),
      ...(engagementStrategy.editActions || []),
      ...(tensionStrategy.editActions || []),
      ...(themeStrategy.editActions || []),
      ...(psychologyStrategy.editActions || []),
      ...(deviceStrategy.editActions || []),
    ];

    // Add excellence-specific improvements
    const proseQuality = analyzeProseQuality(state);
    const originality = analyzeOriginality(state);
    const voiceAnalysis = analyzeVoiceUniqueness(state);

    // Add burstiness fixes
    if (proseQuality.sentenceVarietyScore < 60) {
      state.chapters.slice(0, 5).forEach((chapter) => {
        if (!allEditActions.some(a => a.chapterId === chapter.id)) {
          allEditActions.push({
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            section: 'throughout',
            improvementType: 'modify_content',
            description: 'Fix burstiness: dramatically vary sentence length. Mix very short sentences (3-5 words) with longer sentences (25-30+ words).',
            estimatedWordCount: 200,
          });
        }
      });
    }

    // Add perplexity fixes
    if (proseQuality.vocabularySophisticationScore < 60) {
      state.chapters.slice(0, 5).forEach((chapter) => {
        if (!allEditActions.some(a => a.chapterId === chapter.id)) {
          allEditActions.push({
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            section: 'throughout',
            improvementType: 'modify_content',
            description: 'Fix perplexity: vary vocabulary, use synonyms, avoid repetition, include less common words naturally.',
            estimatedWordCount: 200,
          });
        }
      });
    }

    // Remove AI-isms
    const aiIsmChapters = this.detectAIisms(state);
    aiIsmChapters.slice(0, 5).forEach((chapterNumber) => {
      const chapter = state.chapters.find(ch => ch.number === chapterNumber);
      if (chapter && !allEditActions.some(a => a.chapterId === chapter.id)) {
        allEditActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'modify_content',
          description: 'Remove AI-isms: strip out phrases like "it is important to note", "furthermore", "in conclusion". Make prose more natural and human-like.',
          estimatedWordCount: 150,
        });
      }
    });

    // Calculate expected improvement
    const currentScore = (
      proseQuality.overallProseScore * 0.30 +
      originality.overallOriginality * 0.25 +
      voiceAnalysis.novelVoice.distinctivenessScore * 0.20 +
      (proseQuality.sentenceVarietyScore + proseQuality.vocabularySophistication) / 2 * 0.25
    );
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(15, Math.floor(allEditActions.length * 1.5))
    );

    return {
      id: generateUUID(),
      category: 'excellence',
      priority: allEditActions.length > 0 ? 'high' : 'low',
      targetScore: Math.round(currentScore),
      goalScore: targetScore,
      description: `Comprehensive excellence improvement: apply all optimizers, fix burstiness/perplexity, remove AI-isms`,
      rationale: `Current excellence score is ${Math.round(currentScore)}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: allEditActions.length > 0 ? allEditActions : undefined,
      estimatedImpact: expectedImprovement > 20 ? 'high' : expectedImprovement > 10 ? 'medium' : 'low',
      estimatedEffort: allEditActions.length > 10 ? 'high' : allEditActions.length > 5 ? 'medium' : 'low',
      chaptersAffected: [...new Set(allEditActions.map(a => a.chapterNumber))],
      expectedImprovement,
    };
  }
}

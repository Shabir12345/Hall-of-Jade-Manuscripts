import { NovelState, PromptEffectiveness, Chapter } from '../types';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeStoryStructure } from './storyStructureAnalyzer';

/**
 * Adaptive Learning Service
 * Learns from revision feedback and chapter quality metrics
 * to continuously improve prompt effectiveness
 */

export interface LearningInsights {
  successfulPatterns: Array<{
    pattern: string;
    context: string;
    successRate: number; // 0-100
    avgQuality: number;
  }>;
  unsuccessfulPatterns: Array<{
    pattern: string;
    context: string;
    failureRate: number;
    avgQuality: number;
  }>;
  improvements: Array<{
    area: string;
    recommendation: string;
    expectedGain: number;
  }>;
  recommendations: string[];
}

/**
 * Analyzes learning from chapter generation history
 */
export function analyzeLearning(state: NovelState): LearningInsights {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      successfulPatterns: [],
      unsuccessfulPatterns: [],
      improvements: [],
      recommendations: ['No chapters available for learning analysis'],
    };
  }

  // Analyze successful patterns
  const successfulPatterns = identifySuccessfulPatterns(chapters, state);

  // Identify unsuccessful patterns
  const unsuccessfulPatterns = identifyUnsuccessfulPatterns(chapters, state);

  // Generate improvement recommendations
  const improvements = generateLearningImprovements(chapters, state, successfulPatterns, unsuccessfulPatterns);

  // Generate recommendations
  const recommendations = generateLearningRecommendations(successfulPatterns, unsuccessfulPatterns, improvements);

  return {
    successfulPatterns,
    unsuccessfulPatterns,
    improvements,
    recommendations,
  };
}

/**
 * Identifies successful patterns from high-quality chapters
 */
function identifySuccessfulPatterns(
  chapters: Chapter[],
  state: NovelState
): LearningInsights['successfulPatterns'] {
  const patterns: LearningInsights['successfulPatterns'] = [];

  // Analyze engagement
  const engagement = analyzeEngagement(state);
  const highEngagementChapters = engagement.metrics
    .filter(m => m.overallEngagementScore >= 80)
    .map(m => chapters.find(ch => ch.id === m.chapterId))
    .filter((ch): ch is Chapter => ch !== undefined);

  if (highEngagementChapters.length > 0) {
    // Analyze what makes these chapters successful
    const avgHookStrength = highEngagementChapters.reduce((sum, ch) => {
      const metric = engagement.metrics.find(m => m.chapterId === ch.id);
      return sum + (metric?.hookStrength || 50);
    }, 0) / highEngagementChapters.length;

    if (avgHookStrength >= 75) {
      patterns.push({
        pattern: 'Strong opening hooks',
        context: 'First 100-200 words with action, dialogue, or intrigue',
        successRate: 85,
        avgQuality: avgHookStrength,
      });
    }

    // Check for effective cliffhangers
    const avgCliffhanger = highEngagementChapters.reduce((sum, ch) => {
      const metric = engagement.metrics.find(m => m.chapterId === ch.id);
      return sum + (metric?.cliffhangerEffectiveness || 50);
    }, 0) / highEngagementChapters.length;

    if (avgCliffhanger >= 75) {
      patterns.push({
        pattern: 'Effective chapter endings',
        context: 'Ending with questions, revelations, or mid-action cuts',
        successRate: 80,
        avgQuality: avgCliffhanger,
      });
    }
  }

  // Analyze structure
  const structureAnalysis = analyzeStoryStructure(state);
  const detectedBeats = structureAnalysis.detectedBeats.filter(b => b.strengthScore >= 70);
  
  if (detectedBeats.length > 0) {
    patterns.push({
      pattern: 'Strong story beats',
      context: 'Key structural moments well-positioned and executed',
      successRate: 75,
      avgQuality: detectedBeats.reduce((sum, b) => sum + b.strengthScore, 0) / detectedBeats.length,
    });
  }

  // Analyze prose quality
  const proseQuality = analyzeProseQuality(state);
  const highQualityChapters = proseQuality.proseQualities
    .filter(pq => pq.sentenceVarietyScore >= 75 && pq.vocabularySophistication >= 70);

  if (highQualityChapters.length > 0) {
    patterns.push({
      pattern: 'Excellent prose quality',
      context: 'Strong sentence variety, vocabulary, and show vs tell balance',
      successRate: 78,
      avgQuality: proseQuality.overallProseScore,
    });
  }

  return patterns;
}

/**
 * Identifies unsuccessful patterns from low-quality chapters
 */
function identifyUnsuccessfulPatterns(
  chapters: Chapter[],
  state: NovelState
): LearningInsights['unsuccessfulPatterns'] {
  const patterns: LearningInsights['unsuccessfulPatterns'] = [];

  // Analyze engagement
  const engagement = analyzeEngagement(state);
  const lowEngagementChapters = engagement.metrics
    .filter(m => m.overallEngagementScore < 50 || m.fatigueDetected)
    .map(m => chapters.find(ch => ch.id === m.chapterId))
    .filter((ch): ch is Chapter => ch !== undefined);

  if (lowEngagementChapters.length > 0) {
    patterns.push({
      pattern: 'Low engagement chapters',
      context: 'Chapters with weak hooks, slow pacing, or lack of conflict',
      failureRate: 65,
      avgQuality: lowEngagementChapters.reduce((sum, ch) => {
        const metric = engagement.metrics.find(m => m.chapterId === ch.id);
        return sum + (metric?.overallEngagementScore || 50);
      }, 0) / lowEngagementChapters.length,
    });
  }

  // Analyze prose quality
  const proseQuality = analyzeProseQuality(state);
  if (proseQuality.clichesDetected.length > 5) {
    patterns.push({
      pattern: 'Excessive clichés',
      context: 'Overuse of common phrases and expressions',
      failureRate: 60,
      avgQuality: proseQuality.overallProseScore,
    });
  }

  if (proseQuality.showTellBalanceScore < 50) {
    patterns.push({
      pattern: 'Too much telling',
      context: 'Excessive exposition and direct statements',
      failureRate: 55,
      avgQuality: proseQuality.showTellBalanceScore,
    });
  }

  return patterns;
}

/**
 * Generates learning-based improvements
 */
function generateLearningImprovements(
  chapters: Chapter[],
  state: NovelState,
  successfulPatterns: LearningInsights['successfulPatterns'],
  unsuccessfulPatterns: LearningInsights['unsuccessfulPatterns']
): LearningInsights['improvements'] {
  const improvements: LearningInsights['improvements'] = [];

  // Learn from successful patterns
  successfulPatterns.forEach(pattern => {
    improvements.push({
      area: pattern.pattern,
      recommendation: `Continue using ${pattern.pattern.toLowerCase()} (${pattern.successRate}% success rate, avg quality ${pattern.avgQuality.toFixed(0)}/100)`,
      expectedGain: 5, // Maintaining good practices
    });
  });

  // Improve from unsuccessful patterns
  unsuccessfulPatterns.forEach(pattern => {
    let recommendation = '';
    let expectedGain = 10;

    if (pattern.pattern === 'Low engagement chapters') {
      recommendation = 'Focus on strong hooks, conflict, and forward momentum';
      expectedGain = 15;
    } else if (pattern.pattern === 'Excessive clichés') {
      recommendation = 'Replace clichés with original expressions';
      expectedGain = 10;
    } else if (pattern.pattern === 'Too much telling') {
      recommendation = 'Increase showing through actions, sensory details, and dialogue';
      expectedGain = 12;
    }

    improvements.push({
      area: pattern.pattern,
      recommendation,
      expectedGain,
    });
  });

  // Specific improvements based on analysis
  const engagement = analyzeEngagement(state);
  const structureAnalysis = analyzeStoryStructure(state);
  const proseQuality = analyzeProseQuality(state);

  if (engagement.overallEngagementScore < 70) {
    improvements.push({
      area: 'Engagement',
      recommendation: `Increase overall engagement from ${engagement.overallEngagementScore} to 75+`,
      expectedGain: 10,
    });
  }

  if (structureAnalysis.overallStructureScore < 70) {
    improvements.push({
      area: 'Structure',
      recommendation: `Improve structure score from ${structureAnalysis.overallStructureScore} to 75+`,
      expectedGain: 8,
    });
  }

  if (proseQuality.overallProseScore < 70) {
    improvements.push({
      area: 'Prose Quality',
      recommendation: `Enhance prose quality from ${proseQuality.overallProseScore} to 75+`,
      expectedGain: 10,
    });
  }

  return improvements;
}

/**
 * Generates learning recommendations
 */
function generateLearningRecommendations(
  successfulPatterns: LearningInsights['successfulPatterns'],
  unsuccessfulPatterns: LearningInsights['unsuccessfulPatterns'],
  improvements: LearningInsights['improvements']
): string[] {
  const recommendations: string[] = [];

  // Highlight successful patterns to maintain
  if (successfulPatterns.length > 0) {
    recommendations.push(`Maintain these successful patterns: ${successfulPatterns.map(p => p.pattern).join(', ')}`);
  }

  // Address unsuccessful patterns
  if (unsuccessfulPatterns.length > 0) {
    recommendations.push(`Address these issues: ${unsuccessfulPatterns.map(p => p.pattern).join(', ')}`);
  }

  // Priority improvements
  const highImpactImprovements = improvements.filter(imp => imp.expectedGain >= 12);
  if (highImpactImprovements.length > 0) {
    recommendations.push(`High-impact improvements: ${highImpactImprovements.map(imp => imp.area).join(', ')}`);
  }

  // Learning insights
  if (successfulPatterns.length >= 3 && unsuccessfulPatterns.length === 0) {
    recommendations.push('Excellent patterns identified! Continue applying these successful techniques.');
  }

  return recommendations;
}

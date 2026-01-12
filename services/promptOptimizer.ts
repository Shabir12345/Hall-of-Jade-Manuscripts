import { NovelState, PromptEffectiveness, Chapter } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeProseQuality } from './proseQualityService';

/**
 * Prompt Optimizer
 * Analyzes prompt effectiveness and optimizes prompts based on quality metrics
 */

export interface PromptOptimizationAnalysis {
  effectiveness: PromptEffectiveness[];
  averageEffectiveness: number; // 0-100
  bestPromptVersion: string | null;
  worstPromptVersion: string | null;
  recommendations: string[];
  suggestedImprovements: Array<{
    promptVersion: string;
    improvements: string[];
    expectedGain: number; // Expected quality improvement
  }>;
}

/**
 * Records prompt effectiveness
 */
export function recordPromptEffectiveness(
  state: NovelState,
  chapterId: string,
  promptVersion: string,
  promptTemplateId?: string,
  userFeedback?: number
): PromptEffectiveness {
  // Analyze generated chapter quality
  const chapter = state.chapters.find(ch => ch.id === chapterId);
  if (!chapter) {
    throw new Error(`Chapter ${chapterId} not found`);
  }

  // Calculate quality scores
  const qualityScores = calculateChapterQualityScores(chapter, state);

  return {
    id: generateUUID(),
    novelId: state.id,
    chapterId,
    promptVersion,
    promptTemplateId,
    qualityScore: qualityScores.overall,
    structureScore: qualityScores.structure,
    engagementScore: qualityScores.engagement,
    userFeedback,
    effectivenessMetrics: {
      hookStrength: qualityScores.hookStrength,
      proseQuality: qualityScores.proseQuality,
      emotionalResonance: qualityScores.emotionalResonance,
      tensionLevel: qualityScores.tensionLevel,
    },
    createdAt: Date.now(),
  };
}

/**
 * Calculates quality scores for a chapter
 */
function calculateChapterQualityScores(
  chapter: Chapter,
  state: NovelState
): {
  overall: number;
  structure: number;
  engagement: number;
  hookStrength: number;
  proseQuality: number;
  emotionalResonance: number;
  tensionLevel: number;
} {
  // Use existing analyzers
  const engagement = analyzeEngagement(state);
  const chapterEngagement = engagement.metrics.find(m => m.chapterId === chapter.id);

  const proseQuality = analyzeProseQuality(state);
  const chapterProse = proseQuality.proseQualities.find(p => p.chapterId === chapter.id);

  // Hook strength (first 200 words)
  const hookStrength = analyzeHookStrength(chapter.content.substring(0, 200));

  // Emotional resonance (simplified)
  const emotionalResonance = analyzeEmotionalResonance(chapter);

  // Tension level (simplified)
  const tensionLevel = analyzeTensionLevel(chapter);

  // Structure score (based on logic audit)
  const structureScore = chapter.logicAudit ? 70 : 50;

  // Prose quality
  const proseScore = chapterProse ? 
    (chapterProse.sentenceVarietyScore + chapterProse.vocabularySophistication) / 2 :
    50;

  // Overall score
  const overallScore = (
    (chapterEngagement?.overallEngagementScore || 50) * 0.35 +
    structureScore * 0.25 +
    proseScore * 0.25 +
    emotionalResonance * 0.15
  );

  return {
    overall: Math.round(overallScore),
    structure: structureScore,
    engagement: chapterEngagement?.overallEngagementScore || 50,
    hookStrength,
    proseQuality: Math.round(proseScore),
    emotionalResonance,
    tensionLevel,
  };
}

/**
 * Analyzes prompt effectiveness
 */
export function analyzePromptEffectiveness(state: NovelState): PromptOptimizationAnalysis {
  // Get prompt effectiveness records (would be from database in production)
  const promptRecords: PromptEffectiveness[] = []; // Placeholder

  if (promptRecords.length === 0) {
    return {
      effectiveness: [],
      averageEffectiveness: 0,
      bestPromptVersion: null,
      worstPromptVersion: null,
      recommendations: ['No prompt effectiveness data available. Generate more chapters to track effectiveness.'],
      suggestedImprovements: [],
    };
  }

  // Calculate average effectiveness
  const averageEffectiveness = promptRecords.reduce((sum, p) => sum + p.qualityScore, 0) / promptRecords.length;

  // Find best and worst prompt versions
  const bestPrompt = promptRecords.reduce((best, current) => 
    current.qualityScore > best.qualityScore ? current : best
  );

  const worstPrompt = promptRecords.reduce((worst, current) => 
    current.qualityScore < worst.qualityScore ? current : worst
  );

  // Generate improvements
  const suggestedImprovements = generatePromptImprovements(promptRecords, state);

  // Generate recommendations
  const recommendations = generatePromptRecommendations(
    promptRecords,
    averageEffectiveness,
    bestPrompt,
    worstPrompt
  );

  return {
    effectiveness: promptRecords,
    averageEffectiveness: Math.round(averageEffectiveness),
    bestPromptVersion: bestPrompt.promptVersion,
    worstPromptVersion: worstPrompt.promptVersion,
    recommendations,
    suggestedImprovements,
  };
}

/**
 * Generates prompt improvements
 */
function generatePromptImprovements(
  promptRecords: PromptEffectiveness[],
  state: NovelState
): PromptOptimizationAnalysis['suggestedImprovements'] {
  const improvements: PromptOptimizationAnalysis['suggestedImprovements'] = [];

  // Group by prompt version
  const versionGroups = new Map<string, PromptEffectiveness[]>();
  promptRecords.forEach(record => {
    const records = versionGroups.get(record.promptVersion) || [];
    records.push(record);
    versionGroups.set(record.promptVersion, records);
  });

  // Analyze each version
  versionGroups.forEach((records, version) => {
    const avgQuality = records.reduce((sum, r) => sum + r.qualityScore, 0) / records.length;
    
    if (avgQuality < 75) {
      const versionImprovements: string[] = [];

      // Analyze weaknesses
      const avgStructure = records.reduce((sum, r) => sum + (r.structureScore || 50), 0) / records.length;
      const avgEngagement = records.reduce((sum, r) => sum + (r.engagementScore || 50), 0) / records.length;

      if (avgStructure < 70) {
        versionImprovements.push('Add structure guidance to prompt');
        versionImprovements.push('Include story beat requirements');
      }

      if (avgEngagement < 70) {
        versionImprovements.push('Emphasize hook strength in prompt');
        versionImprovements.push('Include engagement criteria');
      }

      // Calculate expected gain
      const expectedGain = estimatePromptImprovementGain(avgQuality, versionImprovements.length);

      improvements.push({
        promptVersion: version,
        improvements: versionImprovements,
        expectedGain,
      });
    }
  });

  return improvements;
}

/**
 * Estimates improvement gain from prompt changes
 */
function estimatePromptImprovementGain(currentQuality: number, improvementCount: number): number {
  // Each improvement might add 3-5 points
  const gainPerImprovement = 4;
  return Math.min(20, improvementCount * gainPerImprovement);
}

/**
 * Generates prompt recommendations
 */
function generatePromptRecommendations(
  promptRecords: PromptEffectiveness[],
  averageEffectiveness: number,
  bestPrompt: PromptEffectiveness,
  worstPrompt: PromptEffectiveness
): string[] {
  const recommendations: string[] = [];

  if (averageEffectiveness < 70) {
    recommendations.push(`Average prompt effectiveness is ${averageEffectiveness}/100. Consider optimizing prompts.`);
  }

  if (bestPrompt && worstPrompt) {
    const qualityGap = bestPrompt.qualityScore - worstPrompt.qualityScore;
    if (qualityGap > 20) {
      recommendations.push(`Large quality gap between best (${bestPrompt.promptVersion}) and worst (${worstPrompt.promptVersion}) prompts. Standardize on best practices.`);
    }
  }

  if (averageEffectiveness >= 80) {
    recommendations.push('Excellent prompt effectiveness! Prompts are generating high-quality chapters.');
  }

  return recommendations;
}

/**
 * Helper functions for analysis
 */
function analyzeHookStrength(hookText: string): number {
  const indicators = ['suddenly', 'unexpected', 'crisis', 'danger', 'mystery'];
  const indicatorCount = indicators.filter(ind => hookText.toLowerCase().includes(ind)).length;
  return Math.min(100, 50 + indicatorCount * 10);
}

function analyzeEmotionalResonance(chapter: Chapter): number {
  const content = chapter.content.toLowerCase();
  const emotionalWords = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'love', 'hate'];
  const emotionalCount = emotionalWords.filter(word => content.includes(word)).length;
  return Math.min(100, 40 + emotionalCount * 8);
}

function analyzeTensionLevel(chapter: Chapter): number {
  const content = chapter.content.toLowerCase();
  const tensionWords = ['tense', 'danger', 'threat', 'crisis', 'conflict', 'battle'];
  const tensionCount = tensionWords.filter(word => content.includes(word)).length;
  return Math.min(100, 40 + tensionCount * 10);
}

import { NovelState, MarketReadiness } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeOriginality } from './originalityDetector';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';
import { analyzeGenreConventions } from './genreConventionService';

/**
 * Market Readiness Service
 * Assesses commercial appeal, literary merit, originality, readability, and accessibility
 */

export interface MarketReadinessAnalysis {
  marketReadiness: MarketReadiness;
  commercialAppealScore: number; // 0-100
  literaryMeritScore: number; // 0-100
  originalityScore: number; // 0-100
  readabilityScore: number; // 0-100
  accessibilityScore: number; // 0-100
  overallReadiness: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

/**
 * Analyzes market readiness
 */
export function analyzeMarketReadiness(state: NovelState): MarketReadinessAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      marketReadiness: {
        id: generateUUID(),
        novelId: state.id,
        commercialAppealScore: 0,
        literaryMeritScore: 0,
        originalityScore: 0,
        readabilityScore: 0,
        accessibilityScore: 0,
        overallReadiness: 0,
        strengths: [],
        weaknesses: [],
        recommendations: ['No chapters available for market readiness analysis'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      commercialAppealScore: 0,
      literaryMeritScore: 0,
      originalityScore: 0,
      readabilityScore: 0,
      accessibilityScore: 0,
      overallReadiness: 0,
      strengths: [],
      weaknesses: [],
      recommendations: ['No chapters available for market readiness analysis'],
    };
  }

  // Perform analyses
  const proseQuality = analyzeProseQuality(state);
  const engagement = analyzeEngagement(state);
  const originality = analyzeOriginality(state);
  const structure = analyzeStoryStructure(state);
  const themes = analyzeThemeEvolution(state);
  const genreConventions = analyzeGenreConventions(state);

  // Calculate individual scores
  const commercialAppealScore = calculateCommercialAppeal(
    engagement,
    structure,
    genreConventions,
    chapters
  );

  const literaryMeritScore = calculateLiteraryMerit(
    proseQuality,
    themes,
    structure,
    chapters
  );

  const originalityScore = originality.overallOriginality;

  const readabilityScore = calculateReadability(
    proseQuality,
    chapters
  );

  const accessibilityScore = calculateAccessibility(
    chapters,
    proseQuality,
    genreConventions
  );

  // Calculate overall readiness
  const overallReadiness = calculateOverallReadiness(
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore
  );

  // Identify strengths and weaknesses
  const strengths = identifyStrengths(
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore,
    engagement,
    structure,
    themes
  );

  const weaknesses = identifyWeaknesses(
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore,
    engagement,
    structure,
    themes,
    proseQuality
  );

  // Create market readiness record
  const marketReadiness: MarketReadiness = {
    id: generateUUID(),
    novelId: state.id,
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore,
    overallReadiness,
    strengths,
    weaknesses,
    recommendations: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // Generate recommendations
  const recommendations = generateMarketRecommendations(
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore,
    overallReadiness,
    strengths,
    weaknesses
  );

  marketReadiness.recommendations = recommendations;

  return {
    marketReadiness,
    commercialAppealScore,
    literaryMeritScore,
    originalityScore,
    readabilityScore,
    accessibilityScore,
    overallReadiness,
    strengths,
    weaknesses,
    recommendations,
  };
}

/**
 * Calculates commercial appeal (0-100)
 */
function calculateCommercialAppeal(
  engagement: ReturnType<typeof analyzeEngagement>,
  structure: StoryStructureAnalysis,
  genreConventions: ReturnType<typeof analyzeGenreConventions>,
  chapters: Chapter[]
): number {
  let score = 50; // Base score

  // Engagement contributes heavily (40%)
  const avgEngagement = engagement.metrics.length > 0
    ? engagement.metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / engagement.metrics.length
    : 50;
  score += (avgEngagement / 100) * 40;

  // Genre adherence contributes (20%)
  score += (genreConventions.adherenceScore / 100) * 20;

  // Structure quality contributes (20%)
  score += (structure.overallStructureScore / 100) * 20;

  // Chapter count (commercial novels typically have many chapters)
  const chapterCount = chapters.length;
  if (chapterCount >= 50) {
    score += 10; // Good length for serialization
  } else if (chapterCount >= 20) {
    score += 5; // Adequate length
  }

  // Hook strength (first chapter engagement)
  const firstChapterEngagement = engagement.metrics.find(m => m.chapterNumber === 1);
  if (firstChapterEngagement && firstChapterEngagement.hookStrength >= 70) {
    score += 10; // Strong opening hook
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates literary merit (0-100)
 */
function calculateLiteraryMerit(
  proseQuality: ReturnType<typeof analyzeProseQuality>,
  themes: ReturnType<typeof analyzeThemeEvolution>,
  structure: StoryStructureAnalysis,
  chapters: Chapter[]
): number {
  let score = 50; // Base score

  // Prose quality contributes (40%)
  score += (proseQuality.overallProseScore / 100) * 40;

  // Thematic depth contributes (30%)
  score += (themes.philosophicalDepthScore / 100) * 30;

  // Structure quality contributes (20%)
  score += (structure.overallStructureScore / 100) * 20;

  // Character development (10%)
  // This would be enhanced with character psychology analysis
  const hasCharacterDevelopment = chapters.some(ch => 
    (ch.content + ' ' + ch.summary).toLowerCase().includes('growth') ||
    (ch.content + ' ' + ch.summary).toLowerCase().includes('development')
  );
  if (hasCharacterDevelopment) {
    score += 10;
  }

  // Bonus for low cliché usage
  if (proseQuality.clichesDetected.length === 0) {
    score += 10;
  } else if (proseQuality.clichesDetected.length > 10) {
    score -= 10; // Too many clichés
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates readability (0-100)
 */
function calculateReadability(
  proseQuality: ReturnType<typeof analyzeProseQuality>,
  chapters: Chapter[]
): number {
  let score = 50; // Base score

  // Flesch-Kincaid score (higher = more readable, typically 0-100)
  const avgFleschKincaid = proseQuality.proseQualities.length > 0
    ? proseQuality.proseQualities.reduce((sum, pq) => sum + pq.fleschKincaidScore, 0) / proseQuality.proseQualities.length
    : 50;

  // Ideal readability: 60-80 (good for general audience)
  if (avgFleschKincaid >= 60 && avgFleschKincaid <= 80) {
    score += 30; // Excellent readability
  } else if (avgFleschKincaid >= 50 && avgFleschKincaid <= 90) {
    score += 20; // Good readability
  } else if (avgFleschKincaid < 30) {
    score -= 20; // Too difficult
  } else if (avgFleschKincaid > 90) {
    score -= 10; // Too simple (might be boring)
  }

  // Sentence variety contributes (easier to read with variety)
  const avgSentenceVariety = proseQuality.sentenceVarietyScore;
  score += (avgSentenceVariety / 100) * 20;

  // Average sentence length (optimal: 15-20 words)
  const avgSentenceLength = proseQuality.proseQualities.length > 0
    ? proseQuality.proseQualities.reduce((sum, pq) => sum + pq.averageSentenceLength, 0) / proseQuality.proseQualities.length
    : 15;

  if (avgSentenceLength >= 12 && avgSentenceLength <= 22) {
    score += 10; // Optimal sentence length
  } else if (avgSentenceLength > 30) {
    score -= 15; // Too long (difficult)
  } else if (avgSentenceLength < 8) {
    score -= 10; // Too short (choppy)
  }

  // Check for clarity (no excessive jargon)
  const allContent = chapters.map(ch => ch.content).join(' ');
  const jargonPatterns = [
    /\b\w{15,}\b/g, // Very long words
    /\b[A-Z]{3,}\b/g, // Acronyms
  ];

  let jargonCount = 0;
  jargonPatterns.forEach(pattern => {
    jargonCount += (allContent.match(pattern) || []).length;
  });

  if (jargonCount < allContent.split(/\s+/).length * 0.01) {
    score += 10; // Low jargon (accessible)
  } else if (jargonCount > allContent.split(/\s+/).length * 0.05) {
    score -= 10; // Too much jargon (inaccessible)
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates accessibility (0-100)
 */
function calculateAccessibility(
  chapters: Chapter[],
  proseQuality: ReturnType<typeof analyzeProseQuality>,
  genreConventions: ReturnType<typeof analyzeGenreConventions>
): number {
  let score = 50; // Base score

  // Genre familiarity (familiar conventions = more accessible)
  score += (genreConventions.adherenceScore / 100) * 30;

  // Clarity (show vs tell balance)
  const avgShowTell = proseQuality.showTellBalanceScore;
  if (avgShowTell >= 60 && avgShowTell <= 80) {
    score += 20; // Good balance (accessible)
  }

  // Readability contributes
  const readability = calculateReadability(proseQuality, chapters);
  score += (readability / 100) * 30;

  // Chapter length consistency (consistent length = more accessible)
  const chapterLengths = chapters.map(ch => ch.content.split(/\s+/).length);
  const lengthVariance = calculateVariance(chapterLengths);
  
  if (lengthVariance < 50000) {
    score += 10; // Consistent chapter lengths
  } else if (lengthVariance > 200000) {
    score -= 10; // Inconsistent lengths (confusing)
  }

  // Check for exposition dumps (reduce accessibility)
  const allContent = chapters.map(ch => ch.content).join(' ');
  const expositionIndicators = [
    'as you know', 'let me explain', 'in other words', 'to clarify',
    'for example', 'specifically', 'in detail', 'comprehensive explanation'
  ];

  const expositionCount = expositionIndicators.filter(indicator => 
    allContent.toLowerCase().includes(indicator)
  ).length;

  if (expositionCount === 0) {
    score += 10; // No obvious exposition dumps
  } else if (expositionCount > 5) {
    score -= 10; // Too much exposition (overwhelming)
  }

  // Check for glossary or world-building ease
  const worldEntries = chapters.map(ch => ch.summary).join(' ');
  if (worldEntries.includes('explain') || worldEntries.includes('introduce') || 
      worldEntries.includes('first time') || worldEntries.includes('new')) {
    score += 5; // Good world-building introduction
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates overall readiness (0-100)
 */
function calculateOverallReadiness(
  commercialAppeal: number,
  literaryMerit: number,
  originality: number,
  readability: number,
  accessibility: number
): number {
  // Weighted average with emphasis on commercial appeal and readability
  return Math.round(
    commercialAppeal * 0.3 +
    literaryMerit * 0.25 +
    originality * 0.15 +
    readability * 0.15 +
    accessibility * 0.15
  );
}

/**
 * Identifies strengths
 */
function identifyStrengths(
  commercialAppeal: number,
  literaryMerit: number,
  originality: number,
  readability: number,
  accessibility: number,
  engagement: ReturnType<typeof analyzeEngagement>,
  structure: StoryStructureAnalysis,
  themes: ReturnType<typeof analyzeThemeEvolution>
): string[] {
  const strengths: string[] = [];

  if (commercialAppeal >= 75) {
    strengths.push('High commercial appeal');
  }
  if (literaryMerit >= 75) {
    strengths.push('Strong literary merit');
  }
  if (originality >= 75) {
    strengths.push('High originality');
  }
  if (readability >= 75) {
    strengths.push('Excellent readability');
  }
  if (accessibility >= 75) {
    strengths.push('Highly accessible to readers');
  }

  const avgEngagement = engagement.metrics.length > 0
    ? engagement.metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / engagement.metrics.length
    : 0;

  if (avgEngagement >= 75) {
    strengths.push('Strong reader engagement');
  }

  if (structure.overallStructureScore >= 75) {
    strengths.push('Solid story structure');
  }

  if (themes.philosophicalDepthScore >= 70) {
    strengths.push('Deep thematic exploration');
  }

  return strengths;
}

/**
 * Identifies weaknesses
 */
function identifyWeaknesses(
  commercialAppeal: number,
  literaryMerit: number,
  originality: number,
  readability: number,
  accessibility: number,
  engagement: ReturnType<typeof analyzeEngagement>,
  structure: StoryStructureAnalysis,
  themes: ReturnType<typeof analyzeThemeEvolution>,
  proseQuality: ReturnType<typeof analyzeProseQuality>
): string[] {
  const weaknesses: string[] = [];

  if (commercialAppeal < 60) {
    weaknesses.push(`Commercial appeal is ${commercialAppeal}/100 - improve engagement and genre adherence`);
  }
  if (literaryMerit < 60) {
    weaknesses.push(`Literary merit is ${literaryMerit}/100 - improve prose quality and thematic depth`);
  }
  if (originality < 50) {
    weaknesses.push(`Originality is ${originality}/100 - add unique elements and subvert tropes`);
  }
  if (readability < 60) {
    weaknesses.push(`Readability is ${readability}/100 - simplify language and improve clarity`);
  }
  if (accessibility < 60) {
    weaknesses.push(`Accessibility is ${accessibility}/100 - improve world-building introduction and clarity`);
  }

  const avgEngagement = engagement.metrics.length > 0
    ? engagement.metrics.reduce((sum, m) => sum + m.overallEngagementScore, 0) / engagement.metrics.length
    : 0;

  if (avgEngagement < 60) {
    weaknesses.push(`Low engagement (${avgEngagement.toFixed(0)}/100) - improve hooks and pacing`);
  }

  if (proseQuality.clichesDetected.length > 5) {
    weaknesses.push(`Too many clichés (${proseQuality.clichesDetected.length}) - replace with original expressions`);
  }

  if (structure.overallStructureScore < 60) {
    weaknesses.push(`Structure score is ${structure.overallStructureScore}/100 - review act proportions`);
  }

  return weaknesses;
}

/**
 * Generates market recommendations
 */
function generateMarketRecommendations(
  commercialAppeal: number,
  literaryMerit: number,
  originality: number,
  readability: number,
  accessibility: number,
  overallReadiness: number,
  strengths: string[],
  weaknesses: string[]
): string[] {
  const recommendations: string[] = [];

  if (overallReadiness < 60) {
    recommendations.push(`Overall market readiness is ${overallReadiness}/100. Focus on key areas: commercial appeal, readability, and accessibility.`);
  }

  // Priority improvements
  if (commercialAppeal < literaryMerit && commercialAppeal < 70) {
    recommendations.push(`Priority: Improve commercial appeal (${commercialAppeal}/100). Focus on engagement, hooks, and genre conventions.`);
  }

  if (readability < 60) {
    recommendations.push(`Priority: Improve readability (${readability}/100). Simplify language, vary sentence length, and reduce jargon.`);
  }

  if (accessibility < 60) {
    recommendations.push(`Priority: Improve accessibility (${accessibility}/100). Better world-building introduction and clearer exposition.`);
  }

  // Specific recommendations based on scores
  if (commercialAppeal >= 70 && literaryMerit < 70) {
    recommendations.push('Strong commercial appeal. Consider enhancing literary merit through better prose and thematic depth.');
  }

  if (literaryMerit >= 70 && commercialAppeal < 70) {
    recommendations.push('Strong literary merit. Consider enhancing commercial appeal through better engagement and genre conventions.');
  }

  if (originality < 50 && overallReadiness < 70) {
    recommendations.push('Low originality may limit market appeal. Add unique elements while maintaining genre conventions.');
  }

  // Positive feedback
  if (overallReadiness >= 80) {
    recommendations.push(`Excellent market readiness (${overallReadiness}/100)! The novel is well-positioned for publication.`);
  } else if (overallReadiness >= 70) {
    recommendations.push(`Good market readiness (${overallReadiness}/100). Minor improvements could enhance appeal further.`);
  }

  // Specific strengths to highlight
  if (strengths.length > 0) {
    recommendations.push(`Strengths: ${strengths.slice(0, 3).join(', ')}.`);
  }

  // Specific weaknesses to address
  if (weaknesses.length > 0) {
    recommendations.push(`Key improvements: ${weaknesses.slice(0, 3).join(', ')}.`);
  }

  return recommendations;
}

/**
 * Helper: Calculate variance
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
}

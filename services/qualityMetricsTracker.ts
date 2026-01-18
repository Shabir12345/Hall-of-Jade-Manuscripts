import { ChapterQualityMetrics, RegenerationResult } from '../types';

/**
 * Quality Metrics Tracker
 * Tracks quality metrics over time for analytics and monitoring
 */

interface QualityMetricsSnapshot {
  timestamp: number;
  chapterId: string;
  chapterNumber: number;
  metrics: ChapterQualityMetrics;
  regenerationAttempts?: number;
  regenerationSuccess?: boolean;
}

interface QualityTrends {
  averageOriginality: number;
  averageNarrativeCraft: number;
  averageVoiceConsistency: number;
  averageEditorialScore: number;
  regenerationRate: number;
  improvementRate: number;
  totalChapters: number;
  totalRegenerations: number;
  successfulRegenerations: number;
}

// In-memory storage (in production, this would be persisted to database)
const metricsHistory: QualityMetricsSnapshot[] = [];
const MAX_HISTORY = 100; // Keep last 100 chapters

/**
 * Records quality metrics for a chapter
 */
export function recordQualityMetrics(
  chapterId: string,
  chapterNumber: number,
  metrics: ChapterQualityMetrics,
  regenerationResult?: RegenerationResult
): void {
  const snapshot: QualityMetricsSnapshot = {
    timestamp: Date.now(),
    chapterId,
    chapterNumber,
    metrics,
    regenerationAttempts: regenerationResult?.attempts,
    regenerationSuccess: regenerationResult?.success,
  };

  metricsHistory.push(snapshot);

  // Keep only recent history
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Quality Metrics] Recorded:', {
      chapterNumber,
      originality: metrics.originalityScore.overallOriginality,
      narrativeCraft: metrics.narrativeCraftScore.overallCraftScore,
      voiceConsistency: metrics.voiceConsistencyScore,
      regenerationAttempts: regenerationResult?.attempts,
    });
  }
}

/**
 * Calculates quality trends from history
 */
export function calculateQualityTrends(): QualityTrends {
  if (metricsHistory.length === 0) {
    return {
      averageOriginality: 0,
      averageNarrativeCraft: 0,
      averageVoiceConsistency: 0,
      averageEditorialScore: 0,
      regenerationRate: 0,
      improvementRate: 0,
      totalChapters: 0,
      totalRegenerations: 0,
      successfulRegenerations: 0,
    };
  }

  const totalChapters = metricsHistory.length;
  let totalOriginality = 0;
  let totalNarrativeCraft = 0;
  let totalVoiceConsistency = 0;
  let totalEditorialScore = 0;
  let totalRegenerations = 0;
  let successfulRegenerations = 0;

  metricsHistory.forEach(snapshot => {
    totalOriginality += snapshot.metrics.originalityScore.overallOriginality;
    totalNarrativeCraft += snapshot.metrics.narrativeCraftScore.overallCraftScore;
    totalVoiceConsistency += snapshot.metrics.voiceConsistencyScore;
    
    const editorial = snapshot.metrics.editorialScore;
    totalEditorialScore += (
      editorial.readability +
      editorial.flow +
      editorial.emotionalAuthenticity +
      editorial.narrativeCoherence +
      editorial.structuralBalance
    ) / 5;

    if (snapshot.regenerationAttempts && snapshot.regenerationAttempts > 0) {
      totalRegenerations++;
      if (snapshot.regenerationSuccess) {
        successfulRegenerations++;
      }
    }
  });

  const regenerationRate = totalChapters > 0 ? (totalRegenerations / totalChapters) * 100 : 0;
  const improvementRate = totalRegenerations > 0 ? (successfulRegenerations / totalRegenerations) * 100 : 0;

  return {
    averageOriginality: totalOriginality / totalChapters,
    averageNarrativeCraft: totalNarrativeCraft / totalChapters,
    averageVoiceConsistency: totalVoiceConsistency / totalChapters,
    averageEditorialScore: totalEditorialScore / totalChapters,
    regenerationRate,
    improvementRate,
    totalChapters,
    totalRegenerations,
    successfulRegenerations,
  };
}

/**
 * Gets quality metrics for a specific chapter
 */
export function getChapterMetrics(chapterId: string): QualityMetricsSnapshot | null {
  return metricsHistory.find(s => s.chapterId === chapterId) || null;
}

/**
 * Gets recent quality metrics (last N chapters)
 */
export function getRecentMetrics(count: number = 10): QualityMetricsSnapshot[] {
  return metricsHistory.slice(-count).reverse();
}

/**
 * Gets quality distribution (score ranges)
 */
export function getQualityDistribution(): {
  originality: Record<string, number>;
  narrativeCraft: Record<string, number>;
  voiceConsistency: Record<string, number>;
} {
  const originality: Record<string, number> = {
    excellent: 0, // 90-100
    good: 0,      // 75-89
    acceptable: 0, // 60-74
    poor: 0,      // <60
  };

  const narrativeCraft: Record<string, number> = {
    excellent: 0,
    good: 0,
    acceptable: 0,
    poor: 0,
  };

  const voiceConsistency: Record<string, number> = {
    excellent: 0,
    good: 0,
    acceptable: 0,
    poor: 0,
  };

  metricsHistory.forEach(snapshot => {
    const orig = snapshot.metrics.originalityScore.overallOriginality;
    const craft = snapshot.metrics.narrativeCraftScore.overallCraftScore;
    const voice = snapshot.metrics.voiceConsistencyScore;

    if (orig >= 90) originality.excellent++;
    else if (orig >= 75) originality.good++;
    else if (orig >= 60) originality.acceptable++;
    else originality.poor++;

    if (craft >= 90) narrativeCraft.excellent++;
    else if (craft >= 75) narrativeCraft.good++;
    else if (craft >= 60) narrativeCraft.acceptable++;
    else narrativeCraft.poor++;

    if (voice >= 90) voiceConsistency.excellent++;
    else if (voice >= 75) voiceConsistency.good++;
    else if (voice >= 60) voiceConsistency.acceptable++;
    else voiceConsistency.poor++;
  });

  return { originality, narrativeCraft, voiceConsistency };
}

/**
 * Gets regeneration statistics
 */
export function getRegenerationStats(): {
  totalRegenerations: number;
  successfulRegenerations: number;
  averageAttempts: number;
  commonFailureReasons: Array<{ reason: string; count: number }>;
} {
  const regenerations = metricsHistory.filter(s => s.regenerationAttempts && s.regenerationAttempts > 0);
  const totalRegenerations = regenerations.length;
  const successfulRegenerations = regenerations.filter(s => s.regenerationSuccess).length;
  
  const totalAttempts = regenerations.reduce((sum, s) => sum + (s.regenerationAttempts || 0), 0);
  const averageAttempts = totalRegenerations > 0 ? totalAttempts / totalRegenerations : 0;

  // Count common failure reasons
  const failureReasons: Record<string, number> = {};
  metricsHistory.forEach(snapshot => {
    snapshot.metrics.regenerationReasons.forEach(reason => {
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
    });
  });

  const commonFailureReasons = Object.entries(failureReasons)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRegenerations,
    successfulRegenerations,
    averageAttempts,
    commonFailureReasons,
  };
}

/**
 * Exports metrics history for analysis
 */
export function exportMetricsHistory(): QualityMetricsSnapshot[] {
  return [...metricsHistory];
}

/**
 * Clears metrics history (useful for testing)
 */
export function clearMetricsHistory(): void {
  metricsHistory.length = 0;
}

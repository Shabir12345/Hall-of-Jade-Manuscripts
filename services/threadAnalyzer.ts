/**
 * Thread Analyzer Service
 * Analyzes thread health, detects plot holes, and suggests pacing improvements
 * Enhanced with standards-based analysis from storyProgressionStandards
 */

import { StoryThread, ThreadStatus, StoryThreadType, NovelState } from '../types';
import { calculateThreadHealth, detectStaleThreads } from './storyThreadService';
import {
  THREAD_DENSITY_STANDARDS,
  THREAD_PROGRESSION_STANDARDS,
  THREAD_TYPE_THRESHOLDS,
  ARC_POSITION_STANDARDS,
  getStaleThreshold,
  getMaxThreadAge,
  getWarningAge,
  determineArcPosition,
  calculateThreadDensity,
  calculateAverageResolutionTime,
  getProgressionSuggestion,
  calculateStoryHealthScore,
  getAtRiskThreads,
  countRecentProgressions,
  countRecentResolutions,
  ArcPosition,
} from './storyProgressionStandards';

export interface ThreadHealthAnalysis {
  overallHealth: number; // 0-100
  healthyThreads: number;
  atRiskThreads: number;
  staleThreads: number;
  resolvedThreads: number;
  abandonedThreads: number;
  threadsByType: Record<string, number>;
  threadsByPriority: Record<string, number>;
  threadsByStatus: Record<string, number>;
  averageResolutionTime: number; // Average chapters to resolution
  resolutionRate: number; // Percentage of threads resolved
  threadDensity: number; // Average threads per chapter
  averageThreadLifespan: Record<string, number>; // Average lifespan by type
  mostActiveThreads: Array<{ thread: StoryThread; activityScore: number }>;
  completionForecast: {
    estimatedChaptersToComplete: number;
    threadsNeedingResolution: number;
    averageChaptersPerResolution: number;
  };
  plotHoles: Array<{
    thread: StoryThread;
    issue: string;
    severity: 'critical' | 'high' | 'medium';
  }>;
  pacingSuggestions: Array<{
    thread: StoryThread;
    suggestion: string;
    urgency: 'high' | 'medium' | 'low';
  }>;
  // New standards-based metrics
  standardsCompliance: {
    densityStatus: 'critical' | 'warning' | 'optimal' | 'excessive';
    progressionRate: number; // % of threads progressing recently
    recentResolutions: number;
    threadsAtPlotHoleRisk: number;
  };
  arcPositionAnalysis?: {
    position: ArcPosition;
    positionName: string;
    expectedProgressionRate: number;
    actualProgressionRate: number;
    isOnTrack: boolean;
  };
}

/**
 * Analyze overall thread health for a novel
 * Enhanced with standards-based analysis
 */
export function analyzeThreadHealth(
  threads: StoryThread[],
  currentChapter: number,
  totalPlannedChapters?: number
): ThreadHealthAnalysis {
  const estimatedTotal = totalPlannedChapters || currentChapter + 30;

  const analysis: ThreadHealthAnalysis = {
    overallHealth: 0,
    healthyThreads: 0,
    atRiskThreads: 0,
    staleThreads: 0,
    resolvedThreads: 0,
    abandonedThreads: 0,
    threadsByType: {},
    threadsByPriority: {},
    threadsByStatus: {},
    averageResolutionTime: 0,
    resolutionRate: 0,
    threadDensity: 0,
    averageThreadLifespan: {},
    mostActiveThreads: [],
    completionForecast: {
      estimatedChaptersToComplete: 0,
      threadsNeedingResolution: 0,
      averageChaptersPerResolution: 0,
    },
    plotHoles: [],
    pacingSuggestions: [],
    standardsCompliance: {
      densityStatus: 'optimal',
      progressionRate: 0,
      recentResolutions: 0,
      threadsAtPlotHoleRisk: 0,
    },
  };

  if (threads.length === 0) {
    return analysis;
  }

  // Categorize threads
  const healthScores: number[] = [];
  const resolutionTimes: number[] = [];

  for (const thread of threads) {
    // Count by type
    analysis.threadsByType[thread.type] = (analysis.threadsByType[thread.type] || 0) + 1;

    // Count by priority
    analysis.threadsByPriority[thread.priority] = (analysis.threadsByPriority[thread.priority] || 0) + 1;

    // Count by status
    analysis.threadsByStatus[thread.status] = (analysis.threadsByStatus[thread.status] || 0) + 1;

    // Calculate health
    const health = calculateThreadHealth(thread, currentChapter);
    healthScores.push(health);

    if (thread.status === 'resolved') {
      analysis.resolvedThreads++;
      if (thread.resolvedChapter && thread.introducedChapter) {
        resolutionTimes.push(thread.resolvedChapter - thread.introducedChapter);
      }
    } else if (thread.status === 'abandoned') {
      analysis.abandonedThreads++;
    } else if (health >= 70) {
      analysis.healthyThreads++;
    } else if (health >= 40) {
      analysis.atRiskThreads++;
    } else {
      analysis.staleThreads++;
    }
  }

  // Calculate overall health (average of all thread health scores)
  analysis.overallHealth = healthScores.length > 0
    ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length)
    : 100;

  // Calculate average resolution time
  analysis.averageResolutionTime = resolutionTimes.length > 0
    ? Math.round(resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length)
    : 0;

  // Calculate resolution rate
  const totalThreads = threads.length;
  analysis.resolutionRate = totalThreads > 0
    ? Math.round((analysis.resolvedThreads / totalThreads) * 100)
    : 0;

  // Calculate thread density (threads per chapter)
  analysis.threadDensity = calculateThreadDensity(threads, currentChapter);

  // Calculate average thread lifespan by type
  const lifespanByType: Record<string, number[]> = {};
  threads.forEach(thread => {
    if (!lifespanByType[thread.type]) {
      lifespanByType[thread.type] = [];
    }
    if (thread.status === 'resolved' && thread.resolvedChapter && thread.introducedChapter) {
      lifespanByType[thread.type].push(thread.resolvedChapter - thread.introducedChapter);
    } else {
      lifespanByType[thread.type].push(currentChapter - thread.introducedChapter);
    }
  });

  Object.keys(lifespanByType).forEach(type => {
    const lifespans = lifespanByType[type];
    if (lifespans.length > 0) {
      analysis.averageThreadLifespan[type] = Math.round(
        lifespans.reduce((a, b) => a + b, 0) / lifespans.length
      );
    }
  });

  // Calculate most active threads (based on progression notes and chapters involved)
  const threadActivity = threads.map(thread => ({
    thread,
    activityScore: (thread.progressionNotes?.length || 0) * 2 + (thread.chaptersInvolved?.length || 0),
  }));
  threadActivity.sort((a, b) => b.activityScore - a.activityScore);
  analysis.mostActiveThreads = threadActivity.slice(0, 5);

  // Calculate completion forecast
  const unresolvedThreads = threads.filter(t => t.status !== 'resolved' && t.status !== 'abandoned');
  analysis.completionForecast.threadsNeedingResolution = unresolvedThreads.length;

  if (resolutionTimes.length > 0 && unresolvedThreads.length > 0) {
    const avgResolutionTime = analysis.averageResolutionTime;
    // Use estimatedDuration if available
    let totalEstimatedChapters = 0;
    for (const t of unresolvedThreads) {
      if (t.estimatedDuration) {
        totalEstimatedChapters += t.estimatedDuration;
      } else {
        totalEstimatedChapters += Math.max(avgResolutionTime / 2, 1);
      }
    }

    analysis.completionForecast.averageChaptersPerResolution = avgResolutionTime;
    analysis.completionForecast.estimatedChaptersToComplete = Math.ceil(totalEstimatedChapters);
  } else {
    analysis.completionForecast.averageChaptersPerResolution = 0;
    analysis.completionForecast.estimatedChaptersToComplete = 0;
  }

  // Detect stale threads using standards-based thresholds
  const staleThreads = detectStaleThreads(threads, currentChapter, 10);
  analysis.staleThreads = staleThreads.length;

  // Detect plot holes
  analysis.plotHoles = detectPlotHoles(threads, currentChapter);

  // Generate pacing suggestions
  analysis.pacingSuggestions = suggestThreadPacing(threads, currentChapter);

  // NEW: Standards-based compliance analysis
  const density = analysis.threadDensity;
  if (density < THREAD_DENSITY_STANDARDS.critical.low) {
    analysis.standardsCompliance.densityStatus = 'critical';
  } else if (density < THREAD_DENSITY_STANDARDS.warning.low) {
    analysis.standardsCompliance.densityStatus = 'warning';
  } else if (density > THREAD_DENSITY_STANDARDS.critical.high) {
    analysis.standardsCompliance.densityStatus = 'excessive';
  } else if (density > THREAD_DENSITY_STANDARDS.warning.high) {
    analysis.standardsCompliance.densityStatus = 'warning';
  } else {
    analysis.standardsCompliance.densityStatus = 'optimal';
  }

  // Calculate progression rate using standards
  const activeThreads = threads.filter(t => t.status === 'active');
  const recentProgressions = countRecentProgressions(threads, currentChapter, 3);
  analysis.standardsCompliance.progressionRate = activeThreads.length > 0
    ? Math.round((recentProgressions / activeThreads.length) * 100)
    : 0;

  // Count recent resolutions
  analysis.standardsCompliance.recentResolutions = countRecentResolutions(threads, currentChapter, 5);

  // Count threads at plot hole risk
  analysis.standardsCompliance.threadsAtPlotHoleRisk = getAtRiskThreads(threads, currentChapter).length;

  // Arc position analysis if we have total planned chapters
  if (totalPlannedChapters) {
    const position = determineArcPosition(currentChapter, totalPlannedChapters);
    const requirements = ARC_POSITION_STANDARDS[position];

    analysis.arcPositionAnalysis = {
      position,
      positionName: requirements.name,
      expectedProgressionRate: requirements.threadProgressionRate,
      actualProgressionRate: analysis.standardsCompliance.progressionRate,
      isOnTrack: analysis.standardsCompliance.progressionRate >= requirements.threadProgressionRate * 0.7,
    };
  }

  // Recalculate overall health using standards-based scoring
  analysis.overallHealth = calculateStoryHealthScore(threads, currentChapter, estimatedTotal);

  return analysis;
}

/**
 * Detect plot holes (unresolved threads that should be resolved)
 * Uses standards-based type-specific thresholds for better detection
 */
export function detectPlotHoles(
  threads: StoryThread[],
  currentChapter: number
): Array<{ thread: StoryThread; issue: string; severity: 'critical' | 'high' | 'medium' }> {
  const plotHoles: Array<{ thread: StoryThread; issue: string; severity: 'critical' | 'high' | 'medium' }> = [];

  for (const thread of threads) {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      continue;
    }

    const threadAge = currentChapter - thread.introducedChapter;
    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;

    // Use standards-based thresholds
    const thresholds = THREAD_TYPE_THRESHOLDS[thread.type];
    if (!thresholds) continue;

    const staleThreshold = getStaleThreshold(thread.type, thread.priority, thread.threadScope);
    const maxAge = getMaxThreadAge(thread.type, thread.priority, thread.threadScope);
    const warningAge = getWarningAge(thread.type, thread.priority, thread.threadScope);

    // Critical severity: exceeded max age or stale threshold for critical/high priority
    if (thread.priority === 'critical') {
      if (threadAge > maxAge || chaptersSinceUpdate > staleThreshold) {
        plotHoles.push({
          thread,
          issue: `CRITICAL: ${thread.type} thread "${thread.title}" is ${threadAge} chapters old (max: ${maxAge}) and hasn't progressed in ${chaptersSinceUpdate} chapters (threshold: ${staleThreshold}). Immediate attention required.`,
          severity: 'critical',
        });
      }
    }
    // High severity: high priority threads exceeding thresholds
    else if (thread.priority === 'high') {
      if (threadAge > maxAge || chaptersSinceUpdate > staleThreshold) {
        plotHoles.push({
          thread,
          issue: `High priority ${thread.type} thread "${thread.title}" is ${threadAge} chapters old (max: ${maxAge}) and hasn't progressed in ${chaptersSinceUpdate} chapters. Risk of becoming a plot hole.`,
          severity: 'high',
        });
      } else if (threadAge > warningAge || chaptersSinceUpdate > staleThreshold * 0.8) {
        plotHoles.push({
          thread,
          issue: `High priority ${thread.type} thread "${thread.title}" approaching critical thresholds (age: ${threadAge}/${maxAge}, stale: ${chaptersSinceUpdate}/${staleThreshold}).`,
          severity: 'medium',
        });
      }
    }
    // Medium severity: any thread significantly exceeding thresholds
    else {
      if (threadAge > maxAge * 1.2 || chaptersSinceUpdate > staleThreshold * 1.5) {
        plotHoles.push({
          thread,
          issue: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" hasn't progressed in ${chaptersSinceUpdate} chapters and may be a forgotten plot thread.`,
          severity: 'medium',
        });
      }
    }
  }

  return plotHoles;
}

/**
 * Suggest thread pacing improvements with standards-based type-aware logic
 */
export function suggestThreadPacing(
  threads: StoryThread[],
  currentChapter: number
): Array<{ thread: StoryThread; suggestion: string; urgency: 'high' | 'medium' | 'low' }> {
  const suggestions: Array<{ thread: StoryThread; suggestion: string; urgency: 'high' | 'medium' | 'low' }> = [];

  for (const thread of threads) {
    if (thread.status === 'resolved' || thread.status === 'abandoned') {
      continue;
    }

    const threadAge = currentChapter - thread.introducedChapter;
    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
    const health = calculateThreadHealth(thread, currentChapter);

    // Use standards-based thresholds
    const thresholds = THREAD_TYPE_THRESHOLDS[thread.type];
    if (!thresholds) continue;

    const staleThreshold = getStaleThreshold(thread.type, thread.priority, thread.threadScope);
    const idealResolution = thresholds.idealResolutionWindow;
    const progressionSuggestion = getProgressionSuggestion(thread);

    // Threads that are progressing too slowly
    if (chaptersSinceUpdate > staleThreshold) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" should progress more frequently. Last updated ${chaptersSinceUpdate} chapters ago (max: ${staleThreshold}). ${progressionSuggestion}`,
        urgency: thread.priority === 'critical' ? 'high' : 'medium',
      });
    }
    // Threads approaching stale threshold
    else if (chaptersSinceUpdate > staleThreshold * 0.7) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" approaching stale threshold (${chaptersSinceUpdate}/${staleThreshold} chapters). ${progressionSuggestion}`,
        urgency: thread.priority === 'critical' ? 'high' : 'low',
      });
    }
    // Threads that might be progressing too fast
    else if (threadAge < idealResolution.min && thread.progressionNotes && thread.progressionNotes.length > 3) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" is progressing very quickly (${threadAge} chapters old with ${thread.progressionNotes.length} progression events). Consider slowing down to build more tension. Ideal resolution window: ${idealResolution.min}-${idealResolution.max} chapters.`,
        urgency: 'low',
      });
    }
    // Threads with low health
    else if (health < 40) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" health is low (${health}/100). ${progressionSuggestion}`,
        urgency: thread.priority === 'critical' ? 'high' : 'medium',
      });
    }
    // Threads that are ready for resolution (in ideal window)
    else if (threadAge >= idealResolution.min && threadAge <= idealResolution.max && chaptersSinceUpdate <= staleThreshold * 0.5) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" is in the ideal resolution window (${threadAge} chapters, ideal: ${idealResolution.min}-${idealResolution.max}) and progressing well. Consider resolving soon for maximum narrative impact.`,
        urgency: 'low',
      });
    }
    // Threads past ideal resolution window
    else if (threadAge > idealResolution.max) {
      suggestions.push({
        thread,
        suggestion: `${thread.type.charAt(0).toUpperCase() + thread.type.slice(1)} thread "${thread.title}" is past the ideal resolution window (${threadAge} chapters, ideal max: ${idealResolution.max}). Resolve soon to prevent it becoming a plot hole.`,
        urgency: thread.priority === 'critical' || thread.priority === 'high' ? 'high' : 'medium',
      });
    }
  }

  return suggestions;
}

/**
 * Calculate thread satisfaction score for resolved threads
 * This can be used to assess resolution quality
 */
export function calculateThreadSatisfaction(thread: StoryThread): number {
  if (thread.status !== 'resolved') {
    return 0; // Not applicable for unresolved threads
  }

  // If satisfaction score is already set, use it
  if (thread.satisfactionScore !== undefined) {
    return thread.satisfactionScore;
  }

  // Use standards-based ideal resolution window
  const thresholds = THREAD_TYPE_THRESHOLDS[thread.type];
  const idealWindow = thresholds?.idealResolutionWindow || { min: 5, max: 30 };

  // Otherwise, calculate based on thread characteristics
  let score = 50; // Base score

  // Thread age at resolution (check against ideal window)
  if (thread.resolvedChapter && thread.introducedChapter) {
    const resolutionTime = thread.resolvedChapter - thread.introducedChapter;
    if (resolutionTime >= idealWindow.min && resolutionTime <= idealWindow.max) {
      score += 25; // Perfect pacing within ideal window
    } else if (resolutionTime >= idealWindow.min * 0.5 && resolutionTime <= idealWindow.max * 1.5) {
      score += 10; // Acceptable pacing
    } else {
      score -= 10; // Poor pacing
    }
  }

  // Has resolution notes
  if (thread.resolutionNotes && thread.resolutionNotes.length > 20) {
    score += 15;
  }

  // Has progression notes (shows development)
  if (thread.progressionNotes && thread.progressionNotes.length > 0) {
    score += Math.min(thread.progressionNotes.length * 2, 10);
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate a comprehensive thread health report suitable for logging
 */
export function generateThreadHealthReport(
  threads: StoryThread[],
  currentChapter: number,
  totalPlannedChapters?: number
): string {
  const analysis = analyzeThreadHealth(threads, currentChapter, totalPlannedChapters);
  const lines: string[] = [];

  // Header
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`📊 THREAD HEALTH REPORT - Chapter ${currentChapter}`);
  lines.push('═══════════════════════════════════════════════════════════════');

  // Overall health with visual indicator
  const healthEmoji = analysis.overallHealth >= 80 ? '✅' :
    analysis.overallHealth >= 60 ? '⚠️' : '❌';
  lines.push(`${healthEmoji} Overall Health: ${analysis.overallHealth}/100`);
  lines.push('');

  // Thread counts
  lines.push('📚 THREAD COUNTS');
  lines.push(`   Active: ${analysis.threadsByStatus['active'] || 0}`);
  lines.push(`   Healthy: ${analysis.healthyThreads}`);
  lines.push(`   At Risk: ${analysis.atRiskThreads}`);
  lines.push(`   Stalled: ${analysis.staleThreads}`);
  lines.push(`   Resolved: ${analysis.resolvedThreads}`);
  lines.push('');

  // Standards compliance
  lines.push('📏 STANDARDS COMPLIANCE');
  const densityEmoji = analysis.standardsCompliance.densityStatus === 'optimal' ? '✅' :
    analysis.standardsCompliance.densityStatus === 'warning' ? '⚠️' : '❌';
  lines.push(`   ${densityEmoji} Density: ${analysis.threadDensity}/chapter (${analysis.standardsCompliance.densityStatus})`);
  lines.push(`   📈 Progression Rate: ${analysis.standardsCompliance.progressionRate}%`);
  lines.push(`   🎯 Recent Resolutions: ${analysis.standardsCompliance.recentResolutions}`);
  lines.push(`   ⚠️ Plot Hole Risks: ${analysis.standardsCompliance.threadsAtPlotHoleRisk}`);
  lines.push('');

  // Arc position if available
  if (analysis.arcPositionAnalysis) {
    const arcEmoji = analysis.arcPositionAnalysis.isOnTrack ? '✅' : '⚠️';
    lines.push('📍 ARC POSITION');
    lines.push(`   Stage: ${analysis.arcPositionAnalysis.positionName}`);
    lines.push(`   ${arcEmoji} Pacing: ${analysis.arcPositionAnalysis.actualProgressionRate}% (expected: ${analysis.arcPositionAnalysis.expectedProgressionRate}%)`);
    lines.push('');
  }

  // Critical issues
  if (analysis.plotHoles.filter(p => p.severity === 'critical').length > 0) {
    lines.push('🚨 CRITICAL ISSUES');
    analysis.plotHoles
      .filter(p => p.severity === 'critical')
      .forEach(p => lines.push(`   ❌ ${p.issue}`));
    lines.push('');
  }

  // High priority suggestions
  const highUrgency = analysis.pacingSuggestions.filter(s => s.urgency === 'high');
  if (highUrgency.length > 0) {
    lines.push('⚠️ HIGH PRIORITY ACTIONS');
    highUrgency.slice(0, 5).forEach(s => lines.push(`   → ${s.suggestion}`));
    lines.push('');
  }

  // Completion forecast
  if (analysis.completionForecast.threadsNeedingResolution > 0) {
    lines.push('🔮 COMPLETION FORECAST');
    lines.push(`   Threads to resolve: ${analysis.completionForecast.threadsNeedingResolution}`);
    lines.push(`   Est. chapters needed: ${analysis.completionForecast.estimatedChaptersToComplete}`);
    lines.push(`   Avg resolution time: ${analysis.completionForecast.averageChaptersPerResolution} chapters`);
  }

  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}

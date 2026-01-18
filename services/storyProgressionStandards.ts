/**
 * Story Progression Standards
 * 
 * Defines all quality standards, thresholds, and calculations for story progression.
 * Used by the warning system to determine when threads, arcs, and story elements
 * need attention.
 */

import { StoryThreadType, ThreadPriority, NovelState, StoryThread, Arc } from '../types';

// ============================================================================
// Thread Density Standards
// ============================================================================

export const THREAD_DENSITY_STANDARDS = {
  minimum: 0.5,      // Minimum active threads per chapter
  optimal: {
    min: 2,
    max: 4,
  },
  maximum: 8,        // Beyond this is overwhelming
  warning: {
    low: 1.0,        // Warning if below this
    high: 6.0,       // Warning if above this
  },
  critical: {
    low: 0.5,        // Critical if below this
    high: 8.0,       // Critical if above this
  },
} as const;

// ============================================================================
// Thread Progression Standards
// ============================================================================

export const THREAD_PROGRESSION_STANDARDS = {
  // Per chapter requirements
  perChapter: {
    minProgressions: 1,        // At least 1 thread must progress
    minSignificance: 'minor' as const,
  },
  // Per 3 chapters
  perThreeChapters: {
    minMajorProgressions: 1,   // At least 1 major progression
  },
  // Per 5 chapters
  perFiveChapters: {
    minResolutions: 1,         // At least 1 thread resolution
  },
  // Maximum stalled chapters
  maxStalledChapters: 5,       // Critical warning if no progression in 5 chapters
} as const;

// ============================================================================
// Thread Health Thresholds by Type
// ============================================================================

export interface ThreadTypeThresholds {
  maxStaleChapters: number;
  idealResolutionWindow: { min: number; max: number };
  criticalAge: number;
  warningAge: number;
}

export const THREAD_TYPE_THRESHOLDS: Record<StoryThreadType, ThreadTypeThresholds> = {
  promise: {
    maxStaleChapters: 5,
    idealResolutionWindow: { min: 3, max: 10 },
    criticalAge: 15,
    warningAge: 10,
  },
  quest: {
    maxStaleChapters: 8,
    idealResolutionWindow: { min: 5, max: 20 },
    criticalAge: 30,
    warningAge: 20,
  },
  conflict: {
    maxStaleChapters: 10,
    idealResolutionWindow: { min: 8, max: 25 },
    criticalAge: 40,
    warningAge: 25,
  },
  mystery: {
    maxStaleChapters: 15,
    idealResolutionWindow: { min: 10, max: 40 },
    criticalAge: 60,
    warningAge: 40,
  },
  relationship: {
    maxStaleChapters: 12,
    idealResolutionWindow: { min: 10, max: 30 },
    criticalAge: 50,
    warningAge: 30,
  },
  power: {
    maxStaleChapters: 15,
    idealResolutionWindow: { min: 12, max: 40 },
    criticalAge: 60,
    warningAge: 40,
  },
  revelation: {
    maxStaleChapters: 15,
    idealResolutionWindow: { min: 10, max: 35 },
    criticalAge: 50,
    warningAge: 35,
  },
  alliance: {
    maxStaleChapters: 12,
    idealResolutionWindow: { min: 8, max: 30 },
    criticalAge: 45,
    warningAge: 30,
  },
  enemy: {
    maxStaleChapters: 15,
    idealResolutionWindow: { min: 12, max: 40 },
    criticalAge: 60,
    warningAge: 40,
  },
  technique: {
    maxStaleChapters: 12,
    idealResolutionWindow: { min: 10, max: 35 },
    criticalAge: 50,
    warningAge: 35,
  },
  item: {
    maxStaleChapters: 15,
    idealResolutionWindow: { min: 12, max: 40 },
    criticalAge: 60,
    warningAge: 40,
  },
  location: {
    maxStaleChapters: 20,
    idealResolutionWindow: { min: 15, max: 50 },
    criticalAge: 80,
    warningAge: 50,
  },
  sect: {
    maxStaleChapters: 18,
    idealResolutionWindow: { min: 12, max: 45 },
    criticalAge: 70,
    warningAge: 45,
  },
};

// Priority multipliers for stale thresholds
export const PRIORITY_MULTIPLIERS: Record<ThreadPriority, number> = {
  critical: 0.5,   // Critical threads should update twice as fast
  high: 0.75,      // High priority threads should update 25% faster
  medium: 1.0,     // Medium is baseline
  low: 1.5,        // Low priority can be slower
};

// ============================================================================
// Arc Position Standards
// ============================================================================

export type ArcPosition = 'beginning' | 'rising_action' | 'midpoint' | 'climax_build' | 'climax' | 'resolution';

export interface ArcPositionRequirements {
  name: string;
  chapterRange: { min: number; max: number }; // Percentage of total chapters
  requiredNewThreads: number;
  requiredResolutions: number;
  threadProgressionRate: number; // Percentage of active threads that should progress
  allowNewThreads: boolean;
  priorityFocus: ThreadPriority[];
}

export const ARC_POSITION_STANDARDS: Record<ArcPosition, ArcPositionRequirements> = {
  beginning: {
    name: 'Beginning',
    chapterRange: { min: 0, max: 15 },
    requiredNewThreads: 2,
    requiredResolutions: 0,
    threadProgressionRate: 30,
    allowNewThreads: true,
    priorityFocus: ['medium', 'low'],
  },
  rising_action: {
    name: 'Rising Action',
    chapterRange: { min: 15, max: 40 },
    requiredNewThreads: 1, // per 2 chapters
    requiredResolutions: 0,
    threadProgressionRate: 50,
    allowNewThreads: true,
    priorityFocus: ['medium', 'high'],
  },
  midpoint: {
    name: 'Midpoint',
    chapterRange: { min: 40, max: 55 },
    requiredNewThreads: 0,
    requiredResolutions: 1, // At least 1 minor resolution or revelation
    threadProgressionRate: 60,
    allowNewThreads: true,
    priorityFocus: ['high', 'critical'],
  },
  climax_build: {
    name: 'Climax Build',
    chapterRange: { min: 55, max: 75 },
    requiredNewThreads: 0,
    requiredResolutions: 2,
    threadProgressionRate: 75,
    allowNewThreads: false, // Only complications allowed
    priorityFocus: ['critical', 'high'],
  },
  climax: {
    name: 'Climax',
    chapterRange: { min: 75, max: 90 },
    requiredNewThreads: 0,
    requiredResolutions: 50, // 50% of critical threads
    threadProgressionRate: 90,
    allowNewThreads: false,
    priorityFocus: ['critical'],
  },
  resolution: {
    name: 'Resolution',
    chapterRange: { min: 90, max: 100 },
    requiredNewThreads: 0,
    requiredResolutions: 100, // All critical, 80% high
    threadProgressionRate: 80,
    allowNewThreads: false,
    priorityFocus: ['critical', 'high'],
  },
};

// ============================================================================
// Quality Standards
// ============================================================================

export const QUALITY_STANDARDS = {
  originality: {
    standard: 70,
    warning: 55,
    critical: 40,
  },
  narrativeCraft: {
    standard: 70,
    warning: 55,
    critical: 40,
  },
  voiceConsistency: {
    standard: 75,
    warning: 60,
    critical: 45,
  },
  wordCount: {
    standard: { min: 2000, max: 3000 },
    warning: { min: 1500, max: 3500 },
    critical: { min: 1200, max: 4000 },
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the stale threshold for a thread based on type and priority
 */
export function getStaleThreshold(type: StoryThreadType, priority: ThreadPriority = 'medium'): number {
  const baseThreshold = THREAD_TYPE_THRESHOLDS[type]?.maxStaleChapters ?? 10;
  const multiplier = PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  return Math.round(baseThreshold * multiplier);
}

/**
 * Get the maximum recommended age for a thread before it should be resolved
 */
export function getMaxThreadAge(type: StoryThreadType, priority: ThreadPriority = 'medium'): number {
  const thresholds = THREAD_TYPE_THRESHOLDS[type];
  if (!thresholds) return 40; // Default
  
  const multiplier = PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  return Math.round(thresholds.criticalAge * multiplier);
}

/**
 * Get the warning age for a thread
 */
export function getWarningAge(type: StoryThreadType, priority: ThreadPriority = 'medium'): number {
  const thresholds = THREAD_TYPE_THRESHOLDS[type];
  if (!thresholds) return 25; // Default
  
  const multiplier = PRIORITY_MULTIPLIERS[priority] ?? 1.0;
  return Math.round(thresholds.warningAge * multiplier);
}

/**
 * Determine the current arc position based on chapter number and total planned chapters
 */
export function determineArcPosition(
  currentChapter: number,
  totalPlannedChapters: number
): ArcPosition {
  const progress = (currentChapter / totalPlannedChapters) * 100;
  
  for (const [position, requirements] of Object.entries(ARC_POSITION_STANDARDS)) {
    if (progress >= requirements.chapterRange.min && progress < requirements.chapterRange.max) {
      return position as ArcPosition;
    }
  }
  
  return 'resolution'; // Default to resolution if past 100%
}

/**
 * Calculate thread density for a novel
 */
export function calculateThreadDensity(threads: StoryThread[], currentChapter: number): number {
  if (currentChapter === 0) return 0;
  const activeThreads = threads.filter(t => t.status === 'active').length;
  return Math.round((activeThreads / currentChapter) * 10) / 10;
}

/**
 * Calculate the average resolution time for resolved threads
 */
export function calculateAverageResolutionTime(threads: StoryThread[]): number {
  const resolvedThreads = threads.filter(t => 
    t.status === 'resolved' && 
    t.resolvedChapter !== undefined && 
    t.introducedChapter !== undefined
  );
  
  if (resolvedThreads.length === 0) return 10; // Default estimate
  
  const totalTime = resolvedThreads.reduce((sum, t) => {
    return sum + ((t.resolvedChapter || 0) - t.introducedChapter);
  }, 0);
  
  return Math.round(totalTime / resolvedThreads.length);
}

/**
 * Get progression suggestion based on thread type
 */
export function getProgressionSuggestion(thread: StoryThread): string {
  const suggestions: Record<StoryThreadType, string> = {
    promise: 'Show progress toward fulfilling this promise or have characters acknowledge it.',
    quest: 'Advance the quest objective or introduce a new obstacle.',
    conflict: 'Escalate the conflict or show consequences of it.',
    mystery: 'Reveal a clue or have characters investigate.',
    relationship: 'Develop the relationship through interaction or internal reflection.',
    power: 'Show power growth, training, or the need for more power.',
    revelation: 'Drop hints or partially reveal information.',
    alliance: 'Strengthen or test the alliance through shared challenge.',
    enemy: 'Show enemy activity, threat, or protagonist awareness.',
    technique: 'Practice, improve, or face limitations of the technique.',
    item: 'Use the item, discover new properties, or face consequences.',
    location: 'Explore further or reveal location significance.',
    sect: 'Advance sect politics, responsibilities, or relationships.',
  };
  
  return suggestions[thread.type] || 'Progress this thread in a meaningful way.';
}

/**
 * Calculate overall story health score
 */
export function calculateStoryHealthScore(
  threads: StoryThread[],
  currentChapter: number,
  totalPlannedChapters: number
): number {
  let score = 100;
  
  const activeThreads = threads.filter(t => t.status === 'active');
  
  // Thread density scoring
  const density = calculateThreadDensity(threads, currentChapter);
  if (density < THREAD_DENSITY_STANDARDS.critical.low) {
    score -= 30;
  } else if (density < THREAD_DENSITY_STANDARDS.warning.low) {
    score -= 15;
  } else if (density > THREAD_DENSITY_STANDARDS.critical.high) {
    score -= 20;
  } else if (density > THREAD_DENSITY_STANDARDS.warning.high) {
    score -= 10;
  }
  
  // Stalled threads scoring
  const stalledCount = activeThreads.filter(t => {
    const threshold = getStaleThreshold(t.type, t.priority);
    return (currentChapter - t.lastUpdatedChapter) >= threshold;
  }).length;
  
  score -= stalledCount * 5; // -5 per stalled thread
  
  // Critical threads health
  const criticalThreads = activeThreads.filter(t => t.priority === 'critical');
  const stalledCritical = criticalThreads.filter(t => {
    const threshold = getStaleThreshold(t.type, t.priority);
    return (currentChapter - t.lastUpdatedChapter) >= threshold;
  }).length;
  
  score -= stalledCritical * 15; // -15 per stalled critical thread
  
  // Resolution progress for late story
  const progress = (currentChapter / totalPlannedChapters) * 100;
  if (progress > 75) {
    const unresolvedCritical = criticalThreads.length;
    if (unresolvedCritical > 3) {
      score -= (unresolvedCritical - 3) * 10; // Penalty for too many unresolved critical threads late in story
    }
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get threads that are at risk of becoming plot holes
 */
export function getAtRiskThreads(threads: StoryThread[], currentChapter: number): StoryThread[] {
  return threads.filter(thread => {
    if (thread.status !== 'active') return false;
    
    const threshold = getStaleThreshold(thread.type, thread.priority);
    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
    const warningAge = getWarningAge(thread.type, thread.priority);
    const threadAge = currentChapter - thread.introducedChapter;
    
    // At risk if stale or approaching max age
    return chaptersSinceUpdate >= threshold * 0.8 || threadAge >= warningAge;
  });
}

/**
 * Count recent thread progressions
 */
export function countRecentProgressions(
  threads: StoryThread[],
  currentChapter: number,
  lookbackChapters: number = 3
): number {
  return threads.filter(thread => {
    const lastUpdate = thread.lastUpdatedChapter;
    return lastUpdate >= currentChapter - lookbackChapters;
  }).length;
}

/**
 * Count recent thread resolutions
 */
export function countRecentResolutions(
  threads: StoryThread[],
  currentChapter: number,
  lookbackChapters: number = 5
): number {
  return threads.filter(thread => {
    if (thread.status !== 'resolved' || !thread.resolvedChapter) return false;
    return thread.resolvedChapter >= currentChapter - lookbackChapters;
  }).length;
}

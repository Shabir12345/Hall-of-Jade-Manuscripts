/**
 * Helper utilities for querying and managing antagonists
 * Provides convenient functions for common operations
 */

import { Antagonist, AntagonistStatus, AntagonistType, ThreatLevel, AntagonistDuration } from '../types';

/**
 * Get antagonists by status
 */
export function getAntagonistsByStatus(
  antagonists: Antagonist[],
  status: AntagonistStatus
): Antagonist[] {
  return antagonists.filter(a => a.status === status);
}

/**
 * Get antagonists by type
 */
export function getAntagonistsByType(
  antagonists: Antagonist[],
  type: AntagonistType
): Antagonist[] {
  return antagonists.filter(a => a.type === type);
}

/**
 * Get antagonists by threat level
 */
export function getAntagonistsByThreatLevel(
  antagonists: Antagonist[],
  threatLevel: ThreatLevel
): Antagonist[] {
  return antagonists.filter(a => a.threatLevel === threatLevel);
}

/**
 * Get active antagonists (active or hinted)
 */
export function getActiveAntagonists(
  antagonists: Antagonist[]
): Antagonist[] {
  return antagonists.filter(a => a.status === 'active' || a.status === 'hinted');
}

/**
 * Get antagonists that appeared in a specific chapter range
 */
export function getAntagonistsInChapterRange(
  antagonists: Antagonist[],
  startChapter: number,
  endChapter: number
): Antagonist[] {
  return antagonists.filter(ant => {
    const firstAppeared = ant.firstAppearedChapter || 0;
    const lastAppeared = ant.lastAppearedChapter || 0;
    return (firstAppeared >= startChapter && firstAppeared <= endChapter) ||
           (lastAppeared >= startChapter && lastAppeared <= endChapter) ||
           (firstAppeared <= startChapter && lastAppeared >= endChapter);
  });
}

/**
 * Get antagonists by duration scope
 */
export function getAntagonistsByDurationScope(
  antagonists: Antagonist[],
  durationScope: AntagonistDuration
): Antagonist[] {
  return antagonists.filter(a => a.durationScope === durationScope);
}

/**
 * Search antagonists by name (fuzzy search)
 */
export function searchAntagonistsByName(
  antagonists: Antagonist[],
  searchTerm: string
): Antagonist[] {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  const normalizedSearch = searchTerm.toLowerCase().trim();
  
  return antagonists.filter(ant => {
    return ant.name.toLowerCase().includes(normalizedSearch) ||
           ant.description.toLowerCase().includes(normalizedSearch) ||
           ant.motivation.toLowerCase().includes(normalizedSearch) ||
           ant.notes.toLowerCase().includes(normalizedSearch);
  });
}

/**
 * Get antagonists sorted by threat level (extreme first)
 */
export function getAntagonistsSortedByThreatLevel(
  antagonists: Antagonist[]
): Antagonist[] {
  const threatOrder: Record<ThreatLevel, number> = {
    'extreme': 4,
    'high': 3,
    'medium': 2,
    'low': 1
  };

  return [...antagonists].sort((a, b) => {
    return threatOrder[b.threatLevel] - threatOrder[a.threatLevel];
  });
}

/**
 * Get antagonists sorted by last appearance (most recent first)
 */
export function getAntagonistsSortedByLastAppearance(
  antagonists: Antagonist[]
): Antagonist[] {
  return [...antagonists].sort((a, b) => {
    const aLast = a.lastAppearedChapter || a.firstAppearedChapter || 0;
    const bLast = b.lastAppearedChapter || b.firstAppearedChapter || 0;
    return bLast - aLast;
  });
}

/**
 * Get primary antagonist (highest threat level active antagonist)
 */
export function getPrimaryAntagonist(
  antagonists: Antagonist[]
): Antagonist | null {
  const active = getActiveAntagonists(antagonists);
  if (active.length === 0) return null;

  const sortedByThreat = getAntagonistsSortedByThreatLevel(active);
  return sortedByThreat[0] || null;
}

/**
 * Get antagonists that need resolution (active for too long)
 */
export function getAntagonistsNeedingResolution(
  antagonists: Antagonist[],
  currentChapter: number,
  threshold: number = 20
): Antagonist[] {
  return antagonists.filter(ant => {
    if (ant.status !== 'active') return false;
    const firstAppeared = ant.firstAppearedChapter || 0;
    const lastAppeared = ant.lastAppearedChapter || ant.firstAppearedChapter || 0;
    const chaptersActive = currentChapter - firstAppeared;
    return firstAppeared > 0 && chaptersActive >= threshold && ant.durationScope !== 'novel';
  });
}

/**
 * Get antagonists that appeared recently (within last N chapters)
 */
export function getRecentAntagonists(
  antagonists: Antagonist[],
  currentChapter: number,
  recentThreshold: number = 5
): Antagonist[] {
  return antagonists.filter(ant => {
    const lastAppeared = ant.lastAppearedChapter || ant.firstAppearedChapter || 0;
    return lastAppeared > 0 && (currentChapter - lastAppeared) <= recentThreshold;
  });
}

/**
 * Get antagonist statistics
 */
export interface AntagonistStats {
  total: number;
  byStatus: Record<AntagonistStatus, number>;
  byType: Record<AntagonistType, number>;
  byThreatLevel: Record<ThreatLevel, number>;
  byDurationScope: Record<AntagonistDuration, number>;
  activeCount: number;
  averageThreatLevel: number;
  primaryThreat: Antagonist | null;
}

export function getAntagonistStats(antagonists: Antagonist[]): AntagonistStats {
  const byStatus: Partial<Record<AntagonistStatus, number>> = {};
  const byType: Partial<Record<AntagonistType, number>> = {};
  const byThreatLevel: Partial<Record<ThreatLevel, number>> = {};
  const byDurationScope: Partial<Record<AntagonistDuration, number>> = {};

  const threatValues: Record<ThreatLevel, number> = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'extreme': 4
  };

  let totalThreat = 0;

  antagonists.forEach(ant => {
    byStatus[ant.status] = (byStatus[ant.status] || 0) + 1;
    byType[ant.type] = (byType[ant.type] || 0) + 1;
    byThreatLevel[ant.threatLevel] = (byThreatLevel[ant.threatLevel] || 0) + 1;
    byDurationScope[ant.durationScope] = (byDurationScope[ant.durationScope] || 0) + 1;
    totalThreat += threatValues[ant.threatLevel];
  });

  return {
    total: antagonists.length,
    byStatus: byStatus as Record<AntagonistStatus, number>,
    byType: byType as Record<AntagonistType, number>,
    byThreatLevel: byThreatLevel as Record<ThreatLevel, number>,
    byDurationScope: byDurationScope as Record<AntagonistDuration, number>,
    activeCount: getActiveAntagonists(antagonists).length,
    averageThreatLevel: antagonists.length > 0 ? totalThreat / antagonists.length : 0,
    primaryThreat: getPrimaryAntagonist(antagonists)
  };
}

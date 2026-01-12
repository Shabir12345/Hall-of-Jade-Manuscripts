import { Antagonist, NovelState, Chapter, Arc, AntagonistProgression, AntagonistStatus } from '../types';
import { fetchAntagonists, getAntagonistsForArc, getAntagonistsForChapter } from './antagonistService';

/**
 * Antagonist Analyzer
 * Analyzes antagonist progression, tracks gaps, and generates summaries for prompts
 */

export interface AntagonistGap {
  chapterNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

export interface AntagonistProgressionSummary {
  antagonistId: string;
  antagonistName: string;
  currentStatus: AntagonistStatus;
  threatLevel: string;
  powerLevel: string;
  firstAppeared: number | undefined;
  lastAppeared: number | undefined;
  totalAppearances: number;
  arcCount: number;
  progressionTrend: 'escalating' | 'stable' | 'declining' | 'resolved';
  keyMilestones: string[];
}

export interface AntagonistContextSummary {
  activeAntagonists: Antagonist[];
  hintedAntagonists: Antagonist[];
  backgroundAntagonists: Antagonist[];
  primaryThreat: Antagonist | null;
  threatLevel: 'low' | 'medium' | 'high' | 'extreme';
  summary: string;
}

/**
 * Analyze antagonist gaps - detect when protagonist has no active opposition
 */
export async function analyzeAntagonistGaps(
  novelId: string,
  chapters: Chapter[],
  arcs: Arc[]
): Promise<AntagonistGap[]> {
  const gaps: AntagonistGap[] = [];
  const antagonists = await fetchAntagonists(novelId);
  
  // Get protagonist
  // Note: We'll need to get this from the novel state, but for now we'll check all characters
  // This should be passed in or fetched separately
  
  // Check each chapter for active antagonists
  for (const chapter of chapters) {
    const chapterAntagonists = await getAntagonistsForChapter(chapter.id);
    const activeInChapter = antagonists.filter(a => 
      (a.status === 'active' || a.status === 'hinted') &&
      chapterAntagonists.some(ca => ca.antagonistId === a.id)
    );

    // Check if there's an active arc with antagonists
    const activeArc = arcs.find(a => a.status === 'active');
    let arcAntagonists: Antagonist[] = [];
    if (activeArc) {
      arcAntagonists = await getAntagonistsForArc(activeArc.id);
    }

    // If no active antagonists in chapter and no arc-level antagonists
    if (activeInChapter.length === 0 && arcAntagonists.filter(a => a.status === 'active').length === 0) {
      // Check if there are any novel-level active antagonists
      const novelLevelAntagonists = antagonists.filter(a => 
        a.status === 'active' && 
        (a.durationScope === 'novel' || a.durationScope === 'multi_arc')
      );

      if (novelLevelAntagonists.length === 0) {
        gaps.push({
          chapterNumber: chapter.number,
          severity: 'critical',
          message: `Chapter ${chapter.number} has no active antagonists. The protagonist lacks opposition.`,
          suggestion: 'Consider introducing a new antagonist, activating a dormant one, or hinting at an upcoming threat.',
        });
      } else {
        // Novel-level antagonist exists but not present in chapter
        gaps.push({
          chapterNumber: chapter.number,
          severity: 'warning',
          message: `Chapter ${chapter.number} has no direct antagonist presence, though novel-level antagonists exist.`,
          suggestion: 'Consider referencing or hinting at the ongoing antagonist threat to maintain tension.',
        });
      }
    }
  }

  return gaps;
}

/**
 * Analyze antagonist progression across the story
 */
export async function analyzeAntagonistProgression(
  novelId: string,
  antagonists: Antagonist[],
  chapters: Chapter[]
): Promise<AntagonistProgressionSummary[]> {
  const summaries: AntagonistProgressionSummary[] = [];

  for (const antagonist of antagonists) {
    // Count appearances
    let appearanceCount = 0;
    const appearances: number[] = [];
    
    for (const chapter of chapters) {
      const chapterAntagonists = await getAntagonistsForChapter(chapter.id);
      if (chapterAntagonists.some(ca => ca.antagonistId === antagonist.id)) {
        appearanceCount++;
        appearances.push(chapter.number);
      }
    }

    // Determine progression trend
    let progressionTrend: 'escalating' | 'stable' | 'declining' | 'resolved' = 'stable';
    if (antagonist.status === 'defeated' || antagonist.status === 'transformed') {
      progressionTrend = 'resolved';
    } else if (antagonist.status === 'active') {
      // Check if threat level or power has increased
      // This would ideally use progression records, but for now we'll use status
      if (antagonist.threatLevel === 'extreme' || antagonist.threatLevel === 'high') {
        progressionTrend = 'escalating';
      }
    }

    // Count arcs
    const arcCount = antagonist.arcAssociations?.length || 0;

    // Key milestones (simplified - would be better with progression records)
    const keyMilestones: string[] = [];
    if (antagonist.firstAppearedChapter) {
      keyMilestones.push(`Introduced in Chapter ${antagonist.firstAppearedChapter}`);
    }
    if (antagonist.resolvedChapter) {
      keyMilestones.push(`Resolved in Chapter ${antagonist.resolvedChapter}`);
    }
    if (antagonist.lastAppearedChapter && antagonist.lastAppearedChapter !== antagonist.firstAppearedChapter) {
      keyMilestones.push(`Last appeared in Chapter ${antagonist.lastAppearedChapter}`);
    }

    summaries.push({
      antagonistId: antagonist.id,
      antagonistName: antagonist.name,
      currentStatus: antagonist.status,
      threatLevel: antagonist.threatLevel,
      powerLevel: antagonist.powerLevel,
      firstAppeared: antagonist.firstAppearedChapter,
      lastAppeared: antagonist.lastAppearedChapter,
      totalAppearances: appearanceCount,
      arcCount,
      progressionTrend,
      keyMilestones,
    });
  }

  return summaries;
}

/**
 * Generate antagonist context summary for prompts
 */
export async function generateAntagonistContext(
  novelId: string,
  currentChapterNumber: number,
  activeArc: Arc | null
): Promise<AntagonistContextSummary> {
  const antagonists = await fetchAntagonists(novelId);
  
  // Get active antagonists
  const activeAntagonists = antagonists.filter(a => a.status === 'active');
  
  // Get hinted antagonists (foreshadowing)
  const hintedAntagonists = antagonists.filter(a => a.status === 'hinted');
  
  // Get background antagonists (dormant but relevant)
  const backgroundAntagonists = antagonists.filter(a => 
    a.status === 'dormant' && 
    a.durationScope !== 'chapter' // Chapter-level dormant antagonists are less relevant
  );

  // Get arc-specific antagonists if there's an active arc
  let arcAntagonists: Antagonist[] = [];
  if (activeArc) {
    arcAntagonists = await getAntagonistsForArc(activeArc.id);
  }

  // Determine primary threat (highest threat level active antagonist)
  const primaryThreat = activeAntagonists.length > 0
    ? activeAntagonists.reduce((prev, current) => 
        threatLevelOrder(current.threatLevel) > threatLevelOrder(prev.threatLevel) ? current : prev
      )
    : null;

  // Determine overall threat level
  const maxThreat: 'low' | 'medium' | 'high' | 'extreme' = activeAntagonists.length > 0
    ? activeAntagonists.reduce((max: 'low' | 'medium' | 'high' | 'extreme', a) => {
        const currentThreat = a.threatLevel;
        return threatLevelOrder(currentThreat) > threatLevelOrder(max) ? currentThreat : max;
      }, 'low' as const)
    : 'low';

  // Generate summary text
  let summary = '';
  if (primaryThreat) {
    summary += `PRIMARY THREAT: ${primaryThreat.name} (${primaryThreat.type}, ${primaryThreat.threatLevel} threat). `;
    summary += `${primaryThreat.description.substring(0, 200)}. `;
    if (primaryThreat.motivation) {
      summary += `Motivation: ${primaryThreat.motivation.substring(0, 150)}. `;
    }
  }

  if (activeAntagonists.length > 1) {
    summary += `Additional active antagonists: ${activeAntagonists.filter(a => a.id !== primaryThreat?.id).map(a => a.name).join(', ')}. `;
  }

  if (hintedAntagonists.length > 0) {
    summary += `Foreshadowed threats: ${hintedAntagonists.map(a => a.name).join(', ')}. `;
  }

  if (arcAntagonists.length > 0 && activeArc) {
    const arcSpecific = arcAntagonists.filter(a => 
      !activeAntagonists.some(aa => aa.id === a.id)
    );
    if (arcSpecific.length > 0) {
      summary += `Arc-specific antagonists: ${arcSpecific.map(a => a.name).join(', ')}. `;
    }
  }

  return {
    activeAntagonists,
    hintedAntagonists,
    backgroundAntagonists,
    primaryThreat,
    threatLevel: maxThreat,
    summary: summary.trim() || 'No active antagonists currently.',
  };
}

/**
 * Helper to order threat levels
 */
function threatLevelOrder(level: string): number {
  switch (level) {
    case 'extreme': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
}

/**
 * Detect foreshadowing opportunities
 */
export function detectForeshadowingOpportunities(
  antagonists: Antagonist[],
  currentChapterNumber: number
): Antagonist[] {
  // Find hinted antagonists that haven't been introduced yet
  return antagonists.filter(a => 
    a.status === 'hinted' &&
    (!a.firstAppearedChapter || a.firstAppearedChapter > currentChapterNumber)
  );
}

/**
 * Get antagonist summary for a specific antagonist
 */
export function getAntagonistSummary(antagonist: Antagonist): string {
  let summary = `${antagonist.name} (${antagonist.type}, ${antagonist.status})`;
  
  if (antagonist.threatLevel !== 'low') {
    summary += ` - ${antagonist.threatLevel} threat`;
  }
  
  if (antagonist.powerLevel) {
    summary += ` - Power: ${antagonist.powerLevel}`;
  }
  
  if (antagonist.description) {
    summary += `. ${antagonist.description.substring(0, 200)}`;
  }
  
  if (antagonist.motivation) {
    summary += ` Motivation: ${antagonist.motivation.substring(0, 150)}`;
  }
  
  return summary;
}

/**
 * Format antagonist context for prompt inclusion
 */
export function formatAntagonistContextForPrompt(context: AntagonistContextSummary): string {
  let formatted = '[ACTIVE ANTAGONISTS]\n';
  
  if (context.activeAntagonists.length === 0) {
    formatted += 'WARNING: No active antagonists. The protagonist currently lacks opposition.\n';
  } else {
    context.activeAntagonists.forEach(ant => {
      formatted += `- ${ant.name} (${ant.type}, ${ant.threatLevel} threat): ${ant.description.substring(0, 150)}\n`;
      if (ant.motivation) {
        formatted += `  Motivation: ${ant.motivation.substring(0, 100)}\n`;
      }
    });
  }
  
  if (context.hintedAntagonists.length > 0) {
    formatted += '\n[FORESHADOWED ANTAGONISTS]\n';
    context.hintedAntagonists.forEach(ant => {
      formatted += `- ${ant.name} (${ant.type}): ${ant.description.substring(0, 100)} - Consider subtle hints or references.\n`;
    });
  }
  
  if (context.primaryThreat) {
    formatted += `\n[PRIMARY THREAT]\n${context.primaryThreat.name}: ${context.primaryThreat.description.substring(0, 200)}\n`;
  }
  
  return formatted;
}

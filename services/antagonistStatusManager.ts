/**
 * Antagonist Status Manager
 * Automatically manages antagonist status based on story progression
 */

import { Antagonist, AntagonistStatus } from '../types';
import { updateAntagonist } from './antagonistService';
import { trackStatusChange } from './antagonistProgressionTracker';

export interface StatusUpdateSuggestion {
  antagonistId: string;
  currentStatus: AntagonistStatus;
  suggestedStatus: AntagonistStatus;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Automatically update status from "hinted" to "active" when first direct appearance
 */
export async function updateStatusForFirstDirectAppearance(
  antagonist: Antagonist,
  chapterNumber: number,
  presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence'
): Promise<Antagonist | null> {
  if (antagonist.status === 'hinted' && presenceType === 'direct') {
    const updated: Antagonist = {
      ...antagonist,
      status: 'active',
      updatedAt: Date.now()
    };

    try {
      await trackStatusChange(antagonist, 'hinted', 'active', chapterNumber, 
        'Status automatically updated: first direct appearance');
      await updateAntagonist(updated);
      return updated;
    } catch (error) {
      console.debug('Failed to update status for first direct appearance:', error);
      return null;
    }
  }
  return null;
}

/**
 * Automatically update to "defeated" when resolvedChapter is set
 */
export async function updateStatusForResolution(
  antagonist: Antagonist,
  chapterNumber: number
): Promise<Antagonist | null> {
  if (antagonist.resolvedChapter && antagonist.status !== 'defeated' && antagonist.status !== 'transformed') {
    // Determine appropriate status based on context
    const newStatus: AntagonistStatus = antagonist.status === 'transformed' ? 'transformed' : 'defeated';
    
    if (antagonist.status !== newStatus) {
      const updated: Antagonist = {
        ...antagonist,
        status: newStatus,
        updatedAt: Date.now()
      };

      try {
        await trackStatusChange(antagonist, antagonist.status, newStatus, chapterNumber,
          `Status automatically updated: resolved in chapter ${antagonist.resolvedChapter}`);
        await updateAntagonist(updated);
        return updated;
      } catch (error) {
        console.debug('Failed to update status for resolution:', error);
        return null;
      }
    }
  }
  return null;
}

/**
 * Suggest updating to "dormant" if no appearances for extended period
 */
export function suggestDormantStatus(
  antagonist: Antagonist,
  currentChapterNumber: number,
  appearanceGapThreshold: number = 10
): StatusUpdateSuggestion | null {
  if (antagonist.status !== 'active' && antagonist.status !== 'hinted') {
    return null; // Only suggest for active/hinted antagonists
  }

  if (!antagonist.lastAppearedChapter) {
    return null; // Can't determine gap without last appearance
  }

  const gap = currentChapterNumber - antagonist.lastAppearedChapter;
  if (gap >= appearanceGapThreshold) {
    return {
      antagonistId: antagonist.id,
      currentStatus: antagonist.status,
      suggestedStatus: 'dormant',
      reason: `No appearance for ${gap} chapters (last appeared in chapter ${antagonist.lastAppearedChapter})`,
      confidence: gap >= appearanceGapThreshold * 2 ? 'high' : 'medium'
    };
  }

  return null;
}

/**
 * Automatically update to "dormant" if gap is significant
 */
export async function updateStatusForDormancy(
  antagonist: Antagonist,
  currentChapterNumber: number,
  appearanceGapThreshold: number = 15
): Promise<Antagonist | null> {
  const suggestion = suggestDormantStatus(antagonist, currentChapterNumber, appearanceGapThreshold);
  
  if (suggestion && suggestion.confidence === 'high') {
    const updated: Antagonist = {
      ...antagonist,
      status: 'dormant',
      updatedAt: Date.now()
    };

    try {
      await trackStatusChange(antagonist, antagonist.status, 'dormant', currentChapterNumber,
        suggestion.reason);
      await updateAntagonist(updated);
      return updated;
    } catch (error) {
      console.debug('Failed to update status for dormancy:', error);
      return null;
    }
  }

  return null;
}

/**
 * Suggest status changes based on story context
 */
export function suggestStatusChanges(
  antagonist: Antagonist,
  currentChapterNumber: number,
  hasRecentAppearance: boolean
): StatusUpdateSuggestion[] {
  const suggestions: StatusUpdateSuggestion[] = [];

  // Suggest activating hinted antagonists if they've been hinted for a while
  if (antagonist.status === 'hinted' && antagonist.firstAppearedChapter) {
    const hintDuration = currentChapterNumber - antagonist.firstAppearedChapter;
    if (hintDuration >= 5 && hasRecentAppearance) {
      suggestions.push({
        antagonistId: antagonist.id,
        currentStatus: 'hinted',
        suggestedStatus: 'active',
        reason: `Has been hinted for ${hintDuration} chapters and recently appeared`,
        confidence: 'medium'
      });
    }
  }

  // Suggest dormancy for long gaps
  const dormantSuggestion = suggestDormantStatus(antagonist, currentChapterNumber);
  if (dormantSuggestion) {
    suggestions.push(dormantSuggestion);
  }

  // Suggest resolution if resolvedChapter is set but status isn't updated
  if (antagonist.resolvedChapter && 
      antagonist.status !== 'defeated' && 
      antagonist.status !== 'transformed' &&
      currentChapterNumber >= antagonist.resolvedChapter) {
    suggestions.push({
      antagonistId: antagonist.id,
      currentStatus: antagonist.status,
      suggestedStatus: 'defeated',
      reason: `Resolved in chapter ${antagonist.resolvedChapter} but status not updated`,
      confidence: 'high'
    });
  }

  return suggestions;
}

/**
 * Automatically manage status based on story context
 */
export async function autoManageStatus(
  antagonist: Antagonist,
  chapterNumber: number,
  presenceType?: 'direct' | 'mentioned' | 'hinted' | 'influence',
  hasRecentAppearance: boolean = true
): Promise<Antagonist> {
  let updated = antagonist;

  // Update for first direct appearance
  if (presenceType === 'direct') {
    const firstDirectUpdate = await updateStatusForFirstDirectAppearance(
      updated,
      chapterNumber,
      presenceType
    );
    if (firstDirectUpdate) {
      updated = firstDirectUpdate;
    }
  }

  // Update for resolution
  const resolutionUpdate = await updateStatusForResolution(updated, chapterNumber);
  if (resolutionUpdate) {
    updated = resolutionUpdate;
  }

  // Update for dormancy (only if no recent appearance)
  if (!hasRecentAppearance) {
    const dormancyUpdate = await updateStatusForDormancy(updated, chapterNumber);
    if (dormancyUpdate) {
      updated = dormancyUpdate;
    }
  }

  return updated;
}

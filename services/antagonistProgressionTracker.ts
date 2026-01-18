/**
 * Antagonist Progression Tracker
 * Automatically tracks antagonist evolution throughout the story
 */

import { Antagonist, AntagonistProgression, AntagonistStatus, ThreatLevel } from '../types';
import { recordAntagonistProgression } from './antagonistService';
import { supabase } from './supabaseService';

export interface ProgressionEvent {
  type: 'status_change' | 'threat_change' | 'power_change' | 'appearance' | 'relationship_change' | 'key_event';
  description: string;
  chapterNumber: number;
  oldValue?: string;
  newValue?: string;
}

/**
 * Track antagonist progression when status changes
 */
export async function trackStatusChange(
  antagonist: Antagonist,
  oldStatus: AntagonistStatus,
  newStatus: AntagonistStatus,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  if (oldStatus === newStatus) return;

  const event: ProgressionEvent = {
    type: 'status_change',
    description: `Status changed from ${oldStatus} to ${newStatus}`,
    chapterNumber,
    oldValue: oldStatus,
    newValue: newStatus
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Track antagonist progression when threat level changes
 */
export async function trackThreatLevelChange(
  antagonist: Antagonist,
  oldThreat: ThreatLevel,
  newThreat: ThreatLevel,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  if (oldThreat === newThreat) return;

  const event: ProgressionEvent = {
    type: 'threat_change',
    description: `Threat level changed from ${oldThreat} to ${newThreat}`,
    chapterNumber,
    oldValue: oldThreat,
    newValue: newThreat
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Track antagonist progression when power level changes
 */
export async function trackPowerLevelChange(
  antagonist: Antagonist,
  oldPower: string,
  newPower: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  if (oldPower === newPower) return;

  const event: ProgressionEvent = {
    type: 'power_change',
    description: `Power level changed from "${oldPower}" to "${newPower}"`,
    chapterNumber,
    oldValue: oldPower,
    newValue: newPower
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Track antagonist appearance in a chapter
 */
export async function trackAppearance(
  antagonist: Antagonist,
  chapterNumber: number,
  presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence',
  significance: 'major' | 'minor' | 'foreshadowing',
  notes?: string
): Promise<void> {
  const event: ProgressionEvent = {
    type: 'appearance',
    description: `Appeared in chapter (${presenceType}, ${significance})`,
    chapterNumber
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Track relationship changes
 */
export async function trackRelationshipChange(
  antagonist: Antagonist,
  characterName: string,
  relationshipChange: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  const event: ProgressionEvent = {
    type: 'relationship_change',
    description: `Relationship with ${characterName}: ${relationshipChange}`,
    chapterNumber
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Track key story events involving the antagonist
 */
export async function trackKeyEvent(
  antagonist: Antagonist,
  eventDescription: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  const event: ProgressionEvent = {
    type: 'key_event',
    description: eventDescription,
    chapterNumber
  };

  await recordProgressionEvent(antagonist, event, chapterNumber, notes);
}

/**
 * Record a progression event
 */
async function recordProgressionEvent(
  antagonist: Antagonist,
  event: ProgressionEvent,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    // Check if progression record already exists for this chapter
    const { data: existing } = await supabase
      .from('antagonist_progression')
      .select('*')
      .eq('antagonist_id', antagonist.id)
      .eq('chapter_number', chapterNumber)
      .maybeSingle();

    let keyEvents: string[] = [event.description];
    let relationshipChanges = event.type === 'relationship_change' ? event.description : '';

    // Merge with existing record if it exists
    if (existing) {
      keyEvents = [...(existing.key_events || []), event.description];
      if (event.type === 'relationship_change') {
        relationshipChanges = existing.relationship_changes 
          ? `${existing.relationship_changes}\n${event.description}`
          : event.description;
      } else {
        relationshipChanges = existing.relationship_changes || '';
      }
    }

    const progression: Omit<AntagonistProgression, 'id' | 'createdAt'> = {
      antagonistId: antagonist.id,
      chapterNumber,
      powerLevel: antagonist.powerLevel || '',
      threatAssessment: antagonist.threatLevel,
      keyEvents,
      relationshipChanges,
      notes: notes || (existing?.notes || '')
    };

    // If existing, update it; otherwise create new
    if (existing) {
      const { error: updateError } = await supabase
        .from('antagonist_progression')
        .update({
          power_level: progression.powerLevel,
          threat_assessment: progression.threatAssessment,
          key_events: progression.keyEvents,
          relationship_changes: progression.relationshipChanges,
          notes: progression.notes,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      await recordAntagonistProgression(progression);
    }
  } catch (error) {
    // Log but don't throw - progression tracking is non-critical
    console.debug('Failed to record antagonist progression:', error);
  }
}

/**
 * Analyze antagonist changes and automatically track progression
 */
export async function analyzeAndTrackProgression(
  oldAntagonist: Antagonist | null,
  newAntagonist: Antagonist,
  chapterNumber: number,
  presenceType?: 'direct' | 'mentioned' | 'hinted' | 'influence',
  significance?: 'major' | 'minor' | 'foreshadowing'
): Promise<void> {
  if (!oldAntagonist) {
    // New antagonist - track initial appearance
    if (presenceType && significance) {
      await trackAppearance(newAntagonist, chapterNumber, presenceType, significance, 'Initial appearance');
    }
    return;
  }

  // Track status changes
  if (oldAntagonist.status !== newAntagonist.status) {
    await trackStatusChange(
      newAntagonist,
      oldAntagonist.status,
      newAntagonist.status,
      chapterNumber,
      `Status automatically updated based on story progression`
    );
  }

  // Track threat level changes
  if (oldAntagonist.threatLevel !== newAntagonist.threatLevel) {
    await trackThreatLevelChange(
      newAntagonist,
      oldAntagonist.threatLevel,
      newAntagonist.threatLevel,
      chapterNumber,
      `Threat level updated based on story events`
    );
  }

  // Track power level changes
  if (oldAntagonist.powerLevel !== newAntagonist.powerLevel) {
    await trackPowerLevelChange(
      newAntagonist,
      oldAntagonist.powerLevel || '',
      newAntagonist.powerLevel || '',
      chapterNumber,
      `Power level updated`
    );
  }

  // Track appearance if provided
  if (presenceType && significance) {
    await trackAppearance(newAntagonist, chapterNumber, presenceType, significance);
  }

  // Track if resolved chapter is set
  if (!oldAntagonist.resolvedChapter && newAntagonist.resolvedChapter) {
    await trackKeyEvent(
      newAntagonist,
      `Antagonist resolved in chapter ${newAntagonist.resolvedChapter}`,
      chapterNumber,
      'Resolution milestone reached'
    );
  }
}

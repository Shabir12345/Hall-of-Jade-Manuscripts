/**
 * System Progression Tracker
 * Tracks character system evolution and feature progression over chapters
 */

import { supabase } from './supabaseService';
import { CharacterSystem, SystemProgression, SystemFeature } from '../types';

/**
 * Record a progression event for a system
 */
export async function recordSystemProgression(
  progression: Omit<SystemProgression, 'id' | 'createdAt'>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('system_progression')
      .insert({
        system_id: progression.systemId,
        chapter_number: progression.chapterNumber,
        features_added: progression.featuresAdded,
        features_upgraded: progression.featuresUpgraded,
        level_changes: progression.levelChanges || '',
        key_events: progression.keyEvents,
        notes: progression.notes || '',
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Failed to record system progression:', error);
    throw error;
  }
}

/**
 * Fetch progression records for a system
 */
export async function fetchSystemProgressionRecords(systemId: string): Promise<SystemProgression[]> {
  try {
    const { data, error } = await supabase
      .from('system_progression')
      .select('*')
      .eq('system_id', systemId)
      .order('chapter_number', { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map(row => ({
      id: row.id,
      systemId: row.system_id,
      chapterNumber: row.chapter_number,
      featuresAdded: row.features_added || [],
      featuresUpgraded: row.features_upgraded || [],
      levelChanges: row.level_changes || '',
      keyEvents: row.key_events || [],
      notes: row.notes || '',
      createdAt: new Date(row.created_at).getTime(),
    }));
  } catch (error) {
    console.error('Failed to fetch system progression:', error);
    return [];
  }
}

/**
 * Record feature unlock
 */
export async function trackFeatureUnlock(
  system: CharacterSystem,
  featureName: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    await recordProgressionEvent(
      system,
      {
        type: 'feature_unlock',
        description: `Feature unlocked: ${featureName}`,
      },
      chapterNumber,
      notes
    );
  } catch (error) {
    console.debug('Failed to track feature unlock:', error);
  }
}

/**
 * Record feature upgrade
 */
export async function trackFeatureUpgrade(
  system: CharacterSystem,
  featureName: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    await recordProgressionEvent(
      system,
      {
        type: 'feature_upgrade',
        description: `Feature upgraded: ${featureName}`,
      },
      chapterNumber,
      notes
    );
  } catch (error) {
    console.debug('Failed to track feature upgrade:', error);
  }
}

/**
 * Record level change
 */
export async function trackLevelChange(
  system: CharacterSystem,
  oldLevel: string,
  newLevel: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    await recordProgressionEvent(
      system,
      {
        type: 'level_change',
        description: `Level changed from "${oldLevel}" to "${newLevel}"`,
      },
      chapterNumber,
      notes
    );
  } catch (error) {
    console.debug('Failed to track level change:', error);
  }
}

/**
 * Record key event
 */
export async function trackKeyEvent(
  system: CharacterSystem,
  description: string,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    await recordProgressionEvent(
      system,
      {
        type: 'key_event',
        description,
      },
      chapterNumber,
      notes
    );
  } catch (error) {
    console.debug('Failed to track key event:', error);
  }
}

/**
 * Progression event types
 */
type ProgressionEventType = 'feature_unlock' | 'feature_upgrade' | 'level_change' | 'key_event';

interface ProgressionEvent {
  type: ProgressionEventType;
  description: string;
}

/**
 * Record a progression event
 */
async function recordProgressionEvent(
  system: CharacterSystem,
  event: ProgressionEvent,
  chapterNumber: number,
  notes?: string
): Promise<void> {
  try {
    // Check if progression record already exists for this chapter
    const { data: existing } = await supabase
      .from('system_progression')
      .select('*')
      .eq('system_id', system.id)
      .eq('chapter_number', chapterNumber)
      .maybeSingle();

    let featuresAdded: string[] = [];
    let featuresUpgraded: string[] = [];
    let keyEvents: string[] = [event.description];
    let levelChanges = '';

    // Process event type
    if (event.type === 'feature_unlock') {
      const featureMatch = event.description.match(/Feature unlocked: (.+)/);
      if (featureMatch) {
        featuresAdded = [featureMatch[1]];
      }
    } else if (event.type === 'feature_upgrade') {
      const featureMatch = event.description.match(/Feature upgraded: (.+)/);
      if (featureMatch) {
        featuresUpgraded = [featureMatch[1]];
      }
    } else if (event.type === 'level_change') {
      levelChanges = event.description;
    }

    // Merge with existing record if it exists
    if (existing) {
      featuresAdded = [...new Set([...(existing.features_added || []), ...featuresAdded])];
      featuresUpgraded = [...new Set([...(existing.features_upgraded || []), ...featuresUpgraded])];
      keyEvents = [...new Set([...(existing.key_events || []), event.description])];
      if (levelChanges && existing.level_changes) {
        levelChanges = `${existing.level_changes}\n${levelChanges}`;
      } else if (!levelChanges) {
        levelChanges = existing.level_changes || '';
      }
    }

    const progression: Omit<SystemProgression, 'id' | 'createdAt'> = {
      systemId: system.id,
      chapterNumber,
      featuresAdded,
      featuresUpgraded,
      levelChanges: levelChanges || undefined,
      keyEvents,
      notes: notes || (existing?.notes || '')
    };

    // If existing, update it; otherwise create new
    if (existing) {
      const { error: updateError } = await supabase
        .from('system_progression')
        .update({
          features_added: progression.featuresAdded,
          features_upgraded: progression.featuresUpgraded,
          level_changes: progression.levelChanges || '',
          key_events: progression.keyEvents,
          notes: progression.notes,
        })
        .eq('id', existing.id);

      if (updateError) {
        throw updateError;
      }
    } else {
      await recordSystemProgression(progression);
    }
  } catch (error) {
    // Log but don't throw - progression tracking is non-critical
    console.debug('Failed to record system progression:', error);
  }
}

/**
 * Analyze system changes and automatically track progression
 */
export async function analyzeAndTrackProgression(
  oldSystem: CharacterSystem | null,
  newSystem: CharacterSystem,
  chapterNumber: number,
  presenceType?: 'direct' | 'mentioned' | 'hinted' | 'used',
  significance?: 'major' | 'minor' | 'foreshadowing'
): Promise<void> {
  if (!oldSystem) {
    // New system - track initial appearance
    if (presenceType && significance) {
      await trackKeyEvent(newSystem, `System first appeared in chapter ${chapterNumber}`, chapterNumber, 'Initial system discovery');
    }
    return;
  }

  // Track status changes
  if (oldSystem.status !== newSystem.status) {
    await trackKeyEvent(
      newSystem,
      `Status changed from "${oldSystem.status}" to "${newSystem.status}"`,
      chapterNumber,
      `Status automatically updated based on story progression`
    );
  }

  // Track level/version changes
  if (oldSystem.currentLevel !== newSystem.currentLevel || oldSystem.currentVersion !== newSystem.currentVersion) {
    const oldLevel = oldSystem.currentLevel || oldSystem.currentVersion || 'Unknown';
    const newLevel = newSystem.currentLevel || newSystem.currentVersion || 'Unknown';
    await trackLevelChange(
      newSystem,
      oldLevel,
      newLevel,
      chapterNumber,
      `Level/version updated`
    );
  }

  // Track new features
  const oldFeatureNames = new Set(oldSystem.features.map(f => f.name.toLowerCase()));
  const newFeatures = newSystem.features.filter(f => !oldFeatureNames.has(f.name.toLowerCase()));
  
  for (const feature of newFeatures) {
    await trackFeatureUnlock(
      newSystem,
      feature.name,
      chapterNumber,
      `Feature unlocked in chapter ${chapterNumber}`
    );
  }

  // Track upgraded features (features that existed but may have been upgraded)
  // This is a heuristic - if features exist and system was updated, they might have been upgraded
  if (newSystem.features.length > 0 && newSystem.lastUpdatedChapter === chapterNumber) {
    const existingFeatures = oldSystem.features.filter(f => 
      newSystem.features.some(nf => nf.name.toLowerCase() === f.name.toLowerCase())
    );
    
    // If feature level changed or was updated, consider it upgraded
    for (const oldFeature of existingFeatures) {
      const newFeature = newSystem.features.find(f => f.name.toLowerCase() === oldFeature.name.toLowerCase());
      if (newFeature && (
        newFeature.level !== oldFeature.level ||
        newFeature.strength !== oldFeature.strength ||
        newFeature.updatedAt !== oldFeature.updatedAt
      )) {
        await trackFeatureUpgrade(
          newSystem,
          newFeature.name,
          chapterNumber,
          `Feature upgraded in chapter ${chapterNumber}`
        );
      }
    }
  }

  // Track appearance if provided
  if (presenceType && significance) {
    const eventDesc = `System ${presenceType === 'used' ? 'used' : presenceType === 'direct' ? 'activated' : presenceType} in chapter ${chapterNumber}`;
    await trackKeyEvent(newSystem, eventDesc, chapterNumber);
  }
}

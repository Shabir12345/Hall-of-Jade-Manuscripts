/**
 * Consistency Persistence Service
 * 
 * Handles database persistence for consistency system data.
 * Saves entity state history, power level progressions, and context snapshots.
 */

import { supabase } from './supabaseService';
import { NovelState, Chapter } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getEntityStateTracker } from './entityStateTracker';

/**
 * Save power level progression to database
 */
export async function savePowerLevelProgression(
  novelId: string,
  characterId: string,
  chapterId: string,
  chapterNumber: number,
  powerLevel: string,
  progressionType: 'breakthrough' | 'gradual' | 'regression' | 'stable',
  eventDescription?: string
): Promise<void> {
  try {
    const { error } = await supabase.from('power_level_progression').insert({
      novel_id: novelId,
      character_id: characterId,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      power_level: powerLevel,
      progression_type: progressionType,
      event_description: eventDescription || null,
    });

    if (error) {
      console.error('Failed to save power level progression:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error saving power level progression:', error);
    throw error;
  }
}

/**
 * Save entity state history to database
 */
export async function saveEntityStateHistory(
  novelId: string,
  entityType: 'character' | 'territory' | 'world_entry' | 'item' | 'technique' | 'antagonist',
  entityId: string,
  chapterId: string,
  chapterNumber: number,
  stateSnapshot: Record<string, any>,
  changes: Array<{ field: string; oldValue: any; newValue: any }>
): Promise<void> {
  try {
    const { error } = await supabase.from('entity_state_history').insert({
      novel_id: novelId,
      entity_type: entityType,
      entity_id: entityId,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      state_snapshot: stateSnapshot,
      changes: changes,
    });

    if (error) {
      console.error('Failed to save entity state history:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error saving entity state history:', error);
    throw error;
  }
}

/**
 * Save context snapshot to database
 */
export async function saveContextSnapshot(
  novelId: string,
  chapterId: string,
  chapterNumber: number,
  contextData: Record<string, any>,
  entitiesIncluded: string[],
  tokenCount?: number
): Promise<void> {
  try {
    // First, check if the chapter exists in the database
    // Use maybeSingle() instead of single() to avoid 406 errors when chapter doesn't exist
    const { data: chapterExists, error: checkError } = await supabase
      .from('chapters')
      .select('id')
      .eq('id', chapterId)
      .maybeSingle();

    // If chapter doesn't exist yet, skip saving the snapshot
    // It will be saved later when the chapter is persisted
    // This is expected during chapter generation - use debug level to reduce noise
    if (checkError || !chapterExists) {
      console.debug(`[Context Snapshot] Chapter ${chapterId} not in database yet - snapshot will be saved when chapter is persisted.`);
      return;
    }

    const { error } = await supabase.from('context_snapshots').insert({
      novel_id: novelId,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      context_data: contextData,
      entities_included: entitiesIncluded,
      token_count: tokenCount || null,
    });

    if (error) {
      // If it's a foreign key constraint error, the chapter still doesn't exist
      // This is non-critical, so we'll just log it
      if (error.code === '23503') {
        console.warn(`Chapter ${chapterId} not found in database. Context snapshot will be saved when chapter is persisted.`);
        return;
      }
      console.error('Failed to save context snapshot:', error);
      throw error;
    }
  } catch (error) {
    // Handle foreign key constraint errors gracefully
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      console.warn(`Chapter ${chapterId} not found in database. Context snapshot will be saved when chapter is persisted.`);
      return;
    }
    console.error('Error saving context snapshot:', error);
    throw error;
  }
}

/**
 * Load power level progression from database
 */
export async function loadPowerLevelProgression(
  novelId: string,
  characterId?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('power_level_progression')
      .select('*')
      .eq('novel_id', novelId)
      .order('chapter_number', { ascending: true });

    if (characterId) {
      query = query.eq('character_id', characterId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load power level progression:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error loading power level progression:', error);
    return [];
  }
}

/**
 * Load entity state history from database
 */
export async function loadEntityStateHistory(
  novelId: string,
  entityType?: string,
  entityId?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('entity_state_history')
      .select('*')
      .eq('novel_id', novelId)
      .order('chapter_number', { ascending: true });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (entityId) {
      query = query.eq('entity_id', entityId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to load entity state history:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error loading entity state history:', error);
    return [];
  }
}

/**
 * Sync consistency system data from database to in-memory services
 */
export async function syncConsistencyDataFromDatabase(state: NovelState): Promise<void> {
  const graphService = getKnowledgeGraphService();
  const stateTracker = getEntityStateTracker();

  // Initialize graph
  graphService.initializeGraph(state);

  // Load power level progressions
  const progressions = await loadPowerLevelProgression(state.id);
  
  progressions.forEach(prog => {
    graphService.updatePowerLevel(
      prog.character_id,
      prog.power_level,
      prog.chapter_id,
      prog.chapter_number,
      prog.progression_type,
      prog.event_description || undefined
    );
  });

  // Load entity state history
  const stateHistory = await loadEntityStateHistory(state.id);
  
  stateHistory.forEach(history => {
    stateTracker.trackStateChange(
      history.entity_type,
      history.entity_id,
      history.chapter_id,
      history.chapter_number,
      history.state_snapshot,
      undefined // Previous state not stored in this format
    );
  });
}

/**
 * Batch save all consistency data for a chapter
 */
export async function saveChapterConsistencyData(
  state: NovelState,
  chapter: Chapter
): Promise<void> {
  const graphService = getKnowledgeGraphService();
  const stateTracker = getEntityStateTracker();

  // Save power level progressions
  state.characterCodex.forEach(async char => {
    const progression = graphService.getPowerProgression(char.id);
    if (progression && progression.progression.length > 0) {
      const lastProg = progression.progression[progression.progression.length - 1];
      if (lastProg.chapterNumber === chapter.number) {
        await savePowerLevelProgression(
          state.id,
          char.id,
          chapter.id,
          chapter.number,
          lastProg.powerLevel,
          lastProg.progressionType,
          lastProg.eventDescription
        );
      }
    }
  });

  // Save entity state history
  const chapterChanges = stateTracker.getChapterChanges(chapter.id, chapter.number);
  
  for (const change of chapterChanges) {
    await saveEntityStateHistory(
      state.id,
      change.entityType,
      change.entityId,
      chapter.id,
      chapter.number,
      change.stateSnapshot,
      change.changes
    );
  }
}

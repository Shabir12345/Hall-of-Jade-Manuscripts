import { supabase } from './supabaseService';
import { CharacterSystem, SystemFeature, SystemProgression, SystemChapterAppearance, SystemType, SystemCategory, SystemStatus } from '../types';
import { withRetry } from '../utils/errorHandling';

/**
 * System Service
 * Handles all CRUD operations for character systems and related entities
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all systems for a novel
 */
export async function fetchSystems(novelId: string): Promise<CharacterSystem[]> {
  return withRetry(async () => {
    const { data: systems, error } = await supabase
      .from('character_systems')
      .select('*')
      .eq('novel_id', novelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching systems:', error);
      throw new Error(`Failed to fetch systems: ${error.message}`);
    }

    if (!systems || systems.length === 0) {
      return [];
    }

    // Fetch features for each system
    const systemIds = systems.map(s => s.id);
    const { data: features } = await supabase
      .from('system_features')
      .select('*')
      .in('system_id', systemIds);

    const systemFeatures = features || [];

    return systems.map(sys => ({
      id: sys.id,
      novelId: sys.novel_id,
      characterId: sys.character_id,
      name: sys.name,
      type: sys.type as SystemType,
      category: sys.category as SystemCategory,
      description: sys.description || '',
      currentLevel: sys.current_level || undefined,
      currentVersion: sys.current_version || undefined,
      status: sys.status as SystemStatus,
      features: systemFeatures
        .filter(f => f.system_id === sys.id)
        .map(f => ({
          id: f.id,
          systemId: f.system_id,
          name: f.name,
          description: f.description || '',
          category: f.category || undefined,
          unlockedChapter: f.unlocked_chapter || undefined,
          isActive: f.is_active,
          level: f.level || undefined,
          strength: f.strength || undefined,
          notes: f.notes || '',
          createdAt: timestampToNumber(f.created_at),
          updatedAt: timestampToNumber(f.updated_at),
        })),
      firstAppearedChapter: sys.first_appeared_chapter || undefined,
      lastUpdatedChapter: sys.last_updated_chapter || undefined,
      history: sys.history || '',
      notes: sys.notes || '',
      createdAt: timestampToNumber(sys.created_at),
      updatedAt: timestampToNumber(sys.updated_at),
    }));
  });
}

/**
 * Create a new system
 */
export async function createSystem(system: Omit<CharacterSystem, 'id' | 'createdAt' | 'updatedAt'>): Promise<CharacterSystem> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('character_systems')
      .insert({
        novel_id: system.novelId,
        character_id: system.characterId,
        name: system.name,
        type: system.type,
        category: system.category,
        description: system.description,
        current_level: system.currentLevel || null,
        current_version: system.currentVersion || null,
        status: system.status,
        first_appeared_chapter: system.firstAppearedChapter || null,
        last_updated_chapter: system.lastUpdatedChapter || null,
        history: system.history,
        notes: system.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating system:', error);
      throw new Error(`Failed to create system: ${error.message}`);
    }

    // Create features if any
    if (system.features && system.features.length > 0) {
      const featureInserts = system.features.map(f => ({
        system_id: data.id,
        name: f.name,
        description: f.description || '',
        category: f.category || null,
        unlocked_chapter: f.unlockedChapter || null,
        is_active: f.isActive,
        level: f.level || null,
        strength: f.strength || null,
        notes: f.notes || '',
      }));

      const { error: featuresError } = await supabase
        .from('system_features')
        .insert(featureInserts);

      if (featuresError) {
        console.error('Error creating system features:', featuresError);
        // Don't throw - system was created, features can be added later
      }
    }

    const now = Date.now();
    return {
      id: data.id,
      novelId: data.novel_id,
      characterId: data.character_id,
      name: data.name,
      type: data.type as SystemType,
      category: data.category as SystemCategory,
      description: data.description || '',
      currentLevel: data.current_level || undefined,
      currentVersion: data.current_version || undefined,
      status: data.status as SystemStatus,
      features: system.features || [],
      firstAppearedChapter: data.first_appeared_chapter || undefined,
      lastUpdatedChapter: data.last_updated_chapter || undefined,
      history: data.history || '',
      notes: data.notes || '',
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Update a system
 */
export async function updateSystem(system: CharacterSystem): Promise<CharacterSystem> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('character_systems')
      .update({
        name: system.name,
        type: system.type,
        category: system.category,
        description: system.description,
        current_level: system.currentLevel || null,
        current_version: system.currentVersion || null,
        status: system.status,
        first_appeared_chapter: system.firstAppearedChapter || null,
        last_updated_chapter: system.lastUpdatedChapter || null,
        history: system.history,
        notes: system.notes,
      })
      .eq('id', system.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating system:', error);
      throw new Error(`Failed to update system: ${error.message}`);
    }

    // Reload with features
    const fullSystem = await fetchSystems(system.novelId);
    return fullSystem.find(s => s.id === system.id) || {
      ...system,
      updatedAt: Date.now(),
    };
  });
}

/**
 * Delete a system
 */
export async function deleteSystem(systemId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('character_systems')
      .delete()
      .eq('id', systemId);

    if (error) {
      console.error('Error deleting system:', error);
      throw new Error(`Failed to delete system: ${error.message}`);
    }
  });
}

/**
 * Record system progression (wrapper for progression tracker)
 */
export async function recordSystemProgression(
  progression: Omit<SystemProgression, 'id' | 'createdAt'>
): Promise<void> {
  const { recordSystemProgression: recordProgression } = await import('./systemProgressionTracker');
  return recordProgression(progression);
}

/**
 * Track system chapter appearance
 */
export async function trackSystemAppearance(
  appearance: Omit<SystemChapterAppearance, 'id' | 'createdAt'>
): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('system_chapter_appearances')
      .upsert({
        system_id: appearance.systemId,
        chapter_id: appearance.chapterId,
        presence_type: appearance.presenceType,
        significance: appearance.significance,
        features_used: appearance.featuresUsed || [],
        notes: appearance.notes || '',
      }, {
        onConflict: 'system_id,chapter_id'
      });

    if (error) {
      console.error('Error tracking system appearance:', error);
      throw new Error(`Failed to track system appearance: ${error.message}`);
    }
  });
}

/**
 * Get systems for a specific character
 */
export async function getSystemsForCharacter(characterId: string): Promise<CharacterSystem[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('character_systems')
      .select('novel_id')
      .eq('character_id', characterId)
      .limit(1);

    if (error || !data || data.length === 0) {
      return [];
    }

    const novelId = data[0].novel_id;
    const allSystems = await fetchSystems(novelId);
    return allSystems.filter(s => s.characterId === characterId);
  });
}

/**
 * Get active systems for a novel
 */
export async function getActiveSystems(novelId: string): Promise<CharacterSystem[]> {
  const allSystems = await fetchSystems(novelId);
  return allSystems.filter(s => s.status === 'active' || s.status === 'upgraded');
}

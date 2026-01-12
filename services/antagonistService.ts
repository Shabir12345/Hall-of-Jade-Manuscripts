import { supabase } from './supabaseService';
import { Antagonist, AntagonistRelationship, AntagonistArcAssociation, AntagonistGroupMember, AntagonistProgression, AntagonistChapterAppearance, AntagonistStatus, AntagonistType, ThreatLevel, AntagonistDuration, PresenceType, AntagonistRole } from '../types';
import { withRetry } from '../utils/errorHandling';
import { generateUUID } from '../utils/uuid';

/**
 * Antagonist Service
 * Handles all CRUD operations for antagonists and related entities
 */

// Helper to convert timestamp to number
const timestampToNumber = (ts: string | null): number => {
  return ts ? new Date(ts).getTime() : Date.now();
};

/**
 * Fetch all antagonists for a novel
 */
export async function fetchAntagonists(novelId: string): Promise<Antagonist[]> {
  return withRetry(async () => {
    const { data: antagonists, error } = await supabase
      .from('antagonists')
      .select('*')
      .eq('novel_id', novelId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching antagonists:', error);
      throw new Error(`Failed to fetch antagonists: ${error.message}`);
    }

    if (!antagonists || antagonists.length === 0) {
      return [];
    }

    // Fetch related data for each antagonist
    const antagonistIds = antagonists.map(a => a.id);
    
    const [relationshipsRes, arcAssociationsRes, groupMembersRes] = await Promise.all([
      supabase.from('antagonist_relationships').select('*').in('antagonist_id', antagonistIds),
      supabase.from('antagonist_arcs').select('*').in('antagonist_id', antagonistIds),
      supabase.from('antagonist_groups').select('*').in('antagonist_id', antagonistIds),
    ]);

    const relationships = relationshipsRes.data || [];
    const arcAssociations = arcAssociationsRes.data || [];
    const groupMembers = groupMembersRes.data || [];

    return antagonists.map(ant => ({
      id: ant.id,
      novelId: ant.novel_id,
      name: ant.name,
      type: ant.type as AntagonistType,
      description: ant.description || '',
      motivation: ant.motivation || '',
      powerLevel: ant.power_level || '',
      status: ant.status as AntagonistStatus,
      firstAppearedChapter: ant.first_appeared_chapter || undefined,
      lastAppearedChapter: ant.last_appeared_chapter || undefined,
      resolvedChapter: ant.resolved_chapter || undefined,
      durationScope: ant.duration_scope as AntagonistDuration,
      threatLevel: ant.threat_level as ThreatLevel,
      notes: ant.notes || '',
      relationships: relationships
        .filter(r => r.antagonist_id === ant.id)
        .map(r => ({
          id: r.id,
          antagonistId: r.antagonist_id,
          characterId: r.character_id,
          relationshipType: r.relationship_type as AntagonistRelationship['relationshipType'],
          intensity: r.intensity as AntagonistRelationship['intensity'],
          history: r.history || '',
          currentState: r.current_state || '',
          createdAt: timestampToNumber(r.created_at),
          updatedAt: timestampToNumber(r.updated_at),
        })),
      groupMembers: groupMembers
        .filter(g => g.antagonist_id === ant.id)
        .map(g => ({
          id: g.id,
          antagonistId: g.antagonist_id,
          memberCharacterId: g.member_character_id,
          roleInGroup: g.role_in_group as any,
          joinedChapter: g.joined_chapter || undefined,
          leftChapter: g.left_chapter || undefined,
          notes: g.notes || '',
          createdAt: timestampToNumber(g.created_at),
          updatedAt: timestampToNumber(g.updated_at),
        })),
      arcAssociations: arcAssociations
        .filter(a => a.antagonist_id === ant.id)
        .map(a => ({
          id: a.id,
          antagonistId: a.antagonist_id,
          arcId: a.arc_id,
          role: a.role as AntagonistRole,
          introducedInArc: a.introduced_in_arc || false,
          resolvedInArc: a.resolved_in_arc || false,
          notes: a.notes || '',
          createdAt: timestampToNumber(a.created_at),
          updatedAt: timestampToNumber(a.updated_at),
        })),
      createdAt: timestampToNumber(ant.created_at),
      updatedAt: timestampToNumber(ant.updated_at),
    }));
  });
}

/**
 * Create a new antagonist
 */
export async function createAntagonist(antagonist: Omit<Antagonist, 'id' | 'createdAt' | 'updatedAt'>): Promise<Antagonist> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('antagonists')
      .insert({
        novel_id: antagonist.novelId,
        name: antagonist.name,
        type: antagonist.type,
        description: antagonist.description,
        motivation: antagonist.motivation,
        power_level: antagonist.powerLevel,
        status: antagonist.status,
        first_appeared_chapter: antagonist.firstAppearedChapter || null,
        last_appeared_chapter: antagonist.lastAppearedChapter || null,
        resolved_chapter: antagonist.resolvedChapter || null,
        duration_scope: antagonist.durationScope,
        threat_level: antagonist.threatLevel,
        notes: antagonist.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating antagonist:', error);
      throw new Error(`Failed to create antagonist: ${error.message}`);
    }

    const now = Date.now();
    return {
      id: data.id,
      novelId: data.novel_id,
      name: data.name,
      type: data.type as AntagonistType,
      description: data.description || '',
      motivation: data.motivation || '',
      powerLevel: data.power_level || '',
      status: data.status as AntagonistStatus,
      firstAppearedChapter: data.first_appeared_chapter || undefined,
      lastAppearedChapter: data.last_appeared_chapter || undefined,
      resolvedChapter: data.resolved_chapter || undefined,
      durationScope: data.duration_scope as any,
      threatLevel: data.threat_level as ThreatLevel,
      notes: data.notes || '',
      relationships: [],
      groupMembers: [],
      arcAssociations: [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

/**
 * Update an antagonist
 */
export async function updateAntagonist(antagonist: Antagonist): Promise<Antagonist> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('antagonists')
      .update({
        name: antagonist.name,
        type: antagonist.type,
        description: antagonist.description,
        motivation: antagonist.motivation,
        power_level: antagonist.powerLevel,
        status: antagonist.status,
        first_appeared_chapter: antagonist.firstAppearedChapter || null,
        last_appeared_chapter: antagonist.lastAppearedChapter || null,
        resolved_chapter: antagonist.resolvedChapter || null,
        duration_scope: antagonist.durationScope,
        threat_level: antagonist.threatLevel,
        notes: antagonist.notes,
      })
      .eq('id', antagonist.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating antagonist:', error);
      throw new Error(`Failed to update antagonist: ${error.message}`);
    }

    // Reload with relationships
    const fullAntagonist = await fetchAntagonists(antagonist.novelId);
    return fullAntagonist.find(a => a.id === antagonist.id) || {
      ...antagonist,
      updatedAt: Date.now(),
    };
  });
}

/**
 * Delete an antagonist
 */
export async function deleteAntagonist(antagonistId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('antagonists')
      .delete()
      .eq('id', antagonistId);

    if (error) {
      console.error('Error deleting antagonist:', error);
      throw new Error(`Failed to delete antagonist: ${error.message}`);
    }
  });
}

/**
 * Automatically update lastAppearedChapter when antagonist appears in a chapter
 */
export async function updateAntagonistLastAppeared(
  antagonistId: string,
  chapterNumber: number
): Promise<void> {
  return withRetry(async () => {
    // Get current antagonist
    const { data: current, error: fetchError } = await supabase
      .from('antagonists')
      .select('last_appeared_chapter')
      .eq('id', antagonistId)
      .single();

    if (fetchError) {
      console.error('Error fetching antagonist:', fetchError);
      return; // Don't throw, just log
    }

    // Only update if this chapter is newer
    const currentLast = current?.last_appeared_chapter || 0;
    if (chapterNumber > currentLast) {
      const { error: updateError } = await supabase
        .from('antagonists')
        .update({ last_appeared_chapter: chapterNumber })
        .eq('id', antagonistId);

      if (updateError) {
        console.error('Error updating lastAppearedChapter:', updateError);
      }
    }
  });
}

/**
 * Get active antagonists for a novel
 */
export async function getActiveAntagonists(novelId: string): Promise<Antagonist[]> {
  const allAntagonists = await fetchAntagonists(novelId);
  return allAntagonists.filter(a => a.status === 'active' || a.status === 'hinted');
}

/**
 * Get antagonists for a specific arc
 */
export async function getAntagonistsForArc(arcId: string): Promise<Antagonist[]> {
  return withRetry(async () => {
    const { data: associations, error } = await supabase
      .from('antagonist_arcs')
      .select('antagonist_id')
      .eq('arc_id', arcId);

    if (error) {
      console.error('Error fetching antagonists for arc:', error);
      throw new Error(`Failed to fetch antagonists for arc: ${error.message}`);
    }

    if (!associations || associations.length === 0) {
      return [];
    }

    const antagonistIds = associations.map(a => a.antagonist_id);
    const { data: antagonists, error: antError } = await supabase
      .from('antagonists')
      .select('*')
      .in('id', antagonistIds);

    if (antError) {
      throw new Error(`Failed to fetch antagonists: ${antError.message}`);
    }

    // Fetch full data with relationships
    if (antagonists && antagonists.length > 0) {
      const novelId = antagonists[0].novel_id;
      const allAntagonists = await fetchAntagonists(novelId);
      return allAntagonists.filter(a => antagonistIds.includes(a.id));
    }

    return [];
  });
}

/**
 * Get antagonists for a specific chapter
 */
export async function getAntagonistsForChapter(chapterId: string): Promise<AntagonistChapterAppearance[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('antagonist_chapters')
      .select('*')
      .eq('chapter_id', chapterId);

    if (error) {
      console.error('Error fetching antagonists for chapter:', error);
      throw new Error(`Failed to fetch antagonists for chapter: ${error.message}`);
    }

    if (!data) return [];

    return data.map(a => ({
      id: a.id,
      antagonistId: a.antagonist_id,
      chapterId: a.chapter_id,
      presenceType: a.presence_type as PresenceType,
      significance: a.significance as any,
      notes: a.notes || '',
      createdAt: timestampToNumber(a.created_at),
    }));
  });
}

/**
 * Add antagonist to arc
 */
export async function addAntagonistToArc(
  antagonistId: string,
  arcId: string,
  role: 'primary' | 'secondary' | 'background' | 'hinted',
  introducedInArc: boolean = false,
  resolvedInArc: boolean = false,
  notes: string = '',
  skipValidation: boolean = false
): Promise<AntagonistArcAssociation> {
  return withRetry(async () => {
    // If skipValidation is true, data will be saved via saveNovel, so just return a mock result
    if (skipValidation) {
      return {
        id: generateUUID(),
        antagonistId,
        arcId,
        role: role as any,
        introducedInArc,
        resolvedInArc,
        notes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Validate that both antagonist and arc exist in database
    const [antagonistCheck, arcCheck] = await Promise.all([
      supabase.from('antagonists').select('id').eq('id', antagonistId).maybeSingle(),
      supabase.from('arcs').select('id').eq('id', arcId).maybeSingle(),
    ]);

    if (antagonistCheck.error || !antagonistCheck.data) {
      const errorMsg = `Antagonist ${antagonistId} does not exist in database yet`;
      // Only log as warning, don't throw if this is expected (data will be saved via saveNovel)
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    if (arcCheck.error || !arcCheck.data) {
      const errorMsg = `Arc ${arcId} does not exist in database yet`;
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    const { data, error } = await supabase
      .from('antagonist_arcs')
      .insert({
        antagonist_id: antagonistId,
        arc_id: arcId,
        role,
        introduced_in_arc: introducedInArc,
        resolved_in_arc: resolvedInArc,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding antagonist to arc:', error);
      throw new Error(`Failed to add antagonist to arc: ${error.message}`);
    }

    return {
      id: data.id,
      antagonistId: data.antagonist_id,
      arcId: data.arc_id,
      role: data.role as any,
      introducedInArc: data.introduced_in_arc || false,
      resolvedInArc: data.resolved_in_arc || false,
      notes: data.notes || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Remove antagonist from arc
 */
export async function removeAntagonistFromArc(antagonistId: string, arcId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('antagonist_arcs')
      .delete()
      .eq('antagonist_id', antagonistId)
      .eq('arc_id', arcId);

    if (error) {
      console.error('Error removing antagonist from arc:', error);
      throw new Error(`Failed to remove antagonist from arc: ${error.message}`);
    }
  });
}

/**
 * Add antagonist appearance to chapter
 */
export async function addAntagonistToChapter(
  antagonistId: string,
  chapterId: string,
  presenceType: 'direct' | 'mentioned' | 'hinted' | 'influence',
  significance: 'major' | 'minor' | 'foreshadowing',
  notes: string = '',
  skipValidation: boolean = false
): Promise<AntagonistChapterAppearance> {
  return withRetry(async () => {
    // If skipValidation is true, data will be saved via saveNovel, so just return a mock result
    if (skipValidation) {
      return {
        id: crypto.randomUUID(),
        antagonistId,
        chapterId,
        presenceType: presenceType as PresenceType,
        significance: significance as 'major' | 'minor' | 'foreshadowing',
        notes,
        createdAt: Date.now(),
      };
    }

    // Get chapter number for updating lastAppearedChapter
    // Handle case where chapter might not be saved to database yet (406 error)
    let chapterNumber: number | undefined;
    const { data: chapter, error: chapterError } = await supabase
      .from('chapters')
      .select('number')
      .eq('id', chapterId)
      .maybeSingle();

    if (!chapterError && chapter) {
      chapterNumber = chapter.number;
    } else if (chapterError) {
      // Chapter might not exist in database yet - this is okay, we'll skip updating lastAppearedChapter
      // Only log at debug level to reduce noise
      console.debug(`Chapter ${chapterId} not found in database yet (may not be saved):`, chapterError.message);
    }

    // Validate that antagonist exists in database
    const antagonistCheck = await supabase
      .from('antagonists')
      .select('id')
      .eq('id', antagonistId)
      .maybeSingle();

    if (antagonistCheck.error || !antagonistCheck.data) {
      const errorMsg = `Antagonist ${antagonistId} does not exist in database yet`;
      // Only log at debug level to reduce noise - this is expected when saving via saveNovel
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    // Validate that chapter exists in database (we need it for the relationship)
    if (chapterError || !chapter) {
      const errorMsg = `Chapter ${chapterId} does not exist in database yet. Cannot create relationship until chapter is saved.`;
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    const { data, error } = await supabase
      .from('antagonist_chapters')
      .insert({
        antagonist_id: antagonistId,
        chapter_id: chapterId,
        presence_type: presenceType,
        significance,
        notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding antagonist to chapter:', error);
      // Provide more helpful error message for foreign key violations
      if (error.message.includes('foreign key constraint')) {
        if (error.message.includes('chapter_id')) {
          throw new Error(`Failed to add antagonist to chapter: Chapter ${chapterId} does not exist in database yet. Please save the chapter first.`);
        } else if (error.message.includes('antagonist_id')) {
          throw new Error(`Failed to add antagonist to chapter: Antagonist ${antagonistId} does not exist in database yet. Please save the antagonist first.`);
        }
      }
      throw new Error(`Failed to add antagonist to chapter: ${error.message}`);
    }

    // Automatically update lastAppearedChapter if we have the chapter number
    // Do this asynchronously to not block the main operation
    if (chapterNumber) {
      // Fire and forget - don't block on this
      updateAntagonistLastAppeared(antagonistId, chapterNumber).catch(err => {
        // Only log at debug level - this is a non-critical operation that may fail if antagonist doesn't exist yet
        console.debug('Failed to update lastAppearedChapter:', err);
      });
    }

    return {
      id: data.id,
      antagonistId: data.antagonist_id,
      chapterId: data.chapter_id,
      presenceType: data.presence_type as PresenceType,
      significance: data.significance as 'major' | 'minor' | 'foreshadowing',
      notes: data.notes || '',
      createdAt: timestampToNumber(data.created_at),
    };
  });
}

/**
 * Remove antagonist from chapter
 */
export async function removeAntagonistFromChapter(antagonistId: string, chapterId: string): Promise<void> {
  return withRetry(async () => {
    const { error } = await supabase
      .from('antagonist_chapters')
      .delete()
      .eq('antagonist_id', antagonistId)
      .eq('chapter_id', chapterId);

    if (error) {
      console.error('Error removing antagonist from chapter:', error);
      throw new Error(`Failed to remove antagonist from chapter: ${error.message}`);
    }
  });
}

/**
 * Add relationship between antagonist and character
 */
export async function addAntagonistRelationship(
  relationship: Omit<AntagonistRelationship, 'id' | 'createdAt' | 'updatedAt'>,
  skipValidation: boolean = false
): Promise<AntagonistRelationship> {
  return withRetry(async () => {
    // If skipValidation is true, data will be saved via saveNovel, so just return a mock result
    if (skipValidation) {
      return {
        id: generateUUID(),
        antagonistId: relationship.antagonistId,
        characterId: relationship.characterId,
        relationshipType: relationship.relationshipType,
        intensity: relationship.intensity,
        history: relationship.history || '',
        currentState: relationship.currentState || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Validate that both antagonist and character exist in database
    const [antagonistCheck, characterCheck] = await Promise.all([
      supabase.from('antagonists').select('id').eq('id', relationship.antagonistId).maybeSingle(),
      supabase.from('characters').select('id').eq('id', relationship.characterId).maybeSingle(),
    ]);

    if (antagonistCheck.error || !antagonistCheck.data) {
      const errorMsg = `Antagonist ${relationship.antagonistId} does not exist in database yet`;
      // Only log at debug level to reduce noise - this is expected when saving via saveNovel
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    if (characterCheck.error || !characterCheck.data) {
      const errorMsg = `Character ${relationship.characterId} does not exist in database yet`;
      console.debug(errorMsg);
      throw new Error(errorMsg);
    }

    const { data, error } = await supabase
      .from('antagonist_relationships')
      .insert({
        antagonist_id: relationship.antagonistId,
        character_id: relationship.characterId,
        relationship_type: relationship.relationshipType,
        intensity: relationship.intensity,
        history: relationship.history,
        current_state: relationship.currentState,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding antagonist relationship:', error);
      // Provide more helpful error message for foreign key violations
      if (error.message.includes('foreign key constraint')) {
        if (error.message.includes('antagonist_id')) {
          throw new Error(`Failed to add antagonist relationship: Antagonist ${relationship.antagonistId} does not exist in database yet. Please save the antagonist first.`);
        } else if (error.message.includes('character_id')) {
          throw new Error(`Failed to add antagonist relationship: Character ${relationship.characterId} does not exist in database yet. Please save the character first.`);
        }
      }
      throw new Error(`Failed to add antagonist relationship: ${error.message}`);
    }

    return {
      id: data.id,
      antagonistId: data.antagonist_id,
      characterId: data.character_id,
      relationshipType: data.relationship_type as any,
      intensity: data.intensity as any,
      history: data.history || '',
      currentState: data.current_state || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Add member to group antagonist
 */
export async function addGroupMember(
  member: Omit<AntagonistGroupMember, 'id' | 'createdAt' | 'updatedAt'>
): Promise<AntagonistGroupMember> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('antagonist_groups')
      .insert({
        antagonist_id: member.antagonistId,
        member_character_id: member.memberCharacterId,
        role_in_group: member.roleInGroup,
        joined_chapter: member.joinedChapter || null,
        left_chapter: member.leftChapter || null,
        notes: member.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding group member:', error);
      throw new Error(`Failed to add group member: ${error.message}`);
    }

    return {
      id: data.id,
      antagonistId: data.antagonist_id,
      memberCharacterId: data.member_character_id,
      roleInGroup: data.role_in_group as any,
      joinedChapter: data.joined_chapter || undefined,
      leftChapter: data.left_chapter || undefined,
      notes: data.notes || '',
      createdAt: timestampToNumber(data.created_at),
      updatedAt: timestampToNumber(data.updated_at),
    };
  });
}

/**
 * Record antagonist progression
 */
export async function recordAntagonistProgression(
  progression: Omit<AntagonistProgression, 'id' | 'createdAt'>
): Promise<AntagonistProgression> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('antagonist_progression')
      .insert({
        antagonist_id: progression.antagonistId,
        chapter_number: progression.chapterNumber,
        power_level: progression.powerLevel,
        threat_assessment: progression.threatAssessment,
        key_events: progression.keyEvents,
        relationship_changes: progression.relationshipChanges,
        notes: progression.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording antagonist progression:', error);
      throw new Error(`Failed to record antagonist progression: ${error.message}`);
    }

    return {
      id: data.id,
      antagonistId: data.antagonist_id,
      chapterNumber: data.chapter_number,
      powerLevel: data.power_level || '',
      threatAssessment: data.threat_assessment || '',
      keyEvents: data.key_events || [],
      relationshipChanges: data.relationship_changes || '',
      notes: data.notes || '',
      createdAt: timestampToNumber(data.created_at),
    };
  });
}

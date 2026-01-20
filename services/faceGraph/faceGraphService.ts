/**
 * Face Graph Service
 * 
 * Main service for managing the Face Graph - a social network memory system
 * that tracks karma, Face (reputation), and relationship links across the cultivation world.
 * 
 * This service handles:
 * - Creating and managing Face profiles for characters
 * - Recording karma events between characters
 * - Managing social links (relationship network)
 * - Tracking blood feuds and debts
 * - Persisting to and loading from Supabase
 */

import { supabase } from '../supabaseService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';
import type { Character, NovelState } from '../../types';
import type {
  FaceProfile,
  FaceTitle,
  FaceAccomplishment,
  FaceShame,
  KarmaEvent,
  SocialLink,
  KarmaRipple,
  BloodFeud,
  FaceDebt,
  FaceGraphConfig,
  KarmaActionType,
  KarmaPolarity,
  KarmaSeverity,
  SocialLinkType,
  LinkStrength,
  FaceTier,
  FaceCategory,
} from '../../types/faceGraph';
import { DEFAULT_FACE_GRAPH_CONFIG } from '../../types/faceGraph';

// ============================================================================
// FACE PROFILE MANAGEMENT
// ============================================================================

/**
 * Create a Face profile for a character
 */
export async function createFaceProfile(
  novelId: string,
  character: Character,
  initialFace: number = 0
): Promise<FaceProfile | null> {
  try {
    const profile: Partial<FaceProfile> = {
      id: generateUUID(),
      novelId,
      characterId: character.id,
      characterName: character.name,
      totalFace: initialFace,
      tier: calculateFaceTier(initialFace),
      faceByCategory: {
        martial: 0,
        scholarly: 0,
        political: 0,
        moral: 0,
        mysterious: 0,
        wealth: 0,
      },
      karmaBalance: 0,
      positiveKarmaTotal: 0,
      negativeKarmaTotal: 0,
      titles: [],
      accomplishments: [],
      shames: [],
      isProtected: character.isProtagonist || false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { data, error } = await supabase
      .from('face_profiles')
      .insert({
        id: profile.id,
        novel_id: novelId,
        character_id: character.id,
        character_name: character.name,
        total_face: initialFace,
        face_martial: 0,
        face_scholarly: 0,
        face_political: 0,
        face_moral: 0,
        face_mysterious: 0,
        face_wealth: 0,
        karma_balance: 0,
        positive_karma_total: 0,
        negative_karma_total: 0,
        is_protected: character.isProtagonist || false,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating Face profile', 'faceGraph', error);
      return null;
    }

    return mapDbToFaceProfile(data);
  } catch (error) {
    logger.error('Error creating Face profile', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get Face profile for a character
 */
export async function getFaceProfile(
  novelId: string,
  characterId: string
): Promise<FaceProfile | null> {
  try {
    const { data, error } = await supabase
      .from('face_profiles')
      .select('*, face_titles(*), face_accomplishments(*), face_shames(*)')
      .eq('novel_id', novelId)
      .eq('character_id', characterId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      logger.error('Error fetching Face profile', 'faceGraph', error);
      return null;
    }

    return mapDbToFaceProfile(data);
  } catch (error) {
    logger.error('Error fetching Face profile', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get all Face profiles for a novel
 */
export async function getAllFaceProfiles(novelId: string): Promise<FaceProfile[]> {
  try {
    const { data, error } = await supabase
      .from('face_profiles')
      .select('*, face_titles(*), face_accomplishments(*), face_shames(*)')
      .eq('novel_id', novelId)
      .order('total_face', { ascending: false });

    if (error) {
      logger.error('Error fetching Face profiles', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToFaceProfile);
  } catch (error) {
    logger.error('Error fetching Face profiles', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Update Face profile
 */
export async function updateFaceProfile(
  profileId: string,
  updates: Partial<FaceProfile>
): Promise<FaceProfile | null> {
  try {
    const dbUpdates: Record<string, any> = {};
    
    if (updates.totalFace !== undefined) dbUpdates.total_face = updates.totalFace;
    if (updates.faceByCategory) {
      dbUpdates.face_martial = updates.faceByCategory.martial;
      dbUpdates.face_scholarly = updates.faceByCategory.scholarly;
      dbUpdates.face_political = updates.faceByCategory.political;
      dbUpdates.face_moral = updates.faceByCategory.moral;
      dbUpdates.face_mysterious = updates.faceByCategory.mysterious;
      dbUpdates.face_wealth = updates.faceByCategory.wealth;
    }
    if (updates.karmaBalance !== undefined) dbUpdates.karma_balance = updates.karmaBalance;
    if (updates.positiveKarmaTotal !== undefined) dbUpdates.positive_karma_total = updates.positiveKarmaTotal;
    if (updates.negativeKarmaTotal !== undefined) dbUpdates.negative_karma_total = updates.negativeKarmaTotal;
    if (updates.lastUpdatedChapter !== undefined) dbUpdates.last_updated_chapter = updates.lastUpdatedChapter;
    if (updates.isProtected !== undefined) dbUpdates.is_protected = updates.isProtected;

    const { data, error } = await supabase
      .from('face_profiles')
      .update(dbUpdates)
      .eq('id', profileId)
      .select()
      .single();

    if (error) {
      logger.error('Error updating Face profile', 'faceGraph', error);
      return null;
    }

    return mapDbToFaceProfile(data);
  } catch (error) {
    logger.error('Error updating Face profile', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Add Face to a character
 */
export async function addFace(
  novelId: string,
  characterId: string,
  faceAmount: number,
  category: FaceCategory,
  chapterNumber: number,
  description?: string
): Promise<boolean> {
  try {
    let profile = await getFaceProfile(novelId, characterId);
    
    if (!profile) {
      // Create profile if it doesn't exist
      const { data: charData } = await supabase
        .from('characters')
        .select('id, name, is_protagonist')
        .eq('id', characterId)
        .single();
      
      if (!charData) return false;
      
      profile = await createFaceProfile(novelId, {
        id: charData.id,
        name: charData.name,
        isProtagonist: charData.is_protagonist,
      } as Character);
      
      if (!profile) return false;
    }

    const newCategoryFace = (profile.faceByCategory[category] || 0) + faceAmount;
    const newTotalFace = profile.totalFace + faceAmount;

    // Update profile
    await updateFaceProfile(profile.id, {
      totalFace: newTotalFace,
      faceByCategory: {
        ...profile.faceByCategory,
        [category]: newCategoryFace,
      },
      lastUpdatedChapter: chapterNumber,
    });

    // Add accomplishment if positive, shame if negative
    if (faceAmount > 0 && description) {
      await supabase.from('face_accomplishments').insert({
        id: generateUUID(),
        face_profile_id: profile.id,
        description,
        chapter_number: chapterNumber,
        face_gained: faceAmount,
        category,
        notoriety: faceAmount >= 100 ? 'realm' : faceAmount >= 50 ? 'regional' : 'local',
      });
    } else if (faceAmount < 0 && description) {
      await supabase.from('face_shames').insert({
        id: generateUUID(),
        face_profile_id: profile.id,
        description,
        chapter_number: chapterNumber,
        face_lost: Math.abs(faceAmount),
        category,
      });
    }

    return true;
  } catch (error) {
    logger.error('Error adding Face', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// KARMA EVENT MANAGEMENT
// ============================================================================

/**
 * Record a karma event between characters
 */
export async function recordKarmaEvent(
  novelId: string,
  actorId: string,
  actorName: string,
  targetId: string,
  targetName: string,
  actionType: KarmaActionType,
  chapterNumber: number,
  chapterId: string,
  description: string,
  options?: {
    severity?: KarmaSeverity;
    wasWitnessed?: boolean;
    witnessIds?: string[];
    isRetaliation?: boolean;
    retaliationForEventId?: string;
  }
): Promise<KarmaEvent | null> {
  try {
    const { calculateKarmaWeight } = await import('./karmaCalculator');
    
    // Calculate karma weight
    const { finalWeight, baseWeight, polarity, modifiers } = calculateKarmaWeight(
      actionType,
      options?.severity || 'moderate'
    );

    const event: Partial<KarmaEvent> = {
      id: generateUUID(),
      novelId,
      actorId,
      actorName,
      targetId,
      targetName,
      actionType,
      polarity,
      severity: options?.severity || 'moderate',
      karmaWeight: baseWeight,
      weightModifiers: modifiers,
      finalKarmaWeight: finalWeight,
      chapterNumber,
      chapterId,
      description,
      wasWitnessed: options?.wasWitnessed || false,
      witnessIds: options?.witnessIds || [],
      affectedFace: true,
      faceChangeActor: 0,
      faceChangeTarget: 0,
      rippleAffectedIds: [],
      isRetaliation: options?.isRetaliation || false,
      retaliationForEventId: options?.retaliationForEventId,
      isSettled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const { data, error } = await supabase
      .from('karma_events')
      .insert({
        id: event.id,
        novel_id: novelId,
        actor_id: actorId,
        actor_name: actorName,
        target_id: targetId,
        target_name: targetName,
        action_type: actionType,
        polarity,
        severity: options?.severity || 'moderate',
        karma_weight: baseWeight,
        weight_modifiers: modifiers,
        final_karma_weight: finalWeight,
        chapter_number: chapterNumber,
        chapter_id: chapterId,
        description,
        was_witnessed: options?.wasWitnessed || false,
        witness_ids: options?.witnessIds || [],
        affected_face: true,
        is_retaliation: options?.isRetaliation || false,
        retaliation_for_event_id: options?.retaliationForEventId,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error recording karma event', 'faceGraph', error);
      return null;
    }

    // Update karma balances for actor and target
    await updateKarmaBalance(novelId, actorId, polarity === 'negative' ? -finalWeight : finalWeight);
    await updateKarmaBalance(novelId, targetId, polarity === 'negative' ? finalWeight : -finalWeight);

    // Update social link sentiment
    await updateSocialLinkFromKarma(novelId, actorId, actorName, targetId, targetName, polarity, finalWeight, chapterNumber);

    // Trigger ripple analysis if karma is significant
    if (finalWeight >= 30) {
      const { analyzeRippleEffects } = await import('./rippleAnalyzer');
      await analyzeRippleEffects(novelId, data.id, chapterNumber);
    }

    return mapDbToKarmaEvent(data);
  } catch (error) {
    logger.error('Error recording karma event', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get karma events for a character (as actor or target)
 */
export async function getKarmaEventsForCharacter(
  novelId: string,
  characterId: string,
  options?: {
    asActor?: boolean;
    asTarget?: boolean;
    unsettledOnly?: boolean;
    limit?: number;
  }
): Promise<KarmaEvent[]> {
  try {
    let query = supabase
      .from('karma_events')
      .select('*')
      .eq('novel_id', novelId);

    if (options?.asActor && !options?.asTarget) {
      query = query.eq('actor_id', characterId);
    } else if (options?.asTarget && !options?.asActor) {
      query = query.eq('target_id', characterId);
    } else {
      query = query.or(`actor_id.eq.${characterId},target_id.eq.${characterId}`);
    }

    if (options?.unsettledOnly) {
      query = query.eq('is_settled', false);
    }

    query = query.order('chapter_number', { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching karma events', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToKarmaEvent);
  } catch (error) {
    logger.error('Error fetching karma events', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Get karma events between two specific characters
 */
export async function getKarmaBetweenCharacters(
  novelId: string,
  characterId1: string,
  characterId2: string
): Promise<KarmaEvent[]> {
  try {
    const { data, error } = await supabase
      .from('karma_events')
      .select('*')
      .eq('novel_id', novelId)
      .or(
        `and(actor_id.eq.${characterId1},target_id.eq.${characterId2}),and(actor_id.eq.${characterId2},target_id.eq.${characterId1})`
      )
      .order('chapter_number', { ascending: true });

    if (error) {
      logger.error('Error fetching karma between characters', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToKarmaEvent);
  } catch (error) {
    logger.error('Error fetching karma between characters', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Mark a karma event as settled
 */
export async function settleKarmaEvent(
  eventId: string,
  settlementType: 'avenged' | 'forgiven' | 'balanced' | 'inherited',
  settledChapter: number
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('karma_events')
      .update({
        is_settled: true,
        settlement_type: settlementType,
        settled_chapter: settledChapter,
      })
      .eq('id', eventId);

    if (error) {
      logger.error('Error settling karma event', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error settling karma event', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// SOCIAL LINK MANAGEMENT
// ============================================================================

/**
 * Create or update a social link between characters
 */
export async function upsertSocialLink(
  novelId: string,
  sourceCharacterId: string,
  sourceCharacterName: string,
  targetCharacterId: string,
  targetCharacterName: string,
  linkType: SocialLinkType,
  chapterNumber: number,
  options?: {
    strength?: LinkStrength;
    sentimentScore?: number;
    relationshipHistory?: string;
    isInherited?: boolean;
    inheritedFromCharacterId?: string;
  }
): Promise<SocialLink | null> {
  try {
    // Check if link already exists
    const { data: existing } = await supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId)
      .eq('source_character_id', sourceCharacterId)
      .eq('target_character_id', targetCharacterId)
      .eq('link_type', linkType)
      .single();

    if (existing) {
      // Update existing link
      const { data, error } = await supabase
        .from('social_links')
        .update({
          strength: options?.strength || existing.strength,
          sentiment_score: options?.sentimentScore ?? existing.sentiment_score,
          last_interaction_chapter: chapterNumber,
          relationship_history: options?.relationshipHistory || existing.relationship_history,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        logger.error('Error updating social link', 'faceGraph', error);
        return null;
      }

      return mapDbToSocialLink(data);
    }

    // Create new link
    const { data, error } = await supabase
      .from('social_links')
      .insert({
        id: generateUUID(),
        novel_id: novelId,
        source_character_id: sourceCharacterId,
        source_character_name: sourceCharacterName,
        target_character_id: targetCharacterId,
        target_character_name: targetCharacterName,
        link_type: linkType,
        strength: options?.strength || 'moderate',
        sentiment_score: options?.sentimentScore ?? 0,
        established_chapter: chapterNumber,
        last_interaction_chapter: chapterNumber,
        relationship_history: options?.relationshipHistory || '',
        is_inherited: options?.isInherited || false,
        inherited_from_character_id: options?.inheritedFromCharacterId,
        inherited_chapter: options?.isInherited ? chapterNumber : null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating social link', 'faceGraph', error);
      return null;
    }

    return mapDbToSocialLink(data);
  } catch (error) {
    logger.error('Error upserting social link', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get all social links for a character
 */
export async function getSocialLinksForCharacter(
  novelId: string,
  characterId: string,
  options?: {
    asSource?: boolean;
    asTarget?: boolean;
    linkTypes?: SocialLinkType[];
  }
): Promise<SocialLink[]> {
  try {
    let query = supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId);

    if (options?.asSource && !options?.asTarget) {
      query = query.eq('source_character_id', characterId);
    } else if (options?.asTarget && !options?.asSource) {
      query = query.eq('target_character_id', characterId);
    } else {
      query = query.or(`source_character_id.eq.${characterId},target_character_id.eq.${characterId}`);
    }

    if (options?.linkTypes && options.linkTypes.length > 0) {
      query = query.in('link_type', options.linkTypes);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error fetching social links', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToSocialLink);
  } catch (error) {
    logger.error('Error fetching social links', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Get all social links in the novel
 */
export async function getAllSocialLinks(novelId: string): Promise<SocialLink[]> {
  try {
    const { data, error } = await supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId);

    if (error) {
      logger.error('Error fetching all social links', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToSocialLink);
  } catch (error) {
    logger.error('Error fetching all social links', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Update social link sentiment based on karma event
 */
async function updateSocialLinkFromKarma(
  novelId: string,
  actorId: string,
  actorName: string,
  targetId: string,
  targetName: string,
  polarity: KarmaPolarity,
  karmaWeight: number,
  chapterNumber: number
): Promise<void> {
  try {
    // Get existing link from target's perspective (how they feel about actor)
    const { data: existing } = await supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId)
      .eq('source_character_id', targetId)
      .eq('target_character_id', actorId)
      .single();

    const sentimentChange = polarity === 'positive' ? Math.floor(karmaWeight / 2) :
                           polarity === 'negative' ? -Math.floor(karmaWeight / 2) : 0;

    if (existing) {
      const newSentiment = Math.max(-100, Math.min(100, existing.sentiment_score + sentimentChange));
      
      await supabase
        .from('social_links')
        .update({
          sentiment_score: newSentiment,
          unsettled_karma: existing.unsettled_karma + karmaWeight,
          last_interaction_chapter: chapterNumber,
        })
        .eq('id', existing.id);
    } else {
      // Create new link based on the action
      const linkType: SocialLinkType = polarity === 'negative' ? 'enemy' : 
                                        polarity === 'positive' ? 'benefactor' : 'rival';
      
      await upsertSocialLink(
        novelId,
        targetId,
        targetName,
        actorId,
        actorName,
        linkType,
        chapterNumber,
        {
          sentimentScore: sentimentChange,
          strength: karmaWeight >= 60 ? 'strong' : karmaWeight >= 30 ? 'moderate' : 'weak',
        }
      );
    }
  } catch (error) {
    logger.error('Error updating social link from karma', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// BLOOD FEUD MANAGEMENT
// ============================================================================

/**
 * Create a blood feud
 */
export async function createBloodFeud(
  novelId: string,
  feudName: string,
  aggrievedPartyType: 'character' | 'clan' | 'sect' | 'faction',
  aggrievedPartyId: string,
  aggrievedPartyName: string,
  targetPartyType: 'character' | 'clan' | 'sect' | 'faction',
  targetPartyId: string,
  targetPartyName: string,
  originalCause: string,
  originKarmaEventId: string,
  startedChapter: number,
  aggrievedMemberIds: string[] = [],
  targetMemberIds: string[] = []
): Promise<BloodFeud | null> {
  try {
    const { data, error } = await supabase
      .from('blood_feuds')
      .insert({
        id: generateUUID(),
        novel_id: novelId,
        feud_name: feudName,
        aggrieved_party_type: aggrievedPartyType,
        aggrieved_party_id: aggrievedPartyId,
        aggrieved_party_name: aggrievedPartyName,
        target_party_type: targetPartyType,
        target_party_id: targetPartyId,
        target_party_name: targetPartyName,
        original_cause: originalCause,
        origin_karma_event_id: originKarmaEventId,
        started_chapter: startedChapter,
        intensity: 50,
        aggrieved_member_ids: aggrievedMemberIds,
        target_member_ids: targetMemberIds,
        escalations: [],
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating blood feud', 'faceGraph', error);
      return null;
    }

    return mapDbToBloodFeud(data);
  } catch (error) {
    logger.error('Error creating blood feud', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get all active blood feuds for a novel
 */
export async function getActiveBloodFeuds(novelId: string): Promise<BloodFeud[]> {
  try {
    const { data, error } = await supabase
      .from('blood_feuds')
      .select('*')
      .eq('novel_id', novelId)
      .eq('is_resolved', false)
      .order('intensity', { ascending: false });

    if (error) {
      logger.error('Error fetching blood feuds', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToBloodFeud);
  } catch (error) {
    logger.error('Error fetching blood feuds', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Escalate a blood feud
 */
export async function escalateBloodFeud(
  feudId: string,
  chapterNumber: number,
  description: string,
  intensityChange: number,
  karmaEventId?: string
): Promise<boolean> {
  try {
    const { data: feud } = await supabase
      .from('blood_feuds')
      .select('*')
      .eq('id', feudId)
      .single();

    if (!feud) return false;

    const escalations = feud.escalations || [];
    escalations.push({
      chapterNumber,
      description,
      intensityChange,
      karmaEventId,
    });

    const newIntensity = Math.max(0, Math.min(100, feud.intensity + intensityChange));

    const { error } = await supabase
      .from('blood_feuds')
      .update({
        intensity: newIntensity,
        escalations,
      })
      .eq('id', feudId);

    if (error) {
      logger.error('Error escalating blood feud', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error escalating blood feud', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Resolve a blood feud
 */
export async function resolveBloodFeud(
  feudId: string,
  resolutionType: 'vengeance_complete' | 'mutual_destruction' | 'forgiveness' | 'extinction' | 'alliance',
  resolutionChapter: number,
  resolutionDescription: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('blood_feuds')
      .update({
        is_resolved: true,
        resolution_type: resolutionType,
        resolution_chapter: resolutionChapter,
        resolution_description: resolutionDescription,
      })
      .eq('id', feudId);

    if (error) {
      logger.error('Error resolving blood feud', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error resolving blood feud', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// FACE DEBT MANAGEMENT
// ============================================================================

/**
 * Create a face debt (favor owed)
 */
export async function createFaceDebt(
  novelId: string,
  debtorId: string,
  debtorName: string,
  creditorId: string,
  creditorName: string,
  debtType: 'life_saving' | 'treasure' | 'teaching' | 'protection' | 'political' | 'other',
  description: string,
  originKarmaEventId: string,
  incurredChapter: number,
  debtWeight: number = 50
): Promise<FaceDebt | null> {
  try {
    const { data, error } = await supabase
      .from('face_debts')
      .insert({
        id: generateUUID(),
        novel_id: novelId,
        debtor_id: debtorId,
        debtor_name: debtorName,
        creditor_id: creditorId,
        creditor_name: creditorName,
        debt_type: debtType,
        description,
        origin_karma_event_id: originKarmaEventId,
        incurred_chapter: incurredChapter,
        debt_weight: debtWeight,
      })
      .select()
      .single();

    if (error) {
      logger.error('Error creating face debt', 'faceGraph', error);
      return null;
    }

    return mapDbToFaceDebt(data);
  } catch (error) {
    logger.error('Error creating face debt', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get unpaid debts for a character
 */
export async function getUnpaidDebts(
  novelId: string,
  characterId: string,
  asDebtor: boolean = true
): Promise<FaceDebt[]> {
  try {
    let query = supabase
      .from('face_debts')
      .select('*')
      .eq('novel_id', novelId)
      .eq('is_repaid', false);

    if (asDebtor) {
      query = query.eq('debtor_id', characterId);
    } else {
      query = query.eq('creditor_id', characterId);
    }

    const { data, error } = await query.order('debt_weight', { ascending: false });

    if (error) {
      logger.error('Error fetching unpaid debts', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToFaceDebt);
  } catch (error) {
    logger.error('Error fetching unpaid debts', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Repay a debt
 */
export async function repayDebt(
  debtId: string,
  repaymentChapter: number,
  repaymentDescription: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('face_debts')
      .update({
        is_repaid: true,
        repayment_chapter: repaymentChapter,
        repayment_description: repaymentDescription,
      })
      .eq('id', debtId);

    if (error) {
      logger.error('Error repaying debt', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error repaying debt', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// KARMA RIPPLES
// ============================================================================

/**
 * Get pending (unmanifested) ripples for a novel
 */
export async function getPendingRipples(novelId: string): Promise<KarmaRipple[]> {
  try {
    const { data, error } = await supabase
      .from('karma_ripples')
      .select('*')
      .eq('novel_id', novelId)
      .eq('has_manifested', false)
      .order('degrees_of_separation', { ascending: true });

    if (error) {
      logger.error('Error fetching pending ripples', 'faceGraph', error);
      return [];
    }

    return data.map(mapDbToKarmaRipple);
  } catch (error) {
    logger.error('Error fetching pending ripples', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Mark a ripple as manifested
 */
export async function manifestRipple(
  rippleId: string,
  manifestedChapter: number,
  manifestationDescription: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('karma_ripples')
      .update({
        has_manifested: true,
        manifested_chapter: manifestedChapter,
        manifestation_description: manifestationDescription,
      })
      .eq('id', rippleId);

    if (error) {
      logger.error('Error manifesting ripple', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error manifesting ripple', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get Face Graph configuration for a novel
 */
export async function getFaceGraphConfig(novelId: string): Promise<FaceGraphConfig> {
  try {
    const { data, error } = await supabase
      .from('face_graph_config')
      .select('*')
      .eq('novel_id', novelId)
      .single();

    if (error || !data) {
      return DEFAULT_FACE_GRAPH_CONFIG;
    }

    return {
      enabled: data.enabled,
      autoCalculateRipples: data.auto_calculate_ripples,
      maxRippleDegrees: data.max_ripple_degrees,
      rippleKarmaThreshold: data.ripple_karma_threshold,
      karmaDecayPerChapter: parseFloat(data.karma_decay_per_chapter),
      autoExtractKarma: data.auto_extract_karma,
      extractionModel: data.extraction_model,
      protectedCharacterIds: data.protected_character_ids || [],
      faceMultipliers: data.face_multipliers || DEFAULT_FACE_GRAPH_CONFIG.faceMultipliers,
    };
  } catch (error) {
    logger.error('Error fetching Face Graph config', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return DEFAULT_FACE_GRAPH_CONFIG;
  }
}

/**
 * Save Face Graph configuration for a novel
 */
export async function saveFaceGraphConfig(
  novelId: string,
  config: Partial<FaceGraphConfig>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('face_graph_config')
      .upsert({
        novel_id: novelId,
        enabled: config.enabled,
        auto_calculate_ripples: config.autoCalculateRipples,
        max_ripple_degrees: config.maxRippleDegrees,
        ripple_karma_threshold: config.rippleKarmaThreshold,
        karma_decay_per_chapter: config.karmaDecayPerChapter,
        auto_extract_karma: config.autoExtractKarma,
        extraction_model: config.extractionModel,
        protected_character_ids: config.protectedCharacterIds,
        face_multipliers: config.faceMultipliers,
      }, {
        onConflict: 'novel_id',
      });

    if (error) {
      logger.error('Error saving Face Graph config', 'faceGraph', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error saving Face Graph config', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate Face tier from total Face points
 */
function calculateFaceTier(totalFace: number): FaceTier {
  if (totalFace >= 10000) return 'mythical';
  if (totalFace >= 5000) return 'legendary';
  if (totalFace >= 2000) return 'famous';
  if (totalFace >= 500) return 'renowned';
  if (totalFace >= 100) return 'known';
  return 'nobody';
}

/**
 * Update karma balance for a character
 */
async function updateKarmaBalance(
  novelId: string,
  characterId: string,
  karmaChange: number
): Promise<void> {
  try {
    const profile = await getFaceProfile(novelId, characterId);
    if (!profile) return;

    const newKarmaBalance = profile.karmaBalance + karmaChange;
    const newPositive = karmaChange > 0 ? profile.positiveKarmaTotal + karmaChange : profile.positiveKarmaTotal;
    const newNegative = karmaChange < 0 ? profile.negativeKarmaTotal + Math.abs(karmaChange) : profile.negativeKarmaTotal;

    await updateFaceProfile(profile.id, {
      karmaBalance: newKarmaBalance,
      positiveKarmaTotal: newPositive,
      negativeKarmaTotal: newNegative,
    });
  } catch (error) {
    logger.error('Error updating karma balance', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

function mapDbToFaceProfile(data: any): FaceProfile {
  return {
    id: data.id,
    novelId: data.novel_id,
    characterId: data.character_id,
    characterName: data.character_name,
    totalFace: data.total_face,
    tier: data.tier,
    faceByCategory: {
      martial: data.face_martial || 0,
      scholarly: data.face_scholarly || 0,
      political: data.face_political || 0,
      moral: data.face_moral || 0,
      mysterious: data.face_mysterious || 0,
      wealth: data.face_wealth || 0,
    },
    karmaBalance: data.karma_balance,
    positiveKarmaTotal: data.positive_karma_total,
    negativeKarmaTotal: data.negative_karma_total,
    titles: (data.face_titles || []).map(mapDbToFaceTitle),
    accomplishments: (data.face_accomplishments || []).map(mapDbToAccomplishment),
    shames: (data.face_shames || []).map(mapDbToShame),
    firstAppearedChapter: data.first_appeared_chapter,
    lastUpdatedChapter: data.last_updated_chapter,
    isProtected: data.is_protected,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

function mapDbToFaceTitle(data: any): FaceTitle {
  return {
    id: data.id,
    title: data.title,
    earnedBy: data.earned_by,
    earnedChapter: data.earned_chapter,
    faceBonus: data.face_bonus,
    isActive: data.is_active,
    lostChapter: data.lost_chapter,
    lostReason: data.lost_reason,
  };
}

function mapDbToAccomplishment(data: any): FaceAccomplishment {
  return {
    id: data.id,
    description: data.description,
    chapterNumber: data.chapter_number,
    faceGained: data.face_gained,
    category: data.category,
    notoriety: data.notoriety,
  };
}

function mapDbToShame(data: any): FaceShame {
  return {
    id: data.id,
    description: data.description,
    chapterNumber: data.chapter_number,
    faceLost: data.face_lost,
    category: data.category,
    isRedeemed: data.is_redeemed,
    redeemedChapter: data.redeemed_chapter,
  };
}

function mapDbToKarmaEvent(data: any): KarmaEvent {
  return {
    id: data.id,
    novelId: data.novel_id,
    actorId: data.actor_id,
    actorName: data.actor_name,
    targetId: data.target_id,
    targetName: data.target_name,
    actionType: data.action_type,
    polarity: data.polarity,
    severity: data.severity,
    karmaWeight: data.karma_weight,
    weightModifiers: data.weight_modifiers || [],
    finalKarmaWeight: data.final_karma_weight,
    chapterNumber: data.chapter_number,
    chapterId: data.chapter_id,
    description: data.description,
    wasWitnessed: data.was_witnessed,
    witnessIds: data.witness_ids || [],
    affectedFace: data.affected_face,
    faceChangeActor: data.face_change_actor,
    faceChangeTarget: data.face_change_target,
    rippleAffectedIds: data.ripple_affected_ids || [],
    isRetaliation: data.is_retaliation,
    retaliationForEventId: data.retaliation_for_event_id,
    isSettled: data.is_settled,
    settlementType: data.settlement_type,
    settledChapter: data.settled_chapter,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

function mapDbToSocialLink(data: any): SocialLink {
  return {
    id: data.id,
    novelId: data.novel_id,
    sourceCharacterId: data.source_character_id,
    sourceCharacterName: data.source_character_name,
    targetCharacterId: data.target_character_id,
    targetCharacterName: data.target_character_name,
    linkType: data.link_type,
    strength: data.strength,
    sentimentScore: data.sentiment_score,
    sentiment: data.sentiment,
    mutualKarmaBalance: data.mutual_karma_balance,
    unsettledKarma: data.unsettled_karma,
    establishedChapter: data.established_chapter,
    lastInteractionChapter: data.last_interaction_chapter,
    relationshipHistory: data.relationship_history,
    isInherited: data.is_inherited,
    inheritedFromCharacterId: data.inherited_from_character_id,
    inheritedChapter: data.inherited_chapter,
    isKnownToBoth: data.is_known_to_both,
    isPublicKnowledge: data.is_public_knowledge,
    karmaEventIds: data.karma_event_ids || [],
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

function mapDbToKarmaRipple(data: any): KarmaRipple {
  return {
    id: data.id,
    novelId: data.novel_id,
    sourceKarmaEventId: data.source_karma_event_id,
    originalActorId: data.original_actor_id,
    originalActorName: data.original_actor_name,
    originalTargetId: data.original_target_id,
    originalTargetName: data.original_target_name,
    affectedCharacterId: data.affected_character_id,
    affectedCharacterName: data.affected_character_name,
    connectionToTarget: data.connection_to_target,
    connectionPath: data.connection_path || [],
    degreesOfSeparation: data.degrees_of_separation,
    sentimentChange: data.sentiment_change,
    becomesThreat: data.becomes_threat,
    threatLevel: data.threat_level,
    potentialResponse: data.potential_response,
    calculatedAtChapter: data.calculated_at_chapter,
    hasManifested: data.has_manifested,
    manifestedChapter: data.manifested_chapter,
    manifestationDescription: data.manifestation_description,
    decayFactor: parseFloat(data.decay_factor),
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

function mapDbToBloodFeud(data: any): BloodFeud {
  return {
    id: data.id,
    novelId: data.novel_id,
    feudName: data.feud_name,
    aggrievedPartyType: data.aggrieved_party_type,
    aggrievedPartyId: data.aggrieved_party_id,
    aggrievedPartyName: data.aggrieved_party_name,
    targetPartyType: data.target_party_type,
    targetPartyId: data.target_party_id,
    targetPartyName: data.target_party_name,
    originalCause: data.original_cause,
    originKarmaEventId: data.origin_karma_event_id,
    startedChapter: data.started_chapter,
    intensity: data.intensity,
    aggrievedMemberIds: data.aggrieved_member_ids || [],
    targetMemberIds: data.target_member_ids || [],
    isResolved: data.is_resolved,
    resolutionType: data.resolution_type,
    resolutionChapter: data.resolution_chapter,
    resolutionDescription: data.resolution_description,
    escalations: data.escalations || [],
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

function mapDbToFaceDebt(data: any): FaceDebt {
  return {
    id: data.id,
    novelId: data.novel_id,
    debtorId: data.debtor_id,
    debtorName: data.debtor_name,
    creditorId: data.creditor_id,
    creditorName: data.creditor_name,
    debtType: data.debt_type,
    description: data.description,
    originKarmaEventId: data.origin_karma_event_id,
    incurredChapter: data.incurred_chapter,
    debtWeight: data.debt_weight,
    isRepaid: data.is_repaid,
    repaymentDescription: data.repayment_description,
    repaymentChapter: data.repayment_chapter,
    isPublicKnowledge: data.is_public_knowledge,
    canBeInherited: data.can_be_inherited,
    wasInherited: data.was_inherited,
    inheritedFromId: data.inherited_from_id,
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

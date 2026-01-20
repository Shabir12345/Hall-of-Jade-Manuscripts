/**
 * Face Graph Persistence Service
 * 
 * Handles fetching and persisting Face Graph data to/from Supabase.
 * Includes batch operations and integration with novel state loading.
 */

import { supabase } from '../supabaseService';
import { logger } from '../loggingService';
import type {
  FaceProfile,
  FaceTitle,
  KarmaEvent,
  SocialLink,
  KarmaRipple,
  BloodFeud,
  FaceDebt,
  FaceGraphConfig,
} from '../../types/faceGraph';

interface FaceGraphData {
  faceProfiles: FaceProfile[];
  karmaEvents: KarmaEvent[];
  socialLinks: SocialLink[];
  bloodFeuds: BloodFeud[];
  faceDebts: FaceDebt[];
  pendingRipples: KarmaRipple[];
  config: FaceGraphConfig | null;
}

/**
 * Fetch all Face Graph data for a novel
 */
export async function fetchFaceGraphData(novelId: string): Promise<FaceGraphData> {
  try {
    // Fetch all Face Graph tables in parallel
    const [
      profilesRes,
      eventsRes,
      linksRes,
      feudsRes,
      debtsRes,
      ripplesRes,
      configRes,
    ] = await Promise.all([
      supabase.from('face_profiles').select('*').eq('novel_id', novelId),
      supabase.from('karma_events').select('*').eq('novel_id', novelId).order('chapter_number', { ascending: true }),
      supabase.from('social_links').select('*').eq('novel_id', novelId),
      supabase.from('blood_feuds').select('*').eq('novel_id', novelId),
      supabase.from('face_debts').select('*').eq('novel_id', novelId),
      supabase.from('karma_ripples').select('*').eq('novel_id', novelId).eq('has_manifested', false),
      supabase.from('face_graph_config').select('*').eq('novel_id', novelId).maybeSingle(),
    ]);

    // Map database rows to TypeScript types
    const faceProfiles = (profilesRes.data || []).map(mapDbToFaceProfile);
    const karmaEvents = (eventsRes.data || []).map(mapDbToKarmaEvent);
    const socialLinks = (linksRes.data || []).map(mapDbToSocialLink);
    const bloodFeuds = (feudsRes.data || []).map(mapDbToBloodFeud);
    const faceDebts = (debtsRes.data || []).map(mapDbToFaceDebt);
    const pendingRipples = (ripplesRes.data || []).map(mapDbToKarmaRipple);
    const config = configRes.data ? mapDbToConfig(configRes.data) : null;

    return {
      faceProfiles,
      karmaEvents,
      socialLinks,
      bloodFeuds,
      faceDebts,
      pendingRipples,
      config,
    };
  } catch (error) {
    logger.warn('Failed to fetch Face Graph data (tables may not exist yet)', 'faceGraphPersistence', {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      faceProfiles: [],
      karmaEvents: [],
      socialLinks: [],
      bloodFeuds: [],
      faceDebts: [],
      pendingRipples: [],
      config: null,
    };
  }
}

/**
 * Fetch karma events between specific characters
 */
export async function fetchKarmaBetweenCharacters(
  novelId: string,
  characterId1: string,
  characterId2: string
): Promise<KarmaEvent[]> {
  try {
    const { data, error } = await supabase
      .from('karma_events')
      .select('*')
      .eq('novel_id', novelId)
      .or(`actor_id.eq.${characterId1},actor_id.eq.${characterId2}`)
      .or(`target_id.eq.${characterId1},target_id.eq.${characterId2}`)
      .order('chapter_number', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapDbToKarmaEvent);
  } catch (error) {
    logger.error('Error fetching karma between characters', 'faceGraphPersistence', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Fetch all social connections for a character
 */
export async function fetchCharacterConnections(
  novelId: string,
  characterId: string
): Promise<SocialLink[]> {
  try {
    const { data, error } = await supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId)
      .or(`source_character_id.eq.${characterId},target_character_id.eq.${characterId}`);

    if (error) throw error;
    return (data || []).map(mapDbToSocialLink);
  } catch (error) {
    logger.error('Error fetching character connections', 'faceGraphPersistence', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Fetch unresolved karma events for characters in a chapter
 */
export async function fetchUnresolvedKarmaForCharacters(
  novelId: string,
  characterIds: string[]
): Promise<KarmaEvent[]> {
  if (characterIds.length === 0) return [];

  try {
    const { data, error } = await supabase
      .from('karma_events')
      .select('*')
      .eq('novel_id', novelId)
      .eq('is_settled', false)
      .in('actor_id', characterIds);

    if (error) throw error;
    return (data || []).map(mapDbToKarmaEvent);
  } catch (error) {
    logger.error('Error fetching unresolved karma', 'faceGraphPersistence', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Fetch active threats (NPCs who may take action against MC)
 */
export async function fetchActiveThreats(
  novelId: string,
  protagonistId: string
): Promise<Array<{
  characterId: string;
  characterName: string;
  threatLevel: string;
  reason: string;
}>> {
  try {
    // Get pending ripples that are threats
    const { data: ripples, error: ripplesError } = await supabase
      .from('karma_ripples')
      .select('*')
      .eq('novel_id', novelId)
      .eq('becomes_threat', true)
      .eq('has_manifested', false);

    if (ripplesError) throw ripplesError;

    // Get blood feuds targeting the protagonist
    const { data: feuds, error: feudsError } = await supabase
      .from('blood_feuds')
      .select('*')
      .eq('novel_id', novelId)
      .eq('is_resolved', false)
      .contains('target_member_ids', [protagonistId]);

    if (feudsError) throw feudsError;

    const threats: Array<{
      characterId: string;
      characterName: string;
      threatLevel: string;
      reason: string;
    }> = [];

    // Add ripple-based threats
    (ripples || []).forEach((ripple: any) => {
      threats.push({
        characterId: ripple.affected_character_id,
        characterName: ripple.affected_character_name,
        threatLevel: ripple.threat_level || 'moderate',
        reason: ripple.potential_response || 'Unspecified grievance',
      });
    });

    // Add feud-based threats
    (feuds || []).forEach((feud: any) => {
      // Add each aggrieved member as a threat
      (feud.aggrieved_member_ids || []).forEach((memberId: string) => {
        threats.push({
          characterId: memberId,
          characterName: feud.aggrieved_party_name,
          threatLevel: feud.intensity > 70 ? 'extreme' : feud.intensity > 40 ? 'major' : 'moderate',
          reason: `Blood feud: ${feud.original_cause}`,
        });
      });
    });

    return threats;
  } catch (error) {
    logger.error('Error fetching active threats', 'faceGraphPersistence', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Fetch Face Graph statistics for a novel
 */
export async function fetchFaceGraphStats(novelId: string): Promise<{
  totalProfiles: number;
  totalKarmaEvents: number;
  totalSocialLinks: number;
  activeBloodFeuds: number;
  unpaidDebts: number;
  pendingRipples: number;
}> {
  try {
    const [
      profilesCount,
      eventsCount,
      linksCount,
      feudsCount,
      debtsCount,
      ripplesCount,
    ] = await Promise.all([
      supabase.from('face_profiles').select('id', { count: 'exact', head: true }).eq('novel_id', novelId),
      supabase.from('karma_events').select('id', { count: 'exact', head: true }).eq('novel_id', novelId),
      supabase.from('social_links').select('id', { count: 'exact', head: true }).eq('novel_id', novelId),
      supabase.from('blood_feuds').select('id', { count: 'exact', head: true }).eq('novel_id', novelId).eq('is_resolved', false),
      supabase.from('face_debts').select('id', { count: 'exact', head: true }).eq('novel_id', novelId).eq('is_repaid', false),
      supabase.from('karma_ripples').select('id', { count: 'exact', head: true }).eq('novel_id', novelId).eq('has_manifested', false),
    ]);

    return {
      totalProfiles: profilesCount.count || 0,
      totalKarmaEvents: eventsCount.count || 0,
      totalSocialLinks: linksCount.count || 0,
      activeBloodFeuds: feudsCount.count || 0,
      unpaidDebts: debtsCount.count || 0,
      pendingRipples: ripplesCount.count || 0,
    };
  } catch (error) {
    logger.error('Error fetching Face Graph stats', 'faceGraphPersistence', error instanceof Error ? error : new Error(String(error)));
    return {
      totalProfiles: 0,
      totalKarmaEvents: 0,
      totalSocialLinks: 0,
      activeBloodFeuds: 0,
      unpaidDebts: 0,
      pendingRipples: 0,
    };
  }
}

// ============================================================================
// Database Mapping Functions
// ============================================================================

function mapDbToFaceProfile(row: any): FaceProfile {
  return {
    id: row.id,
    novelId: row.novel_id,
    characterId: row.character_id,
    characterName: row.character_name,
    totalFace: row.total_face || 0,
    tier: row.tier || 'nobody',
    faceByCategory: {
      martial: row.face_martial || 0,
      scholarly: row.face_scholarly || 0,
      political: row.face_political || 0,
      moral: row.face_moral || 0,
      mysterious: row.face_mysterious || 0,
      wealth: row.face_wealth || 0,
    },
    karmaBalance: row.karma_balance || 0,
    positiveKarmaTotal: row.positive_karma_total || 0,
    negativeKarmaTotal: row.negative_karma_total || 0,
    titles: [], // Will be fetched separately if needed
    accomplishments: [],
    shames: [],
    firstAppearedChapter: row.first_appeared_chapter,
    lastUpdatedChapter: row.last_updated_chapter,
    isProtected: row.is_protected || false,
  };
}

function mapDbToKarmaEvent(row: any): KarmaEvent {
  return {
    id: row.id,
    novelId: row.novel_id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    targetId: row.target_id,
    targetName: row.target_name,
    actionType: row.action_type,
    polarity: row.polarity,
    severity: row.severity,
    karmaWeight: row.karma_weight,
    weightModifiers: row.weight_modifiers || [],
    finalKarmaWeight: row.final_karma_weight,
    chapterNumber: row.chapter_number,
    chapterId: row.chapter_id,
    description: row.description || '',
    wasWitnessed: row.was_witnessed || false,
    witnessIds: row.witness_ids || [],
    affectedFace: row.affected_face || false,
    faceChangeActor: row.face_change_actor || 0,
    faceChangeTarget: row.face_change_target || 0,
    rippleAffectedIds: row.ripple_affected_ids || [],
    isRetaliation: row.is_retaliation || false,
    retaliationForEventId: row.retaliation_for_event_id,
    isSettled: row.is_settled || false,
    settlementType: row.settlement_type,
    settledChapter: row.settled_chapter,
  };
}

function mapDbToSocialLink(row: any): SocialLink {
  return {
    id: row.id,
    novelId: row.novel_id,
    sourceCharacterId: row.source_character_id,
    sourceCharacterName: row.source_character_name,
    targetCharacterId: row.target_character_id,
    targetCharacterName: row.target_character_name,
    linkType: row.link_type,
    strength: row.strength || 'moderate',
    sentimentScore: row.sentiment_score || 0,
    sentiment: row.sentiment || 'neutral',
    mutualKarmaBalance: row.mutual_karma_balance || 0,
    unsettledKarma: row.unsettled_karma || 0,
    establishedChapter: row.established_chapter,
    lastInteractionChapter: row.last_interaction_chapter,
    relationshipHistory: row.relationship_history || '',
    isInherited: row.is_inherited || false,
    inheritedFromCharacterId: row.inherited_from_character_id,
    inheritedChapter: row.inherited_chapter,
    isKnownToBoth: row.is_known_to_both !== false,
    isPublicKnowledge: row.is_public_knowledge || false,
    karmaEventIds: row.karma_event_ids || [],
  };
}

function mapDbToBloodFeud(row: any): BloodFeud {
  return {
    id: row.id,
    novelId: row.novel_id,
    feudName: row.feud_name,
    aggrievedPartyType: row.aggrieved_party_type,
    aggrievedPartyId: row.aggrieved_party_id,
    aggrievedPartyName: row.aggrieved_party_name,
    targetPartyType: row.target_party_type,
    targetPartyId: row.target_party_id,
    targetPartyName: row.target_party_name,
    originalCause: row.original_cause,
    originKarmaEventId: row.origin_karma_event_id,
    startedChapter: row.started_chapter,
    intensity: row.intensity || 50,
    aggrievedMemberIds: row.aggrieved_member_ids || [],
    targetMemberIds: row.target_member_ids || [],
    isResolved: row.is_resolved || false,
    resolutionType: row.resolution_type,
    resolutionChapter: row.resolution_chapter,
    resolutionDescription: row.resolution_description,
    escalations: row.escalations || [],
  };
}

function mapDbToFaceDebt(row: any): FaceDebt {
  return {
    id: row.id,
    novelId: row.novel_id,
    debtorId: row.debtor_id,
    debtorName: row.debtor_name,
    creditorId: row.creditor_id,
    creditorName: row.creditor_name,
    debtType: row.debt_type,
    description: row.description,
    originKarmaEventId: row.origin_karma_event_id,
    incurredChapter: row.incurred_chapter,
    debtWeight: row.debt_weight || 50,
    isRepaid: row.is_repaid || false,
    repaymentDescription: row.repayment_description,
    repaymentChapter: row.repayment_chapter,
    isPublicKnowledge: row.is_public_knowledge || false,
    canBeInherited: row.can_be_inherited !== false,
    wasInherited: row.was_inherited || false,
    inheritedFromId: row.inherited_from_id,
  };
}

function mapDbToKarmaRipple(row: any): KarmaRipple {
  return {
    id: row.id,
    novelId: row.novel_id,
    sourceKarmaEventId: row.source_karma_event_id,
    originalActorId: row.original_actor_id,
    originalActorName: row.original_actor_name,
    originalTargetId: row.original_target_id,
    originalTargetName: row.original_target_name,
    affectedCharacterId: row.affected_character_id,
    affectedCharacterName: row.affected_character_name,
    connectionToTarget: row.connection_to_target,
    connectionPath: row.connection_path || [],
    degreesOfSeparation: row.degrees_of_separation,
    sentimentChange: row.sentiment_change || 0,
    becomesThreat: row.becomes_threat || false,
    threatLevel: row.threat_level,
    potentialResponse: row.potential_response || '',
    calculatedAtChapter: row.calculated_at_chapter,
    hasManifested: row.has_manifested || false,
    manifestedChapter: row.manifested_chapter,
    manifestationDescription: row.manifestation_description,
    decayFactor: parseFloat(row.decay_factor) || 1.0,
  };
}

function mapDbToConfig(row: any): FaceGraphConfig {
  return {
    enabled: row.enabled !== false,
    autoCalculateRipples: row.auto_calculate_ripples !== false,
    maxRippleDegrees: row.max_ripple_degrees || 3,
    rippleKarmaThreshold: row.ripple_karma_threshold || 30,
    karmaDecayPerChapter: parseFloat(row.karma_decay_per_chapter) || 0.99,
    autoExtractKarma: row.auto_extract_karma !== false,
    extractionModel: row.extraction_model || 'gemini-2.5-flash',
    protectedCharacterIds: row.protected_character_ids || [],
    faceMultipliers: row.face_multipliers || {},
  };
}

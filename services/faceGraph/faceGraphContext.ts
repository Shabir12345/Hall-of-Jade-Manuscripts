/**
 * Face Graph Context Service
 * 
 * Generates context blocks for chapter generation that include relevant
 * Face Graph information - unresolved karma, active blood feuds, pending debts,
 * and ripple effects that might manifest.
 */

import { supabase } from '../supabaseService';
import { logger } from '../loggingService';
import {
  getAllFaceProfiles,
  getKarmaEventsForCharacter,
  getSocialLinksForCharacter,
  getActiveBloodFeuds,
  getUnpaidDebts,
  getPendingRipples,
  getFaceGraphConfig,
} from './faceGraphService';
import { queryConnectionToWronged } from './rippleAnalyzer';
import type { NovelState, Character } from '../../types';
import type {
  FaceGraphContext,
  FaceProfile,
  KarmaEvent,
  SocialLink,
  BloodFeud,
  FaceDebt,
  KarmaRipple,
} from '../../types/faceGraph';

/**
 * Generate Face Graph context for chapter generation
 */
export async function generateFaceGraphContext(
  novelState: NovelState,
  presentCharacterIds: string[],
  currentChapter: number,
  protagonistId?: string
): Promise<FaceGraphContext> {
  try {
    const config = await getFaceGraphConfig(novelState.id);
    if (!config.enabled) {
      return {
        presentCharacterIds,
        unresolvedKarma: [],
        activeBloodFeuds: [],
        unpaidDebts: [],
        pendingRipples: [],
        formattedContext: '',
      };
    }

    // Get protagonist ID if not provided
    const mcId = protagonistId || novelState.characterCodex.find(c => c.isProtagonist)?.id;

    // Gather all relevant Face Graph data
    const [
      unresolvedKarma,
      bloodFeuds,
      debts,
      ripples,
      npcThreats,
    ] = await Promise.all([
      gatherUnresolvedKarma(novelState.id, presentCharacterIds, mcId),
      getActiveBloodFeuds(novelState.id),
      gatherRelevantDebts(novelState.id, presentCharacterIds),
      getPendingRipples(novelState.id),
      mcId ? gatherNPCThreats(novelState.id, presentCharacterIds, mcId) : Promise.resolve([]),
    ]);

    // Filter blood feuds to those relevant to present characters
    const relevantFeuds = bloodFeuds.filter(feud => 
      presentCharacterIds.some(id => 
        feud.aggrievedMemberIds.includes(id) || 
        feud.targetMemberIds.includes(id) ||
        feud.aggrievedPartyId === id ||
        feud.targetPartyId === id
      )
    );

    // Filter ripples to those that might manifest with present characters
    const relevantRipples = ripples.filter(ripple =>
      presentCharacterIds.includes(ripple.affectedCharacterId) ||
      presentCharacterIds.includes(ripple.originalActorId)
    );

    // Generate formatted context
    const formattedContext = formatFaceGraphContext(
      unresolvedKarma,
      relevantFeuds,
      debts,
      relevantRipples,
      npcThreats,
      currentChapter
    );

    return {
      presentCharacterIds,
      unresolvedKarma,
      activeBloodFeuds: relevantFeuds.map(feud => ({
        feudName: feud.feudName,
        aggrievedPartyName: feud.aggrievedPartyName,
        targetPartyName: feud.targetPartyName,
        intensity: feud.intensity,
        relevantCharacterIds: [
          ...feud.aggrievedMemberIds.filter(id => presentCharacterIds.includes(id)),
          ...feud.targetMemberIds.filter(id => presentCharacterIds.includes(id)),
        ],
      })),
      unpaidDebts: debts.map(debt => ({
        debtorName: debt.debtorName,
        creditorName: debt.creditorName,
        debtType: debt.debtType,
        debtWeight: debt.debtWeight,
        chapterIncurred: debt.incurredChapter,
      })),
      pendingRipples: relevantRipples.map(ripple => ({
        affectedCharacterName: ripple.affectedCharacterName,
        originalTargetName: ripple.originalTargetName,
        potentialResponse: ripple.potentialResponse,
        threatLevel: ripple.threatLevel || 'none',
      })),
      formattedContext,
    };
  } catch (error) {
    logger.error('Error generating Face Graph context', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return {
      presentCharacterIds,
      unresolvedKarma: [],
      activeBloodFeuds: [],
      unpaidDebts: [],
      pendingRipples: [],
      formattedContext: '',
    };
  }
}

/**
 * Gather unresolved karma for characters in the scene
 */
async function gatherUnresolvedKarma(
  novelId: string,
  presentCharacterIds: string[],
  mcId?: string
): Promise<FaceGraphContext['unresolvedKarma']> {
  const unresolvedKarma: FaceGraphContext['unresolvedKarma'] = [];

  for (const characterId of presentCharacterIds) {
    if (characterId === mcId) continue; // Skip MC, we want NPC's feelings toward MC

    // Get karma events where this character was the target (wronged by MC)
    const karmaEvents = await getKarmaEventsForCharacter(novelId, characterId, {
      asTarget: true,
      unsettledOnly: true,
      limit: 5,
    });

    // Filter to karma involving the MC if we have an MC
    const relevantKarma = mcId 
      ? karmaEvents.filter(k => k.actorId === mcId)
      : karmaEvents;

    for (const karma of relevantKarma) {
      // Get social links to determine sentiment
      const links = await getSocialLinksForCharacter(novelId, characterId);
      const linkToActor = links.find(l => 
        l.targetCharacterId === karma.actorId || l.sourceCharacterId === karma.actorId
      );

      unresolvedKarma.push({
        characterId,
        characterName: karma.targetName,
        karmaEventSummary: `${karma.actionType.replace('_', ' ')} (${karma.severity})`,
        chapterOccurred: karma.chapterNumber,
        severity: karma.severity,
        sentimentTowardMC: linkToActor?.sentimentScore ?? 0,
      });
    }
  }

  return unresolvedKarma;
}

/**
 * Gather relevant debts for present characters
 */
async function gatherRelevantDebts(
  novelId: string,
  presentCharacterIds: string[]
): Promise<FaceDebt[]> {
  const allDebts: FaceDebt[] = [];

  for (const characterId of presentCharacterIds) {
    // Get debts where this character is debtor
    const asDebtor = await getUnpaidDebts(novelId, characterId, true);
    // Get debts where this character is creditor
    const asCreditor = await getUnpaidDebts(novelId, characterId, false);

    // Filter to only include debts involving present characters
    const relevantDebtor = asDebtor.filter(d => presentCharacterIds.includes(d.creditorId));
    const relevantCreditor = asCreditor.filter(d => presentCharacterIds.includes(d.debtorId));

    allDebts.push(...relevantDebtor, ...relevantCreditor);
  }

  // Remove duplicates
  const uniqueDebts = allDebts.filter((debt, index, self) =>
    index === self.findIndex(d => d.id === debt.id)
  );

  return uniqueDebts;
}

/**
 * Gather NPC threats based on their connections to wronged characters
 */
async function gatherNPCThreats(
  novelId: string,
  presentCharacterIds: string[],
  mcId: string
): Promise<Array<{
  npcId: string;
  npcName: string;
  threatLevel: string;
  reasons: string[];
}>> {
  const threats: Array<{
    npcId: string;
    npcName: string;
    threatLevel: string;
    reasons: string[];
  }> = [];

  for (const npcId of presentCharacterIds) {
    if (npcId === mcId) continue;

    const connectionQuery = await queryConnectionToWronged(novelId, npcId, mcId);
    
    if (connectionQuery.calculatedThreatLevel !== 'none') {
      threats.push({
        npcId: connectionQuery.npcId,
        npcName: connectionQuery.npcName,
        threatLevel: connectionQuery.calculatedThreatLevel,
        reasons: connectionQuery.threatReasons,
      });
    }
  }

  return threats;
}

/**
 * Format all Face Graph data into a context block for AI
 */
function formatFaceGraphContext(
  unresolvedKarma: FaceGraphContext['unresolvedKarma'],
  bloodFeuds: BloodFeud[],
  debts: FaceDebt[],
  ripples: KarmaRipple[],
  npcThreats: Array<{ npcId: string; npcName: string; threatLevel: string; reasons: string[] }>,
  currentChapter: number
): string {
  const sections: string[] = [];

  // Section: Unresolved Karma (NPC Grudges)
  if (unresolvedKarma.length > 0) {
    const karmaSection = ['## UNRESOLVED KARMA (NPC Grudges Against MC)'];
    karmaSection.push('These characters have been wronged by the MC and the debt is not yet settled:');
    karmaSection.push('');

    for (const karma of unresolvedKarma) {
      const chaptersSince = currentChapter - karma.chapterOccurred;
      const sentimentDesc = getSentimentDescription(karma.sentimentTowardMC);
      
      karmaSection.push(`- **${karma.characterName}**: ${karma.karmaEventSummary}`);
      karmaSection.push(`  - Occurred: Chapter ${karma.chapterOccurred} (${chaptersSince} chapters ago)`);
      karmaSection.push(`  - Severity: ${karma.severity}`);
      karmaSection.push(`  - Current sentiment toward MC: ${sentimentDesc}`);
      karmaSection.push(`  - *This character may seek revenge, refuse to help, or work against the MC*`);
      karmaSection.push('');
    }

    sections.push(karmaSection.join('\n'));
  }

  // Section: Active Blood Feuds
  if (bloodFeuds.length > 0) {
    const feudSection = ['## ACTIVE BLOOD FEUDS'];
    feudSection.push('Ongoing vendettas that affect character interactions:');
    feudSection.push('');

    for (const feud of bloodFeuds) {
      const intensityDesc = getIntensityDescription(feud.intensity);
      
      feudSection.push(`### ${feud.feudName}`);
      feudSection.push(`- **Aggrieved Party**: ${feud.aggrievedPartyName}`);
      feudSection.push(`- **Target of Vengeance**: ${feud.targetPartyName}`);
      feudSection.push(`- **Cause**: ${feud.originalCause}`);
      feudSection.push(`- **Intensity**: ${intensityDesc} (${feud.intensity}/100)`);
      feudSection.push(`- *Characters from these factions will be hostile to each other*`);
      feudSection.push('');
    }

    sections.push(feudSection.join('\n'));
  }

  // Section: Unpaid Debts
  if (debts.length > 0) {
    const debtSection = ['## UNPAID DEBTS (Favors Owed)'];
    debtSection.push('Life debts and favors that characters may call upon:');
    debtSection.push('');

    for (const debt of debts) {
      const chaptersSince = currentChapter - debt.incurredChapter;
      
      debtSection.push(`- **${debt.debtorName}** owes **${debt.creditorName}**`);
      debtSection.push(`  - Type: ${debt.debtType.replace('_', ' ')}`);
      debtSection.push(`  - Weight: ${getDebtWeightDescription(debt.debtWeight)}`);
      debtSection.push(`  - Since: Chapter ${debt.incurredChapter} (${chaptersSince} chapters ago)`);
      debtSection.push(`  - *The creditor may call in this favor at any time*`);
      debtSection.push('');
    }

    sections.push(debtSection.join('\n'));
  }

  // Section: Pending Ripple Effects
  if (ripples.length > 0) {
    const rippleSection = ['## PENDING CONSEQUENCES'];
    rippleSection.push('Ripple effects from past actions that may manifest:');
    rippleSection.push('');

    for (const ripple of ripples) {
      if (ripple.becomesThreat) {
        rippleSection.push(`- **${ripple.affectedCharacterName}** (connected to ${ripple.originalTargetName})`);
        rippleSection.push(`  - Threat Level: ${ripple.threatLevel || 'unknown'}`);
        rippleSection.push(`  - Potential Response: ${ripple.potentialResponse}`);
        rippleSection.push(`  - *This NPC may become hostile or take action against the MC*`);
        rippleSection.push('');
      }
    }

    sections.push(rippleSection.join('\n'));
  }

  // Section: NPC Threat Assessment
  if (npcThreats.length > 0) {
    const threatSection = ['## NPC THREAT ASSESSMENT'];
    threatSection.push('Characters in this scene who have reason to oppose the MC:');
    threatSection.push('');

    for (const threat of npcThreats) {
      threatSection.push(`- **${threat.npcName}**: ${threat.threatLevel.toUpperCase()} THREAT`);
      for (const reason of threat.reasons) {
        threatSection.push(`  - ${reason}`);
      }
      threatSection.push('');
    }

    sections.push(threatSection.join('\n'));
  }

  // Combine all sections
  if (sections.length === 0) {
    return '';
  }

  return [
    '# FACE GRAPH CONTEXT (Social Network Memory)',
    '',
    'The following information tracks the "Face" (social standing) and karmic relationships',
    'in the cultivation world. Use this to make NPC reactions authentic and consistent.',
    '',
    ...sections,
    '---',
    'IMPORTANT: NPCs should react based on their relationship history with the MC.',
    'A character who was wronged should not suddenly be friendly without resolution.',
    'Blood feuds and debts are serious matters in the cultivation world.',
    '---',
  ].join('\n');
}

/**
 * Get sentiment description from score
 */
function getSentimentDescription(score: number): string {
  if (score <= -80) return 'Murderous hatred';
  if (score <= -60) return 'Deep hostility';
  if (score <= -40) return 'Strong resentment';
  if (score <= -20) return 'Cold and unfriendly';
  if (score < 0) return 'Slightly negative';
  if (score === 0) return 'Neutral';
  if (score <= 20) return 'Slightly positive';
  if (score <= 40) return 'Friendly';
  if (score <= 60) return 'Warm and trusting';
  if (score <= 80) return 'Strong affection';
  return 'Devoted loyalty';
}

/**
 * Get intensity description for blood feuds
 */
function getIntensityDescription(intensity: number): string {
  if (intensity >= 90) return 'War-level hostility - violence is imminent';
  if (intensity >= 70) return 'Active pursuit of vengeance';
  if (intensity >= 50) return 'Open hostility';
  if (intensity >= 30) return 'Simmering resentment';
  return 'Low-level grudge';
}

/**
 * Get debt weight description
 */
function getDebtWeightDescription(weight: number): string {
  if (weight >= 90) return 'Life debt - must be repaid at any cost';
  if (weight >= 70) return 'Major favor - significant sacrifice expected';
  if (weight >= 50) return 'Notable debt - meaningful repayment needed';
  if (weight >= 30) return 'Minor favor - can be repaid with assistance';
  return 'Small courtesy - easily settled';
}

/**
 * Get a quick summary of Face Graph status for a character
 */
export async function getCharacterFaceGraphSummary(
  novelId: string,
  characterId: string
): Promise<{
  faceProfile: FaceProfile | null;
  unresolvedKarmaCount: number;
  activeThreats: number;
  pendingDebts: number;
  bloodFeudsInvolved: number;
}> {
  try {
    const [
      { data: profile },
      karmaEvents,
      bloodFeuds,
      debtsAsDebtor,
      debtsAsCreditor,
    ] = await Promise.all([
      supabase.from('face_profiles').select('*').eq('novel_id', novelId).eq('character_id', characterId).single(),
      getKarmaEventsForCharacter(novelId, characterId, { unsettledOnly: true }),
      getActiveBloodFeuds(novelId),
      getUnpaidDebts(novelId, characterId, true),
      getUnpaidDebts(novelId, characterId, false),
    ]);

    const involvedFeuds = bloodFeuds.filter(feud =>
      feud.aggrievedMemberIds.includes(characterId) ||
      feud.targetMemberIds.includes(characterId) ||
      feud.aggrievedPartyId === characterId ||
      feud.targetPartyId === characterId
    );

    return {
      faceProfile: profile ? {
        id: profile.id,
        novelId: profile.novel_id,
        characterId: profile.character_id,
        characterName: profile.character_name,
        totalFace: profile.total_face,
        tier: profile.tier,
        faceByCategory: {
          martial: profile.face_martial,
          scholarly: profile.face_scholarly,
          political: profile.face_political,
          moral: profile.face_moral,
          mysterious: profile.face_mysterious,
          wealth: profile.face_wealth,
        },
        karmaBalance: profile.karma_balance,
        positiveKarmaTotal: profile.positive_karma_total,
        negativeKarmaTotal: profile.negative_karma_total,
        titles: [],
        accomplishments: [],
        shames: [],
        firstAppearedChapter: profile.first_appeared_chapter,
        lastUpdatedChapter: profile.last_updated_chapter,
        isProtected: profile.is_protected,
        createdAt: new Date(profile.created_at).getTime(),
        updatedAt: new Date(profile.updated_at).getTime(),
      } : null,
      unresolvedKarmaCount: karmaEvents.length,
      activeThreats: karmaEvents.filter(k => k.polarity === 'negative').length,
      pendingDebts: debtsAsDebtor.length + debtsAsCreditor.length,
      bloodFeudsInvolved: involvedFeuds.length,
    };
  } catch (error) {
    logger.error('Error getting character Face Graph summary', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return {
      faceProfile: null,
      unresolvedKarmaCount: 0,
      activeThreats: 0,
      pendingDebts: 0,
      bloodFeudsInvolved: 0,
    };
  }
}

/**
 * Generate context specifically for a confrontation between two characters
 */
export async function generateConfrontationContext(
  novelId: string,
  character1Id: string,
  character2Id: string
): Promise<string> {
  try {
    // Get karma history between the two characters
    const { data: karmaHistory } = await supabase
      .from('karma_events')
      .select('*')
      .eq('novel_id', novelId)
      .or(`and(actor_id.eq.${character1Id},target_id.eq.${character2Id}),and(actor_id.eq.${character2Id},target_id.eq.${character1Id})`)
      .order('chapter_number', { ascending: true });

    // Get social links between them
    const { data: links } = await supabase
      .from('social_links')
      .select('*')
      .eq('novel_id', novelId)
      .or(`and(source_character_id.eq.${character1Id},target_character_id.eq.${character2Id}),and(source_character_id.eq.${character2Id},target_character_id.eq.${character1Id})`);

    // Get Face profiles
    const [{ data: profile1 }, { data: profile2 }] = await Promise.all([
      supabase.from('face_profiles').select('*').eq('novel_id', novelId).eq('character_id', character1Id).single(),
      supabase.from('face_profiles').select('*').eq('novel_id', novelId).eq('character_id', character2Id).single(),
    ]);

    const sections: string[] = [];

    sections.push('# CONFRONTATION CONTEXT');
    sections.push('');

    // Face comparison
    if (profile1 && profile2) {
      sections.push('## FACE STANDINGS');
      sections.push(`- **${profile1.character_name}**: ${profile1.total_face} Face (${profile1.tier})`);
      sections.push(`- **${profile2.character_name}**: ${profile2.total_face} Face (${profile2.tier})`);
      
      if (profile1.total_face > profile2.total_face * 2) {
        sections.push(`*${profile1.character_name} significantly outranks ${profile2.character_name} in social standing*`);
      } else if (profile2.total_face > profile1.total_face * 2) {
        sections.push(`*${profile2.character_name} significantly outranks ${profile1.character_name} in social standing*`);
      }
      sections.push('');
    }

    // Relationship history
    if (links && links.length > 0) {
      sections.push('## RELATIONSHIP');
      for (const link of links) {
        sections.push(`- **${link.source_character_name}** sees **${link.target_character_name}** as: ${link.link_type}`);
        sections.push(`  - Sentiment: ${getSentimentDescription(link.sentiment_score)} (${link.sentiment_score})`);
        sections.push(`  - Unsettled karma: ${link.unsettled_karma}`);
      }
      sections.push('');
    }

    // Karma history
    if (karmaHistory && karmaHistory.length > 0) {
      sections.push('## KARMIC HISTORY');
      sections.push('Events that have occurred between these characters:');
      sections.push('');
      
      for (const karma of karmaHistory) {
        const isSettled = karma.is_settled ? '(SETTLED)' : '(UNRESOLVED)';
        sections.push(`- Chapter ${karma.chapter_number}: **${karma.actor_name}** ${karma.action_type.replace('_', ' ')} **${karma.target_name}** ${isSettled}`);
        if (karma.description) {
          sections.push(`  - ${karma.description}`);
        }
      }
      sections.push('');
    }

    // Calculate overall tension
    const totalUnsettledKarma = (karmaHistory || [])
      .filter(k => !k.is_settled)
      .reduce((sum, k) => sum + k.final_karma_weight, 0);

    if (totalUnsettledKarma > 0) {
      sections.push('## TENSION LEVEL');
      if (totalUnsettledKarma >= 100) {
        sections.push('**EXTREME**: Blood feud level animosity. Violence is likely.');
      } else if (totalUnsettledKarma >= 60) {
        sections.push('**HIGH**: Significant bad blood. Confrontation will be hostile.');
      } else if (totalUnsettledKarma >= 30) {
        sections.push('**MODERATE**: Notable tension. Conversation will be strained.');
      } else {
        sections.push('**LOW**: Some history but manageable. May be civil.');
      }
      sections.push('');
    }

    return sections.join('\n');
  } catch (error) {
    logger.error('Error generating confrontation context', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return '';
  }
}

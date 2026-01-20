/**
 * Social Network Queries
 * 
 * Advanced graph queries for the Face Graph system.
 * These queries help answer questions like:
 * - "Who are the most influential characters?"
 * - "Which sects are allied/enemies?"
 * - "What is the shortest path between two characters?"
 */

import { supabase } from '../supabaseService';
import { logger } from '../loggingService';
import { getAllSocialLinks, getAllFaceProfiles, getActiveBloodFeuds } from './faceGraphService';
import type { SocialLink, FaceProfile, BloodFeud, SocialLinkType } from '../../types/faceGraph';

/**
 * Find the most influential characters by social network analysis
 */
export async function findMostInfluentialCharacters(
  novelId: string,
  limit: number = 10
): Promise<Array<{
  characterId: string;
  characterName: string;
  totalFace: number;
  connectionCount: number;
  influenceScore: number;
  strongConnections: number;
}>> {
  try {
    const [links, profiles] = await Promise.all([
      getAllSocialLinks(novelId),
      getAllFaceProfiles(novelId),
    ]);

    // Build connection map
    const connectionMap = new Map<string, {
      name: string;
      connections: number;
      strongConnections: number;
    }>();

    for (const link of links) {
      // Count connections for source
      if (!connectionMap.has(link.sourceCharacterId)) {
        connectionMap.set(link.sourceCharacterId, {
          name: link.sourceCharacterName,
          connections: 0,
          strongConnections: 0,
        });
      }
      const sourceData = connectionMap.get(link.sourceCharacterId)!;
      sourceData.connections++;
      if (link.strength === 'strong' || link.strength === 'unbreakable') {
        sourceData.strongConnections++;
      }
    }

    // Calculate influence score for each character
    const influenceScores: Array<{
      characterId: string;
      characterName: string;
      totalFace: number;
      connectionCount: number;
      influenceScore: number;
      strongConnections: number;
    }> = [];

    for (const profile of profiles) {
      const connectionData = connectionMap.get(profile.characterId) || {
        name: profile.characterName,
        connections: 0,
        strongConnections: 0,
      };

      // Influence = Face + (connections * 50) + (strong connections * 100)
      const influenceScore = 
        profile.totalFace + 
        (connectionData.connections * 50) + 
        (connectionData.strongConnections * 100);

      influenceScores.push({
        characterId: profile.characterId,
        characterName: profile.characterName,
        totalFace: profile.totalFace,
        connectionCount: connectionData.connections,
        influenceScore,
        strongConnections: connectionData.strongConnections,
      });
    }

    // Sort by influence score
    influenceScores.sort((a, b) => b.influenceScore - a.influenceScore);

    return influenceScores.slice(0, limit);
  } catch (error) {
    logger.error('Error finding influential characters', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Find shortest path between two characters through social network
 */
export async function findShortestPath(
  novelId: string,
  startCharacterId: string,
  endCharacterId: string,
  maxDepth: number = 6
): Promise<{
  found: boolean;
  path: Array<{
    characterId: string;
    characterName: string;
    linkType?: SocialLinkType;
  }>;
  pathLength: number;
} | null> {
  try {
    const links = await getAllSocialLinks(novelId);
    
    // Build adjacency map
    const adjacencyMap = new Map<string, Array<{
      targetId: string;
      targetName: string;
      linkType: SocialLinkType;
    }>>();

    for (const link of links) {
      // Add bidirectional edges
      if (!adjacencyMap.has(link.sourceCharacterId)) {
        adjacencyMap.set(link.sourceCharacterId, []);
      }
      adjacencyMap.get(link.sourceCharacterId)!.push({
        targetId: link.targetCharacterId,
        targetName: link.targetCharacterName,
        linkType: link.linkType,
      });

      if (!adjacencyMap.has(link.targetCharacterId)) {
        adjacencyMap.set(link.targetCharacterId, []);
      }
      adjacencyMap.get(link.targetCharacterId)!.push({
        targetId: link.sourceCharacterId,
        targetName: link.sourceCharacterName,
        linkType: link.linkType,
      });
    }

    // BFS to find shortest path
    const visited = new Set<string>();
    const queue: Array<{
      id: string;
      name: string;
      path: Array<{ characterId: string; characterName: string; linkType?: SocialLinkType }>;
    }> = [];

    // Get start character name
    const startLinks = adjacencyMap.get(startCharacterId);
    const startName = startLinks?.[0]?.targetName || 'Unknown';

    visited.add(startCharacterId);
    queue.push({
      id: startCharacterId,
      name: startName,
      path: [{ characterId: startCharacterId, characterName: startName }],
    });

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.path.length > maxDepth) continue;

      const neighbors = adjacencyMap.get(current.id) || [];
      for (const neighbor of neighbors) {
        if (neighbor.targetId === endCharacterId) {
          const finalPath = [
            ...current.path,
            { characterId: neighbor.targetId, characterName: neighbor.targetName, linkType: neighbor.linkType },
          ];
          return {
            found: true,
            path: finalPath,
            pathLength: finalPath.length - 1,
          };
        }

        if (!visited.has(neighbor.targetId)) {
          visited.add(neighbor.targetId);
          queue.push({
            id: neighbor.targetId,
            name: neighbor.targetName,
            path: [
              ...current.path,
              { characterId: neighbor.targetId, characterName: neighbor.targetName, linkType: neighbor.linkType },
            ],
          });
        }
      }
    }

    return {
      found: false,
      path: [],
      pathLength: -1,
    };
  } catch (error) {
    logger.error('Error finding shortest path', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Detect social clusters/communities in the network
 */
export async function detectSocialClusters(
  novelId: string
): Promise<Array<{
  clusterId: number;
  members: Array<{ characterId: string; characterName: string }>;
  dominantLinkTypes: SocialLinkType[];
  averageSentiment: number;
}>> {
  try {
    const links = await getAllSocialLinks(novelId);
    
    // Build adjacency map with only positive sentiment links
    const adjacencyMap = new Map<string, Set<string>>();
    const nameMap = new Map<string, string>();
    const linkTypes = new Map<string, SocialLinkType[]>();

    for (const link of links) {
      if (link.sentimentScore >= 0) { // Only consider non-hostile links for clustering
        // Add bidirectional edges
        if (!adjacencyMap.has(link.sourceCharacterId)) {
          adjacencyMap.set(link.sourceCharacterId, new Set());
          nameMap.set(link.sourceCharacterId, link.sourceCharacterName);
          linkTypes.set(link.sourceCharacterId, []);
        }
        adjacencyMap.get(link.sourceCharacterId)!.add(link.targetCharacterId);
        linkTypes.get(link.sourceCharacterId)!.push(link.linkType);

        if (!adjacencyMap.has(link.targetCharacterId)) {
          adjacencyMap.set(link.targetCharacterId, new Set());
          nameMap.set(link.targetCharacterId, link.targetCharacterName);
          linkTypes.set(link.targetCharacterId, []);
        }
        adjacencyMap.get(link.targetCharacterId)!.add(link.sourceCharacterId);
        linkTypes.get(link.targetCharacterId)!.push(link.linkType);
      }
    }

    // Find connected components using DFS
    const visited = new Set<string>();
    const clusters: Array<{
      clusterId: number;
      members: Array<{ characterId: string; characterName: string }>;
      dominantLinkTypes: SocialLinkType[];
      averageSentiment: number;
    }> = [];
    let clusterId = 0;

    for (const characterId of adjacencyMap.keys()) {
      if (visited.has(characterId)) continue;

      const cluster: string[] = [];
      const stack = [characterId];
      const clusterLinkTypes: SocialLinkType[] = [];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        
        visited.add(current);
        cluster.push(current);
        clusterLinkTypes.push(...(linkTypes.get(current) || []));

        const neighbors = adjacencyMap.get(current) || new Set();
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }

      if (cluster.length > 1) {
        // Calculate average sentiment for cluster
        let totalSentiment = 0;
        let sentimentCount = 0;
        for (const link of links) {
          if (cluster.includes(link.sourceCharacterId) && cluster.includes(link.targetCharacterId)) {
            totalSentiment += link.sentimentScore;
            sentimentCount++;
          }
        }

        // Find dominant link types
        const typeCounts = new Map<SocialLinkType, number>();
        for (const lt of clusterLinkTypes) {
          typeCounts.set(lt, (typeCounts.get(lt) || 0) + 1);
        }
        const sortedTypes = Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([type]) => type);

        clusters.push({
          clusterId: clusterId++,
          members: cluster.map(id => ({
            characterId: id,
            characterName: nameMap.get(id) || 'Unknown',
          })),
          dominantLinkTypes: sortedTypes,
          averageSentiment: sentimentCount > 0 ? Math.round(totalSentiment / sentimentCount) : 0,
        });
      }
    }

    // Sort by cluster size
    clusters.sort((a, b) => b.members.length - a.members.length);

    return clusters;
  } catch (error) {
    logger.error('Error detecting social clusters', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Find all enemies of a character (direct and through blood feuds)
 */
export async function findAllEnemies(
  novelId: string,
  characterId: string
): Promise<Array<{
  enemyId: string;
  enemyName: string;
  reason: 'direct_link' | 'blood_feud' | 'karma';
  intensity: number;
  details: string;
}>> {
  try {
    const [links, feuds, karmaEvents] = await Promise.all([
      getAllSocialLinks(novelId),
      getActiveBloodFeuds(novelId),
      supabase
        .from('karma_events')
        .select('*')
        .eq('novel_id', novelId)
        .or(`actor_id.eq.${characterId},target_id.eq.${characterId}`)
        .eq('polarity', 'negative')
        .eq('is_settled', false),
    ]);

    const enemies: Array<{
      enemyId: string;
      enemyName: string;
      reason: 'direct_link' | 'blood_feud' | 'karma';
      intensity: number;
      details: string;
    }> = [];

    const addedEnemyIds = new Set<string>();

    // Direct enemy links
    for (const link of links) {
      if (link.sourceCharacterId === characterId && 
          ['enemy', 'nemesis', 'blood_feud_target'].includes(link.linkType)) {
        if (!addedEnemyIds.has(link.targetCharacterId)) {
          addedEnemyIds.add(link.targetCharacterId);
          enemies.push({
            enemyId: link.targetCharacterId,
            enemyName: link.targetCharacterName,
            reason: 'direct_link',
            intensity: Math.abs(link.sentimentScore),
            details: `${link.linkType} relationship`,
          });
        }
      }
      if (link.targetCharacterId === characterId && 
          ['enemy', 'nemesis', 'blood_feud_hunter'].includes(link.linkType)) {
        if (!addedEnemyIds.has(link.sourceCharacterId)) {
          addedEnemyIds.add(link.sourceCharacterId);
          enemies.push({
            enemyId: link.sourceCharacterId,
            enemyName: link.sourceCharacterName,
            reason: 'direct_link',
            intensity: Math.abs(link.sentimentScore),
            details: `Sees character as ${link.linkType}`,
          });
        }
      }
    }

    // Blood feud enemies
    for (const feud of feuds) {
      if (feud.aggrievedMemberIds.includes(characterId) || feud.aggrievedPartyId === characterId) {
        // Character is aggrieved, target party members are enemies
        for (const targetId of feud.targetMemberIds) {
          if (!addedEnemyIds.has(targetId)) {
            addedEnemyIds.add(targetId);
            // Get name from links
            const nameLink = links.find(l => 
              l.sourceCharacterId === targetId || l.targetCharacterId === targetId
            );
            enemies.push({
              enemyId: targetId,
              enemyName: nameLink?.sourceCharacterId === targetId 
                ? nameLink.sourceCharacterName 
                : nameLink?.targetCharacterName || 'Unknown',
              reason: 'blood_feud',
              intensity: feud.intensity,
              details: `Blood feud: ${feud.feudName}`,
            });
          }
        }
      }
      if (feud.targetMemberIds.includes(characterId) || feud.targetPartyId === characterId) {
        // Character is target, aggrieved party members are enemies
        for (const aggrievedId of feud.aggrievedMemberIds) {
          if (!addedEnemyIds.has(aggrievedId)) {
            addedEnemyIds.add(aggrievedId);
            const nameLink = links.find(l => 
              l.sourceCharacterId === aggrievedId || l.targetCharacterId === aggrievedId
            );
            enemies.push({
              enemyId: aggrievedId,
              enemyName: nameLink?.sourceCharacterId === aggrievedId 
                ? nameLink.sourceCharacterName 
                : nameLink?.targetCharacterName || 'Unknown',
              reason: 'blood_feud',
              intensity: feud.intensity,
              details: `Seeks vengeance: ${feud.feudName}`,
            });
          }
        }
      }
    }

    // Karma-based enemies (people character has wronged who haven't forgiven)
    if (karmaEvents.data) {
      for (const event of karmaEvents.data) {
        // If character was the actor, target might be enemy
        if (event.actor_id === characterId && !addedEnemyIds.has(event.target_id)) {
          addedEnemyIds.add(event.target_id);
          enemies.push({
            enemyId: event.target_id,
            enemyName: event.target_name,
            reason: 'karma',
            intensity: event.final_karma_weight,
            details: `Unresolved: ${event.action_type.replace('_', ' ')} in chapter ${event.chapter_number}`,
          });
        }
      }
    }

    // Sort by intensity
    enemies.sort((a, b) => b.intensity - a.intensity);

    return enemies;
  } catch (error) {
    logger.error('Error finding enemies', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Find all allies of a character
 */
export async function findAllAllies(
  novelId: string,
  characterId: string
): Promise<Array<{
  allyId: string;
  allyName: string;
  linkType: SocialLinkType;
  strength: string;
  sentiment: number;
}>> {
  try {
    const links = await getAllSocialLinks(novelId);
    const allies: Array<{
      allyId: string;
      allyName: string;
      linkType: SocialLinkType;
      strength: string;
      sentiment: number;
    }> = [];

    const allyLinkTypes: SocialLinkType[] = [
      'friend', 'ally', 'spouse', 'dao_companion', 
      'master', 'disciple', 'martial_brother', 'martial_sister',
      'faction_ally', 'protector', 'protected', 'benefactor',
      'clan_elder', 'clan_member', 'sect_leader', 'sect_member', 'sect_elder',
    ];

    const addedAllyIds = new Set<string>();

    for (const link of links) {
      // Check if character is source
      if (link.sourceCharacterId === characterId && 
          allyLinkTypes.includes(link.linkType) &&
          link.sentimentScore >= 0) {
        if (!addedAllyIds.has(link.targetCharacterId)) {
          addedAllyIds.add(link.targetCharacterId);
          allies.push({
            allyId: link.targetCharacterId,
            allyName: link.targetCharacterName,
            linkType: link.linkType,
            strength: link.strength,
            sentiment: link.sentimentScore,
          });
        }
      }
      // Check if character is target
      if (link.targetCharacterId === characterId && 
          allyLinkTypes.includes(link.linkType) &&
          link.sentimentScore >= 0) {
        if (!addedAllyIds.has(link.sourceCharacterId)) {
          addedAllyIds.add(link.sourceCharacterId);
          allies.push({
            allyId: link.sourceCharacterId,
            allyName: link.sourceCharacterName,
            linkType: link.linkType,
            strength: link.strength,
            sentiment: link.sentimentScore,
          });
        }
      }
    }

    // Sort by sentiment
    allies.sort((a, b) => b.sentiment - a.sentiment);

    return allies;
  } catch (error) {
    logger.error('Error finding allies', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/**
 * Get network statistics for a novel
 */
export async function getNetworkStatistics(
  novelId: string
): Promise<{
  totalNodes: number;
  totalEdges: number;
  averageConnectionsPerNode: number;
  mostConnectedCharacter: { id: string; name: string; connections: number } | null;
  totalPositiveKarma: number;
  totalNegativeKarma: number;
  activeBloodFeuds: number;
  pendingDebts: number;
}> {
  try {
    const [
      links,
      profiles,
      feuds,
      { data: debts },
      { data: karmaStats },
    ] = await Promise.all([
      getAllSocialLinks(novelId),
      getAllFaceProfiles(novelId),
      getActiveBloodFeuds(novelId),
      supabase.from('face_debts').select('id').eq('novel_id', novelId).eq('is_repaid', false),
      supabase.from('karma_events').select('polarity, final_karma_weight').eq('novel_id', novelId),
    ]);

    // Calculate connections per node
    const connectionCounts = new Map<string, { name: string; count: number }>();
    for (const link of links) {
      if (!connectionCounts.has(link.sourceCharacterId)) {
        connectionCounts.set(link.sourceCharacterId, { name: link.sourceCharacterName, count: 0 });
      }
      connectionCounts.get(link.sourceCharacterId)!.count++;
    }

    // Find most connected
    let mostConnected: { id: string; name: string; connections: number } | null = null;
    for (const [id, data] of connectionCounts.entries()) {
      if (!mostConnected || data.count > mostConnected.connections) {
        mostConnected = { id, name: data.name, connections: data.count };
      }
    }

    // Calculate karma totals
    let totalPositiveKarma = 0;
    let totalNegativeKarma = 0;
    if (karmaStats) {
      for (const event of karmaStats) {
        if (event.polarity === 'positive') {
          totalPositiveKarma += event.final_karma_weight;
        } else if (event.polarity === 'negative') {
          totalNegativeKarma += event.final_karma_weight;
        }
      }
    }

    return {
      totalNodes: profiles.length,
      totalEdges: links.length,
      averageConnectionsPerNode: profiles.length > 0 
        ? Math.round((links.length / profiles.length) * 10) / 10 
        : 0,
      mostConnectedCharacter: mostConnected,
      totalPositiveKarma,
      totalNegativeKarma,
      activeBloodFeuds: feuds.length,
      pendingDebts: debts?.length || 0,
    };
  } catch (error) {
    logger.error('Error getting network statistics', 'faceGraph', error instanceof Error ? error : new Error(String(error)));
    return {
      totalNodes: 0,
      totalEdges: 0,
      averageConnectionsPerNode: 0,
      mostConnectedCharacter: null,
      totalPositiveKarma: 0,
      totalNegativeKarma: 0,
      activeBloodFeuds: 0,
      pendingDebts: 0,
    };
  }
}

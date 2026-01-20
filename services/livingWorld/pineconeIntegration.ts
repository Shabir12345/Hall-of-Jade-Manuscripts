/**
 * Living World Pinecone Integration
 * 
 * Integrates the Living World system with Pinecone vector database for:
 * - Smarter entity querying based on semantic similarity
 * - Storage of world events for retrieval
 * - Finding related entities for event generation
 */

import { NovelState } from '../../types';
import {
  GlobalWorldEvent,
  SimulationEntitySnapshot,
  WorldStateSnapshot,
} from '../../types/livingWorld';
import {
  isPineconeReady,
  queryByText,
  upsertVectors,
  PineconeQueryMatch,
} from '../vectorDb/pineconeService';
import { generateEmbedding, isEmbeddingServiceAvailable } from '../vectorDb/embeddingService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

/**
 * Metadata schema for world event vectors
 */
interface WorldEventMetadata {
  type: 'world_event';
  eventId: string;
  eventType: string;
  novelId: string;
  summary: string;
  affectedEntities: string;
  urgency: string;
  impact: string;
  isDiscovered: boolean;
  generatedAtChapter: number;
  createdAt: number;
}

/**
 * Check if Pinecone integration is available for Living World
 */
export async function isLivingWorldPineconeReady(): Promise<boolean> {
  const pineconeReady = await isPineconeReady();
  const embeddingReady = isEmbeddingServiceAvailable();
  
  return pineconeReady && embeddingReady;
}

/**
 * Query Pinecone for entities related to a simulation context
 */
export async function queryRelatedEntities(
  novelId: string,
  context: string,
  options: {
    topK?: number;
    entityTypes?: string[];
    minScore?: number;
  } = {}
): Promise<{
  entities: Array<{
    id: string;
    name: string;
    type: string;
    score: number;
    content: string;
  }>;
  queryUsed: string;
}> {
  const {
    topK = 15,
    entityTypes = ['character', 'world_entry', 'territory', 'antagonist'],
    minScore = 0.5,
  } = options;

  if (!(await isLivingWorldPineconeReady())) {
    logger.debug('Pinecone not ready for Living World query', 'livingWorld');
    return { entities: [], queryUsed: context };
  }

  try {
    // Build filter for entity types
    const filter = entityTypes.length > 0
      ? { type: { $in: entityTypes } }
      : undefined;

    const result = await queryByText(novelId, context, {
      topK,
      filter,
      includeMetadata: true,
    });

    if (!result || !result.matches) {
      return { entities: [], queryUsed: context };
    }

    const entities = result.matches
      .filter(match => match.score >= minScore)
      .map(match => ({
        id: match.id,
        name: match.metadata?.name || match.metadata?.title || 'Unknown',
        type: match.metadata?.type || 'unknown',
        score: match.score,
        content: match.metadata?.content || match.metadata?.description || '',
      }));

    logger.debug('Queried related entities for Living World', 'livingWorld', {
      queryLength: context.length,
      matchCount: entities.length,
    });

    return { entities, queryUsed: context };
  } catch (error) {
    logger.warn('Failed to query Pinecone for Living World', 'livingWorld', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { entities: [], queryUsed: context };
  }
}

/**
 * Get entities most likely to be involved in world events
 */
export async function getSimulationCandidates(
  novelId: string,
  worldState: WorldStateSnapshot,
  options: {
    maxCandidates?: number;
    includeConflictParties?: boolean;
  } = {}
): Promise<SimulationEntitySnapshot[]> {
  const {
    maxCandidates = 20,
    includeConflictParties = true,
  } = options;

  if (!(await isLivingWorldPineconeReady())) {
    // Fall back to existing entities in worldState
    return worldState.entities.slice(0, maxCandidates);
  }

  try {
    // Build context query from world state
    const contextParts: string[] = [];
    
    // Add current realm context
    contextParts.push(`Current realm: ${worldState.currentRealm}`);
    
    // Add ongoing conflicts
    if (includeConflictParties && worldState.ongoingConflicts.length > 0) {
      contextParts.push('Active conflicts:');
      for (const conflict of worldState.ongoingConflicts) {
        contextParts.push(`- ${conflict.name}: ${conflict.parties.join(' vs ')}`);
      }
    }
    
    // Add recent events for context
    if (worldState.recentMajorEvents.length > 0) {
      contextParts.push('Recent events: ' + worldState.recentMajorEvents.slice(0, 3).join('; '));
    }
    
    // Add tension context
    contextParts.push(`World tension: ${worldState.worldTensionLevel}/100`);
    
    const contextQuery = contextParts.join('\n');
    
    // Query for relevant entities
    const { entities } = await queryRelatedEntities(novelId, contextQuery, {
      topK: maxCandidates,
      entityTypes: ['character', 'world_entry', 'territory', 'antagonist'],
      minScore: 0.4,
    });
    
    // Convert to SimulationEntitySnapshot format
    const candidates: SimulationEntitySnapshot[] = entities.map(entity => {
      // Find existing entity in worldState for additional info
      const existing = worldState.entities.find(e => e.id === entity.id);
      
      return {
        id: entity.id,
        name: entity.name,
        type: mapEntityType(entity.type),
        powerLevel: existing?.powerLevel || extractPowerLevel(entity.content),
        status: existing?.status || 'active',
        relationships: existing?.relationships || [],
        activeConflicts: existing?.activeConflicts || [],
        recentEvents: existing?.recentEvents || [],
        isProtected: existing?.isProtected || false,
      };
    });
    
    // Merge with existing entities not found in query
    const existingIds = new Set(candidates.map(c => c.id));
    const additionalEntities = worldState.entities
      .filter(e => !existingIds.has(e.id))
      .slice(0, Math.max(0, maxCandidates - candidates.length));
    
    return [...candidates, ...additionalEntities].slice(0, maxCandidates);
    
  } catch (error) {
    logger.warn('Failed to get simulation candidates from Pinecone', 'livingWorld', {
      error: error instanceof Error ? error.message : String(error),
    });
    return worldState.entities.slice(0, maxCandidates);
  }
}

/**
 * Map entity type string to SimulationEntitySnapshot type
 */
function mapEntityType(type: string): SimulationEntitySnapshot['type'] {
  const typeMap: Record<string, SimulationEntitySnapshot['type']> = {
    character: 'npc',
    world_entry: 'sect',
    territory: 'territory',
    antagonist: 'faction',
    sect: 'sect',
    faction: 'faction',
    organization: 'organization',
  };
  
  return typeMap[type.toLowerCase()] || 'npc';
}

/**
 * Extract power level from content text
 */
function extractPowerLevel(content: string): string {
  if (!content) return 'Unknown';
  
  const lowerContent = content.toLowerCase();
  
  // Common cultivation realms
  const realms = [
    'supreme', 'emperor', 'immortal', 'saint', 'sovereign',
    'nascent soul', 'soul formation', 'core formation', 'foundation establishment',
    'golden core', 'spirit realm', 'qi condensation', 'body refinement',
    'major', 'top-tier', 'first-rate', 'second-rate', 'third-rate'
  ];
  
  for (const realm of realms) {
    if (lowerContent.includes(realm)) {
      return realm.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  }
  
  return 'Unknown';
}

/**
 * Store world events in Pinecone for retrieval
 */
export async function storeWorldEvents(
  novelId: string,
  events: GlobalWorldEvent[]
): Promise<{ success: boolean; storedCount: number; errors: string[] }> {
  if (events.length === 0) {
    return { success: true, storedCount: 0, errors: [] };
  }
  
  if (!(await isLivingWorldPineconeReady())) {
    logger.debug('Pinecone not ready, skipping event storage', 'livingWorld');
    return { success: false, storedCount: 0, errors: ['Pinecone not available'] };
  }

  const vectors: Array<{
    id: string;
    values: number[];
    metadata: WorldEventMetadata;
  }> = [];
  
  const errors: string[] = [];

  for (const event of events) {
    try {
      // Generate embedding from event description
      const textForEmbedding = [
        event.summary,
        event.description,
        event.storyHook,
        `Affected: ${event.affectedEntityNames.join(', ')}`,
        `Type: ${event.eventType}`,
      ].join(' ');
      
      const embedding = await generateEmbedding(textForEmbedding);
      
      if (!embedding) {
        errors.push(`Failed to generate embedding for event ${event.id}`);
        continue;
      }
      
      vectors.push({
        id: `world_event_${event.id}`,
        values: embedding,
        metadata: {
          type: 'world_event',
          eventId: event.id,
          eventType: event.eventType,
          novelId: event.novelId,
          summary: event.summary.substring(0, 500),
          affectedEntities: event.affectedEntityNames.join(','),
          urgency: event.urgency,
          impact: event.impact,
          isDiscovered: event.isDiscovered,
          generatedAtChapter: event.generatedAtChapter,
          createdAt: event.createdAt,
        },
      });
    } catch (error) {
      errors.push(`Error processing event ${event.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (vectors.length === 0) {
    return { success: false, storedCount: 0, errors };
  }

  try {
    const result = await upsertVectors(novelId, vectors);
    
    logger.info('Stored world events in Pinecone', 'livingWorld', {
      attempted: events.length,
      stored: result.upsertedCount,
      errors: result.errors.length,
    });
    
    return {
      success: result.upsertedCount > 0,
      storedCount: result.upsertedCount,
      errors: [...errors, ...result.errors],
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      storedCount: 0,
      errors: [...errors, `Upsert failed: ${errorMsg}`],
    };
  }
}

/**
 * Query for related world events
 */
export async function queryRelatedWorldEvents(
  novelId: string,
  context: string,
  options: {
    topK?: number;
    minScore?: number;
    onlyUndiscovered?: boolean;
  } = {}
): Promise<GlobalWorldEvent[]> {
  const {
    topK = 5,
    minScore = 0.5,
    onlyUndiscovered = false,
  } = options;

  if (!(await isLivingWorldPineconeReady())) {
    return [];
  }

  try {
    const filter: Record<string, any> = {
      type: 'world_event',
    };
    
    if (onlyUndiscovered) {
      filter.isDiscovered = false;
    }
    
    const result = await queryByText(novelId, context, {
      topK,
      filter,
      includeMetadata: true,
    });
    
    if (!result || !result.matches) {
      return [];
    }
    
    // Convert matches to partial GlobalWorldEvent objects
    // Note: Full events should be retrieved from local storage
    const events = result.matches
      .filter(match => match.score >= minScore && match.metadata?.type === 'world_event')
      .map(match => ({
        id: match.metadata?.eventId || match.id.replace('world_event_', ''),
        score: match.score,
        summary: match.metadata?.summary || '',
      }));
    
    logger.debug('Queried related world events', 'livingWorld', {
      queryLength: context.length,
      matchCount: events.length,
    });
    
    // Return IDs for lookup - caller should fetch full events from storage
    return events as unknown as GlobalWorldEvent[];
    
  } catch (error) {
    logger.warn('Failed to query related world events', 'livingWorld', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Find entities that would be affected by a potential event
 */
export async function findAffectedEntities(
  novelId: string,
  eventDescription: string,
  options: {
    topK?: number;
    minScore?: number;
  } = {}
): Promise<Array<{ id: string; name: string; type: string; relevanceScore: number }>> {
  const {
    topK = 10,
    minScore = 0.6,
  } = options;

  if (!(await isLivingWorldPineconeReady())) {
    return [];
  }

  try {
    const { entities } = await queryRelatedEntities(novelId, eventDescription, {
      topK,
      minScore,
    });
    
    return entities.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      relevanceScore: e.score,
    }));
    
  } catch (error) {
    logger.warn('Failed to find affected entities', 'livingWorld', {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get contextually relevant entities for a specific event type
 */
export async function getEntitiesForEventType(
  novelId: string,
  eventType: string,
  worldState: WorldStateSnapshot
): Promise<SimulationEntitySnapshot[]> {
  // Build a context query based on event type
  const eventContextMap: Record<string, string> = {
    sect_destruction: 'weak sects vulnerable to attack, declining power, enemy threats',
    sect_rise: 'growing sects, successful cultivation, increasing influence',
    power_shift: 'political changes, faction conflicts, alliance shifts',
    npc_death: 'aging cultivators, dangerous situations, enemies, battles',
    npc_advancement: 'cultivation breakthroughs, talent, training, resources',
    territory_conquest: 'border conflicts, territorial disputes, weak defenses',
    alliance_formed: 'common enemies, mutual benefits, diplomatic relations',
    alliance_broken: 'betrayal, conflicting interests, broken trust',
    war_outbreak: 'tensions, disputes, provocations, rival factions',
    treasure_discovery: 'exploration, ancient ruins, hidden locations',
    calamity: 'dangerous regions, beast tides, natural disasters',
  };
  
  const contextQuery = eventContextMap[eventType] || eventType;
  
  // Combine with world state context
  const fullContext = [
    contextQuery,
    `Current realm: ${worldState.currentRealm}`,
    worldState.ongoingConflicts.length > 0 
      ? `Conflicts: ${worldState.ongoingConflicts.map(c => c.name).join(', ')}`
      : '',
  ].filter(Boolean).join('\n');
  
  return getSimulationCandidates(novelId, {
    ...worldState,
    recentMajorEvents: [fullContext],
  }, {
    maxCandidates: 15,
  });
}

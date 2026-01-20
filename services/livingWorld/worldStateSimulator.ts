/**
 * World State Simulator
 * 
 * Handles the application of world events to the novel state.
 * Updates entities based on simulation results and manages
 * the persistence of world changes.
 */

import { NovelState, Character, Territory, WorldEntry, Antagonist } from '../../types';
import {
  GlobalWorldEvent,
  WorldSimulationResult,
  LivingWorldStatus,
  DEFAULT_WORLD_SIMULATION_CONFIG,
} from '../../types/livingWorld';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

/**
 * Storage key for Living World status
 */
const LIVING_WORLD_STATUS_KEY = 'livingWorldStatus';

/**
 * Storage key for world events
 */
const WORLD_EVENTS_KEY = 'worldEvents';

/**
 * Get Living World status from storage
 */
export function getLivingWorldStatus(novelId: string): LivingWorldStatus {
  try {
    const stored = localStorage.getItem(`${LIVING_WORLD_STATUS_KEY}_${novelId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.warn('Failed to load Living World status', 'livingWorld');
  }
  
  return {
    enabled: DEFAULT_WORLD_SIMULATION_CONFIG.enabled,
    lastSimulationChapter: 0,
    totalEventsGenerated: 0,
    undiscoveredEvents: 0,
    nextScheduledSimulation: DEFAULT_WORLD_SIMULATION_CONFIG.chapterInterval,
    pendingTriggers: [],
  };
}

/**
 * Save Living World status to storage
 */
export function saveLivingWorldStatus(novelId: string, status: LivingWorldStatus): void {
  try {
    localStorage.setItem(`${LIVING_WORLD_STATUS_KEY}_${novelId}`, JSON.stringify(status));
  } catch (error) {
    logger.warn('Failed to save Living World status', 'livingWorld');
  }
}

/**
 * Get all world events for a novel
 */
export function getWorldEvents(novelId: string): GlobalWorldEvent[] {
  try {
    const stored = localStorage.getItem(`${WORLD_EVENTS_KEY}_${novelId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    logger.warn('Failed to load world events', 'livingWorld');
  }
  
  return [];
}

/**
 * Save world events to storage
 */
export function saveWorldEvents(novelId: string, events: GlobalWorldEvent[]): void {
  try {
    localStorage.setItem(`${WORLD_EVENTS_KEY}_${novelId}`, JSON.stringify(events));
  } catch (error) {
    logger.warn('Failed to save world events', 'livingWorld');
  }
}

/**
 * Add new world events from a simulation
 */
export function addWorldEvents(
  novelId: string,
  newEvents: GlobalWorldEvent[]
): GlobalWorldEvent[] {
  const existingEvents = getWorldEvents(novelId);
  const allEvents = [...existingEvents, ...newEvents];
  saveWorldEvents(novelId, allEvents);
  
  // Update status
  const status = getLivingWorldStatus(novelId);
  status.totalEventsGenerated += newEvents.length;
  status.undiscoveredEvents += newEvents.length;
  saveLivingWorldStatus(novelId, status);
  
  logger.info('Added world events', 'livingWorld', {
    newCount: newEvents.length,
    totalCount: allEvents.length,
  });
  
  return allEvents;
}

/**
 * Mark events as discovered
 */
export function markEventsDiscovered(
  novelId: string,
  eventIds: string[],
  discoveryChapter: number
): void {
  const events = getWorldEvents(novelId);
  let discoveredCount = 0;
  
  for (const event of events) {
    if (eventIds.includes(event.id) && !event.isDiscovered) {
      event.isDiscovered = true;
      event.discoveryChapter = discoveryChapter;
      discoveredCount++;
    }
  }
  
  saveWorldEvents(novelId, events);
  
  // Update status
  const status = getLivingWorldStatus(novelId);
  status.undiscoveredEvents = Math.max(0, status.undiscoveredEvents - discoveredCount);
  saveLivingWorldStatus(novelId, status);
  
  logger.info('Marked events discovered', 'livingWorld', {
    count: discoveredCount,
    chapter: discoveryChapter,
  });
}

/**
 * Mark events as integrated into narrative
 */
export function markEventsIntegrated(
  novelId: string,
  eventIds: string[],
  integrationChapter: number
): void {
  const events = getWorldEvents(novelId);
  
  for (const event of events) {
    if (eventIds.includes(event.id)) {
      event.integratedIntoNarrative = true;
      event.integrationChapter = integrationChapter;
    }
  }
  
  saveWorldEvents(novelId, events);
}

/**
 * Get undiscovered events sorted by urgency
 */
export function getUndiscoveredEvents(novelId: string): GlobalWorldEvent[] {
  const events = getWorldEvents(novelId);
  
  const undiscovered = events.filter(e => !e.isDiscovered);
  
  // Sort by urgency (immediate first), then by impact (catastrophic first)
  const urgencyOrder = { immediate: 0, background: 1, future_plot: 2 };
  const impactOrder = { catastrophic: 0, major: 1, moderate: 2, minor: 3 };
  
  return undiscovered.sort((a, b) => {
    const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    if (urgencyDiff !== 0) return urgencyDiff;
    return impactOrder[a.impact] - impactOrder[b.impact];
  });
}

/**
 * Get events that should be discovered in the current chapter
 */
export function getEventsToDiscover(
  novelId: string,
  currentChapter: number,
  maxEvents: number = 2
): GlobalWorldEvent[] {
  const undiscovered = getUndiscoveredEvents(novelId);
  
  // Prioritize immediate urgency events
  const immediate = undiscovered.filter(e => e.urgency === 'immediate');
  if (immediate.length > 0) {
    return immediate.slice(0, maxEvents);
  }
  
  // Otherwise, return oldest background events
  const background = undiscovered.filter(e => e.urgency === 'background');
  const sorted = background.sort((a, b) => a.generatedAtChapter - b.generatedAtChapter);
  
  return sorted.slice(0, maxEvents);
}

/**
 * Apply world event effects to novel state
 * This creates update suggestions but doesn't modify state directly
 */
export function generateEventStateUpdates(
  event: GlobalWorldEvent,
  state: NovelState
): {
  characterUpdates: Array<{ characterId: string; field: string; newValue: string }>;
  worldUpdates: Array<{ entryId: string; field: string; newValue: string }>;
  newWorldEntries: Array<{ title: string; content: string; category: string }>;
  newSystemLogs: Array<{ message: string; type: 'discovery' | 'update' | 'fate' | 'logic' }>;
} {
  const updates = {
    characterUpdates: [] as Array<{ characterId: string; field: string; newValue: string }>,
    worldUpdates: [] as Array<{ entryId: string; field: string; newValue: string }>,
    newWorldEntries: [] as Array<{ title: string; content: string; category: string }>,
    newSystemLogs: [] as Array<{ message: string; type: 'discovery' | 'update' | 'fate' | 'logic' }>,
  };
  
  // Add system log for the event
  updates.newSystemLogs.push({
    message: `World Event: ${event.summary}`,
    type: 'fate',
  });
  
  // Process based on event type
  switch (event.eventType) {
    case 'npc_death':
      // Find the character and suggest status update
      for (const entityId of event.affectedEntityIds) {
        const character = state.characterCodex.find(c => c.id === entityId);
        if (character) {
          updates.characterUpdates.push({
            characterId: entityId,
            field: 'status',
            newValue: 'Deceased',
          });
          updates.newSystemLogs.push({
            message: `${character.name} has died: ${event.description}`,
            type: 'fate',
          });
        }
      }
      break;
      
    case 'npc_advancement':
      // Find the character and suggest cultivation update
      for (const entityId of event.affectedEntityIds) {
        const character = state.characterCodex.find(c => c.id === entityId);
        if (character && event.description.toLowerCase().includes('breakthrough')) {
          // Try to extract new cultivation level from description
          const cultivationMatch = event.description.match(
            /(nascent soul|golden core|core formation|foundation establishment|qi condensation|spirit realm|soul formation)/i
          );
          if (cultivationMatch) {
            updates.characterUpdates.push({
              characterId: entityId,
              field: 'currentCultivation',
              newValue: cultivationMatch[1],
            });
          }
          updates.newSystemLogs.push({
            message: `${character.name} achieved breakthrough`,
            type: 'update',
          });
        }
      }
      break;
      
    case 'sect_destruction':
    case 'sect_rise':
    case 'power_shift':
      // Create or update world bible entry
      if (event.affectedEntityNames.length > 0) {
        updates.newWorldEntries.push({
          title: `${event.eventType === 'sect_destruction' ? 'Fall' : 'Rise'} of ${event.affectedEntityNames[0]}`,
          content: event.description,
          category: 'Sects',
        });
      }
      break;
      
    case 'territory_conquest':
      // Update territory ownership if we can identify it
      for (const entityId of event.affectedEntityIds) {
        const territory = state.territories.find(t => t.id === entityId);
        if (territory) {
          updates.newSystemLogs.push({
            message: `Territory change: ${territory.name} - ${event.summary}`,
            type: 'update',
          });
        }
      }
      break;
      
    case 'war_outbreak':
    case 'war_conclusion':
      // Add world entry for war
      updates.newWorldEntries.push({
        title: event.eventType === 'war_outbreak' 
          ? `War: ${event.affectedEntityNames.slice(0, 2).join(' vs ')}`
          : `End of War: ${event.summary}`,
        content: event.description,
        category: 'Other',
      });
      break;
      
    case 'treasure_discovery':
    case 'calamity':
    case 'secret_revealed':
      // Add as world bible entry
      updates.newWorldEntries.push({
        title: event.summary,
        content: event.description,
        category: event.eventType === 'treasure_discovery' ? 'Other' : 'Other',
      });
      break;
  }
  
  return updates;
}

/**
 * Generate story hooks from events for prompt injection
 */
export function generateEventStoryHooks(events: GlobalWorldEvent[]): string[] {
  return events.map(event => {
    const urgencyPrefix = event.urgency === 'immediate' 
      ? '⚡ URGENT: '
      : event.urgency === 'future_plot'
      ? '🔮 Future seed: '
      : '';
    
    return `${urgencyPrefix}${event.storyHook}`;
  });
}

/**
 * Calculate world tension delta from events
 */
export function calculateTensionDelta(events: GlobalWorldEvent[]): number {
  let delta = 0;
  
  for (const event of events) {
    // Events that increase tension
    const tensionIncreasers = ['war_outbreak', 'sect_destruction', 'calamity', 'secret_revealed'];
    // Events that decrease tension
    const tensionDecreasers = ['war_conclusion', 'alliance_formed'];
    // Events that can go either way
    const neutralEvents = ['power_shift', 'npc_advancement', 'treasure_discovery'];
    
    if (tensionIncreasers.includes(event.eventType)) {
      delta += event.impact === 'catastrophic' ? 15 : event.impact === 'major' ? 10 : 5;
    } else if (tensionDecreasers.includes(event.eventType)) {
      delta -= event.impact === 'major' ? 8 : event.impact === 'moderate' ? 5 : 3;
    }
    
    // NPC death depends on who died
    if (event.eventType === 'npc_death') {
      delta += event.impact === 'major' ? 8 : 3;
    }
  }
  
  return delta;
}

/**
 * Get a summary of Living World state for UI display
 */
export function getLivingWorldSummary(novelId: string): {
  status: LivingWorldStatus;
  recentEvents: GlobalWorldEvent[];
  pendingDiscoveries: number;
  topStoryHooks: string[];
} {
  const status = getLivingWorldStatus(novelId);
  const allEvents = getWorldEvents(novelId);
  const undiscovered = allEvents.filter(e => !e.isDiscovered);
  
  // Get most recent events (last 5)
  const recentEvents = allEvents
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
  
  // Get top story hooks from undiscovered events
  const topStoryHooks = undiscovered
    .filter(e => e.urgency === 'immediate' || e.impact === 'major' || e.impact === 'catastrophic')
    .slice(0, 3)
    .map(e => e.storyHook);
  
  return {
    status,
    recentEvents,
    pendingDiscoveries: undiscovered.length,
    topStoryHooks,
  };
}

/**
 * Clear all world events for a novel (for reset/debugging)
 */
export function clearWorldEvents(novelId: string): void {
  localStorage.removeItem(`${WORLD_EVENTS_KEY}_${novelId}`);
  
  const status = getLivingWorldStatus(novelId);
  status.totalEventsGenerated = 0;
  status.undiscoveredEvents = 0;
  saveLivingWorldStatus(novelId, status);
  
  logger.info('Cleared all world events', 'livingWorld', { novelId });
}

/**
 * Export world events for backup/analysis
 */
export function exportWorldEvents(novelId: string): string {
  const events = getWorldEvents(novelId);
  const status = getLivingWorldStatus(novelId);
  
  return JSON.stringify({
    novelId,
    exportedAt: new Date().toISOString(),
    status,
    events,
  }, null, 2);
}

/**
 * Import world events from backup
 */
export function importWorldEvents(
  novelId: string,
  exportData: string
): { success: boolean; eventCount: number; error?: string } {
  try {
    const data = JSON.parse(exportData);
    
    if (!data.events || !Array.isArray(data.events)) {
      return { success: false, eventCount: 0, error: 'Invalid export data format' };
    }
    
    saveWorldEvents(novelId, data.events);
    
    if (data.status) {
      saveLivingWorldStatus(novelId, {
        ...data.status,
        undiscoveredEvents: data.events.filter((e: GlobalWorldEvent) => !e.isDiscovered).length,
      });
    }
    
    return { success: true, eventCount: data.events.length };
  } catch (error) {
    return {
      success: false,
      eventCount: 0,
      error: error instanceof Error ? error.message : 'Failed to parse export data',
    };
  }
}

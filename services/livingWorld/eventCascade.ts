/**
 * Event Cascade System
 * 
 * Handles the generation of follow-up events that cascade from major events.
 * For example:
 * - A sect destruction might trigger refugee events, power vacuum events
 * - A war outbreak might trigger alliance shifts, territory changes
 * - A major death might trigger succession crises, revenge plots
 */

import { NovelState } from '../../types';
import {
  GlobalWorldEvent,
  WorldEventType,
  EventUrgency,
  EventImpact,
  WorldSimulationConfig,
  DEFAULT_WORLD_SIMULATION_CONFIG,
} from '../../types/livingWorld';
import { geminiJson } from '../geminiService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

/**
 * Cascade rule definition
 */
interface CascadeRule {
  /** Event type that triggers this cascade */
  triggerEventType: WorldEventType;
  /** Minimum impact level to trigger */
  minimumImpact: EventImpact;
  /** Possible follow-up event types */
  possibleFollowUps: WorldEventType[];
  /** Probability of cascade (0-1) */
  cascadeProbability: number;
  /** Delay in chapters before cascade triggers */
  delayChapters: [number, number]; // [min, max]
  /** Description template for cascade */
  descriptionTemplate: string;
}

/**
 * Predefined cascade rules
 */
const CASCADE_RULES: CascadeRule[] = [
  // Sect destruction cascades
  {
    triggerEventType: 'sect_destruction',
    minimumImpact: 'moderate',
    possibleFollowUps: ['power_shift', 'territory_conquest', 'alliance_formed', 'npc_death'],
    cascadeProbability: 0.8,
    delayChapters: [5, 20],
    descriptionTemplate: 'Following the destruction of {entity}, the power vacuum has caused...',
  },
  {
    triggerEventType: 'sect_destruction',
    minimumImpact: 'major',
    possibleFollowUps: ['war_outbreak', 'alliance_broken', 'treasure_discovery'],
    cascadeProbability: 0.6,
    delayChapters: [10, 30],
    descriptionTemplate: 'The fall of {entity} has destabilized the region, leading to...',
  },
  
  // War cascades
  {
    triggerEventType: 'war_outbreak',
    minimumImpact: 'moderate',
    possibleFollowUps: ['alliance_formed', 'alliance_broken', 'npc_death', 'territory_conquest'],
    cascadeProbability: 0.9,
    delayChapters: [3, 15],
    descriptionTemplate: 'The ongoing war has resulted in...',
  },
  {
    triggerEventType: 'war_conclusion',
    minimumImpact: 'moderate',
    possibleFollowUps: ['power_shift', 'territory_conquest', 'political_change', 'npc_advancement'],
    cascadeProbability: 0.7,
    delayChapters: [5, 20],
    descriptionTemplate: 'In the aftermath of the war...',
  },
  
  // Death cascades
  {
    triggerEventType: 'npc_death',
    minimumImpact: 'major',
    possibleFollowUps: ['power_shift', 'alliance_broken', 'political_change'],
    cascadeProbability: 0.7,
    delayChapters: [3, 15],
    descriptionTemplate: 'The death of {entity} has triggered...',
  },
  
  // Alliance cascades
  {
    triggerEventType: 'alliance_broken',
    minimumImpact: 'moderate',
    possibleFollowUps: ['war_outbreak', 'alliance_formed', 'power_shift'],
    cascadeProbability: 0.6,
    delayChapters: [5, 25],
    descriptionTemplate: 'The broken alliance has caused...',
  },
  {
    triggerEventType: 'alliance_formed',
    minimumImpact: 'major',
    possibleFollowUps: ['power_shift', 'war_outbreak', 'territory_conquest'],
    cascadeProbability: 0.5,
    delayChapters: [10, 30],
    descriptionTemplate: 'The new alliance has shifted the balance...',
  },
  
  // Treasure cascades
  {
    triggerEventType: 'treasure_discovery',
    minimumImpact: 'major',
    possibleFollowUps: ['war_outbreak', 'npc_death', 'npc_advancement'],
    cascadeProbability: 0.6,
    delayChapters: [5, 20],
    descriptionTemplate: 'The discovery of {entity} has caused conflict...',
  },
  
  // Calamity cascades
  {
    triggerEventType: 'calamity',
    minimumImpact: 'moderate',
    possibleFollowUps: ['npc_death', 'sect_destruction', 'power_shift', 'alliance_formed'],
    cascadeProbability: 0.8,
    delayChapters: [1, 10],
    descriptionTemplate: 'The calamity has left devastation in its wake...',
  },
  
  // Advancement cascades
  {
    triggerEventType: 'npc_advancement',
    minimumImpact: 'major',
    possibleFollowUps: ['power_shift', 'alliance_formed', 'sect_rise'],
    cascadeProbability: 0.4,
    delayChapters: [10, 30],
    descriptionTemplate: 'The breakthrough of {entity} has changed the power balance...',
  },
  
  // Secret revealed cascades
  {
    triggerEventType: 'secret_revealed',
    minimumImpact: 'major',
    possibleFollowUps: ['alliance_broken', 'war_outbreak', 'npc_death', 'political_change'],
    cascadeProbability: 0.7,
    delayChapters: [3, 15],
    descriptionTemplate: 'The revelation has caused turmoil...',
  },
];

/**
 * Pending cascade event
 */
export interface PendingCascade {
  id: string;
  sourceEventId: string;
  sourceEventType: WorldEventType;
  triggeredAtChapter: number;
  activationChapter: number; // When this cascade should trigger
  cascadeType: WorldEventType;
  descriptionContext: string;
  affectedEntities: string[];
  processed: boolean;
}

/**
 * Check if an event should trigger cascades
 */
export function checkForCascades(
  event: GlobalWorldEvent,
  currentChapter: number
): PendingCascade[] {
  const pendingCascades: PendingCascade[] = [];
  
  // Find applicable cascade rules
  const applicableRules = CASCADE_RULES.filter(rule => 
    rule.triggerEventType === event.eventType &&
    getImpactLevel(event.impact) >= getImpactLevel(rule.minimumImpact)
  );
  
  for (const rule of applicableRules) {
    // Check probability
    if (Math.random() > rule.cascadeProbability) {
      continue;
    }
    
    // Select a follow-up event type
    const followUpType = rule.possibleFollowUps[
      Math.floor(Math.random() * rule.possibleFollowUps.length)
    ];
    
    // Calculate activation chapter
    const delay = rule.delayChapters[0] + 
      Math.floor(Math.random() * (rule.delayChapters[1] - rule.delayChapters[0]));
    
    // Create pending cascade
    pendingCascades.push({
      id: generateUUID(),
      sourceEventId: event.id,
      sourceEventType: event.eventType,
      triggeredAtChapter: currentChapter,
      activationChapter: currentChapter + delay,
      cascadeType: followUpType,
      descriptionContext: rule.descriptionTemplate.replace(
        '{entity}',
        event.affectedEntityNames[0] || 'the affected party'
      ),
      affectedEntities: event.affectedEntityNames,
      processed: false,
    });
  }
  
  logger.debug('Checked event for cascades', 'livingWorld', {
    eventType: event.eventType,
    impact: event.impact,
    cascadesTriggered: pendingCascades.length,
  });
  
  return pendingCascades;
}

/**
 * Get numeric impact level for comparison
 */
function getImpactLevel(impact: EventImpact): number {
  const levels: Record<EventImpact, number> = {
    minor: 1,
    moderate: 2,
    major: 3,
    catastrophic: 4,
  };
  return levels[impact] || 0;
}

/**
 * Process pending cascades that are ready to activate
 */
export async function processPendingCascades(
  state: NovelState,
  pendingCascades: PendingCascade[],
  currentChapter: number,
  config: WorldSimulationConfig = DEFAULT_WORLD_SIMULATION_CONFIG
): Promise<GlobalWorldEvent[]> {
  const readyToActivate = pendingCascades.filter(c => 
    !c.processed && c.activationChapter <= currentChapter
  );
  
  if (readyToActivate.length === 0) {
    return [];
  }
  
  logger.info('Processing pending cascade events', 'livingWorld', {
    count: readyToActivate.length,
    chapter: currentChapter,
  });
  
  const generatedEvents: GlobalWorldEvent[] = [];
  
  for (const cascade of readyToActivate) {
    try {
      const event = await generateCascadeEvent(state, cascade, config);
      if (event) {
        generatedEvents.push(event);
        cascade.processed = true;
      }
    } catch (error) {
      logger.warn('Failed to generate cascade event', 'livingWorld', {
        cascadeId: cascade.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return generatedEvents;
}

/**
 * Generate a cascade event using AI
 */
async function generateCascadeEvent(
  state: NovelState,
  cascade: PendingCascade,
  config: WorldSimulationConfig
): Promise<GlobalWorldEvent | null> {
  const prompt = buildCascadePrompt(state, cascade);
  
  try {
    const response = await geminiJson<{
      description: string;
      summary: string;
      affectedEntities: Array<{ name: string; type: string }>;
      storyHook: string;
      urgency: string;
      impact: string;
      consequences?: string[];
    }>({
      model: config.model,
      system: CASCADE_SYSTEM_PROMPT,
      user: prompt,
      temperature: config.temperature,
      maxTokens: 2048,
    });
    
    if (!response.description) {
      return null;
    }
    
    const event: GlobalWorldEvent = {
      id: generateUUID(),
      novelId: state.id,
      eventType: cascade.cascadeType,
      description: response.description,
      summary: response.summary || response.description.substring(0, 100),
      affectedEntityIds: [],
      affectedEntityNames: response.affectedEntities?.map(e => e.name) || cascade.affectedEntities,
      affectedEntityTypes: response.affectedEntities?.map(e => e.type) || [],
      occurredDuringChapters: [cascade.triggeredAtChapter, cascade.activationChapter],
      isDiscovered: false,
      storyHook: response.storyHook || '',
      urgency: normalizeUrgency(response.urgency),
      impact: normalizeImpact(response.impact),
      consequences: response.consequences,
      triggerType: 'chapter_interval', // Cascade events are treated as interval events
      generatedAtChapter: cascade.activationChapter,
      createdAt: Date.now(),
      integratedIntoNarrative: false,
    };
    
    logger.info('Generated cascade event', 'livingWorld', {
      cascadeId: cascade.id,
      sourceType: cascade.sourceEventType,
      resultType: event.eventType,
    });
    
    return event;
    
  } catch (error) {
    logger.error('Failed to generate cascade event', 'livingWorld', 
      error instanceof Error ? error : undefined
    );
    return null;
  }
}

/**
 * System prompt for cascade event generation
 */
const CASCADE_SYSTEM_PROMPT = `You are generating a follow-up world event that cascades from a previous major event in a Xianxia/Xuanhuan novel.

Your event should:
1. Be a logical consequence of the triggering event
2. Create new story opportunities
3. Feel natural and believable in the world
4. Have appropriate stakes based on the original event

Return a JSON object with:
{
  "description": "Detailed description of what happened",
  "summary": "One sentence summary",
  "affectedEntities": [{ "name": "Entity Name", "type": "sect|npc|territory|etc" }],
  "storyHook": "How this creates opportunity for the MC",
  "urgency": "immediate|background|future_plot",
  "impact": "minor|moderate|major|catastrophic",
  "consequences": ["Potential follow-up effects"]
}`;

/**
 * Build prompt for cascade event generation
 */
function buildCascadePrompt(state: NovelState, cascade: PendingCascade): string {
  // Get some world context
  const sects = state.worldBible
    .filter(w => w.category === 'Sects')
    .slice(0, 5)
    .map(s => s.title);
  
  const characters = state.characterCodex
    .filter(c => !c.isProtagonist && c.status === 'Alive')
    .slice(0, 5)
    .map(c => `${c.name} (${c.currentCultivation || 'Unknown'})`);
  
  return `=== CASCADE EVENT GENERATION ===

TRIGGERING EVENT: ${cascade.sourceEventType}
AFFECTED ENTITIES: ${cascade.affectedEntities.join(', ')}
CONTEXT: ${cascade.descriptionContext}

REQUIRED EVENT TYPE: ${cascade.cascadeType}

Time passed since trigger: ${cascade.activationChapter - cascade.triggeredAtChapter} chapters

WORLD CONTEXT:
- Known Sects: ${sects.join(', ') || 'Various sects'}
- Key Characters: ${characters.join(', ') || 'Various cultivators'}

Generate a ${cascade.cascadeType.replace(/_/g, ' ')} event that logically follows from the original event.
The event should create interesting story opportunities while being believable in this cultivation world.`;
}

/**
 * Normalize urgency from response
 */
function normalizeUrgency(urgency: string | undefined): EventUrgency {
  if (!urgency) return 'background';
  const lower = urgency.toLowerCase();
  if (lower.includes('immediate')) return 'immediate';
  if (lower.includes('future')) return 'future_plot';
  return 'background';
}

/**
 * Normalize impact from response
 */
function normalizeImpact(impact: string | undefined): EventImpact {
  if (!impact) return 'moderate';
  const lower = impact.toLowerCase();
  if (lower.includes('catastroph')) return 'catastrophic';
  if (lower.includes('major')) return 'major';
  if (lower.includes('minor')) return 'minor';
  return 'moderate';
}

/**
 * Storage key for pending cascades
 */
const PENDING_CASCADES_KEY = 'pendingCascades';

/**
 * Get pending cascades from storage
 */
export function getPendingCascades(novelId: string): PendingCascade[] {
  try {
    const stored = localStorage.getItem(`${PENDING_CASCADES_KEY}_${novelId}`);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore errors
  }
  return [];
}

/**
 * Save pending cascades to storage
 */
export function savePendingCascades(novelId: string, cascades: PendingCascade[]): void {
  try {
    localStorage.setItem(`${PENDING_CASCADES_KEY}_${novelId}`, JSON.stringify(cascades));
  } catch {
    // Ignore errors
  }
}

/**
 * Add new pending cascades
 */
export function addPendingCascades(novelId: string, newCascades: PendingCascade[]): void {
  const existing = getPendingCascades(novelId);
  const combined = [...existing, ...newCascades];
  savePendingCascades(novelId, combined);
}

/**
 * Clean up old processed cascades
 */
export function cleanupProcessedCascades(novelId: string, keepCount: number = 50): void {
  const cascades = getPendingCascades(novelId);
  
  // Keep unprocessed + most recent processed
  const unprocessed = cascades.filter(c => !c.processed);
  const processed = cascades
    .filter(c => c.processed)
    .sort((a, b) => b.activationChapter - a.activationChapter)
    .slice(0, keepCount);
  
  savePendingCascades(novelId, [...unprocessed, ...processed]);
}

/**
 * Get cascade statistics
 */
export function getCascadeStats(novelId: string): {
  pending: number;
  processed: number;
  byType: Record<string, number>;
} {
  const cascades = getPendingCascades(novelId);
  
  const pending = cascades.filter(c => !c.processed).length;
  const processed = cascades.filter(c => c.processed).length;
  
  const byType: Record<string, number> = {};
  for (const cascade of cascades) {
    byType[cascade.cascadeType] = (byType[cascade.cascadeType] || 0) + 1;
  }
  
  return { pending, processed, byType };
}

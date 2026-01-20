/**
 * Global Event Generator
 * 
 * The core of the Living World system. Generates world events that occur
 * during time gaps (seclusion, time skips, chapter intervals).
 * 
 * Uses Gemini Flash for fast, cost-effective simulation of:
 * - Sect power changes
 * - NPC progression/death
 * - Territory conquests
 * - Political shifts
 * - Faction conflicts
 */

import { NovelState, Chapter, Character, Territory, WorldEntry, Antagonist } from '../../types';
import {
  GlobalWorldEvent,
  WorldSimulationConfig,
  WorldSimulationResult,
  WorldSimulationTrigger,
  WorldStateSnapshot,
  SimulationEntitySnapshot,
  LivingWorldRawResponse,
  SeclusionDetection,
  TimeSkipDetection,
  WorldEventType,
  EventUrgency,
  EventImpact,
  DEFAULT_WORLD_SIMULATION_CONFIG,
} from '../../types/livingWorld';
import { geminiJson } from '../geminiService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

/**
 * System prompt for the Living World generator
 */
const LIVING_WORLD_SYSTEM_PROMPT = `You are the LIVING WORLD SIMULATOR for a Xianxia/Xuanhuan novel.

Your role is to simulate what happens in the world while the main character (MC) is away, in seclusion, or during time skips.

## YOUR MISSION

The world should NEVER feel frozen. When the MC spends 10 years in seclusion, the world CHANGES:
- Sects rise and fall
- NPCs advance in cultivation or die
- Political alliances shift
- Wars begin or end
- Treasures are discovered
- New threats emerge

## EVENT GENERATION PRINCIPLES

1. **CONSEQUENCES MATTER**
   - Events should follow logically from existing tensions
   - Weak sects with strong enemies may be destroyed
   - Aging cultivators may break through or die trying

2. **EMERGENT STORYTELLING**
   - Create events that naturally become plot hooks
   - "The MC returns to find their home sect in ruins"
   - "An old rival has become a supreme elder"

3. **BALANCE DRAMA WITH PLAUSIBILITY**
   - Not everything changes - stability exists too
   - Major changes need believable causes
   - Some entities should remain consistent anchors

4. **RESPECT POWER LEVELS**
   - A Foundation Establishment elder won't defeat a Nascent Soul master
   - Weak sects can fall to strong sects
   - Resource-poor regions struggle against wealthy ones

## EVENT TYPES

- sect_destruction: A sect is destroyed
- sect_rise: A sect gains significant power
- power_shift: Balance of power changes
- npc_death: A notable NPC dies
- npc_advancement: An NPC breaks through
- territory_conquest: Territory changes hands
- alliance_formed: New alliance between factions
- alliance_broken: Existing alliance breaks
- treasure_discovery: Major treasure found
- war_outbreak: War begins
- war_conclusion: War ends
- calamity: Natural disaster or beast tide
- cultivation_shift: Change in resources
- political_change: Ruler or policy change
- secret_revealed: Major secret exposed

## OUTPUT FORMAT

Return a JSON object:
{
  "events": [
    {
      "eventType": "sect_destruction|power_shift|npc_death|etc",
      "description": "Detailed description of what happened and why",
      "summary": "One sentence summary",
      "affectedEntities": [
        { "name": "Entity Name", "type": "sect|npc|territory|etc" }
      ],
      "storyHook": "How this creates narrative opportunity for the MC",
      "urgency": "immediate|background|future_plot",
      "impact": "minor|moderate|major|catastrophic",
      "consequences": ["Follow-up effect 1", "Follow-up effect 2"]
    }
  ],
  "reasoning": ["Why these events make sense given the world state"],
  "warnings": ["Any concerns about consistency or plausibility"],
  "worldStateChanges": {
    "tensionChange": -10 to +10,
    "newConflicts": ["New conflict descriptions"],
    "resolvedConflicts": ["Resolved conflict names"]
  }
}

Remember: These events create EMERGENT STORYTELLING. The MC should return to a world that feels alive and changed.`;

/**
 * Detect if the MC is entering seclusion based on chapter content
 */
export function detectSeclusion(chapter: Chapter): SeclusionDetection {
  const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
  
  // Keywords indicating seclusion
  const seclusionKeywords = [
    'closed-door cultivation',
    'closed door cultivation',
    'enters seclusion',
    'began his seclusion',
    'began her seclusion',
    'entered seclusion',
    'retreat for cultivation',
    'cultivation retreat',
    'meditate in seclusion',
    'sealed himself',
    'sealed herself',
    'years of cultivation',
    'months of cultivation',
  ];
  
  for (const keyword of seclusionKeywords) {
    if (content.includes(keyword)) {
      // Try to extract duration
      const durationMatch = content.match(
        /(\d+)\s*(years?|months?|days?|weeks?)\s*(of\s*)?(seclusion|cultivation|retreat|meditation)/i
      );
      
      const typeMatch = content.includes('closed-door') || content.includes('closed door')
        ? 'closed_door'
        : content.includes('meditat')
        ? 'meditation'
        : content.includes('training')
        ? 'training'
        : 'retreat';
      
      return {
        detected: true,
        type: typeMatch,
        estimatedDuration: durationMatch 
          ? `${durationMatch[1]} ${durationMatch[2]}`
          : undefined,
        chapter: chapter.number,
        contentSnippet: content.substring(content.indexOf(keyword) - 50, content.indexOf(keyword) + 100),
      };
    }
  }
  
  return { detected: false, chapter: chapter.number };
}

/**
 * Detect if there's a time skip between chapters
 */
export function detectTimeSkip(
  currentChapter: Chapter,
  previousChapter: Chapter | undefined
): TimeSkipDetection {
  if (!previousChapter) {
    return { detected: false, chapter: currentChapter.number };
  }
  
  const content = currentChapter.content.toLowerCase();
  const summary = (currentChapter.summary || '').toLowerCase();
  const combinedContent = content + ' ' + summary;
  
  // Time skip indicators
  const timeSkipPatterns = [
    /(\d+)\s*years?\s*(later|passed|have passed|had passed)/i,
    /after\s*(\d+)\s*years?/i,
    /(\d+)\s*years?\s*(since|after)/i,
    /several\s*years?\s*(later|passed)/i,
    /many\s*years?\s*(later|passed)/i,
    /a\s*decade\s*(later|passed)/i,
    /decades?\s*(later|passed)/i,
    /(\d+)\s*months?\s*(later|passed|have passed)/i,
    /half\s*a\s*year\s*(later|passed)/i,
  ];
  
  for (const pattern of timeSkipPatterns) {
    const match = combinedContent.match(pattern);
    if (match) {
      const timeValue = match[1];
      const isDecade = match[0].toLowerCase().includes('decade');
      const isMonths = match[0].toLowerCase().includes('month');
      const isSeveral = match[0].toLowerCase().includes('several');
      const isMany = match[0].toLowerCase().includes('many');
      const isHalfYear = match[0].toLowerCase().includes('half a year');
      
      let years = 0;
      let months = 0;
      
      if (isDecade) {
        years = match[0].includes('decades') ? 20 : 10;
      } else if (isSeveral) {
        years = 3;
      } else if (isMany) {
        years = 5;
      } else if (isHalfYear) {
        months = 6;
      } else if (isMonths) {
        months = parseInt(timeValue) || 6;
      } else {
        years = parseInt(timeValue) || 1;
      }
      
      return {
        detected: years >= 1 || months >= 6,
        yearsSkipped: years,
        monthsSkipped: months,
        chapter: currentChapter.number,
        contentSnippet: match[0],
      };
    }
  }
  
  return { detected: false, chapter: currentChapter.number };
}

/**
 * Check if we should run the Living World simulation
 */
export function shouldRunSimulation(
  state: NovelState,
  currentChapter: number,
  config: WorldSimulationConfig = DEFAULT_WORLD_SIMULATION_CONFIG,
  lastSimulationChapter: number = 0
): WorldSimulationTrigger | null {
  if (!config.enabled) {
    return null;
  }
  
  // Check chapter interval trigger
  if (config.chapterInterval > 0 && currentChapter > 0) {
    const chaptersSinceLastSim = currentChapter - lastSimulationChapter;
    if (chaptersSinceLastSim >= config.chapterInterval) {
      return {
        type: 'chapter_interval',
        milestoneChapter: currentChapter,
        triggerChapter: currentChapter,
      };
    }
  }
  
  // Check seclusion trigger
  if (config.seclusionTrigger && state.chapters.length > 0) {
    const latestChapter = state.chapters[state.chapters.length - 1];
    const seclusion = detectSeclusion(latestChapter);
    if (seclusion.detected) {
      return {
        type: 'seclusion',
        seclusionDuration: seclusion.estimatedDuration,
        triggerChapter: currentChapter,
      };
    }
  }
  
  // Check time skip trigger
  if (state.chapters.length >= 2) {
    const latestChapter = state.chapters[state.chapters.length - 1];
    const previousChapter = state.chapters[state.chapters.length - 2];
    const timeSkip = detectTimeSkip(latestChapter, previousChapter);
    
    if (timeSkip.detected && (timeSkip.yearsSkipped || 0) >= config.timeSkipThreshold) {
      return {
        type: 'time_skip',
        timeSkipYears: timeSkip.yearsSkipped,
        triggerChapter: currentChapter,
      };
    }
  }
  
  return null;
}

/**
 * Build world state snapshot for simulation
 */
export function buildWorldStateSnapshot(
  state: NovelState,
  trigger: WorldSimulationTrigger,
  config: WorldSimulationConfig
): WorldStateSnapshot {
  const entities: SimulationEntitySnapshot[] = [];
  
  // Add sects from world bible
  const sects = (state.worldBible || []).filter(w => 
    w.category === 'Sects' || w.content.toLowerCase().includes('sect')
  );
  for (const sect of sects.slice(0, 15)) {
    entities.push({
      id: sect.id,
      name: sect.title,
      type: 'sect',
      powerLevel: extractPowerLevel(sect.content),
      status: 'active',
      relationships: [],
      activeConflicts: [],
      recentEvents: [],
      isProtected: config.protectedEntityIds.includes(sect.id),
    });
  }
  
  // Add key NPCs (non-protagonist characters)
  const npcs = (state.characterCodex || []).filter(c => 
    !c.isProtagonist && c.status === 'Alive'
  );
  for (const npc of npcs.slice(0, 20)) {
    entities.push({
      id: npc.id,
      name: npc.name,
      type: 'npc',
      powerLevel: npc.currentCultivation || 'Unknown',
      status: 'active',
      relationships: (npc.relationships || []).map(r => ({
        targetId: r.characterId,
        targetName: state.characterCodex.find(c => c.id === r.characterId)?.name || 'Unknown',
        relationshipType: mapRelationshipType(r.type),
        intensity: 'moderate',
      })),
      activeConflicts: [],
      recentEvents: [],
      isProtected: config.protectedEntityIds.includes(npc.id),
    });
  }
  
  // Add territories
  for (const territory of (state.territories || []).slice(0, 10)) {
    entities.push({
      id: territory.id,
      name: territory.name,
      type: 'territory',
      powerLevel: territory.type,
      status: 'active',
      relationships: [],
      activeConflicts: [],
      recentEvents: [],
      isProtected: config.protectedEntityIds.includes(territory.id),
    });
  }
  
  // Add antagonists
  for (const antagonist of (state.antagonists || []).filter(a => a.status === 'active').slice(0, 10)) {
    entities.push({
      id: antagonist.id,
      name: antagonist.name,
      type: 'faction',
      powerLevel: antagonist.powerLevel,
      status: 'active',
      relationships: [],
      activeConflicts: [],
      recentEvents: [],
      isProtected: config.protectedEntityIds.includes(antagonist.id),
    });
  }
  
  // Get current realm
  const currentRealm = state.realms.find(r => r.id === state.currentRealmId);
  
  // Calculate world tension from active threads
  const activeThreads = (state.storyThreads || []).filter(t => t.status === 'active');
  const conflictThreads = activeThreads.filter(t => t.type === 'conflict' || t.type === 'enemy');
  const worldTensionLevel = Math.min(100, 30 + conflictThreads.length * 10);
  
  // Get ongoing conflicts
  const ongoingConflicts = conflictThreads.slice(0, 5).map(t => ({
    name: t.title,
    parties: [t.relatedEntityType || 'Unknown'],
    status: 'active' as const,
  }));
  
  // Get MC situation
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const mcSituation = protagonist
    ? `${protagonist.name} at ${protagonist.currentCultivation || 'unknown'} cultivation`
    : 'Main character status unknown';
  
  return {
    novelId: state.id,
    chapterNumber: trigger.triggerChapter,
    entities,
    currentRealm: currentRealm?.name || 'Unknown Realm',
    worldTensionLevel,
    ongoingConflicts,
    recentMajorEvents: [],
    mcSituation,
    narrativeTimePassed: trigger.seclusionDuration || 
      (trigger.timeSkipYears ? `${trigger.timeSkipYears} years` : undefined),
  };
}

/**
 * Extract power level from content text
 */
function extractPowerLevel(content: string): string {
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
      return realm.charAt(0).toUpperCase() + realm.slice(1);
    }
  }
  
  return 'Unknown';
}

/**
 * Map relationship type to simulation type
 */
function mapRelationshipType(type: string): 'ally' | 'enemy' | 'neutral' | 'vassal' | 'overlord' {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('enemy') || lowerType.includes('rival') || lowerType.includes('foe')) {
    return 'enemy';
  }
  if (lowerType.includes('ally') || lowerType.includes('friend') || lowerType.includes('master') || lowerType.includes('disciple')) {
    return 'ally';
  }
  if (lowerType.includes('vassal') || lowerType.includes('subordinate')) {
    return 'vassal';
  }
  if (lowerType.includes('lord') || lowerType.includes('overlord')) {
    return 'overlord';
  }
  return 'neutral';
}

/**
 * Run the Living World simulation
 */
export async function runWorldSimulation(
  state: NovelState,
  trigger: WorldSimulationTrigger,
  config: WorldSimulationConfig = DEFAULT_WORLD_SIMULATION_CONFIG,
  options: {
    usePinecone?: boolean;
    storeEventsInPinecone?: boolean;
  } = {}
): Promise<WorldSimulationResult> {
  const startTime = Date.now();
  const { usePinecone = true, storeEventsInPinecone = true } = options;
  
  logger.info('Running Living World simulation', 'livingWorld', {
    trigger: trigger.type,
    chapter: trigger.triggerChapter,
    volatility: config.volatilityLevel,
    usePinecone,
  });
  
  try {
    // Build world state snapshot
    let worldState = buildWorldStateSnapshot(state, trigger, config);
    
    // Try to enhance with Pinecone if available
    if (usePinecone) {
      try {
        const { getSimulationCandidates, isLivingWorldPineconeReady } = await import('./pineconeIntegration');
        
        if (await isLivingWorldPineconeReady()) {
          const enhancedEntities = await getSimulationCandidates(state.id, worldState, {
            maxCandidates: 25,
            includeConflictParties: true,
          });
          
          if (enhancedEntities.length > 0) {
            worldState = {
              ...worldState,
              entities: enhancedEntities,
            };
            
            logger.debug('Enhanced world state with Pinecone entities', 'livingWorld', {
              entityCount: enhancedEntities.length,
            });
          }
        }
      } catch (pineconeError) {
        logger.debug('Pinecone enhancement skipped', 'livingWorld', {
          error: pineconeError instanceof Error ? pineconeError.message : String(pineconeError),
        });
      }
    }
    
    if (worldState.entities.length === 0) {
      logger.warn('No entities available for simulation', 'livingWorld');
      return {
        success: true,
        events: [],
        reasoning: ['No entities available to simulate'],
        warnings: ['Add sects, NPCs, or territories to enable world simulation'],
        durationMs: Date.now() - startTime,
        trigger,
      };
    }
    
    // Build user prompt
    const userPrompt = buildSimulationPrompt(worldState, trigger, config);
    
    // Call Gemini Flash
    const rawResponse = await geminiJson<LivingWorldRawResponse>({
      model: config.model,
      system: LIVING_WORLD_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    
    // Process response into events
    const events = processSimulationResponse(
      rawResponse,
      state,
      trigger,
      config
    );
    
    // Store events in Pinecone for future retrieval
    if (storeEventsInPinecone && events.length > 0) {
      try {
        const { storeWorldEvents, isLivingWorldPineconeReady } = await import('./pineconeIntegration');
        
        if (await isLivingWorldPineconeReady()) {
          const storeResult = await storeWorldEvents(state.id, events);
          
          if (storeResult.success) {
            logger.debug('Stored world events in Pinecone', 'livingWorld', {
              storedCount: storeResult.storedCount,
            });
          }
        }
      } catch (storeError) {
        logger.debug('Event storage in Pinecone skipped', 'livingWorld', {
          error: storeError instanceof Error ? storeError.message : String(storeError),
        });
      }
    }
    
    // Check for cascade events from major events
    let cascadeEvents: GlobalWorldEvent[] = [];
    try {
      const { 
        checkForCascades, 
        addPendingCascades, 
        getPendingCascades, 
        processPendingCascades,
        cleanupProcessedCascades 
      } = await import('./eventCascade');
      
      // Check new events for cascades
      for (const event of events) {
        const newCascades = checkForCascades(event, trigger.triggerChapter);
        if (newCascades.length > 0) {
          addPendingCascades(state.id, newCascades);
          logger.debug('Added pending cascades', 'livingWorld', {
            eventId: event.id,
            cascadeCount: newCascades.length,
          });
        }
      }
      
      // Process any pending cascades that are ready
      const pendingCascades = getPendingCascades(state.id);
      if (pendingCascades.length > 0) {
        cascadeEvents = await processPendingCascades(
          state,
          pendingCascades,
          trigger.triggerChapter,
          config
        );
        
        if (cascadeEvents.length > 0) {
          logger.info('Generated cascade events', 'livingWorld', {
            count: cascadeEvents.length,
          });
        }
      }
      
      // Cleanup old processed cascades
      cleanupProcessedCascades(state.id, 50);
      
    } catch (cascadeError) {
      logger.debug('Cascade processing skipped', 'livingWorld', {
        error: cascadeError instanceof Error ? cascadeError.message : String(cascadeError),
      });
    }
    
    // Combine all events
    const allEvents = [...events, ...cascadeEvents];
    
    const durationMs = Date.now() - startTime;
    
    logger.info('Living World simulation completed', 'livingWorld', {
      eventCount: allEvents.length,
      directEvents: events.length,
      cascadeEvents: cascadeEvents.length,
      durationMs,
      trigger: trigger.type,
    });
    
    return {
      success: true,
      events: allEvents,
      reasoning: rawResponse.reasoning || [],
      warnings: rawResponse.warnings || [],
      durationMs,
      trigger,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Living World simulation failed', 'livingWorld', error instanceof Error ? error : undefined);
    
    return {
      success: false,
      events: [],
      reasoning: [],
      warnings: [],
      durationMs: Date.now() - startTime,
      error: errorMessage,
      trigger,
    };
  }
}

/**
 * Build the simulation prompt
 */
function buildSimulationPrompt(
  worldState: WorldStateSnapshot,
  trigger: WorldSimulationTrigger,
  config: WorldSimulationConfig
): string {
  const volatilityDescriptions = {
    stable: 'The world is relatively stable. Major changes are rare, but not impossible.',
    moderate: 'The world has normal levels of conflict and change. Events happen with reasonable frequency.',
    chaotic: 'The world is in turmoil. Many factions are in conflict, and major changes are common.',
  };
  
  const triggerDescriptions = {
    chapter_interval: `Regular world update at chapter ${trigger.milestoneChapter}.`,
    seclusion: `The MC has entered seclusion for ${trigger.seclusionDuration || 'an extended period'}.`,
    time_skip: `${trigger.timeSkipYears || 'Several'} years have passed in the narrative.`,
    manual: 'Manual simulation trigger.',
  };
  
  const entityList = worldState.entities.map(e => {
    const protectedTag = e.isProtected ? ' [PROTECTED]' : '';
    return `- ${e.name} (${e.type})${protectedTag}: ${e.powerLevel}, Status: ${e.status}`;
  }).join('\n');
  
  const conflictList = worldState.ongoingConflicts.length > 0
    ? worldState.ongoingConflicts.map(c => `- ${c.name}: ${c.parties.join(' vs ')}`).join('\n')
    : 'No major conflicts ongoing';
  
  return `=== LIVING WORLD SIMULATION REQUEST ===

TRIGGER: ${triggerDescriptions[trigger.type]}

WORLD STATE:
- Realm: ${worldState.currentRealm}
- Tension Level: ${worldState.worldTensionLevel}/100
- MC Status: ${worldState.mcSituation}
${worldState.narrativeTimePassed ? `- Time Passed: ${worldState.narrativeTimePassed}` : ''}

VOLATILITY: ${config.volatilityLevel.toUpperCase()}
${volatilityDescriptions[config.volatilityLevel]}

=== ENTITIES IN THE WORLD ===
${entityList}

=== ONGOING CONFLICTS ===
${conflictList}

=== SIMULATION PARAMETERS ===
- Generate ${config.minEventsPerSimulation}-${config.maxEventsPerSimulation} events
- Major event chance: ${(config.majorEventChance * 100).toFixed(0)}%
- DO NOT harm PROTECTED entities
${trigger.type === 'seclusion' ? '- Focus on what happens WHILE the MC is in seclusion' : ''}
${trigger.type === 'time_skip' ? '- Simulate significant changes over ' + (trigger.timeSkipYears || 'several') + ' years' : ''}

=== YOUR TASK ===

Simulate what happens in this world during this time period. Consider:
1. Which sects would gain or lose power?
2. Would any NPCs die or break through?
3. Would any alliances form or break?
4. Would any territories change hands?
5. What story hooks would these events create for the MC?

Generate events that create EMERGENT STORYTELLING opportunities.`;
}

/**
 * Process simulation response into GlobalWorldEvent objects
 */
function processSimulationResponse(
  raw: LivingWorldRawResponse,
  state: NovelState,
  trigger: WorldSimulationTrigger,
  config: WorldSimulationConfig
): GlobalWorldEvent[] {
  if (!raw.events || !Array.isArray(raw.events)) {
    return [];
  }
  
  const events: GlobalWorldEvent[] = [];
  
  for (const rawEvent of raw.events.slice(0, config.maxEventsPerSimulation)) {
    try {
      // Map entity IDs
      const affectedEntityIds: string[] = [];
      const affectedEntityNames: string[] = [];
      const affectedEntityTypes: string[] = [];
      
      for (const affected of (rawEvent.affectedEntities || [])) {
        const name = affected.name;
        affectedEntityNames.push(name);
        affectedEntityTypes.push(affected.type);
        
        // Try to find entity ID
        const character = state.characterCodex.find(c => 
          c.name.toLowerCase() === name.toLowerCase()
        );
        if (character) {
          affectedEntityIds.push(character.id);
          continue;
        }
        
        const worldEntry = state.worldBible.find(w => 
          w.title.toLowerCase() === name.toLowerCase()
        );
        if (worldEntry) {
          affectedEntityIds.push(worldEntry.id);
          continue;
        }
        
        const territory = state.territories.find(t => 
          t.name.toLowerCase() === name.toLowerCase()
        );
        if (territory) {
          affectedEntityIds.push(territory.id);
        }
      }
      
      const event: GlobalWorldEvent = {
        id: generateUUID(),
        novelId: state.id,
        eventType: normalizeEventType(rawEvent.eventType),
        description: rawEvent.description || '',
        summary: rawEvent.summary || rawEvent.description?.substring(0, 100) || '',
        affectedEntityIds,
        affectedEntityNames,
        affectedEntityTypes,
        occurredDuringChapters: [
          Math.max(1, trigger.triggerChapter - 1),
          trigger.triggerChapter
        ],
        isDiscovered: false,
        storyHook: rawEvent.storyHook || '',
        urgency: normalizeUrgency(rawEvent.urgency),
        impact: normalizeImpact(rawEvent.impact),
        consequences: rawEvent.consequences,
        triggerType: trigger.type,
        generatedAtChapter: trigger.triggerChapter,
        createdAt: Date.now(),
        integratedIntoNarrative: false,
      };
      
      events.push(event);
    } catch (error) {
      logger.warn('Failed to process simulation event', 'livingWorld', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  
  return events;
}

/**
 * Normalize event type from raw response
 */
function normalizeEventType(type: string | undefined): WorldEventType {
  if (!type) return 'power_shift';
  
  const normalized = type.toLowerCase().replace(/[^a-z_]/g, '_');
  
  const validTypes: WorldEventType[] = [
    'sect_destruction', 'sect_rise', 'power_shift', 'npc_death', 'npc_advancement',
    'territory_conquest', 'alliance_formed', 'alliance_broken', 'treasure_discovery',
    'war_outbreak', 'war_conclusion', 'calamity', 'cultivation_shift',
    'political_change', 'secret_revealed'
  ];
  
  if (validTypes.includes(normalized as WorldEventType)) {
    return normalized as WorldEventType;
  }
  
  // Map variations
  if (normalized.includes('destroy') || normalized.includes('fall')) return 'sect_destruction';
  if (normalized.includes('rise') || normalized.includes('grow')) return 'sect_rise';
  if (normalized.includes('death') || normalized.includes('die')) return 'npc_death';
  if (normalized.includes('break') || normalized.includes('advanc')) return 'npc_advancement';
  if (normalized.includes('conquer') || normalized.includes('territory')) return 'territory_conquest';
  if (normalized.includes('alliance') && normalized.includes('form')) return 'alliance_formed';
  if (normalized.includes('alliance') && (normalized.includes('break') || normalized.includes('broken'))) return 'alliance_broken';
  if (normalized.includes('treasure') || normalized.includes('discover')) return 'treasure_discovery';
  if (normalized.includes('war') && (normalized.includes('start') || normalized.includes('begin'))) return 'war_outbreak';
  if (normalized.includes('war') && (normalized.includes('end') || normalized.includes('conclu'))) return 'war_conclusion';
  if (normalized.includes('disaster') || normalized.includes('calam') || normalized.includes('beast')) return 'calamity';
  
  return 'power_shift';
}

/**
 * Normalize urgency from raw response
 */
function normalizeUrgency(urgency: string | undefined): EventUrgency {
  if (!urgency) return 'background';
  
  const normalized = urgency.toLowerCase();
  
  if (normalized.includes('immediate') || normalized.includes('urgent')) return 'immediate';
  if (normalized.includes('future') || normalized.includes('later')) return 'future_plot';
  
  return 'background';
}

/**
 * Normalize impact from raw response
 */
function normalizeImpact(impact: string | undefined): EventImpact {
  if (!impact) return 'moderate';
  
  const normalized = impact.toLowerCase();
  
  if (normalized.includes('minor') || normalized.includes('small')) return 'minor';
  if (normalized.includes('major') || normalized.includes('significant')) return 'major';
  if (normalized.includes('catastroph') || normalized.includes('world')) return 'catastrophic';
  
  return 'moderate';
}

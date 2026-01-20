/**
 * Living World Type Definitions
 * 
 * The Living World system prevents the world from being "frozen" while
 * the MC is away. When the MC spends time in seclusion or travels,
 * the world changes around them:
 * - Sects rise and fall
 * - NPCs advance or die
 * - Political shifts occur
 * - New threats emerge
 */

/**
 * Types of global world events that can occur
 */
export type WorldEventType =
  | 'sect_destruction'      // A sect is destroyed
  | 'sect_rise'             // A sect gains significant power
  | 'power_shift'           // Balance of power changes between factions
  | 'npc_death'             // A notable NPC dies
  | 'npc_advancement'       // An NPC achieves breakthrough/advancement
  | 'territory_conquest'    // Territory changes hands
  | 'alliance_formed'       // New alliance between factions
  | 'alliance_broken'       // Existing alliance breaks
  | 'treasure_discovery'    // Major treasure/ruin discovered
  | 'war_outbreak'          // War begins between factions
  | 'war_conclusion'        // War ends with result
  | 'calamity'              // Natural disaster or beast tide
  | 'cultivation_shift'     // Change in cultivation resources/opportunities
  | 'political_change'      // Ruler change, policy shift
  | 'secret_revealed';      // Major secret becomes known

/**
 * How urgent is this event for the MC to learn about?
 */
export type EventUrgency =
  | 'immediate'     // MC should learn this as soon as possible
  | 'background'    // General world context, can be revealed organically
  | 'future_plot';  // Seeds for future storylines

/**
 * Impact level of the event
 */
export type EventImpact =
  | 'minor'         // Small change, local effects
  | 'moderate'      // Noticeable change, regional effects
  | 'major'         // Significant change, affects multiple regions
  | 'catastrophic'; // World-shaking change, affects entire realm

/**
 * A global world event that occurred during a time gap
 */
export interface GlobalWorldEvent {
  id: string;
  novelId: string;
  /** Type of world event */
  eventType: WorldEventType;
  /** Detailed description of what happened */
  description: string;
  /** Short summary for quick reference */
  summary: string;
  /** IDs of entities affected by this event */
  affectedEntityIds: string[];
  /** Names of affected entities (for display) */
  affectedEntityNames: string[];
  /** Types of affected entities */
  affectedEntityTypes: string[];
  /** Chapter range when the event occurred (in-story time) */
  occurredDuringChapters: [number, number];
  /** Chapter when MC discovers/learns of the event */
  discoveryChapter?: number;
  /** Has the MC learned of this event yet? */
  isDiscovered: boolean;
  /** Story hook this event creates */
  storyHook: string;
  /** How urgent is this for the MC */
  urgency: EventUrgency;
  /** Impact level */
  impact: EventImpact;
  /** Optional consequences/follow-up events */
  consequences?: string[];
  /** Trigger that caused this event to be generated */
  triggerType: 'chapter_interval' | 'seclusion' | 'time_skip' | 'manual';
  /** Chapter number when this event was generated */
  generatedAtChapter: number;
  /** Timestamp when created */
  createdAt: number;
  /** Has this event been integrated into the narrative? */
  integratedIntoNarrative: boolean;
  /** Chapter where it was integrated */
  integrationChapter?: number;
}

/**
 * Configuration for the Living World simulation
 */
export interface WorldSimulationConfig {
  /** Whether Living World is enabled */
  enabled: boolean;
  /** Run simulation every N chapters */
  chapterInterval: number;
  /** Trigger simulation when MC enters seclusion */
  seclusionTrigger: boolean;
  /** Minimum narrative years to trigger time skip simulation */
  timeSkipThreshold: number;
  /** How volatile is the world? Affects event frequency and severity */
  volatilityLevel: 'stable' | 'moderate' | 'chaotic';
  /** Maximum events per simulation run */
  maxEventsPerSimulation: number;
  /** Minimum events per simulation run */
  minEventsPerSimulation: number;
  /** Chance of major events (0-1) */
  majorEventChance: number;
  /** Protect certain entities from random death */
  protectedEntityIds: string[];
  /** Model to use for simulation */
  model: 'gemini-2.5-flash' | 'gemini-2.0-flash';
  /** Temperature for generation */
  temperature: number;
  /** Maximum tokens for response */
  maxTokens: number;
}

/**
 * Default Living World configuration
 */
export const DEFAULT_WORLD_SIMULATION_CONFIG: WorldSimulationConfig = {
  enabled: true,
  chapterInterval: 50,
  seclusionTrigger: true,
  timeSkipThreshold: 1, // 1 year in narrative time
  volatilityLevel: 'moderate',
  maxEventsPerSimulation: 5,
  minEventsPerSimulation: 1,
  majorEventChance: 0.2,
  protectedEntityIds: [], // Protagonist and critical NPCs
  model: 'gemini-2.5-flash',
  temperature: 0.8,
  maxTokens: 4096,
};

/**
 * Entity snapshot for simulation
 */
export interface SimulationEntitySnapshot {
  id: string;
  name: string;
  type: 'sect' | 'npc' | 'territory' | 'faction' | 'organization';
  /** Current power level or status */
  powerLevel: string;
  /** Current status */
  status: 'active' | 'dormant' | 'destroyed' | 'deceased';
  /** Relationships with other entities */
  relationships: Array<{
    targetId: string;
    targetName: string;
    relationshipType: 'ally' | 'enemy' | 'neutral' | 'vassal' | 'overlord';
    intensity: 'weak' | 'moderate' | 'strong';
  }>;
  /** Ongoing conflicts or threats */
  activeConflicts: string[];
  /** Recent significant events */
  recentEvents: string[];
  /** Is this entity protected from random negative events? */
  isProtected: boolean;
}

/**
 * World state snapshot for simulation
 */
export interface WorldStateSnapshot {
  novelId: string;
  chapterNumber: number;
  /** All active entities to simulate */
  entities: SimulationEntitySnapshot[];
  /** Current realm/region focus */
  currentRealm: string;
  /** Overall world tension level (0-100) */
  worldTensionLevel: number;
  /** Active large-scale conflicts */
  ongoingConflicts: Array<{
    name: string;
    parties: string[];
    status: 'brewing' | 'active' | 'concluding';
  }>;
  /** Recent major events (for context) */
  recentMajorEvents: string[];
  /** MC's current situation (for context) */
  mcSituation: string;
  /** Time that has passed (for seclusion/time skip) */
  narrativeTimePassed?: string;
}

/**
 * Result from the Living World simulation
 */
export interface WorldSimulationResult {
  success: boolean;
  /** Generated world events */
  events: GlobalWorldEvent[];
  /** Reasoning from the AI */
  reasoning: string[];
  /** Warnings about the simulation */
  warnings: string[];
  /** Duration of simulation */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Trigger that initiated this simulation */
  trigger: WorldSimulationTrigger;
}

/**
 * What triggered the Living World simulation
 */
export interface WorldSimulationTrigger {
  type: 'chapter_interval' | 'seclusion' | 'time_skip' | 'manual';
  /** For chapter_interval: which milestone chapter */
  milestoneChapter?: number;
  /** For seclusion: duration of seclusion */
  seclusionDuration?: string;
  /** For time_skip: how much time passed */
  timeSkipYears?: number;
  /** Chapter that triggered this */
  triggerChapter: number;
}

/**
 * Raw response from the Living World AI
 */
export interface LivingWorldRawResponse {
  events: Array<{
    eventType: string;
    description: string;
    summary: string;
    affectedEntities: Array<{
      name: string;
      type: string;
    }>;
    storyHook: string;
    urgency: string;
    impact: string;
    consequences?: string[];
  }>;
  reasoning: string[];
  warnings?: string[];
  worldStateChanges?: {
    tensionChange: number;
    newConflicts?: string[];
    resolvedConflicts?: string[];
  };
}

/**
 * Seclusion detection result
 */
export interface SeclusionDetection {
  detected: boolean;
  type?: 'closed_door' | 'meditation' | 'training' | 'retreat';
  estimatedDuration?: string;
  location?: string;
  chapter: number;
  contentSnippet?: string;
}

/**
 * Time skip detection result
 */
export interface TimeSkipDetection {
  detected: boolean;
  yearsSkipped?: number;
  monthsSkipped?: number;
  daysSkipped?: number;
  chapter: number;
  contentSnippet?: string;
}

/**
 * Event injection context for chapter generation
 */
export interface WorldEventInjectionContext {
  /** Events that should be discovered in the current chapter */
  eventsToDiscover: GlobalWorldEvent[];
  /** Formatted context block for the prompt */
  formattedContext: string;
  /** Number of undiscovered events waiting */
  pendingEventCount: number;
  /** Most urgent pending events */
  urgentEvents: GlobalWorldEvent[];
}

/**
 * Status of the Living World system
 */
export interface LivingWorldStatus {
  enabled: boolean;
  lastSimulationChapter: number;
  totalEventsGenerated: number;
  undiscoveredEvents: number;
  nextScheduledSimulation: number;
  pendingTriggers: WorldSimulationTrigger[];
}

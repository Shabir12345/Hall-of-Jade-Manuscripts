/**
 * Clerk Agent Types
 * 
 * The "Heavenly Record-Keeper" (Clerk) agent maintains narrative consistency
 * by producing structured JSON deltas to update the Lore Bible after each chapter.
 */

import {
  CultivationState,
  ProtagonistState,
  CharacterStateSnapshot,
  WorldStateSnapshot,
  NarrativeAnchors,
  ConflictState,
  KarmaDebt,
  PowerSystemState,
  TechniqueMasteryState,
  ItemPossessionState,
  PromiseRecord,
} from './loreBible';

// ============================================================================
// DELTA UPDATE TYPES
// ============================================================================

/**
 * Update operation for a technique
 */
export interface TechniqueUpdate {
  action: 'add' | 'update' | 'remove';
  name: string;
  masteryLevel?: string;
  description?: string;
  acquiredChapter?: number;
  /** Reason for the change (e.g., "Learned from Elder Zhang in sect library") */
  reason?: string;
}

/**
 * Update operation for an inventory item
 */
export interface InventoryUpdate {
  action: 'add' | 'consume' | 'lose' | 'upgrade' | 'move';
  name: string;
  category: 'equipped' | 'storage' | 'consumable';
  quantity?: number;
  /** For consumables - how many were used */
  quantityConsumed?: number;
  description?: string;
  acquiredChapter?: number;
  /** Reason for the change */
  reason?: string;
}

/**
 * Update operation for a character's state
 */
export interface CharacterStateUpdate {
  characterId?: string;
  name: string;
  action: 'add' | 'update' | 'remove';
  updates: {
    status?: 'Alive' | 'Deceased' | 'Unknown';
    cultivation?: string;
    location?: string;
    relationshipToProtagonist?: string;
    currentRole?: string;
    keyTraits?: string[];
  };
  /** Reason for the change */
  reason?: string;
}

/**
 * Update operation for a conflict
 */
export interface ConflictUpdate {
  conflictId?: string;
  action: 'add' | 'update' | 'resolve' | 'escalate';
  description?: string;
  parties?: string[];
  type?: 'personal' | 'sect' | 'regional' | 'realm-wide';
  status?: 'brewing' | 'active' | 'escalating' | 'resolving';
  protagonistStance?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  /** Reason for the change */
  reason?: string;
}

/**
 * Update operation for a karma debt
 */
export interface KarmaDebtUpdate {
  karmaId?: string;
  action: 'add' | 'update' | 'resolve' | 'escalate';
  target?: string;
  actionDescription?: string;
  targetStatus?: 'Alive' | 'Deceased' | 'Unknown';
  consequence?: string;
  threatLevel?: 'minor' | 'moderate' | 'severe' | 'existential';
  /** Reason for the change */
  reason?: string;
}

/**
 * Update operation for a promise/quest
 */
export interface PromiseUpdate {
  promiseId?: string;
  action: 'add' | 'update' | 'fulfill' | 'break';
  description?: string;
  madeToCharacter?: string;
  deadline?: string;
  /** Reason for the change */
  reason?: string;
}

/**
 * Protagonist-specific updates
 */
export interface ProtagonistUpdate {
  /** Cultivation state changes */
  cultivation?: Partial<CultivationState>;
  /** Technique updates */
  techniques?: TechniqueUpdate[];
  /** Inventory updates */
  inventory?: InventoryUpdate[];
  /** Current emotional/mental state */
  emotionalState?: string;
  /** Current physical condition */
  physicalState?: string;
  /** Current location */
  location?: string;
  /** Identity updates (aliases, titles, sect) */
  identity?: {
    newAlias?: string;
    newTitle?: string;
    sectChange?: string;
  };
}

/**
 * Power system updates
 */
export interface PowerSystemUpdate {
  /** Current protagonist rank if changed */
  currentProtagonistRank?: string;
  /** New levels discovered */
  newLevelsDiscovered?: string[];
  /** Power gaps updated */
  powerGapsUpdated?: string[];
  /** Recent breakthroughs */
  recentBreakthroughs?: {
    character: string;
    fromLevel: string;
    toLevel: string;
  }[];
}

// ============================================================================
// CLERK DELTA (MAIN OUTPUT TYPE)
// ============================================================================

/**
 * The main Clerk Delta structure
 * This is what the Clerk agent returns after analyzing a chapter
 */
export interface ClerkDelta {
  /** Chapter this delta was generated for */
  chapterNumber: number;
  /** Timestamp of delta generation */
  timestamp: number;
  
  /** All state updates */
  updates: {
    /** Protagonist state updates */
    protagonist?: ProtagonistUpdate;
    /** Major character state updates */
    characters?: CharacterStateUpdate[];
    /** World state updates */
    worldState?: Partial<WorldStateSnapshot>;
    /** Narrative anchor updates */
    narrativeAnchors?: {
      lastMajorEvent?: string;
      currentObjective?: string;
      longTermGoal?: string;
      activeQuests?: string[];
      promiseUpdates?: PromiseUpdate[];
    };
    /** Conflict updates */
    activeConflicts?: ConflictUpdate[];
    /** Karma debt updates */
    karmaDebts?: KarmaDebtUpdate[];
    /** Power system updates */
    powerSystem?: PowerSystemUpdate;
  };
  
  /** Clerk's reasoning and observations */
  observations: {
    /** Chain-of-thought reasoning steps */
    reasoning: string[];
    /** Warnings about potential issues */
    warnings: string[];
    /** Continuity flags for attention */
    continuityFlags: ContinuityFlag[];
  };
}

/**
 * A continuity flag raised by the Clerk
 */
export interface ContinuityFlag {
  type: 'power_regression' | 'item_inconsistency' | 'character_status' | 
        'relationship_change' | 'timeline_issue' | 'plot_hole_risk' |
        'unresolved_promise' | 'cultivation_jump';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  /** References to relevant entities */
  entities?: string[];
  /** Suggested action */
  suggestion?: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of validating a Clerk delta
 */
export interface DeltaValidationResult {
  valid: boolean;
  errors: DeltaValidationError[];
  warnings: string[];
  /** The sanitized delta with invalid updates removed */
  sanitizedDelta: ClerkDelta;
}

/**
 * A validation error in a delta
 */
export interface DeltaValidationError {
  field: string;
  message: string;
  severity: 'warning' | 'error';
  /** The invalid value */
  invalidValue?: unknown;
  /** Suggested fix */
  suggestion?: string;
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

/**
 * Cultivation audit result
 */
export interface CultivationAuditResult {
  hasBreakthrough: boolean;
  hasRegression: boolean;
  hasInjury: boolean;
  previousLevel?: string;
  newLevel?: string;
  changeReason?: string;
  confidence: number;
}

/**
 * Inventory audit result
 */
export interface InventoryAuditResult {
  itemsGained: string[];
  itemsLost: string[];
  itemsConsumed: string[];
  itemsUpgraded: string[];
  changes: InventoryUpdate[];
  confidence: number;
}

/**
 * Karmic ties audit result
 */
export interface KarmicTiesAuditResult {
  relationshipChanges: Array<{
    character: string;
    previousRelation?: string;
    newRelation: string;
    changeType: 'improved' | 'worsened' | 'new' | 'severed';
  }>;
  newDebts: KarmaDebtUpdate[];
  resolvedDebts: string[];
  confidence: number;
}

/**
 * Thread management audit result
 */
export interface ThreadAuditResult {
  newThreadsIntroduced: string[];
  threadsProgressed: string[];
  threadsResolved: string[];
  threadsForeshadowed: string[];
  confidence: number;
}

/**
 * Combined audit results from the Clerk
 */
export interface ClerkAuditResults {
  cultivation: CultivationAuditResult;
  inventory: InventoryAuditResult;
  karmicTies: KarmicTiesAuditResult;
  threads: ThreadAuditResult;
  /** Overall confidence in the audit */
  overallConfidence: number;
}

// ============================================================================
// CLERK CONFIGURATION
// ============================================================================

/**
 * Configuration options for the Clerk agent
 */
export interface ClerkConfig {
  /** Whether to enable the Clerk (default: true) */
  enabled: boolean;
  /** Model to use for Clerk (default: gemini-2.5-flash) */
  model: 'gemini-2.0-flash' | 'gemini-2.5-flash';
  /** Temperature for generation (default: 0.3) */
  temperature: number;
  /** Maximum tokens for output (default: 4096) */
  maxTokens: number;
  /** Whether to validate deltas before applying (default: true) */
  validateDeltas: boolean;
  /** Whether to log detailed observations (default: false) */
  verboseLogging: boolean;
  /** Minimum confidence threshold for applying updates (default: 0.7) */
  confidenceThreshold: number;
}

/**
 * Default Clerk configuration
 */
export const DEFAULT_CLERK_CONFIG: ClerkConfig = {
  enabled: true,
  model: 'gemini-2.5-flash',
  temperature: 0.3,
  maxTokens: 4096,
  validateDeltas: true,
  verboseLogging: false,
  confidenceThreshold: 0.7,
};

// ============================================================================
// CLERK RESPONSE TYPES
// ============================================================================

/**
 * Raw response from the Clerk AI
 */
export interface ClerkRawResponse {
  updates: ClerkDelta['updates'];
  observations: ClerkDelta['observations'];
}

/**
 * Result of running the Clerk agent
 */
export interface ClerkResult {
  success: boolean;
  delta: ClerkDelta | null;
  validation: DeltaValidationResult | null;
  error?: string;
  /** Time taken in milliseconds */
  durationMs: number;
  /** Token usage */
  tokenUsage?: {
    input: number;
    output: number;
    cached?: number;
  };
}

/**
 * Lore Bible Types
 * 
 * The Lore Bible is the "Source of Truth" that travels with every prompt.
 * It ensures narrative consistency by tracking protagonist state, world state,
 * and narrative anchors across thousands of chapters.
 */

/**
 * Technique mastery state for a character
 */
export interface TechniqueMasteryState {
  name: string;
  masteryLevel: string; // e.g., "70%", "Beginner", "Master"
  description?: string;
  acquiredChapter?: number;
}

/**
 * Item possession state for a character
 */
export interface ItemPossessionState {
  name: string;
  category: 'equipped' | 'storage' | 'consumable';
  quantity?: number;
  description?: string;
  acquiredChapter?: number;
}

/**
 * Protagonist identity information
 */
export interface ProtagonistIdentity {
  name: string;
  aliases: string[];
  sect: string;
  title?: string; // Current title/honorific
}

/**
 * Cultivation state for a character
 */
export interface CultivationState {
  realm: string; // e.g., "Nascent Soul"
  stage: string; // e.g., "Middle", "Early", "Late", "Peak"
  foundationQuality: string; // e.g., "Heaven-Grade (Perfect)"
  physique?: string; // e.g., "Indestructible Vajra Body"
  specialConditions?: string[]; // e.g., ["Divine Sense Awakened", "Lightning Tribulation Pending"]
}

/**
 * Complete protagonist state
 */
export interface ProtagonistState {
  identity: ProtagonistIdentity;
  cultivation: CultivationState;
  techniques: TechniqueMasteryState[];
  inventory: {
    equipped: ItemPossessionState[];
    storageRing: ItemPossessionState[];
  };
  emotionalState?: string; // Current emotional/mental state
  physicalState?: string; // Current physical condition
  location?: string; // Current location
  lastUpdatedChapter: number;
}

/**
 * Character state snapshot for major characters
 */
export interface CharacterStateSnapshot {
  id: string;
  name: string;
  status: 'Alive' | 'Deceased' | 'Unknown';
  cultivation?: string; // Current cultivation level
  location?: string; // Last known location
  relationshipToProtagonist?: string; // e.g., "Ally", "Enemy", "Mentor"
  currentRole?: string; // Current role in the story
  lastAppearedChapter?: number;
  keyTraits: string[]; // 2-3 most important traits
}

/**
 * World state snapshot
 */
export interface WorldStateSnapshot {
  currentRealm: string;
  currentLocation: string;
  timeContext?: string; // e.g., "Day 3 of Alchemy Competition", "50 years since sect founding"
  currentSituation: string; // Brief description of current circumstances
  environmentalConditions?: string[]; // e.g., ["Qi-rich area", "Dangerous beasts nearby"]
}

/**
 * A promise made that needs to be fulfilled
 */
export interface PromiseRecord {
  id: string;
  description: string;
  madeToCharacter?: string;
  madeInChapter: number;
  deadline?: string; // e.g., "Before the tournament", "Within 3 months"
  status: 'pending' | 'fulfilled' | 'broken';
  fulfillmentChapter?: number;
}

/**
 * Narrative anchors - key story tracking points
 */
export interface NarrativeAnchors {
  lastMajorEvent: string; // What just happened
  lastMajorEventChapter: number;
  currentObjective: string; // Immediate goal
  longTermGoal?: string; // Overarching goal
  activeQuests: string[]; // Current missions/objectives
  pendingPromises: PromiseRecord[];
}

/**
 * Power system state (cultivation levels, rules)
 */
export interface PowerSystemState {
  currentProtagonistRank: string;
  knownLevelHierarchy: string[]; // Array from lowest to highest known levels
  powerGaps: string[]; // Notable power differences relevant to current story
  recentBreakthroughs?: {
    character: string;
    fromLevel: string;
    toLevel: string;
    chapter: number;
  }[];
}

/**
 * Active conflict state
 */
export interface ConflictState {
  id: string;
  description: string;
  parties: string[]; // Who is involved
  type: 'personal' | 'sect' | 'regional' | 'realm-wide';
  status: 'brewing' | 'active' | 'escalating' | 'resolving';
  protagonistStance?: string; // Protagonist's position in this conflict
  urgency: 'low' | 'medium' | 'high' | 'critical';
  introducedChapter: number;
  lastUpdatedChapter: number;
}

/**
 * Karma/consequence tracking
 */
export interface KarmaDebt {
  id: string;
  target: string; // Who was affected
  action: string; // What was done
  targetStatus: 'Alive' | 'Deceased' | 'Unknown';
  consequence: string; // The resulting karma/consequence
  resolvedChapter?: number;
  threatLevel: 'minor' | 'moderate' | 'severe' | 'existential';
  introducedChapter: number;
}

/**
 * Economic state for Lore Bible (Spirit Stone Market)
 */
export interface EconomicState {
  /** Primary currency name */
  primaryCurrency: string;
  /** Standard item prices for quick reference */
  standardPrices: Array<{
    item: string;
    price: number;
    currency: string;
    trend?: 'stable' | 'rising' | 'falling' | 'volatile';
  }>;
  /** Current global economic condition */
  currentCondition?: 'normal' | 'boom' | 'recession' | 'war_economy' | 'scarcity' | 'abundance';
  /** Protagonist's approximate wealth */
  protagonistWealth?: string;
  /** Any special market notes */
  marketNotes?: string;
}

/**
 * The complete Lore Bible structure
 * This is the source of truth that accompanies every chapter generation prompt
 */
export interface LoreBible {
  /** The novel this Lore Bible belongs to */
  novelId: string;
  
  /** The chapter this snapshot represents */
  asOfChapter: number;
  
  /** Protagonist state - always included in context */
  protagonist: ProtagonistState;
  
  /** Major characters (top 5-10 most relevant) */
  majorCharacters: CharacterStateSnapshot[];
  
  /** Current world state */
  worldState: WorldStateSnapshot;
  
  /** Story tracking points */
  narrativeAnchors: NarrativeAnchors;
  
  /** Power system context */
  powerSystem: PowerSystemState;
  
  /** Active conflicts relevant to current story */
  activeConflicts: ConflictState[];
  
  /** Outstanding karma debts / consequences */
  karmaDebts: KarmaDebt[];
  
  /** Economic state for price consistency (optional) */
  economicState?: EconomicState;
  
  /** When this Lore Bible was last updated */
  updatedAt: number;
  
  /** Version for change tracking */
  version: number;
}

/**
 * Lore Bible update result
 */
export interface LoreBibleUpdateResult {
  bible: LoreBible;
  changes: {
    protagonist: boolean;
    characters: string[]; // Character IDs that changed
    worldState: boolean;
    narrativeAnchors: boolean;
    conflicts: string[]; // Conflict IDs that changed
    karmaDebts: string[]; // Karma debt IDs that changed
  };
}

/**
 * Validation result for Lore Bible consistency
 */
export interface LoreBibleValidationResult {
  isValid: boolean;
  errors: {
    field: string;
    message: string;
    severity: 'warning' | 'error';
  }[];
  warnings: string[];
}

/**
 * Options for building a Lore Bible
 */
export interface LoreBibleBuildOptions {
  /** Maximum number of major characters to include */
  maxCharacters?: number;
  /** Maximum number of active conflicts to include */
  maxConflicts?: number;
  /** Maximum number of karma debts to include */
  maxKarmaDebts?: number;
  /** Whether to include resolved conflicts */
  includeResolvedConflicts?: boolean;
  /** Whether to include fulfilled promises */
  includeFulfilledPromises?: boolean;
}

/**
 * Default build options
 */
export const DEFAULT_LORE_BIBLE_OPTIONS: LoreBibleBuildOptions = {
  maxCharacters: 10,
  maxConflicts: 5,
  maxKarmaDebts: 5,
  includeResolvedConflicts: false,
  includeFulfilledPromises: false,
};

// ============================================================================
// CLERK INTEGRATION TYPES
// ============================================================================

/**
 * A delta history entry tracking what changed in the Lore Bible
 */
export interface LoreBibleDeltaEntry {
  /** Delta entry ID */
  id: string;
  /** Chapter this delta was generated for */
  chapterNumber: number;
  /** When the delta was applied */
  appliedAt: number;
  /** Summary of changes made */
  changesSummary: string[];
  /** The Clerk agent's confidence in these changes */
  confidence: number;
  /** Any warnings raised during this update */
  warnings?: string[];
  /** The raw delta (for debugging/rollback) */
  rawDelta?: unknown;
}

/**
 * Extended Lore Bible with delta tracking and versioning
 */
export interface LoreBibleWithHistory extends LoreBible {
  /** History of delta applications */
  deltaHistory: LoreBibleDeltaEntry[];
  /** Maximum delta history entries to keep */
  maxHistoryEntries?: number;
  /** Checksum for integrity verification */
  checksum?: string;
  /** Source of the last update */
  lastUpdateSource?: 'manual' | 'clerk' | 'extraction' | 'rebuild';
}

/**
 * Options for persisting the Lore Bible
 */
export interface LoreBiblePersistOptions {
  /** Whether to include delta history */
  includeHistory?: boolean;
  /** Whether to compress the data */
  compress?: boolean;
  /** Maximum size in bytes before compression is forced */
  maxUncompressedSize?: number;
}

/**
 * Result of loading a persisted Lore Bible
 */
export interface LoreBibleLoadResult {
  bible: LoreBible | null;
  history?: LoreBibleDeltaEntry[];
  loadedFromStorage: boolean;
  wasCompressed: boolean;
  error?: string;
}

/**
 * Lore Bible snapshot for comparison/rollback
 */
export interface LoreBibleSnapshot {
  /** Snapshot ID */
  id: string;
  /** Chapter number at time of snapshot */
  chapterNumber: number;
  /** When the snapshot was taken */
  createdAt: number;
  /** Reason for the snapshot */
  reason: 'auto' | 'manual' | 'before_clerk' | 'milestone';
  /** The full Lore Bible state */
  state: LoreBible;
}

/**
 * Diff between two Lore Bible versions
 */
export interface LoreBibleDiff {
  fromVersion: number;
  toVersion: number;
  fromChapter: number;
  toChapter: number;
  changes: {
    category: 'protagonist' | 'characters' | 'worldState' | 'narrativeAnchors' | 'conflicts' | 'karmaDebts' | 'powerSystem';
    type: 'added' | 'modified' | 'removed';
    description: string;
    oldValue?: unknown;
    newValue?: unknown;
  }[];
}

/**
 * Options for creating a Lore Bible diff
 */
export interface LoreBibleDiffOptions {
  /** Include full values in diff (may be large) */
  includeValues?: boolean;
  /** Categories to include in diff */
  categories?: Array<'protagonist' | 'characters' | 'worldState' | 'narrativeAnchors' | 'conflicts' | 'karmaDebts' | 'powerSystem'>;
}

/**
 * Face Graph Type Definitions
 * 
 * The Face Graph is a social network memory system that tracks "Face" (social standing)
 * and karma in Cultivation novels. It creates a web of blood feuds, favors, and social
 * obligations that persist across thousands of chapters.
 * 
 * Key Concepts:
 * - Face: Social standing/reputation in the cultivation world
 * - Karma: The weight of actions (good/bad) that accumulate over time
 * - Ripple Effects: How one action affects many connected NPCs
 * - Blood Feuds: Multigenerational vendettas
 * - Debts: Favors owed that must be repaid
 */

// ============================================================================
// KARMA SYSTEM
// ============================================================================

/**
 * Types of karmic actions that affect Face
 */
export type KarmaActionType =
  | 'kill'                    // Killed the target
  | 'spare'                   // Showed mercy to the target
  | 'humiliate'              // Publicly embarrassed/shamed
  | 'honor'                   // Publicly praised/elevated
  | 'betray'                  // Broke trust/alliance
  | 'save'                    // Saved life/rescued
  | 'steal'                   // Took treasures/techniques
  | 'gift'                    // Gave treasures/teachings
  | 'defeat'                  // Won in combat (non-lethal)
  | 'submit'                  // Lost/surrendered
  | 'offend'                  // Minor slight
  | 'protect'                 // Defended from threat
  | 'avenge'                  // Avenged for another
  | 'abandon'                 // Left to die/abandoned
  | 'enslave'                 // Bound to service
  | 'liberate'                // Freed from bondage
  | 'curse'                   // Placed a curse/restriction
  | 'bless'                   // Granted blessing/boon
  | 'destroy_sect'            // Destroyed their organization
  | 'cripple_cultivation'     // Ruined their cultivation
  | 'restore_cultivation'     // Restored their cultivation
  | 'exterminate_clan'        // Killed entire family/clan
  | 'elevate_status';         // Raised their social standing

/**
 * The polarity of karma (positive or negative)
 */
export type KarmaPolarity = 'positive' | 'negative' | 'neutral';

/**
 * How severe was the karmic action
 */
export type KarmaSeverity = 
  | 'minor'       // Forgettable slight (1-10 karma weight)
  | 'moderate'    // Notable event (11-30 karma weight)
  | 'major'       // Life-changing event (31-60 karma weight)  
  | 'severe'      // Unforgettable grievance (61-90 karma weight)
  | 'extreme';    // Blood feud material (91-100 karma weight)

/**
 * A single karmic action between entities
 */
export interface KarmaEvent {
  id: string;
  novelId: string;
  /** The character who performed the action */
  actorId: string;
  actorName: string;
  /** The character who received the action */
  targetId: string;
  targetName: string;
  /** Type of action performed */
  actionType: KarmaActionType;
  /** Positive or negative karma */
  polarity: KarmaPolarity;
  /** How severe was this action */
  severity: KarmaSeverity;
  /** Raw karma weight (1-100 scale) */
  karmaWeight: number;
  /** Multipliers that affected the weight */
  weightModifiers: KarmaWeightModifier[];
  /** Final calculated karma after modifiers */
  finalKarmaWeight: number;
  /** Chapter where this occurred */
  chapterNumber: number;
  chapterId: string;
  /** Description of what happened */
  description: string;
  /** Was this action witnessed by others? */
  wasWitnessed: boolean;
  /** IDs of characters who witnessed this */
  witnessIds: string[];
  /** Did this action affect the actor's Face/reputation? */
  affectedFace: boolean;
  /** Change in Face points for actor */
  faceChangeActor: number;
  /** Change in Face points for target */
  faceChangeTarget: number;
  /** Any NPCs who will be affected by ripple effects */
  rippleAffectedIds: string[];
  /** Is this a response to a previous karmic event? */
  isRetaliation: boolean;
  /** ID of the karma event this is retaliating against */
  retaliationForEventId?: string;
  /** Has this karma been "settled" (avenged/forgiven)? */
  isSettled: boolean;
  /** How was it settled */
  settlementType?: 'avenged' | 'forgiven' | 'balanced' | 'inherited';
  /** Chapter where it was settled */
  settledChapter?: number;
  /** Timestamp */
  createdAt: number;
  updatedAt: number;
}

/**
 * Modifiers that increase or decrease karma weight
 */
export interface KarmaWeightModifier {
  type: 
    | 'power_difference'      // Killing a weakling vs fighting an equal
    | 'provocation'           // Did they start it?
    | 'public_nature'         // Was it in public?
    | 'innocence'             // Was target innocent?
    | 'justified'             // Was action justified?
    | 'clan_involvement'      // Did it involve their clan?
    | 'sect_involvement'      // Did it involve their sect?
    | 'treasure_value'        // Value of items involved
    | 'cultivation_impact'    // Did it affect cultivation?
    | 'face_loss'             // Humiliation factor
    | 'betrayal_depth';       // How deep was the betrayal?
  modifier: number; // Multiplier (0.5 to 3.0)
  reason: string;
}

// ============================================================================
// FACE (SOCIAL STANDING) SYSTEM
// ============================================================================

/**
 * Categories of Face/reputation
 */
export type FaceCategory =
  | 'martial'           // Combat reputation
  | 'scholarly'         // Knowledge/wisdom reputation
  | 'political'         // Influence/power reputation
  | 'moral'             // Good/evil reputation
  | 'mysterious'        // Unknown/feared reputation
  | 'wealth';           // Material reputation

/**
 * Social standing tier
 */
export type FaceTier =
  | 'nobody'            // Unknown (0-99 Face)
  | 'known'             // Locally recognized (100-499)
  | 'renowned'          // Regionally famous (500-1999)
  | 'famous'            // Realm-wide reputation (2000-4999)
  | 'legendary'         // Multi-realm fame (5000-9999)
  | 'mythical';         // Historical figure (10000+)

/**
 * Face profile for a character
 */
export interface FaceProfile {
  id: string;
  novelId: string;
  characterId: string;
  characterName: string;
  /** Total Face points */
  totalFace: number;
  /** Current tier */
  tier: FaceTier;
  /** Face breakdown by category */
  faceByCategory: {
    martial: number;
    scholarly: number;
    political: number;
    moral: number;
    mysterious: number;
    wealth: number;
  };
  /** Net karma balance (positive = good, negative = evil) */
  karmaBalance: number;
  /** Total positive karma accumulated */
  positiveKarmaTotal: number;
  /** Total negative karma accumulated */
  negativeKarmaTotal: number;
  /** Titles/epithets earned */
  titles: FaceTitle[];
  /** Major accomplishments affecting Face */
  accomplishments: FaceAccomplishment[];
  /** Major shames/losses of Face */
  shames: FaceShame[];
  /** Chapter first appeared */
  firstAppearedChapter?: number;
  /** Last chapter updated */
  lastUpdatedChapter: number;
  /** Is this character protected from negative Face events? */
  isProtected: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * A title or epithet a character has earned
 */
export interface FaceTitle {
  id: string;
  title: string;
  /** How was this title earned */
  earnedBy: string;
  /** Chapter when earned */
  earnedChapter: number;
  /** Face bonus this title provides */
  faceBonus: number;
  /** Is this title still active? */
  isActive: boolean;
  /** If lost, when? */
  lostChapter?: number;
  /** Why was it lost? */
  lostReason?: string;
}

/**
 * A major accomplishment
 */
export interface FaceAccomplishment {
  id: string;
  description: string;
  chapterNumber: number;
  faceGained: number;
  category: FaceCategory;
  /** How widely known is this accomplishment */
  notoriety: 'local' | 'regional' | 'realm' | 'universal';
}

/**
 * A shame or loss of Face
 */
export interface FaceShame {
  id: string;
  description: string;
  chapterNumber: number;
  faceLost: number;
  category: FaceCategory;
  /** Has this shame been avenged/redeemed? */
  isRedeemed: boolean;
  redeemedChapter?: number;
}

// ============================================================================
// RELATIONSHIP LINKS (SOCIAL NETWORK)
// ============================================================================

/**
 * Types of social relationships in cultivation world
 */
export type SocialLinkType =
  // Family bonds
  | 'parent'
  | 'child'
  | 'sibling'
  | 'spouse'
  | 'clan_elder'
  | 'clan_member'
  // Cultivation bonds
  | 'master'
  | 'disciple'
  | 'martial_brother'    // Same master
  | 'martial_sister'
  | 'dao_companion'
  // Political bonds
  | 'sect_leader'
  | 'sect_member'
  | 'sect_elder'
  | 'faction_ally'
  | 'faction_enemy'
  | 'vassal'
  | 'overlord'
  // Personal bonds
  | 'friend'
  | 'rival'
  | 'enemy'
  | 'nemesis'
  | 'debt_owed'          // Owes a favor
  | 'debt_owed_by'       // Is owed a favor
  | 'blood_feud_target'  // Blood feud (I want to kill them)
  | 'blood_feud_hunter'  // Blood feud (they want to kill me)
  | 'protector'
  | 'protected'
  | 'benefactor'
  | 'beneficiary';

/**
 * How strong is this social connection
 */
export type LinkStrength =
  | 'weak'        // Acquaintance-level
  | 'moderate'    // Notable connection
  | 'strong'      // Important bond
  | 'unbreakable'; // Core relationship

/**
 * Current sentiment of the relationship
 */
export type LinkSentiment =
  | 'hostile'     // -100 to -60
  | 'antagonistic'// -59 to -20
  | 'cold'        // -19 to -1
  | 'neutral'     // 0
  | 'warm'        // 1 to 19
  | 'friendly'    // 20 to 59
  | 'devoted';    // 60 to 100

/**
 * A social link between two characters
 */
export interface SocialLink {
  id: string;
  novelId: string;
  /** Source character (the one whose perspective this is from) */
  sourceCharacterId: string;
  sourceCharacterName: string;
  /** Target character */
  targetCharacterId: string;
  targetCharacterName: string;
  /** Type of social connection */
  linkType: SocialLinkType;
  /** Strength of the connection */
  strength: LinkStrength;
  /** Current sentiment (-100 to 100) */
  sentimentScore: number;
  /** Derived sentiment category */
  sentiment: LinkSentiment;
  /** Total karma balance between these two */
  mutualKarmaBalance: number;
  /** Unsettled debts/grudges */
  unsettledKarma: number;
  /** Chapter when relationship started */
  establishedChapter: number;
  /** Last interaction chapter */
  lastInteractionChapter: number;
  /** History of the relationship */
  relationshipHistory: string;
  /** Is this an inherited relationship? (e.g., inherited blood feud) */
  isInherited: boolean;
  /** Who was it inherited from */
  inheritedFromCharacterId?: string;
  /** Chapter when inherited */
  inheritedChapter?: number;
  /** Is this relationship known to both parties? */
  isKnownToBoth: boolean;
  /** Is this relationship public knowledge? */
  isPublicKnowledge: boolean;
  /** Connected karma events */
  karmaEventIds: string[];
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// RIPPLE EFFECT SYSTEM
// ============================================================================

/**
 * A ripple effect from a karmic action
 */
export interface KarmaRipple {
  id: string;
  novelId: string;
  /** The original karma event that triggered this ripple */
  sourceKarmaEventId: string;
  /** The original actor */
  originalActorId: string;
  originalActorName: string;
  /** The original target */
  originalTargetId: string;
  originalTargetName: string;
  /** The character affected by the ripple */
  affectedCharacterId: string;
  affectedCharacterName: string;
  /** How is this character connected to the original target */
  connectionToTarget: SocialLinkType;
  /** Path of connection (for multi-hop ripples) */
  connectionPath: Array<{
    characterId: string;
    characterName: string;
    linkType: SocialLinkType;
  }>;
  /** Degrees of separation from original target */
  degreesOfSeparation: number;
  /** How does this affect their sentiment toward the actor */
  sentimentChange: number;
  /** Is this character now a potential threat to the actor? */
  becomesThreat: boolean;
  /** Threat level if they become a threat */
  threatLevel?: 'minor' | 'moderate' | 'major' | 'extreme';
  /** What might they do in response */
  potentialResponse: string;
  /** Chapter when ripple was calculated */
  calculatedAtChapter: number;
  /** Has this ripple manifested in the story yet? */
  hasManifested: boolean;
  /** Chapter when it manifested */
  manifestedChapter?: number;
  /** How did it manifest */
  manifestationDescription?: string;
  /** Decay factor (ripples weaken over time) */
  decayFactor: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * A blood feud between clans/factions
 */
export interface BloodFeud {
  id: string;
  novelId: string;
  /** Name of this feud */
  feudName: string;
  /** The aggrieved party (seeking vengeance) */
  aggrievedPartyType: 'character' | 'clan' | 'sect' | 'faction';
  aggrievedPartyId: string;
  aggrievedPartyName: string;
  /** The target of vengeance */
  targetPartyType: 'character' | 'clan' | 'sect' | 'faction';
  targetPartyId: string;
  targetPartyName: string;
  /** Original cause of the feud */
  originalCause: string;
  /** The karma event that started it all */
  originKarmaEventId: string;
  /** Chapter when the feud began */
  startedChapter: number;
  /** Intensity of the feud (0-100) */
  intensity: number;
  /** All characters on the aggrieved side */
  aggrievedMemberIds: string[];
  /** All characters on the target side */
  targetMemberIds: string[];
  /** Has the feud been resolved? */
  isResolved: boolean;
  /** How was it resolved */
  resolutionType?: 'vengeance_complete' | 'mutual_destruction' | 'forgiveness' | 'extinction' | 'alliance';
  resolutionChapter?: number;
  resolutionDescription?: string;
  /** Escalation history */
  escalations: Array<{
    chapterNumber: number;
    description: string;
    intensityChange: number;
    karmaEventId?: string;
  }>;
  createdAt: number;
  updatedAt: number;
}

/**
 * A debt (favor owed)
 */
export interface FaceDebt {
  id: string;
  novelId: string;
  /** Who owes the debt */
  debtorId: string;
  debtorName: string;
  /** Who is owed */
  creditorId: string;
  creditorName: string;
  /** What is the nature of the debt */
  debtType: 'life_saving' | 'treasure' | 'teaching' | 'protection' | 'political' | 'other';
  /** Description of what created the debt */
  description: string;
  /** The karma event that created this debt */
  originKarmaEventId: string;
  /** Chapter when debt was incurred */
  incurredChapter: number;
  /** Weight of the debt (how big a favor is owed) */
  debtWeight: number;
  /** Has the debt been repaid? */
  isRepaid: boolean;
  /** How was it repaid */
  repaymentDescription?: string;
  repaymentChapter?: number;
  /** Is this debt public knowledge? */
  isPublicKnowledge: boolean;
  /** Can this debt be inherited? */
  canBeInherited: boolean;
  /** Has it been inherited? */
  wasInherited: boolean;
  inheritedFromId?: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// FACE GRAPH QUERIES (for AI context)
// ============================================================================

/**
 * Query result for "How is NPC X connected to people MC has wronged?"
 */
export interface ConnectionToWrongedQuery {
  /** The NPC being queried */
  npcId: string;
  npcName: string;
  /** Direct connections to people MC wronged */
  directConnections: Array<{
    wrongedCharacterId: string;
    wrongedCharacterName: string;
    connectionType: SocialLinkType;
    connectionStrength: LinkStrength;
    karmaEventId: string;
    actionType: KarmaActionType;
    karmaSeverity: KarmaSeverity;
    chapterOccurred: number;
    stillUnresolved: boolean;
  }>;
  /** Indirect connections (2+ degrees of separation) */
  indirectConnections: Array<{
    wrongedCharacterId: string;
    wrongedCharacterName: string;
    pathToWronged: Array<{
      characterId: string;
      characterName: string;
      linkType: SocialLinkType;
    }>;
    degreesOfSeparation: number;
    karmaEventId: string;
    actionType: KarmaActionType;
    karmaSeverity: KarmaSeverity;
    chapterOccurred: number;
  }>;
  /** Calculated threat level to MC */
  calculatedThreatLevel: 'none' | 'low' | 'moderate' | 'high' | 'extreme';
  /** Reasons for the threat level */
  threatReasons: string[];
  /** Suggested story hooks */
  potentialStoryHooks: string[];
}

/**
 * Query result for "What are the consequences of this action?"
 */
export interface ActionConsequencesQuery {
  /** The proposed action */
  proposedAction: {
    actorId: string;
    targetId: string;
    actionType: KarmaActionType;
    severity: KarmaSeverity;
  };
  /** Immediate consequences */
  immediateConsequences: Array<{
    affectedCharacterId: string;
    affectedCharacterName: string;
    connectionToTarget: SocialLinkType;
    expectedResponse: string;
    threatLevel: 'minor' | 'moderate' | 'major' | 'extreme';
    timeframe: 'immediate' | 'short_term' | 'long_term';
  }>;
  /** Ripple effects */
  rippleEffects: Array<{
    affectedCharacterId: string;
    affectedCharacterName: string;
    degreesOfSeparation: number;
    expectedSentimentChange: number;
    potentialThreat: boolean;
  }>;
  /** Blood feuds that would be triggered/escalated */
  feudConsequences: Array<{
    isNewFeud: boolean;
    feudName?: string;
    escalationIntensity: number;
    partiesInvolved: string[];
  }>;
  /** Face changes */
  faceConsequences: {
    actorFaceChange: number;
    targetFaceChange: number;
    publicPerception: string;
  };
  /** AI-generated summary */
  narrativeSummary: string;
}

/**
 * Context block for chapter generation
 */
export interface FaceGraphContext {
  /** Characters present in this chapter */
  presentCharacterIds: string[];
  /** Relevant unresolved karma for present characters */
  unresolvedKarma: Array<{
    characterId: string;
    characterName: string;
    karmaEventSummary: string;
    chapterOccurred: number;
    severity: KarmaSeverity;
    sentimentTowardMC: number;
  }>;
  /** Active blood feuds affecting present characters */
  activeBloodFeuds: Array<{
    feudName: string;
    aggrievedPartyName: string;
    targetPartyName: string;
    intensity: number;
    relevantCharacterIds: string[];
  }>;
  /** Unpaid debts that might be called in */
  unpaidDebts: Array<{
    debtorName: string;
    creditorName: string;
    debtType: string;
    debtWeight: number;
    chapterIncurred: number;
  }>;
  /** Pending ripple effects that might manifest */
  pendingRipples: Array<{
    affectedCharacterName: string;
    originalTargetName: string;
    potentialResponse: string;
    threatLevel: string;
  }>;
  /** Formatted context string for AI */
  formattedContext: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration for the Face Graph system
 */
export interface FaceGraphConfig {
  /** Is the Face Graph system enabled */
  enabled: boolean;
  /** Automatically calculate ripple effects */
  autoCalculateRipples: boolean;
  /** Maximum degrees of separation for ripple effects */
  maxRippleDegrees: number;
  /** Minimum karma weight to trigger ripple calculation */
  rippleKarmaThreshold: number;
  /** Decay factor for karma over chapters */
  karmaDecayPerChapter: number;
  /** Automatically track karma from chapter content */
  autoExtractKarma: boolean;
  /** Model to use for karma extraction */
  extractionModel: 'gemini-2.5-flash' | 'gemini-2.0-flash';
  /** Protected character IDs (won't have ripples affect them negatively) */
  protectedCharacterIds: string[];
  /** Face multipliers for different action types */
  faceMultipliers: Record<KarmaActionType, number>;
}

/**
 * Default configuration
 */
export const DEFAULT_FACE_GRAPH_CONFIG: FaceGraphConfig = {
  enabled: true,
  autoCalculateRipples: true,
  maxRippleDegrees: 3,
  rippleKarmaThreshold: 30,
  karmaDecayPerChapter: 0.99, // 1% decay per chapter
  autoExtractKarma: true,
  extractionModel: 'gemini-2.5-flash',
  protectedCharacterIds: [],
  faceMultipliers: {
    kill: 2.0,
    spare: 0.5,
    humiliate: 1.5,
    honor: 0.8,
    betray: 2.5,
    save: 1.5,
    steal: 1.2,
    gift: 0.8,
    defeat: 1.0,
    submit: 0.5,
    offend: 0.3,
    protect: 1.0,
    avenge: 1.5,
    abandon: 1.8,
    enslave: 2.0,
    liberate: 1.2,
    curse: 1.8,
    bless: 1.0,
    destroy_sect: 3.0,
    cripple_cultivation: 2.5,
    restore_cultivation: 1.5,
    exterminate_clan: 4.0,
    elevate_status: 1.0,
  },
};

/**
 * Karma weight lookup table
 */
export const KARMA_WEIGHT_BY_ACTION: Record<KarmaActionType, { base: number; polarity: KarmaPolarity }> = {
  kill: { base: 80, polarity: 'negative' },
  spare: { base: 30, polarity: 'positive' },
  humiliate: { base: 50, polarity: 'negative' },
  honor: { base: 40, polarity: 'positive' },
  betray: { base: 70, polarity: 'negative' },
  save: { base: 60, polarity: 'positive' },
  steal: { base: 40, polarity: 'negative' },
  gift: { base: 35, polarity: 'positive' },
  defeat: { base: 30, polarity: 'negative' },
  submit: { base: 20, polarity: 'negative' },
  offend: { base: 15, polarity: 'negative' },
  protect: { base: 45, polarity: 'positive' },
  avenge: { base: 50, polarity: 'neutral' }, // Context-dependent
  abandon: { base: 55, polarity: 'negative' },
  enslave: { base: 75, polarity: 'negative' },
  liberate: { base: 55, polarity: 'positive' },
  curse: { base: 60, polarity: 'negative' },
  bless: { base: 50, polarity: 'positive' },
  destroy_sect: { base: 95, polarity: 'negative' },
  cripple_cultivation: { base: 85, polarity: 'negative' },
  restore_cultivation: { base: 70, polarity: 'positive' },
  exterminate_clan: { base: 100, polarity: 'negative' },
  elevate_status: { base: 45, polarity: 'positive' },
};

/**
 * Face tier thresholds
 */
export const FACE_TIER_THRESHOLDS: Record<FaceTier, number> = {
  nobody: 0,
  known: 100,
  renowned: 500,
  famous: 2000,
  legendary: 5000,
  mythical: 10000,
};

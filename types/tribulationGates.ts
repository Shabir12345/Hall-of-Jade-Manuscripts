/**
 * Tribulation Gates: Human-in-the-Loop Decision System
 * 
 * This system implements "Tribulation Gates" - decision points at major plot moments
 * where the AI pauses and presents the user with 3 "Fate Paths" to choose from.
 * 
 * This turns the novel into a "co-authored" experience, increasing user engagement
 * and preventing the AI from making story choices the user might not want.
 */

/**
 * Types of story moments that can trigger a Tribulation Gate
 */
export type TribulationTrigger =
  | 'realm_breakthrough'      // Character about to break through to a new cultivation realm
  | 'life_death_crisis'       // Character facing imminent death or mortal danger
  | 'major_confrontation'     // Showdown with a significant antagonist
  | 'alliance_decision'       // Choosing to ally with or betray a faction
  | 'treasure_discovery'      // Finding a powerful artifact with multiple uses
  | 'identity_revelation'     // Revealing or concealing true identity
  | 'marriage_proposal'       // Romantic commitment or rejection
  | 'sect_choice'             // Joining, leaving, or betraying a sect/faction
  | 'forbidden_technique'     // Using dangerous/forbidden power
  | 'sacrifice_moment'        // Giving up something precious for a goal
  | 'dao_comprehension'       // Major enlightenment or understanding
  | 'inheritance_acceptance'; // Accepting or refusing a legacy/inheritance

/**
 * Risk levels for fate path outcomes
 */
export type FatePathRisk = 'low' | 'medium' | 'high' | 'extreme';

/**
 * Status of a Tribulation Gate
 */
export type TribulationGateStatus = 'pending' | 'resolved' | 'skipped' | 'expired';

/**
 * A single fate path option presented to the user
 */
export interface FatePath {
  /** Unique identifier for this path */
  id: string;
  
  /** Short label (e.g., "A) Sacrifice the Sword") */
  label: string;
  
  /** 2-3 sentence narrative preview of what happens if chosen */
  description: string;
  
  /** List of potential consequences (both positive and negative) */
  consequences: string[];
  
  /** Risk level indicator */
  riskLevel: FatePathRisk;
  
  /** Emotional tone of this path (e.g., "desperate", "triumphant", "mysterious") */
  emotionalTone: string;
  
  /** Optional: Characters most affected by this choice */
  affectedCharacters?: string[];
  
  /** Optional: Threads that would be progressed/resolved by this choice */
  affectedThreadIds?: string[];
  
  /** Optional: How this aligns with the character's established personality (0-100) */
  characterAlignment?: number;
}

/**
 * A Tribulation Gate instance - represents a single decision point
 */
export interface TribulationGate {
  /** Unique identifier */
  id: string;
  
  /** Novel this gate belongs to */
  novelId: string;
  
  /** Chapter number where this gate was triggered */
  chapterNumber: number;
  
  /** What type of story moment triggered this gate */
  triggerType: TribulationTrigger;
  
  /** The dramatic situation/moment description */
  situation: string;
  
  /** Context about why this moment is significant */
  context: string;
  
  /** The protagonist or main character facing the decision */
  protagonistName: string;
  
  /** The three fate paths to choose from */
  fatePaths: FatePath[];
  
  /** ID of the path selected by the user (if resolved) */
  selectedPathId?: string;
  
  /** The full description of the selected path (for prompt injection) */
  selectedPathDescription?: string;
  
  /** Current status of this gate */
  status: TribulationGateStatus;
  
  /** Timestamp when the gate was created */
  createdAt: number;
  
  /** Timestamp when the user made their choice (if resolved) */
  resolvedAt?: number;
  
  /** If skipped, reason why */
  skipReason?: string;
  
  /** Arc ID if this gate is associated with a specific arc */
  arcId?: string;
  
  /** Thread IDs related to this gate's trigger */
  relatedThreadIds?: string[];
}

/**
 * Configuration for the Tribulation Gate system
 */
export interface TribulationGateConfig {
  /** Whether the system is enabled */
  enabled: boolean;
  
  /** Minimum chapters between gates (prevents too frequent interruptions) */
  minimumChapterGap: number;
  
  /** If set, auto-select a random path after this many milliseconds */
  autoSelectAfterMs?: number;
  
  /** How sensitive the detection should be */
  triggerSensitivity: 'low' | 'medium' | 'high';
  
  /** Trigger types to exclude from detection */
  excludedTriggers?: TribulationTrigger[];
  
  /** Maximum pending gates before forcing resolution */
  maxPendingGates?: number;
  
  /** Whether to show consequences preview */
  showConsequences: boolean;
  
  /** Whether to show risk levels */
  showRiskLevels: boolean;
}

/**
 * Default configuration for the Tribulation Gate system
 */
export const DEFAULT_TRIBULATION_GATE_CONFIG: TribulationGateConfig = {
  enabled: true,
  minimumChapterGap: 15,
  autoSelectAfterMs: undefined, // No auto-select by default
  triggerSensitivity: 'medium',
  excludedTriggers: [],
  maxPendingGates: 3,
  showConsequences: true,
  showRiskLevels: true,
};

/**
 * Result of a tribulation gate detection check
 */
export interface TribulationDetectionResult {
  /** Whether a gate should trigger */
  shouldTrigger: boolean;
  
  /** The type of trigger detected */
  triggerType: TribulationTrigger | null;
  
  /** Description of the dramatic moment */
  situation: string;
  
  /** Additional context about the situation */
  context: string;
  
  /** Protagonist facing the decision */
  protagonistName: string;
  
  /** Confidence score for this detection (0-100) */
  confidence: number;
  
  /** Reason why gate was or wasn't triggered */
  reason: string;
  
  /** Related thread IDs */
  relatedThreadIds?: string[];
  
  /** Related arc ID */
  arcId?: string;
}

/**
 * Keywords that can trigger specific gate types
 */
export const TRIGGER_KEYWORDS: Record<TribulationTrigger, string[]> = {
  realm_breakthrough: [
    'breakthrough', 'break through', 'tribulation', 'ascend', 'advance', 
    'realm', 'bottleneck', 'enlightenment', 'qi condensation', 'foundation establishment',
    'golden core', 'nascent soul', 'transcend'
  ],
  life_death_crisis: [
    'death', 'dying', 'mortal', 'fatal', 'kill', 'survive', 'last breath',
    'brink of death', 'life or death', 'mortal danger', 'certain death'
  ],
  major_confrontation: [
    'confront', 'face', 'showdown', 'battle', 'duel', 'fight', 'clash',
    'final battle', 'ultimate confrontation', 'face to face with'
  ],
  alliance_decision: [
    'ally', 'alliance', 'betray', 'join forces', 'side with', 'faction',
    'choose sides', 'sworn brother', 'covenant'
  ],
  treasure_discovery: [
    'treasure', 'artifact', 'inheritance', 'ancient', 'mysterious object',
    'divine weapon', 'sacred', 'legendary item'
  ],
  identity_revelation: [
    'reveal', 'identity', 'true self', 'unmask', 'secret', 'hidden',
    'true identity', 'conceal', 'disguise'
  ],
  marriage_proposal: [
    'marriage', 'wed', 'betrothal', 'proposal', 'engagement', 'union',
    'dual cultivation partner', 'dao companion'
  ],
  sect_choice: [
    'sect', 'join', 'leave', 'betray', 'faction', 'school', 'clan',
    'become a disciple', 'outer disciple', 'inner disciple', 'core disciple'
  ],
  forbidden_technique: [
    'forbidden', 'taboo', 'demonic', 'dark art', 'sacrifice', 'price',
    'devil technique', 'blood art', 'soul sacrifice'
  ],
  sacrifice_moment: [
    'sacrifice', 'give up', 'price', 'cost', 'trade', 'exchange',
    'pay the price', 'ultimate sacrifice'
  ],
  dao_comprehension: [
    'comprehend', 'dao', 'insight', 'epiphany', 'understand', 'truth',
    'heavenly dao', 'martial intent', 'law comprehension'
  ],
  inheritance_acceptance: [
    'inheritance', 'legacy', 'accept', 'refuse', 'master\'s', 'ancient master',
    'will', 'mantle', 'successor'
  ],
};

/**
 * Display information for trigger types
 */
export const TRIGGER_DISPLAY_INFO: Record<TribulationTrigger, { title: string; icon: string; description: string }> = {
  realm_breakthrough: {
    title: 'Realm Breakthrough',
    icon: '⚡',
    description: 'A critical cultivation breakthrough moment'
  },
  life_death_crisis: {
    title: 'Life or Death',
    icon: '💀',
    description: 'Facing mortal danger with survival uncertain'
  },
  major_confrontation: {
    title: 'Major Confrontation',
    icon: '⚔️',
    description: 'A showdown with significant consequences'
  },
  alliance_decision: {
    title: 'Alliance Decision',
    icon: '🤝',
    description: 'Choosing allies or making enemies'
  },
  treasure_discovery: {
    title: 'Treasure Discovery',
    icon: '💎',
    description: 'A powerful artifact with multiple fates'
  },
  identity_revelation: {
    title: 'Identity Revelation',
    icon: '🎭',
    description: 'A moment of truth about who you are'
  },
  marriage_proposal: {
    title: 'Marriage Proposal',
    icon: '💍',
    description: 'A romantic commitment or rejection'
  },
  sect_choice: {
    title: 'Sect Choice',
    icon: '🏯',
    description: 'A decision about sect loyalty or betrayal'
  },
  forbidden_technique: {
    title: 'Forbidden Technique',
    icon: '🔮',
    description: 'The temptation of forbidden power'
  },
  sacrifice_moment: {
    title: 'Sacrifice',
    icon: '🔥',
    description: 'Giving up something precious'
  },
  dao_comprehension: {
    title: 'Dao Comprehension',
    icon: '☯️',
    description: 'A moment of profound enlightenment'
  },
  inheritance_acceptance: {
    title: 'Inheritance',
    icon: '📜',
    description: 'Accepting or refusing a legacy'
  },
};

/**
 * Raw response from AI when generating fate paths
 */
export interface FatePathGenerationResponse {
  situation: string;
  context: string;
  protagonistName: string;
  paths: Array<{
    label: string;
    description: string;
    consequences: string[];
    riskLevel: string;
    emotionalTone: string;
    affectedCharacters?: string[];
    characterAlignment?: number;
  }>;
  reasoning: string;
}

/**
 * History entry for tracking user choices
 */
export interface TribulationGateHistoryEntry {
  gateId: string;
  novelId: string;
  chapterNumber: number;
  triggerType: TribulationTrigger;
  selectedPathLabel: string;
  selectedPathRisk: FatePathRisk;
  timestamp: number;
}

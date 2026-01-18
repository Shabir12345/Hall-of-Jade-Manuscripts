
export interface Relationship {
  characterId: string;
  type: string;
  history: string;
  impact: string;
}

export interface WorldEntry {
  id: string;
  category: 'Geography' | 'Sects' | 'PowerLevels' | 'Laws' | 'Systems' | 'Techniques' | 'Other';
  title: string;
  content: string;
  realmId: string; // Associated realm
}

export interface Realm {
  id: string;
  name: string;
  description: string;
  status: 'current' | 'archived' | 'future';
}

export interface Territory {
  id: string;
  realmId: string;
  name: string;
  type: 'Empire' | 'Kingdom' | 'Neutral' | 'Hidden';
  description: string;
  // Chapter tracking for rollback
  createdByChapterId?: string;
  lastUpdatedByChapterId?: string;
}

// Items and Techniques System Types
export type ItemCategory = 'Treasure' | 'Equipment' | 'Consumable' | 'Essential';
export type TechniqueCategory = 'Core' | 'Important' | 'Standard' | 'Basic';
export type TechniqueType = 'Cultivation' | 'Combat' | 'Support' | 'Secret' | 'Other';
export type PossessionStatus = 'active' | 'archived' | 'lost' | 'destroyed';
export type MasteryStatus = 'active' | 'archived' | 'forgotten' | 'mastered';

export interface NovelItem {
  id: string;
  novelId: string;
  name: string;
  canonicalName: string; // For fuzzy matching (normalized)
  description: string;
  category: ItemCategory;
  powers: string[]; // Array of abilities/functions
  history: string; // Evolution over chapters
  firstAppearedChapter?: number;
  lastReferencedChapter?: number;
  createdAt: number;
  updatedAt: number;
}

export interface NovelTechnique {
  id: string;
  novelId: string;
  name: string;
  canonicalName: string; // For fuzzy matching (normalized)
  description: string;
  category: TechniqueCategory;
  type: TechniqueType;
  functions: string[]; // Array of abilities
  history: string; // Evolution over chapters
  firstAppearedChapter?: number;
  lastReferencedChapter?: number;
  createdAt: number;
  updatedAt: number;
  // Chapter tracking for rollback
  createdByChapterId?: string;
  lastUpdatedByChapterId?: string;
}

export interface CharacterItemPossession {
  id: string;
  characterId: string;
  itemId: string;
  status: PossessionStatus;
  acquiredChapter?: number;
  archivedChapter?: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterTechniqueMastery {
  id: string;
  characterId: string;
  techniqueId: string;
  status: MasteryStatus;
  masteryLevel: string;
  learnedChapter?: number;
  archivedChapter?: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface Character {
  id: string;
  name: string;
  /** Explicit main character flag (supports multiple protagonists) */
  isProtagonist?: boolean;
  age: string;
  personality: string;
  currentCultivation: string;
  /** Physical appearance description */
  appearance?: string;
  /** Origin story and background */
  background?: string;
  /** Character goals and motivations */
  goals?: string;
  /** Character weaknesses and flaws */
  flaws?: string;
  /** @deprecated Use techniqueMasteries instead. Kept for backward compatibility during migration. */
  skills: string[];
  /** @deprecated Use itemPossessions instead. Kept for backward compatibility during migration. */
  items: string[];
  /** New: Character-technique relationships with status and mastery level */
  techniqueMasteries?: CharacterTechniqueMastery[];
  /** New: Character-item relationships with status */
  itemPossessions?: CharacterItemPossession[];
  notes: string;
  portraitUrl?: string;
  status: 'Alive' | 'Deceased' | 'Unknown';
  relationships: Relationship[];
  // Chapter tracking for rollback
  createdByChapterId?: string;
  lastUpdatedByChapterId?: string;
  updateHistory?: Array<{
    chapterId: string;
    chapterNumber: number;
    changes: string[]; // e.g., ['age', 'cultivation', 'skills']
  }>;
}

export interface LogicAudit {
  startingValue: string;
  theFriction: string;
  theChoice: string;
  resultingValue: string;
  causalityType: 'Therefore' | 'But';
}

export interface Scene {
  id: string;
  chapterId: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  wordCount: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string;
  summary: string;
  logicAudit?: LogicAudit;
  scenes: Scene[];
  createdAt: number;
  // Chapter regeneration tracking
  needsRegeneration?: boolean;
  regenerationReason?: string;
  dependencyOnChapterId?: string;
}

export interface ArcChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: number;
  /** If set, indicates which chapter most recently advanced/completed this item */
  sourceChapterNumber?: number;
}

export interface Arc {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed';
  /** If set, indicates the chapter number where this arc became active */
  startedAtChapter?: number;
  /** If set, indicates the chapter number where this arc ended (completion point) */
  endedAtChapter?: number;
  /** Target number of chapters for this arc (for progress tracking) */
  targetChapters?: number;
  /** Arc progress checklist (story-building elements) */
  checklist?: ArcChecklistItem[];
}

export interface SystemLog {
  id: string;
  message: string;
  type: 'discovery' | 'update' | 'fate' | 'logic';
  timestamp: number;
}

// Story Threads System Types
export type StoryThreadType = 
  | 'enemy'        // Antagonist/opposition threads
  | 'technique'    // Technique-related threads
  | 'item'         // Item-related threads
  | 'location'     // Territory/location threads
  | 'sect'         // Sect/organization threads
  | 'promise'      // Character promises that need fulfillment
  | 'mystery'      // Mysteries that need solving
  | 'relationship' // Relationship threads between characters
  | 'power'        // Power progression/cultivation threads
  | 'quest'        // Quests or missions
  | 'revelation'   // Secrets/revelations that need revealing
  | 'conflict'     // Ongoing conflicts that need resolution
  | 'alliance';    // Alliances/partnerships that form/break
export type ThreadStatus = 'active' | 'paused' | 'resolved' | 'abandoned';
export type ThreadPriority = 'critical' | 'high' | 'medium' | 'low';
export type ThreadEventType = 'introduced' | 'progressed' | 'resolved' | 'hinted';

export interface ThreadProgressionEvent {
  id: string;
  threadId: string;
  chapterNumber: number;
  chapterId: string;
  eventType: ThreadEventType;
  description: string;
  significance: 'major' | 'minor' | 'foreshadowing';
  createdAt: number;
}

export interface StoryThread {
  id: string;
  novelId: string;
  title: string;
  type: StoryThreadType;
  status: ThreadStatus;
  priority: ThreadPriority;
  description: string;
  introducedChapter: number;
  lastUpdatedChapter: number;
  resolvedChapter?: number;
  relatedEntityId?: string;
  relatedEntityType?: string;
  progressionNotes: Array<{
    chapterNumber: number;
    note: string;
    significance: 'major' | 'minor';
  }>;
  resolutionNotes?: string;
  satisfactionScore?: number; // 0-100
  chaptersInvolved: number[];
  createdAt: number;
  updatedAt: number;
}

export interface NovelState {
  id: string;
  title: string;
  genre: string;
  realms: Realm[];
  currentRealmId: string;
  territories: Territory[];
  worldBible: WorldEntry[];
  characterCodex: Character[];
  /** New: Global item registry for the novel */
  novelItems?: NovelItem[];
  /** New: Global technique registry for the novel */
  novelTechniques?: NovelTechnique[];
  plotLedger: Arc[];
  chapters: Chapter[];
  grandSaga: string;
  systemLogs: SystemLog[];
  tags: Tag[];
  writingGoals: WritingGoal[];
  /** Antagonist system: Track all antagonists in the novel */
  antagonists?: Antagonist[];
  /** Foreshadowing system: Track foreshadowing elements */
  foreshadowingElements?: ForeshadowingElement[];
  /** Symbolism system: Track symbolic elements */
  symbolicElements?: SymbolicElement[];
  /** Emotional payoff system: Track emotional payoff moments */
  emotionalPayoffs?: EmotionalPayoffMoment[];
  /** Subtext system: Track subtext elements */
  subtextElements?: SubtextElement[];
  /** Story threads system: Track narrative threads to prevent plot holes */
  storyThreads?: StoryThread[];
  /** Character systems: Track systems that help the main character (cultivation systems, game interfaces, cheat abilities, etc.) */
  characterSystems?: CharacterSystem[];
  /** Last calculated trust score from extraction (stored for dashboard display) */
  lastTrustScore?: {
    overall: number;
    extractionQuality: number;
    connectionQuality: number;
    dataCompleteness: number;
    consistencyScore: number;
    factors: {
      highConfidenceExtractions: number;
      lowConfidenceExtractions: number;
      missingRequiredFields: number;
      inconsistencies: number;
      warnings: number;
    };
  };
  /** Recent auto-connections from extraction (stored for dashboard display) */
  recentAutoConnections?: Array<{
    type: string;
    sourceId: string;
    sourceName: string;
    targetId: string;
    targetName: string;
    confidence: number;
    reason: string;
  }>;
  updatedAt: number;
  createdAt: number;
}

export type ViewType = 'dashboard' | 'world-bible' | 'characters' | 'chapters' | 'editor' | 'planning' | 'library' | 'world-map' | 'storyboard' | 'timeline' | 'beatsheet' | 'matrix' | 'analytics' | 'search' | 'goals' | 'antagonists' | 'character-systems' | 'story-threads' | 'structure-visualizer' | 'engagement-dashboard' | 'tension-curve' | 'theme-evolution' | 'character-psychology' | 'device-dashboard' | 'draft-comparison' | 'excellence-scorecard' | 'improvement-history';

// Style Analysis Types
export interface WritingStyleMetrics {
  averageSentenceLength: number;
  vocabularyComplexity: number; // Unique words / total words ratio
  genreSpecificTerms: string[];
  tone: 'formal' | 'casual' | 'mixed';
  descriptiveRatio: number; // Descriptive sentences / total sentences
  dialogueRatio: number; // Dialogue / total content ratio
  pacingPattern: 'fast' | 'medium' | 'slow';
  narrativePerspective: 'first' | 'third' | 'mixed';
}

export interface CharacterDevelopmentMetrics {
  characterId: string;
  characterName: string;
  arcProgression: {
    stage: 'introduction' | 'development' | 'conflict' | 'resolution' | 'transformation';
    milestones: string[];
  };
  relationshipChanges: {
    targetCharacterId: string;
    relationshipType: string;
    evolution: string;
  }[];
  powerProgression: {
    current: string;
    trajectory: 'rising' | 'plateau' | 'declining';
    breakthroughs: string[];
  };
  voiceConsistency: number; // 0-1 score
}

export interface StoryProgressionMetrics {
  chapterDeltas: {
    chapterNumber: number;
    valueShift: string;
    tensionLevel: 'low' | 'medium' | 'high' | 'peak';
    causalityType: 'Therefore' | 'But';
  }[];
  tensionCurve: {
    currentLevel: 'low' | 'medium' | 'high' | 'peak';
    trend: 'rising' | 'falling' | 'stable';
  };
  plotBeats: {
    type: 'setup' | 'confrontation' | 'climax' | 'resolution';
    chapterNumber: number;
    description: string;
  }[];
  arcStructure: {
    arcId: string;
    stage: 'beginning' | 'middle' | 'end';
    completionPercentage: number;
  }[];
}

export interface StyleProfile {
  metrics: WritingStyleMetrics;
  samplePassages: string[]; // Representative passages showing style
  styleGuidelines: string[]; // Guidelines for maintaining style
  consistencyScore: number; // 0-1 score
}

// Prompt Engineering Types
export interface PromptContext {
  storyState: {
    title: string;
    genre: string;
    grandSaga: string;
    currentRealm: Realm | null;
    territories: Territory[];
    worldBible: WorldEntry[];
  };
  characterContext: {
    codex: Character[];
    developmentMetrics: CharacterDevelopmentMetrics[];
    relationshipMap: Map<string, Relationship[]>;
  };
  styleContext: {
    profile: StyleProfile | null;
    recentPatterns: string[];
  };
  narrativeContext: {
    recentChapters: Chapter[];
    olderChaptersSummary: string;
    activeArc: Arc | null;
    completedArcs: Arc[];
    progressionMetrics: StoryProgressionMetrics;
  };
  arcContext?: {
    arcSummaries: ArcContextSummary[];
    characterArcJourneys: CharacterArcJourney[];
    progressionAnalysis: ArcProgressionAnalysis;
  };
  previousChapterEnding?: string;
  storyStateSummary?: string;
  continuityBridge?: string;
  activePlotThreads?: string[];
  highPriorityPlotThreads?: string[]; // High-priority threads that MUST be addressed
  characterPresenceWarnings?: string[]; // Warnings about missing characters who should appear
  overduePromisesContext?: string; // Overdue promises and high-priority pending promises
  foreshadowingContext?: string;
  emotionalPayoffContext?: string;
  pacingContext?: string;
  symbolismContext?: string;
  antagonistContext?: string;
  systemContext?: string; // Character systems that help the protagonist
  grandSagaCharacters?: Character[]; // Characters mentioned in Grand Saga
  grandSagaExtractedNames?: Array<{ name: string; confidence: number; context: string }>; // Extracted names not yet in codex
  // Comprehensive context sections
  comprehensiveThreadContext?: string; // All threads with status and progression instructions
  comprehensiveCharacterContext?: Array<{ characterId: string; formattedContext: string }>; // Full context for characters appearing in chapter
  openPlotPointsContext?: string; // All unresolved plot points requiring attention
  storyProgressionAnalysis?: string; // How the story is progressing overall
}

export interface PromptBuilderConfig {
  includeFullContext: boolean;
  maxContextLength: number;
  prioritizeRecent: boolean;
  includeStyleGuidelines: boolean;
  includeCharacterDevelopment: boolean;
  includeStoryProgression: boolean;
  includeArcHistory?: boolean;
}

export interface BuiltPrompt {
  systemInstruction: string;
  userPrompt: string;
  contextSummary: string;
  cacheMetadata?: {
    cacheableContent: string;
    dynamicContent: string;
    cacheKey: string;
    estimatedCacheableTokens: number;
    canUseCaching: boolean;
    provider?: 'claude' | 'gemini';
  };
}

// Novelcrafter-Inspired Types

export interface Revision {
  id: string;
  entityType: 'chapter' | 'scene' | 'character' | 'world';
  entityId: string;
  content: any; // JSONB content
  metadata?: {
    userId?: string;
    changeDescription?: string;
    wordCount?: number;
  };
  createdAt: number;
}

export interface Tag {
  id: string;
  novelId: string;
  name: string;
  color?: string;
  category?: 'plot' | 'character' | 'world' | 'theme';
  createdAt: number;
}

export interface WritingGoal {
  id: string;
  novelId: string;
  type: 'daily' | 'weekly' | 'total';
  target: number;
  current: number;
  deadline?: number;
  createdAt: number;
  updatedAt: number;
}

// Reference System Types
export type ReferenceType = 'character' | 'territory' | 'worldEntry' | 'realm' | 'arc' | 'tag';

export interface Reference {
  type: ReferenceType;
  name: string;
  entityId?: string;
  matchText: string; // The full @reference text including @
  startIndex: number; // Position in text where reference starts
  endIndex: number; // Position in text where reference ends
}

export interface ResolvedReference {
  reference: Reference;
  entity: Character | Territory | WorldEntry | Realm | Arc | Tag | null;
  context: string; // Formatted context for AI prompts
}

export interface ReferenceContext {
  references: ResolvedReference[];
  formattedContext: string; // Complete formatted context block for AI
}

export interface EntitySuggestion {
  type: ReferenceType;
  id: string;
  name: string;
  displayName: string;
  description?: string;
  matchScore: number;
}

// Arc Context Analysis Types
export interface ArcCharacterDevelopment {
  characterName: string;
  changes: string[];
  relationships: string[];
  powerProgression?: string;
}

export interface ArcPlotThread {
  description: string;
  status: 'resolved' | 'ongoing' | 'unresolved';
  introducedIn: number;
}

export interface ArcTensionCurve {
  startLevel: 'low' | 'medium' | 'high' | 'peak';
  endLevel: 'low' | 'medium' | 'high' | 'peak';
  peakChapter?: number;
}

export interface ArcContextSummary {
  arcId: string;
  title: string;
  tier: 'recent' | 'middle' | 'old';
  description: string;
  chapters: {
    count: number;
    summaries: string[]; // Full summaries for recent, truncated for others
    keyEvents: string[]; // Only for recent and middle tiers
  };
  characterDevelopment: ArcCharacterDevelopment[];
  plotThreads: ArcPlotThread[];
  tensionCurve: ArcTensionCurve;
  unresolvedElements: string[]; // For carryover to next arcs
  arcOutcome: string; // How the arc concluded and what it set up
}

export interface CharacterArcJourney {
  characterId: string;
  characterName: string;
  arcJourneys: Array<{
    arcId: string;
    arcTitle: string;
    stateAtStart: {
      cultivation?: string;
      relationships: string[];
      goals: string[];
    };
    stateAtEnd: {
      cultivation?: string;
      relationships: string[];
      goals: string[];
    };
    keyChanges: string[];
  }>;
  overallProgression: string; // Summary of character's journey across all arcs
}

export interface ArcProgressionAnalysis {
  tensionEvolution: Array<{
    arcId: string;
    arcTitle: string;
    tensionCurve: ArcTensionCurve;
  }>;
  pacingAnalysis: {
    averageArcLength: number;
    pacingIssues: string[];
    recommendations: string[];
  };
  completionPatterns: {
    arcsResolvedSatisfyingly: number;
    unresolvedElements: number;
    highPriorityUnresolved?: number;
    setupPayoffRatio: number; // How many setups were paid off
  };
  powerScalingPattern?: {
    progression: Array<{
      arcTitle: string;
      powerLevel: string;
      breakthrough: boolean;
    }>;
    scalingIssues: string[];
  };
}

// Antagonist System Types
export type AntagonistType = 'individual' | 'group' | 'system' | 'society' | 'abstract';
export type AntagonistStatus = 'active' | 'defeated' | 'transformed' | 'dormant' | 'hinted';
export type AntagonistDuration = 'chapter' | 'arc' | 'novel' | 'multi_arc';
export type ThreatLevel = 'low' | 'medium' | 'high' | 'extreme';
export type PresenceType = 'direct' | 'mentioned' | 'hinted' | 'influence';
export type AntagonistRole = 'primary' | 'secondary' | 'background' | 'hinted';

export interface Antagonist {
  id: string;
  novelId: string;
  name: string;
  type: AntagonistType;
  description: string;
  motivation: string;
  powerLevel: string;
  status: AntagonistStatus;
  firstAppearedChapter?: number;
  lastAppearedChapter?: number;
  resolvedChapter?: number;
  durationScope: AntagonistDuration;
  threatLevel: ThreatLevel;
  notes: string;
  // Relationships
  relationships?: AntagonistRelationship[];
  // Group members (if type is 'group')
  groupMembers?: AntagonistGroupMember[];
  // Arc associations
  arcAssociations?: AntagonistArcAssociation[];
  createdAt: number;
  updatedAt: number;
  // Chapter tracking for rollback
  createdByChapterId?: string;
  lastUpdatedByChapterId?: string;
}

export interface AntagonistRelationship {
  id: string;
  antagonistId: string;
  characterId: string;
  relationshipType: 'primary_target' | 'secondary_target' | 'ally_of_antagonist' | 'neutral';
  intensity: 'rival' | 'enemy' | 'nemesis' | 'opposition';
  history: string;
  currentState: string;
  createdAt: number;
  updatedAt: number;
}

export interface AntagonistArcAssociation {
  id: string;
  antagonistId: string;
  arcId: string;
  role: AntagonistRole;
  introducedInArc: boolean;
  resolvedInArc: boolean;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface AntagonistGroupMember {
  id: string;
  antagonistId: string; // The group antagonist
  memberCharacterId: string;
  roleInGroup: 'leader' | 'core_member' | 'member' | 'associate';
  joinedChapter?: number;
  leftChapter?: number;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface AntagonistProgression {
  id: string;
  antagonistId: string;
  chapterNumber: number;
  powerLevel: string;
  threatAssessment: string;
  keyEvents: string[];
  relationshipChanges: string;
  notes: string;
  createdAt: number;
}

export interface AntagonistChapterAppearance {
  id: string;
  antagonistId: string;
  chapterId: string;
  presenceType: PresenceType;
  significance: 'major' | 'minor' | 'foreshadowing';
  notes: string;
  createdAt: number;
}

// Character System Types
export type SystemType = 'cultivation' | 'game' | 'cheat' | 'ability' | 'interface' | 'evolution' | 'other';
export type SystemCategory = 'core' | 'support' | 'evolution' | 'utility' | 'combat' | 'passive';
export type SystemStatus = 'active' | 'dormant' | 'upgraded' | 'merged' | 'deactivated';

export interface CharacterSystem {
  id: string;
  novelId: string;
  characterId: string; // The protagonist who owns this system
  name: string;
  type: SystemType;
  category: SystemCategory;
  description: string;
  currentLevel?: string; // Current version/level of the system
  currentVersion?: string;
  status: SystemStatus;
  features: SystemFeature[]; // Array of system features/abilities
  firstAppearedChapter?: number;
  lastUpdatedChapter?: number;
  history: string; // Evolution over chapters
  notes: string;
  createdAt: number;
  updatedAt: number;
  // Chapter tracking for rollback
  createdByChapterId?: string;
  lastUpdatedByChapterId?: string;
}

export interface SystemFeature {
  id: string;
  systemId: string;
  name: string;
  description: string;
  category?: string; // Optional feature category
  unlockedChapter?: number;
  isActive: boolean;
  level?: string; // Feature level/strength
  strength?: number; // Numeric strength if applicable
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface SystemProgression {
  id: string;
  systemId: string;
  chapterNumber: number;
  featuresAdded: string[]; // Feature names or IDs added in this chapter
  featuresUpgraded: string[]; // Feature names or IDs upgraded in this chapter
  levelChanges?: string; // Description of level/version changes
  keyEvents: string[]; // Key events related to the system
  notes: string;
  createdAt: number;
}

export interface SystemChapterAppearance {
  id: string;
  systemId: string;
  chapterId: string;
  presenceType: 'direct' | 'mentioned' | 'hinted' | 'used';
  significance: 'major' | 'minor' | 'foreshadowing';
  featuresUsed?: string[]; // Which features were used in this chapter
  notes: string;
  createdAt: number;
}

// Foreshadowing System Types
export type ForeshadowingType = 'prophecy' | 'symbolic_object' | 'repeated_imagery' | 'mystery' | 'omen' | 'dialogue_hint' | 'action_pattern' | 'environmental';
export type ForeshadowingStatus = 'active' | 'paid_off' | 'subverted' | 'forgotten';
export type ForeshadowingSubtlety = 'obvious' | 'subtle' | 'very_subtle' | 'only_visible_in_retrospect';

export interface ForeshadowingElement {
  id: string;
  novelId: string;
  type: ForeshadowingType;
  content: string; // The actual text/description of the foreshadowing
  introducedChapter: number;
  paidOffChapter?: number;
  status: ForeshadowingStatus;
  subtlety: ForeshadowingSubtlety;
  relatedElement?: string; // What it foreshadows (character, event, object, etc.)
  chaptersReferenced: number[]; // Chapters where this element is referenced
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface SymbolicElement {
  id: string;
  novelId: string;
  name: string; // Object, image, action, etc.
  symbolicMeaning: string; // What it represents
  firstAppearedChapter: number;
  chaptersAppeared: number[];
  evolutionNotes: string[]; // How its meaning has evolved
  relatedThemes: string[];
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// Emotional Payoff System Types
export type EmotionalPayoffType = 'revelation' | 'victory' | 'loss' | 'transformation' | 'reunion' | 'betrayal' | 'sacrifice' | 'redemption';
export type EmotionalIntensity = 1 | 2 | 3 | 4 | 5; // 1 = mild, 5 = extreme

export interface EmotionalPayoffMoment {
  id: string;
  novelId: string;
  type: EmotionalPayoffType;
  description: string;
  chapterNumber: number;
  intensity: EmotionalIntensity;
  charactersInvolved: string[];
  setupChapters: number[]; // Chapters that set up this payoff
  readerImpact: string; // Expected emotional impact on reader
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface EmotionalArcTemplate {
  name: string;
  stages: Array<{
    stage: string;
    emotion: string;
    intensity: EmotionalIntensity;
    description: string;
  }>;
  genre: string[]; // Applicable genres
}

// Subtext System Types
export type SubtextType = 'dialogue' | 'action' | 'description' | 'symbolic_action';

export interface SubtextElement {
  id: string;
  novelId: string;
  chapterId?: string;
  sceneId?: string;
  type: SubtextType;
  surfaceContent: string; // What is said/done on the surface
  hiddenMeaning: string; // What it actually means beneath the surface
  charactersInvolved: string[];
  significance?: 'major' | 'minor' | 'foreshadowing';
  relatedTo?: string; // What it relates to (character, plot thread, theme)
  notes: string;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// WORLD-CLASS NOVEL WRITING ENHANCEMENTS TYPES
// ============================================================================

// Story Structure Types
export interface StoryBeat {
  id: string;
  novelId: string;
  beatType: 'inciting_incident' | 'plot_point_1' | 'midpoint' | 'plot_point_2' | 'climax' | 'resolution';
  structureType: 'three_act' | 'save_cat' | 'hero_journey';
  chapterNumber?: number;
  chapterId?: string;
  description: string;
  strengthScore: number; // 0-100
  positionPercentage: number; // 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface HeroJourneyStage {
  id: string;
  novelId: string;
  stageNumber: number; // 1-12
  stageName: string;
  chapterNumber?: number;
  chapterId?: string;
  characterId?: string;
  isComplete: boolean;
  qualityScore: number; // 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// Theme Evolution Types
export interface ThemeEvolution {
  id: string;
  novelId: string;
  themeName: string;
  themeType: 'primary' | 'secondary' | 'tertiary';
  firstAppearedChapter?: number;
  setupChapter?: number;
  resolutionChapter?: number;
  arcsInvolved: string[];
  frequencyPerChapter: number;
  consistencyScore: number; // 0-100
  depthLevel: 'surface' | 'mid' | 'deep';
  characterConnections: string[];
  philosophicalQuestions: string[];
  evolutionNotes: Array<{ chapter: number; note: string }>;
  createdAt: number;
  updatedAt: number;
}

// Character Psychology Types
export interface CharacterPsychology {
  id: string;
  characterId: string;
  novelId: string;
  chapterNumber?: number;
  psychologicalState: 'stable' | 'conflicted' | 'growing' | 'breaking' | 'transformed';
  internalConflict?: string; // Want vs need
  characterFlaw?: string;
  flawStatus: 'active' | 'acknowledged' | 'working_on' | 'resolved';
  growthStage: 'beginning' | 'development' | 'crisis' | 'resolution';
  growthScore: number; // 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterMotivation {
  id: string;
  characterId: string;
  motivationType: 'primary' | 'secondary' | 'tertiary';
  motivationDescription: string;
  isConflicted: boolean;
  conflictWithMotivationId?: string;
  firstAppearedChapter?: number;
  resolvedChapter?: number;
  evolutionNotes: Array<{ chapter: number; note: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface VoiceAnalysis {
  id: string;
  characterId?: string; // Optional for character-specific voice
  novelId: string;
  chapterNumber?: number;
  distinctivenessScore: number; // 0-100
  averageSentenceLength?: number;
  vocabularySophistication?: number;
  speechPatterns?: Record<string, any>; // Unique speech markers
  voiceConsistencyScore: number; // 0-100
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// Engagement Types
export interface EngagementMetrics {
  id: string;
  novelId: string;
  chapterId: string;
  chapterNumber: number;
  overallEngagementScore: number; // 0-100
  hookStrength: number; // 0-100
  cliffhangerEffectiveness: number; // 0-100
  emotionalResonance: number; // 0-100
  tensionLevel: number; // 0-100
  narrativeMomentum: number; // 0-100
  interestScore: number; // 0-100
  fatigueDetected: boolean;
  peakMoment: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface EmotionalMoment {
  id: string;
  novelId: string;
  chapterId: string;
  sceneId?: string;
  emotionType: 'joy' | 'sadness' | 'anger' | 'fear' | 'surprise' | 'disgust' | 'anticipation' | 'trust' | 'contempt';
  intensity: number; // 0-100
  isSetup: boolean;
  payoffForMomentId?: string;
  description: string;
  createdAt: number;
}

// Comparative Analysis Types
export interface ComparativeAnalysis {
  id: string;
  novelId: string;
  comparisonType: 'structure' | 'pacing' | 'themes' | 'overall';
  benchmarkNovelName?: string;
  similarityScore: number; // 0-100
  strengthAreas: string[];
  improvementAreas: string[];
  detailedComparison: Record<string, any>;
  createdAt: number;
  updatedAt: number;
}

export interface GenreConvention {
  id: string;
  novelId: string;
  conventionName: string;
  conventionCategory?: 'structure' | 'character' | 'world' | 'power';
  adherenceScore: number; // 0-100
  isInnovative: boolean;
  innovationDescription?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MarketReadiness {
  id: string;
  novelId: string;
  commercialAppealScore: number; // 0-100
  literaryMeritScore: number; // 0-100
  originalityScore: number; // 0-100
  readabilityScore: number; // 0-100
  accessibilityScore: number; // 0-100
  overallReadiness: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  createdAt: number;
  updatedAt: number;
}

// Multi-Draft Revision Types
export interface DraftVersion {
  id: string;
  novelId: string;
  draftNumber: number;
  draftName?: string;
  createdFromDraftId?: string;
  qualityScore: number; // 0-100
  structureScore: number; // 0-100
  thematicScore: number; // 0-100
  characterScore: number; // 0-100
  engagementScore: number; // 0-100
  revisionGoals: string[];
  revisionChecklist: Array<{ goal: string; status: 'pending' | 'in_progress' | 'completed'; notes?: string }>;
  createdAt: number;
  completedAt?: number;
  notes?: string;
}

export interface DraftChange {
  id: string;
  draftVersionId: string;
  changeType: 'structure' | 'theme' | 'character' | 'prose' | 'other';
  chapterId?: string;
  changeDescription: string;
  impactAnalysis?: string;
  createdAt: number;
}

// Literary Device Types
export interface LiteraryDevice {
  id: string;
  novelId: string;
  chapterId?: string;
  deviceType: 'foreshadowing' | 'symbolism' | 'metaphor' | 'simile' | 'irony' | 'allusion' | 'imagery' | 'personification' | 'other';
  deviceContent: string;
  frequencyCount: number;
  effectivenessScore: number; // 0-100
  isOverused: boolean;
  isUnderused: boolean;
  relatedDeviceIds: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProseQuality {
  id: string;
  novelId: string;
  chapterId?: string;
  sentenceVarietyScore: number; // 0-100
  averageSentenceLength: number;
  vocabularySophistication: number;
  fleschKincaidScore: number;
  showTellBalance: number; // Percentage of "show" vs "tell"
  rhythmScore: number; // 0-100
  cadencePattern?: string;
  clichesDetected: string[];
  tropesDetected: string[];
  uniqueElements: string[];
  createdAt: number;
  updatedAt: number;
}

// Tension Mapping Types
export interface TensionMapping {
  id: string;
  novelId: string;
  chapterId?: string;
  sceneId?: string;
  tensionLevel: number; // 0-100
  tensionType: 'emotional' | 'physical' | 'psychological' | 'social';
  isPeak: boolean;
  isValley: boolean;
  escalationPattern: 'rising' | 'falling' | 'stable' | 'oscillating';
  releaseAfterTension: boolean;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConflictHierarchy {
  id: string;
  novelId: string;
  conflictLevel: 'story' | 'arc' | 'chapter' | 'scene';
  arcId?: string;
  chapterId?: string;
  sceneId?: string;
  conflictType?: 'man_vs_man' | 'man_vs_self' | 'man_vs_nature' | 'man_vs_society';
  conflictDescription: string;
  isResolved: boolean;
  resolutionChapterId?: string;
  relatedConflictIds: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

// Voice and Originality Types
export interface NovelVoiceAnalysis {
  id: string;
  novelId: string;
  chapterId?: string;
  distinctivenessScore: number; // 0-100
  consistencyScore: number; // 0-100
  styleFingerprint: Record<string, any>; // Unique patterns identified
  voiceEvolutionNotes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OriginalityScores {
  id: string;
  novelId: string;
  plotOriginality: number; // 0-100
  characterOriginality: number; // 0-100
  worldBuildingOriginality: number; // 0-100
  conceptInnovation: number; // 0-100
  overallOriginality: number; // 0-100
  uniqueElements: string[];
  commonTropesDetected: string[];
  freshAngles: string[];
  marketGaps: string[];
  createdAt: number;
  updatedAt: number;
}

// Prompt Engineering Types
export interface PromptEffectiveness {
  id: string;
  novelId: string;
  chapterId?: string;
  promptVersion: string;
  promptTemplateId?: string;
  qualityScore: number; // 0-100
  structureScore?: number; // 0-100
  engagementScore?: number; // 0-100
  userFeedback?: number; // 1-5 rating
  effectivenessMetrics: Record<string, any>;
  createdAt: number;
}

// Authentic Chapter Quality & Originality System Types

export interface ChapterOriginalityScore {
  id: string;
  chapterId: string;
  novelId: string;
  overallOriginality: number; // 0-100
  creativeDistance: number; // 0-100 (distance from training patterns)
  novelMetaphorScore: number; // 0-100
  uniqueImageryScore: number; // 0-100
  sceneConstructionOriginality: number; // 0-100
  emotionalBeatOriginality: number; // 0-100
  genericPatternsDetected: string[];
  mechanicalStructuresDetected: string[];
  derivativeContentFlags: string[];
  clichePatterns: string[];
  createdAt: number;
  updatedAt: number;
}

export interface NarrativeCraftScore {
  id: string;
  chapterId: string;
  novelId: string;
  overallCraftScore: number; // 0-100
  burstinessScore: number; // 0-100 (sentence length variation)
  perplexityScore: number; // 0-100 (vocabulary unpredictability)
  subtextScore: number; // 0-100
  interiorityScore: number; // 0-100
  sceneIntentScore: number; // 0-100
  dialogueNaturalnessScore: number; // 0-100
  repetitivePatterns: string[];
  overexplanationFlags: string[];
  neutralProseFlags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AuthorialVoiceProfile {
  id: string;
  novelId: string;
  preferredSentenceComplexity: {
    min: number;
    max: number;
    average: number;
    variance: number;
  };
  emotionalToneRange: {
    primary: string;
    secondary: string[];
    intensityRange: [number, number]; // 0-100
  };
  thematicFocus: string[];
  stylisticQuirks: string[];
  imperfections: string[]; // Intentional stylistic imperfections
  vocabularyPreferences: {
    common: string[];
    uncommon: string[];
    formalityLevel: 'formal' | 'casual' | 'mixed';
  };
  createdAt: number;
  updatedAt: number;
}

export interface ChapterQualityMetrics {
  chapterId: string;
  qualityCheck: ChapterQualityCheck;
  originalityScore: ChapterOriginalityScore;
  narrativeCraftScore: NarrativeCraftScore;
  voiceConsistencyScore: number; // 0-100
  editorialScore: {
    readability: number; // 0-100
    flow: number; // 0-100
    emotionalAuthenticity: number; // 0-100
    narrativeCoherence: number; // 0-100
    structuralBalance: number; // 0-100
  };
  transitionQualityScore?: number; // 0-100, undefined for first chapter
  shouldRegenerate: boolean;
  regenerationReasons: string[];
  warnings: string[];
  createdAt: number;
}

export interface RegenerationConfig {
  maxAttempts: number; // Default: 3
  criticalThresholds: {
    originality: number; // Default: 60
    narrativeCraft: number; // Default: 65
    voiceConsistency: number; // Default: 70
  };
  minorThresholds: {
    originality: number; // Default: 75
    narrativeCraft: number; // Default: 80
    voiceConsistency: number; // Default: 85
  };
  enabled: boolean; // Default: true
}

export interface RegenerationResult {
  success: boolean;
  chapter: Chapter | null;
  attempts: number;
  finalMetrics: ChapterQualityMetrics | null;
  regenerationHistory: Array<{
    attempt: number;
    metrics: ChapterQualityMetrics;
    reasons: string[];
  }>;
}


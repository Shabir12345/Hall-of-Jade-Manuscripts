/**
 * Narrative Forensics Types (Akasha Recall System)
 * 
 * Types for the narrative forensic scan feature that excavates
 * forgotten plot threads and tracks their recovery.
 */

import { StoryThread, ThreadPriority } from '../types';

// ============================================================================
// NARRATIVE SEED TYPES
// ============================================================================

export type NarrativeSeedType = 
  | 'unanswered_question'   // Questions raised but never answered
  | 'unused_item'           // Items introduced but never used (Chekhov's Gun)
  | 'missing_npc'           // Named NPCs who disappeared
  | 'broken_promise'        // Promises made but not fulfilled
  | 'unresolved_conflict'   // Conflicts started but not concluded
  | 'forgotten_technique'   // Techniques mentioned but never used again
  | 'abandoned_location'    // Locations set up but never revisited
  | 'dangling_mystery'      // Mysteries hinted at but not explored
  | 'chekhov_gun';          // Any setup without payoff

export type NarrativeSeedStatus = 
  | 'discovered'  // Found by scan, not yet verified
  | 'verified'    // Confirmed as a real narrative seed
  | 'approved'    // User approved for recovery
  | 'rejected'    // User rejected (not a real issue)
  | 'converted';  // Converted to a story thread

export interface NarrativeSeed {
  id: string;
  novelId: string;
  
  // Seed identification
  seedType: NarrativeSeedType;
  title: string;
  description: string;
  
  // Origin tracking
  originChapter: number;
  originQuote: string;
  originContext?: string;
  
  // Discovery metadata
  discoveredAt: number;
  discoveredByScanId?: string;
  confidenceScore: number; // 0-100
  
  // Trace-forward results
  lastMentionedChapter?: number;
  mentionCount: number;
  chaptersMentioned: number[];
  
  // Status
  status: NarrativeSeedStatus;
  neglectScore: number; // currentChapter - lastMentionedChapter
  
  // Conversion to thread
  convertedThreadId?: string;
  approvedAt?: number;
  approvedBy?: string;
  
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// EXCAVATION SCAN TYPES
// ============================================================================

export type ExcavationScanStatus = 
  | 'pending'    // Scan queued
  | 'scanning'   // Pass 1: Discovery phase
  | 'tracing'    // Pass 2: Trace-forward phase
  | 'completed'  // Scan finished
  | 'failed';    // Scan failed

export interface ExcavationScan {
  id: string;
  novelId: string;
  
  // Scan parameters
  startChapter: number;
  endChapter: number;
  currentChapter: number;
  
  // Scan results
  seedsDiscovered: number;
  seedsVerified: number;
  seedsStale: number;
  seedsWithMentions: number;
  
  // Narrative debt calculation
  narrativeDebtScore: number;
  debtBreakdown: NarrativeDebtBreakdown;
  
  // Status
  status: ExcavationScanStatus;
  errorMessage?: string;
  
  // Timing
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  
  createdAt: number;
}

export interface NarrativeDebtBreakdown {
  totalUnresolvedHooks: number;
  weightedDebtScore: number;
  byType: Record<NarrativeSeedType, {
    count: number;
    weight: number;
    contribution: number;
  }>;
  highPriorityDebt: number;
  criticalDebt: number;
}

// ============================================================================
// RECOVERED THREAD TYPES
// ============================================================================

export type RecoveryAction = 
  | 'discovered'    // Thread discovered by scan
  | 'approved'      // User approved recovery
  | 'rejected'      // User rejected recovery
  | 'reactivated'   // Thread reactivated in story
  | 'resolved';     // Thread finally resolved

export interface RecoveredThreadHistory {
  id: string;
  threadId: string;
  seedId?: string;
  
  // Recovery details
  action: RecoveryAction;
  actionBy?: string;
  actionNotes?: string;
  
  // Priority tracking
  priorityBefore?: ThreadPriority;
  priorityAfter?: ThreadPriority;
  priorityMultiplierApplied?: number;
  
  // Director integration
  directorNotified: boolean;
  chaptersToReintroduce: number;
  
  createdAt: number;
}

export interface RecoveredThread extends StoryThread {
  isRecovered: true;
  historicalEvidence: HistoricalEvidence;
  neglectScore: number;
  recoveryStatus?: 'pending' | 'approved' | 'reintroducing' | 'reintegrated';
  recoveredAt?: number;
  priorityMultiplier: number;
}

export interface HistoricalEvidence {
  originChapter: number;
  originQuote: string;
  originContext?: string;
  discoveredAt: number;
  scanId?: string;
  mentionHistory: Array<{
    chapter: number;
    quote?: string;
    significance: 'major' | 'minor' | 'passing';
  }>;
}

// ============================================================================
// ARCHEOLOGIST AGENT TYPES
// ============================================================================

export interface ArcheologistRequest {
  novelId: string;
  chapterContent: string;
  chapterNumber: number;
  existingSeeds: NarrativeSeed[];
  existingThreads: StoryThread[];
}

export interface ArcheologistResponse {
  discoveredSeeds: Array<{
    seedType: NarrativeSeedType;
    title: string;
    description: string;
    originQuote: string;
    originContext?: string;
    confidenceScore: number;
    relatedEntities?: string[];
  }>;
  reasoning: string[];
  warnings?: string[];
}

// ============================================================================
// TRACE-FORWARD TYPES
// ============================================================================

export interface TraceForwardRequest {
  novelId: string;
  seed: NarrativeSeed;
  searchFromChapter: number;
  searchToChapter: number;
}

export interface TraceForwardResult {
  seedId: string;
  found: boolean;
  mentions: Array<{
    chapter: number;
    quote?: string;
    similarity: number;
    significance: 'major' | 'minor' | 'passing';
  }>;
  lastMentionedChapter?: number;
  neglectScore: number;
  isStale: boolean;
}

// ============================================================================
// EXCAVATION SERVICE TYPES
// ============================================================================

export interface ExcavationRequest {
  novelId: string;
  startChapter: number;
  endChapter: number;
  options?: {
    seedTypes?: NarrativeSeedType[];
    minConfidence?: number;
    includeResolved?: boolean;
    batchSize?: number;
  };
}

export interface ExcavationResult {
  scanId: string;
  success: boolean;
  seeds: NarrativeSeed[];
  narrativeDebt: NarrativeDebtBreakdown;
  summary: string;
  durationMs: number;
  warnings?: string[];
}

// ============================================================================
// DIRECTOR INTEGRATION TYPES
// ============================================================================

export interface RecoveryDirective {
  threadId: string;
  threadTitle: string;
  priorityMultiplier: number;
  chaptersToReintroduce: number;
  reintroductionStrategy: 'immediate' | 'gradual' | 'callback';
  suggestedBeats: string[];
  historicalContext: string;
}

export interface DirectorRecoveryPayload {
  recoveredThreads: RecoveryDirective[];
  totalNarrativeDebt: number;
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface ExcavationZoneConfig {
  startChapter: number;
  endChapter: number;
  selectedSeedTypes: NarrativeSeedType[];
  autoApproveThreshold?: number;
}

export interface EvidenceCard {
  seed: NarrativeSeed;
  originChapterTitle?: string;
  gapVisualization: {
    originChapter: number;
    lastMentionChapter?: number;
    currentChapter: number;
    gapLength: number;
    isStale: boolean;
  };
  relatedThreads?: StoryThread[];
}

export interface WebOfFateNode {
  id: string;
  type: 'origin' | 'mention' | 'gap' | 'current' | 'reactivation';
  chapter: number;
  label: string;
  isActive: boolean;
  significance?: 'major' | 'minor' | 'passing';
}

export interface WebOfFateLine {
  fromId: string;
  toId: string;
  type: 'solid' | 'dotted' | 'pulsing';
  label?: string;
}

export interface WebOfFateVisualization {
  nodes: WebOfFateNode[];
  lines: WebOfFateLine[];
  seedId: string;
  seedTitle: string;
}

// ============================================================================
// NARRATIVE DEBT CALCULATION
// ============================================================================

/**
 * Weight multipliers for different seed types
 * Higher weight = more urgent to resolve
 */
export const SEED_TYPE_WEIGHTS: Record<NarrativeSeedType, number> = {
  broken_promise: 2.5,      // Promises are sacred in xianxia
  unresolved_conflict: 2.0, // Conflicts need resolution
  chekhov_gun: 1.8,         // Setups need payoffs
  dangling_mystery: 1.5,    // Mysteries intrigue readers
  missing_npc: 1.3,         // Named characters should return
  unanswered_question: 1.2, // Questions need answers
  unused_item: 1.0,         // Items should be used
  forgotten_technique: 0.8, // Techniques can be background
  abandoned_location: 0.6,  // Locations are less urgent
};

/**
 * Neglect thresholds for determining staleness
 */
export const NEGLECT_THRESHOLDS = {
  warning: 10,    // 10 chapters without mention = warning
  stale: 20,      // 20 chapters = stale
  critical: 50,   // 50 chapters = critical
  forgotten: 100, // 100 chapters = likely forgotten
};

/**
 * Calculate narrative debt score
 * D = Σ(Hook_unresolved × Weight)
 */
export function calculateNarrativeDebt(seeds: NarrativeSeed[], _currentChapter?: number): NarrativeDebtBreakdown {
  const byType: NarrativeDebtBreakdown['byType'] = {} as any;
  let totalUnresolvedHooks = 0;
  let weightedDebtScore = 0;
  let highPriorityDebt = 0;
  let criticalDebt = 0;

  // Initialize all types
  for (const seedType of Object.keys(SEED_TYPE_WEIGHTS) as NarrativeSeedType[]) {
    byType[seedType] = { count: 0, weight: SEED_TYPE_WEIGHTS[seedType], contribution: 0 };
  }

  for (const seed of seeds) {
    if (seed.status === 'rejected' || seed.status === 'converted') continue;

    const weight = SEED_TYPE_WEIGHTS[seed.seedType] || 1.0;
    const neglectMultiplier = 1 + (seed.neglectScore / 50); // Increases with neglect
    const contribution = weight * neglectMultiplier;

    byType[seed.seedType].count++;
    byType[seed.seedType].contribution += contribution;
    
    totalUnresolvedHooks++;
    weightedDebtScore += contribution;

    if (seed.neglectScore >= NEGLECT_THRESHOLDS.stale) {
      highPriorityDebt += contribution;
    }
    if (seed.neglectScore >= NEGLECT_THRESHOLDS.critical) {
      criticalDebt += contribution;
    }
  }

  return {
    totalUnresolvedHooks,
    weightedDebtScore: Math.round(weightedDebtScore * 100) / 100,
    byType,
    highPriorityDebt: Math.round(highPriorityDebt * 100) / 100,
    criticalDebt: Math.round(criticalDebt * 100) / 100,
  };
}

/**
 * Heavenly Loom Type Definitions
 * 
 * The Loom is a Narrative Control System that treats story like physics.
 * It tracks thread gravity, velocity, entropy, and payoff debt to ensure
 * long-form narratives (2,000+ chapters) maintain consistency and satisfying payoffs.
 */

// ============================================================================
// Thread Physics Model Types
// ============================================================================

export type ThreadCategory = 'SOVEREIGN' | 'MAJOR' | 'MINOR' | 'SEED';

export type LoomThreadStatus = 
  | 'SEED'      // Mentioned, no obligation yet - protect from early resolution
  | 'OPEN'      // Obligation exists - track & monitor
  | 'ACTIVE'    // Actively shaping scenes - encourage progression
  | 'BLOOMING'  // Payoff window opened - prefer resolution
  | 'STALLED'   // Mentioned but not advanced - increase urgency
  | 'CLOSED'    // Resolved on-screen - archive
  | 'ABANDONED'; // Logically unresolved - trigger alert

export type ProgressType = 'NONE' | 'INFO' | 'ESCALATION' | 'RESOLUTION';

export type MentionType = 'DIRECT' | 'INDIRECT' | 'FORESHADOW' | 'CALLBACK';

export type ConstraintType = 
  | 'MUST_PROGRESS' 
  | 'MUST_ESCALATE' 
  | 'MUST_RESOLVE' 
  | 'FORESHADOW' 
  | 'TOUCH'
  | 'FORBIDDEN_RESOLUTION'
  | 'FORBIDDEN_OUTCOME';

// ============================================================================
// Core Loom Thread (Enhanced StoryThread)
// ============================================================================

export interface LoomThread {
  id: string;
  novelId: string;
  
  // Identity
  signature: string;           // Semantic ID (e.g., REVENGE_SUN_FAMILY)
  title: string;
  category: ThreadCategory;
  loomStatus: LoomThreadStatus;
  
  // Thread Physics
  karmaWeight: number;         // Mass: 1-100, determines narrative gravity
  velocity: number;            // Speed: -10 to +10, progression rate
  payoffDebt: number;          // Accumulated from mentions without progress
  entropy: number;             // Chaos: 0-100, unresolved/contradictory state
  
  // Chapter Tracking
  firstChapter: number;
  lastMentionedChapter: number;
  bloomingChapter?: number;    // When BLOOMING status began
  
  // Metadata
  summary: string;
  participants: string[];      // Character names involved
  resolutionCriteria?: string; // What must happen for valid resolution
  
  // Statistics
  mentionCount: number;
  progressCount: number;
  urgencyScore: number;        // Calculated: (distance × karma) + debt + entropy
  lastProgressType?: ProgressType;
  
  // Manual Overrides
  directorAttentionForced: boolean;
  intentionalAbandonment: boolean;
  abandonmentReason?: string;
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// Thread Mention (Each interaction with a thread)
// ============================================================================

export interface ThreadMention {
  id: string;
  threadId: string;
  chapterNumber: number;
  chapterId: string;
  mentionType: MentionType;
  progressType: ProgressType;
  contextSummary?: string;
  charactersInvolved: string[];
  createdAt: number;
}

// ============================================================================
// Director Constraint (Rules for Writer to follow)
// ============================================================================

export interface DirectorConstraint {
  id: string;
  novelId: string;
  chapterNumber: number;
  threadId?: string;
  threadSignature?: string;
  constraintType: ConstraintType;
  mandatoryDetail: string;
  wasSatisfied: boolean;
  satisfactionNotes?: string;
  createdAt: number;
}

// ============================================================================
// Clerk Audit Result (Narrative auditing output)
// ============================================================================

export interface ClerkThreadUpdate {
  signature: string;
  action: 'CREATE' | 'UPDATE' | 'RESOLVE' | 'STALL';
  category: ThreadCategory;
  progressType: ProgressType;
  summaryDelta: string;
  participants: string[];
  urgencyScore: number;
  logicReasoning: string;
}

export interface ClerkAuditResult {
  id: string;
  novelId: string;
  chapterNumber: number;
  chapterId: string;
  threadUpdates: ClerkThreadUpdate[];
  consistencyWarnings: string[];
  newThreadsCreated: number;
  threadsProgressed: number;
  threadsResolved: number;
  threadsStalled: number;
  processingTimeMs: number;
  createdAt: number;
}

// ============================================================================
// Director Directive (Output for chapter generation)
// ============================================================================

export interface ThreadAnchor {
  signature: string;
  threadId: string;
  requiredAction: 'PROGRESS' | 'ESCALATE' | 'RESOLVE' | 'FORESHADOW' | 'TOUCH';
  mandatoryDetail: string;
  currentUrgency: number;
  karmaWeight: number;
}

export interface DirectorDirective {
  chapterNumber: number;
  primaryGoal: string;
  threadAnchors: ThreadAnchor[];
  forbiddenOutcomes: string[];
  requiredTone: string;
  pacingGuidance: {
    intensity: 'low' | 'medium' | 'high' | 'climactic';
    wordCountTarget: number;
    tensionCurve: 'rising' | 'falling' | 'plateau' | 'spike';
  };
  climaxProtection?: {
    isActive: boolean;
    protectedThreads: string[];
    minimumChaptersUntilResolution: number;
    warningMessage: string;
  };
  warnings: string[];
  reasoning: string[];
}

// ============================================================================
// Loom Configuration
// ============================================================================

export interface LoomConfig {
  id: string;
  novelId: string;
  enabled: boolean;
  
  // Thread Creation Limits
  maxNewThreadsPerChapter: number;
  
  // Physics Parameters
  payoffDebtMultiplier: number;
  entropyDecayRate: number;
  velocityMomentum: number;
  
  // Thresholds
  stallThresholdChapters: number;
  bloomThresholdKarma: number;
  
  // Features
  urgencyCalculationEnabled: boolean;
  autoStallDetection: boolean;
  directorConstraintsPerChapter: number;
  
  // Protected Threads (won't be auto-resolved)
  protectedThreadIds: string[];
  
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_LOOM_CONFIG: Omit<LoomConfig, 'id' | 'novelId' | 'createdAt' | 'updatedAt'> = {
  enabled: true,
  maxNewThreadsPerChapter: 3,
  payoffDebtMultiplier: 1.0,
  entropyDecayRate: 0.1,
  velocityMomentum: 0.8,
  stallThresholdChapters: 5,
  bloomThresholdKarma: 70,
  urgencyCalculationEnabled: true,
  autoStallDetection: true,
  directorConstraintsPerChapter: 3,
  protectedThreadIds: [],
};

// ============================================================================
// Loom Dashboard Types
// ============================================================================

export interface ThreadHealthMetrics {
  threadId: string;
  signature: string;
  pulseColor: 'green' | 'yellow' | 'orange' | 'red' | 'gold';
  healthScore: number;          // 0-100
  crackEffect: boolean;         // High entropy visual
  goldGlow: boolean;            // Blooming payoff window
  payoffHorizon: 'too_early' | 'perfect_window' | 'overdue';
  daysUntilCritical: number;
}

export interface LoomDashboardState {
  threads: LoomThread[];
  healthMetrics: ThreadHealthMetrics[];
  pendingConstraints: DirectorConstraint[];
  recentAudits: ClerkAuditResult[];
  overallHealth: number;
  urgentThreads: LoomThread[];
  bloomingThreads: LoomThread[];
  stalledThreads: LoomThread[];
  config: LoomConfig;
}

// ============================================================================
// Thread Physics Calculations
// ============================================================================

export interface ThreadPhysics {
  mass: number;        // karma_weight
  velocity: number;    // progression rate
  entropy: number;     // chaos level
  distance: number;    // chapters since last interaction
  gravity: number;     // calculated pull toward resolution
  urgency: number;     // overall urgency score
}

export function calculateThreadPhysics(
  thread: LoomThread,
  currentChapter: number
): ThreadPhysics {
  const distance = currentChapter - thread.lastMentionedChapter;
  const mass = thread.karmaWeight;
  const velocity = thread.velocity;
  const entropy = thread.entropy;
  
  // Gravity = mass × (distance / velocity or 1 if velocity is 0)
  const effectiveVelocity = Math.max(1, Math.abs(velocity));
  const gravity = mass * (distance / effectiveVelocity);
  
  // Urgency = (distance × mass) + payoffDebt + entropy
  const urgency = (distance * mass) + thread.payoffDebt + entropy;
  
  return {
    mass,
    velocity,
    entropy,
    distance,
    gravity: Math.round(gravity * 10) / 10,
    urgency: Math.min(1000, Math.round(urgency)),
  };
}

export function calculatePayoffHorizon(
  thread: LoomThread,
  currentChapter: number
): 'too_early' | 'perfect_window' | 'overdue' {
  const threadAge = currentChapter - thread.firstChapter;
  
  // Based on category, determine ideal resolution windows
  const windows: Record<ThreadCategory, { min: number; max: number }> = {
    SOVEREIGN: { min: 50, max: 200 },
    MAJOR: { min: 15, max: 50 },
    MINOR: { min: 3, max: 15 },
    SEED: { min: 1, max: 10 },
  };
  
  const window = windows[thread.category];
  
  if (threadAge < window.min) return 'too_early';
  if (threadAge > window.max) return 'overdue';
  return 'perfect_window';
}

export function getThreadPulseColor(
  thread: LoomThread,
  currentChapter: number
): 'green' | 'yellow' | 'orange' | 'red' | 'gold' {
  // Gold for blooming threads
  if (thread.loomStatus === 'BLOOMING') return 'gold';
  
  const physics = calculateThreadPhysics(thread, currentChapter);
  
  // Red for stalled or abandoned
  if (thread.loomStatus === 'STALLED' || thread.loomStatus === 'ABANDONED') return 'red';
  
  // Based on urgency score
  if (physics.urgency > 500) return 'red';
  if (physics.urgency > 300) return 'orange';
  if (physics.urgency > 100) return 'yellow';
  return 'green';
}

// ============================================================================
// Thread Status Transition Rules
// ============================================================================

export const VALID_STATUS_TRANSITIONS: Record<LoomThreadStatus, LoomThreadStatus[]> = {
  SEED: ['OPEN', 'ABANDONED'],
  OPEN: ['ACTIVE', 'STALLED', 'ABANDONED'],
  ACTIVE: ['BLOOMING', 'STALLED', 'CLOSED'],
  BLOOMING: ['CLOSED', 'STALLED'],
  STALLED: ['ACTIVE', 'BLOOMING', 'ABANDONED'],
  CLOSED: [], // Terminal state
  ABANDONED: [], // Terminal state (unless intentional)
};

export function canTransitionTo(
  currentStatus: LoomThreadStatus,
  targetStatus: LoomThreadStatus
): boolean {
  return VALID_STATUS_TRANSITIONS[currentStatus].includes(targetStatus);
}

export function validateResolution(
  thread: LoomThread,
  currentChapter: number
): { valid: boolean; reason?: string } {
  // Cannot resolve SEED threads directly
  if (thread.loomStatus === 'SEED') {
    return { 
      valid: false, 
      reason: 'SEED threads cannot be resolved directly. They must first become OPEN or ACTIVE.' 
    };
  }
  
  // Check if thread has been through BLOOMING phase
  if (thread.loomStatus !== 'BLOOMING' && thread.category !== 'SEED') {
    const horizon = calculatePayoffHorizon(thread, currentChapter);
    if (horizon === 'too_early') {
      return {
        valid: false,
        reason: `Thread "${thread.title}" is being resolved too early. Consider letting it develop through BLOOMING phase first.`
      };
    }
  }
  
  // Check resolution criteria if defined
  if (thread.resolutionCriteria) {
    return {
      valid: true, // Actual validation happens during Clerk audit
      reason: `Resolution requires: ${thread.resolutionCriteria}`
    };
  }
  
  return { valid: true };
}

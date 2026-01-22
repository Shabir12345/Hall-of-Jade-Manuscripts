/**
 * Thread Physics Engine
 * 
 * The core engine of the Heavenly Loom system. Treats narrative threads like physical
 * objects with mass (karma_weight), velocity, entropy, and gravitational pull toward resolution.
 * 
 * This engine:
 * - Calculates thread urgency based on physics model
 * - Manages thread state transitions
 * - Tracks payoff debt accumulation
 * - Determines when threads enter BLOOMING state
 * - Identifies stalled and at-risk threads
 */

import {
  LoomThread,
  LoomThreadStatus,
  ThreadCategory,
  ProgressType,
  ThreadPhysics,
  ThreadHealthMetrics,
  LoomConfig,
  DEFAULT_LOOM_CONFIG,
  calculateThreadPhysics,
  calculatePayoffHorizon,
  getThreadPulseColor,
  canTransitionTo,
  validateResolution,
} from '../../types/loom';
import { StoryThread, StoryThreadType, ThreadPriority } from '../../types';
import { generateUUID } from '../../utils/uuid';

// ============================================================================
// Thread Conversion (Legacy StoryThread → LoomThread)
// ============================================================================

export function storyThreadToLoomThread(
  thread: StoryThread,
  currentChapter: number
): LoomThread {
  // Map priority to karma weight
  const karmaWeightMap: Record<ThreadPriority, number> = {
    critical: 90,
    high: 70,
    medium: 50,
    low: 30,
  };

  // Map type to category
  const categoryMap: Record<StoryThreadType, ThreadCategory> = {
    enemy: 'MAJOR',
    technique: 'MINOR',
    item: 'MINOR',
    location: 'MINOR',
    sect: 'MAJOR',
    promise: 'MAJOR',
    mystery: 'SOVEREIGN',
    relationship: 'MAJOR',
    power: 'MAJOR',
    quest: 'MAJOR',
    revelation: 'SOVEREIGN',
    conflict: 'MAJOR',
    alliance: 'MINOR',
  };

  // Map status to loom status
  const loomStatusMap: Record<string, LoomThreadStatus> = {
    active: 'ACTIVE',
    paused: 'STALLED',
    resolved: 'CLOSED',
    abandoned: 'ABANDONED',
  };

  // Generate signature from title
  const signature = generateSignature(thread.title, thread.type);

  // Calculate chapters since update for entropy
  const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
  const entropy = Math.min(100, chaptersSinceUpdate * 5);

  return {
    id: thread.id,
    novelId: thread.novelId,
    signature,
    title: thread.title,
    category: categoryMap[thread.type] || 'MINOR',
    loomStatus: loomStatusMap[thread.status] || 'OPEN',
    karmaWeight: karmaWeightMap[thread.priority] || 50,
    velocity: calculateVelocity(thread, currentChapter),
    payoffDebt: calculateInitialPayoffDebt(thread, currentChapter),
    entropy,
    firstChapter: thread.introducedChapter,
    lastMentionedChapter: thread.lastUpdatedChapter,
    summary: thread.description,
    participants: extractParticipants(thread),
    resolutionCriteria: thread.resolutionNotes,
    mentionCount: thread.chaptersInvolved?.length || 1,
    progressCount: thread.progressionNotes?.length || 0,
    urgencyScore: 0, // Will be calculated
    lastProgressType: determineLastProgressType(thread),
    directorAttentionForced: false,
    intentionalAbandonment: false,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

function generateSignature(title: string, type: StoryThreadType): string {
  // Create a semantic signature from title
  const normalized = title
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .slice(0, 4)
    .join('_');
  
  const typePrefix = type.toUpperCase().slice(0, 3);
  return `${typePrefix}_${normalized}`;
}

function calculateVelocity(thread: StoryThread, currentChapter: number): number {
  const progressions = thread.progressionNotes?.length || 0;
  const threadAge = Math.max(1, currentChapter - thread.introducedChapter);
  
  // Velocity = progressions per chapter × 10, capped at ±10
  const rawVelocity = (progressions / threadAge) * 10;
  return Math.min(10, Math.max(-10, Math.round(rawVelocity)));
}

function calculateInitialPayoffDebt(thread: StoryThread, currentChapter: number): number {
  const mentions = thread.chaptersInvolved?.length || 1;
  const progressions = thread.progressionNotes?.length || 0;
  const mentionsWithoutProgress = Math.max(0, mentions - progressions);
  
  // Debt = mentions without progress × karma weight / 10
  const karmaWeight = thread.priority === 'critical' ? 90 :
                      thread.priority === 'high' ? 70 :
                      thread.priority === 'medium' ? 50 : 30;
  
  return Math.round(mentionsWithoutProgress * karmaWeight / 10);
}

function extractParticipants(thread: StoryThread): string[] {
  // Extract character names from progression notes
  const participants = new Set<string>();
  
  thread.progressionNotes?.forEach(note => {
    // Simple extraction - look for capitalized names
    const matches = note.note.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)?/g);
    matches?.forEach(m => participants.add(m));
  });
  
  return Array.from(participants).slice(0, 10);
}

function determineLastProgressType(thread: StoryThread): ProgressType {
  if (thread.status === 'resolved') return 'RESOLUTION';
  if (!thread.progressionNotes || thread.progressionNotes.length === 0) return 'NONE';
  
  const lastNote = thread.progressionNotes[thread.progressionNotes.length - 1];
  if (lastNote.significance === 'major') return 'ESCALATION';
  return 'INFO';
}

// ============================================================================
// Physics Calculations
// ============================================================================

export function calculateUrgency(
  thread: LoomThread,
  currentChapter: number,
  config: Partial<LoomConfig> = {}
): number {
  const physics = calculateThreadPhysics(thread, currentChapter);
  
  // Apply config multipliers
  const debtMultiplier = config.payoffDebtMultiplier ?? DEFAULT_LOOM_CONFIG.payoffDebtMultiplier;
  
  let urgency = physics.urgency;
  
  // Boost urgency for forced attention threads
  if (thread.directorAttentionForced) {
    urgency *= 1.5;
  }
  
  // Reduce urgency for intentionally abandoned threads
  if (thread.intentionalAbandonment) {
    urgency *= 0.1;
  }
  
  // Category multipliers
  const categoryMultipliers: Record<ThreadCategory, number> = {
    SOVEREIGN: 2.0,
    MAJOR: 1.5,
    MINOR: 1.0,
    SEED: 0.5,
  };
  
  urgency *= categoryMultipliers[thread.category];
  
  // Apply debt multiplier
  urgency += thread.payoffDebt * debtMultiplier;
  
  return Math.min(1000, Math.round(urgency));
}

export function calculateNarrativeGravity(
  thread: LoomThread,
  currentChapter: number
): number {
  const physics = calculateThreadPhysics(thread, currentChapter);
  
  // Gravity pulls scenes, characters, and coincidences toward resolution
  // Higher gravity = more likely to be selected by Director
  let gravity = physics.gravity;
  
  // Blooming threads have maximum gravity
  if (thread.loomStatus === 'BLOOMING') {
    gravity *= 2;
  }
  
  // Stalled threads have increased gravity (need attention)
  if (thread.loomStatus === 'STALLED') {
    gravity *= 1.5;
  }
  
  return Math.round(gravity * 10) / 10;
}

// ============================================================================
// State Transition Logic
// ============================================================================

export function determineNextStatus(
  thread: LoomThread,
  currentChapter: number,
  config: Partial<LoomConfig> = {}
): LoomThreadStatus {
  const physics = calculateThreadPhysics(thread, currentChapter);
  const stallThreshold = config.stallThresholdChapters ?? DEFAULT_LOOM_CONFIG.stallThresholdChapters;
  const bloomThreshold = config.bloomThresholdKarma ?? DEFAULT_LOOM_CONFIG.bloomThresholdKarma;
  
  // Check for stalling
  if (physics.distance >= stallThreshold && 
      thread.loomStatus !== 'STALLED' && 
      thread.loomStatus !== 'CLOSED' &&
      thread.loomStatus !== 'ABANDONED') {
    return 'STALLED';
  }
  
  // Check for blooming (payoff window opening)
  if (thread.karmaWeight >= bloomThreshold &&
      thread.loomStatus === 'ACTIVE' &&
      calculatePayoffHorizon(thread, currentChapter) === 'perfect_window') {
    return 'BLOOMING';
  }
  
  // SEED → OPEN when mentioned meaningfully
  if (thread.loomStatus === 'SEED' && thread.progressCount > 0) {
    return 'OPEN';
  }
  
  // OPEN → ACTIVE when regularly progressing
  if (thread.loomStatus === 'OPEN' && thread.velocity > 0 && thread.progressCount >= 2) {
    return 'ACTIVE';
  }
  
  return thread.loomStatus;
}

export function transitionThread(
  thread: LoomThread,
  newStatus: LoomThreadStatus,
  currentChapter: number,
  reason?: string
): LoomThread {
  if (!canTransitionTo(thread.loomStatus, newStatus)) {
    console.warn(`Invalid status transition: ${thread.loomStatus} → ${newStatus} for thread ${thread.signature}`);
    return thread;
  }
  
  const updated = { ...thread, loomStatus: newStatus, updatedAt: Date.now() };
  
  // Track blooming chapter
  if (newStatus === 'BLOOMING' && !thread.bloomingChapter) {
    updated.bloomingChapter = currentChapter;
  }
  
  // Log abandonment reason
  if (newStatus === 'ABANDONED' && reason) {
    updated.abandonmentReason = reason;
  }
  
  return updated;
}

// ============================================================================
// Payoff Debt Management
// ============================================================================

export function incrementPayoffDebt(
  thread: LoomThread,
  mentionWithoutProgress: boolean,
  config: Partial<LoomConfig> = {}
): LoomThread {
  if (!mentionWithoutProgress) {
    // Progress made - reduce debt
    const reduction = Math.round(thread.karmaWeight / 5);
    return {
      ...thread,
      payoffDebt: Math.max(0, thread.payoffDebt - reduction),
      progressCount: thread.progressCount + 1,
      velocity: Math.min(10, thread.velocity + 1),
      updatedAt: Date.now(),
    };
  }
  
  // Mention without progress - increase debt
  const multiplier = config.payoffDebtMultiplier ?? DEFAULT_LOOM_CONFIG.payoffDebtMultiplier;
  const increase = Math.round((thread.karmaWeight / 10) * multiplier);
  
  return {
    ...thread,
    payoffDebt: thread.payoffDebt + increase,
    mentionCount: thread.mentionCount + 1,
    velocity: Math.max(-10, thread.velocity - 1),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Entropy Management
// ============================================================================

export function updateEntropy(
  thread: LoomThread,
  currentChapter: number,
  contradictionDetected: boolean = false,
  config: Partial<LoomConfig> = {}
): LoomThread {
  const decayRate = config.entropyDecayRate ?? DEFAULT_LOOM_CONFIG.entropyDecayRate;
  
  let newEntropy = thread.entropy;
  
  // Entropy increases with contradictions
  if (contradictionDetected) {
    newEntropy = Math.min(100, newEntropy + 20);
  }
  
  // Entropy decays naturally with consistent progression
  if (thread.velocity > 0) {
    newEntropy = Math.max(0, newEntropy - (newEntropy * decayRate));
  }
  
  // Entropy increases when stalled
  if (thread.loomStatus === 'STALLED') {
    const distance = currentChapter - thread.lastMentionedChapter;
    newEntropy = Math.min(100, newEntropy + distance);
  }
  
  return {
    ...thread,
    entropy: Math.round(newEntropy),
    updatedAt: Date.now(),
  };
}

// ============================================================================
// Thread Selection for Director
// ============================================================================

export interface ThreadSelectionResult {
  primaryThreads: LoomThread[];
  secondaryThreads: LoomThread[];
  forbiddenResolutions: LoomThread[];
  reasoning: string[];
}

export function selectThreadsForChapter(
  threads: LoomThread[],
  currentChapter: number,
  config: Partial<LoomConfig> = {}
): ThreadSelectionResult {
  const maxConstraints = config.directorConstraintsPerChapter ?? DEFAULT_LOOM_CONFIG.directorConstraintsPerChapter;
  const reasoning: string[] = [];
  
  // Filter active threads
  const activeThreads = threads.filter(t => 
    t.loomStatus !== 'CLOSED' && 
    t.loomStatus !== 'ABANDONED' &&
    !t.intentionalAbandonment
  );
  
  // Calculate urgency for all
  const threadsWithUrgency = activeThreads.map(t => ({
    thread: t,
    urgency: calculateUrgency(t, currentChapter, config),
    gravity: calculateNarrativeGravity(t, currentChapter),
  }));
  
  // Sort by urgency
  threadsWithUrgency.sort((a, b) => b.urgency - a.urgency);
  
  // Select primary threads (must be touched)
  const primaryThreads: LoomThread[] = [];
  
  // Always include blooming threads
  const bloomingThreads = threadsWithUrgency.filter(t => t.thread.loomStatus === 'BLOOMING');
  bloomingThreads.slice(0, 1).forEach(t => {
    primaryThreads.push(t.thread);
    reasoning.push(`BLOOMING: "${t.thread.title}" is in payoff window (urgency: ${t.urgency})`);
  });
  
  // Always include stalled critical threads
  const stalledCritical = threadsWithUrgency.filter(t => 
    t.thread.loomStatus === 'STALLED' && 
    t.thread.category === 'SOVEREIGN'
  );
  stalledCritical.slice(0, 1).forEach(t => {
    if (!primaryThreads.find(p => p.id === t.thread.id)) {
      primaryThreads.push(t.thread);
      reasoning.push(`STALLED SOVEREIGN: "${t.thread.title}" requires immediate attention (urgency: ${t.urgency})`);
    }
  });
  
  // Include forced attention threads
  const forcedAttention = threadsWithUrgency.filter(t => t.thread.directorAttentionForced);
  forcedAttention.forEach(t => {
    if (!primaryThreads.find(p => p.id === t.thread.id) && primaryThreads.length < maxConstraints) {
      primaryThreads.push(t.thread);
      reasoning.push(`FORCED: "${t.thread.title}" has Director attention forced`);
    }
  });
  
  // Fill remaining slots with highest urgency
  const remaining = threadsWithUrgency.filter(t => 
    !primaryThreads.find(p => p.id === t.thread.id)
  );
  
  while (primaryThreads.length < maxConstraints && remaining.length > 0) {
    const next = remaining.shift()!;
    primaryThreads.push(next.thread);
    reasoning.push(`HIGH URGENCY: "${next.thread.title}" (urgency: ${next.urgency}, gravity: ${next.gravity})`);
  }
  
  // Secondary threads (can be touched but not required)
  const secondaryThreads = remaining
    .slice(0, 5)
    .map(t => t.thread);
  
  // Identify threads that cannot be resolved this chapter
  const forbiddenResolutions = threads.filter(t => {
    if (t.loomStatus === 'SEED') return true;
    const horizon = calculatePayoffHorizon(t, currentChapter);
    return horizon === 'too_early';
  });
  
  return {
    primaryThreads,
    secondaryThreads,
    forbiddenResolutions,
    reasoning,
  };
}

// ============================================================================
// Thread Health Metrics
// ============================================================================

export function calculateThreadHealthMetrics(
  thread: LoomThread,
  currentChapter: number
): ThreadHealthMetrics {
  const physics = calculateThreadPhysics(thread, currentChapter);
  const pulseColor = getThreadPulseColor(thread, currentChapter);
  const payoffHorizon = calculatePayoffHorizon(thread, currentChapter);
  
  // Calculate health score (inverse of urgency, normalized)
  const urgency = calculateUrgency(thread, currentChapter);
  const healthScore = Math.max(0, 100 - Math.round(urgency / 10));
  
  // High entropy = crack effect
  const crackEffect = thread.entropy > 60;
  
  // Blooming = gold glow
  const goldGlow = thread.loomStatus === 'BLOOMING';
  
  // Days until critical (assuming 1 chapter per day average)
  const criticalUrgency = 500;
  const currentRate = urgency > 0 ? physics.distance / urgency : 0;
  const daysUntilCritical = currentRate > 0 
    ? Math.round((criticalUrgency - urgency) / (thread.karmaWeight * currentRate))
    : 999;
  
  return {
    threadId: thread.id,
    signature: thread.signature,
    pulseColor,
    healthScore,
    crackEffect,
    goldGlow,
    payoffHorizon,
    daysUntilCritical: Math.max(0, daysUntilCritical),
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

export function processChapterEnd(
  threads: LoomThread[],
  chapterNumber: number,
  mentionedThreadIds: string[],
  progressedThreadIds: string[],
  config: Partial<LoomConfig> = {}
): LoomThread[] {
  return threads.map(thread => {
    let updated = { ...thread };
    
    // Check if mentioned
    const wasMentioned = mentionedThreadIds.includes(thread.id);
    const wasProgressed = progressedThreadIds.includes(thread.id);
    
    if (wasMentioned) {
      // Update mention tracking
      updated.lastMentionedChapter = chapterNumber;
      updated.mentionCount++;
      
      // Update payoff debt
      updated = incrementPayoffDebt(updated, !wasProgressed, config);
    }
    
    // Update entropy
    updated = updateEntropy(updated, chapterNumber, false, config);
    
    // Check for status transitions
    const nextStatus = determineNextStatus(updated, chapterNumber, config);
    if (nextStatus !== updated.loomStatus) {
      updated = transitionThread(updated, nextStatus, chapterNumber);
    }
    
    // Recalculate urgency
    updated.urgencyScore = calculateUrgency(updated, chapterNumber, config);
    
    return updated;
  });
}

export function getOverallLoomHealth(
  threads: LoomThread[],
  currentChapter: number
): number {
  if (threads.length === 0) return 100;
  
  const activeThreads = threads.filter(t => 
    t.loomStatus !== 'CLOSED' && t.loomStatus !== 'ABANDONED'
  );
  
  if (activeThreads.length === 0) return 100;
  
  const healthScores = activeThreads.map(t => 
    calculateThreadHealthMetrics(t, currentChapter).healthScore
  );
  
  const avgHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
  
  // Penalty for stalled threads
  const stalledCount = activeThreads.filter(t => t.loomStatus === 'STALLED').length;
  const stalledPenalty = stalledCount * 5;
  
  // Penalty for abandoned threads (not intentional)
  const abandonedCount = threads.filter(t => 
    t.loomStatus === 'ABANDONED' && !t.intentionalAbandonment
  ).length;
  const abandonedPenalty = abandonedCount * 10;
  
  return Math.max(0, Math.round(avgHealth - stalledPenalty - abandonedPenalty));
}

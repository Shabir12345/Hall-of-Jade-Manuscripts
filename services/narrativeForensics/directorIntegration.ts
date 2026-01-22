/**
 * Director Integration for Narrative Forensics
 * 
 * Integrates recovered threads with the Director Agent to ensure
 * forgotten plot elements are prioritized in upcoming chapters.
 * 
 * When a recovered thread is approved:
 * 1. Set priority_multiplier to 2.0
 * 2. Create recovery directives for the Director
 * 3. Force the thread into the next 3 chapters for "re-introduction"
 */

import { NovelState } from '../../types';
import { StoryThread } from '../../types';
import {
  RecoveredThread,
  RecoveryDirective,
  DirectorRecoveryPayload,
  NarrativeDebtBreakdown,
  NEGLECT_THRESHOLDS,
} from '../../types/narrativeForensics';
import { logger } from '../loggingService';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface RecoveryIntegrationConfig {
  defaultPriorityMultiplier: number;
  chaptersToReintroduce: number;
  criticalMultiplier: number;
  highMultiplier: number;
  mediumMultiplier: number;
}

const DEFAULT_RECOVERY_CONFIG: RecoveryIntegrationConfig = {
  defaultPriorityMultiplier: 2.0,
  chaptersToReintroduce: 3,
  criticalMultiplier: 3.0,  // Critical threads get 3x priority
  highMultiplier: 2.0,      // High priority threads get 2x
  mediumMultiplier: 1.5,    // Medium priority threads get 1.5x
};

// ============================================================================
// RECOVERY DIRECTIVES
// ============================================================================

/**
 * Create recovery directives for the Director Agent
 */
export function createRecoveryDirectives(
  recoveredThreads: RecoveredThread[],
  novelState: NovelState,
  config: Partial<RecoveryIntegrationConfig> = {}
): DirectorRecoveryPayload {
  const finalConfig = { ...DEFAULT_RECOVERY_CONFIG, ...config };
  const directives: RecoveryDirective[] = [];
  let totalNarrativeDebt = 0;

  for (const thread of recoveredThreads) {
    if (thread.recoveryStatus !== 'approved' && thread.recoveryStatus !== 'reintroducing') {
      continue;
    }

    // Calculate priority multiplier based on neglect score
    let multiplier = finalConfig.defaultPriorityMultiplier;
    if (thread.neglectScore >= NEGLECT_THRESHOLDS.critical) {
      multiplier = finalConfig.criticalMultiplier;
    } else if (thread.neglectScore >= NEGLECT_THRESHOLDS.stale) {
      multiplier = finalConfig.highMultiplier;
    } else {
      multiplier = finalConfig.mediumMultiplier;
    }

    // Determine reintroduction strategy
    const strategy = determineReintroductionStrategy(thread, novelState);

    // Generate suggested beats for reintroduction
    const suggestedBeats = generateSuggestedBeats(thread, strategy);

    // Build historical context summary
    const historicalContext = buildHistoricalContext(thread);

    const directive: RecoveryDirective = {
      threadId: thread.id,
      threadTitle: thread.title,
      priorityMultiplier: multiplier,
      chaptersToReintroduce: finalConfig.chaptersToReintroduce,
      reintroductionStrategy: strategy,
      suggestedBeats,
      historicalContext,
    };

    directives.push(directive);
    totalNarrativeDebt += thread.neglectScore * multiplier;
  }

  // Determine urgency level
  const urgencyLevel = calculateUrgencyLevel(directives, totalNarrativeDebt);

  // Generate recommendations
  const recommendations = generateRecoveryRecommendations(directives, urgencyLevel);

  logger.info(`Created ${directives.length} recovery directives`, 'directorIntegration');

  return {
    recoveredThreads: directives,
    totalNarrativeDebt,
    urgencyLevel,
    recommendations,
  };
}

/**
 * Determine the best strategy for reintroducing a thread
 */
function determineReintroductionStrategy(
  thread: RecoveredThread,
  _novelState: NovelState
): 'immediate' | 'gradual' | 'callback' {
  const neglectScore = thread.neglectScore;

  // Critical neglect: immediate reintroduction needed
  if (neglectScore >= NEGLECT_THRESHOLDS.critical) {
    return 'immediate';
  }

  // Check if this is a promise or conflict - these need more direct handling
  if (thread.type === 'promise' || thread.type === 'conflict') {
    return 'immediate';
  }

  // Mysteries and revelations work well with callbacks
  if (thread.type === 'mystery' || thread.type === 'revelation') {
    return 'callback';
  }

  // Default to gradual for moderate neglect
  if (neglectScore >= NEGLECT_THRESHOLDS.stale) {
    return 'gradual';
  }

  return 'callback';
}

/**
 * Generate suggested beats for reintroducing a thread
 */
function generateSuggestedBeats(
  thread: RecoveredThread,
  strategy: 'immediate' | 'gradual' | 'callback'
): string[] {
  const beats: string[] = [];
  const evidence = thread.historicalEvidence;

  switch (strategy) {
    case 'immediate':
      beats.push(`REVELATION: Directly address "${thread.title}" - readers have been waiting ${thread.neglectScore} chapters`);
      beats.push(`TENSION: Create urgency around this forgotten element`);
      beats.push(`SETUP: Establish consequences for the delay`);
      break;

    case 'gradual':
      beats.push(`FORESHADOW: Subtle hint about "${thread.title}" - a passing mention or visual callback`);
      beats.push(`SETUP: Character remembers or discovers connection to original event (Chapter ${evidence.originChapter})`);
      beats.push(`ESCALATION: Build toward full reintroduction over next 2-3 chapters`);
      break;

    case 'callback':
      beats.push(`CALLBACK: Reference the original scene from Chapter ${evidence.originChapter}`);
      beats.push(`MYSTERY: Deepen the intrigue around "${thread.title}"`);
      beats.push(`REVELATION: Partial reveal that rewards attentive readers`);
      break;
  }

  return beats;
}

/**
 * Build a historical context summary for the Director
 */
function buildHistoricalContext(thread: RecoveredThread): string {
  const evidence = thread.historicalEvidence;
  const parts: string[] = [];

  parts.push(`ORIGIN: Chapter ${evidence.originChapter}`);
  
  if (evidence.originQuote) {
    const truncatedQuote = evidence.originQuote.slice(0, 150);
    parts.push(`ORIGINAL TEXT: "${truncatedQuote}..."`);
  }

  if (evidence.mentionHistory.length > 0) {
    const mentions = evidence.mentionHistory
      .slice(-3)
      .map(m => `Ch.${m.chapter}`)
      .join(', ');
    parts.push(`LAST MENTIONS: ${mentions}`);
  } else {
    parts.push(`LAST MENTIONS: None since origin`);
  }

  parts.push(`NEGLECT: ${thread.neglectScore} chapters without significant mention`);

  return parts.join(' | ');
}

/**
 * Calculate urgency level based on directives
 */
function calculateUrgencyLevel(
  directives: RecoveryDirective[],
  totalDebt: number
): 'low' | 'medium' | 'high' | 'critical' {
  if (totalDebt > 200 || directives.some(d => d.priorityMultiplier >= 3.0)) {
    return 'critical';
  }
  if (totalDebt > 100 || directives.length >= 5) {
    return 'high';
  }
  if (totalDebt > 50 || directives.length >= 3) {
    return 'medium';
  }
  return 'low';
}

/**
 * Generate recommendations for the Director
 */
function generateRecoveryRecommendations(
  directives: RecoveryDirective[],
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical'
): string[] {
  const recommendations: string[] = [];

  if (urgencyLevel === 'critical') {
    recommendations.push(
      '🚨 CRITICAL: Multiple forgotten threads require immediate attention. ' +
      'Consider a "callback chapter" that weaves these elements back into the narrative.'
    );
  }

  // Group by strategy
  const immediate = directives.filter(d => d.reintroductionStrategy === 'immediate');
  const gradual = directives.filter(d => d.reintroductionStrategy === 'gradual');
  const callback = directives.filter(d => d.reintroductionStrategy === 'callback');

  if (immediate.length > 0) {
    recommendations.push(
      `⚡ ${immediate.length} thread(s) need IMMEDIATE reintroduction: ` +
      immediate.map(d => `"${d.threadTitle}"`).join(', ')
    );
  }

  if (gradual.length > 0) {
    recommendations.push(
      `📈 ${gradual.length} thread(s) should be GRADUALLY reintroduced over the next few chapters`
    );
  }

  if (callback.length > 0) {
    recommendations.push(
      `🔗 ${callback.length} thread(s) can use CALLBACK references to reward attentive readers`
    );
  }

  // Pacing advice
  if (directives.length > 3) {
    recommendations.push(
      '⚠️ Too many threads to reintroduce at once. Prioritize the most critical ones first.'
    );
  }

  return recommendations;
}

// ============================================================================
// PROMPT FORMATTING
// ============================================================================

/**
 * Format recovery directives for injection into the Writer prompt
 */
export function formatRecoveryDirectivesForPrompt(
  payload: DirectorRecoveryPayload
): string {
  if (payload.recoveredThreads.length === 0) {
    return '';
  }

  const lines: string[] = [];

  lines.push('=== RECOVERED THREAD DIRECTIVES ===');
  lines.push(`Urgency Level: ${payload.urgencyLevel.toUpperCase()}`);
  lines.push(`Total Narrative Debt: ${payload.totalNarrativeDebt.toFixed(1)}`);
  lines.push('');

  lines.push('THREADS TO REINTRODUCE:');
  for (const directive of payload.recoveredThreads) {
    lines.push(`\n📜 "${directive.threadTitle}" (${directive.reintroductionStrategy.toUpperCase()})`);
    lines.push(`   Priority: ${directive.priorityMultiplier}x | Chapters: ${directive.chaptersToReintroduce}`);
    lines.push(`   Context: ${directive.historicalContext}`);
    lines.push('   Suggested Beats:');
    for (const beat of directive.suggestedBeats) {
      lines.push(`   - ${beat}`);
    }
  }

  lines.push('');
  lines.push('RECOMMENDATIONS:');
  for (const rec of payload.recommendations) {
    lines.push(`- ${rec}`);
  }

  lines.push('');
  lines.push('⚠️ IMPORTANT: These threads have been forgotten for too long. ');
  lines.push('Weave them back naturally but ensure they appear in this chapter.');
  lines.push('=================================');

  return lines.join('\n');
}

// ============================================================================
// AUTO-TRIGGER LOGIC
// ============================================================================

/**
 * Check if narrative debt is high enough to auto-trigger a recall scan
 */
export function shouldTriggerAutoRecall(
  novelState: NovelState,
  debtBreakdown?: NarrativeDebtBreakdown,
  thresholds: { warning: number; critical: number } = { warning: 15, critical: 30 }
): {
  shouldTrigger: boolean;
  reason?: string;
  urgency: 'none' | 'warning' | 'critical';
} {
  // If no debt breakdown provided, we can't determine
  if (!debtBreakdown) {
    return { shouldTrigger: false, urgency: 'none' };
  }

  const currentChapter = novelState.chapters.length;

  // Critical debt threshold
  if (debtBreakdown.criticalDebt > thresholds.critical) {
    return {
      shouldTrigger: true,
      reason: `Critical narrative debt (${debtBreakdown.criticalDebt.toFixed(1)}) exceeds threshold. ` +
              `Multiple plot threads have been forgotten for 50+ chapters.`,
      urgency: 'critical',
    };
  }

  // High priority debt threshold
  if (debtBreakdown.highPriorityDebt > thresholds.warning) {
    return {
      shouldTrigger: true,
      reason: `High narrative debt (${debtBreakdown.highPriorityDebt.toFixed(1)}) detected. ` +
              `Several plot threads are becoming stale.`,
      urgency: 'warning',
    };
  }

  // Check for too many unresolved hooks
  if (debtBreakdown.totalUnresolvedHooks > 20) {
    return {
      shouldTrigger: true,
      reason: `Too many unresolved narrative hooks (${debtBreakdown.totalUnresolvedHooks}). ` +
              `Consider resolving some before adding more.`,
      urgency: 'warning',
    };
  }

  // Periodic scan suggestion (every 50 chapters)
  if (currentChapter > 0 && currentChapter % 50 === 0) {
    return {
      shouldTrigger: true,
      reason: `Periodic narrative forensic scan recommended at Chapter ${currentChapter}.`,
      urgency: 'none',
    };
  }

  return { shouldTrigger: false, urgency: 'none' };
}

/**
 * Get threads that need priority boosting for the next chapter
 */
export function getThreadsForPriorityBoosting(
  threads: StoryThread[],
  recoveredThreads: RecoveredThread[]
): StoryThread[] {
  const boostedThreads: StoryThread[] = [];

  // Add recovered threads that are being reintroduced
  for (const recovered of recoveredThreads) {
    if (recovered.recoveryStatus === 'approved' || recovered.recoveryStatus === 'reintroducing') {
      boostedThreads.push(recovered);
    }
  }

  // Also boost any regular threads that are becoming stale
  const currentChapter = Math.max(...threads.map(t => t.lastUpdatedChapter), 0);
  for (const thread of threads) {
    if (thread.status !== 'active') continue;
    
    const neglect = currentChapter - thread.lastUpdatedChapter;
    if (neglect >= NEGLECT_THRESHOLDS.warning && !boostedThreads.some(t => t.id === thread.id)) {
      boostedThreads.push(thread);
    }
  }

  return boostedThreads;
}

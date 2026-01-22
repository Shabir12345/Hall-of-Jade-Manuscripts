/**
 * Narrative Forensics Module (Akasha Recall System)
 * 
 * Main exports for the narrative forensics system.
 */

export * from './excavationService';
export * from './archeologist';
export * from './directorIntegration';

import { NarrativeSeed, RecoveredThread } from '../../types/narrativeForensics';
import { NovelState } from '../../types';
import { convertSeedToThread, checkSeedAgainstThreads } from '../narrativeIntegrationService';
import { logger } from '../loggingService';

/**
 * Approve a narrative seed and convert it to a Story Thread
 */
export function approveSeed(
  seed: NarrativeSeed,
  novelState: NovelState
): { thread: RecoveredThread; updatedSeed: NarrativeSeed } {
  // Check if seed is already covered by existing threads
  const existingThreads = novelState.storyThreads || [];
  const isDuplicate = checkSeedAgainstThreads(seed, existingThreads);

  if (isDuplicate) {
    logger.warn('Seed appears to duplicate existing thread', 'narrativeForensics', {
      seedId: seed.id,
      seedTitle: seed.title,
    });
  }

  // Convert seed to thread
  const thread = convertSeedToThread(seed, novelState);

  // Update seed status
  const updatedSeed: NarrativeSeed = {
    ...seed,
    status: 'converted',
    convertedThreadId: thread.id,
    approvedAt: Date.now(),
    updatedAt: Date.now(),
  };

  logger.info('Approved Akasha seed and created Story Thread', 'narrativeForensics', {
    seedId: seed.id,
    threadId: thread.id,
    seedType: seed.seedType,
    threadType: thread.type,
  });

  return { thread, updatedSeed };
}

/**
 * Reject a narrative seed (mark as not a real issue)
 */
export function rejectSeed(seed: NarrativeSeed): NarrativeSeed {
  return {
    ...seed,
    status: 'rejected',
    updatedAt: Date.now(),
  };
}

// Re-export types and constants from narrativeForensics types
export type {
  NarrativeSeed,
  NarrativeSeedType,
  NarrativeSeedStatus,
  ExcavationScan,
  ExcavationRequest,
  ExcavationResult,
  TraceForwardResult,
  NarrativeDebtBreakdown,
  RecoveredThread,
  HistoricalEvidence,
  RecoveryDirective,
  DirectorRecoveryPayload,
  WebOfFateVisualization,
  EvidenceCard,
} from '../../types/narrativeForensics';

export {
  calculateNarrativeDebt,
  SEED_TYPE_WEIGHTS,
  NEGLECT_THRESHOLDS,
} from '../../types/narrativeForensics';

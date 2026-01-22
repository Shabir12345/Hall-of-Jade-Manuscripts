/**
 * Excavation Service
 * 
 * Orchestrates the Two-Pass Forensic Logic for narrative thread recovery:
 * 
 * Pass 1: Discovery (Archeologist Agent)
 * - Scans chapter range for narrative seeds
 * 
 * Pass 2: Trace-Forward (Vector Search)
 * - Checks if seeds appear in subsequent chapter summaries
 * - Calculates neglect scores
 * - Determines if threads are stale/forgotten
 */

import { NovelState, StoryThread } from '../../types';
import {
  NarrativeSeed,
  NarrativeSeedType,
  ExcavationRequest,
  ExcavationResult,
  TraceForwardResult,
  NarrativeDebtBreakdown,
  RecoveredThread,
  HistoricalEvidence,
  calculateNarrativeDebt,
  NEGLECT_THRESHOLDS,
} from '../../types/narrativeForensics';
import { runArcheologistBatch } from './archeologist';
import { semanticSearch } from '../vectorDb/semanticSearchService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';

// ============================================================================
// EXCAVATION SERVICE
// ============================================================================

export interface ExcavationConfig {
  minConfidence: number;
  batchSize: number;
  traceForwardTopK: number;
  traceForwardMinScore: number;
  autoApproveThreshold: number;
}

const DEFAULT_EXCAVATION_CONFIG: ExcavationConfig = {
  minConfidence: 60,
  batchSize: 5,
  traceForwardTopK: 10,
  traceForwardMinScore: 0.6,
  autoApproveThreshold: 90, // Auto-approve seeds with 90%+ confidence
};

/**
 * Run a full excavation scan on a chapter range
 */
export async function runExcavation(
  novelState: NovelState,
  request: ExcavationRequest,
  config: Partial<ExcavationConfig> = {},
  onProgress?: (progress: ExcavationProgress) => void
): Promise<ExcavationResult> {
  const startTime = Date.now();
  const finalConfig = { ...DEFAULT_EXCAVATION_CONFIG, ...config };
  const scanId = generateUUID();

  logger.info(`Starting excavation scan ${scanId}`, 'excavation');

  try {
    // Get chapters in range
    const chaptersInRange = novelState.chapters
      .filter(c => c.number >= request.startChapter && c.number <= request.endChapter)
      .sort((a, b) => a.number - b.number);

    if (chaptersInRange.length === 0) {
      return {
        scanId,
        success: false,
        seeds: [],
        narrativeDebt: createEmptyDebtBreakdown(),
        summary: 'No chapters found in the specified range',
        durationMs: Date.now() - startTime,
        warnings: ['No chapters found in range'],
      };
    }

    const currentChapter = novelState.chapters.length;

    // Report initial progress
    if (onProgress) {
      onProgress({
        phase: 'discovery',
        current: 0,
        total: chaptersInRange.length,
        message: 'Starting discovery phase...',
      });
    }

    // ========================================================================
    // PASS 1: DISCOVERY (Archeologist Agent)
    // ========================================================================

    const archeologyResult = await runArcheologistBatch(
      chaptersInRange,
      novelState,
      [],
      { minConfidence: finalConfig.minConfidence },
      (progress) => {
        if (onProgress) {
          onProgress({
            phase: 'discovery',
            current: progress.current,
            total: progress.total,
            message: `Scanning Chapter ${progress.chapter}...`,
          });
        }
      }
    );

    const discoveredSeeds = archeologyResult.allSeeds;

    if (discoveredSeeds.length === 0) {
      return {
        scanId,
        success: true,
        seeds: [],
        narrativeDebt: createEmptyDebtBreakdown(),
        summary: `Scanned ${chaptersInRange.length} chapters. No narrative seeds found.`,
        durationMs: Date.now() - startTime,
        warnings: archeologyResult.warnings,
      };
    }

    // ========================================================================
    // PASS 2: TRACE-FORWARD (Vector Search)
    // ========================================================================

    if (onProgress) {
      onProgress({
        phase: 'tracing',
        current: 0,
        total: discoveredSeeds.length,
        message: 'Starting trace-forward phase...',
      });
    }

    const tracedSeeds: NarrativeSeed[] = [];

    for (let i = 0; i < discoveredSeeds.length; i++) {
      const seed = discoveredSeeds[i];

      if (onProgress) {
        onProgress({
          phase: 'tracing',
          current: i + 1,
          total: discoveredSeeds.length,
          message: `Tracing "${seed.title}"...`,
        });
      }

      // Trace forward from end of scan range to current chapter
      const traceResult = await traceForward(
        novelState,
        seed,
        request.endChapter + 1,
        currentChapter,
        finalConfig
      );

      // Update seed with trace results
      const tracedSeed: NarrativeSeed = {
        ...seed,
        lastMentionedChapter: traceResult.lastMentionedChapter,
        mentionCount: traceResult.mentions.length,
        chaptersMentioned: traceResult.mentions.map(m => m.chapter),
        neglectScore: traceResult.neglectScore,
        status: traceResult.isStale ? 'verified' : 'discovered',
        discoveredByScanId: scanId,
      };

      tracedSeeds.push(tracedSeed);

      // Small delay to avoid rate limits
      if (i < discoveredSeeds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // ========================================================================
    // CALCULATE NARRATIVE DEBT
    // ========================================================================

    const narrativeDebt = calculateNarrativeDebt(tracedSeeds, currentChapter);

    // Generate summary
    const staleCount = tracedSeeds.filter(s => s.neglectScore >= NEGLECT_THRESHOLDS.stale).length;
    const criticalCount = tracedSeeds.filter(s => s.neglectScore >= NEGLECT_THRESHOLDS.critical).length;

    const summary = generateExcavationSummary(
      chaptersInRange.length,
      tracedSeeds.length,
      staleCount,
      criticalCount,
      narrativeDebt.weightedDebtScore
    );

    const durationMs = Date.now() - startTime;

    logger.info(`Excavation scan ${scanId} complete`, 'excavation');

    return {
      scanId,
      success: true,
      seeds: tracedSeeds,
      narrativeDebt,
      summary,
      durationMs,
      warnings: archeologyResult.warnings,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Excavation scan failed', 'excavation', error instanceof Error ? error : undefined);

    return {
      scanId,
      success: false,
      seeds: [],
      narrativeDebt: createEmptyDebtBreakdown(),
      summary: `Excavation failed: ${errorMessage}`,
      durationMs: Date.now() - startTime,
      warnings: [errorMessage],
    };
  }
}

/**
 * Trace a narrative seed forward through subsequent chapters
 */
async function traceForward(
  novelState: NovelState,
  seed: NarrativeSeed,
  fromChapter: number,
  toChapter: number,
  config: ExcavationConfig
): Promise<TraceForwardResult> {
  const mentions: TraceForwardResult['mentions'] = [];

  try {
    // Build search query from seed
    const searchQuery = buildSearchQuery(seed);

    // Search chapter summaries using vector search
    const searchResult = await semanticSearch({
      query: searchQuery,
      novelId: novelState.id,
      types: ['chapter_summary'],
      chapterRange: {
        min: fromChapter,
        max: toChapter,
      },
      topK: config.traceForwardTopK,
      minScore: config.traceForwardMinScore,
    });

    // Process search results
    for (const result of searchResult.results) {
      const chapterNumber = result.metadata.chapterNumber as number;
      if (chapterNumber && chapterNumber >= fromChapter && chapterNumber <= toChapter) {
        mentions.push({
          chapter: chapterNumber,
          similarity: result.score,
          significance: result.score >= 0.8 ? 'major' : result.score >= 0.65 ? 'minor' : 'passing',
        });
      }
    }

    // Sort by chapter number
    mentions.sort((a, b) => a.chapter - b.chapter);

    // Calculate neglect score
    const lastMentionedChapter = mentions.length > 0
      ? Math.max(...mentions.map(m => m.chapter))
      : seed.originChapter;

    const neglectScore = toChapter - lastMentionedChapter;
    const isStale = neglectScore >= NEGLECT_THRESHOLDS.stale;

    return {
      seedId: seed.id,
      found: mentions.length > 0,
      mentions,
      lastMentionedChapter: mentions.length > 0 ? lastMentionedChapter : undefined,
      neglectScore,
      isStale,
    };

  } catch (error) {
    logger.warn(`Trace-forward failed for seed ${seed.id}`, 'excavation');

    // Return default result on error
    const neglectScore = toChapter - seed.originChapter;
    return {
      seedId: seed.id,
      found: false,
      mentions: [],
      neglectScore,
      isStale: neglectScore >= NEGLECT_THRESHOLDS.stale,
    };
  }
}

/**
 * Build a search query from a narrative seed
 */
function buildSearchQuery(seed: NarrativeSeed): string {
  const parts: string[] = [];

  // Add title
  parts.push(seed.title);

  // Add key terms from description
  if (seed.description) {
    parts.push(seed.description);
  }

  // Add origin quote (truncated)
  if (seed.originQuote) {
    const truncatedQuote = seed.originQuote.slice(0, 200);
    parts.push(truncatedQuote);
  }

  return parts.join(' ');
}

/**
 * Convert a narrative seed to a recovered thread
 */
export function convertSeedToThread(
  seed: NarrativeSeed,
  novelId: string,
  _currentChapter?: number
): RecoveredThread {
  // Map seed type to thread type
  const typeMapping: Record<NarrativeSeedType, StoryThread['type']> = {
    unanswered_question: 'mystery',
    unused_item: 'item',
    missing_npc: 'relationship',
    broken_promise: 'promise',
    unresolved_conflict: 'conflict',
    forgotten_technique: 'technique',
    abandoned_location: 'location',
    dangling_mystery: 'mystery',
    chekhov_gun: 'revelation',
  };

  const historicalEvidence: HistoricalEvidence = {
    originChapter: seed.originChapter,
    originQuote: seed.originQuote,
    originContext: seed.originContext,
    discoveredAt: seed.discoveredAt,
    scanId: seed.discoveredByScanId,
    mentionHistory: seed.chaptersMentioned.map(chapter => ({
      chapter,
      significance: 'minor' as const,
    })),
  };

  const thread: RecoveredThread = {
    id: generateUUID(),
    novelId,
    title: seed.title,
    type: typeMapping[seed.seedType] || 'mystery',
    status: 'active',
    priority: seed.neglectScore >= NEGLECT_THRESHOLDS.critical ? 'critical' :
              seed.neglectScore >= NEGLECT_THRESHOLDS.stale ? 'high' : 'medium',
    description: seed.description,
    introducedChapter: seed.originChapter,
    lastUpdatedChapter: seed.lastMentionedChapter || seed.originChapter,
    lastActiveChapter: seed.lastMentionedChapter || seed.originChapter,
    progressionNotes: [{
      chapterNumber: seed.originChapter,
      note: `[RECOVERED] ${seed.originQuote.slice(0, 100)}...`,
      significance: 'major',
    }],
    chaptersInvolved: [seed.originChapter, ...seed.chaptersMentioned],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    // Recovered thread specific fields
    isRecovered: true,
    historicalEvidence,
    neglectScore: seed.neglectScore,
    recoveryStatus: 'approved',
    recoveredAt: Date.now(),
    priorityMultiplier: 2.0, // Double priority for recovered threads
  };

  return thread;
}

/**
 * Approve a narrative seed and convert it to a recovered thread
 */
export async function approveSeed(
  seed: NarrativeSeed,
  novelState: NovelState,
  approvedBy?: string
): Promise<{
  thread: RecoveredThread;
  updatedSeed: NarrativeSeed;
}> {
  // Convert to thread
  const thread = convertSeedToThread(seed, novelState.id, novelState.chapters.length);

  // Update seed status
  const updatedSeed: NarrativeSeed = {
    ...seed,
    status: 'converted',
    convertedThreadId: thread.id,
    approvedAt: Date.now(),
    approvedBy,
    updatedAt: Date.now(),
  };

  logger.info(`Approved narrative seed: ${seed.title}`, 'excavation');

  return { thread, updatedSeed };
}

/**
 * Reject a narrative seed
 */
export function rejectSeed(
  seed: NarrativeSeed,
  _rejectedBy?: string,
  reason?: string
): NarrativeSeed {
  return {
    ...seed,
    status: 'rejected',
    originContext: reason ? `[REJECTED: ${reason}] ${seed.originContext || ''}` : seed.originContext,
    updatedAt: Date.now(),
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export interface ExcavationProgress {
  phase: 'discovery' | 'tracing' | 'complete';
  current: number;
  total: number;
  message: string;
}

function createEmptyDebtBreakdown(): NarrativeDebtBreakdown {
  return {
    totalUnresolvedHooks: 0,
    weightedDebtScore: 0,
    byType: {} as NarrativeDebtBreakdown['byType'],
    highPriorityDebt: 0,
    criticalDebt: 0,
  };
}

function generateExcavationSummary(
  chaptersScanned: number,
  seedsFound: number,
  staleCount: number,
  criticalCount: number,
  debtScore: number
): string {
  const parts: string[] = [];

  parts.push(`Scanned ${chaptersScanned} chapters.`);
  parts.push(`Found ${seedsFound} narrative seeds.`);

  if (staleCount > 0) {
    parts.push(`${staleCount} are stale (20+ chapters without mention).`);
  }

  if (criticalCount > 0) {
    parts.push(`⚠️ ${criticalCount} are CRITICAL (50+ chapters forgotten).`);
  }

  parts.push(`Narrative Debt Score: ${debtScore.toFixed(1)}`);

  if (debtScore > 20) {
    parts.push('Consider resolving some forgotten threads soon.');
  }

  return parts.join(' ');
}

/**
 * Get excavation recommendations based on narrative debt
 */
export function getExcavationRecommendations(
  seeds: NarrativeSeed[],
  debtBreakdown: NarrativeDebtBreakdown
): string[] {
  const recommendations: string[] = [];

  // Critical debt warning
  if (debtBreakdown.criticalDebt > 10) {
    recommendations.push(
      '🚨 CRITICAL: You have significant narrative debt from forgotten plot threads. ' +
      'Readers may have lost track of these elements. Consider a "callback chapter" to reintroduce them.'
    );
  }

  // High priority debt
  if (debtBreakdown.highPriorityDebt > 5) {
    recommendations.push(
      '⚠️ Several plot threads are becoming stale. Weave them back into the narrative soon.'
    );
  }

  // Broken promises are urgent
  const brokenPromises = seeds.filter(s => s.seedType === 'broken_promise' && s.status !== 'rejected');
  if (brokenPromises.length > 0) {
    recommendations.push(
      `📜 ${brokenPromises.length} unfulfilled promise(s) detected. Promises are sacred in xianxia - fulfill them soon.`
    );
  }

  // Chekhov's guns
  const unusedItems = seeds.filter(s => 
    (s.seedType === 'unused_item' || s.seedType === 'chekhov_gun') && 
    s.status !== 'rejected'
  );
  if (unusedItems.length > 0) {
    recommendations.push(
      `🔫 ${unusedItems.length} Chekhov's Gun(s) detected - items/setups that haven't paid off yet.`
    );
  }

  // Missing NPCs
  const missingNpcs = seeds.filter(s => s.seedType === 'missing_npc' && s.status !== 'rejected');
  if (missingNpcs.length > 2) {
    recommendations.push(
      `👤 ${missingNpcs.length} named characters have disappeared. Consider bringing some back.`
    );
  }

  return recommendations;
}

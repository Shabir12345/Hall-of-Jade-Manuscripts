/**
 * Narrative Integration Service
 * 
 * Coordinates between Story Threads, Heavenly Loom, Akasha Recall, and Memory systems.
 * Provides unified narrative intelligence by connecting all four systems.
 */

import { NovelState, StoryThread, ThreadPriority, StoryThreadType } from '../types';
import {
    NarrativeSeed,
    NarrativeSeedType,
    RecoveredThread,
    HistoricalEvidence,
    SEED_TYPE_WEIGHTS,
} from '../types/narrativeForensics';
import { LoomThread } from '../types/loom';
import { ArcMemorySummary, getRelevantArcMemories } from './memory/arcMemoryService';
import { isPineconeReady, getContextForChapterGeneration } from './vectorDb';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';
import { calculateThreadHealth } from './storyThreadService';
import { storyThreadToLoomThread } from './loom';

// ============================================================================
// TYPES
// ============================================================================

export interface EnrichedThread extends StoryThread {
    memoryContext?: {
        arcMemories: ArcMemorySummary[];
        vectorSearchResults: any[];
        relatedSeeds: NarrativeSeed[];
    };
    akashaEvidence?: {
        seedId: string;
        originQuote: string;
        neglectScore: number;
        discoveredAt: number;
    };
    loomStatus?: {
        isInDirective: boolean;
        priorityMultiplier: number;
    };
}

export interface CrossReferences {
    threads: StoryThread[];
    seeds: NarrativeSeed[];
    memoryMentions: { arcId: string; arcTitle: string }[];
    loomMentions: { chapterNumber: number; directive: string }[];
}

export interface ThreadMemoryContext {
    arcMemories: ArcMemorySummary[];
    vectorSearchResults: any[];
    searchQueries: string[];
    tokenCount: number;
}

export interface LoomThreadInput {
    thread: StoryThread;
    priorityMultiplier: number;
    requiresAttention: boolean;
    healthScore: number;
}

// ============================================================================
// SEED TO THREAD CONVERSION
// ============================================================================

/**
 * Map Akasha seed types to Story Thread types
 */
const SEED_TO_THREAD_TYPE_MAP: Record<NarrativeSeedType, StoryThreadType> = {
    broken_promise: 'promise',
    unresolved_conflict: 'conflict',
    chekhov_gun: 'quest',
    dangling_mystery: 'mystery',
    missing_npc: 'relationship',
    unanswered_question: 'mystery',
    unused_item: 'item',
    forgotten_technique: 'technique',
    abandoned_location: 'location',
};

/**
 * Convert neglect score to thread priority
 */
function neglectScoreToPriority(neglectScore: number): ThreadPriority {
    if (neglectScore >= 50) return 'critical';
    if (neglectScore >= 20) return 'high';
    if (neglectScore >= 10) return 'medium';
    return 'low';
}

/**
 * Convert approved Akasha seed to Story Thread
 */
export function convertSeedToThread(
    seed: NarrativeSeed,
    novelState: NovelState
): RecoveredThread {
    const threadType = SEED_TO_THREAD_TYPE_MAP[seed.seedType] || 'quest';
    const priority = neglectScoreToPriority(seed.neglectScore);
    const currentChapter = novelState.chapters.length;

    const historicalEvidence: HistoricalEvidence = {
        originChapter: seed.originChapter,
        originQuote: seed.originQuote,
        originContext: seed.originContext,
        discoveredAt: seed.discoveredAt,
        scanId: seed.discoveredByScanId,
        mentionHistory: seed.chaptersMentioned.map(ch => ({
            chapter: ch,
            significance: ch === seed.originChapter ? 'major' : 'minor' as const,
        })),
    };

    const thread: RecoveredThread = {
        id: generateUUID(),
        novelId: novelState.id,
        title: seed.title,
        type: threadType,
        status: 'active',
        priority,
        description: seed.description,
        introducedChapter: seed.originChapter,
        lastUpdatedChapter: currentChapter,
        lastActiveChapter: seed.lastMentionedChapter || seed.originChapter,
        progressionNotes: [
            {
                chapterNumber: currentChapter,
                note: `Recovered from Akasha Recall scan. Original mention: "${seed.originQuote.slice(0, 100)}..."`,
                significance: 'major',
            },
        ],
        chaptersInvolved: [seed.originChapter, ...seed.chaptersMentioned, currentChapter],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        // Recovered thread specific fields
        isRecovered: true,
        historicalEvidence,
        neglectScore: seed.neglectScore,
        recoveryStatus: 'approved',
        recoveredAt: Date.now(),
        priorityMultiplier: 1 + (seed.neglectScore / 100), // Higher neglect = higher priority
    };

    logger.info('Converted Akasha seed to Story Thread', 'narrativeIntegrationService', {
        seedId: seed.id,
        threadId: thread.id,
        seedType: seed.seedType,
        threadType: thread.type,
        neglectScore: seed.neglectScore,
        priority: thread.priority,
    });

    return thread;
}

// ============================================================================
// THREAD ENRICHMENT WITH MEMORY
// ============================================================================

/**
 * Enrich thread with memory context (arc memories + vector search)
 */
export async function enrichThreadWithMemory(
    thread: StoryThread,
    novelState: NovelState
): Promise<EnrichedThread> {
    const currentChapter = novelState.chapters.length;

    // Get relevant arc memories
    const arcMemories = getRelevantArcMemories(novelState, currentChapter, 3);

    // Filter arc memories that mention this thread
    const relatedArcMemories = arcMemories.filter(arc => {
        const arcRange = arc.endChapter
            ? [arc.startChapter, arc.endChapter]
            : [arc.startChapter, currentChapter];

        // Check if thread was active during this arc
        return thread.introducedChapter <= arcRange[1] &&
            (thread.resolvedChapter === undefined || thread.resolvedChapter >= arcRange[0]);
    });

    // Prepare search queries for vector DB
    const searchQueries = [
        thread.title,
        thread.description,
    ].filter(Boolean);

    let vectorSearchResults: any[] = [];

    // Get vector search results if available
    const pineconeReady = await isPineconeReady();
    if (pineconeReady && searchQueries.length > 0) {
        try {
            const results = await getContextForChapterGeneration(novelState.id, searchQueries, {
                maxCharacters: 3,
                maxWorldEntries: 2,
                maxPlotElements: 2,
                maxPowerElements: 2,
                minScore: 0.6,
            });

            vectorSearchResults = [
                ...results.characters,
                ...results.worldEntries,
                ...results.plotElements,
                ...results.powerElements,
            ];
        } catch (error) {
            logger.warn('Vector search failed for thread enrichment', 'narrativeIntegrationService', {
                error: error instanceof Error ? error.message : String(error),
                threadId: thread.id,
            });
        }
    }

    const enrichedThread: EnrichedThread = {
        ...thread,
        memoryContext: {
            arcMemories: relatedArcMemories,
            vectorSearchResults,
            relatedSeeds: [], // Will be populated by checkSeedAgainstThreads
        },
    };

    return enrichedThread;
}

// ============================================================================
// LOOM DIRECTIVE GENERATION
// ============================================================================

/**
 * Get threads that need Loom Director attention
 */
export function getThreadsForLoomDirective(
    threads: StoryThread[],
    currentChapter: number
): LoomThreadInput[] {
    return threads
        .filter(t => t.status === 'active' || t.status === 'paused')
        .map(thread => {
            const healthScore = calculateThreadHealth(thread, currentChapter);
            const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;

            // Calculate priority multiplier
            let priorityMultiplier = 1.0;

            if (thread.priority === 'critical') priorityMultiplier *= 2.0;
            else if (thread.priority === 'high') priorityMultiplier *= 1.5;

            // Boost neglected threads
            if (chaptersSinceUpdate > 10) priorityMultiplier *= 1.3;
            if (chaptersSinceUpdate > 20) priorityMultiplier *= 1.5;

            // Boost recovered threads
            if ('isRecovered' in thread && thread.isRecovered) {
                priorityMultiplier *= (thread as RecoveredThread).priorityMultiplier;
            }

            const requiresAttention =
                thread.priority === 'critical' ||
                (thread.priority === 'high' && chaptersSinceUpdate > 5) ||
                healthScore < 40;

            return {
                thread,
                priorityMultiplier,
                requiresAttention,
                healthScore,
            };
        })
        .sort((a, b) => {
            // Sort by priority multiplier (descending)
            return b.priorityMultiplier - a.priorityMultiplier;
        });
}

/**
 * Generate Loom threads from Story Threads for Director directive
 */
export function generateLoomThreadsFromStoryThreads(
    threads: StoryThread[],
    currentChapter: number
): LoomThread[] {
    const loomInputs = getThreadsForLoomDirective(threads, currentChapter);

    return loomInputs.map(input => {
        const loomThread = storyThreadToLoomThread(input.thread, currentChapter);

        // Adjust karma weight based on priority multiplier
        loomThread.karmaWeight = Math.min(100, loomThread.karmaWeight * input.priorityMultiplier);

        return loomThread;
    });
}

// ============================================================================
// CROSS-SYSTEM REFERENCES
// ============================================================================

/**
 * Find all references to an entity across all systems
 */
export function getCrossSystemReferences(
    entityId: string,
    entityType: 'thread' | 'seed' | 'character' | 'location' | 'item',
    novelState: NovelState,
    seeds: NarrativeSeed[] = []
): CrossReferences {
    const references: CrossReferences = {
        threads: [],
        seeds: [],
        memoryMentions: [],
        loomMentions: [],
    };

    // Find related threads
    if (entityType === 'seed') {
        // Find threads converted from this seed
        references.threads = (novelState.storyThreads || []).filter(thread => {
            if ('convertedThreadId' in thread) {
                return thread.convertedThreadId === entityId;
            }
            return false;
        });
    } else if (entityType === 'thread') {
        // Find the thread itself
        const thread = (novelState.storyThreads || []).find(t => t.id === entityId);
        if (thread) {
            references.threads = [thread];

            // Find related seeds
            references.seeds = seeds.filter(seed => seed.convertedThreadId === entityId);
        }
    } else {
        // Find threads related to this entity
        references.threads = (novelState.storyThreads || []).filter(thread =>
            thread.relatedEntityId === entityId
        );
    }

    // Find memory mentions (arc memories)
    const currentChapter = novelState.chapters.length;
    const arcMemories = getRelevantArcMemories(novelState, currentChapter, 10);

    references.memoryMentions = arcMemories
        .filter(arc => {
            // Check if any related thread was active during this arc
            return references.threads.some(thread => {
                const arcEnd = arc.endChapter || currentChapter;
                return thread.introducedChapter <= arcEnd &&
                    (thread.resolvedChapter === undefined || thread.resolvedChapter >= arc.startChapter);
            });
        })
        .map(arc => ({
            arcId: arc.arcTitle, // Using title as ID since arcs don't have explicit IDs
            arcTitle: arc.arcTitle,
        }));

    return references;
}

// ============================================================================
// SEED DEDUPLICATION
// ============================================================================

/**
 * Check if a seed is already covered by existing threads
 */
export function checkSeedAgainstThreads(
    seed: NarrativeSeed,
    threads: StoryThread[]
): boolean {
    // Check for exact title match
    const titleMatch = threads.some(thread =>
        thread.title.toLowerCase() === seed.title.toLowerCase()
    );

    if (titleMatch) return true;

    // Check for similar titles (keyword overlap)
    const seedKeywords = seed.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const similarThread = threads.some(thread => {
        const threadKeywords = thread.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const overlap = seedKeywords.filter(kw => threadKeywords.some(tk => tk.includes(kw) || kw.includes(tk)));
        return overlap.length >= Math.min(2, seedKeywords.length * 0.5);
    });

    if (similarThread) return true;

    // Check if thread was introduced around the same chapter
    const chapterMatch = threads.some(thread =>
        Math.abs(thread.introducedChapter - seed.originChapter) <= 2 &&
        thread.type === SEED_TO_THREAD_TYPE_MAP[seed.seedType]
    );

    return chapterMatch;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
    SEED_TO_THREAD_TYPE_MAP,
    neglectScoreToPriority,
};

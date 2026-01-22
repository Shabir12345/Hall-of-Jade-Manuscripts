/**
 * Loom Clerk Service
 * 
 * The Narrative Auditor that analyzes chapters for thread interactions.
 * Unlike the regular Clerk, this focuses on:
 * - Parsing narrative INTENT, not just keywords
 * - Deciding if events CREATE, PROGRESS, STALL, or RESOLVE threads
 * - Tracking payoff debt and fake progress
 * - Enforcing resolution criteria
 */

import { Chapter, NovelState } from '../../types';
import {
  LoomThread,
  ClerkThreadUpdate,
  ClerkAuditResult,
  ProgressType,
  ThreadCategory,
  LoomConfig,
  DEFAULT_LOOM_CONFIG,
} from '../../types/loom';
import { deepseekJson } from '../deepseekService';
import { logger } from '../loggingService';
import { generateUUID } from '../../utils/uuid';
import {
  storyThreadToLoomThread,
  incrementPayoffDebt,
  updateEntropy,
  determineNextStatus,
  transitionThread,
  calculateUrgency,
} from './threadPhysicsEngine';

// ============================================================================
// Clerk Prompts
// ============================================================================

const LOOM_CLERK_SYSTEM_PROMPT = `You are the Heavenly Record-Keeper, a narrative auditor for a long-form fiction engine.

Your role is to analyze each chapter and determine how it interacts with existing narrative threads.
You must think in terms of NARRATIVE OBLIGATIONS, not just mentions.

## CRITICAL RULES:

1. **Do NOT create threads for flavor-only entities**
   - A character who appears once without obligation is NOT a thread
   - A location mentioned in passing is NOT a thread
   - Only create threads when there is a PROMISE to the reader

2. **Do NOT resolve threads unless resolution_criteria are satisfied**
   - If a thread has specific criteria, they MUST be met
   - Partial resolution is ESCALATION, not RESOLUTION

3. **Distinguish REAL progress from FAKE progress**
   - INFO: Just mentioned or discussed (no narrative movement)
   - ESCALATION: Stakes raised, situation changed materially
   - RESOLUTION: Thread completed, promise fulfilled

4. **Track payoff debt implications**
   - Mentioning a thread without progressing it increases reader expectation
   - High-karma threads mentioned without progress = growing debt

## OUTPUT FORMAT (STRICT JSON):

{
  "thread_updates": [
    {
      "signature": "STRING_OR_NEW",
      "action": "CREATE | UPDATE | RESOLVE | STALL",
      "category": "SOVEREIGN | MAJOR | MINOR | SEED",
      "progress_type": "NONE | INFO | ESCALATION | RESOLUTION",
      "summary_delta": "What materially changed",
      "participants": ["NPC_NAMES"],
      "urgency_score": 1-10,
      "logic_reasoning": "Why this is a real narrative obligation"
    }
  ],
  "consistency_warnings": ["Any detected plot risks or contradictions"]
}`;

function buildLoomClerkPrompt(
  chapter: Chapter,
  existingThreads: LoomThread[],
  novelState: NovelState
): string {
  const threadSummaries = existingThreads
    .filter(t => t.loomStatus !== 'CLOSED' && t.loomStatus !== 'ABANDONED')
    .map(t => `- ${t.signature}: "${t.title}" [${t.category}/${t.loomStatus}] karma=${t.karmaWeight}, debt=${t.payoffDebt}
    Summary: ${t.summary}
    ${t.resolutionCriteria ? `Resolution requires: ${t.resolutionCriteria}` : ''}`)
    .join('\n');

  const activeArc = novelState.plotLedger.find(a => a.status === 'active');

  return `## CHAPTER TO AUDIT

**Chapter ${chapter.number}: ${chapter.title}**

${chapter.content.slice(0, 8000)}${chapter.content.length > 8000 ? '\n[... content truncated ...]' : ''}

---

## EXISTING THREADS (Active/Open)

${threadSummaries || 'No existing threads.'}

---

## CURRENT ARC

${activeArc ? `"${activeArc.title}": ${activeArc.description}` : 'No active arc.'}

---

## TASK

Analyze this chapter and determine:
1. Which existing threads were touched? (Even indirectly)
2. Did those touches constitute REAL progress or just mentions?
3. Were any new threads created? (Must be real obligations, not flavor)
4. Were any threads resolved? (Must meet criteria)
5. Any consistency warnings or plot risks?

Remember: Only ESCALATION resets urgency. INFO mentions accumulate payoff debt.`;
}

// ============================================================================
// Main Audit Function
// ============================================================================

type DeepSeekModelType = 'deepseek-chat' | 'deepseek-reasoner';

export interface LoomClerkConfig {
  enabled: boolean;
  model: DeepSeekModelType;
  temperature: number;
  maxTokens: number;
  maxNewThreadsPerChapter: number;
}

const DEFAULT_CLERK_CONFIG: LoomClerkConfig = {
  enabled: true,
  model: 'deepseek-chat',
  temperature: 0.3,
  maxTokens: 4096,
  maxNewThreadsPerChapter: 3,
};

export async function runLoomClerkAudit(
  chapter: Chapter,
  existingThreads: LoomThread[],
  novelState: NovelState,
  loomConfig: Partial<LoomConfig> = {},
  clerkConfig: Partial<LoomClerkConfig> = {}
): Promise<ClerkAuditResult> {
  const startTime = Date.now();
  const config = { ...DEFAULT_CLERK_CONFIG, ...clerkConfig };
  const loom = { ...DEFAULT_LOOM_CONFIG, ...loomConfig };

  if (!config.enabled) {
    return {
      id: generateUUID(),
      novelId: novelState.id,
      chapterNumber: chapter.number,
      chapterId: chapter.id,
      threadUpdates: [],
      consistencyWarnings: [],
      newThreadsCreated: 0,
      threadsProgressed: 0,
      threadsResolved: 0,
      threadsStalled: 0,
      processingTimeMs: Date.now() - startTime,
      createdAt: Date.now(),
    };
  }

  logger.info(`Running Loom Clerk audit for Chapter ${chapter.number}`, 'loom-clerk');

  try {
    const userPrompt = buildLoomClerkPrompt(chapter, existingThreads, novelState);

    const rawResponse = await deepseekJson<{
      thread_updates: Array<{
        signature: string;
        action: string;
        category: string;
        progress_type: string;
        summary_delta: string;
        participants: string[];
        urgency_score: number;
        logic_reasoning: string;
      }>;
      consistency_warnings: string[];
    }>({
      model: config.model,
      system: LOOM_CLERK_SYSTEM_PROMPT,
      user: userPrompt,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    // Process and validate thread updates
    const threadUpdates: ClerkThreadUpdate[] = [];
    let newThreadsCreated = 0;
    let threadsProgressed = 0;
    let threadsResolved = 0;
    let threadsStalled = 0;

    // Limit new threads per chapter
    let newThreadCount = 0;

    for (const update of rawResponse.thread_updates || []) {
      // Validate and normalize
      const action = normalizeAction(update.action);
      const category = normalizeCategory(update.category);
      const progressType = normalizeProgressType(update.progress_type);

      // Check new thread limit
      if (action === 'CREATE') {
        if (newThreadCount >= loom.maxNewThreadsPerChapter) {
          logger.warn(`Skipping new thread "${update.signature}" - max per chapter exceeded`, 'loom-clerk');
          continue;
        }

        // Require logic reasoning for new threads
        if (!update.logic_reasoning || update.logic_reasoning.length < 20) {
          logger.warn(`Skipping new thread "${update.signature}" - insufficient justification`, 'loom-clerk');
          continue;
        }

        newThreadCount++;
        newThreadsCreated++;
      }

      // Check resolution validity
      if (action === 'RESOLVE') {
        const existingThread = existingThreads.find(t => t.signature === update.signature);
        if (existingThread?.resolutionCriteria) {
          // AI should have verified criteria in logic_reasoning
          if (!update.logic_reasoning.toLowerCase().includes('criteria')) {
            logger.warn(`Resolution of "${update.signature}" may not meet criteria`, 'loom-clerk');
          }
        }
        threadsResolved++;
      }

      if (action === 'STALL') {
        threadsStalled++;
      }

      if (action === 'UPDATE' && (progressType === 'ESCALATION' || progressType === 'RESOLUTION')) {
        threadsProgressed++;
      }

      threadUpdates.push({
        signature: update.signature,
        action,
        category,
        progressType,
        summaryDelta: update.summary_delta || '',
        participants: update.participants || [],
        urgencyScore: Math.min(10, Math.max(1, update.urgency_score || 5)),
        logicReasoning: update.logic_reasoning || '',
      });
    }

    const durationMs = Date.now() - startTime;
    logger.info(`Loom Clerk completed in ${durationMs}ms: ${threadUpdates.length} updates`, 'loom-clerk');

    return {
      id: generateUUID(),
      novelId: novelState.id,
      chapterNumber: chapter.number,
      chapterId: chapter.id,
      threadUpdates,
      consistencyWarnings: rawResponse.consistency_warnings || [],
      newThreadsCreated,
      threadsProgressed,
      threadsResolved,
      threadsStalled,
      processingTimeMs: durationMs,
      createdAt: Date.now(),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Loom Clerk audit failed', 'loom-clerk', error instanceof Error ? error : undefined);

    return {
      id: generateUUID(),
      novelId: novelState.id,
      chapterNumber: chapter.number,
      chapterId: chapter.id,
      threadUpdates: [],
      consistencyWarnings: [`Audit failed: ${errorMessage}`],
      newThreadsCreated: 0,
      threadsProgressed: 0,
      threadsResolved: 0,
      threadsStalled: 0,
      processingTimeMs: Date.now() - startTime,
      createdAt: Date.now(),
    };
  }
}

// ============================================================================
// Apply Audit Results
// ============================================================================

export function applyAuditToThreads(
  threads: LoomThread[],
  audit: ClerkAuditResult,
  novelId: string,
  loomConfig: Partial<LoomConfig> = {}
): LoomThread[] {
  const updatedThreads = [...threads];
  const threadMap = new Map(threads.map(t => [t.signature, t]));

  for (const update of audit.threadUpdates) {
    const existingThread = threadMap.get(update.signature);

    if (update.action === 'CREATE' && !existingThread) {
      // Create new thread
      const newThread: LoomThread = {
        id: generateUUID(),
        novelId,
        signature: update.signature,
        title: update.signature.replace(/_/g, ' ').toLowerCase(),
        category: update.category,
        loomStatus: update.category === 'SEED' ? 'SEED' : 'OPEN',
        karmaWeight: categoryToKarma(update.category),
        velocity: 0,
        payoffDebt: 0,
        entropy: 0,
        firstChapter: audit.chapterNumber,
        lastMentionedChapter: audit.chapterNumber,
        summary: update.summaryDelta,
        participants: update.participants,
        mentionCount: 1,
        progressCount: update.progressType !== 'NONE' && update.progressType !== 'INFO' ? 1 : 0,
        urgencyScore: update.urgencyScore * 10,
        lastProgressType: update.progressType,
        directorAttentionForced: false,
        intentionalAbandonment: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      updatedThreads.push(newThread);
      threadMap.set(update.signature, newThread);

    } else if (existingThread) {
      // Update existing thread
      let updated = { ...existingThread };

      // Update mention tracking
      updated.lastMentionedChapter = audit.chapterNumber;
      updated.mentionCount++;

      // Update summary
      if (update.summaryDelta) {
        updated.summary = updated.summary
          ? `${updated.summary}\n[Ch${audit.chapterNumber}] ${update.summaryDelta}`
          : update.summaryDelta;
      }

      // Update participants
      const newParticipants = new Set([...updated.participants, ...update.participants]);
      updated.participants = Array.from(newParticipants);

      // Handle payoff debt based on progress type
      const isRealProgress = update.progressType === 'ESCALATION' || update.progressType === 'RESOLUTION';
      updated = incrementPayoffDebt(updated, !isRealProgress, loomConfig);

      // Handle status changes
      if (update.action === 'RESOLVE') {
        updated = transitionThread(updated, 'CLOSED', audit.chapterNumber);
      } else if (update.action === 'STALL') {
        updated = transitionThread(updated, 'STALLED', audit.chapterNumber);
      } else {
        // Check for automatic status transitions
        const nextStatus = determineNextStatus(updated, audit.chapterNumber, loomConfig);
        if (nextStatus !== updated.loomStatus) {
          updated = transitionThread(updated, nextStatus, audit.chapterNumber);
        }
      }

      // Update entropy
      updated = updateEntropy(updated, audit.chapterNumber, false, loomConfig);

      // Recalculate urgency
      updated.urgencyScore = calculateUrgency(updated, audit.chapterNumber, loomConfig);
      updated.lastProgressType = update.progressType;

      // Replace in array
      const idx = updatedThreads.findIndex(t => t.id === existingThread.id);
      if (idx >= 0) {
        updatedThreads[idx] = updated;
      }
    }
  }

  return updatedThreads;
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeAction(action: string): 'CREATE' | 'UPDATE' | 'RESOLVE' | 'STALL' {
  const normalized = action?.toUpperCase();
  if (['CREATE', 'UPDATE', 'RESOLVE', 'STALL'].includes(normalized)) {
    return normalized as 'CREATE' | 'UPDATE' | 'RESOLVE' | 'STALL';
  }
  return 'UPDATE';
}

function normalizeCategory(category: string): ThreadCategory {
  const normalized = category?.toUpperCase();
  if (['SOVEREIGN', 'MAJOR', 'MINOR', 'SEED'].includes(normalized)) {
    return normalized as ThreadCategory;
  }
  return 'MINOR';
}

function normalizeProgressType(progressType: string): ProgressType {
  const normalized = progressType?.toUpperCase();
  if (['NONE', 'INFO', 'ESCALATION', 'RESOLUTION'].includes(normalized)) {
    return normalized as ProgressType;
  }
  return 'INFO';
}

function categoryToKarma(category: ThreadCategory): number {
  const karmaMap: Record<ThreadCategory, number> = {
    SOVEREIGN: 90,
    MAJOR: 70,
    MINOR: 40,
    SEED: 20,
  };
  return karmaMap[category] || 50;
}

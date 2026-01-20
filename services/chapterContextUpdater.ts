/**
 * Chapter Context Updater
 * Updates all context tracking after chapter generation
 * Updates thread statuses, character states, plot point tracking, and story progression metrics
 * 
 * Now includes the Clerk Agent for Lore Bible updates (Heavenly Record-Keeper)
 */

import { NovelState, Chapter, PostChapterExtraction, StoryThread } from '../types';
import { processThreadUpdates } from './storyThreadService';
import { saveStoryThread, saveThreadProgressionEvent } from './threadService';
import { getEntityStateTracker } from './entityStateTracker';
import { logger } from './loggingService';

// Clerk Agent imports
import { runClerkAudit, hasMeaningfulUpdates, getDeltaSummary } from './clerk/clerkAgent';
import { getOrBuildLoreBible, applyDeltaToLoreBible, createLoreBibleSnapshot } from './loreBible/loreBibleService';
import { ClerkConfig, DEFAULT_CLERK_CONFIG } from '../types/clerk';

/**
 * Update context tracking after chapter generation
 * @param clerkConfig - Optional configuration for the Clerk agent
 */
export async function updateContextAfterChapter(
  state: NovelState,
  newChapter: Chapter,
  extraction: PostChapterExtraction,
  clerkConfig?: Partial<ClerkConfig>
): Promise<void> {
  try {
    // Update thread progression events
    if (extraction.threadUpdates && extraction.threadUpdates.length > 0) {
      const threadResults = processThreadUpdates(
        extraction.threadUpdates,
        state.storyThreads,
        state.id,
        newChapter.number,
        newChapter.id,
        state
      );

      // Save updated threads and progression events
      for (const result of threadResults) {
        try {
          await saveStoryThread(result.thread);
          
          if (result.progressionEvent) {
            await saveThreadProgressionEvent(result.progressionEvent);
          }
        } catch (error) {
          console.error(`Failed to save thread ${result.thread.id}:`, error);
        }
      }
    }

    // Update character state snapshots
    const stateTracker = getEntityStateTracker();
    
    if (extraction.characterUpserts) {
      extraction.characterUpserts.forEach(upsert => {
        const character = state.characterCodex.find(c =>
          c.name.toLowerCase() === (upsert.name || '').toLowerCase()
        );

        if (character) {
          // Get previous state
          const previousState = stateTracker.getCurrentState('character', character.id);
          
          // Build current state
          const currentState: Record<string, any> = {
            name: character.name,
            age: upsert.set?.age || character.age,
            personality: upsert.set?.personality || character.personality,
            currentCultivation: upsert.set?.currentCultivation || character.currentCultivation,
            status: upsert.set?.status || character.status,
            isProtagonist: character.isProtagonist,
            appearance: upsert.set?.appearance || character.appearance,
            background: upsert.set?.background || character.background,
            goals: upsert.set?.goals || character.goals,
            flaws: upsert.set?.flaws || character.flaws,
            notes: upsert.set?.notes || character.notes,
            relationships: character.relationships,
            itemPossessions: character.itemPossessions,
            techniqueMasteries: character.techniqueMasteries,
          };

          // Track state change
          stateTracker.trackStateChange(
            'character',
            character.id,
            newChapter.id,
            newChapter.number,
            currentState,
            previousState || undefined
          );
        }
      });
    }

    // =========================================================================
    // CLERK AGENT - Heavenly Record-Keeper
    // Update the Lore Bible with AI-powered state auditing
    // =========================================================================
    await runClerkAgentUpdate(state, newChapter, clerkConfig);

    // Plot point resolution tracking is handled by:
    // 1. Thread updates (via processThreadUpdates)
    // 2. Character state tracking (via stateTracker)
    // 3. Story progression analysis (calculated dynamically)
    // 4. Lore Bible updates (via Clerk agent) - NEW

    // Story progression metrics are calculated dynamically from current state
    // No explicit updates needed here - they're computed on-demand during context gathering

  } catch (error) {
    console.error('Error updating context after chapter:', error);
    // Don't throw - context updates are non-critical
  }
}

/**
 * Run the Clerk agent to update the Lore Bible
 * This is the "Heavenly Record-Keeper" that maintains narrative consistency
 */
async function runClerkAgentUpdate(
  state: NovelState,
  newChapter: Chapter,
  config?: Partial<ClerkConfig>
): Promise<void> {
  const finalConfig = { ...DEFAULT_CLERK_CONFIG, ...config };

  // Skip if Clerk is disabled
  if (!finalConfig.enabled) {
    logger.debug('Clerk agent disabled, skipping Lore Bible update', 'clerk');
    return;
  }

  try {
    logger.info(`Clerk agent starting audit for Chapter ${newChapter.number}`, 'clerk');

    // Get current Lore Bible
    const currentBible = getOrBuildLoreBible(state);

    // Create snapshot before Clerk update (for potential rollback)
    const snapshot = createLoreBibleSnapshot(currentBible, 'before_clerk');
    logger.debug('Created pre-Clerk snapshot', 'clerk', {
      snapshotId: snapshot.id,
      chapterNumber: snapshot.chapterNumber,
    });

    // Run the Clerk audit
    const clerkResult = await runClerkAudit(state, newChapter, finalConfig);

    if (!clerkResult.success) {
      logger.error('Clerk audit failed', 'clerk', undefined, {
        error: clerkResult.error,
        chapterNumber: newChapter.number,
      });
      return;
    }

    // Check if there are meaningful updates
    if (!clerkResult.delta || !hasMeaningfulUpdates(clerkResult.delta)) {
      logger.info('Clerk found no meaningful updates for this chapter', 'clerk', {
        chapterNumber: newChapter.number,
      });
      return;
    }

    // Log delta summary
    const summary = getDeltaSummary(clerkResult.delta);
    logger.info(`Clerk audit complete: ${summary}`, 'clerk', {
      chapterNumber: newChapter.number,
      durationMs: clerkResult.durationMs,
      warningCount: clerkResult.delta.observations.warnings.length,
      flagCount: clerkResult.delta.observations.continuityFlags.length,
    });

    // Apply the delta to the Lore Bible
    const { bible: updatedBible, result: applyResult } = applyDeltaToLoreBible(
      currentBible,
      clerkResult.delta
    );

    if (applyResult.success) {
      logger.info('Lore Bible updated successfully', 'clerk', {
        chapterNumber: newChapter.number,
        changesApplied: applyResult.changesApplied.length,
        newVersion: updatedBible.version,
      });

      // Log specific changes for debugging
      if (applyResult.changesApplied.length > 0) {
        logger.debug('Lore Bible changes', 'clerk', {
          changes: applyResult.changesApplied.slice(0, 10), // First 10
        });
      }
    } else {
      logger.warn('Lore Bible update had errors', 'clerk', {
        errors: applyResult.errors,
        changesApplied: applyResult.changesApplied.length,
      });
    }

    // Log any continuity warnings
    const criticalFlags = clerkResult.delta.observations.continuityFlags.filter(
      f => f.severity === 'critical'
    );
    if (criticalFlags.length > 0) {
      logger.warn('Clerk detected critical continuity issues', 'clerk', {
        flags: criticalFlags.map(f => ({
          type: f.type,
          message: f.message,
          suggestion: f.suggestion,
        })),
      });
    }

  } catch (error) {
    // Clerk errors are non-critical - log and continue
    logger.error('Clerk agent error', 'clerk', error instanceof Error ? error : undefined, {
      chapterNumber: newChapter.number,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Initialize context tracking for a new chapter
 * Called before chapter generation to prepare context
 */
export function initializeContextForChapter(
  state: NovelState,
  nextChapterNumber: number
): {
  charactersToTrack: string[];
  threadsToConsider: StoryThread[];
} {
  // Get characters from previous chapter ending
  const previousChapter = state.chapters[state.chapters.length - 1];
  const charactersToTrack = previousChapter
    ? state.characterCodex
        .filter(c => {
          // Check if character appears in last 1000 characters of previous chapter
          const content = previousChapter.content.slice(-1000).toLowerCase();
          return content.includes(c.name.toLowerCase());
        })
        .map(c => c.id)
    : state.characterCodex.filter(c => c.isProtagonist).map(c => c.id);

  // Get active threads to consider
  const threadsToConsider = state.storyThreads.filter(t =>
    t.status === 'active' || t.status === 'paused'
  );

  return {
    charactersToTrack,
    threadsToConsider,
  };
}

/**
 * Chapter Context Updater
 * Updates all context tracking after chapter generation
 * Updates thread statuses, character states, plot point tracking, and story progression metrics
 */

import { NovelState, Chapter, PostChapterExtraction, StoryThread } from '../types';
import { processThreadUpdates } from './storyThreadService';
import { saveStoryThread, saveThreadProgressionEvent } from './threadService';
import { getEntityStateTracker } from './entityStateTracker';

/**
 * Update context tracking after chapter generation
 */
export async function updateContextAfterChapter(
  state: NovelState,
  newChapter: Chapter,
  extraction: PostChapterExtraction
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

    // Plot point resolution tracking is handled by:
    // 1. Thread updates (via processThreadUpdates)
    // 2. Character state tracking (via stateTracker)
    // 3. Story progression analysis (calculated dynamically)

    // Story progression metrics are calculated dynamically from current state
    // No explicit updates needed here - they're computed on-demand during context gathering

  } catch (error) {
    console.error('Error updating context after chapter:', error);
    // Don't throw - context updates are non-critical
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

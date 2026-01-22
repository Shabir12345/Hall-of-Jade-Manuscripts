/**
 * Story Thread Initialization Service
 * 
 * Creates initial story threads for novels that don't have any
 * Ensures basic narrative threads are always present
 */

import { StoryThread, NovelState, StoryThreadType, ThreadPriority, ThreadStatus } from '../types';
import { generateUUID } from '../utils/uuid';
import { logger } from './loggingService';

/**
 * Initialize basic story threads for a novel that has none
 */
export function initializeStoryThreads(state: NovelState): StoryThread[] {
  if (state.storyThreads && state.storyThreads.length > 0) {
    return state.storyThreads; // Already has threads
  }

  logger.info('Initializing story threads for novel', 'storyThreadInit', {
    novelId: state.id,
    chapterCount: state.chapters.length
  });

  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const protagonistName = protagonist?.name || 'Protagonist';

  const initialThreads: StoryThread[] = [
    // Cultivation progression thread
    {
      id: generateUUID(),
      novelId: state.id,
      title: `${protagonistName}'s Cultivation Path`,
      type: 'power' as StoryThreadType,
      status: 'active' as ThreadStatus,
      priority: 'critical' as ThreadPriority,
      description: `The main cultivation journey and power progression of ${protagonistName}`,
      introducedChapter: 1,
      lastUpdatedChapter: state.chapters.length || 1,
      relatedEntityId: protagonist?.id || '',
      relatedEntityType: 'character',
      progressionNotes: [],
      chaptersInvolved: [1],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Mystery thread (farming space)
    {
      id: generateUUID(),
      novelId: state.id,
      title: 'Mystery of the Farming Space',
      type: 'mystery' as StoryThreadType,
      status: 'active' as ThreadStatus,
      priority: 'high' as ThreadPriority,
      description: 'The mysterious farming space in the protagonist\'s head and its true nature',
      introducedChapter: 1,
      lastUpdatedChapter: state.chapters.length || 1,
      relatedEntityId: protagonist?.id || '',
      relatedEntityType: 'character',
      progressionNotes: [],
      chaptersInvolved: [1],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },

    // Character relationship thread
    {
      id: generateUUID(),
      novelId: state.id,
      title: 'Relationships and Alliances',
      type: 'relationship' as StoryThreadType,
      status: 'active' as ThreadStatus,
      priority: 'medium' as ThreadPriority,
      description: 'Building relationships, alliances, and rivalries with other characters',
      introducedChapter: 1,
      lastUpdatedChapter: state.chapters.length || 1,
      relatedEntityId: protagonist?.id || '',
      relatedEntityType: 'character',
      progressionNotes: [],
      chaptersInvolved: [1],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  ];

  logger.info(`Created ${initialThreads.length} initial story threads`, 'storyThreadInit', {
    threads: initialThreads.map(t => ({ title: t.title, type: t.type, priority: t.priority }))
  });

  return initialThreads;
}

/**
 * Check if novel needs story thread initialization
 */
export function needsThreadInitialization(state: NovelState): boolean {
  return !state.storyThreads || state.storyThreads.length === 0;
}

/**
 * Enhanced extraction prompt specifically for finding threads and characters
 */
export function createEnhancedExtractionPrompt(state: NovelState, chapterContent: string): string {
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const existingCharacters = state.characterCodex.map(c => `- ${c.name}`).join('\n') || 'No characters recorded yet';

  return `You are a expert narrative analyst extracting story elements from a cultivation fantasy novel.

IMPORTANT: This novel appears to be missing story threads and character tracking. Be EXTRA THOROUGH in finding:

1. **CHARACTERS**: Look for ANY character names, even minor ones. Include:
   - Named characters (any name with capital letter)
   - Titles like "Elder", "Master", "Disciple" + name
   - Antagonists or opponents
   - Mentions of family members, friends, enemies

2. **STORY THREADS**: Look for ongoing narrative elements:
   - Power progression (cultivation breakthroughs, techniques learned)
   - Mysteries (unexplained phenomena, secrets)
   - Relationships (friendships, rivalries, romantic interests)
   - Conflicts (enemies, challenges, obstacles)
   - Quests (goals, tasks, journeys)
   - Promises (oaths, agreements, commitments)

EXISTING CHARACTERS:
${existingCharacters}

PROTAGONIST: ${protagonist?.name || 'Unknown'}

CHAPTER CONTENT:
${chapterContent}

Extract EVERYTHING you find. It's better to extract too much than miss something. Return JSON with the same structure as before.`;
}

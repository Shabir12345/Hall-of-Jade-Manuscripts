/**
 * Consistency System Initializer
 * 
 * Centralized initialization and synchronization of consistency system.
 * Called when novels are loaded to ensure all services are properly initialized.
 */

import { NovelState } from '../types';
import { getKnowledgeGraphService } from './knowledgeGraphService';
import { getEntityStateTracker } from './entityStateTracker';
import { getSceneContextManager } from './sceneContextManager';
import { syncConsistencyDataFromDatabase } from './consistencyPersistenceService';

/**
 * Initialize consistency system for a novel
 */
export async function initializeConsistencySystemForNovel(novel: NovelState): Promise<void> {
  const graphService = getKnowledgeGraphService();
  const stateTracker = getEntityStateTracker();
  const sceneManager = getSceneContextManager();

  // Initialize knowledge graph
  graphService.initializeGraph(novel);

  // Initialize state tracking for existing characters
  novel.characterCodex.forEach(char => {
    const currentState: Record<string, any> = {
      name: char.name,
      age: char.age,
      personality: char.personality,
      currentCultivation: char.currentCultivation,
      status: char.status,
      notes: char.notes,
      relationships: char.relationships,
      itemPossessions: char.itemPossessions,
      techniqueMasteries: char.techniqueMasteries,
    };

    if (char.lastUpdatedByChapterId) {
      const chapter = novel.chapters.find(c => c.id === char.lastUpdatedByChapterId);
      if (chapter) {
        stateTracker.trackStateChange(
          'character',
          char.id,
          chapter.id,
          chapter.number,
          currentState
        );
      }
    } else if (char.createdByChapterId) {
      const chapter = novel.chapters.find(c => c.id === char.createdByChapterId);
      if (chapter) {
        stateTracker.trackStateChange(
          'character',
          char.id,
          chapter.id,
          chapter.number,
          currentState
        );
      }
    }
  });

  // Build scene metadata for existing chapters
  novel.chapters.forEach(chapter => {
    if (chapter.scenes && chapter.scenes.length > 0) {
      chapter.scenes.forEach(scene => {
        sceneManager.buildSceneMetadata(scene, chapter, novel);
      });
    }
  });

  // Sync from database
  try {
    await syncConsistencyDataFromDatabase(novel);
  } catch (error) {
    console.warn(`Failed to sync consistency data from database for novel ${novel.id}:`, error);
    // Continue with in-memory only
  }
}

/**
 * Initialize consistency system for multiple novels
 */
export async function initializeConsistencySystemForNovels(novels: NovelState[]): Promise<void> {
  for (const novel of novels) {
    try {
      await initializeConsistencySystemForNovel(novel);
    } catch (error) {
      console.warn(`Failed to initialize consistency system for novel ${novel.id}:`, error);
      // Continue with other novels
    }
  }
}

/**
 * Reinitialize consistency system (useful after major state changes)
 */
export function reinitializeConsistencySystem(novel: NovelState): void {
  const graphService = getKnowledgeGraphService();
  const stateTracker = getEntityStateTracker();
  const sceneManager = getSceneContextManager();

  // Clear existing data
  // Note: These services are singletons, so we need to reinitialize
  graphService.initializeGraph(novel);
  stateTracker.clear();
  sceneManager.clear();

  // Reinitialize
  initializeConsistencySystemForNovel(novel).catch(error => {
    console.error('Failed to reinitialize consistency system:', error);
  });
}

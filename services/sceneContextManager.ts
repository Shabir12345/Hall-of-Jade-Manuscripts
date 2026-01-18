/**
 * Scene Context Manager
 * 
 * Leverages existing scene structure to build scene-level state snapshots.
 * Tracks which characters/entities appear in each scene and uses scene transitions
 * to determine context boundaries.
 */

import { NovelState, Scene, Chapter, Character } from '../types';

export interface SceneMetadata {
  sceneId: string;
  chapterId: string;
  chapterNumber: number;
  sceneNumber: number;
  charactersPresent: string[]; // Character IDs
  location?: string; // Location ID or name
  powerLevels: Record<string, string>; // Character ID -> Power Level
  keyEvents: string[]; // Brief descriptions of key events
  timestamp: number;
}

export interface SceneTransition {
  fromSceneId: string;
  toSceneId: string;
  transitionType: 'continuous' | 'time_skip' | 'location_change' | 'pov_shift';
  timeGap?: string; // e.g., "2 hours later", "next day"
  locationChange?: {
    from: string;
    to: string;
  };
}

export class SceneContextManager {
  private sceneMetadata: Map<string, SceneMetadata> = new Map();
  private sceneTransitions: SceneTransition[] = [];

  /**
   * Build metadata for a scene
   */
  buildSceneMetadata(
    scene: Scene,
    chapter: Chapter,
    state: NovelState
  ): SceneMetadata {
    const metadata: SceneMetadata = {
      sceneId: scene.id,
      chapterId: chapter.id,
      chapterNumber: chapter.number,
      sceneNumber: scene.number,
      charactersPresent: [],
      powerLevels: {},
      keyEvents: [],
      timestamp: Date.now(),
    };

    // Extract characters from scene content
    const sceneText = (scene.content || scene.summary || '').toLowerCase();
    state.characterCodex.forEach(char => {
      if (sceneText.includes(char.name.toLowerCase())) {
        metadata.charactersPresent.push(char.id);
        metadata.powerLevels[char.id] = char.currentCultivation;
      }
    });

    // Extract location (basic - could be enhanced with NLP)
    const locationMatch = sceneText.match(/\b(at|in|inside|outside|near)\s+(the\s+)?([a-z\s]+)\b/i);
    if (locationMatch) {
      const locationName = locationMatch[3];
      const territory = state.territories.find(t =>
        t.name.toLowerCase().includes(locationName.toLowerCase()) ||
        locationName.toLowerCase().includes(t.name.toLowerCase())
      );
      if (territory) {
        metadata.location = territory.id;
      }
    }

    // Extract key events from summary
    if (scene.summary) {
      // Simple extraction - could be enhanced
      const sentences = scene.summary.split(/[.!?]+/).filter(s => s.trim().length > 20);
      metadata.keyEvents = sentences.slice(0, 3).map(s => s.trim());
    }

    this.sceneMetadata.set(scene.id, metadata);
    return metadata;
  }

  /**
   * Build metadata for all scenes in a chapter
   */
  buildChapterSceneMetadata(chapter: Chapter, state: NovelState): SceneMetadata[] {
    const metadata: SceneMetadata[] = [];

    chapter.scenes?.forEach(scene => {
      const meta = this.buildSceneMetadata(scene, chapter, state);
      metadata.push(meta);
    });

    // Build transitions between scenes
    if (metadata.length > 1) {
      for (let i = 0; i < metadata.length - 1; i++) {
        const transition = this.analyzeSceneTransition(
          metadata[i],
          metadata[i + 1],
          chapter.scenes[i],
          chapter.scenes[i + 1]
        );
        if (transition) {
          this.sceneTransitions.push(transition);
        }
      }
    }

    return metadata;
  }

  /**
   * Analyze transition between two scenes
   */
  private analyzeSceneTransition(
    fromMeta: SceneMetadata,
    toMeta: SceneMetadata,
    fromScene: Scene,
    toScene: Scene
  ): SceneTransition | null {
    const transition: SceneTransition = {
      fromSceneId: fromMeta.sceneId,
      toSceneId: toMeta.sceneId,
      transitionType: 'continuous',
    };

    // Check for location change
    if (fromMeta.location !== toMeta.location) {
      transition.transitionType = 'location_change';
      transition.locationChange = {
        from: fromMeta.location || 'unknown',
        to: toMeta.location || 'unknown',
      };
    }

    // Check for time skip
    const toSceneText = (toScene.content || '').toLowerCase();
    const timeSkipPatterns = [
      /\b(hours?|days?|weeks?|months?|years?)\s+later\b/i,
      /\bthe\s+next\s+(day|morning|evening|night)\b/i,
      /\bmeanwhile\b/i,
    ];

    if (timeSkipPatterns.some(pattern => pattern.test(toSceneText))) {
      transition.transitionType = 'time_skip';
      const match = toSceneText.match(/\b(\d+\s*(hours?|days?|weeks?|months?|years?))\s+later\b/i);
      if (match) {
        transition.timeGap = match[1];
      }
    }

    // Check for POV shift (different characters present)
    const fromChars = new Set(fromMeta.charactersPresent);
    const toChars = new Set(toMeta.charactersPresent);
    const overlap = [...fromChars].filter(c => toChars.has(c)).length;
    
    if (overlap === 0 && (fromChars.size > 0 || toChars.size > 0)) {
      transition.transitionType = 'pov_shift';
    }

    return transition;
  }

  /**
   * Get metadata for a scene
   */
  getSceneMetadata(sceneId: string): SceneMetadata | null {
    return this.sceneMetadata.get(sceneId) || null;
  }

  /**
   * Get all scenes with a specific character
   */
  getScenesWithCharacter(characterId: string): SceneMetadata[] {
    const scenes: SceneMetadata[] = [];
    
    this.sceneMetadata.forEach(metadata => {
      if (metadata.charactersPresent.includes(characterId)) {
        scenes.push(metadata);
      }
    });

    return scenes.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.sceneNumber - b.sceneNumber;
    });
  }

  /**
   * Get scenes in a location
   */
  getScenesInLocation(locationId: string): SceneMetadata[] {
    const scenes: SceneMetadata[] = [];
    
    this.sceneMetadata.forEach(metadata => {
      if (metadata.location === locationId) {
        scenes.push(metadata);
      }
    });

    return scenes.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.sceneNumber - b.sceneNumber;
    });
  }

  /**
   * Get context boundaries based on scenes
   * Returns scene IDs that should be included in context
   */
  getContextBoundaries(
    currentChapterNumber: number,
    lookbackChapters: number = 2
  ): string[] {
    const relevantScenes: string[] = [];
    const minChapter = Math.max(1, currentChapterNumber - lookbackChapters);

    this.sceneMetadata.forEach((metadata, sceneId) => {
      if (metadata.chapterNumber >= minChapter && metadata.chapterNumber < currentChapterNumber) {
        relevantScenes.push(sceneId);
      }
    });

    return relevantScenes;
  }

  /**
   * Get scene transitions for a chapter
   */
  getChapterTransitions(chapterId: string): SceneTransition[] {
    return this.sceneTransitions.filter(t => {
      const fromMeta = this.sceneMetadata.get(t.fromSceneId);
      const toMeta = this.sceneMetadata.get(t.toSceneId);
      return fromMeta?.chapterId === chapterId || toMeta?.chapterId === chapterId;
    });
  }

  /**
   * Clear all metadata (for reset or new novel)
   */
  clear(): void {
    this.sceneMetadata.clear();
    this.sceneTransitions = [];
  }
}

// Singleton instance
let sceneManagerInstance: SceneContextManager | null = null;

export function getSceneContextManager(): SceneContextManager {
  if (!sceneManagerInstance) {
    sceneManagerInstance = new SceneContextManager();
  }
  return sceneManagerInstance;
}

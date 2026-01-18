/**
 * Entity State Tracker
 * 
 * Tracks state changes for all entities with chapter-level provenance.
 * Maintains history and supports rollback to any previous state.
 */

import { Character, Territory, WorldEntry, NovelItem, NovelTechnique, Antagonist } from '../types';

export type EntityType = 'character' | 'territory' | 'world_entry' | 'item' | 'technique' | 'antagonist';

export interface EntityStateSnapshot {
  entityType: EntityType;
  entityId: string;
  chapterId: string;
  chapterNumber: number;
  stateSnapshot: Record<string, any>; // Full state at this point
  changes: Array<{
    field: string;
    oldValue: any;
    newValue: any;
  }>;
  timestamp: number;
}

export interface EntityStateHistory {
  entityType: EntityType;
  entityId: string;
  snapshots: EntityStateSnapshot[];
  currentState: Record<string, any> | null;
  currentChapter: number;
}

export class EntityStateTracker {
  private histories: Map<string, EntityStateHistory> = new Map();

  /**
   * Create state key for entity
   */
  private getStateKey(entityType: EntityType, entityId: string): string {
    return `${entityType}_${entityId}`;
  }

  /**
   * Track state change for an entity
   */
  trackStateChange(
    entityType: EntityType,
    entityId: string,
    chapterId: string,
    chapterNumber: number,
    currentState: Record<string, any>,
    previousState?: Record<string, any>
  ): EntityStateSnapshot {
    const key = this.getStateKey(entityType, entityId);
    let history = this.histories.get(key);

    if (!history) {
      history = {
        entityType,
        entityId,
        snapshots: [],
        currentState: null,
        currentChapter: 0,
      };
      this.histories.set(key, history);
    }

    // Calculate changes
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    if (previousState) {
      // Compare old and new state
      const allKeys = new Set([...Object.keys(previousState), ...Object.keys(currentState)]);
      allKeys.forEach(field => {
        const oldVal = previousState[field];
        const newVal = currentState[field];
        
        // Deep comparison for objects/arrays
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes.push({
            field,
            oldValue: oldVal,
            newValue: newVal,
          });
        }
      });
    } else {
      // First snapshot - all fields are new
      Object.keys(currentState).forEach(field => {
        changes.push({
          field,
          oldValue: undefined,
          newValue: currentState[field],
        });
      });
    }

    const snapshot: EntityStateSnapshot = {
      entityType,
      entityId,
      chapterId,
      chapterNumber,
      stateSnapshot: JSON.parse(JSON.stringify(currentState)), // Deep copy
      changes,
      timestamp: Date.now(),
    };

    history.snapshots.push(snapshot);
    history.currentState = JSON.parse(JSON.stringify(currentState)); // Deep copy
    history.currentChapter = chapterNumber;

    return snapshot;
  }

  /**
   * Track character state change
   */
  trackCharacterState(
    character: Character,
    chapterId: string,
    chapterNumber: number,
    previousCharacter?: Character
  ): EntityStateSnapshot {
    const currentState: Record<string, any> = {
      name: character.name,
      age: character.age,
      personality: character.personality,
      currentCultivation: character.currentCultivation,
      status: character.status,
      isProtagonist: character.isProtagonist,
      appearance: character.appearance,
      background: character.background,
      goals: character.goals,
      flaws: character.flaws,
      notes: character.notes,
      relationships: character.relationships,
      itemPossessions: character.itemPossessions,
      techniqueMasteries: character.techniqueMasteries,
    };

    const previousState = previousCharacter ? {
      name: previousCharacter.name,
      age: previousCharacter.age,
      personality: previousCharacter.personality,
      currentCultivation: previousCharacter.currentCultivation,
      status: previousCharacter.status,
      isProtagonist: previousCharacter.isProtagonist,
      appearance: previousCharacter.appearance,
      background: previousCharacter.background,
      goals: previousCharacter.goals,
      flaws: previousCharacter.flaws,
      notes: previousCharacter.notes,
      relationships: previousCharacter.relationships,
      itemPossessions: previousCharacter.itemPossessions,
      techniqueMasteries: previousCharacter.techniqueMasteries,
    } : undefined;

    return this.trackStateChange('character', character.id, chapterId, chapterNumber, currentState, previousState);
  }

  /**
   * Get current state of an entity
   */
  getCurrentState(entityType: EntityType, entityId: string): Record<string, any> | null {
    const key = this.getStateKey(entityType, entityId);
    const history = this.histories.get(key);
    return history?.currentState || null;
  }

  /**
   * Get state at a specific chapter
   */
  getStateAtChapter(
    entityType: EntityType,
    entityId: string,
    chapterNumber: number
  ): Record<string, any> | null {
    const key = this.getStateKey(entityType, entityId);
    const history = this.histories.get(key);
    if (!history) return null;

    // Find the most recent snapshot at or before this chapter
    const relevantSnapshots = history.snapshots
      .filter(s => s.chapterNumber <= chapterNumber)
      .sort((a, b) => b.chapterNumber - a.chapterNumber);

    if (relevantSnapshots.length === 0) return null;

    return relevantSnapshots[0].stateSnapshot;
  }

  /**
   * Get all state changes for an entity
   */
  getEntityHistory(entityType: EntityType, entityId: string): EntityStateSnapshot[] {
    const key = this.getStateKey(entityType, entityId);
    const history = this.histories.get(key);
    return history?.snapshots || [];
  }

  /**
   * Get all changes in a specific chapter
   */
  getChapterChanges(chapterId: string, chapterNumber: number): EntityStateSnapshot[] {
    const allChanges: EntityStateSnapshot[] = [];
    
    this.histories.forEach(history => {
      const chapterSnapshots = history.snapshots.filter(
        s => s.chapterId === chapterId || s.chapterNumber === chapterNumber
      );
      allChanges.push(...chapterSnapshots);
    });

    return allChanges;
  }

  /**
   * Rollback entity to a specific chapter state
   */
  rollbackToChapter(
    entityType: EntityType,
    entityId: string,
    chapterNumber: number
  ): Record<string, any> | null {
    const state = this.getStateAtChapter(entityType, entityId, chapterNumber);
    if (!state) return null;

    const key = this.getStateKey(entityType, entityId);
    const history = this.histories.get(key);
    if (!history) return null;

    // Update current state
    history.currentState = JSON.parse(JSON.stringify(state));
    
    // Remove snapshots after this chapter
    history.snapshots = history.snapshots.filter(s => s.chapterNumber <= chapterNumber);
    history.currentChapter = chapterNumber;

    return state;
  }

  /**
   * Get summary of all tracked entities
   */
  getSummary(): {
    totalEntities: number;
    totalSnapshots: number;
    entitiesByType: Record<EntityType, number>;
  } {
    const entitiesByType: Record<EntityType, number> = {
      character: 0,
      territory: 0,
      world_entry: 0,
      item: 0,
      technique: 0,
      antagonist: 0,
    };

    let totalSnapshots = 0;

    this.histories.forEach(history => {
      entitiesByType[history.entityType]++;
      totalSnapshots += history.snapshots.length;
    });

    return {
      totalEntities: this.histories.size,
      totalSnapshots,
      entitiesByType,
    };
  }

  /**
   * Clear all tracking data (for testing or reset)
   */
  clear(): void {
    this.histories.clear();
  }
}

// Singleton instance
let trackerInstance: EntityStateTracker | null = null;

export function getEntityStateTracker(): EntityStateTracker {
  if (!trackerInstance) {
    trackerInstance = new EntityStateTracker();
  }
  return trackerInstance;
}

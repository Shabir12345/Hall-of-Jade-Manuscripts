/**
 * Chapter State Snapshot Types
 * 
 * Defines types for capturing and storing novel state snapshots
 * before chapter generation for rollback purposes.
 */

import { NovelState, Character, WorldEntry, Territory, NovelItem, NovelTechnique, Antagonist, Arc } from '../types';

export interface ChapterStateSnapshot {
  snapshotId: string;
  chapterId: string;
  chapterNumber: number;
  novelId: string;
  timestamp: number;
  preChapterState: {
    characterCodex: Character[];
    worldBible: WorldEntry[];
    territories: Territory[];
    novelItems: NovelItem[];
    novelTechniques: NovelTechnique[];
    antagonists: Antagonist[];
    plotLedger: Arc[];
    currentRealmId: string;
    realms: Array<{ id: string; name: string; status: string }>;
  };
  changeSummary: {
    charactersCreated: string[]; // Character IDs
    charactersUpdated: string[]; // Character IDs
    worldEntriesCreated: string[]; // WorldEntry IDs
    worldEntriesUpdated: string[]; // WorldEntry IDs
    territoriesCreated: string[]; // Territory IDs
    territoriesUpdated: string[]; // Territory IDs
    itemsCreated: string[]; // Item IDs
    itemsUpdated: string[]; // Item IDs
    techniquesCreated: string[]; // Technique IDs
    techniquesUpdated: string[]; // Technique IDs
    antagonistsCreated: string[]; // Antagonist IDs
    antagonistsUpdated: string[]; // Antagonist IDs
    arcChecklistCompleted: Array<{
      arcId: string;
      itemId: string;
    }>;
    realmChanges?: {
      newRealmCreated: boolean;
      oldRealmId?: string;
      newRealmId?: string;
    };
  };
}

export interface EntityChange {
  entityId: string;
  entityType: 'character' | 'worldEntry' | 'territory' | 'item' | 'technique' | 'antagonist';
  changeType: 'created' | 'updated';
  changedFields?: string[];
  previousValue?: any;
  newValue?: any;
}

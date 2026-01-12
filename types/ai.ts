/**
 * AI Service Types
 * Type definitions for AI service requests and responses
 */

import type { LogicAudit, Character, WorldEntry, Territory } from '../types';

// Character update from AI extraction
export interface CharacterUpdate {
  name: string;
  updateType: 'new' | 'cultivation' | 'skill' | 'item' | 'status' | 'notes' | 'relationship';
  newValue: string;
  targetName?: string; // For relationship updates
}

// World update from AI extraction
export interface WorldUpdate {
  title: string;
  content: string;
  category: 'Geography' | 'Sects' | 'PowerLevels' | 'Laws' | 'Systems' | 'Techniques' | 'Other';
  isNewRealm: boolean;
}

// Territory update from AI extraction
export interface TerritoryUpdate {
  name: string;
  type: 'Empire' | 'Kingdom' | 'Neutral' | 'Hidden';
  description: string;
}

// Chapter generation response from AI
export interface ChapterGenerationResponse {
  logicAudit?: LogicAudit;
  chapterTitle: string;
  chapterContent: string;
  chapterSummary?: string;
  characterUpdates?: CharacterUpdate[];
  worldUpdates?: WorldUpdate[];
  territoryUpdates?: TerritoryUpdate[];
}

// Item update from AI extraction
export interface ItemUpdate {
  name: string;
  description?: string;
  category?: 'Treasure' | 'Equipment' | 'Consumable' | 'Essential';
  addPowers?: string[];
  firstAppearedChapter?: number;
}

// Technique update from AI extraction
export interface TechniqueUpdate {
  name: string;
  description?: string;
  category?: 'Core' | 'Important' | 'Standard' | 'Basic';
  type?: 'Cultivation' | 'Combat' | 'Support' | 'Secret' | 'Other';
  addFunctions?: string[];
  firstAppearedChapter?: number;
}

// Antagonist update from AI extraction
export interface AntagonistUpdate {
  name: string;
  type?: string;
  description?: string;
  motivation?: string;
  powerLevel?: string;
  status?: string;
  relationshipWithProtagonist?: {
    relationshipType?: string;
    intensity?: string;
  };
  notes?: string;
}

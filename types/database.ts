/**
 * Database Row Types
 * Type definitions for Supabase database rows
 * These match the actual database schema
 */

import type {
  NovelState,
  Character,
  Chapter,
  Arc,
  Scene,
  Realm,
  Territory,
  WorldEntry,
  SystemLog,
  Tag,
  WritingGoal,
  NovelItem,
  NovelTechnique,
  CharacterItemPossession,
  CharacterTechniqueMastery,
  Antagonist,
  ForeshadowingElement,
  SymbolicElement,
  EmotionalPayoffMoment,
  SubtextElement,
} from '../types';

// Base database row type (includes timestamps and user_id)
interface BaseDatabaseRow {
  id: string;
  user_id?: string | null; // Nullable for migration period
  created_at: string;
  updated_at?: string | null;
}

// Novel row from database
export interface NovelRow extends BaseDatabaseRow {
  title: string;
  genre: string;
  grand_saga: string | null;
  current_realm_id: string | null;
}

// Realm row from database
export interface RealmRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  description: string;
  status: 'current' | 'archived' | 'future';
}

// Territory row from database
export interface TerritoryRow extends BaseDatabaseRow {
  realm_id: string;
  name: string;
  description: string;
  type: 'Empire' | 'Kingdom' | 'Neutral' | 'Hidden';
}

// World entry row from database
export interface WorldEntryRow extends BaseDatabaseRow {
  realm_id: string;
  category: 'Geography' | 'Sects' | 'PowerLevels' | 'Laws' | 'Systems' | 'Techniques' | 'Other';
  title: string;
  content: string;
}

// Character row from database
export interface CharacterRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  age: string | null;
  personality: string | null;
  current_cultivation: string | null;
  notes: string | null;
  portrait_url: string | null;
  status: 'Alive' | 'Deceased' | 'Unknown';
  is_protagonist: boolean | null;
}

// Chapter row from database
export interface ChapterRow extends BaseDatabaseRow {
  novel_id: string;
  number: number;
  title: string;
  content: string;
  summary: string | null;
  logic_audit: unknown | null; // JSONB
}

// Arc row from database
export interface ArcRow extends BaseDatabaseRow {
  novel_id: string;
  title: string;
  description: string;
  status: 'active' | 'completed';
  started_at_chapter: number | null;
  ended_at_chapter: number | null;
  target_chapters: number | null;
  checklist: unknown | null; // JSONB array of ArcChecklistItem
}

// Scene row from database
export interface SceneRow extends BaseDatabaseRow {
  chapter_id: string;
  number: number;
  title: string;
  content: string;
  summary: string | null;
  word_count: number | null;
  user_id?: string | null;
}

// System log row from database
export interface SystemLogRow extends BaseDatabaseRow {
  novel_id: string;
  message: string;
  type: 'discovery' | 'update' | 'fate' | 'logic';
  timestamp: string;
}

// Tag row from database
export interface TagRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  color: string | null;
  category: 'plot' | 'character' | 'world' | 'theme' | null;
}

// Writing goal row from database
export interface WritingGoalRow extends BaseDatabaseRow {
  novel_id: string;
  type: 'daily' | 'weekly' | 'total';
  target: number;
  current: number | null;
  deadline: string | null;
}

// Novel item row from database
export interface NovelItemRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  canonical_name: string;
  description: string;
  category: 'Treasure' | 'Equipment' | 'Consumable' | 'Essential';
  powers: unknown; // JSONB array
  history: string;
  first_appeared_chapter: number | null;
  last_referenced_chapter: number | null;
}

// Novel technique row from database
export interface NovelTechniqueRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  canonical_name: string;
  description: string;
  category: 'Core' | 'Important' | 'Standard' | 'Basic';
  type: 'Cultivation' | 'Combat' | 'Support' | 'Secret' | 'Other';
  functions: unknown; // JSONB array
  history: string;
  first_appeared_chapter: number | null;
  last_referenced_chapter: number | null;
}

// Character item possession row from database
export interface CharacterItemPossessionRow extends BaseDatabaseRow {
  character_id: string;
  item_id: string;
  status: 'active' | 'archived' | 'lost' | 'destroyed';
  acquired_chapter: number | null;
  archived_chapter: number | null;
  notes: string;
}

// Character technique mastery row from database
export interface CharacterTechniqueMasteryRow extends BaseDatabaseRow {
  character_id: string;
  technique_id: string;
  status: 'active' | 'archived' | 'forgotten' | 'mastered';
  mastery_level: string;
  learned_chapter: number | null;
  archived_chapter: number | null;
  notes: string;
}

// Character skill row from database (backward compatibility)
export interface CharacterSkillRow {
  id: string;
  character_id: string;
  skill: string;
}

// Character item row from database (backward compatibility)
export interface CharacterItemRow {
  id: string;
  character_id: string;
  item: string;
}

// Relationship row from database
export interface RelationshipRow {
  id: string;
  character_id: string;
  target_character_id: string;
  type: string;
  history: string | null;
  impact: string | null;
}

// Narrative element rows
export interface ForeshadowingElementRow extends BaseDatabaseRow {
  novel_id: string;
  type: string;
  content: string;
  introduced_chapter: number;
  paid_off_chapter: number | null;
  status: string;
  subtlety: string;
  related_element: string | null;
  chapters_referenced: unknown; // JSONB array
  notes: string;
}

export interface SymbolicElementRow extends BaseDatabaseRow {
  novel_id: string;
  name: string;
  symbolic_meaning: string;
  first_appeared_chapter: number;
  chapters_appeared: unknown; // JSONB array
  evolution_notes: unknown; // JSONB array
  related_themes: unknown; // JSONB array
  notes: string;
}

export interface EmotionalPayoffRow extends BaseDatabaseRow {
  novel_id: string;
  type: string;
  description: string;
  chapter_number: number;
  intensity: number;
  characters_involved: unknown; // JSONB array
  setup_chapters: unknown; // JSONB array
  reader_impact: string;
  notes: string;
}

export interface SubtextElementRow extends BaseDatabaseRow {
  novel_id: string;
  chapter_id: string | null;
  scene_id: string | null;
  type: string;
  surface_content: string;
  hidden_meaning: string;
  characters_involved: unknown; // JSONB array
  significance: string | null;
  related_to: string | null;
  notes: string;
}

// Helper type for Supabase query results
export type SupabaseQueryResult<T> = {
  data: T[] | null;
  error: unknown | null;
};

// Helper type for Supabase single query result
export type SupabaseSingleResult<T> = {
  data: T | null;
  error: unknown | null;
};

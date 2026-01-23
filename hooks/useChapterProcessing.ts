import { useCallback } from 'react';
import type {
  NovelState,
  Chapter,
  Character,
  WorldEntry,
  Territory,
  SystemLog,
  CharacterItemPossession,
  CharacterTechniqueMastery,
  Scene,
  Realm,
} from '../types';
import {
  processPostChapterUpdates as serviceProcessUpdates,
  normalize,
  mergeAppend,
  coerceWorldCategory,
  coerceTerritoryType,
  coerceCharStatus,
  findCharacterByName
} from '../services/chapterProcessingService';
import { coerceItemCategory, coerceTechniqueCategory, coerceTechniqueType } from '../utils/typeCoercion';

/**
 * Custom hook for processing chapter updates (character, world, items, techniques)
 * Extracted from App.tsx to improve code organization
 */
export function useChapterProcessing() {
  /**
   * Normalize string for comparison (lowercase, trim)
   */
  const normalize = useCallback((s: string) => (s || '').trim().toLowerCase(), []);

  /**
   * Merge append helper for notes/history
   */
  const mergeAppend = useCallback((existing: string, incoming: string, chapterNum: number) => {
    const cur = (existing || '').trim();
    const inc = (incoming || '').trim();
    if (!inc) return cur;
    if (!cur) return inc;
    // Avoid repeated appends
    if (normalize(cur).includes(normalize(inc))) return cur;
    return `${cur}\n\n[Chapter ${chapterNum} update]\n${inc}`;
  }, [normalize]);

  /**
   * Coerce world category to valid type
   */
  const coerceWorldCategory = useCallback((category: any): WorldEntry['category'] => {
    const c = String(category || '').trim();
    const allowed: WorldEntry['category'][] = [
      'Geography',
      'Sects',
      'PowerLevels',
      'Laws',
      'Systems',
      'Techniques',
      'Other',
    ];
    return (allowed as string[]).includes(c) ? (c as WorldEntry['category']) : 'Other';
  }, []);

  /**
   * Coerce territory type to valid type
   */
  const coerceTerritoryType = useCallback((type: string): Territory['type'] => {
    const t = String(type || '').trim();
    const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
    return (allowed as string[]).includes(t) ? (t as Territory['type']) : 'Neutral';
  }, []);

  /**
   * Coerce character status to valid type
   */
  const coerceCharStatus = useCallback((status: any): Character['status'] | undefined => {
    const s = String(status || '').trim();
    const allowed: Character['status'][] = ['Alive', 'Deceased', 'Unknown'];
    return (allowed as string[]).includes(s) ? (s as any) : undefined;
  }, []);

  /**
   * Find character by name (case-insensitive)
   */
  const findCharacterByName = useCallback((characters: Character[], name: string): Character | undefined => {
    const normalizedName = normalize(name);
    return characters.find(c => normalize(c.name) === normalizedName);
  }, [normalize]);

  /**
   * Process post-chapter extraction updates
   */
  const processPostChapterUpdates = useCallback(async (
    novel: NovelState,
    newChapter: Chapter,
    activeArcInput: any,
    addLog: (msg: string, type: SystemLog['type']) => void
  ): Promise<NovelState> => {
    return serviceProcessUpdates(novel, newChapter, activeArcInput, addLog);
  }, []);

  return {
    processPostChapterUpdates,
    normalize,
    mergeAppend,
    coerceWorldCategory,
    coerceTerritoryType,
    coerceCharStatus,
    coerceItemCategory,
    coerceTechniqueCategory,
    coerceTechniqueType,
    findCharacterByName,
  };
}

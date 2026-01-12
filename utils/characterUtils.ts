/**
 * Character Utility Functions
 * Shared character-related utilities to reduce code duplication
 */

import { generateUUID } from './uuid';
import type { Character } from '../types';
import { createNewCharacter } from './entityFactories';

/**
 * Normalizes character name for comparison (case-insensitive, trimmed)
 * 
 * @param name - Character name to normalize
 * @returns Normalized name string
 */
export function normalizeCharacterName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Creates a character from an update object (used during chapter processing)
 * 
 * @param update - Character update object from AI extraction
 * @param coerceCharStatus - Function to coerce status to valid type
 * @returns New character object
 */
export function createCharacterFromUpdate(
  update: {
    name: string;
    set?: {
      age?: string;
      personality?: string;
      currentCultivation?: string;
      notes?: string;
      status?: unknown;
    };
    addSkills?: unknown[];
    addItems?: unknown[];
  },
  coerceCharStatus: (status: unknown) => Character['status'] | undefined
): Character {
  return createNewCharacter({
    name: String(update.name),
    age: String(update.set?.age || 'Unknown'),
    personality: String(update.set?.personality || 'Unknown'),
    currentCultivation: String(update.set?.currentCultivation || 'Unknown'),
    skills: Array.isArray(update.addSkills) 
      ? update.addSkills.filter((s) => String(s).trim()).map(s => String(s).trim())
      : [],
    items: Array.isArray(update.addItems)
      ? update.addItems.filter((s) => String(s).trim()).map(s => String(s).trim())
      : [],
    notes: String(update.set?.notes || ''),
    status: coerceCharStatus(update.set?.status) || 'Alive',
  });
}

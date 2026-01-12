/**
 * Type Guards
 * Runtime type checking functions for safe type narrowing
 */

import type { WorldEntry, Character, Arc } from '../types';

/**
 * Type guard for WorldEntry category
 * @param value - Value to check
 * @returns true if value is a valid WorldEntry category
 */
export function isWorldCategory(value: string): value is WorldEntry['category'] {
  return ['Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other'].includes(value);
}

/**
 * Type guard for Character status
 * @param value - Value to check
 * @returns true if value is a valid Character status
 */
export function isCharacterStatus(value: string): value is Character['status'] {
  return ['Alive', 'Deceased', 'Unknown'].includes(value);
}

/**
 * Type guard for Arc status
 * @param value - Value to check
 * @returns true if value is a valid Arc status
 */
export function isArcStatus(value: string): value is Arc['status'] {
  return ['active', 'completed'].includes(value);
}

/**
 * Safely gets a WorldEntry category from a value, with fallback
 * @param value - Value to check
 * @param fallback - Fallback value if invalid (defaults to 'Other')
 * @returns Valid WorldEntry category
 */
export function getWorldCategory(value: string, fallback: WorldEntry['category'] = 'Other'): WorldEntry['category'] {
  return isWorldCategory(value) ? value : fallback;
}

/**
 * Safely gets a Character status from a value, with fallback
 * @param value - Value to check
 * @param fallback - Fallback value if invalid (defaults to 'Unknown')
 * @returns Valid Character status
 */
export function getCharacterStatus(value: string, fallback: Character['status'] = 'Unknown'): Character['status'] {
  return isCharacterStatus(value) ? value : fallback;
}

/**
 * Safely gets an Arc status from a value, with fallback
 * @param value - Value to check
 * @param fallback - Fallback value if invalid (defaults to 'active')
 * @returns Valid Arc status
 */
export function getArcStatus(value: string, fallback: Arc['status'] = 'active'): Arc['status'] {
  return isArcStatus(value) ? value : fallback;
}
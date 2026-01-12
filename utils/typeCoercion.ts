/**
 * Type Coercion Utilities
 * Safely coerces unknown values to specific types
 */

import type { WorldEntry, Territory, Character, ItemCategory, TechniqueCategory, TechniqueType } from '../types';

/**
 * Coerces a value to a valid WorldEntry category
 * 
 * @param category - Unknown category value
 * @returns Valid WorldEntry category (defaults to 'Other')
 */
export function coerceWorldCategory(category: unknown): WorldEntry['category'] {
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
  return allowed.includes(c as WorldEntry['category']) ? (c as WorldEntry['category']) : 'Other';
}

/**
 * Coerces a value to a valid Territory type
 * 
 * @param type - Unknown territory type value
 * @returns Valid Territory type (defaults to 'Neutral')
 */
export function coerceTerritoryType(type: unknown): Territory['type'] {
  const t = String(type || '').trim();
  const allowed: Territory['type'][] = ['Empire', 'Kingdom', 'Neutral', 'Hidden'];
  return allowed.includes(t as Territory['type']) ? (t as Territory['type']) : 'Neutral';
}

/**
 * Coerces a value to a valid Character status
 * 
 * @param status - Unknown status value
 * @returns Valid Character status or undefined
 */
export function coerceCharStatus(status: unknown): Character['status'] | undefined {
  const s = String(status || '').trim();
  const allowed: Character['status'][] = ['Alive', 'Deceased', 'Unknown'];
  return allowed.includes(s as Character['status']) ? (s as Character['status']) : undefined;
}

/**
 * Coerces a value to a valid ItemCategory
 * 
 * @param category - Unknown item category value
 * @returns Valid ItemCategory (defaults to 'Essential')
 */
export function coerceItemCategory(category: unknown): ItemCategory {
  const c = String(category || '').trim();
  const allowed: ItemCategory[] = ['Treasure', 'Equipment', 'Consumable', 'Essential'];
  return allowed.includes(c as ItemCategory) ? (c as ItemCategory) : 'Essential';
}

/**
 * Coerces a value to a valid TechniqueCategory
 * 
 * @param category - Unknown technique category value
 * @returns Valid TechniqueCategory (defaults to 'Basic')
 */
export function coerceTechniqueCategory(category: unknown): TechniqueCategory {
  const c = String(category || '').trim();
  const allowed: TechniqueCategory[] = ['Core', 'Important', 'Standard', 'Basic'];
  return allowed.includes(c as TechniqueCategory) ? (c as TechniqueCategory) : 'Basic';
}

/**
 * Coerces a value to a valid TechniqueType
 * 
 * @param type - Unknown technique type value
 * @returns Valid TechniqueType (defaults to 'Other')
 */
export function coerceTechniqueType(type: unknown): TechniqueType {
  const t = String(type || '').trim();
  const allowed: TechniqueType[] = ['Cultivation', 'Combat', 'Support', 'Secret', 'Other'];
  return allowed.includes(t as TechniqueType) ? (t as TechniqueType) : 'Other';
}

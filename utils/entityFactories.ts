/**
 * Entity Factory Functions
 * Creates initial states for entities to reduce code duplication
 */

import { generateUUID } from './uuid';
import type { Character, WorldEntry, Arc, ArcChecklistItem } from '../types';

/**
 * Creates a new character with default values
 * 
 * @param overrides - Optional values to override defaults
 * @returns New character with defaults
 */
export function createNewCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: generateUUID(),
    name: '',
    isProtagonist: false,
    age: '',
    personality: '',
    currentCultivation: '',
    appearance: '',
    background: '',
    goals: '',
    flaws: '',
    skills: [],
    items: [],
    techniqueMasteries: [],
    itemPossessions: [],
    notes: '',
    status: 'Alive',
    relationships: [],
    ...overrides,
  };
}

/**
 * Creates a new world entry with default values
 * 
 * @param realmId - The realm ID this entry belongs to
 * @param overrides - Optional values to override defaults
 * @returns New world entry with defaults
 */
export function createNewWorldEntry(
  realmId: string,
  overrides: Partial<Omit<WorldEntry, 'realmId'>> = {}
): WorldEntry {
  return {
    id: generateUUID(),
    realmId,
    category: 'Other',
    title: '',
    content: '',
    ...overrides,
  };
}

/**
 * Creates a new arc with default values
 * 
 * @param overrides - Optional values to override defaults
 * @returns New arc with defaults
 */
export function createNewArc(overrides: Partial<Arc> = {}): Arc {
  return {
    id: generateUUID(),
    title: '',
    description: '',
    status: 'active',
    checklist: [],
    ...overrides,
  };
}

/**
 * Creates default arc checklist items
 * 
 * @returns Array of default checklist items
 */
export function createDefaultArcChecklist(): ArcChecklistItem[] {
  return [
    { id: 'setup', label: 'Setup anchored (premise, goals, tone)', completed: false },
    { id: 'stakes', label: 'Stakes raised / clarified', completed: false },
    { id: 'antagonistPressure', label: 'Opposition pressure escalated', completed: false },
    { id: 'powerProgression', label: 'Cultivation / power progression advanced', completed: false },
    { id: 'relationshipShift', label: 'Relationship / karma thread advanced', completed: false },
    { id: 'worldDeepening', label: 'World-building deepened (lore/places/sects)', completed: false },
    { id: 'turningPoint', label: 'Major turning point / escalation', completed: false },
    { id: 'climaxSetup', label: 'Climax groundwork established', completed: false },
    { id: 'resolution', label: 'Arc resolution / aftermath', completed: false },
  ];
}

/**
 * Ensures an arc has all required default values
 * 
 * @param arc - Arc to ensure defaults for
 * @returns Arc with all defaults applied
 */
export function ensureArcDefaults(arc: Arc): Arc {
  return {
    ...arc,
    checklist: arc.checklist && arc.checklist.length > 0 ? arc.checklist : createDefaultArcChecklist(),
    status: arc.status || 'active',
  };
}

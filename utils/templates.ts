/**
 * Templates for novels, characters, arcs, and world entries
 * Provides pre-filled templates to help users get started quickly
 */

import type { Character, Arc, WorldEntry } from '../types';
import { generateUUID } from './uuid';

export interface NovelTemplate {
  id: string;
  name: string;
  description: string;
  genre: string;
  grandSaga: string;
  initialCharacters?: Partial<Character>[];
  initialArcs?: Partial<Arc>[];
}

export interface CharacterTemplate {
  id: string;
  name: string;
  description: string;
  archetype: string;
  character: Partial<Character>;
}

export interface ArcTemplate {
  id: string;
  name: string;
  description: string;
  arc: Partial<Arc>;
}

export interface WorldEntryTemplate {
  id: string;
  name: string;
  description: string;
  category: WorldEntry['category'];
  entry: Partial<WorldEntry>;
}

// Novel Templates
export const NOVEL_TEMPLATES: NovelTemplate[] = [
  {
    id: 'xianxia-standard',
    name: 'Standard Xianxia',
    description: 'Classic cultivation journey with sect conflicts and power progression',
    genre: 'Xianxia',
    grandSaga: 'A young cultivator rises from obscurity, overcoming countless trials to reach the apex of cultivation and uncover ancient secrets.',
    initialCharacters: [
      {
        name: 'Protagonist',
        isProtagonist: true,
        personality: 'Determined, resilient, and resourceful. Driven by a desire for strength and justice.',
        currentCultivation: 'Foundation Establishment',
        notes: 'Starts as a weak outer disciple, discovers hidden talent or inheritance.',
      },
      {
        name: 'Mentor',
        personality: 'Wise, mysterious, and powerful. Guides the protagonist while hiding their true identity.',
        currentCultivation: 'Nascent Soul or higher',
        notes: 'Often appears as a weak old man or hidden master.',
      },
    ],
  },
  {
    id: 'xianxia-reincarnation',
    name: 'Reincarnation Xianxia',
    description: 'Cultivator reincarnates with memories, using past knowledge to excel',
    genre: 'Xianxia',
    grandSaga: 'A powerful cultivator reincarnates into their past self, using future knowledge to change their destiny and avoid past mistakes.',
    initialCharacters: [
      {
        name: 'Reincarnated Protagonist',
        isProtagonist: true,
        personality: 'Calm, calculating, and experienced. Appears mature beyond their years.',
        currentCultivation: 'Foundation Establishment',
        notes: 'Has memories from previous life, knows future events and cultivation techniques.',
      },
    ],
  },
  {
    id: 'litrpg-system',
    name: 'System LitRPG',
    description: 'Modern person gains a system interface in cultivation world',
    genre: 'LitRPG / System',
    grandSaga: 'A modern person is transported to a cultivation world and gains a mysterious system that helps them progress through quests and rewards.',
    initialCharacters: [
      {
        name: 'System User',
        isProtagonist: true,
        personality: 'Adaptive, strategic, and opportunistic. Uses modern knowledge with system advantages.',
        currentCultivation: 'Qi Condensation',
        notes: 'Has a system interface with quests, rewards, and stat screens.',
      },
    ],
  },
  {
    id: 'urban-cultivation',
    name: 'Urban Cultivation',
    description: 'Cultivation in modern world with hidden societies',
    genre: 'Urban Cultivation',
    grandSaga: 'In a world where cultivation exists hidden from mortals, a young person discovers their talent and enters the hidden cultivation society.',
    initialCharacters: [
      {
        name: 'Modern Cultivator',
        isProtagonist: true,
        personality: 'Practical, adaptable, balancing modern life with cultivation.',
        currentCultivation: 'Foundation Establishment',
        notes: 'Discovers cultivation while living in modern society.',
      },
    ],
  },
];

// Character Templates
export const CHARACTER_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'young-master',
    name: 'Young Master',
    description: 'Arrogant noble scion with backing and resources',
    archetype: 'Antagonist',
    character: {
      name: '',
      personality: 'Arrogant, prideful, and entitled. Believes their status makes them superior.',
      currentCultivation: 'Foundation Establishment',
      notes: 'Comes from a powerful family or sect. Often serves as an early antagonist who underestimates the protagonist.',
      status: 'Alive',
      skills: ['Family Techniques', 'Wealth and Resources'],
    },
  },
  {
    id: 'jade-beauty',
    name: 'Jade Beauty',
    description: 'Beautiful female character, often a love interest or rival',
    archetype: 'Support',
    character: {
      name: '',
      personality: 'Proud, talented, and beautiful. Initially dismissive but gradually warms to protagonist.',
      currentCultivation: 'Foundation Establishment',
      notes: 'Often from a prestigious background. May start as cold or dismissive but develops feelings.',
      status: 'Alive',
      skills: ['Beauty', 'Talent'],
    },
  },
  {
    id: 'hidden-master',
    name: 'Hidden Master',
    description: 'Powerful cultivator hiding their true strength',
    archetype: 'Mentor',
    character: {
      name: '',
      personality: 'Mysterious, wise, and powerful. Appears weak but is actually extremely strong.',
      currentCultivation: 'Nascent Soul',
      notes: 'Hides their cultivation level. Often tests or guides the protagonist while appearing as a weak old man or ordinary person.',
      status: 'Alive',
      skills: ['Concealment', 'Teaching'],
    },
  },
  {
    id: 'rival-friend',
    name: 'Rival Friend',
    description: 'Friendly rival who competes but respects the protagonist',
    archetype: 'Support',
    character: {
      name: '',
      personality: 'Competitive, honorable, and friendly. Respects strength and fair competition.',
      currentCultivation: 'Foundation Establishment',
      notes: 'Starts as a rival but becomes a close friend and ally. Often helps the protagonist grow.',
      status: 'Alive',
      skills: ['Combat', 'Loyalty'],
    },
  },
  {
    id: 'sect-elder',
    name: 'Sect Elder',
    description: 'Powerful elder who oversees disciples',
    archetype: 'Authority',
    character: {
      name: '',
      personality: 'Strict, fair, and protective of the sect. Values talent and discipline.',
      currentCultivation: 'Core Formation',
      notes: 'Oversees sect affairs and disciples. May take the protagonist as a disciple.',
      status: 'Alive',
      skills: ['Leadership', 'Teaching'],
    },
  },
];

// Arc Templates
export const ARC_TEMPLATES: ArcTemplate[] = [
  {
    id: 'sect-entry',
    name: 'Sect Entry Arc',
    description: 'Protagonist joins a sect and faces initial challenges',
    arc: {
      title: 'Sect Entry',
      description: 'The protagonist joins a cultivation sect and must prove themselves among other disciples.',
      status: 'active',
      targetChapters: 10,
      checklist: [
        { id: generateUUID(), label: 'Join the sect', completed: false },
        { id: generateUUID(), label: 'Face initial discrimination or challenges', completed: false },
        { id: generateUUID(), label: 'Prove talent or gain recognition', completed: false },
        { id: generateUUID(), label: 'Make allies or enemies', completed: false },
      ],
    },
  },
  {
    id: 'tournament',
    name: 'Tournament Arc',
    description: 'Competition arc with rankings and rewards',
    arc: {
      title: 'Sect Tournament',
      description: 'A major tournament where cultivators compete for rankings, rewards, and recognition.',
      status: 'active',
      targetChapters: 15,
      checklist: [
        { id: generateUUID(), label: 'Tournament announcement and preparation', completed: false },
        { id: generateUUID(), label: 'Preliminary rounds', completed: false },
        { id: generateUUID(), label: 'Face strong opponents', completed: false },
        { id: generateUUID(), label: 'Reveal hidden techniques or power', completed: false },
        { id: generateUUID(), label: 'Win or achieve significant result', completed: false },
      ],
    },
  },
  {
    id: 'treasure-hunt',
    name: 'Treasure Hunt Arc',
    description: 'Search for ancient treasures or inheritances',
    arc: {
      title: 'Ancient Inheritance',
      description: 'The protagonist discovers or searches for an ancient inheritance left by a powerful cultivator.',
      status: 'active',
      targetChapters: 20,
      checklist: [
        { id: generateUUID(), label: 'Discover clues or location', completed: false },
        { id: generateUUID(), label: 'Face trials and tests', completed: false },
        { id: generateUUID(), label: 'Compete with other seekers', completed: false },
        { id: generateUUID(), label: 'Obtain inheritance or treasure', completed: false },
        { id: generateUUID(), label: 'Deal with consequences', completed: false },
      ],
    },
  },
  {
    id: 'revenge',
    name: 'Revenge Arc',
    description: 'Seeking revenge against enemies',
    arc: {
      name: 'Revenge',
      description: 'The protagonist seeks revenge against those who wronged them or their loved ones.',
      startChapter: 1,
      endChapter: 25,
      status: 'planned',
      checklist: [
        { id: generateUUID(), text: 'Identify enemies and their strength', completed: false },
        { id: generateUUID(), text: 'Train and prepare', completed: false },
        { id: generateUUID(), text: 'Confront enemies', completed: false },
        { id: generateUUID(), text: 'Overcome obstacles', completed: false },
        { id: generateUUID(), text: 'Achieve revenge or resolution', completed: false },
      ],
    },
  },
];

// World Entry Templates
export const WORLD_ENTRY_TEMPLATES: WorldEntryTemplate[] = [
  {
    id: 'cultivation-realm',
    name: 'Cultivation Realm',
    description: 'Standard cultivation realm structure',
    category: 'PowerLevels',
    entry: {
      title: 'Cultivation Realms',
      content: `Foundation Establishment - Initial stage, building foundation
Qi Condensation - Gathering and refining qi
Core Formation - Forming core, major breakthrough
Nascent Soul - Soul cultivation begins
Soul Transformation - Advanced soul cultivation
Void Refinement - Approaching immortality
Immortal Ascension - Becoming immortal`,
      category: 'PowerLevels',
    },
  },
  {
    id: 'sect-structure',
    name: 'Sect Structure',
    description: 'Hierarchical sect organization',
    category: 'Systems',
    entry: {
      title: 'Sect Hierarchy',
      content: `Outer Disciples - Lowest rank, basic resources
Inner Disciples - Core members, better resources
Core Disciples - Elite, personal guidance
Elders - Powerful cultivators, teachers
Sect Master - Leader of the sect`,
      category: 'Systems',
    },
  },
  {
    id: 'spirit-stones',
    name: 'Spirit Stones',
    description: 'Currency and cultivation resource',
    category: 'Systems',
    entry: {
      title: 'Spirit Stones',
      content: `Low-Grade Spirit Stones - Common currency
Mid-Grade Spirit Stones - Valuable, used for cultivation
High-Grade Spirit Stones - Rare, powerful cultivation aid
Top-Grade Spirit Stones - Extremely rare, major resources`,
      category: 'Systems',
    },
  },
  {
    id: 'mystical-location',
    name: 'Mystical Location',
    description: 'Dangerous but rewarding location',
    category: 'Geography',
    entry: {
      title: '',
      content: 'A mysterious location filled with danger and opportunity. Contains rare resources, ancient ruins, or powerful beasts.',
      category: 'Geography',
    },
  },
];

/**
 * Get templates filtered by genre
 */
export function getNovelTemplatesByGenre(genre: string): NovelTemplate[] {
  return NOVEL_TEMPLATES.filter(t => t.genre === genre);
}

/**
 * Get character templates by archetype
 */
export function getCharacterTemplatesByArchetype(archetype: string): CharacterTemplate[] {
  return CHARACTER_TEMPLATES.filter(t => t.archetype === archetype);
}

/**
 * Apply a novel template to create initial novel data
 */
export function applyNovelTemplate(template: NovelTemplate, title: string): Partial<NovelState> {
  return {
    title,
    genre: template.genre,
    grandSaga: template.grandSaga,
    // Note: Characters and arcs would need to be created separately
    // as they require proper IDs and relationships
  };
}

/**
 * Apply a character template
 */
export function applyCharacterTemplate(template: CharacterTemplate): Partial<Character> {
  return {
    ...template.character,
    id: generateUUID(),
  };
}

/**
 * Apply an arc template
 */
export function applyArcTemplate(template: ArcTemplate, startChapter: number): Partial<Arc> {
  return {
    ...template.arc,
    id: generateUUID(),
    startedAtChapter: startChapter,
    checklist: template.arc.checklist?.map(item => ({
      ...item,
      id: generateUUID(),
    })),
  };
}

/**
 * Apply a world entry template
 */
export function applyWorldEntryTemplate(template: WorldEntryTemplate, realmId: string): Partial<WorldEntry> {
  return {
    ...template.entry,
    id: generateUUID(),
    realmId,
  };
}

// Import NovelState type
import type { NovelState } from '../types';

/**
 * Style Rubrics Configuration
 * 
 * Default style rubrics for the Critique-Correction Loop.
 * These rubrics define quality standards for prose evaluation.
 */

import type { StyleRubric, StyleCriterion } from '../types/critique';

/**
 * Individual criteria that can be combined into rubrics
 */
export const STYLE_CRITERIA: Record<string, StyleCriterion> = {
  // === VOICE CRITERIA ===
  poetic_language: {
    id: 'poetic_language',
    name: 'Poetic Language',
    description: 'Uses vivid imagery, metaphors, and evocative descriptions that elevate prose beyond functional writing.',
    weight: 8,
    category: 'voice',
    evaluationPrompt: `Evaluate the poetic quality of this prose:
- Does it use vivid, original metaphors and similes?
- Are there evocative sensory descriptions?
- Does the language create atmosphere and mood?
- Are there memorable turns of phrase?
Score 1-10 where 10 = beautifully poetic with rich imagery, 1 = flat, purely functional prose.`,
    examples: [
      {
        good: 'The qi swirled through his meridians like rivers of liquid starlight, each thread humming with the echoes of ancient power.',
        bad: 'The qi moved through his meridians. It was powerful and ancient.',
      },
    ],
  },

  adverb_minimization: {
    id: 'adverb_minimization',
    name: 'Adverb Minimization',
    description: 'Prefers strong verbs over weak verb + adverb combinations. Avoids -ly adverbs except when truly necessary.',
    weight: 6,
    category: 'technical',
    evaluationPrompt: `Evaluate adverb usage in this prose:
- Count -ly adverbs (quickly, slowly, angrily, etc.)
- Are adverbs used when stronger verbs would work better?
- Is "said quietly" used instead of "whispered"?
- Is "ran quickly" used instead of "sprinted"?
Score 1-10 where 10 = minimal adverbs with strong verbs, 1 = excessive adverb dependency.
Note: Some adverbs are acceptable, especially in dialogue attribution or for genuine emphasis.`,
    examples: [
      {
        good: 'He sprinted through the forest, branches whipping past his face.',
        bad: 'He ran very quickly through the forest, branches moving quickly past his face.',
      },
    ],
  },

  humble_cold_mc: {
    id: 'humble_cold_mc',
    name: 'Humble but Cold MC Voice',
    description: 'The main character sounds humble (not arrogant or boastful) but maintains emotional distance and reserve.',
    weight: 9,
    category: 'character',
    evaluationPrompt: `Evaluate whether the main character's voice is humble but cold:
HUMBLE indicators (positive):
- Downplays own achievements
- Acknowledges others' contributions
- Doesn't boast or brag
- Shows respect without servility

COLD indicators (positive):
- Emotional restraint in descriptions
- Reserved in expressing feelings
- Measured responses to emotional situations
- Professional/detached tone in narration

PROBLEMS (negative):
- Arrogant thoughts or dialogue ("I am the best", "No one can match me")
- Excessive warmth or emotional outbursts
- Too much self-congratulation

Score 1-10 where 10 = perfectly humble and cold, 1 = arrogant or overly emotional.`,
    examples: [
      {
        good: '"It was nothing special," he said, though the technique had taken him three years to master. He turned away before they could see his face.',
        bad: '"Of course I succeeded! I am the greatest cultivator of my generation!" He laughed warmly and embraced his friends.',
      },
    ],
  },

  show_dont_tell: {
    id: 'show_dont_tell',
    name: 'Show, Don\'t Tell',
    description: 'Demonstrates emotions and situations through action, dialogue, and sensory detail rather than stating them directly.',
    weight: 8,
    category: 'narrative',
    evaluationPrompt: `Evaluate "show don't tell" quality:
- Are emotions shown through physical reactions, dialogue, and actions?
- Are character traits demonstrated through behavior rather than stated?
- Are settings conveyed through sensory details rather than labels?
- Does the text avoid phrases like "He felt angry" or "She was beautiful"?

Score 1-10 where 10 = masterful showing throughout, 1 = constant telling with no showing.`,
    examples: [
      {
        good: 'His jaw clenched. The teacup in his hand cracked, hot liquid spilling over white knuckles.',
        bad: 'He was very angry. He felt rage building inside him.',
      },
    ],
  },

  dialogue_naturalness: {
    id: 'dialogue_naturalness',
    name: 'Natural Dialogue',
    description: 'Dialogue sounds like real speech with natural rhythms, interruptions, and character-specific voices.',
    weight: 7,
    category: 'technical',
    evaluationPrompt: `Evaluate dialogue naturalness:
- Does dialogue sound like real people speaking?
- Are there character-specific speech patterns?
- Are there natural interruptions, pauses, and incomplete sentences?
- Does it avoid overly formal or stilted phrasing?
- Do characters avoid perfectly explaining everything?

Score 1-10 where 10 = completely natural and distinctive, 1 = stilted and robotic.`,
    examples: [
      {
        good: '"I was trying to—" "Not now." He cut her off, turning away. "Maybe... later, when things are—" "When things are what?" She wasn\'t going to let him escape that easily.',
        bad: '"I would like to explain my reasoning to you in full detail," he said. "Please listen carefully to what I am about to say, as it is very important."',
      },
    ],
  },

  sentence_variety: {
    id: 'sentence_variety',
    name: 'Sentence Variety',
    description: 'Uses varied sentence lengths and structures to create rhythm and prevent monotony.',
    weight: 6,
    category: 'style',
    evaluationPrompt: `Evaluate sentence variety:
- Is there a good mix of short, medium, and long sentences?
- Do sentence openings vary (not always starting with "He" or "The")?
- Are there occasional fragments for emphasis?
- Does the rhythm match the content (fast sentences for action, longer for reflection)?

Score 1-10 where 10 = excellent variety creating strong rhythm, 1 = monotonous same-length sentences.`,
    examples: [
      {
        good: 'He struck. The blade sang. Three moves—each precise, each deadly. His opponent never saw the fourth coming, a sweeping arc that ended everything in silence.',
        bad: 'He struck with his sword. He moved forward quickly. He attacked again. He defeated his opponent. He won the fight.',
      },
    ],
  },

  tension_pacing: {
    id: 'tension_pacing',
    name: 'Tension and Pacing',
    description: 'Builds and releases tension appropriately, with pacing that matches scene intensity.',
    weight: 8,
    category: 'narrative',
    evaluationPrompt: `Evaluate tension and pacing:
- Does tension build appropriately before climactic moments?
- Are quiet moments used for contrast and recovery?
- Does the pacing match the content (fast for action, slower for emotional beats)?
- Are cliffhangers and hooks used effectively?
- Is there a sense of rising stakes?

Score 1-10 where 10 = masterful tension control, 1 = flat or erratic pacing.`,
  },

  sensory_immersion: {
    id: 'sensory_immersion',
    name: 'Sensory Immersion',
    description: 'Engages multiple senses (sight, sound, smell, taste, touch) to create immersive scenes.',
    weight: 7,
    category: 'style',
    evaluationPrompt: `Evaluate sensory immersion:
- Are multiple senses engaged beyond just visual descriptions?
- Are sounds, smells, textures, and tastes included where appropriate?
- Do sensory details enhance the scene rather than slow it down?
- Are sensory descriptions specific and concrete rather than generic?

Score 1-10 where 10 = fully immersive multi-sensory writing, 1 = purely visual or no sensory detail.`,
    examples: [
      {
        good: 'The incense burned bitter and sweet, its smoke coiling past walls that hummed with barely contained power. Cold stone beneath his palms. The taste of copper on his tongue from biting it too hard.',
        bad: 'The room was full of incense. The walls had spiritual power. He knelt on the floor.',
      },
    ],
  },

  avoid_repetition: {
    id: 'avoid_repetition',
    name: 'Avoid Repetition',
    description: 'Avoids repeating words, phrases, or sentence structures within close proximity.',
    weight: 5,
    category: 'technical',
    evaluationPrompt: `Evaluate repetition avoidance:
- Are the same words repeated unnecessarily within paragraphs?
- Are sentence structures varied or repetitive?
- Are character names overused vs pronouns?
- Is there thematic repetition that feels redundant?

Score 1-10 where 10 = no distracting repetition, 1 = constant word/phrase repetition.`,
  },

  emotional_depth: {
    id: 'emotional_depth',
    name: 'Emotional Depth',
    description: 'Characters have complex, layered emotional responses that feel authentic rather than surface-level.',
    weight: 8,
    category: 'character',
    evaluationPrompt: `Evaluate emotional depth:
- Do characters have complex, sometimes contradictory emotions?
- Are emotional reactions proportional and believable?
- Is there subtext beneath surface emotions?
- Do emotions develop and change throughout scenes?
- Are characters' internal conflicts evident?

Score 1-10 where 10 = profound emotional complexity, 1 = flat or unconvincing emotions.`,
  },

  world_integration: {
    id: 'world_integration',
    name: 'World Integration',
    description: 'World-building elements are naturally woven into the narrative rather than info-dumped.',
    weight: 6,
    category: 'narrative',
    evaluationPrompt: `Evaluate world integration:
- Is world-building delivered through action and dialogue rather than exposition?
- Do characters interact naturally with their environment?
- Are cultivation/power systems shown in use rather than explained?
- Does information flow naturally rather than in lecture form?

Score 1-10 where 10 = seamless world integration, 1 = obvious info-dumps and exposition.`,
  },

  chapter_hooks: {
    id: 'chapter_hooks',
    name: 'Chapter Hooks',
    description: 'Chapter endings create desire to continue reading through questions, tension, or promises.',
    weight: 7,
    category: 'narrative',
    evaluationPrompt: `Evaluate chapter hook quality:
- Does the chapter end with a hook that creates reading momentum?
- Is there unresolved tension or a question at the end?
- Does it avoid weak endings like "And then he went to sleep"?
- Is the ending immediate (action/dialogue) rather than summarizing?

Score 1-10 where 10 = compelling hook that demands continuation, 1 = flat ending with no pull.`,
    examples: [
      {
        good: 'The doors burst open. In the threshold stood a figure he had last seen dying in his arms, three hundred years ago.',
        bad: 'After that, he felt tired and decided to rest. Tomorrow would bring new challenges.',
      },
    ],
  },
};

/**
 * Pre-built style rubrics for common use cases
 */
export const DEFAULT_RUBRICS: StyleRubric[] = [
  {
    id: 'literary_xianxia',
    name: 'Literary Xianxia',
    description: 'High literary quality with poetic language, emotional depth, and strong character voices. For published-quality cultivation fiction.',
    criteria: [
      STYLE_CRITERIA.poetic_language,
      STYLE_CRITERIA.show_dont_tell,
      STYLE_CRITERIA.emotional_depth,
      STYLE_CRITERIA.dialogue_naturalness,
      STYLE_CRITERIA.sentence_variety,
      STYLE_CRITERIA.sensory_immersion,
      STYLE_CRITERIA.chapter_hooks,
    ],
    minimumScore: 8,
    maxIterations: 3,
    enabled: true,
    genres: ['xianxia', 'xuanhuan', 'cultivation'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'humble_cold_protagonist',
    name: 'Humble & Cold Protagonist',
    description: 'Emphasizes a protagonist who is humble about achievements but emotionally reserved. Good for anti-hero or stoic MC stories.',
    criteria: [
      STYLE_CRITERIA.humble_cold_mc,
      STYLE_CRITERIA.show_dont_tell,
      STYLE_CRITERIA.dialogue_naturalness,
      STYLE_CRITERIA.emotional_depth,
      STYLE_CRITERIA.tension_pacing,
    ],
    minimumScore: 8,
    maxIterations: 3,
    enabled: true,
    genres: ['xianxia', 'xuanhuan', 'dark fantasy'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'action_focused',
    name: 'Action-Focused',
    description: 'Prioritizes pacing, tension, and vivid action sequences over literary flourishes. For fast-paced cultivation battles.',
    criteria: [
      STYLE_CRITERIA.tension_pacing,
      STYLE_CRITERIA.sentence_variety,
      STYLE_CRITERIA.sensory_immersion,
      STYLE_CRITERIA.avoid_repetition,
      STYLE_CRITERIA.chapter_hooks,
    ],
    minimumScore: 7,
    maxIterations: 2,
    enabled: true,
    genres: ['xianxia', 'xuanhuan', 'action', 'litrpg'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'technical_polish',
    name: 'Technical Polish',
    description: 'Focuses on technical writing quality: no repetition, varied sentences, strong verbs, natural dialogue.',
    criteria: [
      STYLE_CRITERIA.adverb_minimization,
      STYLE_CRITERIA.sentence_variety,
      STYLE_CRITERIA.avoid_repetition,
      STYLE_CRITERIA.dialogue_naturalness,
      STYLE_CRITERIA.show_dont_tell,
    ],
    minimumScore: 8,
    maxIterations: 3,
    enabled: true,
    genres: ['any'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'immersive_worldbuilding',
    name: 'Immersive World-Building',
    description: 'Emphasizes sensory immersion and natural world integration without info-dumps.',
    criteria: [
      STYLE_CRITERIA.sensory_immersion,
      STYLE_CRITERIA.world_integration,
      STYLE_CRITERIA.poetic_language,
      STYLE_CRITERIA.show_dont_tell,
    ],
    minimumScore: 7,
    maxIterations: 2,
    enabled: true,
    genres: ['xianxia', 'xuanhuan', 'fantasy', 'epic fantasy'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * Get a rubric by ID
 */
export function getRubricById(id: string): StyleRubric | undefined {
  return DEFAULT_RUBRICS.find(r => r.id === id);
}

/**
 * Get all available criteria
 */
export function getAllCriteria(): StyleCriterion[] {
  return Object.values(STYLE_CRITERIA);
}

/**
 * Get criteria by category
 */
export function getCriteriaByCategory(category: StyleCriterion['category']): StyleCriterion[] {
  return Object.values(STYLE_CRITERIA).filter(c => c.category === category);
}

/**
 * Create a custom rubric from selected criteria IDs
 */
export function createCustomRubric(
  id: string,
  name: string,
  description: string,
  criteriaIds: string[],
  minimumScore: number = 8,
  maxIterations: number = 3
): StyleRubric {
  const criteria = criteriaIds
    .map(cid => STYLE_CRITERIA[cid])
    .filter((c): c is StyleCriterion => c !== undefined);

  return {
    id,
    name,
    description,
    criteria,
    minimumScore,
    maxIterations,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Merge a partial rubric with a base rubric
 */
export function mergeRubric(base: StyleRubric, overrides: Partial<StyleRubric>): StyleRubric {
  return {
    ...base,
    ...overrides,
    criteria: overrides.criteria || base.criteria,
    updatedAt: Date.now(),
  };
}

/**
 * Calculate the maximum possible weighted score for a rubric
 */
export function getMaxWeightedScore(rubric: StyleRubric): number {
  return rubric.criteria.reduce((sum, c) => sum + c.weight * 10, 0);
}

/**
 * Calculate weighted average score from individual criterion scores
 */
export function calculateWeightedScore(
  rubric: StyleRubric,
  criteriaScores: Record<string, number>
): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const criterion of rubric.criteria) {
    const score = criteriaScores[criterion.id];
    if (score !== undefined) {
      weightedSum += score * criterion.weight;
      totalWeight += criterion.weight;
    }
  }

  if (totalWeight === 0) return 0;
  return weightedSum / totalWeight;
}

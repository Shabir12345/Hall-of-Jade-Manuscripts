import { NovelState } from '../../types';

/**
 * Professional Prompt Writing Rules
 * Contains best practices for novel writing prompts, genre-specific guidelines,
 * and literary principles for Xianxia/Xuanhuan novels
 */

export interface PromptRules {
  novelWritingPrinciples: string[];
  genreGuidelines: string[];
  literaryPrinciples: string[];
  contextPrioritization: string[];
  outputQualityStandards: string[];
}

/**
 * Get prompt rules based on novel state
 */
export function getPromptRules(state: NovelState): PromptRules {
  const isXianxia = state.genre.toLowerCase().includes('xianxia') || 
                    state.genre.toLowerCase().includes('xuanhuan') ||
                    state.genre.toLowerCase().includes('cultivation');

  return {
    novelWritingPrinciples: [
      'Every scene must have a clear purpose and advance the plot or character development',
      'Show, don\'t tell: Use sensory details, actions, and dialogue instead of exposition',
      'Maintain narrative momentum: Each chapter should end with a hook or question',
      'Balance action with reflection: Give characters moments to process events',
      'Use specific, concrete details rather than vague descriptions',
      'Dialogue should reveal character, advance plot, or create conflict',
      'Vary sentence structure and length for rhythm and pacing',
    ],

    genreGuidelines: isXianxia ? [
      'Maintain consistency with cultivation realms and power systems',
      'Respect established world rules (qi, dantian, meridians, tribulations)',
      'Power progression should feel earned, not arbitrary',
      'Balance cultivation advancement with character development',
      'Use appropriate genre terminology (sects, elders, disciples, techniques)',
      'Maintain consistency with the realm structure defined in the world bible',
      'System mechanics (if present) should have logical constraints',
      'Face-slapping and power displays should serve the narrative, not dominate it',
    ] : [
      'Maintain consistency with established world rules and magic systems',
      'Respect genre conventions while avoiding clichés',
      'Power progression should feel earned and logical',
      'Balance action with character development',
    ],

    literaryPrinciples: [
      'THE LAW OF CAUSALITY: Replace "And then" with "BUT" or "THEREFORE". Every chapter must be a logical consequence or disruptive reversal',
      'THE PRINCIPLE OF THE DELTA (Δ): Characters must end each scene in a different emotional or tactical state than they began',
      'INTERNAL FRICTION: Change is painful. Characters take the path of least resistance until the "Cost of Inaction" exceeds the "Cost of Change"',
      'COGNITIVE SIMULATION: Use "Telling Details" (e.g., the smell of burnt ozone, the weight of a cold jade slip) to trigger neurological responses',
      'THE SYSTEM PERSONA: When using "System" mechanics, they must feel earned and logically consistent with the world\'s laws',
      'PRE-FLIGHT LOGIC MAP: Before writing, define Starting Value, Friction, Choice, and Resulting Value',
      'AUTO-DISCOVERY: Extract every new character, sect, fighting system, and power rank introduced',
      'INTERCONNECTIVITY: Ensure relationships (Karma Links) are updated based on dialogue and actions',
    ],

    contextPrioritization: [
      'Recent chapters (last 3-5) have highest priority for immediate context',
      'Active arc information is critical for narrative direction',
      'Character development metrics inform character actions and dialogue',
      'Style profile ensures consistency with established voice',
      'World bible entries relevant to current realm are essential',
      'Character relationships affect interactions and plot development',
      'Story progression metrics help maintain appropriate pacing and tension',
    ],

    outputQualityStandards: [
      'Chapter content MUST be at least 1500 words - this is a strict minimum requirement that must be met',
      'Heavy emphasis on "Show, Don\'t Tell" with specific, sensory details',
      'Avoid generic adjectives; use specific, evocative language',
      'Maintain genre-appropriate tone and vocabulary',
      'Ensure all character actions are consistent with their established personalities',
      'World-building elements must align with established rules',
      'Dialogue should sound natural and reveal character',
      'Pacing should match the story\'s current tension level',
      'ACCESSIBILITY FOR AGES 10-40: Use clear, everyday language when writing. Prefer common words over rare ones. If you must use a complex word, provide context that makes its meaning clear. Keep sentences clear and direct. Make the text accessible to readers of all ages within this range.',
    ],
  };
}

/**
 * Get genre-specific conventions
 */
export function getGenreConventions(genre: string): string[] {
  const genreLower = genre.toLowerCase();
  
  if (genreLower.includes('xianxia') || genreLower.includes('xuanhuan')) {
    return [
      'Cultivation realms: Follow the power levels defined in the world bible, or use standard progression (Qi Condensation, Foundation Establishment, Core Formation, Nascent Soul, etc.)',
      'Power systems: Can include Elemental, Martial, Sword Intent, Body Refinement, or custom systems defined in the world bible',
      'World structure: Follow the realms and territories defined in the world bible',
      'Common elements: Sects, Ancient Ruins, Tribulations, Pills, Artifacts, or other elements defined in the world bible',
      'Character types: Protagonist, Rivals, Elders, Sect Masters, Hidden Masters, or any character types relevant to the story',
      'Narrative patterns: Weak to Strong, Revenge, Discovery, Ascension, or any narrative pattern that fits the story',
    ];
  }
  
  if (genreLower.includes('system')) {
    return [
      'System mechanics: Rewards, Quests, Notifications, Upgrades',
      'System personality: Can be helpful, mysterious, or antagonistic',
      'System constraints: Must have logical limitations',
      'Integration: System should feel like part of the world, not external',
    ];
  }
  
  return [];
}

/**
 * Get prompt structure guidelines
 */
export function getPromptStructure(): {
  sections: string[];
  order: string[];
} {
  return {
    sections: [
      'Role Definition',
      'Story Context',
      'Character Context',
      'Style Guidelines',
      'Narrative Context',
      'Task Definition',
      'Constraints',
      'Output Format',
    ],
    order: [
      'Start with role definition to establish AI persona',
      'Provide comprehensive story context (world, arcs, recent events)',
      'Include relevant character information and development state',
      'Specify style guidelines from analyzed writing patterns',
      'Add narrative context (progression, tension, pacing)',
      'Clearly define the task with specific requirements',
      'List constraints and requirements',
      'Specify exact output format expected',
    ],
  };
}
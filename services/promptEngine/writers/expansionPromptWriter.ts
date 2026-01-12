import { NovelState, BuiltPrompt } from '../../../types';
import { buildSimplifiedPrompt } from '../promptBuilder';
import { SYSTEM_INSTRUCTION } from '../../../constants';

/**
 * Expansion Prompt Writer
 * Creates prompts for creative expansion that maintain world consistency
 * and align with character development
 */

/**
 * Builds a prompt for creative expansion
 */
export async function buildExpansionPrompt(
  state: NovelState,
  type: string,
  currentText: string
): Promise<BuiltPrompt> {
  const isPowerOrSystem = type.includes('PowerLevels') || 
                          type.includes('Systems') || 
                          type.includes('Architect');

  // Determine expansion focus based on type
  let expansionFocus = '';
  if (isPowerOrSystem) {
    expansionFocus = `Focus on:
- Define clear tiers and breakthrough requirements
- Describe spiritual or physical costs
- Explain why this system works this way
- Consider what happens if it's abused
- Ensure consistency with existing world bible and power systems`;
  } else if (type.includes('Technique')) {
    expansionFocus = `Focus on:
- Give it a legendary, memorable name
- Describe devastating, visual effects
- Ensure it fits the cultivation system
- Consider the characters who might use it`;
  } else if (type.includes('Plot') || type.includes('Arc')) {
    expansionFocus = `Focus on:
- Align with current arc and story progression
- Consider characters involved and their current state
- Ensure it advances the narrative meaningfully`;
  } else {
    expansionFocus = `Focus on:
- Maintain consistency with established world
- Align with character development
- Respect genre conventions`;
  }

  const nextChapterNumber = state.chapters.length + 1;
  const activeArc = state.plotLedger.find(a => a.status === 'active');
  
  const contextSnippet = `Expansion Type: ${type}
${currentText ? `Current Idea/Context: "${currentText}"` : 'Starting from scratch - create something new'}
${state.chapters.length > 0 ? `Upcoming: Chapter ${nextChapterNumber}` : 'Starting: Chapter 1'}
${activeArc ? `Current Arc: "${activeArc.title}"` : 'No active arc'}
Current Realm: ${state.realms.find(r => r.id === state.currentRealmId)?.name || 'Unknown'}`;

  const taskDescription = `Provide a brilliant, creative expansion or a brand new idea for: ${type}

${expansionFocus}

Requirements:
- Use evocative, high-fantasy genre language (e.g., "Dao-Fragment", "Celestial Tribulation", "Karma-Severing")
- Ensure consistency with the story's established context, characters, world rules, and narrative direction
- Keep the response professional, high-quality, and engaging (100-300 words)
- Make it feel like a natural part of the established world
- Consider how this expansion might be used in upcoming chapters
- Return plain text ONLY: 2–4 short paragraphs. Do NOT output JSON. Do NOT wrap the answer in markdown code fences.

HUMAN-LIKE WRITING FOR AI DETECTION EVASION:
- Vary sentence length dramatically - mix very short sentences (3-5 words) with longer ones (20-30 words)
- Use sentence fragments strategically for emphasis
- Vary vocabulary - use synonyms instead of repeating words, occasionally choose slightly less common words
- Add natural variation in formality - not everything needs perfect formal grammar
- Create natural rhythm through varied pacing
- Avoid uniform sentence structures - mix simple, compound, and complex sentences`;

  // For expansions, use minimal context to save tokens
  const minimalContext = {
    title: state.title,
    genre: state.genre,
    currentRealm: state.realms.find(r => r.id === state.currentRealmId)?.name || 'Unknown',
    activeArc: state.plotLedger.find(a => a.status === 'active')?.title || 'None',
  };

  const builtPrompt = await buildSimplifiedPrompt(state, {
    role: 'You are the "Apex Sovereign Author\'s Muse" and "Grand Architect of Daoist Systems." You create brilliant, world-consistent expansions that enhance the narrative.',
    taskDescription,
    userInstruction: currentText || 'Create something new and compelling that fits the established world.',
    contextSnippet: `Novel: "${minimalContext.title}" (${minimalContext.genre})\nCurrent Realm: ${minimalContext.currentRealm}\nActive Arc: ${minimalContext.activeArc}\n\n${contextSnippet}`,
  });

  return {
    ...builtPrompt,
    systemInstruction: SYSTEM_INSTRUCTION,
  };
}
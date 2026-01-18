/**
 * Character Context Enhancer
 * Builds comprehensive character context when character appears
 * Extracts character state from recent chapters
 * Compiles character relationships and their current status
 * Tracks character arcs and development
 */

import { NovelState, Character, Chapter } from '../types';
import { extractEndOfChapterCharacterStates } from './promptEngine/contextGatherer';

export interface ComprehensiveCharacterContext {
  character: Character;
  profile: {
    role: string;
    cultivation: string;
    status: string;
    personality: string;
    background: string;
  };
  currentState: {
    location?: string;
    emotionalState?: string;
    physicalState?: string;
    situation?: string;
  };
  activeGoals: string[];
  relationships: Array<{
    targetName: string;
    type: string;
    status: string;
    history: string;
    impact: string;
  }>;
  characterArc: {
    stage: string;
    development: string;
  };
  recentActions: string[];
  contextForChapter: string;
  formattedContext: string;
}

/**
 * Build comprehensive character context
 */
export function buildComprehensiveCharacterContext(
  character: Character,
  state: NovelState
): ComprehensiveCharacterContext {
  // Determine role
  const role = character.isProtagonist 
    ? 'Protagonist' 
    : state.antagonists.some(a => a.name.toLowerCase() === character.name.toLowerCase())
    ? 'Antagonist'
    : 'Supporting';

  // Extract current state from last chapter appearance
  const previousChapter = state.chapters[state.chapters.length - 1];
  const characterStates = previousChapter
    ? extractEndOfChapterCharacterStates(previousChapter, [character], 600)
    : [];
  
  const characterState = characterStates.find(cs => cs.characterName === character.name);

  // Extract active goals from character notes
  const activeGoals: string[] = [];
  if (character.notes) {
    const goalKeywords = ['goal', 'plan', 'need', 'must', 'will', 'intend', 'want', 'trying', 'seeking'];
    const sentences = character.notes.split(/[.!?]+/).filter(s => s.trim().length > 0);
    sentences.forEach(sentence => {
      if (goalKeywords.some(kw => sentence.toLowerCase().includes(kw))) {
        const goal = sentence.trim().substring(0, 200);
        if (goal.length > 10) {
          activeGoals.push(goal);
        }
      }
    });
  }
  
  // If no explicit goals in notes, infer from goals field
  if (activeGoals.length === 0 && character.goals) {
    const goalSentences = character.goals.split(/[.!?]+/).filter(s => s.trim().length > 0);
    goalSentences.slice(0, 3).forEach(sentence => {
      activeGoals.push(sentence.trim().substring(0, 200));
    });
  }

  // Extract relationships with current status
  const relationships = character.relationships.map(rel => {
    const targetChar = state.characterCodex.find(c => c.id === rel.characterId);
    return {
      targetName: targetChar?.name || 'Unknown',
      type: rel.type,
      status: 'Active', // Could be enhanced to track relationship status over time
      history: rel.history?.substring(0, 200) || '',
      impact: rel.impact?.substring(0, 200) || '',
    };
  });

  // Determine character arc stage
  const characterArc = {
    stage: character.isProtagonist ? 'Protagonist Arc - Ongoing' : 'Supporting Character Arc',
    development: character.notes?.substring(0, 300) || character.personality || 'Character development in progress',
  };

  // Extract recent actions from recent chapters
  const recentActions: string[] = [];
  const recentChapters = state.chapters.slice(-3);
  const charNameLower = character.name.toLowerCase();
  
  recentChapters.forEach(chapter => {
    const content = (chapter.content + ' ' + (chapter.summary || '')).toLowerCase();
    if (content.includes(charNameLower)) {
      // Extract sentences mentioning the character
      const sentences = chapter.content.split(/[.!?]+/);
      const charSentences = sentences.filter(s => 
        s.toLowerCase().includes(charNameLower) && s.trim().length > 20
      );
      
      charSentences.slice(-2).forEach(sentence => {
        const action = sentence.trim().substring(0, 200);
        if (action.length > 10 && !recentActions.some(a => a === action)) {
          recentActions.push(action);
        }
      });
    }
  });

  // Build context for this chapter
  const contextParts: string[] = [];
  
  if (character.isProtagonist) {
    contextParts.push('This is a protagonist - maintain focus on their goals and development');
  } else if (state.antagonists.some(a => a.name.toLowerCase() === character.name.toLowerCase())) {
    contextParts.push('This is an antagonist - consider their opposition to the protagonist');
    const antagonist = state.antagonists.find(a => a.name.toLowerCase() === character.name.toLowerCase());
    if (antagonist?.currentThreat) {
      contextParts.push(`Current threat: ${antagonist.currentThreat}`);
    }
  }
  
  if (characterState?.location) {
    contextParts.push(`Last seen at: ${characterState.location}`);
  }
  
  if (characterState?.emotionalState) {
    contextParts.push(`Last emotional state: ${characterState.emotionalState}`);
  }
  
  if (activeGoals.length > 0) {
    contextParts.push(`Active goals: ${activeGoals[0].substring(0, 100)}`);
  }

  const contextForChapter = contextParts.length > 0 
    ? contextParts.join('; ')
    : 'Character should appear naturally based on story needs';

  // Format comprehensive context
  const sections: string[] = [];
  sections.push(`[CHARACTER CONTEXT - ${character.name}]`);
  sections.push('');

  sections.push('PROFILE:');
  sections.push(`- Role: ${role}`);
  sections.push(`- Current Cultivation: ${character.currentCultivation || 'Not specified'}`);
  sections.push(`- Status: ${character.status || 'Unknown'}`);
  sections.push(`- Personality: ${character.personality?.substring(0, 300) || 'Not specified'}`);
  if (character.appearance) {
    sections.push(`- Appearance: ${character.appearance.substring(0, 400)}`);
  }
  if (character.background) {
    sections.push(`- Background: ${character.background.substring(0, 400)}`);
  }
  if (character.goals) {
    sections.push(`- Goals: ${character.goals.substring(0, 300)}`);
  }
  if (character.flaws) {
    sections.push(`- Flaws: ${character.flaws.substring(0, 300)}`);
  }
  sections.push('');

  if (characterState) {
    sections.push('CURRENT STATE (From Last Chapter):');
    if (characterState.location) {
      sections.push(`- Location: ${characterState.location}`);
    }
    if (characterState.emotionalState) {
      sections.push(`- Emotional State: ${characterState.emotionalState}`);
    }
    if (characterState.physicalState) {
      sections.push(`- Physical State: ${characterState.physicalState}`);
    }
    if (characterState.situation) {
      sections.push(`- Situation: ${characterState.situation.substring(0, 300)}`);
    }
    sections.push('');
  }

  if (activeGoals.length > 0) {
    sections.push('ACTIVE GOALS:');
    activeGoals.slice(0, 3).forEach((goal, index) => {
      sections.push(`${index + 1}. ${goal}`);
    });
    sections.push('');
  }

  if (relationships.length > 0) {
    sections.push('RELATIONSHIPS:');
    relationships.slice(0, 5).forEach(rel => {
      sections.push(`- ${rel.targetName} (${rel.type}): ${rel.history || rel.impact || 'Relationship active'}`);
    });
    sections.push('');
  }

  sections.push('CHARACTER ARC:');
  sections.push(`- Stage: ${characterArc.stage}`);
  sections.push(`- Development: ${characterArc.development}`);
  sections.push('');

  if (recentActions.length > 0) {
    sections.push('RECENT ACTIONS:');
    recentActions.slice(0, 3).forEach((action, index) => {
      sections.push(`${index + 1}. ${action}`);
    });
    sections.push('');
  }

  sections.push('CONTEXT FOR THIS CHAPTER:');
  sections.push(contextForChapter);
  sections.push('');

  return {
    character,
    profile: {
      role,
      cultivation: character.currentCultivation || 'Not specified',
      status: character.status || 'Unknown',
      personality: character.personality || 'Not specified',
      background: character.background || '',
    },
    currentState: characterState || {},
    activeGoals,
    relationships,
    characterArc,
    recentActions,
    contextForChapter,
    formattedContext: sections.join('\n'),
  };
}

/**
 * Build comprehensive context for multiple characters
 */
export function buildMultipleCharacterContexts(
  characterIds: string[],
  state: NovelState
): ComprehensiveCharacterContext[] {
  return characterIds
    .map(id => state.characterCodex.find(c => c.id === id))
    .filter((char): char is Character => char !== undefined)
    .map(char => buildComprehensiveCharacterContext(char, state));
}

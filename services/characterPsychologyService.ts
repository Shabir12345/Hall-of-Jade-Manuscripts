import { NovelState, Chapter, Character, CharacterPsychology } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Character Psychology Service
 * Tracks character psychological states, internal conflicts (want vs need),
 * character flaws, and growth trajectories
 */

export interface CharacterPsychologyAnalysis {
  psychologies: CharacterPsychology[];
  growthTrajectories: Array<{
    characterId: string;
    characterName: string;
    trajectory: Array<{
      chapterNumber: number;
      psychologicalState: CharacterPsychology['psychologicalState'];
      growthScore: number;
    }>;
    overallGrowthScore: number;
  }>;
  recommendations: string[];
}

/**
 * Analyzes character psychology across the story
 */
export function analyzeCharacterPsychology(state: NovelState): CharacterPsychologyAnalysis {
  const characters = state.characterCodex;

  if (characters.length === 0) {
    return {
      psychologies: [],
      growthTrajectories: [],
      recommendations: ['No characters found. Add characters to track psychological development.'],
    };
  }

  // Get or build character psychologies
  let psychologies: CharacterPsychology[] = [];
  if (state.characterPsychologies && state.characterPsychologies.length > 0) {
    psychologies = [...state.characterPsychologies];
  } else {
    // Build psychologies from chapters
    psychologies = buildCharacterPsychologies(state);
  }

  // Build growth trajectories
  const growthTrajectories = buildGrowthTrajectories(psychologies, characters);

  // Generate recommendations
  const recommendations = generatePsychologyRecommendations(psychologies, growthTrajectories);

  return {
    psychologies,
    growthTrajectories,
    recommendations,
  };
}

/**
 * Builds character psychology records from chapters
 */
function buildCharacterPsychologies(state: NovelState): CharacterPsychology[] {
  const psychologies: CharacterPsychology[] = [];
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  // Focus on protagonist and major characters
  const protagonist = state.characterCodex.find(c => c.isProtagonist);
  const majorCharacters = state.characterCodex.filter(c => 
    c.isProtagonist || 
    state.chapters.filter(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(c.name.toLowerCase())
    ).length >= 5
  );

  majorCharacters.forEach(character => {
    // Sample chapters to track psychology (every 5 chapters or significant moments)
    const sampleChapters = chapters.filter((ch, index) => 
      index % 5 === 0 || index === 0 || index === chapters.length - 1
    );

    sampleChapters.forEach(chapter => {
      const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
      const hasCharacter = content.includes(character.name.toLowerCase());

      if (hasCharacter && chapter.content.length > 300) {
        const psychologicalState = detectPsychologicalState(content, chapter, character);
        const internalConflict = detectInternalConflict(content, character);
        const characterFlaw = detectCharacterFlaw(content, character);
        const growthStage = determineGrowthStage(chapters, chapter, character);
        const growthScore = calculateGrowthScore(chapter, character, growthStage);

        psychologies.push({
          id: generateUUID(),
          characterId: character.id,
          novelId: state.id,
          chapterNumber: chapter.number,
          psychologicalState,
          internalConflict,
          characterFlaw,
          flawStatus: characterFlaw ? 'active' : 'acknowledged',
          growthStage,
          growthScore,
          notes: `Analyzed from chapter ${chapter.number}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });
  });

  return psychologies;
}

/**
 * Detects psychological state from content
 */
function detectPsychologicalState(
  content: string,
  chapter: Chapter,
  character: Character
): CharacterPsychology['psychologicalState'] {
  // Check for transformation indicators
  if (content.includes('transformed') || content.includes('changed') || content.includes('rebirth')) {
    return 'transformed';
  }

  // Check for breaking point indicators
  if (content.includes('breaking') || content.includes('breaking down') || content.includes('shattered')) {
    return 'breaking';
  }

  // Check for growth indicators
  if (content.includes('growing') || content.includes('learning') || content.includes('developing')) {
    return 'growing';
  }

  // Check for conflict indicators
  if (content.includes('conflicted') || content.includes('torn') || content.includes('struggling')) {
    return 'conflicted';
  }

  // Default to stable
  return 'stable';
}

/**
 * Detects internal conflict (want vs need)
 */
function detectInternalConflict(content: string, character: Character): string | undefined {
  const wantIndicators = ['want', 'desire', 'wish', 'crave', 'yearn'];
  const needIndicators = ['need', 'must', 'should', 'required', 'necessary'];
  const conflictIndicators = ['but', 'however', 'yet', 'although', 'though'];

  const hasWant = wantIndicators.some(indicator => content.includes(indicator));
  const hasNeed = needIndicators.some(indicator => content.includes(indicator));
  const hasConflict = conflictIndicators.some(indicator => content.includes(indicator));

  if ((hasWant && hasNeed) || hasConflict) {
    // Extract potential conflict
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      if ((wantIndicators.some(w => sentence.includes(w)) || 
           needIndicators.some(n => sentence.includes(n))) &&
          conflictIndicators.some(c => sentence.includes(c))) {
        return sentence.trim().substring(0, 200); // Limit length
      }
    }
    return 'Internal conflict detected between what character wants and needs';
  }

  return undefined;
}

/**
 * Detects character flaw
 */
function detectCharacterFlaw(content: string, character: Character): string | undefined {
  const flawIndicators = [
    'flaw', 'weakness', 'pride', 'arrogance', 'greed', 'fear',
    'doubt', 'insecurity', 'stubborn', 'impulsive', 'reckless'
  ];

  for (const indicator of flawIndicators) {
    if (content.includes(indicator)) {
      // Try to extract flaw description
      const sentences = content.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (sentence.includes(indicator) && sentence.length > 20) {
          return sentence.trim().substring(0, 150);
        }
      }
      return `Character shows ${indicator}`;
    }
  }

  return undefined;
}

/**
 * Determines growth stage
 */
function determineGrowthStage(
  chapters: Chapter[],
  currentChapter: Chapter,
  character: Character
): CharacterPsychology['growthStage'] {
  const chapterPosition = currentChapter.number / chapters.length;

  if (chapterPosition < 0.25) {
    return 'beginning';
  } else if (chapterPosition < 0.75) {
    return 'development';
  } else if (chapterPosition < 0.9) {
    return 'crisis';
  } else {
    return 'resolution';
  }
}

/**
 * Calculates growth score (0-100)
 */
function calculateGrowthScore(
  chapter: Chapter,
  character: Character,
  growthStage: CharacterPsychology['growthStage']
): number {
  let score = 30; // Base score

  // Score based on growth stage
  switch (growthStage) {
    case 'beginning':
      score = 20;
      break;
    case 'development':
      score = 40;
      break;
    case 'crisis':
      score = 60;
      break;
    case 'resolution':
      score = 80;
      break;
  }

  // Boost for logic audit (shows causality)
  if (chapter.logicAudit) {
    score += 10;
  }

  // Boost for substantial character content
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();
  const characterMentions = (content.match(new RegExp(character.name.toLowerCase(), 'g')) || []).length;
  if (characterMentions >= 5) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Builds growth trajectories for characters
 */
function buildGrowthTrajectories(
  psychologies: CharacterPsychology[],
  characters: Character[]
): CharacterPsychologyAnalysis['growthTrajectories'] {
  const trajectories: CharacterPsychologyAnalysis['growthTrajectories'] = [];

  characters.forEach(character => {
    const characterPsychologies = psychologies
      .filter(p => p.characterId === character.id)
      .sort((a, b) => (a.chapterNumber || 0) - (b.chapterNumber || 0));

    if (characterPsychologies.length === 0) return;

    const trajectory = characterPsychologies.map(psych => ({
      chapterNumber: psych.chapterNumber || 0,
      psychologicalState: psych.psychologicalState,
      growthScore: psych.growthScore,
    }));

    // Calculate overall growth score
    const overallGrowthScore = calculateOverallGrowthScore(characterPsychologies);

    trajectories.push({
      characterId: character.id,
      characterName: character.name,
      trajectory,
      overallGrowthScore,
    });
  });

  return trajectories;
}

/**
 * Calculates overall growth score for a character (0-100)
 */
function calculateOverallGrowthScore(psychologies: CharacterPsychology[]): number {
  if (psychologies.length === 0) return 0;

  // Average growth scores
  const averageScore = psychologies.reduce((sum, p) => sum + p.growthScore, 0) / psychologies.length;

  // Bonus for progression (growth over time)
  let progressionBonus = 0;
  if (psychologies.length >= 2) {
    const firstScore = psychologies[0].growthScore;
    const lastScore = psychologies[psychologies.length - 1].growthScore;
    const improvement = lastScore - firstScore;
    progressionBonus = Math.min(20, improvement / 2); // Max 20 bonus
  }

  return Math.min(100, Math.round(averageScore + progressionBonus));
}

/**
 * Generates psychology recommendations
 */
function generatePsychologyRecommendations(
  psychologies: CharacterPsychology[],
  growthTrajectories: CharacterPsychologyAnalysis['growthTrajectories']
): string[] {
  const recommendations: string[] = [];

  // Check for characters with no psychology tracking
  if (psychologies.length === 0) {
    recommendations.push('No character psychology data found. Track character states in key chapters.');
  }

  // Check for characters with low growth
  const lowGrowthCharacters = growthTrajectories.filter(t => t.overallGrowthScore < 40);
  if (lowGrowthCharacters.length > 0) {
    recommendations.push(
      `Characters with low growth scores: ${lowGrowthCharacters.map(c => c.characterName).join(', ')}. Consider adding character development moments.`
    );
  }

  // Check for unresolved flaws
  const activeFlaws = psychologies.filter(p => p.characterFlaw && p.flawStatus === 'active');
  if (activeFlaws.length > 0) {
    recommendations.push('Some character flaws are still active. Consider addressing or resolving flaws for character arcs.');
  }

  // Positive feedback
  const highGrowthCharacters = growthTrajectories.filter(t => t.overallGrowthScore >= 70);
  if (highGrowthCharacters.length > 0) {
    recommendations.push(
      `Excellent character growth: ${highGrowthCharacters.map(c => c.characterName).join(', ')}.`
    );
  }

  return recommendations;
}

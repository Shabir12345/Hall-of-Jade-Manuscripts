import { NovelState, Chapter, Character, CharacterMotivation } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Motivation Tracker
 * Tracks character motivations (primary, secondary, tertiary),
 * motivation conflicts, and motivation evolution over time
 */

export interface MotivationAnalysis {
  motivations: CharacterMotivation[];
  motivationHierarchies: Array<{
    characterId: string;
    characterName: string;
    primary?: CharacterMotivation;
    secondary: CharacterMotivation[];
    tertiary: CharacterMotivation[];
    conflicts: Array<{
      motivation1: CharacterMotivation;
      motivation2: CharacterMotivation;
      conflictType: 'internal' | 'external';
    }>;
  }>;
  recommendations: string[];
}

/**
 * Analyzes character motivations
 */
export function analyzeMotivations(state: NovelState): MotivationAnalysis {
  const characters = state.characterCodex;

  if (characters.length === 0) {
    return {
      motivations: [],
      motivationHierarchies: [],
      recommendations: ['No characters found. Add characters to track motivations.'],
    };
  }

  // Get or build motivations
  let motivations: CharacterMotivation[] = [];
  // Note: In a full implementation, we'd check state.characterMotivations
  // For now, we'll build from character data and chapters
  motivations = buildMotivations(state);

  // Build motivation hierarchies
  const motivationHierarchies = buildMotivationHierarchies(motivations, characters);

  // Generate recommendations
  const recommendations = generateMotivationRecommendations(motivations, motivationHierarchies);

  return {
    motivations,
    motivationHierarchies,
    recommendations,
  };
}

/**
 * Builds motivation records from characters and chapters
 */
function buildMotivations(state: NovelState): CharacterMotivation[] {
  const motivations: CharacterMotivation[] = [];
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  // Focus on protagonist and major characters
  const majorCharacters = state.characterCodex.filter(c => 
    c.isProtagonist || 
    chapters.filter(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(c.name.toLowerCase())
    ).length >= 3
  );

  majorCharacters.forEach(character => {
    // Extract motivations from character notes and chapter content
    const characterContent = (character.notes + ' ' + character.personality).toLowerCase();
    const characterChapters = chapters.filter(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(character.name.toLowerCase())
    );

    // Detect primary motivation (appears frequently and is stated early)
    const primaryMotivation = detectPrimaryMotivation(character, characterContent, characterChapters);
    if (primaryMotivation) {
      motivations.push(primaryMotivation);
    }

    // Detect secondary motivations
    const secondaryMotivations = detectSecondaryMotivations(character, characterContent, characterChapters);
    motivations.push(...secondaryMotivations);

    // Detect tertiary motivations
    const tertiaryMotivations = detectTertiaryMotivations(character, characterContent, characterChapters);
    motivations.push(...tertiaryMotivations);
  });

  return motivations;
}

/**
 * Detects primary motivation for a character
 */
function detectPrimaryMotivation(
  character: Character,
  content: string,
  chapters: Chapter[]
): CharacterMotivation | null {
  const motivationKeywords = [
    'revenge', 'vengeance', 'power', 'survival', 'love', 'freedom',
    'justice', 'knowledge', 'glory', 'redemption', 'protection'
  ];

  // Find most frequently mentioned motivation
  let bestMatch: { keyword: string; frequency: number } | null = null;

  motivationKeywords.forEach(keyword => {
    let count = (content.match(new RegExp(keyword, 'gi')) || []).length;
    chapters.forEach(ch => {
      const chContent = (ch.content + ' ' + ch.summary).toLowerCase();
      count += (chContent.match(new RegExp(keyword, 'gi')) || []).length;
    });

    if (!bestMatch || count > bestMatch.frequency) {
      bestMatch = { keyword, frequency: count };
    }
  });

  if (bestMatch && bestMatch.frequency >= 2) {
    const firstChapter = chapters.find(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(bestMatch!.keyword)
    );

    return {
      id: generateUUID(),
      characterId: character.id,
      motivationType: 'primary',
      motivationDescription: `Primary motivation: ${bestMatch.keyword}`,
      isConflicted: false,
      firstAppearedChapter: firstChapter?.number,
      evolutionNotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  // Fallback: infer from character type
  if (character.isProtagonist) {
    return {
      id: generateUUID(),
      characterId: character.id,
      motivationType: 'primary',
      motivationDescription: 'Protagonist\'s main goal (to be refined)',
      isConflicted: false,
      evolutionNotes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  return null;
}

/**
 * Detects secondary motivations
 */
function detectSecondaryMotivations(
  character: Character,
  content: string,
  chapters: Chapter[]
): CharacterMotivation[] {
  const motivations: CharacterMotivation[] = [];

  // Look for secondary goals mentioned in content
  const secondaryKeywords = [
    'also want', 'also need', 'secondary', 'additionally', 'besides', 'furthermore'
  ];

  // Extract motivations mentioned alongside primary
  chapters.slice(0, 5).forEach(chapter => {
    const chContent = (chapter.content + ' ' + chapter.summary).toLowerCase();
    if (chContent.includes(character.name.toLowerCase())) {
      // Look for explicit secondary motivations
      secondaryKeywords.forEach(keyword => {
        if (chContent.includes(keyword)) {
          // Extract nearby text as motivation
          const sentences = chContent.split(/[.!?]+/);
          sentences.forEach(sentence => {
            if (sentence.includes(keyword) && sentence.length > 20) {
              motivations.push({
                id: generateUUID(),
                characterId: character.id,
                motivationType: 'secondary',
                motivationDescription: sentence.trim().substring(0, 200),
                isConflicted: false,
                firstAppearedChapter: chapter.number,
                evolutionNotes: [],
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }
          });
        }
      });
    }
  });

  // Limit to 2-3 secondary motivations
  return motivations.slice(0, 3);
}

/**
 * Detects tertiary motivations
 */
function detectTertiaryMotivations(
  character: Character,
  content: string,
  chapters: Chapter[]
): CharacterMotivation[] {
  const motivations: CharacterMotivation[] = [];

  // Tertiary motivations are subtle and less central
  // They might appear once or twice
  const tertiaryKeywords = [
    'hope', 'dream', 'wish', 'desire', 'aspire', 'long for'
  ];

  chapters.forEach(chapter => {
    const chContent = (chapter.content + ' ' + chapter.summary).toLowerCase();
    if (chContent.includes(character.name.toLowerCase())) {
      tertiaryKeywords.forEach(keyword => {
        if (chContent.includes(keyword) && motivations.length < 3) {
          motivations.push({
            id: generateUUID(),
            characterId: character.id,
            motivationType: 'tertiary',
            motivationDescription: `Character ${keyword}...`,
            isConflicted: false,
            firstAppearedChapter: chapter.number,
            evolutionNotes: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      });
    }
  });

  return motivations.slice(0, 3);
}

/**
 * Builds motivation hierarchies for characters
 */
function buildMotivationHierarchies(
  motivations: CharacterMotivation[],
  characters: Character[]
): MotivationAnalysis['motivationHierarchies'] {
  const hierarchies: MotivationAnalysis['motivationHierarchies'] = [];

  characters.forEach(character => {
    const characterMotivations = motivations.filter(m => m.characterId === character.id);
    
    if (characterMotivations.length === 0) return;

    const primary = characterMotivations.find(m => m.motivationType === 'primary');
    const secondary = characterMotivations.filter(m => m.motivationType === 'secondary');
    const tertiary = characterMotivations.filter(m => m.motivationType === 'tertiary');

    // Detect conflicts
    const conflicts = detectMotivationConflicts(characterMotivations);

    hierarchies.push({
      characterId: character.id,
      characterName: character.name,
      primary,
      secondary,
      tertiary,
      conflicts,
    });
  });

  return hierarchies;
}

/**
 * Detects conflicts between motivations
 */
function detectMotivationConflicts(
  motivations: CharacterMotivation[]
): Array<{
  motivation1: CharacterMotivation;
  motivation2: CharacterMotivation;
  conflictType: 'internal' | 'external';
}> {
  const conflicts: Array<{
    motivation1: CharacterMotivation;
    motivation2: CharacterMotivation;
    conflictType: 'internal' | 'external';
  }> = [];

  // Check for conflicting motivation pairs
  const conflictingPairs = [
    ['revenge', 'forgiveness'],
    ['power', 'love'],
    ['freedom', 'duty'],
    ['self', 'others'],
    ['survival', 'sacrifice'],
  ];

  motivations.forEach((mot1, i) => {
    motivations.slice(i + 1).forEach(mot2 => {
      // Check if motivations conflict
      const desc1 = mot1.motivationDescription.toLowerCase();
      const desc2 = mot2.motivationDescription.toLowerCase();

      for (const pair of conflictingPairs) {
        if (
          (desc1.includes(pair[0]) && desc2.includes(pair[1])) ||
          (desc1.includes(pair[1]) && desc2.includes(pair[0]))
        ) {
          conflicts.push({
            motivation1: mot1,
            motivation2: mot2,
            conflictType: 'internal', // Most motivation conflicts are internal
          });

          // Mark motivations as conflicted
          mot1.isConflicted = true;
          mot2.isConflicted = true;
        }
      }
    });
  });

  return conflicts;
}

/**
 * Generates motivation recommendations
 */
function generateMotivationRecommendations(
  motivations: CharacterMotivation[],
  hierarchies: MotivationAnalysis['motivationHierarchies']
): string[] {
  const recommendations: string[] = [];

  // Check for characters without primary motivations
  const charactersWithoutPrimary = hierarchies.filter(h => !h.primary);
  if (charactersWithoutPrimary.length > 0) {
    recommendations.push(
      `Characters without primary motivations: ${charactersWithoutPrimary.map(c => c.characterName).join(', ')}. Establish clear primary goals.`
    );
  }

  // Check for motivation conflicts
  const charactersWithConflicts = hierarchies.filter(h => h.conflicts.length > 0);
  if (charactersWithConflicts.length > 0) {
    recommendations.push(
      `Characters with motivation conflicts: ${charactersWithConflicts.map(c => c.characterName).join(', ')}. These conflicts can create compelling internal tension.`
    );
  }

  // Check for characters with too many motivations
  const charactersWithTooMany = hierarchies.filter(h => 
    (h.secondary.length + h.tertiary.length) > 5
  );
  if (charactersWithTooMany.length > 0) {
    recommendations.push(
      `Characters with too many motivations: ${charactersWithTooMany.map(c => c.characterName).join(', ')}. Consider consolidating to focus character arcs.`
    );
  }

  // Positive feedback
  const wellStructured = hierarchies.filter(h => 
    h.primary && h.secondary.length >= 1 && h.secondary.length <= 3
  );
  if (wellStructured.length > 0) {
    recommendations.push(
      `Well-structured motivation hierarchies: ${wellStructured.map(c => c.characterName).join(', ')}.`
    );
  }

  return recommendations;
}

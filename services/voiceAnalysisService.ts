import { NovelState, Chapter, Character, VoiceAnalysis } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeWritingStyle } from './contextAnalysis';

/**
 * Voice Analysis Service
 * Analyzes character voice uniqueness, dialogue patterns, speech patterns,
 * and voice consistency across chapters
 */

export interface VoiceAnalysisResult {
  characterVoices: VoiceAnalysis[];
  novelVoice: {
    distinctivenessScore: number;
    consistencyScore: number;
    styleFingerprint: Record<string, any>;
    evolutionNotes: string[];
  };
  voiceComparison: Array<{
    character1: string;
    character2: string;
    similarity: number; // 0-100 (lower = more distinct)
    differences: string[];
  }>;
  recommendations: string[];
}

/**
 * Analyzes voice uniqueness for characters and novel
 */
export function analyzeVoiceUniqueness(state: NovelState): VoiceAnalysisResult {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);
  const characters = state.characterCodex;

  if (chapters.length === 0) {
    return {
      characterVoices: [],
      novelVoice: {
        distinctivenessScore: 0,
        consistencyScore: 0,
        styleFingerprint: {},
        evolutionNotes: [],
      },
      voiceComparison: [],
      recommendations: ['No chapters available for voice analysis'],
    };
  }

  // Analyze character voices
  const characterVoices = analyzeCharacterVoices(chapters, characters, state);

  // Analyze novel-level voice
  const novelVoice = analyzeNovelVoice(chapters, state);

  // Compare character voices
  const voiceComparison = compareCharacterVoices(characterVoices, characters);

  // Generate recommendations
  const recommendations = generateVoiceRecommendations(
    characterVoices,
    novelVoice,
    voiceComparison
  );

  return {
    characterVoices,
    novelVoice,
    voiceComparison,
    recommendations,
  };
}

/**
 * Analyzes voice for each character
 */
function analyzeCharacterVoices(
  chapters: Chapter[],
  characters: Character[],
  state: NovelState
): VoiceAnalysis[] {
  const voiceAnalyses: VoiceAnalysis[] = [];

  // Focus on major characters (protagonist and frequently mentioned)
  const majorCharacters = characters.filter(c => {
    if (c.isProtagonist) return true;
    
    // Check frequency of mention
    const mentionCount = chapters.filter(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(c.name.toLowerCase())
    ).length;
    
    return mentionCount >= 5;
  });

  majorCharacters.forEach(character => {
    const characterChapters = chapters.filter(ch => 
      (ch.content + ' ' + ch.summary).toLowerCase().includes(character.name.toLowerCase())
    );

    if (characterChapters.length === 0) return;

    // Extract dialogue for this character
    const dialogue = extractCharacterDialogue(characterChapters, character.name);

    // Analyze dialogue patterns
    const speechPatterns = analyzeSpeechPatterns(dialogue, character.name);

    // Calculate distinctiveness
    const distinctivenessScore = calculateVoiceDistinctiveness(
      dialogue,
      speechPatterns,
      characterChapters,
      character.name
    );

    // Calculate consistency
    const voiceConsistencyScore = calculateVoiceConsistency(
      dialogue,
      characterChapters,
      character.name
    );

    // Calculate sentence length
    const averageSentenceLength = calculateAverageDialogueSentenceLength(dialogue);

    // Calculate vocabulary sophistication
    const vocabularySophistication = calculateDialogueVocabulary(dialogue);

    voiceAnalyses.push({
      id: generateUUID(),
      characterId: character.id,
      novelId: state.id,
      distinctivenessScore,
      averageSentenceLength,
      vocabularySophistication,
      speechPatterns,
      voiceConsistencyScore,
      notes: `Voice analysis for ${character.name}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  return voiceAnalyses;
}

/**
 * Extracts dialogue for a character
 */
function extractCharacterDialogue(chapters: Chapter[], characterName: string): string[] {
  const dialogue: string[] = [];
  const nameLower = characterName.toLowerCase();

  chapters.forEach(chapter => {
    const content = chapter.content;
    // Extract quoted text (dialogue)
    const dialogueMatches = content.match(/"[^"]*"/g) || [];
    
    dialogueMatches.forEach(match => {
      // Check if dialogue might be from this character
      // (Simplified: check if character name appears nearby)
      const matchIndex = content.indexOf(match);
      const context = content.substring(Math.max(0, matchIndex - 100), matchIndex + match.length + 100).toLowerCase();
      
      if (context.includes(nameLower) || context.includes('said') || context.includes('asked')) {
        // Clean dialogue (remove quotes)
        const cleanDialogue = match.replace(/^"|"$/g, '');
        if (cleanDialogue.length > 10) {
          dialogue.push(cleanDialogue);
        }
      }
    });
  });

  return dialogue;
}

/**
 * Analyzes speech patterns for a character
 */
function analyzeSpeechPatterns(dialogue: string[], characterName: string): Record<string, any> {
  if (dialogue.length === 0) return {};

  const allDialogue = dialogue.join(' ').toLowerCase();
  
  const patterns: Record<string, any> = {};

  // Sentence length patterns
  const sentenceLengths = dialogue.map(d => d.split(/[.!?]+/).filter(s => s.trim()).length);
  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  patterns.averageSentencesPerDialogue = Math.round(avgLength * 100) / 100;

  // Common words (speech markers)
  const commonWords = ['i', 'you', 'he', 'she', 'it', 'we', 'they', 'the', 'a', 'an', 'is', 'was', 'are', 'were'];
  const wordFrequencies: Record<string, number> = {};
  
  allDialogue.split(/\s+/).forEach(word => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    if (clean.length > 2 && !commonWords.includes(clean)) {
      wordFrequencies[clean] = (wordFrequencies[clean] || 0) + 1;
    }
  });

  // Top words (speech markers)
  const topWords = Object.entries(wordFrequencies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => word);
  
  patterns.topWords = topWords;

  // Question frequency
  const questionCount = dialogue.filter(d => d.includes('?')).length;
  patterns.questionFrequency = dialogue.length > 0 ? questionCount / dialogue.length : 0;

  // Exclamation frequency
  const exclamationCount = dialogue.filter(d => d.includes('!')).length;
  patterns.exclamationFrequency = dialogue.length > 0 ? exclamationCount / dialogue.length : 0;

  // Contraction usage
  const contractionCount = (allDialogue.match(/\b(n't|'ll|'ve|'re|'m|'d|can't|won't|don't|isn't|aren't)\b/g) || []).length;
  patterns.contractionUsage = allDialogue.split(/\s+/).length > 0 
    ? contractionCount / allDialogue.split(/\s+/).length 
    : 0;

  // Formal vs informal (check for formal words)
  const formalWords = ['shall', 'ought', 'thus', 'hence', 'therefore', 'furthermore', 'moreover'];
  const informalWords = ['gonna', 'wanna', 'yeah', 'nah', 'gotta', 'kinda', 'sorta'];
  
  const formalCount = formalWords.filter(w => allDialogue.includes(w)).length;
  const informalCount = informalWords.filter(w => allDialogue.includes(w)).length;
  
  patterns.formalityLevel = formalCount > informalCount ? 'formal' : 
                            informalCount > formalCount ? 'informal' : 'neutral';

  // Dialogue tags usage (he said, she asked, etc.)
  patterns.useDialogueTags = dialogue.length > 0; // Simplified

  return patterns;
}

/**
 * Calculates voice distinctiveness (0-100)
 */
function calculateVoiceDistinctiveness(
  dialogue: string[],
  speechPatterns: Record<string, any>,
  chapters: Chapter[],
  characterName: string
): number {
  if (dialogue.length === 0) return 50;

  let score = 50; // Base score

  // Distinctive speech patterns boost score
  const topWords = speechPatterns.topWords || [];
  if (topWords.length >= 5) {
    score += 15; // Character has distinctive vocabulary
  }

  // Question/exclamation patterns (speech habits)
  const questionFreq = speechPatterns.questionFrequency || 0;
  const exclamationFreq = speechPatterns.exclamationFrequency || 0;
  
  if (questionFreq > 0.2 || exclamationFreq > 0.2) {
    score += 10; // Distinctive speech habits
  }

  // Formal vs informal distinction
  if (speechPatterns.formalityLevel !== 'neutral') {
    score += 10; // Clear formality level
  }

  // Check for unique phrases or expressions
  const uniquePhrases = findUniquePhrases(dialogue, chapters, characterName);
  score += Math.min(15, uniquePhrases.length * 3);

  // Check vocabulary sophistication (more sophisticated = more distinctive)
  const vocab = calculateDialogueVocabulary(dialogue);
  if (vocab > 60) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates voice consistency (0-100)
 */
function calculateVoiceConsistency(
  dialogue: string[],
  chapters: Chapter[],
  characterName: string
): number {
  if (dialogue.length < 2) return 50;

  let score = 50; // Base score

  // Check consistency of sentence length
  const sentenceLengths = dialogue.map(d => {
    const sentences = d.split(/[.!?]+/).filter(s => s.trim());
    return sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
  });

  const avgLength = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;
  const variance = calculateVariance(sentenceLengths);

  // Lower variance = more consistent
  if (variance < 20) {
    score += 20; // Very consistent
  } else if (variance < 50) {
    score += 10; // Moderately consistent
  } else {
    score -= 10; // Inconsistent
  }

  // Check vocabulary consistency
  const vocabSets = dialogue.map(d => new Set(d.toLowerCase().split(/\s+/)));
  const commonVocab = findCommonVocab(vocabSets);
  
  const consistencyRatio = commonVocab.size > 0 
    ? commonVocab.size / vocabSets[0].size 
    : 0;
  
  score += consistencyRatio * 20; // Bonus for vocabulary consistency

  // Check for consistent speech patterns (contractions, questions, etc.)
  const questionPatterns = dialogue.map(d => d.includes('?'));
  const exclamationPatterns = dialogue.map(d => d.includes('!'));
  
  const consistentQuestions = questionPatterns.every(q => q === questionPatterns[0]);
  const consistentExclamations = exclamationPatterns.every(e => e === exclamationPatterns[0]);
  
  if (consistentQuestions || consistentExclamations) {
    score += 10;
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes novel-level voice
 */
function analyzeNovelVoice(chapters: Chapter[], state: NovelState): VoiceAnalysisResult['novelVoice'] {
  const styleMetrics = analyzeWritingStyle(chapters);

  // Get base style profile
  const allContent = chapters.map(ch => ch.content).join(' ');

  // Create style fingerprint
  const styleFingerprint: Record<string, any> = {
    averageSentenceLength: styleMetrics.averageSentenceLength,
    vocabularyComplexity: styleMetrics.vocabularyComplexity,
    tone: styleMetrics.tone,
    descriptiveRatio: styleMetrics.descriptiveRatio,
    dialogueRatio: styleMetrics.dialogueRatio,
    pacingPattern: styleMetrics.pacingPattern,
    narrativePerspective: styleMetrics.narrativePerspective,
  };

  // Calculate distinctiveness (how unique is the narrative voice)
  const distinctivenessScore = calculateNovelDistinctiveness(chapters, styleFingerprint);

  // Calculate consistency (does voice remain consistent across chapters)
  const consistencyScore = calculateNovelConsistency(chapters, styleMetrics);

  // Track evolution notes
  const evolutionNotes = trackVoiceEvolution(chapters);

  return {
    distinctivenessScore,
    consistencyScore,
    styleFingerprint,
    evolutionNotes,
  };
}

/**
 * Calculates novel distinctiveness
 */
function calculateNovelDistinctiveness(
  chapters: Chapter[],
  styleFingerprint: Record<string, any>
): number {
  let score = 50; // Base score

  // Distinctive sentence length
  const avgLength = styleFingerprint.averageSentenceLength || 15;
  if (avgLength < 10 || avgLength > 25) {
    score += 10; // Non-standard sentence length
  }

  // Distinctive vocabulary
  const vocabComplexity = styleFingerprint.vocabularyComplexity || 0.3;
  if (vocabComplexity > 0.5 || vocabComplexity < 0.2) {
    score += 10; // Distinctive vocabulary level
  }

  // Distinctive tone
  if (styleFingerprint.tone === 'formal' || styleFingerprint.tone === 'casual') {
    score += 10; // Clear tone (distinctive)
  }

  // Check for unique narrative patterns
  const allContent = chapters.map(ch => ch.content).join(' ');
  const uniquePatterns = detectUniqueNarrativePatterns(allContent);
  score += Math.min(20, uniquePatterns.length * 5);

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates novel consistency
 */
function calculateNovelConsistency(
  chapters: Chapter[],
  styleMetrics: ReturnType<typeof analyzeWritingStyle>
): number {
  if (chapters.length < 3) return 50;

  let score = 50; // Base score

  // Check consistency of sentence length across chapters
  const chapterLengths = chapters.map(ch => {
    const sentences = ch.content.split(/[.!?]+/).filter(s => s.trim());
    const words = ch.content.split(/\s+/);
    return sentences.length > 0 ? words.length / sentences.length : 15;
  });

  const variance = calculateVariance(chapterLengths);
  
  // Lower variance = more consistent
  if (variance < 10) {
    score += 20;
  } else if (variance < 25) {
    score += 10;
  } else {
    score -= 10; // Inconsistent
  }

  // Check for consistent tone
  const chaptersWithClearTone = chapters.filter(ch => {
    const content = ch.content.toLowerCase();
    const hasFormal = content.includes('shall') || content.includes('thus') || content.includes('hence');
    const hasInformal = content.includes('gonna') || content.includes('wanna') || content.includes('yeah');
    return hasFormal || hasInformal;
  }).length;

  const toneConsistency = chaptersWithClearTone / chapters.length;
  if (toneConsistency > 0.7 || toneConsistency < 0.3) {
    score += 15; // Consistent tone
  }

  // Check vocabulary consistency
  const vocabComplexities = chapters.map(ch => {
    const words = ch.content.split(/\s+/);
    const unique = new Set(words.map(w => w.toLowerCase()));
    return words.length > 0 ? unique.size / words.length : 0.3;
  });

  const vocabVariance = calculateVariance(vocabComplexities);
  if (vocabVariance < 0.05) {
    score += 15; // Consistent vocabulary
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Tracks voice evolution
 */
function trackVoiceEvolution(chapters: Chapter[]): string[] {
  const evolutionNotes: string[] = [];

  if (chapters.length < 5) return evolutionNotes;

  // Compare early vs late chapters
  const earlyChapters = chapters.slice(0, Math.min(5, Math.ceil(chapters.length * 0.2)));
  const lateChapters = chapters.slice(-Math.min(5, Math.ceil(chapters.length * 0.2)));

  const earlyStyle = analyzeWritingStyle(earlyChapters);
  const lateStyle = analyzeWritingStyle(lateChapters);

  // Check for changes
  const sentenceLengthChange = lateStyle.averageSentenceLength - earlyStyle.averageSentenceLength;
  if (Math.abs(sentenceLengthChange) > 5) {
    evolutionNotes.push(
      `Sentence length ${sentenceLengthChange > 0 ? 'increased' : 'decreased'} from early to late chapters (${earlyStyle.averageSentenceLength.toFixed(1)} to ${lateStyle.averageSentenceLength.toFixed(1)} words)`
    );
  }

  const vocabChange = lateStyle.vocabularyComplexity - earlyStyle.vocabularyComplexity;
  if (Math.abs(vocabChange) > 0.1) {
    evolutionNotes.push(
      `Vocabulary complexity ${vocabChange > 0 ? 'increased' : 'decreased'} from early to late chapters`
    );
  }

  if (earlyStyle.tone !== lateStyle.tone) {
    evolutionNotes.push(`Tone changed from ${earlyStyle.tone} to ${lateStyle.tone}`);
  }

  return evolutionNotes;
}

/**
 * Compares character voices
 */
function compareCharacterVoices(
  voiceAnalyses: VoiceAnalysis[],
  characters: Character[]
): VoiceAnalysisResult['voiceComparison'] {
  const comparisons: VoiceAnalysisResult['voiceComparison'] = [];

  for (let i = 0; i < voiceAnalyses.length; i++) {
    for (let j = i + 1; j < voiceAnalyses.length; j++) {
      const voice1 = voiceAnalyses[i];
      const voice2 = voiceAnalyses[j];

      const character1 = characters.find(c => c.id === voice1.characterId);
      const character2 = characters.find(c => c.id === voice2.characterId);

      if (!character1 || !character2) continue;

      // Calculate similarity
      const similarity = calculateVoiceSimilarity(voice1, voice2);

      // Find differences
      const differences = findVoiceDifferences(voice1, voice2);

      comparisons.push({
        character1: character1.name,
        character2: character2.name,
        similarity,
        differences,
      });
    }
  }

  return comparisons.sort((a, b) => a.similarity - b.similarity); // Most distinct first
}

/**
 * Calculates voice similarity (0-100, lower = more distinct)
 */
function calculateVoiceSimilarity(voice1: VoiceAnalysis, voice2: VoiceAnalysis): number {
  let similarity = 50; // Base similarity

  // Compare sentence lengths
  const lengthDiff = Math.abs((voice1.averageSentenceLength || 15) - (voice2.averageSentenceLength || 15));
  similarity += lengthDiff > 5 ? -10 : 0; // Different lengths = less similar

  // Compare vocabulary sophistication
  const vocabDiff = Math.abs((voice1.vocabularySophistication || 50) - (voice2.vocabularySophistication || 50));
  similarity += vocabDiff > 20 ? -10 : 0;

  // Compare speech patterns
  const patterns1 = voice1.speechPatterns || {};
  const patterns2 = voice2.speechPatterns || {};

  // Compare formality
  if (patterns1.formalityLevel && patterns2.formalityLevel) {
    if (patterns1.formalityLevel === patterns2.formalityLevel) {
      similarity += 10; // Same formality = more similar
    } else {
      similarity -= 10; // Different formality = less similar
    }
  }

  // Compare question frequency
  const qFreq1 = patterns1.questionFrequency || 0;
  const qFreq2 = patterns2.questionFrequency || 0;
  const qFreqDiff = Math.abs(qFreq1 - qFreq2);
  similarity += qFreqDiff > 0.2 ? -5 : 5;

  return Math.min(100, Math.max(0, Math.round(similarity)));
}

/**
 * Finds differences between voices
 */
function findVoiceDifferences(voice1: VoiceAnalysis, voice2: VoiceAnalysis): string[] {
  const differences: string[] = [];

  const patterns1 = voice1.speechPatterns || {};
  const patterns2 = voice2.speechPatterns || {};

  // Sentence length difference
  const length1 = voice1.averageSentenceLength || 15;
  const length2 = voice2.averageSentenceLength || 15;
  if (Math.abs(length1 - length2) > 5) {
    differences.push(`${length1 > length2 ? 'Longer' : 'Shorter'} sentences (${length1.toFixed(1)} vs ${length2.toFixed(1)} words)`);
  }

  // Formality difference
  if (patterns1.formalityLevel && patterns2.formalityLevel && 
      patterns1.formalityLevel !== patterns2.formalityLevel) {
    differences.push(`Different formality levels (${patterns1.formalityLevel} vs ${patterns2.formalityLevel})`);
  }

  // Vocabulary sophistication
  const vocab1 = voice1.vocabularySophistication || 50;
  const vocab2 = voice2.vocabularySophistication || 50;
  if (Math.abs(vocab1 - vocab2) > 15) {
    differences.push(`${vocab1 > vocab2 ? 'More' : 'Less'} sophisticated vocabulary`);
  }

  // Question frequency
  const qFreq1 = patterns1.questionFrequency || 0;
  const qFreq2 = patterns2.questionFrequency || 0;
  if (Math.abs(qFreq1 - qFreq2) > 0.15) {
    differences.push(`${qFreq1 > qFreq2 ? 'More' : 'Fewer'} questions`);
  }

  return differences;
}

/**
 * Helper functions
 */
function calculateAverageDialogueSentenceLength(dialogue: string[]): number {
  if (dialogue.length === 0) return 0;
  
  const totalLength = dialogue.reduce((sum, d) => {
    const sentences = d.split(/[.!?]+/).filter(s => s.trim());
    const words = d.split(/\s+/).filter(w => w.length > 0);
    return sum + (sentences.length > 0 ? words.length / sentences.length : 0);
  }, 0);

  return Math.round((totalLength / dialogue.length) * 100) / 100;
}

function calculateDialogueVocabulary(dialogue: string[]): number {
  if (dialogue.length === 0) return 0;

  const allWords = dialogue.join(' ').split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(allWords.map(w => w.toLowerCase().replace(/[^\w]/g, '')));

  return allWords.length > 0 ? Math.round((uniqueWords.size / allWords.length) * 100) : 0;
}

function findUniquePhrases(dialogue: string[], chapters: Chapter[], characterName: string): string[] {
  // Look for phrases that appear frequently for this character but rarely elsewhere
  const characterDialogue = dialogue.join(' ').toLowerCase();
  const allContent = chapters.map(ch => ch.content.toLowerCase()).join(' ');

  const phrases: string[] = [];
  
  // Extract 3-4 word phrases
  const words = characterDialogue.split(/\s+/);
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    const phraseCount = (characterDialogue.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
    const allCount = (allContent.match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

    // If phrase appears more for this character than others, it's distinctive
    if (phraseCount >= 2 && phraseCount / Math.max(1, allCount) > 2) {
      phrases.push(phrase);
    }
  }

  return phrases.slice(0, 5);
}

function findCommonVocab(vocabSets: Set<string>[]): Set<string> {
  if (vocabSets.length === 0) return new Set();

  const common = new Set(vocabSets[0]);
  
  for (let i = 1; i < vocabSets.length; i++) {
    vocabSets[i].forEach(word => {
      if (!common.has(word)) {
        common.delete(word);
      }
    });
  }

  return common;
}

function detectUniqueNarrativePatterns(content: string): string[] {
  const patterns: string[] = [];
  
  // Check for unusual narrative structures
  if (content.includes('meanwhile') || content.includes('elsewhere')) {
    patterns.push('Multiple perspectives');
  }

  if (content.includes('flashback') || content.includes('remembered')) {
    patterns.push('Flashback usage');
  }

  if ((content.match(/^[A-Z][^.!?]*[.!?]/gm) || []).length > 100) {
    patterns.push('Rich descriptive passages');
  }

  return patterns;
}

function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Generates voice recommendations
 */
function generateVoiceRecommendations(
  characterVoices: VoiceAnalysis[],
  novelVoice: VoiceAnalysisResult['novelVoice'],
  voiceComparison: VoiceAnalysisResult['voiceComparison']
): string[] {
  const recommendations: string[] = [];

  // Check for indistinct character voices
  const indistinctVoices = voiceComparison.filter(vc => vc.similarity > 70);
  if (indistinctVoices.length > 0) {
    const pairs = indistinctVoices.slice(0, 3).map(vc => `${vc.character1}/${vc.character2}`);
    recommendations.push(`Indistinct character voices detected: ${pairs.join(', ')}. Make characters sound more unique.`);
  }

  // Check for low distinctiveness
  const lowDistinctiveness = characterVoices.filter(v => v.distinctivenessScore < 50);
  if (lowDistinctiveness.length > 0) {
    recommendations.push(`${lowDistinctiveness.length} characters have low voice distinctiveness. Add unique speech patterns and vocabulary.`);
  }

  // Check for inconsistency
  const inconsistentVoices = characterVoices.filter(v => v.voiceConsistencyScore < 60);
  if (inconsistentVoices.length > 0) {
    recommendations.push(`${inconsistentVoices.length} characters have inconsistent voices. Maintain consistent speech patterns.`);
  }

  // Check novel voice consistency
  if (novelVoice.consistencyScore < 60) {
    recommendations.push(`Novel voice consistency is ${novelVoice.consistencyScore}/100. Maintain consistent narrative voice across chapters.`);
  }

  // Check novel voice distinctiveness
  if (novelVoice.distinctivenessScore < 50) {
    recommendations.push(`Novel voice distinctiveness is ${novelVoice.distinctivenessScore}/100. Develop a more unique narrative voice.`);
  }

  // Positive feedback
  if (novelVoice.distinctivenessScore >= 70 && 
      novelVoice.consistencyScore >= 70 &&
      indistinctVoices.length === 0) {
    recommendations.push('Excellent voice work! Distinct character voices and consistent narrative voice.');
  }

  return recommendations;
}

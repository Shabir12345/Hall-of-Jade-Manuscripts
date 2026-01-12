import { NovelState, Chapter, ProseQuality } from '../types';
import { analyzeWritingStyle } from './contextAnalysis';
import { generateUUID } from '../utils/uuid';

/**
 * Prose Quality Service
 * Analyzes prose quality including sentence variety, vocabulary sophistication,
 * rhythm, cadence, show vs tell balance, and cliché detection
 */

export interface ProseQualityAnalysis {
  proseQualities: ProseQuality[];
  overallProseScore: number; // 0-100
  sentenceVarietyScore: number; // 0-100
  vocabularySophisticationScore: number; // 0-100
  showTellBalanceScore: number; // 0-100
  rhythmScore: number; // 0-100
  clichesDetected: string[];
  tropesDetected: string[];
  uniqueElements: string[];
  recommendations: string[];
}

/**
 * Analyzes prose quality across chapters
 */
export function analyzeProseQuality(state: NovelState): ProseQualityAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      proseQualities: [],
      overallProseScore: 0,
      sentenceVarietyScore: 0,
      vocabularySophisticationScore: 0,
      showTellBalanceScore: 0,
      rhythmScore: 0,
      clichesDetected: [],
      tropesDetected: [],
      uniqueElements: [],
      recommendations: ['No chapters available for prose quality analysis'],
    };
  }

  // Get base style analysis
  const styleMetrics = analyzeWritingStyle(chapters);

  // Build prose quality records
  const proseQualities: ProseQuality[] = [];
  
  chapters.forEach(chapter => {
    const proseQuality = analyzeChapterProse(chapter, styleMetrics, state);
    proseQualities.push(proseQuality);
  });

  // Calculate overall scores
  const overallProseScore = calculateOverallProseScore(proseQualities);
  const sentenceVarietyScore = calculateAverageScore(proseQualities.map(p => p.sentenceVarietyScore));
  const vocabularySophisticationScore = calculateAverageScore(proseQualities.map(p => p.vocabularySophistication));
  const showTellBalanceScore = calculateShowTellBalanceScore(proseQualities);
  const rhythmScore = calculateAverageScore(proseQualities.map(p => p.rhythmScore));

  // Aggregate clichés and tropes
  const allCliches = new Set<string>();
  const allTropes = new Set<string>();
  const allUniqueElements = new Set<string>();
  
  proseQualities.forEach(pq => {
    pq.clichesDetected.forEach(c => allCliches.add(c));
    pq.tropesDetected.forEach(t => allTropes.add(t));
    pq.uniqueElements.forEach(u => allUniqueElements.add(u));
  });

  // Generate recommendations
  const recommendations = generateProseRecommendations(
    proseQualities,
    overallProseScore,
    Array.from(allCliches),
    Array.from(allTropes),
    Array.from(allUniqueElements)
  );

  return {
    proseQualities,
    overallProseScore,
    sentenceVarietyScore,
    vocabularySophisticationScore,
    showTellBalanceScore,
    rhythmScore,
    clichesDetected: Array.from(allCliches),
    tropesDetected: Array.from(allTropes),
    uniqueElements: Array.from(allUniqueElements),
    recommendations,
  };
}

/**
 * Analyzes prose quality for a single chapter
 */
function analyzeChapterProse(
  chapter: Chapter,
  styleMetrics: ReturnType<typeof analyzeWritingStyle>,
  state: NovelState
): ProseQuality {
  const content = chapter.content || '';
  
  // Analyze sentence variety
  const sentenceVarietyScore = analyzeSentenceVariety(content);
  
  // Calculate average sentence length
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const averageSentenceLength = sentences.length > 0 ? words.length / sentences.length : 0;

  // Analyze vocabulary sophistication
  const vocabularySophistication = analyzeVocabularySophistication(content);

  // Calculate Flesch-Kincaid score
  const fleschKincaidScore = calculateFleschKincaid(content);

  // Analyze show vs tell balance
  const showTellBalance = analyzeShowTellBalance(content);

  // Analyze rhythm
  const rhythmScore = analyzeRhythm(content);
  const cadencePattern = detectCadencePattern(content);

  // Detect clichés
  const clichesDetected = detectCliches(content);

  // Detect tropes
  const tropesDetected = detectTropes(content);

  // Detect unique elements
  const uniqueElements = detectUniqueElements(content, state);

  return {
    id: generateUUID(),
    novelId: state.id,
    chapterId: chapter.id,
    sentenceVarietyScore,
    averageSentenceLength: Math.round(averageSentenceLength * 100) / 100,
    vocabularySophistication,
    fleschKincaidScore,
    showTellBalance,
    rhythmScore,
    cadencePattern,
    clichesDetected,
    tropesDetected,
    uniqueElements,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Analyzes sentence variety (0-100)
 */
function analyzeSentenceVariety(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return 50;

  // Calculate sentence lengths
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  
  // Categorize sentences
  const shortSentences = sentenceLengths.filter(len => len < 10).length;
  const mediumSentences = sentenceLengths.filter(len => len >= 10 && len < 25).length;
  const longSentences = sentenceLengths.filter(len => len >= 25).length;

  // Ideal distribution: ~30% short, ~50% medium, ~20% long
  const total = sentences.length;
  const shortRatio = shortSentences / total;
  const mediumRatio = mediumSentences / total;
  const longRatio = longSentences / total;

  let score = 50; // Base score

  // Score based on how close to ideal distribution
  const idealShort = 0.3;
  const idealMedium = 0.5;
  const idealLong = 0.2;

  const shortScore = 100 - Math.abs(shortRatio - idealShort) * 200;
  const mediumScore = 100 - Math.abs(mediumRatio - idealMedium) * 200;
  const longScore = 100 - Math.abs(longRatio - idealLong) * 200;

  score = (shortScore * 0.3 + mediumScore * 0.5 + longScore * 0.2);

  // Bonus for having all three types
  if (shortSentences > 0 && mediumSentences > 0 && longSentences > 0) {
    score += 10;
  }

  // Penalty for too much repetition (similar sentence lengths)
  const variance = calculateVariance(sentenceLengths);
  if (variance < 50) {
    score -= 10; // Low variance = repetitive
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Analyzes vocabulary sophistication (0-100)
 */
function analyzeVocabularySophistication(content: string): number {
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words.map(w => w.toLowerCase().replace(/[^\w]/g, '')));
  
  if (words.length === 0) return 0;

  // Vocabulary diversity (unique words / total words)
  const diversityRatio = uniqueWords.size / words.length;

  // Check for sophisticated words (longer, less common)
  const sophisticatedWords = words.filter(w => {
    const clean = w.toLowerCase().replace(/[^\w]/g, '');
    return clean.length >= 7 || // Longer words
           /[a-z]{3,}ed$|[a-z]{3,}ing$|[a-z]{3,}tion$/.test(clean); // Complex word forms
  });

  const sophisticationRatio = sophisticatedWords.length / words.length;

  // Combine diversity and sophistication
  const score = (diversityRatio * 50) + (sophisticationRatio * 50);

  // Bonus for having good balance (not too simple, not too complex)
  if (diversityRatio >= 0.3 && diversityRatio <= 0.6 && sophisticationRatio >= 0.1 && sophisticationRatio <= 0.3) {
    return Math.min(100, Math.round(score + 10));
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Calculates Flesch-Kincaid score (approximation)
 */
function calculateFleschKincaid(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((sum, word) => sum + estimateSyllables(word), 0);

  if (sentences.length === 0 || words.length === 0) return 0;

  const avgSentenceLength = words.length / sentences.length;
  const avgSyllablesPerWord = syllables / words.length;

  // Flesch Reading Ease (simplified)
  const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);

  return Math.round(score * 100) / 100;
}

/**
 * Estimates syllable count for a word
 */
function estimateSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '');
  if (clean.length === 0) return 1;
  
  // Simple syllable estimation
  const vowels = clean.match(/[aeiouy]+/g) || [];
  let syllables = vowels.length;

  // Adjust for silent e
  if (clean.endsWith('e')) syllables--;

  // Minimum 1 syllable
  return Math.max(1, syllables);
}

/**
 * Analyzes show vs tell balance (percentage of "show")
 */
function analyzeShowTellBalance(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length === 0) return 50;

  let showCount = 0;
  let tellCount = 0;

  // Tell indicators (direct statement)
  const tellIndicators = [
    /\b(is|was|are|were|be|been)\s+\w+/, // "He was angry"
    /\bfelt\s+\w+/, // "He felt sad"
    /\bknew\s+that/, // "He knew that..."
    /\bthought\s+that/, // "He thought that..."
    /\bseemed\s+to/, // "He seemed to..."
    /\bappeared\s+to/, // "He appeared to..."
  ];

  // Show indicators (sensory details, action)
  const showIndicators = [
    /\b(saw|heard|felt|tasted|smelled|watched|listened|observed)/, // Sensory verbs
    /\b(breathed|sighed|laughed|cried|gasped|chuckled|smiled|frowned)/, // Action verbs showing emotion
    /\b(hands|eyes|face|voice|body|gesture)/, // Physical descriptions
    /"[^"]*"/, // Dialogue (showing)
  ];

  sentences.forEach(sentence => {
    const hasTell = tellIndicators.some(pattern => pattern.test(sentence));
    const hasShow = showIndicators.some(pattern => pattern.test(sentence));

    if (hasShow && !hasTell) {
      showCount++;
    } else if (hasTell && !hasShow) {
      tellCount++;
    } else if (hasShow && hasTell) {
      showCount += 0.5; // Mixed
      tellCount += 0.5;
    }
  });

  const total = showCount + tellCount;
  if (total === 0) return 50; // Default balance

  const showPercentage = (showCount / total) * 100;
  return Math.round(showPercentage * 100) / 100;
}

/**
 * Analyzes rhythm and cadence (0-100)
 */
function analyzeRhythm(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length < 3) return 50;

  let score = 50; // Base score

  // Check for rhythmic patterns (variation in sentence length creates rhythm)
  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  const variance = calculateVariance(sentenceLengths);

  // Good variance (not too uniform, not too chaotic)
  if (variance >= 30 && variance <= 150) {
    score += 20;
  } else if (variance < 30) {
    score -= 15; // Too uniform (monotonous)
  } else if (variance > 200) {
    score -= 10; // Too chaotic
  }

  // Check for alliteration and consonance (creates rhythm)
  const alliterationPattern = /\b(\w)\w*\s+\1\w*/gi;
  const alliterationMatches = content.match(alliterationPattern);
  if (alliterationMatches && alliterationMatches.length > 0) {
    score += Math.min(15, alliterationMatches.length * 2);
  }

  // Check for repetition patterns (can create rhythm)
  const repetitionPattern = /\b(\w+\s+){2,}/gi;
  const repetitionMatches = content.match(repetitionPattern);
  if (repetitionMatches && repetitionMatches.length > 0) {
    score += Math.min(10, repetitionMatches.length);
  }

  // Check sentence flow (variation in structure)
  const structureVariety = analyzeStructureVariety(sentences);
  score += structureVariety * 0.1;

  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Detects cadence pattern
 */
function detectCadencePattern(content: string): string {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length < 3) return 'neutral';

  const sentenceLengths = sentences.map(s => s.split(/\s+/).length);
  
  // Analyze pattern
  let rising = 0;
  let falling = 0;
  let oscillating = 0;

  for (let i = 1; i < sentenceLengths.length - 1; i++) {
    const prev = sentenceLengths[i - 1];
    const curr = sentenceLengths[i];
    const next = sentenceLengths[i + 1];

    if (curr > prev && curr > next) {
      oscillating++;
    } else if (curr < prev && curr < next) {
      oscillating++;
    } else if (curr > prev) {
      rising++;
    } else if (curr < prev) {
      falling++;
    }
  }

  const patternRatio = oscillating / sentenceLengths.length;
  
  if (patternRatio > 0.3) return 'oscillating';
  if (rising > falling * 1.5) return 'rising';
  if (falling > rising * 1.5) return 'falling';
  return 'stable';
}

/**
 * Detects clichés
 */
function detectCliches(content: string): string[] {
  const cliches = [
    'in the blink of an eye',
    'time stood still',
    'heart skipped a beat',
    'all hell broke loose',
    'broke the silence',
    'dead as a doornail',
    'easier said than done',
    'fit as a fiddle',
    'last but not least',
    'once in a blue moon',
    'piece of cake',
    'raining cats and dogs',
    'under the weather',
    'burn the midnight oil',
    'hit the nail on the head',
    'at the end of the day',
    'think outside the box',
    'blessing in disguise',
    'calm before the storm',
    'devil\'s advocate',
    'method to the madness',
    'better late than never',
    'actions speak louder than words',
    'all\'s well that ends well',
    'beauty is in the eye of the beholder',
    // Xianxia/Xuanhuan specific clichés
    'heaven defying talent',
    'peerless genius',
    'shocking discovery',
    'unprecedented breakthrough',
    'realm of cultivation',
    'trash to treasure',
    'young master',
    'arrogant junior',
    'face slapping',
  ];

  const contentLower = content.toLowerCase();
  const detectedCliches: string[] = [];

  cliches.forEach(cliche => {
    if (contentLower.includes(cliche.toLowerCase())) {
      detectedCliches.push(cliche);
    }
  });

  return detectedCliches;
}

/**
 * Detects tropes (common patterns)
 */
function detectTropes(content: string): string[] {
  const tropes = [
    'chosen one',
    'hero\'s journey',
    'mentor death',
    'power of friendship',
    'training montage',
    'false defeat',
    'hidden power',
    'revenge story',
    'coming of age',
    'fish out of water',
    // Xianxia/Xuanhuan tropes
    'reincarnation',
    'system',
    'cheat ability',
    'hidden master',
    'overpowered mc',
    'cultivation breakthrough',
    'face saving',
    'treasure hunting',
    'auction scene',
    'tournament arc',
  ];

  const contentLower = content.toLowerCase();
  const detectedTropes: string[] = [];

  tropes.forEach(trope => {
    if (contentLower.includes(trope.toLowerCase())) {
      detectedTropes.push(trope);
    }
  });

  return detectedTropes;
}

/**
 * Detects unique elements (original phrases, descriptions)
 */
function detectUniqueElements(content: string, state: NovelState): string[] {
  const uniqueElements: string[] = [];
  
  // Look for unusual word combinations
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 50);
  
  sentences.forEach(sentence => {
    const words = sentence.split(/\s+/).filter(w => w.length > 0);
    
    // Look for unusual adjective-noun combinations
    for (let i = 0; i < words.length - 1; i++) {
      const word1 = words[i].toLowerCase();
      const word2 = words[i + 1].toLowerCase();
      
      // Check if it's an interesting combination
      if (isUnusualCombination(word1, word2)) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        if (!uniqueElements.includes(phrase)) {
          uniqueElements.push(phrase);
        }
      }
    }
  });

  // Limit to top 10
  return uniqueElements.slice(0, 10);
}

/**
 * Checks if two words form an unusual combination
 */
function isUnusualCombination(word1: string, word2: string): boolean {
  // Remove punctuation
  word1 = word1.replace(/[^\w]/g, '');
  word2 = word2.replace(/[^\w]/g, '');

  // Common combinations to skip
  const commonPairs = new Set([
    'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been',
    'he', 'she', 'it', 'they', 'we', 'you', 'i',
    'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by'
  ]);

  if (commonPairs.has(word1) || commonPairs.has(word2)) {
    return false;
  }

  // Look for interesting adjective-noun or noun-noun patterns
  // This is a simplified check - could be enhanced with part-of-speech tagging
  const interestingPatterns = [
    /^[a-z]+(ed|ing)$/i, // Adjectives ending in -ed or -ing
    /^[a-z]+(ly)$/i, // Adverbs
    /^[A-Z][a-z]+$/ // Proper nouns or capitalized words
  ];

  return interestingPatterns.some(pattern => pattern.test(word1)) && word2.length > 3;
}

/**
 * Analyzes structure variety
 */
function analyzeStructureVariety(sentences: string[]): number {
  let variety = 0;

  sentences.forEach((sentence, index) => {
    if (index === 0) return;

    const prev = sentences[index - 1];
    
    // Check if sentence structure differs
    const prevStarts = prev.trim().substring(0, 3).toLowerCase();
    const currStarts = sentence.trim().substring(0, 3).toLowerCase();

    if (prevStarts !== currStarts) {
      variety++;
    }
  });

  return sentences.length > 0 ? (variety / sentences.length) * 100 : 0;
}

/**
 * Calculates overall prose score
 */
function calculateOverallProseScore(proseQualities: ProseQuality[]): number {
  if (proseQualities.length === 0) return 0;

  const avgSentenceVariety = calculateAverageScore(proseQualities.map(p => p.sentenceVarietyScore));
  const avgVocabulary = calculateAverageScore(proseQualities.map(p => p.vocabularySophistication));
  const avgShowTell = calculateShowTellBalanceScore(proseQualities);
  const avgRhythm = calculateAverageScore(proseQualities.map(p => p.rhythmScore));

  // Weighted average
  const overallScore = (
    avgSentenceVariety * 0.25 +
    avgVocabulary * 0.25 +
    avgShowTell * 0.25 +
    avgRhythm * 0.25
  );

  return Math.round(overallScore);
}

/**
 * Calculates show-tell balance score (0-100)
 */
function calculateShowTellBalanceScore(proseQualities: ProseQuality[]): number {
  if (proseQualities.length === 0) return 50;

  // Ideal show-tell balance is around 70% show, 30% tell
  const idealShowPercentage = 70;
  const avgShowPercentage = calculateAverageScore(proseQualities.map(p => p.showTellBalance));

  // Score based on distance from ideal
  const distance = Math.abs(avgShowPercentage - idealShowPercentage);
  const score = Math.max(0, 100 - distance * 2);

  return Math.round(score);
}

/**
 * Calculates average score
 */
function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  return Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
}

/**
 * Calculates variance
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
  const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
  return squaredDiffs.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Generates prose recommendations
 */
function generateProseRecommendations(
  proseQualities: ProseQuality[],
  overallScore: number,
  cliches: string[],
  tropes: string[],
  uniqueElements: string[]
): string[] {
  const recommendations: string[] = [];

  if (overallScore < 60) {
    recommendations.push(`Overall prose quality score is ${overallScore}/100. Focus on sentence variety, vocabulary, and show vs tell balance.`);
  }

  // Check for clichés
  if (cliches.length > 0) {
    recommendations.push(`Clichés detected: ${cliches.slice(0, 5).join(', ')}. Consider replacing with original expressions.`);
  }

  // Check show vs tell balance
  const avgShowTell = calculateAverageScore(proseQualities.map(p => p.showTellBalance));
  if (avgShowTell < 60) {
    recommendations.push(`Show vs tell balance is ${avgShowTell.toFixed(0)}% show (ideal: 70%). Consider showing more through action and sensory details.`);
  } else if (avgShowTell > 85) {
    recommendations.push(`Show vs tell balance is ${avgShowTell.toFixed(0)}% show. Consider using some telling for efficiency.`);
  }

  // Check sentence variety
  const avgVariety = calculateAverageScore(proseQualities.map(p => p.sentenceVarietyScore));
  if (avgVariety < 60) {
    recommendations.push(`Sentence variety score is ${avgVariety}/100. Vary sentence lengths for better rhythm.`);
  }

  // Check vocabulary
  const avgVocab = calculateAverageScore(proseQualities.map(p => p.vocabularySophistication));
  if (avgVocab < 50) {
    recommendations.push(`Vocabulary sophistication is ${avgVocab}/100. Consider using more varied and precise word choices.`);
  }

  // Positive feedback
  if (overallScore >= 75 && cliches.length === 0 && uniqueElements.length >= 3) {
    recommendations.push('Excellent prose quality! Good variety, original language, and strong balance.');
  }

  return recommendations;
}

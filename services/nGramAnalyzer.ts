/**
 * N-Gram Unpredictability Analyzer
 * 
 * Tracks and analyzes n-gram (3-gram, 4-gram) patterns to identify
 * predictable sequences that detectors flag. Encourages novel phrasing.
 */

export interface NGramMetrics {
  trigramScore: number; // 0-100, higher = more unpredictable
  fourgramScore: number; // 0-100, higher = more unpredictable
  overallScore: number; // 0-100, higher = more unpredictable
  commonTrigrams: Array<{ ngram: string; frequency: number }>;
  commonFourgrams: Array<{ ngram: string; frequency: number }>;
  recommendations: string[];
}

/**
 * Common n-grams that appear frequently in AI-generated text
 * These patterns are predictable and should be avoided
 */
const COMMON_AI_TRIGRAMS = new Set([
  'it is important',
  'it is worth',
  'in order to',
  'as well as',
  'one of the',
  'part of the',
  'the fact that',
  'it is clear',
  'it is possible',
  'it is necessary',
  'there is a',
  'there are many',
  'it can be',
  'it should be',
  'it would be',
  'it has been',
  'it will be',
  'this is a',
  'this is the',
  'that is the',
  'that is a',
  'which is the',
  'which is a',
  'what is the',
  'what is a',
  'how to use',
  'how to make',
  'how to get',
  'the way to',
  'the ability to',
  'the need to',
  'the desire to',
  'the opportunity to',
  'the chance to',
  'in the world',
  'in the way',
  'in the end',
  'in the process',
  'in the context',
  'on the other',
  'on the one',
  'on the way',
  'at the same',
  'at the end',
  'at the beginning',
  'for the first',
  'for the most',
  'for the purpose',
  'with the help',
  'with the use',
  'with the support',
  'by the time',
  'by the way',
  'by the end',
  'of the most',
  'of the best',
  'of the world',
  'to the point',
  'to the extent',
  'to the world',
  'from the beginning',
  'from the start',
  'from the point',
  'as a result',
  'as a whole',
  'as a matter',
  'such as the',
  'such as a',
  'more than a',
  'more than the',
  'less than a',
  'less than the',
  'not only the',
  'not only a',
  'not just the',
  'not just a',
]);

/**
 * Extracts n-grams from text
 */
function extractNGrams(text: string, n: number): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  if (words.length < n) {
    return [];
  }
  
  const ngrams: string[] = [];
  for (let i = 0; i <= words.length - n; i++) {
    const ngram = words.slice(i, i + n).join(' ');
    ngrams.push(ngram);
  }
  
  return ngrams;
}

/**
 * Analyzes n-gram unpredictability
 */
export function analyzeNGramUnpredictability(content: string): NGramMetrics {
  if (!content || content.trim().length === 0) {
    return {
      trigramScore: 50,
      fourgramScore: 50,
      overallScore: 50,
      commonTrigrams: [],
      commonFourgrams: [],
      recommendations: [],
    };
  }

  // Extract n-grams
  const trigrams = extractNGrams(content, 3);
  const fourgrams = extractNGrams(content, 4);

  if (trigrams.length === 0) {
    return {
      trigramScore: 50,
      fourgramScore: 50,
      overallScore: 50,
      commonTrigrams: [],
      commonFourgrams: [],
      recommendations: [],
    };
  }

  // Count frequencies
  const trigramFreq: Record<string, number> = {};
  trigrams.forEach(ngram => {
    trigramFreq[ngram] = (trigramFreq[ngram] || 0) + 1;
  });

  const fourgramFreq: Record<string, number> = {};
  fourgrams.forEach(ngram => {
    fourgramFreq[ngram] = (fourgramFreq[ngram] || 0) + 1;
  });

  // Calculate uniqueness (higher = more unique = better)
  const uniqueTrigrams = Object.keys(trigramFreq).length;
  const uniqueFourgrams = Object.keys(fourgramFreq).length;
  const trigramUniqueness = uniqueTrigrams / Math.max(trigrams.length, 1);
  const fourgramUniqueness = uniqueFourgrams / Math.max(fourgrams.length, 1);

  // Identify common AI patterns
  const commonAITrigrams = Object.entries(trigramFreq)
    .filter(([ngram, freq]) => COMMON_AI_TRIGRAMS.has(ngram) && freq > 1)
    .map(([ngram, freq]) => ({ ngram, frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  const commonAIFourgrams = Object.entries(fourgramFreq)
    .filter(([ngram, freq]) => freq > 1)
    .map(([ngram, freq]) => ({ ngram, frequency: freq }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  // Calculate scores (higher uniqueness = better, but penalize common AI patterns)
  let trigramScore = Math.min(100, trigramUniqueness * 100);
  let fourgramScore = Math.min(100, fourgramUniqueness * 100);

  // Penalize common AI patterns
  const aiPatternPenalty = commonAITrigrams.length * 5;
  trigramScore = Math.max(0, trigramScore - aiPatternPenalty);

  // Penalize highly repetitive n-grams
  const maxTrigramFreq = Math.max(...Object.values(trigramFreq), 0);
  const maxFourgramFreq = Math.max(...Object.values(fourgramFreq), 0);
  
  if (maxTrigramFreq > 3) {
    trigramScore = Math.max(0, trigramScore - (maxTrigramFreq - 3) * 5);
  }
  
  if (maxFourgramFreq > 2) {
    fourgramScore = Math.max(0, fourgramScore - (maxFourgramFreq - 2) * 5);
  }

  const overallScore = Math.round((trigramScore + fourgramScore) / 2);

  // Generate recommendations
  const recommendations: string[] = [];
  
  if (trigramScore < 70) {
    recommendations.push(
      `Low trigram unpredictability (${trigramScore.toFixed(0)}/100). ` +
      `Avoid repeating common 3-word phrases. Vary sentence structure.`
    );
  }
  
  if (fourgramScore < 70) {
    recommendations.push(
      `Low fourgram unpredictability (${fourgramScore.toFixed(0)}/100). ` +
      `Avoid repeating common 4-word phrases. Restructure sentences.`
    );
  }
  
  if (commonAITrigrams.length > 0) {
    recommendations.push(
      `Found ${commonAITrigrams.length} common AI trigram patterns. ` +
      `Replace phrases like "${commonAITrigrams[0].ngram}" with more varied alternatives.`
    );
  }
  
  if (maxTrigramFreq > 3) {
    recommendations.push(
      `Some trigrams repeat ${maxTrigramFreq} times. ` +
      `Restructure sentences to avoid repetition.`
    );
  }

  return {
    trigramScore: Math.round(trigramScore),
    fourgramScore: Math.round(fourgramScore),
    overallScore,
    commonTrigrams: commonAITrigrams,
    commonFourgrams: commonAIFourgrams,
    recommendations,
  };
}

/**
 * Identifies problematic n-grams that should be replaced
 */
export function identifyProblematicNGrams(content: string): Array<{
  ngram: string;
  frequency: number;
  type: 'common-ai' | 'repetitive' | 'both';
  recommendation: string;
}> {
  const problematic: Array<{
    ngram: string;
    frequency: number;
    type: 'common-ai' | 'repetitive' | 'both';
    recommendation: string;
  }> = [];

  const trigrams = extractNGrams(content, 3);
  const trigramFreq: Record<string, number> = {};
  trigrams.forEach(ngram => {
    trigramFreq[ngram] = (trigramFreq[ngram] || 0) + 1;
  });

  Object.entries(trigramFreq).forEach(([ngram, freq]) => {
    if (freq > 2) {
      const isCommonAI = COMMON_AI_TRIGRAMS.has(ngram);
      const isRepetitive = freq > 3;
      
      if (isCommonAI || isRepetitive) {
        problematic.push({
          ngram,
          frequency: freq,
          type: isCommonAI && isRepetitive ? 'both' : isCommonAI ? 'common-ai' : 'repetitive',
          recommendation: isCommonAI
            ? `Common AI pattern - replace "${ngram}" with varied alternatives`
            : `Repeats ${freq} times - restructure to avoid repetition`,
        });
      }
    }
  });

  return problematic.sort((a, b) => b.frequency - a.frequency).slice(0, 20);
}

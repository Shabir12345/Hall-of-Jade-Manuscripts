/**
 * Lexical Balance Analyzer
 * 
 * Analyzes the balance between content words and function words.
 * AI tends to overuse content words; humans balance them better.
 */

export interface LexicalBalanceMetrics {
  contentWordRatio: number; // 0-1, ratio of content words to total words
  functionWordRatio: number; // 0-1, ratio of function words to total words
  lexicalDensity: number; // 0-100, content words / total words * 100
  balanceScore: number; // 0-100, higher = better balance (closer to human writing)
  recommendations: string[];
}

// Common function words in English
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
  'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'there', 'then', 'than', 'so', 'if', 'when', 'where', 'why', 'how',
  'what', 'which', 'who', 'whom', 'whose', 'he', 'she', 'him', 'her',
  'his', 'hers', 'we', 'us', 'our', 'ours', 'you', 'your', 'yours',
  'i', 'me', 'my', 'mine', 'my', 'myself', 'yourself', 'himself',
  'herself', 'itself', 'ourselves', 'yourselves', 'themselves',
  'am', 'are', 'is', 'was', 'were', 'been', 'being', 'have', 'has',
  'had', 'having', 'do', 'does', 'did', 'doing', 'done', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'can', 'cannot', 'ought',
  'shall', 'not', 'no', 'yes', 'very', 'too', 'also', 'just', 'only',
  'even', 'still', 'yet', 'already', 'again', 'more', 'most', 'less',
  'least', 'much', 'many', 'some', 'any', 'all', 'both', 'each', 'every',
  'other', 'another', 'such', 'same', 'own', 'few', 'little', 'several',
  'enough', 'quite', 'rather', 'pretty', 'really', 'actually', 'indeed',
  'certainly', 'probably', 'perhaps', 'maybe', 'possibly', 'definitely',
  'absolutely', 'completely', 'totally', 'entirely', 'fully', 'partly',
  'partially', 'mostly', 'mainly', 'usually', 'often', 'sometimes',
  'always', 'never', 'ever', 'once', 'twice', 'here', 'there', 'where',
  'everywhere', 'anywhere', 'nowhere', 'somewhere', 'now', 'then', 'when',
  'while', 'during', 'before', 'after', 'since', 'until', 'till', 'ago',
  'later', 'soon', 'early', 'late', 'today', 'yesterday', 'tomorrow',
  'now', 'then', 'soon', 'recently', 'recently', 'already', 'still',
  'yet', 'again', 'once', 'twice', 'always', 'never', 'often', 'seldom',
  'rarely', 'usually', 'normally', 'generally', 'typically', 'commonly',
  'frequently', 'occasionally', 'sometimes', 'always', 'never', 'ever',
]);

/**
 * Analyzes lexical balance in text
 * Returns metrics about content vs function word ratio
 */
export function analyzeLexicalBalance(content: string): LexicalBalanceMetrics {
  if (!content || content.trim().length === 0) {
    return {
      contentWordRatio: 0.5,
      functionWordRatio: 0.5,
      lexicalDensity: 50,
      balanceScore: 50,
      recommendations: [],
    };
  }

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      contentWordRatio: 0.5,
      functionWordRatio: 0.5,
      lexicalDensity: 50,
      balanceScore: 50,
      recommendations: [],
    };
  }

  let functionWordCount = 0;
  let contentWordCount = 0;

  words.forEach(word => {
    const normalized = word.replace(/[^\w]/g, '');
    if (FUNCTION_WORDS.has(normalized)) {
      functionWordCount++;
    } else {
      contentWordCount++;
    }
  });

  const totalWords = words.length;
  const functionWordRatio = functionWordCount / totalWords;
  const contentWordRatio = contentWordCount / totalWords;
  const lexicalDensity = (contentWordCount / totalWords) * 100;

  // Human writing typically has:
  // - Lexical density: 40-60% (content words)
  // - Function words: 40-60%
  // AI writing tends to have higher lexical density (50-70%)
  // Optimal balance: 45-55% lexical density

  let balanceScore = 100;
  const recommendations: string[] = [];

  if (lexicalDensity > 65) {
    // Too many content words - AI-like
    const penalty = (lexicalDensity - 65) * 2;
    balanceScore = Math.max(0, balanceScore - penalty);
    recommendations.push(
      `Lexical density too high (${lexicalDensity.toFixed(1)}%). ` +
      `Add more function words (the, a, and, but, etc.) to balance. ` +
      `Target: 45-55% lexical density.`
    );
  } else if (lexicalDensity < 40) {
    // Too many function words - may be too simple
    const penalty = (40 - lexicalDensity) * 1.5;
    balanceScore = Math.max(0, balanceScore - penalty);
    recommendations.push(
      `Lexical density too low (${lexicalDensity.toFixed(1)}%). ` +
      `Text may be too simple. Consider adding more descriptive content words.`
    );
  }

  // Check for overuse of high-frequency content words
  const contentWords = words.filter(w => !FUNCTION_WORDS.has(w.replace(/[^\w]/g, '')));
  const contentWordFreq: Record<string, number> = {};
  contentWords.forEach(word => {
    const normalized = word.replace(/[^\w]/g, '');
    if (normalized.length > 0) {
      contentWordFreq[normalized] = (contentWordFreq[normalized] || 0) + 1;
    }
  });

  const topContentWords = Object.entries(contentWordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topWordsTotalFreq = topContentWords.reduce((sum, [_, freq]) => sum + freq, 0);
  const topWordsRatio = topWordsTotalFreq / contentWords.length;

  if (topWordsRatio > 0.3) {
    // Overuse of common content words
    balanceScore = Math.max(0, balanceScore - 10);
    recommendations.push(
      `Overuse of common content words (${(topWordsRatio * 100).toFixed(1)}% from top 10 words). ` +
      `Vary vocabulary more - use synonyms and less common words.`
    );
  }

  return {
    contentWordRatio,
    functionWordRatio,
    lexicalDensity: Math.round(lexicalDensity * 10) / 10,
    balanceScore: Math.round(balanceScore),
    recommendations,
  };
}

/**
 * Identifies sections that need more function words
 */
export function identifyFunctionWordGaps(content: string): Array<{
  index: number;
  text: string;
  recommendation: string;
}> {
  const gaps: Array<{ index: number; text: string; recommendation: string }> = [];
  
  // Split into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  sentences.forEach((sentence, index) => {
    const words = sentence
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
    
    let functionWordCount = 0;
    words.forEach(word => {
      if (FUNCTION_WORDS.has(word.replace(/[^\w]/g, ''))) {
        functionWordCount++;
      }
    });
    
    const functionWordRatio = words.length > 0 ? functionWordCount / words.length : 0;
    
    // If function word ratio is very low (<20%), flag it
    if (functionWordRatio < 0.2 && words.length > 5) {
      gaps.push({
        index,
        text: sentence.substring(0, 100),
        recommendation: `Add function words (the, a, and, but, etc.) to balance lexical density. Current ratio: ${(functionWordRatio * 100).toFixed(1)}%`,
      });
    }
  });
  
  return gaps;
}

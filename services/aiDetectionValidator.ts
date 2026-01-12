/**
 * AI Detection Validator
 * 
 * Provides utilities to validate and identify AI-like patterns in generated text.
 * This helps ensure that generated content passes AI detection tools.
 */

export interface AIDetectionMetrics {
  /** Average sentence length - human writing varies more */
  averageSentenceLength: number;
  /** Sentence length standard deviation - higher is more human-like (burstiness) */
  sentenceLengthStdDev: number;
  /** Percentage of unique words - higher is more human-like (perplexity indicator) */
  uniqueWordRatio: number;
  /** Average words per sentence variation - human writing has more variation */
  sentenceVariationScore: number;
  /** Pattern score - detects repetitive patterns (lower is better) */
  repetitivePatternScore: number;
  /** Overall AI likelihood score (0-1, lower is more human-like) */
  aiLikelihoodScore: number;
}

/**
 * Analyzes text for AI-like patterns and returns metrics
 */
export function analyzeTextForAIDetection(text: string): AIDetectionMetrics {
  if (!text || text.trim().length === 0) {
    return {
      averageSentenceLength: 0,
      sentenceLengthStdDev: 0,
      uniqueWordRatio: 0,
      sentenceVariationScore: 0,
      repetitivePatternScore: 0,
      aiLikelihoodScore: 1.0, // Empty text is suspicious
    };
  }

  // Split into sentences (simple approach - can be improved)
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  if (sentences.length === 0) {
    return {
      averageSentenceLength: 0,
      sentenceLengthStdDev: 0,
      uniqueWordRatio: 0,
      sentenceVariationScore: 0,
      repetitivePatternScore: 0,
      aiLikelihoodScore: 1.0,
    };
  }

  // Calculate sentence lengths
  const sentenceLengths = sentences.map(s => {
    const words = s.split(/\s+/).filter(w => w.length > 0);
    return words.length;
  });

  const averageSentenceLength = 
    sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

  // Calculate standard deviation (burstiness indicator)
  const variance = sentenceLengths.reduce((sum, len) => {
    return sum + Math.pow(len - averageSentenceLength, 2);
  }, 0) / sentenceLengths.length;
  const sentenceLengthStdDev = Math.sqrt(variance);

  // Calculate unique word ratio (perplexity indicator)
  const allWords = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  const uniqueWords = new Set(allWords);
  const uniqueWordRatio = uniqueWords.size / Math.max(allWords.length, 1);

  // Calculate sentence variation score (higher = more variation = more human-like)
  const lengthVariations = [];
  for (let i = 1; i < sentenceLengths.length; i++) {
    lengthVariations.push(Math.abs(sentenceLengths[i] - sentenceLengths[i - 1]));
  }
  const sentenceVariationScore = lengthVariations.length > 0
    ? lengthVariations.reduce((a, b) => a + b, 0) / lengthVariations.length
    : 0;

  // Detect repetitive patterns (e.g., "He... He... He..." or similar structures)
  let repetitivePatternScore = 0;
  const sentenceStarts = sentences.map(s => {
    const firstWord = s.split(/\s+/)[0]?.toLowerCase() || '';
    return firstWord;
  });
  
  // Check for repetitive sentence starts
  const startCounts = new Map<string, number>();
  sentenceStarts.forEach(start => {
    startCounts.set(start, (startCounts.get(start) || 0) + 1);
  });
  
  const maxStartRepetition = Math.max(...Array.from(startCounts.values()));
  repetitivePatternScore = maxStartRepetition / sentences.length;

  // Calculate overall AI likelihood (0-1, lower is better)
  // Human-like text should have:
  // - Higher sentence length variation (stdDev)
  // - Higher unique word ratio
  // - Higher sentence variation
  // - Lower repetitive patterns
  
  const normalizedStdDev = Math.min(sentenceLengthStdDev / 20, 1); // Normalize (20+ stdDev is very human-like)
  const stdDevScore = 1 - normalizedStdDev; // Invert (higher stdDev = lower AI score)
  
  const uniqueWordScore = 1 - uniqueWordRatio; // Invert (higher unique = lower AI score)
  
  const variationScore = Math.max(0, 1 - (sentenceVariationScore / 15)); // Normalize (15+ is very human-like)
  
  const patternScore = repetitivePatternScore; // Already 0-1
  
  // Weighted average
  const aiLikelihoodScore = (
    stdDevScore * 0.3 +      // Sentence length variation (burstiness) - 30%
    uniqueWordScore * 0.3 +   // Vocabulary diversity (perplexity) - 30%
    variationScore * 0.2 +    // Sentence-to-sentence variation - 20%
    patternScore * 0.2        // Repetitive patterns - 20%
  );

  return {
    averageSentenceLength,
    sentenceLengthStdDev,
    uniqueWordRatio,
    sentenceVariationScore,
    repetitivePatternScore,
    aiLikelihoodScore: Math.min(Math.max(aiLikelihoodScore, 0), 1),
  };
}

/**
 * Returns feedback on how to improve text to reduce AI detection
 */
export function getAIDetectionFeedback(metrics: AIDetectionMetrics): string[] {
  const feedback: string[] = [];

  if (metrics.sentenceLengthStdDev < 5) {
    feedback.push('Sentence length variation is low - try mixing very short sentences (3-5 words) with longer ones (25-30+ words)');
  }

  if (metrics.uniqueWordRatio < 0.3) {
    feedback.push('Vocabulary repetition is high - use more synonyms and vary word choices');
  }

  if (metrics.sentenceVariationScore < 5) {
    feedback.push('Sentence-to-sentence variation is low - alternate between different sentence structures and lengths');
  }

  if (metrics.repetitivePatternScore > 0.3) {
    feedback.push('Repetitive sentence patterns detected - vary sentence beginnings and structures');
  }

  if (metrics.aiLikelihoodScore > 0.7) {
    feedback.push('Text shows strong AI-like patterns - apply more human-like writing techniques (vary sentence length, vocabulary, structure)');
  } else if (metrics.aiLikelihoodScore < 0.3) {
    feedback.push('Text appears human-like! Good variation in sentence structure and vocabulary.');
  }

  return feedback;
}

/**
 * Quick check - returns true if text likely passes AI detection
 */
export function likelyPassesAIDetection(text: string, threshold: number = 0.5): boolean {
  const metrics = analyzeTextForAIDetection(text);
  return metrics.aiLikelihoodScore < threshold;
}

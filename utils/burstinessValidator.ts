/**
 * Burstiness Validator
 * 
 * Validates and enforces sentence length variation patterns to ensure
 * human-like "burstiness" in generated text. Detects sequences of
 * similar-length sentences that indicate AI-generated patterns.
 */

/**
 * Result of burstiness validation
 */
export interface BurstinessValidationResult {
  isValid: boolean;
  violations: BurstinessViolation[];
  overallScore: number; // 0-100, higher = more variation
  recommendations: string[];
}

/**
 * A violation indicating a sequence of similar-length sentences
 */
export interface BurstinessViolation {
  paragraphIndex: number;
  sentenceIndices: number[]; // Indices of violating sentences within paragraph
  sentenceLengths: number[]; // Word counts for each sentence
  averageLength: number;
  variance: number; // Low variance = similar lengths = violation
  text: string; // The violating text
}

/**
 * Configuration for burstiness validation
 */
export interface BurstinessConfig {
  maxSimilarSequences: number; // Max allowed consecutive similar-length sentences
  similarityThreshold: number; // 0.0-1.0, percentage variance allowed (e.g., 0.2 = 20%)
  minSentencesForViolation: number; // Minimum sentences needed to flag violation
}

const DEFAULT_CONFIG: BurstinessConfig = {
  maxSimilarSequences: 2, // Stricter: reduced from 3 to 2
  similarityThreshold: 0.15, // Stricter: reduced from 0.2 to 0.15 (15% variance)
  minSentencesForViolation: 3,
};

/**
 * Validates burstiness pattern in text
 * Returns violations where 3+ consecutive sentences have similar lengths
 */
export function validateBurstinessPattern(
  text: string,
  config: Partial<BurstinessConfig> = {}
): BurstinessValidationResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const violations: BurstinessViolation[] = [];
  
  if (!text || text.trim().length === 0) {
    return {
      isValid: true,
      violations: [],
      overallScore: 50,
      recommendations: [],
    };
  }
  
  // Split into paragraphs
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  paragraphs.forEach((paragraph, paragraphIndex) => {
    // Split paragraph into sentences
    const sentences = paragraph
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    if (sentences.length < finalConfig.minSentencesForViolation) {
      return; // Skip paragraphs with too few sentences
    }
    
    // Calculate sentence lengths (word counts)
    const sentenceLengths = sentences.map(s => {
      const words = s.split(/\s+/).filter(w => w.length > 0);
      return words.length;
    });
    
    // Check for sequences of similar-length sentences
    let sequenceStart = 0;
    let currentSequence: number[] = [];
    
    for (let i = 0; i < sentenceLengths.length; i++) {
      const currentLength = sentenceLengths[i];
      
      if (currentSequence.length === 0) {
        // Start new sequence
        currentSequence = [i];
        sequenceStart = i;
      } else {
        // Check if current sentence is similar to sequence
        const sequenceLengths = currentSequence.map(idx => sentenceLengths[idx]);
        const avgLength = sequenceLengths.reduce((a, b) => a + b, 0) / sequenceLengths.length;
        const avgWithCurrent = (avgLength * sequenceLengths.length + currentLength) / (sequenceLengths.length + 1);
        
        // Calculate variance threshold
        const threshold = avgWithCurrent * finalConfig.similarityThreshold;
        const isSimilar = Math.abs(currentLength - avgWithCurrent) <= threshold;
        
        if (isSimilar) {
          // Add to sequence
          currentSequence.push(i);
        } else {
          // Sequence broken, check if violation
          if (currentSequence.length >= finalConfig.minSentencesForViolation) {
            const seqLengths = currentSequence.map(idx => sentenceLengths[idx]);
            const seqAvg = seqLengths.reduce((a, b) => a + b, 0) / seqLengths.length;
            const seqVariance = calculateVariance(seqLengths);
            
            violations.push({
              paragraphIndex,
              sentenceIndices: currentSequence,
              sentenceLengths: seqLengths,
              averageLength: seqAvg,
              variance: seqVariance,
              text: currentSequence.map(idx => sentences[idx]).join(' '),
            });
          }
          // Start new sequence
          currentSequence = [i];
        }
      }
    }
    
    // Check final sequence
    if (currentSequence.length >= finalConfig.minSentencesForViolation) {
      const seqLengths = currentSequence.map(idx => sentenceLengths[idx]);
      const seqAvg = seqLengths.reduce((a, b) => a + b, 0) / seqLengths.length;
      const seqVariance = calculateVariance(seqLengths);
      
      violations.push({
        paragraphIndex,
        sentenceIndices: currentSequence,
        sentenceLengths: seqLengths,
        averageLength: seqAvg,
        variance: seqVariance,
        text: currentSequence.map(idx => sentences[idx]).join(' '),
      });
    }
  });
  
  // Calculate overall burstiness score
  const overallScore = calculateBurstinessScore(text);
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (violations.length > 0) {
    recommendations.push(
      `Found ${violations.length} paragraph(s) with sequences of similar-length sentences. ` +
      `Rewrite these sections to vary sentence lengths dramatically.`
    );
    violations.forEach((violation, idx) => {
      recommendations.push(
        `Paragraph ${violation.paragraphIndex + 1}: ${violation.sentenceIndices.length} sentences ` +
        `with average length ${violation.averageLength.toFixed(1)} words. ` +
        `Vary lengths between 3-5 words (short) and 25-30+ words (long).`
      );
    });
  }
  
  return {
    isValid: violations.length === 0,
    violations,
    overallScore,
    recommendations,
  };
}

/**
 * Calculates variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
  return Math.sqrt(variance); // Standard deviation
}

/**
 * Calculates overall burstiness score (0-100)
 * Higher score = more variation = more human-like
 */
function calculateBurstinessScore(text: string): number {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 3) return 50;
  
  const sentenceLengths = sentences.map(s => s.trim().split(/\s+/).length);
  const mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const stdDev = calculateVariance(sentenceLengths);
  
  // Coefficient of variation
  const cv = mean > 0 ? stdDev / mean : 0;
  
  // Convert to 0-100 score
  // CV of 0.5+ is excellent variation
  let score = Math.min(100, Math.max(0, (cv / 0.5) * 80));
  
  // Bonus for having both very short and very long sentences
  const hasShort = sentenceLengths.some(len => len <= 5);
  const hasLong = sentenceLengths.some(len => len >= 25);
  if (hasShort && hasLong) {
    score = Math.min(100, score + 10);
  }
  
  return Math.round(score);
}

/**
 * Extracts problematic paragraphs for regeneration
 * Returns text with markers indicating which paragraphs need rewriting
 */
export function extractProblematicParagraphs(
  text: string,
  violations: BurstinessViolation[]
): { text: string; problematicParagraphs: Array<{ index: number; text: string }> } {
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const problematicIndices = new Set(violations.map(v => v.paragraphIndex));
  
  const problematicParagraphs = paragraphs
    .map((para, idx) => ({ index: idx, text: para }))
    .filter((_, idx) => problematicIndices.has(idx));
  
  // Mark problematic paragraphs in text
  let markedText = text;
  problematicParagraphs.forEach(({ index, text: paraText }) => {
    const marker = `\n\n[REWRITE_REQUIRED: Burstiness violation - vary sentence lengths]\n\n`;
    markedText = markedText.replace(paraText, marker + paraText + marker);
  });
  
  return {
    text: markedText,
    problematicParagraphs,
  };
}

/**
 * Enforces burstiness pattern by identifying problematic paragraphs
 * Returns text with markers for regeneration
 */
export function enforceBurstinessPattern(
  text: string,
  config: Partial<BurstinessConfig> = {}
): string {
  const validation = validateBurstinessPattern(text, config);
  
  if (validation.isValid) {
    return text; // No violations
  }
  
  const { problematicParagraphs } = extractProblematicParagraphs(text, validation.violations);
  
  // Return text with markers
  return text; // Markers are added in extractProblematicParagraphs, but we'll handle regeneration separately
}

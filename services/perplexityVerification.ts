/**
 * Perplexity Verification Service
 * 
 * Verifies that generated text meets human-like perplexity thresholds.
 * Flags paragraphs that fall below the threshold and provides recommendations
 * for improvement.
 */

import { calculatePerplexity } from './narrativeCraftAnalyzer';

/**
 * Result of perplexity verification
 */
export interface PerplexityVerificationResult {
  isValid: boolean;
  overallPerplexity: number; // 0-100
  threshold: number;
  violations: PerplexityViolation[];
  recommendations: string[];
}

/**
 * A violation indicating a paragraph below the perplexity threshold
 */
export interface PerplexityViolation {
  paragraphIndex: number;
  perplexity: number;
  threshold: number;
  text: string; // The violating paragraph
  wordCount: number;
}

/**
 * Configuration for perplexity verification
 */
export interface PerplexityConfig {
  threshold: number; // Minimum perplexity score (0-100)
  checkParagraphs: boolean; // Check individual paragraphs vs. whole text
  minParagraphWords: number; // Minimum words needed to check a paragraph
}

const DEFAULT_CONFIG: PerplexityConfig = {
  threshold: 70,
  checkParagraphs: true,
  minParagraphWords: 20,
};

/**
 * Verifies perplexity threshold for text
 * Returns violations for paragraphs below threshold
 */
export function verifyPerplexityThreshold(
  text: string,
  threshold: number = 70,
  config: Partial<PerplexityConfig> = {}
): PerplexityVerificationResult {
  const finalConfig = { ...DEFAULT_CONFIG, ...config, threshold };
  const violations: PerplexityViolation[] = [];
  
  if (!text || text.trim().length === 0) {
    return {
      isValid: true,
      overallPerplexity: 50,
      threshold: finalConfig.threshold,
      violations: [],
      recommendations: [],
    };
  }
  
  // Calculate overall perplexity
  const overallPerplexity = calculatePerplexity(text);
  
  // Check individual paragraphs if configured
  if (finalConfig.checkParagraphs) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    paragraphs.forEach((paragraph, index) => {
      const words = paragraph.trim().split(/\s+/).filter(w => w.length > 0);
      
      // Skip paragraphs that are too short
      if (words.length < finalConfig.minParagraphWords) {
        return;
      }
      
      const paragraphPerplexity = calculatePerplexity(paragraph);
      
      if (paragraphPerplexity < finalConfig.threshold) {
        violations.push({
          paragraphIndex: index,
          perplexity: paragraphPerplexity,
          threshold: finalConfig.threshold,
          text: paragraph.substring(0, 200), // First 200 chars for context
          wordCount: words.length,
        });
      }
    });
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (overallPerplexity < finalConfig.threshold) {
    recommendations.push(
      `Overall perplexity score (${overallPerplexity}) is below threshold (${finalConfig.threshold}). ` +
      `Text may be too predictable. Increase vocabulary diversity and use less common words.`
    );
  }
  
  if (violations.length > 0) {
    recommendations.push(
      `Found ${violations.length} paragraph(s) below perplexity threshold. ` +
      `These paragraphs use predictable vocabulary and should be rewritten with more diverse word choices.`
    );
    
    violations.forEach((violation, idx) => {
      recommendations.push(
        `Paragraph ${violation.paragraphIndex + 1}: Perplexity ${violation.perplexity} ` +
        `(threshold: ${violation.threshold}). Replace common words with less predictable synonyms.`
      );
    });
  }
  
  if (violations.length === 0 && overallPerplexity >= finalConfig.threshold) {
    recommendations.push('Perplexity verification passed. Text shows good vocabulary diversity.');
  }
  
  return {
    isValid: violations.length === 0 && overallPerplexity >= finalConfig.threshold,
    overallPerplexity,
    threshold: finalConfig.threshold,
    violations,
    recommendations,
  };
}

/**
 * Generates a prompt for AI to improve perplexity
 * Used when violations are detected
 */
export function generatePerplexityImprovementPrompt(
  text: string,
  violations: PerplexityViolation[]
): string {
  if (violations.length === 0) {
    return '';
  }
  
  const problematicParagraphs = violations
    .map(v => `Paragraph ${v.paragraphIndex + 1} (perplexity: ${v.perplexity}):\n${v.text.substring(0, 300)}`)
    .join('\n\n');
  
  return `PERPLEXITY IMPROVEMENT REQUIRED:
The following paragraphs have low perplexity scores (predictable vocabulary) and need improvement.

Target perplexity: 70+ (higher = more unpredictable = more human-like)

Instructions:
1. Replace common, predictable words with less common but contextually appropriate synonyms
2. Increase vocabulary diversity without changing meaning
3. Use slightly less common words where they fit naturally
4. Avoid repeating the same words multiple times in close proximity
5. Maintain readability and tone

Problematic paragraphs:
${problematicParagraphs}

Return the rewritten paragraphs with improved perplexity scores.`;
}

/**
 * Calculates perplexity improvement after rewriting
 */
export function calculatePerplexityImprovement(
  originalText: string,
  rewrittenText: string
): { original: number; rewritten: number; improvement: number } {
  const original = calculatePerplexity(originalText);
  const rewritten = calculatePerplexity(rewrittenText);
  const improvement = rewritten - original;
  
  return {
    original,
    rewritten,
    improvement,
  };
}

/**
 * Gets a summary of perplexity status for logging
 */
export function getPerplexitySummary(result: PerplexityVerificationResult): string {
  const status = result.isValid ? 'PASSED' : 'FAILED';
  const violationCount = result.violations.length;
  
  return `Perplexity Verification: ${status} | Overall: ${result.overallPerplexity}/100 ` +
    `(threshold: ${result.threshold}) | Violations: ${violationCount}`;
}

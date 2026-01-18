/**
 * AI Detection Score Tracker
 * 
 * Tracks and calculates AI detection scores for chapters based on various metrics.
 * Provides feedback on which techniques are most effective.
 */

import { Chapter, ChapterQualityMetrics } from '../types';
import { AI_DETECTION_CONFIG } from '../constants';
import { validateBurstinessPattern } from '../utils/burstinessValidator';
import { verifyPerplexityThreshold } from './perplexityVerification';
import { checkForForbiddenWords, checkForForbiddenStructures } from '../utils/aiDetectionBlacklist';
import { calculateBurstiness, calculatePerplexity } from './narrativeCraftAnalyzer';

export interface AIDetectionScore {
  overallScore: number; // 0-100, lower is better (more human-like)
  burstinessScore: number; // 0-100, higher is better
  perplexityScore: number; // 0-100, higher is better
  blacklistViolations: number;
  sentenceFragmentCount: number;
  dialogueInterruptionCount: number;
  sentenceVariationScore: number;
  vocabularyDiversityScore: number;
  timestamp: number;
  recommendations: string[];
}

/**
 * Calculates comprehensive AI detection score for a chapter
 * Lower overall score = more human-like
 */
export function calculateAIDetectionScore(
  chapter: Chapter,
  metrics?: ChapterQualityMetrics
): AIDetectionScore {
  const content = chapter.content || '';
  
  // Calculate burstiness
  const burstinessResult = AI_DETECTION_CONFIG.burstiness.enabled
    ? validateBurstinessPattern(content, {
        maxSimilarSequences: AI_DETECTION_CONFIG.burstiness.maxSimilarSequences,
        similarityThreshold: AI_DETECTION_CONFIG.burstiness.similarityThreshold,
      })
    : { isValid: true, violations: [], overallScore: 100, recommendations: [] };
  
  const burstinessScore = burstinessResult.overallScore || calculateBurstiness(content);
  
  // Calculate perplexity
  const perplexityResult = AI_DETECTION_CONFIG.perplexity.enabled
    ? verifyPerplexityThreshold(
        content,
        AI_DETECTION_CONFIG.perplexity.threshold,
        { checkParagraphs: AI_DETECTION_CONFIG.perplexity.checkParagraphs }
      )
    : { isValid: true, overallPerplexity: 100, threshold: 85, violations: [], recommendations: [] };
  
  const perplexityScore = perplexityResult.overallPerplexity || calculatePerplexity(content);
  
  // Check blacklist violations
  const blacklistViolations = AI_DETECTION_CONFIG.blacklist.enforcePostProcess
    ? [
        ...checkForForbiddenWords(content),
        ...checkForForbiddenStructures(content),
      ].length
    : 0;
  
  // Count sentence fragments (sentences with 3-5 words)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceFragmentCount = sentences.filter(s => {
    const words = s.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length >= 3 && words.length <= 5;
  }).length;
  
  // Count dialogue interruptions (simplified: look for dashes or ellipses in dialogue)
  const dialogueInterruptionCount = (content.match(/["'][^"']*[—–-]|["'][^"']*\.\.\./g) || []).length;
  
  // Calculate sentence variation (standard deviation of sentence lengths)
  const sentenceLengths = sentences.map(s => {
    const words = s.trim().split(/\s+/).filter(w => w.length > 0);
    return words.length;
  });
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / sentenceLengths.length;
  const stdDev = Math.sqrt(variance);
  const sentenceVariationScore = Math.min(100, (stdDev / avgLength) * 100); // Coefficient of variation
  
  // Calculate vocabulary diversity (unique words / total words)
  const words = content.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const uniqueWords = new Set(words.map(w => w.replace(/[^\w]/g, ''))).size;
  const vocabularyDiversityScore = (uniqueWords / words.length) * 100;
  
  // Calculate overall AI detection score (lower is better)
  // Weighted average where higher scores in burstiness/perplexity reduce AI detection
  // and violations increase it
  const baseScore = 100 - ((burstinessScore + perplexityScore) / 2);
  const violationPenalty = Math.min(50, blacklistViolations * 2); // Max 50 point penalty
  const fragmentBonus = Math.max(0, (sentenceFragmentCount - 5) * -1); // Bonus for having fragments
  const interruptionBonus = Math.max(0, (dialogueInterruptionCount - 2) * -0.5); // Bonus for interruptions
  
  const overallScore = Math.max(0, Math.min(100, baseScore + violationPenalty + fragmentBonus + interruptionBonus));
  
  // Generate recommendations
  const recommendations: string[] = [];
  if (burstinessScore < 75) {
    recommendations.push(`Increase sentence length variation (current: ${burstinessScore.toFixed(0)}/100). Mix very short (3-5 words) with long (25-30+ words) sentences.`);
  }
  if (perplexityScore < 80) {
    recommendations.push(`Improve vocabulary diversity (current: ${perplexityScore.toFixed(0)}/100). Use synonyms, avoid repetition, include less common words naturally.`);
  }
  if (blacklistViolations > 5) {
    recommendations.push(`Reduce blacklist violations (current: ${blacklistViolations}). Replace forbidden words/phrases with alternatives.`);
  }
  if (sentenceFragmentCount < 5) {
    const wordCount = words.length;
    const targetFragments = Math.ceil((wordCount / 1500) * 5);
    recommendations.push(`Add more sentence fragments (current: ${sentenceFragmentCount}, target: ${targetFragments}). Include 5-8 fragments per 1500 words.`);
  }
  if (dialogueInterruptionCount < 2) {
    recommendations.push(`Add dialogue interruptions (current: ${dialogueInterruptionCount}). 10-15% of dialogue should have interruptions or incomplete thoughts.`);
  }
  
  return {
    overallScore: Math.round(overallScore),
    burstinessScore: Math.round(burstinessScore),
    perplexityScore: Math.round(perplexityScore),
    blacklistViolations,
    sentenceFragmentCount,
    dialogueInterruptionCount,
    sentenceVariationScore: Math.round(sentenceVariationScore),
    vocabularyDiversityScore: Math.round(vocabularyDiversityScore),
    timestamp: Date.now(),
    recommendations,
  };
}

/**
 * Compares two AI detection scores and returns improvement metrics
 */
export function compareAIDetectionScores(
  oldScore: AIDetectionScore,
  newScore: AIDetectionScore
): {
  improved: boolean;
  improvementPercentage: number;
  improvements: string[];
  regressions: string[];
} {
  const improved = newScore.overallScore < oldScore.overallScore; // Lower is better
  const improvementPercentage = ((oldScore.overallScore - newScore.overallScore) / oldScore.overallScore) * 100;
  
  const improvements: string[] = [];
  const regressions: string[] = [];
  
  if (newScore.burstinessScore > oldScore.burstinessScore) {
    improvements.push(`Burstiness improved: ${oldScore.burstinessScore} → ${newScore.burstinessScore}`);
  } else if (newScore.burstinessScore < oldScore.burstinessScore) {
    regressions.push(`Burstiness decreased: ${oldScore.burstinessScore} → ${newScore.burstinessScore}`);
  }
  
  if (newScore.perplexityScore > oldScore.perplexityScore) {
    improvements.push(`Perplexity improved: ${oldScore.perplexityScore} → ${newScore.perplexityScore}`);
  } else if (newScore.perplexityScore < oldScore.perplexityScore) {
    regressions.push(`Perplexity decreased: ${oldScore.perplexityScore} → ${newScore.perplexityScore}`);
  }
  
  if (newScore.blacklistViolations < oldScore.blacklistViolations) {
    improvements.push(`Blacklist violations reduced: ${oldScore.blacklistViolations} → ${newScore.blacklistViolations}`);
  } else if (newScore.blacklistViolations > oldScore.blacklistViolations) {
    regressions.push(`Blacklist violations increased: ${oldScore.blacklistViolations} → ${newScore.blacklistViolations}`);
  }
  
  if (newScore.sentenceFragmentCount > oldScore.sentenceFragmentCount) {
    improvements.push(`Sentence fragments increased: ${oldScore.sentenceFragmentCount} → ${newScore.sentenceFragmentCount}`);
  }
  
  if (newScore.dialogueInterruptionCount > oldScore.dialogueInterruptionCount) {
    improvements.push(`Dialogue interruptions increased: ${oldScore.dialogueInterruptionCount} → ${newScore.dialogueInterruptionCount}`);
  }
  
  return {
    improved,
    improvementPercentage: Math.round(improvementPercentage * 10) / 10,
    improvements,
    regressions,
  };
}

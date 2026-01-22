/**
 * Post-Generation Quality Service
 * Validates chapter quality after generation and applies fixes
 */

import { detectRepetitions } from './repetitionDetector';
import { Chapter } from '../types';

export interface QualityIssue {
  type: 'repetition' | 'overexplanation' | 'sentence_variation' | 'tone_inconsistency';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestions: string[];
}

export interface QualityReport {
  issues: QualityIssue[];
  overallScore: number;
  needsRegeneration: boolean;
}

export function validateChapterQuality(chapter: Chapter): QualityReport {
  const issues: QualityIssue[] = [];
  
  if (!chapter.content) {
    return {
      issues: [{ type: 'repetition', severity: 'high', description: 'No content', suggestions: ['Generate content'] }],
      overallScore: 0,
      needsRegeneration: true
    };
  }
  
  const repetitionReport = detectRepetitions(chapter.content);
  
  // Check for repeated phrases
  if (repetitionReport.repeatedPhrases.length > 0) {
    issues.push({
      type: 'repetition',
      severity: repetitionReport.repeatedPhrases.length > 3 ? 'high' : 'medium',
      description: `Repeated phrases detected: ${repetitionReport.repeatedPhrases.join(', ')}`,
      suggestions: [
        'Use synonyms and varied vocabulary',
        'Rephrase concepts to avoid repetition',
        'Track key phrases and find alternatives'
      ]
    });
  }
  
  // Check for overexplanation
  if (repetitionReport.overexplanationCount > 25) {
    issues.push({
      type: 'overexplanation',
      severity: repetitionReport.overexplanationCount > 40 ? 'high' : 'medium',
      description: `Too many explanatory phrases (${repetitionReport.overexplanationCount} instances)`,
      suggestions: [
        'Show, don\'t tell - use action and dialogue instead',
        'Remove excessive "because/since/as" explanations',
        'Let readers infer meaning from context'
      ]
    });
  }
  
  // Check for sentence variation
  if (repetitionReport.paragraphsWithSimilarSentences > 5) {
    issues.push({
      type: 'sentence_variation',
      severity: repetitionReport.paragraphsWithSimilarSentences > 10 ? 'high' : 'medium',
      description: `${repetitionReport.paragraphsWithSimilarSentences} paragraphs have similar-length sentences`,
      suggestions: [
        'Mix short (3-5 words), medium (10-15 words), and long (25-30+ words) sentences',
        'Vary sentence beginnings - avoid starting multiple sentences the same way',
        'Create natural rhythm with varied sentence lengths'
      ]
    });
  }
  
  // Check for tone inconsistency
  if (repetitionReport.toneInconsistency) {
    issues.push({
      type: 'tone_inconsistency',
      severity: 'medium',
      description: repetitionReport.toneInconsistency,
      suggestions: [
        'Maintain consistent tone throughout the chapter',
        'If casual tone is intended, use natural dialogue and flowing descriptions',
        'Avoid mixing formal language with casual tone'
      ]
    });
  }
  
  // Calculate overall score
  const highSeverityCount = issues.filter(i => i.severity === 'high').length;
  const mediumSeverityCount = issues.filter(i => i.severity === 'medium').length;
  const overallScore = Math.max(0, 100 - (highSeverityCount * 25) - (mediumSeverityCount * 10));
  
  return {
    issues,
    overallScore,
    needsRegeneration: highSeverityCount > 0 || overallScore < 60
  };
}

export function applyQuickFixes(chapter: Chapter, issues: QualityIssue[]): Chapter {
  let content = chapter.content;
  
  // Apply basic fixes for repetition
  const repetitionIssues = issues.filter(i => i.type === 'repetition');
  if (repetitionIssues.length > 0) {
    // Simple fix: replace common repeated patterns
    content = content
      .replace(/\b(the obsidian stone in)\b/gi, 'the dark stone within')
      .replace(/\b(obsidian stone in his)\b/gi, 'the dark rock in his')
      .replace(/\b(in his hand, its)\b/gi, 'in his grasp, its')
      .replace(/\b(his hand, its warmth)\b/gi, 'his palm, its heat');
  }
  
  // Apply fixes for overexplanation
  const overexplanationIssues = issues.filter(i => i.type === 'overexplanation');
  if (overexplanationIssues.length > 0) {
    // Remove some explanatory phrases
    content = content
      .replace(/\bbecause\b/gi, 'since')
      .replace(/\bsince\b/gi, 'as')
      .replace(/\bas a result\b/gi, 'thus');
  }
  
  return {
    ...chapter,
    content
  };
}

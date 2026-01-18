/**
 * Arc Validation Service
 * 
 * Validates that planned arcs properly use Grand Saga characters and context
 * Ensures consistency between Grand Saga, arc planning, and chapter generation
 */

import type { NovelState, Arc, Character } from '../types';
import { getGrandSagaCharacters, getAllGrandSagaCharacterNames } from './grandSagaAnalyzer';

export interface ArcValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Validates that an arc properly uses Grand Saga characters and context
 */
export function validateArcAgainstGrandSaga(
  state: NovelState,
  arc: Arc
): ArcValidationResult {
  const result: ArcValidationResult = {
    isValid: true,
    issues: [],
    warnings: [],
    suggestions: [],
  };

  // If no Grand Saga, skip validation
  if (!state.grandSaga || state.grandSaga.trim().length === 0) {
    return result;
  }

  const grandSagaData = getAllGrandSagaCharacterNames(state);
  const grandSagaCharacters = grandSagaData.inCodex;
  const extractedNames = grandSagaData.notInCodex;
  const allGrandSagaNames = [
    ...grandSagaCharacters.map(c => c.name.toLowerCase()),
    ...extractedNames.map(e => e.name.toLowerCase())
  ];

  if (allGrandSagaNames.length === 0) {
    // No characters detected in Grand Saga, so validation passes
    return result;
  }

  // Check if arc description mentions Grand Saga characters
  const arcText = `${arc.title} ${arc.description}`.toLowerCase();
  const mentionedCharacters: string[] = [];
  
  allGrandSagaNames.forEach(name => {
    if (arcText.includes(name)) {
      mentionedCharacters.push(name);
    }
  });

  // For first arc (when no chapters exist), all Grand Saga characters should be mentioned
  if (state.chapters.length === 0) {
    const missingCharacters = allGrandSagaNames.filter(
      name => !mentionedCharacters.includes(name)
    );
    
    if (missingCharacters.length > 0) {
      result.isValid = false;
      result.issues.push(
        `Opening arc should mention all characters from Grand Saga. Missing: ${missingCharacters.map(n => {
          const char = grandSagaCharacters.find(c => c.name.toLowerCase() === n) ||
                      extractedNames.find(e => e.name.toLowerCase() === n);
          return char ? (char as any).name : n;
        }).join(', ')}`
      );
    }
  } else {
    // For subsequent arcs, at least some Grand Saga characters should be mentioned
    if (mentionedCharacters.length === 0 && grandSagaCharacters.length > 0) {
      result.warnings.push(
        'Arc description does not mention any characters from the Grand Saga. Consider including Grand Saga characters to maintain narrative consistency.'
      );
    } else if (mentionedCharacters.length < Math.min(2, grandSagaCharacters.length)) {
      result.warnings.push(
        `Arc mentions only ${mentionedCharacters.length} Grand Saga character(s). Consider including more to maintain narrative focus.`
      );
    }
  }

  // Check if arc description aligns with Grand Saga themes
  const grandSagaLower = state.grandSaga.toLowerCase();
  const grandSagaKeywords = extractKeywords(grandSagaLower);
  const arcKeywords = extractKeywords(arcText);
  
  // Check for thematic alignment (at least some keywords should overlap)
  const overlappingKeywords = grandSagaKeywords.filter(kw => arcKeywords.includes(kw));
  if (overlappingKeywords.length === 0 && grandSagaKeywords.length > 0) {
    result.warnings.push(
      'Arc description does not seem to align with Grand Saga themes. Ensure the arc advances the Grand Saga narrative.'
    );
  }

  // Suggestions
  if (mentionedCharacters.length === 0 && grandSagaCharacters.length > 0) {
    result.suggestions.push(
      `Consider featuring these Grand Saga characters in this arc: ${grandSagaCharacters.slice(0, 3).map(c => c.name).join(', ')}`
    );
  }

  return result;
}

/**
 * Extracts keywords from text (simple implementation)
 */
function extractKeywords(text: string): string[] {
  // Remove common words and extract meaningful terms
  const commonWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[.,!?;:()"'"]/g, ''))
    .filter(w => w.length > 3 && !commonWords.has(w));

  // Return unique words, limited to most common ones
  const wordCounts = new Map<string, number>();
  words.forEach(w => {
    wordCounts.set(w, (wordCounts.get(w) || 0) + 1);
  });

  return Array.from(wordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

/**
 * Validates that chapter generation will include Grand Saga characters
 */
export function validateChapterContextForGrandSaga(
  state: NovelState,
  chapterNumber: number
): ArcValidationResult {
  const result: ArcValidationResult = {
    isValid: true,
    issues: [],
    warnings: [],
    suggestions: [],
  };

  if (!state.grandSaga || state.grandSaga.trim().length === 0) {
    return result;
  }

  const grandSagaCharacters = getGrandSagaCharacters(state);
  
  if (grandSagaCharacters.length === 0) {
    return result;
  }

  // Check if Grand Saga characters have appeared in recent chapters
  const recentChapters = state.chapters.slice(-5);
  const recentContent = recentChapters
    .map(c => `${c.content} ${c.summary}`.toLowerCase())
    .join(' ');

  const missingCharacters: Character[] = [];
  grandSagaCharacters.forEach(char => {
    const charNameLower = char.name.toLowerCase();
    if (!recentContent.includes(charNameLower)) {
      missingCharacters.push(char);
    }
  });

  if (missingCharacters.length > 0 && recentChapters.length >= 3) {
    result.warnings.push(
      `Grand Saga characters have not appeared recently: ${missingCharacters.slice(0, 3).map(c => c.name).join(', ')}. Consider featuring them in upcoming chapters.`
    );
    result.suggestions.push(
      `Consider including ${missingCharacters[0].name} in Chapter ${chapterNumber} to maintain Grand Saga character presence.`
    );
  }

  return result;
}

/**
 * Gets validation summary for display
 */
export function getValidationSummary(result: ArcValidationResult): string {
  if (result.isValid && result.issues.length === 0 && result.warnings.length === 0) {
    return 'Arc validation passed. Grand Saga characters and themes are properly integrated.';
  }

  const parts: string[] = [];
  
  if (!result.isValid) {
    parts.push('VALIDATION FAILED:');
    result.issues.forEach(issue => parts.push(`  ❌ ${issue}`));
  }
  
  if (result.warnings.length > 0) {
    parts.push('WARNINGS:');
    result.warnings.forEach(warning => parts.push(`  ⚠️ ${warning}`));
  }
  
  if (result.suggestions.length > 0) {
    parts.push('SUGGESTIONS:');
    result.suggestions.forEach(suggestion => parts.push(`  💡 ${suggestion}`));
  }

  return parts.join('\n');
}

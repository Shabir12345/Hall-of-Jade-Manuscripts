import { NovelState, StyleProfile } from '../../types';
import { createStyleProfile, analyzeWritingStyle } from '../contextAnalysis';

/**
 * Style Analyzer
 * Analyzes writing style from existing chapters and generates style guidelines for prompts
 */

/**
 * Gets style guidelines formatted for prompt inclusion
 */
export function getStyleGuidelines(state: NovelState): string {
  const styleProfile = getCachedStyleProfile(state);
  
  if (state.chapters.length === 0) {
    return 'No existing chapters to analyze. Use standard Xianxia/Xuanhuan writing style with rich descriptions and vivid imagery.';
  }

  const { metrics, styleGuidelines } = styleProfile;

  let guidelines = 'WRITING STYLE GUIDELINES (Maintain Consistency):\n\n';
  
  guidelines += `Tone: ${metrics.tone.charAt(0).toUpperCase() + metrics.tone.slice(1)}\n`;
  guidelines += `Average Sentence Length: ${metrics.averageSentenceLength} words\n`;
  guidelines += `Pacing Pattern: ${metrics.pacingPattern.charAt(0).toUpperCase() + metrics.pacingPattern.slice(1)}\n`;
  guidelines += `Narrative Perspective: ${metrics.narrativePerspective.charAt(0).toUpperCase() + metrics.narrativePerspective.slice(1)} person\n`;
  guidelines += `Descriptive Ratio: ${(metrics.descriptiveRatio * 100).toFixed(0)}%\n`;
  guidelines += `Dialogue Ratio: ${(metrics.dialogueRatio * 100).toFixed(0)}%\n\n`;

  guidelines += 'Style Requirements:\n';
  styleGuidelines.forEach((guideline, index) => {
    guidelines += `${index + 1}. ${guideline}\n`;
  });

  if (metrics.genreSpecificTerms.length > 0) {
    guidelines += `\nGenre-Specific Terms to Use: ${metrics.genreSpecificTerms.slice(0, 10).join(', ')}\n`;
  }

  return guidelines;
}

/**
 * Gets style profile for context
 */
export function getStyleProfile(state: NovelState): StyleProfile | null {
  if (state.chapters.length === 0) {
    return null;
  }
  return getCachedStyleProfile(state);
}

/**
 * Gets sample passages for style reference
 */
export function getStyleSamples(state: NovelState, maxSamples: number = 3): string[] {
  if (state.chapters.length === 0) {
    return [];
  }

  const styleProfile = getCachedStyleProfile(state);
  return styleProfile.samplePassages.slice(0, maxSamples);
}

/**
 * Checks if style consistency should be emphasized
 */
export function shouldEmphasizeStyleConsistency(state: NovelState): boolean {
  if (state.chapters.length < 3) {
    return false; // Not enough chapters to establish style
  }
  
  const styleProfile = getCachedStyleProfile(state);
  return styleProfile.consistencyScore > 0.5; // Style is established
}

/**
 * Gets style-specific constraints for prompts
 */
export function getStyleConstraints(state: NovelState): string[] {
  // Reuse cached styleProfile metrics to avoid re-processing full chapter text.
  const metrics = state.chapters.length > 0 ? getCachedStyleProfile(state).metrics : analyzeWritingStyle(state.chapters);
  const constraints: string[] = [];

  if (metrics.averageSentenceLength < 12) {
    constraints.push('Maintain shorter, punchier sentences characteristic of this work');
  } else if (metrics.averageSentenceLength > 20) {
    constraints.push('Use longer, more descriptive sentences as established in previous chapters');
  }

  if (metrics.descriptiveRatio > 0.5) {
    constraints.push('Include rich descriptive language and vivid imagery');
  }

  if (metrics.dialogueRatio > 0.4) {
    constraints.push('Balance dialogue with narrative as established');
  }

  if (metrics.pacingPattern === 'fast') {
    constraints.push('Maintain quick pacing with rapid scene transitions');
  } else if (metrics.pacingPattern === 'slow') {
    constraints.push('Allow for slower, more contemplative pacing');
  }

  if (metrics.narrativePerspective === 'first') {
    constraints.push('Maintain first-person narrative perspective consistently');
  } else if (metrics.narrativePerspective === 'third') {
    constraints.push('Maintain third-person narrative perspective consistently');
  }

  return constraints;
}

// Single-entry cache for style profile computations
let lastStyleKey: string | null = null;
let lastStyleProfile: StyleProfile | null = null;

function getCachedStyleProfile(state: NovelState): StyleProfile {
  // Use updatedAt as the main invalidation signal (App updates this on changes)
  const key = `${state.id}:${state.updatedAt}:${state.chapters.length}`;
  if (lastStyleKey === key && lastStyleProfile) return lastStyleProfile;

  const profile = createStyleProfile(state.chapters);
  lastStyleKey = key;
  lastStyleProfile = profile;
  return profile;
}
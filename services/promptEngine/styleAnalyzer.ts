import { NovelState, StyleProfile, AuthorialVoiceProfile, BuiltPrompt, Chapter } from '../../types';
import { createStyleProfile, analyzeWritingStyle } from '../contextAnalysis';
import { generateUUID } from '../../utils/uuid';

/**
 * Style Analyzer
 * Analyzes writing style from existing chapters and generates style guidelines for prompts
 */

/**
 * Gets style guidelines formatted for prompt inclusion
 * Now includes authorial voice profile if available
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

  // Add authorial voice profile if available
  const voiceProfile = extractAuthorialVoiceProfile(state.chapters, state);
  if (voiceProfile) {
    guidelines += 'AUTHORIAL VOICE PROFILE:\n';
    guidelines += `Sentence Complexity: ${voiceProfile.preferredSentenceComplexity.average} words average `;
    guidelines += `(range: ${voiceProfile.preferredSentenceComplexity.min}-${voiceProfile.preferredSentenceComplexity.max})\n`;
    guidelines += `Emotional Tone: ${voiceProfile.emotionalToneRange.primary}`;
    if (voiceProfile.emotionalToneRange.secondary.length > 0) {
      guidelines += ` (secondary: ${voiceProfile.emotionalToneRange.secondary.join(', ')})\n`;
    } else {
      guidelines += '\n';
    }
    if (voiceProfile.thematicFocus.length > 0) {
      guidelines += `Thematic Focus: ${voiceProfile.thematicFocus.join(', ')}\n`;
    }
    if (voiceProfile.stylisticQuirks.length > 0) {
      guidelines += `Stylistic Quirks: ${voiceProfile.stylisticQuirks.join('; ')}\n`;
    }
    if (voiceProfile.imperfections.length > 0) {
      guidelines += `Intentional Imperfections: ${voiceProfile.imperfections.join('; ')}\n`;
    }
    guidelines += `Vocabulary Formality: ${voiceProfile.vocabularyPreferences.formalityLevel}\n\n`;
  }

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

// Cache for authorial voice profile
let lastVoiceProfileKey: string | null = null;
let lastVoiceProfile: AuthorialVoiceProfile | null = null;

/**
 * Extracts authorial voice profile from chapters
 * Analyzes sentence complexity, emotional tone, thematic focus, and stylistic quirks
 */
export function extractAuthorialVoiceProfile(
  chapters: Chapter[],
  state: NovelState
): AuthorialVoiceProfile | null {
  if (chapters.length === 0) {
    return null;
  }

  // Use cache
  const key = `${state.id}:${state.updatedAt}:${chapters.length}`;
  if (lastVoiceProfileKey === key && lastVoiceProfile) {
    return lastVoiceProfile;
  }

  const sentenceComplexity = analyzeSentenceComplexity(chapters);
  const emotionalToneRange = analyzeEmotionalToneRange(chapters);
  const thematicFocus = extractThematicFocus(chapters, state);
  const stylisticQuirks = extractStylisticQuirks(chapters);
  const vocabularyPreferences = analyzeVocabularyPreferences(chapters);

  const profile: AuthorialVoiceProfile = {
    id: generateUUID(),
    novelId: state.id,
    preferredSentenceComplexity: sentenceComplexity,
    emotionalToneRange: emotionalToneRange,
    thematicFocus: thematicFocus,
    stylisticQuirks: stylisticQuirks.stylisticQuirks,
    imperfections: stylisticQuirks.imperfections,
    vocabularyPreferences: vocabularyPreferences,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  lastVoiceProfileKey = key;
  lastVoiceProfile = profile;
  return profile;
}

/**
 * Analyzes sentence complexity patterns
 */
function analyzeSentenceComplexity(chapters: Chapter[]): {
  min: number;
  max: number;
  average: number;
  variance: number;
} {
  const allSentences = chapters
    .map(ch => (ch.content || '').split(/[.!?]+/).filter(s => s.trim().length > 0))
    .flat();

  const sentenceLengths = allSentences.map(s => s.trim().split(/\s+/).length);

  if (sentenceLengths.length === 0) {
    return { min: 10, max: 20, average: 15, variance: 5 };
  }

  const min = Math.min(...sentenceLengths);
  const max = Math.max(...sentenceLengths);
  const average = sentenceLengths.reduce((sum, len) => sum + len, 0) / sentenceLengths.length;

  // Calculate variance
  const variance = sentenceLengths.reduce((sum, len) => {
    const diff = len - average;
    return sum + (diff * diff);
  }, 0) / sentenceLengths.length;

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    average: Math.round(average * 10) / 10,
    variance: Math.round(variance * 10) / 10,
  };
}

/**
 * Analyzes emotional tone range
 */
function analyzeEmotionalToneRange(chapters: Chapter[]): {
  primary: string;
  secondary: string[];
  intensityRange: [number, number];
} {
  const allContent = chapters.map(ch => ch.content).join(' ').toLowerCase();

  // Emotional tone keywords
  const toneKeywords: Record<string, string[]> = {
    formal: ['thus', 'therefore', 'hence', 'whereas', 'furthermore', 'moreover', 'indeed', 'consequently'],
    casual: ["'", "don't", "can't", "won't", "gonna", "wanna", "yeah", "okay"],
    dramatic: ['suddenly', 'abruptly', 'violently', 'fiercely', 'desperately', 'intensely'],
    contemplative: ['pondered', 'reflected', 'considered', 'contemplated', 'wondered', 'thought'],
    action: ['charged', 'struck', 'leaped', 'dashed', 'sprinted', 'attacked'],
    emotional: ['heart', 'soul', 'feeling', 'emotion', 'passion', 'desire', 'fear', 'joy'],
  };

  const toneScores: Record<string, number> = {};
  Object.keys(toneKeywords).forEach(tone => {
    toneScores[tone] = toneKeywords[tone].reduce((count, keyword) => {
      const matches = allContent.match(new RegExp(keyword, 'gi'));
      return count + (matches ? matches.length : 0);
    }, 0);
  });

  // Find primary tone
  const sortedTones = Object.entries(toneScores).sort((a, b) => b[1] - a[1]);
  const primary = sortedTones[0]?.[0] || 'mixed';
  const secondary = sortedTones.slice(1, 3).map(([tone]) => tone).filter(t => t !== primary);

  // Calculate intensity range (simplified: based on dramatic/emotional keywords)
  const intensityScore = (toneScores.dramatic || 0) + (toneScores.emotional || 0);
  const maxIntensity = chapters.length * 10; // Rough estimate
  const intensity = Math.min(100, Math.max(0, (intensityScore / maxIntensity) * 100));

  return {
    primary,
    secondary,
    intensityRange: [Math.max(0, intensity - 20), Math.min(100, intensity + 20)] as [number, number],
  };
}

/**
 * Extracts thematic focus from chapters
 */
function extractThematicFocus(chapters: Chapter[], state: NovelState): string[] {
  const themes: string[] = [];

  // Extract from grand saga if available
  if (state.grandSaga && state.grandSaga.length > 20) {
    const sagaLower = state.grandSaga.toLowerCase();
    if (sagaLower.includes('power') || sagaLower.includes('cultivation')) themes.push('Power & Cultivation');
    if (sagaLower.includes('revenge') || sagaLower.includes('vengeance')) themes.push('Revenge & Justice');
    if (sagaLower.includes('love') || sagaLower.includes('romance')) themes.push('Love & Relationships');
    if (sagaLower.includes('mystery') || sagaLower.includes('secret')) themes.push('Mystery & Secrets');
  }

  // Extract from chapter summaries
  const summaries = chapters.map(ch => ch.summary || ch.title).join(' ').toLowerCase();
  const commonThemes = [
    'power', 'cultivation', 'realm', 'sect', 'technique', 'artifact',
    'revenge', 'justice', 'betrayal', 'loyalty',
    'love', 'friendship', 'family',
    'mystery', 'secret', 'prophecy', 'destiny',
    'battle', 'conflict', 'war',
  ];

  commonThemes.forEach(theme => {
    if (summaries.includes(theme) && !themes.some(t => t.toLowerCase().includes(theme))) {
      themes.push(theme.charAt(0).toUpperCase() + theme.slice(1));
    }
  });

  return themes.slice(0, 5); // Limit to top 5 themes
}

/**
 * Extracts stylistic quirks and intentional imperfections
 */
function extractStylisticQuirks(chapters: Chapter[]): {
  stylisticQuirks: string[];
  imperfections: string[];
} {
  const quirks: string[] = [];
  const imperfections: string[] = [];
  const allContent = chapters.map(ch => ch.content).join(' ');

  // Detect stylistic patterns
  const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Check for sentence fragments (intentional imperfections)
  const fragmentPattern = /^[a-z][^.!?]*$/;
  const fragments = sentences.filter(s => fragmentPattern.test(s.trim()));
  if (fragments.length > sentences.length * 0.05) {
    imperfections.push('Intentional sentence fragments for emphasis');
  }

  // Check for unconventional punctuation
  const dashCount = (allContent.match(/—/g) || []).length;
  const ellipsisCount = (allContent.match(/\.\.\./g) || []).length;
  if (dashCount > chapters.length * 2) {
    quirks.push('Frequent use of em-dashes for emphasis');
  }
  if (ellipsisCount > chapters.length) {
    quirks.push('Use of ellipses for pauses and reflection');
  }

  // Check for varied sentence beginnings
  const sentenceBeginnings = sentences.slice(0, 20).map(s => {
    const words = s.trim().split(/\s+/);
    return words[0]?.toLowerCase() || '';
  });
  const uniqueBeginnings = new Set(sentenceBeginnings);
  if (uniqueBeginnings.size / sentenceBeginnings.length > 0.7) {
    quirks.push('Varied sentence beginnings');
  }

  // Check for repetition patterns (intentional)
  const words = allContent.toLowerCase().split(/\s+/);
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    if (word.length > 4) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  const repeatedWords = Object.entries(wordFreq)
    .filter(([_, count]) => count > chapters.length * 3)
    .map(([word]) => word);

  if (repeatedWords.length > 0 && repeatedWords.length < 10) {
    quirks.push(`Strategic repetition of key words: ${repeatedWords.slice(0, 3).join(', ')}`);
  }

  return {
    stylisticQuirks: quirks.slice(0, 5),
    imperfections: imperfections.slice(0, 3),
  };
}

/**
 * Analyzes vocabulary preferences
 */
function analyzeVocabularyPreferences(chapters: Chapter[]): {
  common: string[];
  uncommon: string[];
  formalityLevel: 'formal' | 'casual' | 'mixed';
} {
  const allContent = chapters.map(ch => ch.content).join(' ');
  const words = allContent.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  // Common words (appear frequently)
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  const sortedWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  // Uncommon words (longer, less frequent but meaningful)
  const uncommonWords = Object.entries(wordFreq)
    .filter(([word, count]) => word.length > 6 && count < chapters.length * 2 && count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Formality level
  const formalIndicators = ['thus', 'therefore', 'hence', 'whereas', 'furthermore', 'moreover'];
  const casualIndicators = ["'", "don't", "can't", "won't", "gonna", "wanna"];

  const formalCount = formalIndicators.reduce((count, ind) => {
    const matches = allContent.match(new RegExp(ind, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);

  const casualCount = casualIndicators.reduce((count, ind) => {
    const matches = allContent.match(new RegExp(ind, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);

  let formalityLevel: 'formal' | 'casual' | 'mixed' = 'mixed';
  if (formalCount > casualCount * 1.5) formalityLevel = 'formal';
  else if (casualCount > formalCount * 1.5) formalityLevel = 'casual';

  return {
    common: sortedWords.slice(0, 10),
    uncommon: uncommonWords.slice(0, 10),
    formalityLevel,
  };
}

/**
 * Enforces voice consistency in prompts
 */
export function enforceVoiceConsistency(
  prompt: BuiltPrompt,
  voiceProfile: AuthorialVoiceProfile
): BuiltPrompt {
  if (!voiceProfile) {
    return prompt;
  }

  // Build voice consistency constraints
  const constraints: string[] = [];

  // Sentence complexity constraints
  const { min, max, average } = voiceProfile.preferredSentenceComplexity;
  constraints.push(
    `Maintain sentence complexity within established range: average ${average} words per sentence, ` +
    `varying between ${min} and ${max} words. Preserve the natural variation in sentence length.`
  );

  // Emotional tone constraints
  const { primary, secondary, intensityRange } = voiceProfile.emotionalToneRange;
  constraints.push(
    `Maintain emotional tone: primary tone is ${primary}${secondary.length > 0 ? `, with secondary tones of ${secondary.join(', ')}` : ''}. ` +
    `Emotional intensity should range between ${intensityRange[0]}% and ${intensityRange[1]}%.`
  );

  // Thematic focus
  if (voiceProfile.thematicFocus.length > 0) {
    constraints.push(
      `Maintain thematic focus on: ${voiceProfile.thematicFocus.join(', ')}. ` +
      `Weave these themes naturally throughout the chapter.`
    );
  }

  // Stylistic quirks
  if (voiceProfile.stylisticQuirks.length > 0) {
    constraints.push(
      `Preserve stylistic quirks: ${voiceProfile.stylisticQuirks.join('; ')}. ` +
      `These are intentional characteristics of the authorial voice.`
    );
  }

  // Intentional imperfections
  if (voiceProfile.imperfections.length > 0) {
    constraints.push(
      `Maintain intentional stylistic imperfections: ${voiceProfile.imperfections.join('; ')}. ` +
      `These add authenticity and should not be "corrected" to perfect grammar.`
    );
  }

  // Vocabulary preferences
  const { formalityLevel, common, uncommon } = voiceProfile.vocabularyPreferences;
  constraints.push(
    `Maintain vocabulary formality level: ${formalityLevel}. ` +
    `Use established vocabulary patterns naturally.`
  );

  // Add constraints to prompt
  const enhancedConstraints = [
    ...constraints,
    ...(prompt.specificConstraints || []),
  ];

  return {
    ...prompt,
    specificConstraints: enhancedConstraints,
    // Add voice profile sample passages if available
    userInstruction: prompt.userInstruction +
      (voiceProfile.stylisticQuirks.length > 0
        ? `\n\nVOICE CONSISTENCY: Preserve the authorial voice characteristics identified in the style profile.`
        : ''),
  };
}
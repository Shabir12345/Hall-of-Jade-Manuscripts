import { Chapter } from '../types';

/**
 * Opening Sentence Analyzer
 * Detects cliché opening patterns and provides alternatives
 */

export interface OpeningAnalysis {
  isCliche: boolean;
  clicheType?: 'weather' | 'time_of_day' | 'setting_description' | 'passive_observation' | 'none';
  severity: 'high' | 'medium' | 'low' | 'none';
  detectedPatterns: string[];
  suggestions: string[];
  openingSentences: string[];
}

/**
 * Detects cliché opening patterns in chapter content
 */
export function analyzeOpeningSentence(chapter: Chapter): OpeningAnalysis {
  if (!chapter.content || chapter.content.trim().length === 0) {
    return {
      isCliche: false,
      severity: 'none',
      detectedPatterns: [],
      suggestions: [],
      openingSentences: [],
    };
  }

  // Extract first 2-3 sentences for analysis
  const content = chapter.content.trim();
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).slice(0, 3);
  const openingText = sentences.join(' ').toLowerCase();
  const detectedPatterns: string[] = [];
  let clicheType: 'weather' | 'time_of_day' | 'setting_description' | 'passive_observation' | 'none' = 'none';
  let severity: 'high' | 'medium' | 'low' | 'none' = 'none';

  // Weather clichés
  const weatherPatterns = [
    /\b(the\s+)?(morning|afternoon|evening|dawn|dusk|sunrise|sunset)\s+(sun|light|rays?|beams?)/i,
    /\b(dark|storm|rain|cloud|fog|mist)\s+(clouds?|gathered|fell|hung|filled)/i,
    /\b(the\s+)?sun\s+(climbed|rose|set|peeked|emerged|shone|beamed)/i,
    /\b(moonlight|starlight|sunlight)\s+(bathed|illuminated|cast|fell|streamed)/i,
    /\b(shadows?|light)\s+(stretched|cast|fell|danced|gathered)/i,
    /\b(rain|snow|wind)\s+(fell|blew|whipped|pounded)/i,
  ];

  for (const pattern of weatherPatterns) {
    if (pattern.test(openingText)) {
      detectedPatterns.push('Weather description opening');
      clicheType = 'weather';
      severity = 'high';
      break;
    }
  }

  // Time-of-day clichés
  const timeOfDayPatterns = [
    /\b(as|when)\s+(dawn|dusk|night|morning|afternoon|evening)\s+(broke|fell|arrived|came|approached)/i,
    /\b(the\s+)?(next|following)\s+(morning|day|night|evening)/i,
    /\b(in|during|at)\s+(the\s+)?(morning|afternoon|evening|night|dawn|dusk)/i,
    /\b(hours|moments|days?)\s+later/i,
    /\b(time|hours?)\s+passed/i,
  ];

  if (severity === 'none') {
    for (const pattern of timeOfDayPatterns) {
      if (pattern.test(openingText)) {
        detectedPatterns.push('Time-of-day cliché');
        clicheType = 'time_of_day';
        severity = 'high';
        break;
      }
    }
  }

  // Generic setting descriptions
  const settingPatterns = [
    /\b(the\s+)?(training\s+grounds?|forest|mountain|city|village|sect|palace|temple)\s+(stretched|loomed|towered|spread|rose)/i,
    /\b(the\s+)?(landscape|scenery|view|horizon)\s+(stretched|spread|extended)/i,
    /\b(in|across|over)\s+the\s+(distance|horizon|landscape)/i,
  ];

  if (severity === 'none') {
    for (const pattern of settingPatterns) {
      if (pattern.test(openingText)) {
        detectedPatterns.push('Generic setting description');
        clicheType = 'setting_description';
        severity = 'medium';
        break;
      }
    }
  }

  // Passive observations
  const passivePatterns = [
    /^\s*it\s+was/i,
    /^\s*there\s+were/i,
    /^\s*there\s+was/i,
    /^\s*in\s+the\s+distance/i,
    /^\s*all\s+around/i,
  ];

  if (severity === 'none') {
    for (const pattern of passivePatterns) {
      if (pattern.test(openingText)) {
        detectedPatterns.push('Passive observation opening');
        clicheType = 'passive_observation';
        severity = 'medium';
        break;
      }
    }
  }

  // Generate suggestions based on detected patterns
  const suggestions: string[] = [];
  if (clicheType !== 'none') {
    suggestions.push('Start with character action, dialogue, or thought instead');
    suggestions.push('Reference the previous chapter\'s ending directly');
    suggestions.push('Begin with the character\'s immediate response to the previous chapter\'s ending');
    suggestions.push('Use active voice and character-focused opening');

    if (clicheType === 'weather' || clicheType === 'time_of_day') {
      suggestions.push('Avoid weather and time-of-day descriptions - these are AI-generated clichés');
    }
    if (clicheType === 'setting_description') {
      suggestions.push('Show the setting through character action and perception, not generic description');
    }
    if (clicheType === 'passive_observation') {
      suggestions.push('Start with active character involvement rather than passive observation');
    }
  }

  return {
    isCliche: clicheType !== 'none',
    clicheType,
    severity,
    detectedPatterns,
    suggestions,
    openingSentences: sentences.map(s => s.trim()),
  };
}

/**
 * Checks if opening starts with character action, dialogue, or thought
 */
export function hasGoodOpening(chapter: Chapter): boolean {
  if (!chapter.content || chapter.content.trim().length === 0) {
    return false;
  }

  const firstSentence = chapter.content.trim().split(/[.!?]+/)[0]?.trim().toLowerCase() || '';
  
  // Check for good opening patterns
  const goodPatterns = [
    /^["']/, // Dialogue
    /^(he|she|they|it|we|i|the\s+\w+)\s+(stepped|pushed|reached|turned|looked|said|thought|felt|walked|moved|began|started|continued)/i, // Character action
    /^(no\.|yes\.|wait\.|what\.|how\.)/i, // Interjection/thought
  ];

  // Check for character names (common in character-focused openings)
  const hasCharacterName = /[A-Z][a-z]+\s+(stepped|walked|looked|said|thought|reached|pushed|turned|continued)/i.test(firstSentence);

  // Check for dialogue indicators
  const hasDialogue = /^["']/.test(firstSentence);

  // Check for action verbs at start
  const hasAction = /^(stepped|walked|reached|pushed|turned|looked|continued|began|started|moved)/i.test(firstSentence);

  return hasCharacterName || hasDialogue || hasAction || goodPatterns.some(p => p.test(firstSentence));
}

/**
 * Generates alternative opening suggestions
 */
export function generateOpeningSuggestions(
  previousChapter: Chapter | null,
  currentOpening: string
): string[] {
  const suggestions: string[] = [];

  if (!previousChapter) {
    suggestions.push('Start with character action or dialogue to immediately engage the reader');
    suggestions.push('Begin with a specific, concrete detail rather than generic description');
    return suggestions;
  }

  // Extract last sentence from previous chapter
  const prevSentences = previousChapter.content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const lastSentence = prevSentences[prevSentences.length - 1]?.trim() || '';

  if (lastSentence) {
    // Suggest continuations based on previous chapter ending
    if (lastSentence.toLowerCase().includes('toward') || lastSentence.toLowerCase().includes('walked') || lastSentence.toLowerCase().includes('headed')) {
      suggestions.push(`Continue by showing the character arriving at or reaching their destination`);
    } else if (lastSentence.toLowerCase().includes('thought') || lastSentence.toLowerCase().includes('wondered')) {
      suggestions.push(`Show the character acting on that thought or making a decision`);
    } else if (lastSentence.toLowerCase().includes('said') || lastSentence.toLowerCase().includes('\"')) {
      suggestions.push(`Continue the dialogue or show the immediate response`);
    } else {
      suggestions.push(`Show the character's immediate next action or response to what just happened`);
    }
  }

  suggestions.push(`Reference the previous chapter's ending directly in the first sentence`);
  suggestions.push(`Start with character action or dialogue, not description`);
  suggestions.push(`Begin with the immediate next moment after the previous chapter ended`);

  return suggestions;
}

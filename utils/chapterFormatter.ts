/**
 * Chapter Formatting Utility
 * Ensures professional writing standards: proper paragraph structure,
 * correct punctuation, and readable formatting
 */

export interface StructureValidation {
  isValid: boolean;
  paragraphCount: number;
  averageParagraphLength: number;
  hasVariety: boolean;
  issues: string[];
  suggestions: string[];
}

/**
 * Main function to format chapter content
 * Applies all formatting rules and fixes
 */
export function formatChapterContent(content: string): string {
  if (!content || content.trim().length === 0) {
    return content;
  }

  let formatted = content;

  // Step 1: Fix punctuation errors first (before paragraph detection)
  formatted = fixPunctuationErrors(formatted);

  // Step 2: Ensure proper paragraph structure
  formatted = ensureParagraphStructure(formatted);

  // Step 3: Clean up whitespace and formatting
  formatted = cleanFormatting(formatted);

  return formatted.trim();
}

/**
 * Fixes common punctuation errors
 * - Converts incorrect full stops to commas where appropriate
 * - Fixes run-on sentences
 * - Corrects comma splices
 */
export function fixPunctuationErrors(text: string): string {
  if (!text) return text;

  let fixed = text;

  // Pattern 1: Full stop followed by lowercase letter (likely should be comma)
  // But preserve abbreviations and proper nouns
  fixed = fixed.replace(/\.\s+([a-z][a-z\s]{0,20})/g, (match, following) => {
    // Don't change if it's clearly a new sentence (capital letter after period)
    // Check if the following text looks like a continuation (short phrase, lowercase)
    const nextSentenceStart = /^[a-z]/.test(following.trim());
    const isShortPhrase = following.split(/\s+/).length <= 5;
    
    // If it's a short phrase starting with lowercase, likely should be comma
    if (nextSentenceStart && isShortPhrase && !isAbbreviation(match)) {
      // Check if previous sentence is complete
      const beforeMatch = fixed.substring(0, fixed.indexOf(match));
      const lastSentence = beforeMatch.split(/[.!?]/).pop() || '';
      const lastWords = lastSentence.trim().split(/\s+/).slice(-3);
      
      // If last words suggest continuation, use comma
      const continuationWords = ['and', 'but', 'or', 'so', 'then', 'when', 'while', 'as', 'though', 'although'];
      if (lastWords.some(w => continuationWords.includes(w.toLowerCase()))) {
        return `, ${following}`;
      }
    }
    return match;
  });

  // Pattern 2: Multiple periods in a row (should be single period or ellipsis)
  fixed = fixed.replace(/\.{4,}/g, '...');
  fixed = fixed.replace(/\.{2}(?!\.)/g, '.');

  // Pattern 3: Comma before period (remove redundant comma)
  fixed = fixed.replace(/,\s*\./g, '.');

  // Pattern 4: Space before punctuation (remove)
  fixed = fixed.replace(/\s+([.,!?;:])/g, '$1');

  // Pattern 5: Missing space after punctuation (add)
  fixed = fixed.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

  // Pattern 6: Fix common comma errors in lists
  // Ensure proper comma usage in lists (Oxford comma style)
  fixed = fixed.replace(/(\w+)\s+and\s+(\w+)(?=\s+[A-Z])/g, (match, first, second) => {
    // Check if this is part of a list (preceded by comma-separated items)
    const before = fixed.substring(0, fixed.indexOf(match));
    const lastComma = before.lastIndexOf(',');
    if (lastComma > before.length - 50) {
      // Likely part of a list, add comma before "and"
      return `${first}, and ${second}`;
    }
    return match;
  });

  return fixed;
}

/**
 * Ensures proper paragraph structure
 * - Detects single-paragraph chapters and breaks them up
 * - Ensures varied paragraph lengths
 * - Preserves existing paragraph breaks
 */
export function ensureParagraphStructure(text: string): string {
  if (!text) return text;

  // Normalize existing paragraph breaks
  let formatted = text.replace(/\r\n/g, '\n');
  formatted = formatted.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines

  // Check if text has paragraph breaks
  const hasParagraphBreaks = formatted.includes('\n\n') || formatted.split('\n').length > 1;
  
  // If no paragraph breaks, we need to add them
  if (!hasParagraphBreaks || formatted.split('\n\n').length === 1) {
    formatted = addParagraphBreaks(formatted);
  } else {
    // Ensure existing paragraphs are properly formatted
    formatted = formatExistingParagraphs(formatted);
  }

  return formatted;
}

/**
 * Adds paragraph breaks to text that lacks them
 * Uses sentence boundaries and logical flow
 */
function addParagraphBreaks(text: string): string {
  // Split into sentences
  const sentences = splitIntoSentences(text);
  
  if (sentences.length <= 3) {
    // Too short, return as single paragraph
    return text;
  }

  const paragraphs: string[] = [];
  let currentParagraph: string[] = [];
  let sentenceCount = 0;
  const targetParagraphLength = 3; // Target 3-5 sentences per paragraph

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if (!sentence) continue;

    currentParagraph.push(sentence);
    sentenceCount++;

    // Check if we should break here
    const shouldBreak = 
      sentenceCount >= targetParagraphLength && 
      (i < sentences.length - 1) && // Not the last sentence
      (isNaturalBreakPoint(sentence, i < sentences.length - 1 ? sentences[i + 1] : ''));

    if (shouldBreak || sentenceCount >= 6) {
      // Don't create paragraphs longer than 6 sentences
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = [];
        sentenceCount = 0;
      }
    }
  }

  // Add remaining sentences
  if (currentParagraph.length > 0) {
    paragraphs.push(currentParagraph.join(' '));
  }

  return paragraphs.join('\n\n');
}

/**
 * Formats existing paragraphs to ensure proper structure
 */
function formatExistingParagraphs(text: string): string {
  const paragraphs = text.split(/\n\n+/);
  const formattedParagraphs: string[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    // Check paragraph length
    const sentences = splitIntoSentences(trimmed);
    
    // If paragraph is too long (>10 sentences), try to break it
    if (sentences.length > 10) {
      const splitParagraphs = splitLongParagraph(trimmed, sentences);
      formattedParagraphs.push(...splitParagraphs);
    } else {
      formattedParagraphs.push(trimmed);
    }
  }

  return formattedParagraphs.join('\n\n');
}

/**
 * Splits a long paragraph into multiple shorter ones
 */
function splitLongParagraph(text: string, sentences: string[]): string[] {
  const paragraphs: string[] = [];
  const targetLength = 4; // Target 4 sentences per paragraph
  let current: string[] = [];

  for (let i = 0; i < sentences.length; i++) {
    current.push(sentences[i].trim());
    
    if (current.length >= targetLength && i < sentences.length - 1) {
      // Check if next sentence starts a new topic
      const nextSentence = sentences[i + 1];
      if (isNaturalBreakPoint(sentences[i], nextSentence)) {
        paragraphs.push(current.join(' '));
        current = [];
      }
    }
  }

  if (current.length > 0) {
    paragraphs.push(current.join(' '));
  }

  return paragraphs.length > 0 ? paragraphs : [text];
}

/**
 * Checks if a natural break point exists between sentences
 */
function isNaturalBreakPoint(currentSentence: string, nextSentence: string): boolean {
  const breakIndicators = [
    // Time transitions
    /\b(later|then|next|after|before|during|while|when|suddenly|finally|eventually)\b/i,
    // Location transitions
    /\b(meanwhile|elsewhere|there|here|inside|outside|within|beyond)\b/i,
    // Topic shifts
    /\b(however|although|though|but|yet|still|nevertheless|moreover|furthermore)\b/i,
    // Character focus shifts
    /\b(he|she|they|it)\s+[A-Z][a-z]+/i, // New character name after pronoun
  ];

  const nextLower = nextSentence.toLowerCase();
  
  // Check if next sentence starts with a transition word
  for (const pattern of breakIndicators) {
    if (pattern.test(nextLower.substring(0, 50))) {
      return true;
    }
  }

  // Check if current sentence ends with completion marker
  const completionMarkers = /(completed|finished|ended|concluded|resolved|decided)[.!?]?$/i;
  if (completionMarkers.test(currentSentence)) {
    return true;
  }

  return false;
}

/**
 * Splits text into sentences
 * Handles abbreviations and dialogue
 */
function splitIntoSentences(text: string): string[] {
  // Remove dialogue markers temporarily to avoid splitting on dialogue punctuation
  const dialogueMarkers: Array<{ marker: string; placeholder: string }> = [];
  let placeholderIndex = 0;
  
  // Replace dialogue quotes with placeholders
  let processed = text.replace(/"[^"]*"/g, (match) => {
    const placeholder = `__DIALOGUE_${placeholderIndex}__`;
    dialogueMarkers.push({ marker: match, placeholder });
    placeholderIndex++;
    return placeholder;
  });

  // Split on sentence endings
  const sentenceRegex = /([^.!?]*[.!?]+)/g;
  const sentences: string[] = [];
  let match;

  while ((match = sentenceRegex.exec(processed)) !== null) {
    let sentence = match[0].trim();
    
    // Restore dialogue markers
    for (const { marker, placeholder } of dialogueMarkers) {
      sentence = sentence.replace(placeholder, marker);
    }
    
    if (sentence.length > 0) {
      sentences.push(sentence);
    }
  }

  // If no sentences found, return the whole text as one sentence
  if (sentences.length === 0) {
    return [text];
  }

  return sentences;
}

/**
 * Cleans up formatting issues
 * - Normalizes whitespace
 * - Removes excessive spaces
 * - Ensures proper spacing around punctuation
 */
function cleanFormatting(text: string): string {
  let cleaned = text;

  // Normalize whitespace (but preserve paragraph breaks)
  cleaned = cleaned.replace(/[ \t]+/g, ' '); // Multiple spaces to single
  cleaned = cleaned.replace(/\n[ \t]+/g, '\n'); // Remove leading spaces on new lines
  cleaned = cleaned.replace(/[ \t]+\n/g, '\n'); // Remove trailing spaces before newlines

  // Ensure proper spacing after paragraph breaks
  cleaned = cleaned.replace(/\n\n([a-z])/g, '\n\n$1'); // Already correct, but ensure it

  // Remove spaces before punctuation (except opening quotes and parentheses)
  cleaned = cleaned.replace(/\s+([.,!?;:])/g, '$1');

  // Ensure space after punctuation (except if followed by closing quote/parenthesis)
  cleaned = cleaned.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

  // Fix spacing around quotes
  cleaned = cleaned.replace(/\s+"/g, ' "');
  cleaned = cleaned.replace(/"\s+/g, '" ');

  // Remove multiple consecutive paragraph breaks (keep max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

/**
 * Validates chapter structure quality
 */
export function validateStructure(text: string): StructureValidation {
  const validation: StructureValidation = {
    isValid: true,
    paragraphCount: 0,
    averageParagraphLength: 0,
    hasVariety: false,
    issues: [],
    suggestions: [],
  };

  if (!text || text.trim().length === 0) {
    validation.isValid = false;
    validation.issues.push('Text is empty');
    return validation;
  }

  // Count paragraphs
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  validation.paragraphCount = paragraphs.length;

  // Check minimum paragraph count (at least 3 for 1500 words)
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const minParagraphs = Math.max(3, Math.floor(wordCount / 500)); // ~1 paragraph per 500 words

  if (validation.paragraphCount < minParagraphs) {
    validation.isValid = false;
    validation.issues.push(
      `Chapter has only ${validation.paragraphCount} paragraph(s), but should have at least ${minParagraphs} for ${wordCount} words`
    );
    validation.suggestions.push('Break up long paragraphs into shorter, focused paragraphs');
  }

  // Calculate average paragraph length
  if (paragraphs.length > 0) {
    const totalSentences = paragraphs.reduce((sum, para) => {
      return sum + splitIntoSentences(para).length;
    }, 0);
    validation.averageParagraphLength = totalSentences / paragraphs.length;
  }

  // Check for paragraph length variety
  if (paragraphs.length >= 3) {
    const sentenceCounts = paragraphs.map(p => splitIntoSentences(p).length);
    const minSentences = Math.min(...sentenceCounts);
    const maxSentences = Math.max(...sentenceCounts);
    
    validation.hasVariety = maxSentences - minSentences >= 2;
    
    if (!validation.hasVariety) {
      validation.issues.push('Paragraphs lack length variety (all similar length)');
      validation.suggestions.push('Vary paragraph lengths for better readability');
    }
  }

  // Check for extremely long paragraphs
  const longParagraphs = paragraphs.filter(p => splitIntoSentences(p).length > 10);
  if (longParagraphs.length > 0) {
    validation.isValid = false;
    validation.issues.push(
      `Found ${longParagraphs.length} paragraph(s) with more than 10 sentences`
    );
    validation.suggestions.push('Break up paragraphs longer than 10 sentences');
  }

  // Check for single-paragraph chapters
  if (paragraphs.length === 1 && wordCount > 500) {
    validation.isValid = false;
    validation.issues.push('Chapter is a single continuous paragraph');
    validation.suggestions.push('Add paragraph breaks to improve readability');
  }

  return validation;
}

/**
 * Helper function to check if a period is part of an abbreviation
 */
function isAbbreviation(text: string): boolean {
  const commonAbbreviations = [
    'mr.', 'mrs.', 'ms.', 'dr.', 'prof.', 'sr.', 'jr.',
    'etc.', 'e.g.', 'i.e.', 'vs.', 'a.m.', 'p.m.',
    'inc.', 'ltd.', 'corp.', 'co.', 'st.', 'ave.', 'blvd.',
  ];

  const lowerText = text.toLowerCase();
  return commonAbbreviations.some(abbr => lowerText.includes(abbr));
}

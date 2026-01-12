/**
 * Text processing utilities for TTS
 * Handles chunking, normalization, and text preprocessing
 */

export interface TextChunk {
  text: string;
  startIndex: number;
  endIndex: number;
  isParagraph: boolean;
}

/**
 * Normalize text for better TTS pronunciation
 */
export function normalizeText(text: string): string {
  let normalized = text.trim();
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Handle common abbreviations
  normalized = normalized.replace(/\bDr\./g, 'Doctor');
  normalized = normalized.replace(/\bMr\./g, 'Mister');
  normalized = normalized.replace(/\bMrs\./g, 'Missus');
  normalized = normalized.replace(/\bMs\./g, 'Miss');
  normalized = normalized.replace(/\betc\./g, 'etcetera');
  normalized = normalized.replace(/\bi\.e\./g, 'that is');
  normalized = normalized.replace(/\be\.g\./g, 'for example');
  
  // Handle numbers (basic conversion)
  normalized = normalized.replace(/\b(\d+)\b/g, (match, num) => {
    return numberToWords(parseInt(num, 10));
  });
  
  return normalized;
}

/**
 * Convert number to words (basic implementation)
 */
function numberToWords(num: number): string {
  if (num === 0) return 'zero';
  if (num < 20) {
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 
                  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 
                  'seventeen', 'eighteen', 'nineteen'];
    return ones[num];
  }
  if (num < 100) {
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return one > 0 ? `${tens[ten]} ${numberToWords(one)}` : tens[ten];
  }
  // For larger numbers, just return the number as digits
  return num.toString();
}

/**
 * Split text into chunks at natural boundaries
 * Prioritizes sentence boundaries, then paragraph boundaries
 */
export function chunkText(text: string, maxLength: number = 2000): TextChunk[] {
  if (text.length <= maxLength) {
    return [{
      text: text,
      startIndex: 0,
      endIndex: text.length,
      isParagraph: false
    }];
  }

  const chunks: TextChunk[] = [];
  let currentIndex = 0;
  const textLength = text.length;

  while (currentIndex < textLength) {
    const remaining = textLength - currentIndex;
    let chunkLength = Math.min(maxLength, remaining);
    let chunkEnd = currentIndex + chunkLength;

    // If we're not at the end, try to find a good break point
    if (chunkEnd < textLength) {
      // First, try to find a sentence boundary (., !, ?)
      const sentenceEnd = findLastSentenceBoundary(text, currentIndex, chunkEnd);
      if (sentenceEnd > currentIndex) {
        chunkEnd = sentenceEnd + 1; // Include the punctuation
      } else {
        // Try paragraph boundary (double newline)
        const paragraphEnd = findLastParagraphBoundary(text, currentIndex, chunkEnd);
        if (paragraphEnd > currentIndex) {
          chunkEnd = paragraphEnd;
        } else {
          // Try single newline
          const newlineEnd = text.lastIndexOf('\n', chunkEnd);
          if (newlineEnd > currentIndex) {
            chunkEnd = newlineEnd + 1;
          } else {
            // Try space
            const spaceEnd = text.lastIndexOf(' ', chunkEnd);
            if (spaceEnd > currentIndex) {
              chunkEnd = spaceEnd + 1;
            }
          }
        }
      }
    }

    const chunkText = text.substring(currentIndex, chunkEnd).trim();
    if (chunkText.length > 0) {
      chunks.push({
        text: chunkText,
        startIndex: currentIndex,
        endIndex: chunkEnd,
        isParagraph: text.substring(currentIndex, chunkEnd).includes('\n\n')
      });
    }

    currentIndex = chunkEnd;
  }

  return chunks;
}

/**
 * Find the last sentence boundary before the limit
 */
function findLastSentenceBoundary(text: string, start: number, limit: number): number {
  const sentenceMarkers = ['.', '!', '?'];
  let lastBoundary = -1;

  for (let i = limit; i >= start; i--) {
    if (sentenceMarkers.includes(text[i])) {
      // Check if it's not part of an abbreviation (simple heuristic)
      if (i + 1 >= text.length || text[i + 1] === ' ' || text[i + 1] === '\n') {
        lastBoundary = i;
        break;
      }
    }
  }

  return lastBoundary;
}

/**
 * Find the last paragraph boundary (double newline) before the limit
 */
function findLastParagraphBoundary(text: string, start: number, limit: number): number {
  const doubleNewline = text.lastIndexOf('\n\n', limit);
  if (doubleNewline >= start) {
    return doubleNewline + 2; // Include both newlines
  }
  return -1;
}

/**
 * Detect paragraph boundaries in text
 */
export function detectParagraphs(text: string): number[] {
  const boundaries: number[] = [0];
  let index = 0;

  while (index < text.length) {
    const doubleNewline = text.indexOf('\n\n', index);
    if (doubleNewline === -1) break;
    boundaries.push(doubleNewline + 2);
    index = doubleNewline + 2;
  }

  boundaries.push(text.length);
  return boundaries;
}

/**
 * Get word boundaries for text synchronization
 */
export function getWordBoundaries(text: string): Array<{ word: string; start: number; end: number }> {
  const words: Array<{ word: string; start: number; end: number }> = [];
  const wordRegex = /\S+/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return words;
}

/**
 * Get sentence boundaries for text synchronization
 */
export function getSentenceBoundaries(text: string): Array<{ sentence: string; start: number; end: number }> {
  const sentences: Array<{ sentence: string; start: number; end: number }> = [];
  const sentenceRegex = /[^.!?]+[.!?]+/g;
  let match;
  let lastIndex = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push({
      sentence: match[0].trim(),
      start: match.index,
      end: match.index + match[0].length
    });
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text if any
  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex).trim();
    if (remaining.length > 0) {
      sentences.push({
        sentence: remaining,
        start: lastIndex,
        end: text.length
      });
    }
  }

  return sentences;
}

/**
 * Generate a hash for text (for caching)
 */
export function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

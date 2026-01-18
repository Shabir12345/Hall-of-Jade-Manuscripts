import { Chapter } from '../types';

/**
 * Chapter Ending Validator
 * 
 * Detects cliché summary-style endings that sound unnatural and increase AI detection risk.
 * These patterns include:
 * - Summary phrases ("And so...", "Thus...", "The journey continues...")
 * - Future tense predictions ("would help", "was about to")
 * - Meta-commentary ("And so the story continues...")
 * - Vague conclusions ("Everything changed...", "The stage was set...")
 */

export interface ClichePattern {
  type: 'summary_phrase' | 'future_prediction' | 'meta_commentary' | 'vague_conclusion';
  pattern: string;
  severity: 'high' | 'medium' | 'low';
  example: string;
}

export interface EndingValidationResult {
  isValid: boolean;
  hasClicheEnding: boolean;
  detectedPatterns: ClichePattern[];
  lastSentences: string[];
  suggestions: string[];
  score: number; // 0-100, lower is worse
}

/**
 * Cliché patterns to detect in chapter endings
 */
const CLICHE_PATTERNS: ClichePattern[] = [
  // Summary phrases
  {
    type: 'summary_phrase',
    pattern: /\b(and\s+so|and\s+thus|and\s+so\s+it\s+was)\b/i,
    severity: 'high',
    example: 'And so, the journey continues...'
  },
  {
    type: 'summary_phrase',
    pattern: /\b(the\s+journey\s+continues?|the\s+path\s+forward|the\s+road\s+ahead)\b/i,
    severity: 'high',
    example: 'The journey continues...'
  },
  {
    type: 'summary_phrase',
    pattern: /\b(little\s+did\s+[^.]+\s+know)\b/i,
    severity: 'high',
    example: 'Little did he know what awaited him...'
  },
  {
    type: 'summary_phrase',
    pattern: /\b(what\s+awaited|what\s+lay\s+ahead|what\s+was\s+to\s+come)\b/i,
    severity: 'high',
    example: 'What awaited him was beyond imagination...'
  },
  {
    type: 'summary_phrase',
    pattern: /\b(the\s+system\s+would|the\s+system\s+will)\b/i,
    severity: 'high',
    example: 'The system would help him overcome this challenge...'
  },
  {
    type: 'summary_phrase',
    pattern: /\b(fate\s+had\s+other\s+plans?|destiny\s+had\s+other\s+plans?)\b/i,
    severity: 'medium',
    example: 'Fate had other plans...'
  },
  
  // Future tense predictions
  {
    type: 'future_prediction',
    pattern: /\b(would\s+overcome|would\s+face|would\s+discover|would\s+find|would\s+learn)\b/i,
    severity: 'high',
    example: 'He would overcome this challenge...'
  },
  {
    type: 'future_prediction',
    pattern: /\b(was\s+about\s+to|was\s+destined\s+to|was\s+fated\s+to)\b/i,
    severity: 'medium',
    example: 'He was about to discover the truth...'
  },
  
  // Meta-commentary
  {
    type: 'meta_commentary',
    pattern: /\b(and\s+so\s+the\s+story\s+continues?)\b/i,
    severity: 'high',
    example: 'And so the story continues...'
  },
  {
    type: 'meta_commentary',
    pattern: /\b(this\s+marked\s+the\s+beginning\s+of|this\s+was\s+the\s+start\s+of)\b/i,
    severity: 'high',
    example: 'This marked the beginning of a new chapter...'
  },
  {
    type: 'meta_commentary',
    pattern: /\b(from\s+this\s+point\s+forward|from\s+now\s+on)\b/i,
    severity: 'medium',
    example: 'From this point forward, everything would change...'
  },
  
  // Vague conclusions
  {
    type: 'vague_conclusion',
    pattern: /\b(and\s+everything\s+changed?|everything\s+was\s+different)\b/i,
    severity: 'medium',
    example: 'And everything changed...'
  },
  {
    type: 'vague_conclusion',
    pattern: /\b(the\s+stage\s+was\s+set|the\s+scene\s+was\s+set)\b/i,
    severity: 'medium',
    example: 'The stage was set...'
  },
  {
    type: 'vague_conclusion',
    pattern: /\b(a\s+new\s+chapter\s+in\s+[^.]+\s+life|a\s+new\s+beginning)\b/i,
    severity: 'medium',
    example: 'A new chapter in his life had begun...'
  },
  {
    type: 'vague_conclusion',
    pattern: /\b(and\s+thus\s+[^.]+\s+path\s+forward\s+was\s+set|and\s+so\s+[^.]+\s+path\s+was\s+set)\b/i,
    severity: 'high',
    example: 'And thus, his path forward was set...'
  },
];

/**
 * Extracts the last N sentences from chapter content
 */
function extractLastSentences(content: string, count: number = 3): string[] {
  if (!content || content.trim().length === 0) {
    return [];
  }

  // Split by sentence endings, but preserve them
  const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
  
  if (sentences.length === 0) {
    // Fallback: split by periods if no proper sentences found
    return content.split('.').filter(s => s.trim().length > 0).slice(-count);
  }

  return sentences.slice(-count).map(s => s.trim());
}

/**
 * Detects cliché patterns in the given text
 */
export function detectClicheEndingPatterns(text: string): ClichePattern[] {
  const detected: ClichePattern[] = [];
  const textLower = text.toLowerCase();

  for (const pattern of CLICHE_PATTERNS) {
    if (pattern.pattern.test(text)) {
      // Check if it's in the last portion of the text (last 200 words)
      const words = text.split(/\s+/);
      const last200Words = words.slice(-200).join(' ');
      
      if (pattern.pattern.test(last200Words)) {
        detected.push(pattern);
      }
    }
  }

  return detected;
}

/**
 * Checks if the ending has summary-style language
 */
export function isSummaryStyleEnding(text: string): boolean {
  const lastSentences = extractLastSentences(text, 3);
  if (lastSentences.length === 0) return false;

  const endingText = lastSentences.join(' ').toLowerCase();

  // Check for summary indicators
  const summaryIndicators = [
    /\b(continued|continues?|would\s+continue)\b/,
    /\b(began\s+to|started\s+to)\s+(realize|understand|know|see)\b/,
    /\b(was\s+about\s+to|was\s+going\s+to)\b/,
    /\b(would\s+prove|would\s+show|would\s+demonstrate)\b/,
    /\b(this\s+was\s+only\s+the\s+beginning|this\s+was\s+just\s+the\s+start)\b/,
  ];

  return summaryIndicators.some(pattern => pattern.test(endingText));
}

/**
 * Validates chapter ending for cliché patterns
 */
export function validateChapterEnding(chapter: Chapter): EndingValidationResult {
  if (!chapter.content || chapter.content.trim().length === 0) {
    return {
      isValid: true,
      hasClicheEnding: false,
      detectedPatterns: [],
      lastSentences: [],
      suggestions: [],
      score: 100,
    };
  }

  const lastSentences = extractLastSentences(chapter.content, 3);
  const endingText = lastSentences.join(' ');

  // Detect cliché patterns
  const detectedPatterns = detectClicheEndingPatterns(endingText);
  const isSummaryStyle = isSummaryStyleEnding(endingText);

  const hasClicheEnding = detectedPatterns.length > 0 || isSummaryStyle;

  // Calculate score (start at 100, deduct for issues)
  let score = 100;
  const suggestions: string[] = [];

  if (detectedPatterns.length > 0) {
    // Deduct points based on severity
    const highSeverityCount = detectedPatterns.filter(p => p.severity === 'high').length;
    const mediumSeverityCount = detectedPatterns.filter(p => p.severity === 'medium').length;
    
    score -= (highSeverityCount * 20) + (mediumSeverityCount * 10);
    score = Math.max(0, score);

    // Generate suggestions
    if (highSeverityCount > 0) {
      suggestions.push('Chapter ending contains cliché summary phrases. End with specific action, dialogue, or sensory detail instead of summarizing what will happen.');
      suggestions.push('Examples of good endings: "The blade flashed." / "You think you can escape?" / "The air tasted of ozone."');
    }

    // Specific suggestions based on detected patterns
    const summaryPhrases = detectedPatterns.filter(p => p.type === 'summary_phrase');
    if (summaryPhrases.length > 0) {
      suggestions.push('Avoid summary phrases like "And so...", "Thus...", "The journey continues...". End with immediate action or dialogue instead.');
    }

    const futurePredictions = detectedPatterns.filter(p => p.type === 'future_prediction');
    if (futurePredictions.length > 0) {
      suggestions.push('Avoid future tense predictions like "would overcome" or "was about to". Show what IS happening, not what WILL happen.');
    }

    const metaCommentary = detectedPatterns.filter(p => p.type === 'meta_commentary');
    if (metaCommentary.length > 0) {
      suggestions.push('Avoid meta-commentary about the story itself. Stay in the moment with character action, thought, or dialogue.');
    }
  }

  if (isSummaryStyle && detectedPatterns.length === 0) {
    score -= 15;
    suggestions.push('Chapter ending has summary-style language. End with concrete action, dialogue, or sensory detail rather than vague conclusions.');
  }

  // Check if ending is too short (might indicate it was cut off or is incomplete)
  const lastParagraph = chapter.content.split(/\n\n/).filter(p => p.trim().length > 0).pop() || '';
  if (lastParagraph.length < 50 && lastSentences.length < 2) {
    score -= 10;
    suggestions.push('Chapter ending seems too brief. Ensure the chapter ends with a complete scene or moment.');
  }

  const isValid = score >= 70 && !hasClicheEnding;

  return {
    isValid,
    hasClicheEnding,
    detectedPatterns,
    lastSentences,
    suggestions: [...new Set(suggestions)], // Remove duplicates
    score,
  };
}

/**
 * Narrative Voice Irregularity Module
 * 
 * Injects human-like imperfections into text to avoid "too perfect" AI patterns.
 * Includes colloquialisms, grammatical quirks, intentional sentence fragments,
 * and varied punctuation patterns that humans naturally produce.
 */

import { NovelState, Chapter } from '../types';

/**
 * Profile of irregularities to inject
 */
export interface IrregularityProfile {
  colloquialismFrequency: number; // 0.0-1.0
  fragmentFrequency: number; // 0.0-1.0
  punctuationVariety: number; // 0.0-1.0
  grammaticalQuirks: string[]; // Specific quirks to inject
  characterSpecificQuirks: Record<string, string[]>; // Per-character quirks
}

/**
 * Configuration for voice irregularity injection
 */
export interface VoiceIrregularityConfig {
  level: number; // 0.0 (none) to 1.0 (heavy)
  preserveMeaning: boolean; // Don't change meaning when injecting
  characterAware: boolean; // Use character-specific quirks
}

const DEFAULT_CONFIG: VoiceIrregularityConfig = {
  level: 0.1, // 10% irregularity
  preserveMeaning: true,
  characterAware: true,
};

/**
 * Common colloquialisms that feel human
 */
const COLLOQUIALISMS = [
  'kind of',
  'sort of',
  'a bit',
  'pretty much',
  'more or less',
  'you know',
  'I mean',
  'well',
  'actually',
  'basically',
  'literally',
  'honestly',
];

/**
 * Sentence starters that add variety
 */
const VARIED_STARTERS = [
  'And',
  'But',
  'So',
  'Yet',
  'Still',
  'Then',
  'Now',
  'Here',
  'There',
  'This',
  'That',
];

/**
 * Generates an irregularity profile based on existing chapters
 * Analyzes natural patterns in the text
 */
export function generateIrregularityProfile(state: NovelState): IrregularityProfile {
  if (state.chapters.length === 0) {
    return getDefaultProfile();
  }
  
  // Analyze recent chapters for natural patterns
  const recentChapters = state.chapters.slice(-5);
  const combinedText = recentChapters.map(ch => ch.content).join(' ');
  
  // Count colloquialisms
  let colloquialismCount = 0;
  COLLOQUIALISMS.forEach(phrase => {
    const regex = new RegExp(`\\b${phrase}\\b`, 'gi');
    const matches = combinedText.match(regex);
    if (matches) colloquialismCount += matches.length;
  });
  
  const totalSentences = combinedText.split(/[.!?]+/).length;
  const colloquialismFrequency = Math.min(1.0, colloquialismCount / Math.max(1, totalSentences / 10));
  
  // Count sentence fragments (sentences without verbs or very short)
  const sentences = combinedText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const fragments = sentences.filter(s => {
    const words = s.split(/\s+/);
    return words.length <= 5 && !s.match(/\b(is|was|are|were|be|been|being)\b/i);
  });
  const fragmentFrequency = fragments.length / Math.max(1, sentences.length);
  
  // Analyze punctuation variety
  const hasEllipses = combinedText.includes('...') || combinedText.includes('…');
  const hasDashes = combinedText.includes('—') || combinedText.includes('–');
  const hasParentheses = combinedText.includes('(') && combinedText.includes(')');
  const punctuationVariety = (hasEllipses ? 0.33 : 0) + (hasDashes ? 0.33 : 0) + (hasParentheses ? 0.34 : 0);
  
  // Extract character-specific quirks (simplified - in production could be more sophisticated)
  const characterQuirks: Record<string, string[]> = {};
  state.characterCodex.forEach(char => {
    // Look for patterns in dialogue attributed to this character
    const charNameRegex = new RegExp(`${char.name}[^.!?]*["']([^"']+)["']`, 'gi');
    const dialogueMatches = combinedText.match(charNameRegex);
    if (dialogueMatches && dialogueMatches.length > 0) {
      // Simple extraction - could be enhanced
      characterQuirks[char.name] = [];
    }
  });
  
  return {
    colloquialismFrequency: Math.min(0.2, colloquialismFrequency + 0.05), // Slight boost
    fragmentFrequency: Math.min(0.15, fragmentFrequency + 0.03),
    punctuationVariety: Math.max(0.3, punctuationVariety),
    grammaticalQuirks: [],
    characterSpecificQuirks: characterQuirks,
  };
}

/**
 * Gets default irregularity profile
 */
function getDefaultProfile(): IrregularityProfile {
  return {
    colloquialismFrequency: 0.05,
    fragmentFrequency: 0.03,
    punctuationVariety: 0.4,
    grammaticalQuirks: [],
    characterSpecificQuirks: {},
  };
}

/**
 * Injects voice irregularities into text
 */
export function injectVoiceIrregularities(
  text: string,
  irregularityLevel: number = 0.1,
  profile?: IrregularityProfile,
  config: Partial<VoiceIrregularityConfig> = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const finalProfile = profile || getDefaultProfile();
  
  if (irregularityLevel <= 0) {
    return text; // No injection
  }
  
  let result = text;
  
  // Scale frequencies by irregularity level
  const scaledColloquialismFreq = finalProfile.colloquialismFrequency * irregularityLevel * 10;
  const scaledFragmentFreq = finalProfile.fragmentFrequency * irregularityLevel * 10;
  
  // Inject colloquialisms (sparingly)
  if (scaledColloquialismFreq > 0 && Math.random() < scaledColloquialismFreq) {
    result = injectColloquialisms(result, scaledColloquialismFreq);
  }
  
  // Inject sentence fragments (very sparingly)
  if (scaledFragmentFreq > 0 && Math.random() < scaledFragmentFreq) {
    result = injectFragments(result, scaledFragmentFreq);
  }
  
  // Vary punctuation
  if (finalProfile.punctuationVariety > 0.3) {
    result = varyPunctuation(result, irregularityLevel);
  }
  
  // Inject varied sentence starters
  result = varySentenceStarters(result, irregularityLevel);
  
  return result;
}

/**
 * Injects colloquialisms into text
 */
function injectColloquialisms(text: string, frequency: number): string {
  const sentences = text.split(/([.!?]+)/);
  let result = '';
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    
    if (sentence.trim().length > 0 && Math.random() < frequency) {
      // Add colloquialism at random position
      const words = sentence.trim().split(/\s+/);
      if (words.length > 3) {
        const insertPos = Math.floor(Math.random() * (words.length - 2)) + 1;
        const colloquialism = COLLOQUIALISMS[Math.floor(Math.random() * COLLOQUIALISMS.length)];
        words.splice(insertPos, 0, colloquialism);
        result += words.join(' ') + punctuation + ' ';
      } else {
        result += sentence + punctuation + ' ';
      }
    } else {
      result += sentence + punctuation + ' ';
    }
  }
  
  return result.trim();
}

/**
 * Injects sentence fragments
 */
function injectFragments(text: string, frequency: number): string {
  const sentences = text.split(/([.!?]+)/);
  let result = '';
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    
    if (sentence.trim().length > 10 && Math.random() < frequency) {
      // Occasionally convert a sentence to a fragment
      const words = sentence.trim().split(/\s+/);
      if (words.length > 8) {
        // Split into two parts, make second a fragment
        const splitPoint = Math.floor(words.length * 0.6);
        const firstPart = words.slice(0, splitPoint).join(' ');
        const secondPart = words.slice(splitPoint).join(' ');
        result += firstPart + punctuation + ' ' + secondPart + '. ';
      } else {
        result += sentence + punctuation + ' ';
      }
    } else {
      result += sentence + punctuation + ' ';
    }
  }
  
  return result.trim();
}

/**
 * Varies punctuation patterns
 */
function varyPunctuation(text: string, level: number): string {
  let result = text;
  
  // Occasionally replace periods with ellipses for trailing thoughts
  if (Math.random() < level * 0.1) {
    result = result.replace(/\.(\s+[A-Z])/g, (match, after) => {
      if (Math.random() < 0.1) {
        return '...' + after;
      }
      return match;
    });
  }
  
  // Occasionally use dashes for emphasis
  if (Math.random() < level * 0.1) {
    result = result.replace(/,\s+/g, (match) => {
      if (Math.random() < 0.05) {
        return ' — ';
      }
      return match;
    });
  }
  
  return result;
}

/**
 * Varies sentence starters
 */
function varySentenceStarters(text: string, level: number): string {
  const sentences = text.split(/([.!?]+\s+)/);
  let result = '';
  
  for (let i = 0; i < sentences.length; i += 2) {
    const sentence = sentences[i];
    const punctuation = sentences[i + 1] || '';
    
    if (sentence.trim().length > 0 && Math.random() < level * 0.2) {
      // Occasionally start with a conjunction or varied starter
      const words = sentence.trim().split(/\s+/);
      const firstWord = words[0];
      
      // Don't modify if already starts with varied starter
      if (!VARIED_STARTERS.some(starter => firstWord.toLowerCase() === starter.toLowerCase())) {
        if (Math.random() < 0.3 && words.length > 5) {
          const starter = VARIED_STARTERS[Math.floor(Math.random() * VARIED_STARTERS.length)];
          words[0] = starter + ',';
          result += words.join(' ') + punctuation;
        } else {
          result += sentence + punctuation;
        }
      } else {
        result += sentence + punctuation;
      }
    } else {
      result += sentence + punctuation;
    }
  }
  
  return result.trim();
}

/**
 * Generates a prompt for AI to inject irregularities naturally
 * This is used in Pass 2 (stylistic injection)
 */
export function generateIrregularityPrompt(
  text: string,
  profile: IrregularityProfile,
  level: number
): string {
  return `NARRATIVE VOICE IRREGULARITY INJECTION:
Rewrite the following text to include natural human writing imperfections and variations.

Target irregularity level: ${(level * 100).toFixed(0)}%

Requirements:
1. Add occasional colloquialisms (${(profile.colloquialismFrequency * 100).toFixed(0)}% frequency): ${COLLOQUIALISMS.slice(0, 5).join(', ')}
2. Include sentence fragments (${(profile.fragmentFrequency * 100).toFixed(0)}% frequency): Short, impactful fragments (3-5 words) for emphasis
3. Vary punctuation: Use ellipses (...), dashes (—), and parentheses strategically
4. Vary sentence starters: Occasionally start sentences with conjunctions (And, But, So) or varied words
5. Maintain meaning and readability - these are subtle enhancements, not disruptions

Original text:
${text}

Return the rewritten text with natural irregularities injected.`;
}

/**
 * Linguistic Jitter Service
 * 
 * Identifies high-probability (predictable) words in generated text and
 * replaces them with lower-probability, contextually rich synonyms to
 * increase perplexity and reduce AI detection.
 */

import { calculatePerplexity } from './narrativeCraftAnalyzer';

/**
 * A word candidate for replacement
 */
export interface WordCandidate {
  word: string;
  frequency: number;
  probability: number; // Probability of this word appearing
  entropy: number; // Lower entropy = more predictable
  context: string; // Surrounding text for context-aware replacement
}

/**
 * Configuration for linguistic jitter
 */
export interface LinguisticJitterConfig {
  topPercent: number; // Top percentage of words to replace (e.g., 0.1 = top 10%)
  minFrequency: number; // Minimum frequency to consider for replacement
  preserveProperNouns: boolean; // Don't replace proper nouns
}

const DEFAULT_CONFIG: LinguisticJitterConfig = {
  topPercent: 0.1, // Top 10%
  minFrequency: 2, // Must appear at least twice
  preserveProperNouns: true,
};

/**
 * Simple synonym mapping for common high-probability words
 * In production, this could use a thesaurus API or contextual AI
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // Common verbs
  'said': ['muttered', 'whispered', 'declared', 'stated', 'remarked', 'noted'],
  'went': ['moved', 'traveled', 'journeyed', 'proceeded', 'advanced'],
  'came': ['arrived', 'approached', 'entered', 'appeared', 'emerged'],
  'looked': ['gazed', 'stared', 'peered', 'examined', 'scrutinized'],
  'saw': ['observed', 'noticed', 'perceived', 'detected', 'spotted'],
  'felt': ['sensed', 'experienced', 'perceived', 'detected'],
  'knew': ['understood', 'realized', 'recognized', 'comprehended'],
  'thought': ['pondered', 'considered', 'reflected', 'contemplated', 'mused'],
  'seemed': ['appeared', 'looked', 'gave the impression'],
  'took': ['grasped', 'seized', 'acquired', 'obtained', 'claimed'],
  
  // Common adjectives
  'big': ['large', 'massive', 'enormous', 'immense', 'substantial'],
  'small': ['tiny', 'minute', 'minuscule', 'petite', 'compact'],
  'good': ['excellent', 'superior', 'outstanding', 'remarkable', 'notable'],
  'bad': ['terrible', 'awful', 'dreadful', 'atrocious', 'deplorable'],
  'new': ['fresh', 'novel', 'recent', 'modern', 'contemporary'],
  'old': ['ancient', 'aged', 'venerable', 'antique', 'timeworn'],
  'long': ['extended', 'prolonged', 'lengthy', 'extensive', 'protracted'],
  'short': ['brief', 'concise', 'abbreviated', 'compact', 'succinct'],
  
  // Common nouns
  'thing': ['object', 'item', 'element', 'entity', 'artifact'],
  'way': ['method', 'manner', 'approach', 'technique', 'means'],
  'time': ['moment', 'instant', 'period', 'duration', 'interval'],
  'place': ['location', 'site', 'spot', 'venue', 'area'],
  'person': ['individual', 'character', 'figure', 'being', 'entity'],
  
  // Common adverbs
  'very': ['extremely', 'exceptionally', 'remarkably', 'incredibly'],
  'really': ['truly', 'genuinely', 'actually', 'indeed'],
  'quite': ['rather', 'fairly', 'somewhat', 'relatively'],
  'just': ['merely', 'simply', 'only', 'barely'],
  'only': ['solely', 'exclusively', 'merely', 'simply'],
};

/**
 * Identifies high-probability words in text
 * Returns top N% most predictable/common words
 */
export function identifyHighProbabilityWords(
  text: string,
  config: Partial<LinguisticJitterConfig> = {}
): WordCandidate[] {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  // Tokenize text into words
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 0);
  
  if (words.length === 0) {
    return [];
  }
  
  // Count word frequencies
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    const normalized = word.replace(/[^\w]/g, '');
    if (normalized.length > 0) {
      // Skip proper nouns if configured
      if (finalConfig.preserveProperNouns && /^[A-Z]/.test(word)) {
        return;
      }
      wordFreq[normalized] = (wordFreq[normalized] || 0) + 1;
    }
  });
  
  const totalWords = words.length;
  
  // Calculate probabilities and entropy for each word
  const candidates: WordCandidate[] = [];
  
  Object.entries(wordFreq).forEach(([word, frequency]) => {
    if (frequency < finalConfig.minFrequency) {
      return; // Skip low-frequency words
    }
    
    const probability = frequency / totalWords;
    
    // Calculate entropy (lower = more predictable)
    // For a word with probability p, entropy = -p * log2(p)
    const entropy = probability > 0 ? -probability * Math.log2(probability) : 0;
    
    // Find context (surrounding words)
    const wordIndex = words.findIndex(w => w.replace(/[^\w]/g, '') === word);
    const contextStart = Math.max(0, wordIndex - 5);
    const contextEnd = Math.min(words.length, wordIndex + 6);
    const context = words.slice(contextStart, contextEnd).join(' ');
    
    candidates.push({
      word,
      frequency,
      probability,
      entropy,
      context,
    });
  });
  
  // Sort by probability (highest first) and take top N%
  candidates.sort((a, b) => b.probability - a.probability);
  const topCount = Math.max(1, Math.floor(candidates.length * finalConfig.topPercent));
  
  return candidates.slice(0, topCount);
}

/**
 * Gets a synonym for a word based on context
 * Uses simple mapping - in production, could use contextual AI
 */
export function getSynonymForWord(word: string, context: string = ''): string | null {
  const lowerWord = word.toLowerCase().replace(/[^\w]/g, '');
  const synonyms = SYNONYM_MAP[lowerWord];
  
  if (!synonyms || synonyms.length === 0) {
    return null;
  }
  
  // Simple selection: pick a random synonym
  // In production, could use context to pick more appropriate synonym
  const randomIndex = Math.floor(Math.random() * synonyms.length);
  return synonyms[randomIndex];
}

/**
 * Replaces high-probability words with lower-probability synonyms
 * Returns the modified text
 */
export function replaceHighProbabilityWords(
  text: string,
  candidates: WordCandidate[],
  replacementRatio: number = 0.5 // Replace 50% of candidates
): string {
  if (candidates.length === 0) {
    return text;
  }
  
  let result = text;
  const wordsToReplace = candidates.slice(0, Math.ceil(candidates.length * replacementRatio));
  
  wordsToReplace.forEach(candidate => {
    const synonym = getSynonymForWord(candidate.word, candidate.context);
    if (synonym) {
      // Replace word, preserving capitalization
      const regex = new RegExp(`\\b${candidate.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, (match) => {
        // Preserve capitalization
        if (match[0] === match[0].toUpperCase()) {
          return synonym.charAt(0).toUpperCase() + synonym.slice(1);
        }
        return synonym;
      });
    }
  });
  
  return result;
}

/**
 * Generates a prompt for AI to replace high-probability words
 * This is used in Pass 3 of the multi-pass generation
 */
export function generateWordReplacementPrompt(
  text: string,
  candidates: WordCandidate[]
): string {
  if (candidates.length === 0) {
    return '';
  }
  
  const topCandidates = candidates.slice(0, Math.min(20, candidates.length)); // Limit to top 20
  const wordList = topCandidates.map(c => `- "${c.word}" (appears ${c.frequency} times)`).join('\n');
  
  return `LINGUISTIC JITTER REQUIREMENT:
Replace the following high-probability (predictable) words with lower-probability, contextually rich synonyms.
These words appear frequently and make the text feel predictable. Replace them with less common but appropriate alternatives.

Words to replace:
${wordList}

Instructions:
1. Replace each word with a synonym that is less common but contextually appropriate
2. Preserve the meaning and tone
3. Vary your replacements - don't use the same synonym for all instances
4. Ensure the replacements feel natural and enhance rather than distract from the prose
5. Maintain proper capitalization

Original text:
${text}

Return the rewritten text with replacements applied.`;
}

/**
 * Calculates the improvement in perplexity after replacement
 */
export function calculatePerplexityImprovement(
  originalText: string,
  replacedText: string
): { originalPerplexity: number; newPerplexity: number; improvement: number } {
  const originalPerplexity = calculatePerplexity(originalText);
  const newPerplexity = calculatePerplexity(replacedText);
  const improvement = newPerplexity - originalPerplexity;
  
  return {
    originalPerplexity,
    newPerplexity,
    improvement,
  };
}

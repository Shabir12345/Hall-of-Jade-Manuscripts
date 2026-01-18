/**
 * AI Detection Blacklist
 * 
 * Comprehensive lists of words, phrases, structures, and names that are
 * commonly flagged by 2026-level AI detection systems (Originality.ai, GPTZero, etc.)
 * 
 * These patterns are mathematically tuned to detect AI-generated content.
 */

/**
 * The "Big Five" - Instant flags for AI detection
 */
export const FORBIDDEN_WORDS_BIG_FIVE = [
  'delve',
  'tapestry',
  'realm',
  'testament',
  'shimmering',
];

/**
 * Overused verbs that AI models default to
 */
export const FORBIDDEN_VERBS = [
  'embark',
  'facilitate',
  'underscore',
  'leverage',
  'optimize',
  'intertwine',
  'resonate',
  'unleash',
  'unveil',
  'harness',
  'foster',
  'beckon',
];

/**
 * "Flowery" adjectives that detectors flag
 */
export const FORBIDDEN_ADJECTIVES = [
  'vibrant',
  'intricate',
  'pivotal',
  'robust',
  'seamless',
  'meticulous',
  'ethereal',
  'multifaceted',
  'whispering', // e.g., "whispering shadows"
  'bustling',
  'enigmatic',
  'indelible',
];

/**
 * Nouns/metaphors that are AI-typical
 */
export const FORBIDDEN_NOUNS_METAPHORS = [
  'landscape', // metaphorical use
  'symphony',
  'labyrinth',
  'enigma',
  'dance', // metaphorical use
  'crucible',
  'cornerstone',
  'journey', // metaphorical use
  'gateway',
  'heartbeat',
];

/**
 * Transitional phrases that AI overuses
 */
export const FORBIDDEN_TRANSITIONS = [
  'moreover',
  'furthermore',
  'in conclusion',
  'it is important to note',
  'a testament to',
  'on the other hand',
  'essentially',
  'consequently',
  'in many ways',
  'it is worth noting',
  'in essence',
  'to put it simply',
  'as one might expect',
  'therefore',
  'thus',
  'hence',
  'accordingly',
  'nevertheless',
  'nonetheless',
  'notwithstanding',
  'in addition',
  'in fact',
  'in reality',
  'in truth',
  'in actuality',
  'as a matter of fact',
  'to be sure',
  'to be honest',
  'to be fair',
  'in all honesty',
  'in all fairness',
  'in all likelihood',
  'in all probability',
  'in all cases',
  'in all instances',
  'in all situations',
  'in all circumstances',
];

/**
 * Fiction tropes that are AI-typical
 */
export const FORBIDDEN_TROPE_PHRASES = [
  'the air was thick with',
  'a sense of',
  'little did they know',
  'every [x] rang out',
  'their eyes met',
  'unbeknownst to them',
  'little did [pronoun] know', // Pattern variant
];

/**
 * Overused descriptors that AI relies on (when overused)
 */
export const FORBIDDEN_OVERUSED_DESCRIPTORS = [
  'carefully',
  'slowly',
  'gently',
  'suddenly',
];

/**
 * Generic intensifiers that AI overuses
 */
export const FORBIDDEN_INTENSIFIERS = [
  'very',
  'quite',
  'rather',
  'somewhat',
];

/**
 * Generic names that AI models default to
 */
export const FORBIDDEN_NAMES = [
  'Marcus',
  'Blackwood',
  'Chen',
  'Elara',
  'Lyra',
];

/**
 * Combined list of all forbidden words and phrases
 */
export const FORBIDDEN_WORDS = [
  ...FORBIDDEN_WORDS_BIG_FIVE,
  ...FORBIDDEN_VERBS,
  ...FORBIDDEN_ADJECTIVES,
  ...FORBIDDEN_NOUNS_METAPHORS,
  ...FORBIDDEN_TRANSITIONS,
  ...FORBIDDEN_TROPE_PHRASES,
  ...FORBIDDEN_OVERUSED_DESCRIPTORS,
  ...FORBIDDEN_INTENSIFIERS,
];

/**
 * Forbidden structural patterns (regex patterns)
 */
export const FORBIDDEN_STRUCTURES = [
  // "Not X, but Y" pattern - single biggest AI tell
  {
    pattern: /\bnot\s+\w+\s*,\s*but\s+\w+/gi,
    description: '"Not X, but Y" pattern',
  },
  // Triple adjective opener
  {
    pattern: /^[A-Z][^.!?]*,\s*[^.!?]*,\s*and\s+[^.!?]*,\s+the/gi,
    description: 'Triple adjective opener',
  },
  // Echoing conclusion pattern
  {
    pattern: /in\s+that\s+moment[^.!?]*(?:realized|understood|knew)[^.!?]*(?:true|journey|beginning)/gi,
    description: 'Echoing conclusion pattern',
  },
  // "In the world of..." opener
  {
    pattern: /^in\s+the\s+world\s+of\s+/gi,
    description: '"In the world of..." opener',
  },
  // "As the [X] continued to [Y]"
  {
    pattern: /as\s+the\s+\w+\s+continued\s+to\s+\w+/gi,
    description: '"As the [X] continued to [Y]" pattern',
  },
  // "It was [adjective] that [clause]" pattern
  {
    pattern: /\bit\s+was\s+\w+\s+that\s+\w+/gi,
    description: '"It was [adjective] that [clause]" pattern',
  },
  // "Little did [pronoun] know" pattern
  {
    pattern: /\blittle\s+did\s+(?:he|she|they|it|we|I|you)\s+know/gi,
    description: '"Little did [pronoun] know" pattern',
  },
  // "With each passing [time unit]" pattern
  {
    pattern: /\bwith\s+each\s+passing\s+\w+/gi,
    description: '"With each passing [time unit]" pattern',
  },
  // "The [noun] seemed to [verb]" pattern (overused)
  {
    pattern: /\bthe\s+\w+\s+seemed\s+to\s+\w+/gi,
    description: '"The [noun] seemed to [verb]" pattern (overused)',
  },
];

/**
 * Result of checking text for forbidden words
 */
export interface ForbiddenWordViolation {
  word: string;
  index: number;
  context: string; // Surrounding text
}

/**
 * Result of checking text for forbidden structures
 */
export interface ForbiddenStructureViolation {
  pattern: string;
  description: string;
  index: number;
  match: string;
  context: string;
}

/**
 * Checks text for forbidden words and returns violations
 */
export function checkForForbiddenWords(text: string): ForbiddenWordViolation[] {
  const violations: ForbiddenWordViolation[] = [];
  const lowerText = text.toLowerCase();
  
  FORBIDDEN_WORDS.forEach(word => {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match;
    while ((match = regex.exec(lowerText)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      violations.push({
        word: word,
        index: match.index,
        context: text.substring(start, end),
      });
    }
  });
  
  return violations;
}

/**
 * Checks text for forbidden structural patterns
 */
export function checkForForbiddenStructures(text: string): ForbiddenStructureViolation[] {
  const violations: ForbiddenStructureViolation[] = [];
  
  FORBIDDEN_STRUCTURES.forEach(({ pattern, description }) => {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      violations.push({
        pattern: pattern.source,
        description,
        index: match.index,
        match: match[0],
        context: text.substring(start, end),
      });
    }
  });
  
  return violations;
}

/**
 * Checks text for forbidden names
 */
export function checkForForbiddenNames(text: string): ForbiddenWordViolation[] {
  const violations: ForbiddenWordViolation[] = [];
  
  FORBIDDEN_NAMES.forEach(name => {
    const regex = new RegExp(`\\b${name}\\b`, 'gi');
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      violations.push({
        word: name,
        index: match.index,
        context: text.substring(start, end),
      });
    }
  });
  
  return violations;
}

/**
 * Simple synonym mapping for common forbidden words
 * In production, this could be enhanced with a thesaurus API
 */
const SYNONYM_MAP: Record<string, string[]> = {
  'delve': ['explore', 'investigate', 'examine', 'probe'],
  'tapestry': ['fabric', 'weave', 'pattern', 'composition'],
  'realm': ['domain', 'region', 'territory', 'world'],
  'testament': ['proof', 'evidence', 'demonstration', 'sign'],
  'shimmering': ['glowing', 'gleaming', 'glistening', 'sparkling'],
  'embark': ['begin', 'start', 'commence', 'set out'],
  'facilitate': ['enable', 'help', 'assist', 'aid'],
  'underscore': ['emphasize', 'highlight', 'stress', 'accentuate'],
  'leverage': ['use', 'utilize', 'employ', 'apply'],
  'optimize': ['improve', 'enhance', 'refine', 'perfect'],
  'intertwine': ['weave', 'entwine', 'interlace', 'connect'],
  'resonate': ['echo', 'reverberate', 'strike a chord', 'connect'],
  'unleash': ['release', 'free', 'unleash', 'let loose'],
  'unveil': ['reveal', 'disclose', 'show', 'expose'],
  'harness': ['utilize', 'use', 'employ', 'channel'],
  'foster': ['encourage', 'promote', 'nurture', 'cultivate'],
  'beckon': ['signal', 'gesture', 'summon', 'call'],
  'vibrant': ['bright', 'lively', 'energetic', 'colorful'],
  'intricate': ['complex', 'detailed', 'elaborate', 'sophisticated'],
  'pivotal': ['crucial', 'key', 'critical', 'essential'],
  'robust': ['strong', 'sturdy', 'powerful', 'resilient'],
  'seamless': ['smooth', 'fluid', 'uninterrupted', 'continuous'],
  'meticulous': ['careful', 'precise', 'thorough', 'detailed'],
  'ethereal': ['otherworldly', 'celestial', 'delicate', 'light'],
  'multifaceted': ['complex', 'diverse', 'varied', 'many-sided'],
  'bustling': ['busy', 'active', 'lively', 'hectic'],
  'enigmatic': ['mysterious', 'puzzling', 'cryptic', 'obscure'],
  'indelible': ['permanent', 'lasting', 'enduring', 'unforgettable'],
  // New additions for expanded blacklist
  'it is worth noting': ['note that', 'remember that', 'keep in mind', 'consider'],
  'in essence': ['basically', 'fundamentally', 'at its core', 'essentially'],
  'to put it simply': ['simply put', 'in simple terms', 'to simplify', 'briefly'],
  'as one might expect': ['as expected', 'predictably', 'naturally', 'unsurprisingly'],
  'therefore': ['so', 'thus', 'hence', 'consequently'],
  'thus': ['so', 'therefore', 'hence', 'consequently'],
  'hence': ['so', 'therefore', 'thus', 'consequently'],
  'accordingly': ['therefore', 'thus', 'consequently', 'as a result'],
  'carefully': ['cautiously', 'warily', 'gingerly', 'prudently'],
  'slowly': ['gradually', 'leisurely', 'unhurriedly', 'at a crawl'],
  'gently': ['softly', 'tenderly', 'lightly', 'delicately'],
  'suddenly': ['abruptly', 'all at once', 'without warning', 'instantly'],
  'very': ['extremely', 'incredibly', 'remarkably', 'exceptionally'],
  'quite': ['rather', 'fairly', 'somewhat', 'pretty'],
  'rather': ['quite', 'fairly', 'somewhat', 'pretty'],
  'somewhat': ['rather', 'quite', 'fairly', 'a bit'],
};

/**
 * Replaces forbidden words with synonyms
 * Uses simple word replacement - in production, could use contextual AI replacement
 */
export function replaceForbiddenWords(text: string, replacementMode: 'synonym' | 'remove' | 'contextual' = 'synonym'): string {
  let result = text;
  
  if (replacementMode === 'remove') {
    // Remove forbidden words entirely
    FORBIDDEN_WORDS.forEach(word => {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      result = result.replace(regex, '');
    });
    // Clean up extra spaces
    result = result.replace(/\s+/g, ' ').trim();
    return result;
  }
  
  if (replacementMode === 'synonym' || replacementMode === 'contextual') {
    // Replace with synonyms (randomize selection for more natural variation)
    // For 'contextual', we still use synonym rotation but could be enhanced with AI
    FORBIDDEN_WORDS.forEach(word => {
      const synonyms = SYNONYM_MAP[word.toLowerCase()];
      if (synonyms && synonyms.length > 0) {
        const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        let matchCount = 0;
        result = result.replace(regex, (match, offset, string) => {
          // For contextual mode, try to pick a synonym that fits the context better
          let synonymIndex = matchCount % synonyms.length;
          
          if (replacementMode === 'contextual') {
            // Simple contextual selection: look at surrounding words
            const before = string.substring(Math.max(0, offset - 20), offset).toLowerCase();
            const after = string.substring(offset + match.length, Math.min(string.length, offset + match.length + 20)).toLowerCase();
            const context = before + ' ' + after;
            
            // Prefer synonyms that are less common but fit the context
            // This is a simplified version - could be enhanced with AI
            const contextWords = context.split(/\s+/);
            const synonymScores = synonyms.map((syn, idx) => {
              // Prefer synonyms that don't repeat nearby words
              const nearbyRepeat = contextWords.some(w => w === syn.toLowerCase());
              return { idx, score: nearbyRepeat ? 0.5 : 1.0 };
            });
            synonymScores.sort((a, b) => b.score - a.score);
            synonymIndex = synonymScores[0].idx;
          } else {
            // Simple rotation for synonym mode
            synonymIndex = matchCount % synonyms.length;
          }
          
          const synonym = synonyms[synonymIndex];
          matchCount++;
          
          // Preserve capitalization
          if (match[0] === match[0].toUpperCase()) {
            return synonym.charAt(0).toUpperCase() + synonym.slice(1);
          }
          return synonym;
        });
      }
    });
  }
  
  // Replace forbidden structures (requires more sophisticated rewriting)
  // For now, we'll flag them but not auto-replace (requires AI assistance)
  
  return result;
}

/**
 * Gets a formatted list of all forbidden words for prompt inclusion
 */
export function getForbiddenWordsPromptText(): string {
  return `FORBIDDEN WORDS (NEVER USE THESE):
- The "Big Five": ${FORBIDDEN_WORDS_BIG_FIVE.join(', ')}
- Overused Verbs: ${FORBIDDEN_VERBS.join(', ')}
- Flowery Adjectives: ${FORBIDDEN_ADJECTIVES.join(', ')}
- AI-Typical Nouns/Metaphors: ${FORBIDDEN_NOUNS_METAPHORS.join(', ')}
- Transitional Phrases: ${FORBIDDEN_TRANSITIONS.join(', ')}
- Fiction Tropes: ${FORBIDDEN_TROPE_PHRASES.join(', ')}
- Overused Descriptors (when overused): ${FORBIDDEN_OVERUSED_DESCRIPTORS.join(', ')}
- Generic Intensifiers (when overused): ${FORBIDDEN_INTENSIFIERS.join(', ')}
- Generic Names: ${FORBIDDEN_NAMES.join(', ')}`;
}

/**
 * Gets a formatted list of forbidden structures for prompt inclusion
 */
export function getForbiddenStructuresPromptText(): string {
  return `FORBIDDEN STRUCTURAL PATTERNS (NEVER USE THESE):
1. "Not X, but Y" pattern (e.g., "It wasn't just a house, but a sanctuary")
2. Triple adjective opener (e.g., "Cold, dark, and silent, the room waited")
3. Echoing conclusion (e.g., "In that moment, she realized the true journey was only beginning")
4. "In the world of..." opener
5. "As the [X] continued to [Y]" pattern
6. "It was [adjective] that [clause]" pattern (e.g., "It was clear that he understood")
7. "Little did [pronoun] know" pattern (e.g., "Little did he know")
8. "With each passing [time unit]" pattern (e.g., "With each passing moment")
9. "The [noun] seemed to [verb]" pattern when overused (e.g., "The door seemed to creak")
10. Triple repetition of sentence structure (avoid repeating the same sentence structure three times in a row)`;
}

/**
 * Smart Character Name Matching System
 * 
 * Handles different types of character names intelligently:
 * - Proper names (e.g., "Alex Maxwell"): Matches full name, first name, or last name
 * - Descriptive names (e.g., "Ancient Spirit Tree"): Requires strict matching to avoid false positives
 */

// Common words that appear frequently in text and shouldn't be matched individually
// These are words that might be part of a character name but also appear in general text
const COMMON_WORDS = new Set([
  'ancient', 'spirit', 'tree', 'forest', 'mountain', 'river', 'lake', 'sea', 'ocean',
  'king', 'queen', 'prince', 'princess', 'emperor', 'empress', 'lord', 'lady',
  'master', 'elder', 'disciple', 'sect', 'clan', 'tribe', 'village', 'city',
  'sword', 'blade', 'spear', 'bow', 'arrow', 'shield', 'armor',
  'dragon', 'phoenix', 'tiger', 'wolf', 'bear', 'eagle', 'snake',
  'fire', 'water', 'earth', 'wind', 'thunder', 'lightning', 'ice', 'shadow',
  'gold', 'silver', 'iron', 'steel', 'jade', 'crystal', 'diamond',
  'divine', 'celestial', 'heavenly', 'immortal', 'mortal', 'demon', 'devil',
  'cultivation', 'qi', 'realm', 'technique', 'art', 'way', 'path', 'dao',
  'young', 'old', 'great', 'grand', 'supreme', 'ultimate', 'eternal',
  'north', 'south', 'east', 'west', 'central', 'inner', 'outer',
  'first', 'second', 'third', 'fourth', 'fifth', 'one', 'two', 'three',
  'red', 'blue', 'green', 'white', 'black', 'yellow', 'purple',
  'big', 'small', 'large', 'tiny', 'huge', 'massive',
  'new', 'old', 'ancient', 'modern', 'old', 'young'
]);

// Words that are typically proper nouns (names, titles, etc.)
const PROPER_NOUN_INDICATORS = new Set([
  'maxwell', 'smith', 'johnson', 'williams', 'brown', 'jones', 'garcia', 'miller',
  'zhang', 'wang', 'li', 'liu', 'chen', 'yang', 'huang', 'zhao', 'wu', 'zhou',
  'alex', 'john', 'mary', 'james', 'robert', 'michael', 'william', 'david',
  'wei', 'ming', 'jun', 'lei', 'feng', 'long', 'tian', 'yu', 'hao', 'xin'
]);

/**
 * Classifies a character name to determine the best matching strategy
 */
export type NameType = 'proper' | 'descriptive' | 'mixed';

export interface NameClassification {
  type: NameType;
  hasCommonWords: boolean;
  wordCount: number;
  isLikelyProperName: boolean;
}

/**
 * Classifies a character name based on its structure and content
 */
export function classifyName(fullName: string): NameClassification {
  const nameLower = fullName.toLowerCase().trim();
  const nameParts = nameLower.split(/\s+/).filter(part => part.length > 0);
  const wordCount = nameParts.length;
  
  // Check if name contains common words
  const hasCommonWords = nameParts.some(part => COMMON_WORDS.has(part));
  
  // Check if name parts look like proper nouns
  const properNounCount = nameParts.filter(part => 
    PROPER_NOUN_INDICATORS.has(part) || 
    /^[A-Z]/.test(part) || // Starts with capital (in original)
    part.length <= 4 // Short words are often names
  ).length;
  
  const isLikelyProperName = properNounCount >= wordCount / 2;
  
  // Determine type
  let type: NameType;
  if (wordCount === 1) {
    // Single word names - check if it's a common word
    type = COMMON_WORDS.has(nameLower) ? 'descriptive' : 'proper';
  } else if (hasCommonWords && !isLikelyProperName) {
    // Has common words and doesn't look like a proper name
    type = 'descriptive';
  } else if (!hasCommonWords && isLikelyProperName) {
    // No common words and looks like proper name
    type = 'proper';
  } else {
    // Mixed case
    type = 'mixed';
  }
  
  return {
    type,
    hasCommonWords,
    wordCount,
    isLikelyProperName
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Creates a regex pattern for matching a name with word boundaries
 */
function createWordBoundaryPattern(name: string): RegExp {
  const escaped = escapeRegex(name);
  // Use word boundaries to match whole words only
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

/**
 * Gets name variations to search for based on name classification
 */
export interface NameMatchStrategy {
  patterns: RegExp[];
  variations: string[];
  requireFullMatch: boolean;
}

export function getNameMatchStrategy(fullName: string): NameMatchStrategy {
  const classification = classifyName(fullName);
  const nameLower = fullName.toLowerCase().trim();
  const nameParts = nameLower.split(/\s+/).filter(part => part.length > 0);
  
  const patterns: RegExp[] = [];
  const variations: string[] = [];
  
  // Always include full name with word boundaries
  patterns.push(createWordBoundaryPattern(fullName));
  variations.push(nameLower);
  
  // For proper names or mixed names, allow first/last name matching
  if (classification.type === 'proper' || classification.type === 'mixed') {
    if (nameParts.length > 1) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      
      // Only add first name if it's not a common word
      if (!COMMON_WORDS.has(firstName) && firstName.length >= 2) {
        patterns.push(createWordBoundaryPattern(firstName));
        variations.push(firstName);
      }
      
      // Only add last name if it's different from first name and not a common word
      if (lastName !== firstName && !COMMON_WORDS.has(lastName) && lastName.length >= 2) {
        patterns.push(createWordBoundaryPattern(lastName));
        variations.push(lastName);
      }
    }
  }
  
  // For descriptive names, require full name match (already added above)
  // But also check if any individual word is unique enough
  if (classification.type === 'descriptive' && nameParts.length > 1) {
    // For descriptive names, we might allow matching on unique words
    // But only if they're not common words and are long enough to be distinctive
    for (const part of nameParts) {
      if (!COMMON_WORDS.has(part) && part.length >= 5) {
        // Only allow longer, unique words from descriptive names
        patterns.push(createWordBoundaryPattern(part));
        variations.push(part);
      }
    }
  }
  
  return {
    patterns,
    variations,
    requireFullMatch: classification.type === 'descriptive'
  };
}

/**
 * Checks if text contains a character name using smart matching
 */
export function textContainsCharacterName(text: string, fullName: string): boolean {
  if (!text || !fullName) return false;
  
  const strategy = getNameMatchStrategy(fullName);
  const textLower = text.toLowerCase();
  
  // Try regex patterns first (word boundary matching)
  for (const pattern of strategy.patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Fallback: check variations (but only for proper names)
  // This handles cases where word boundaries might not work perfectly
  if (strategy.requireFullMatch) {
    // For descriptive names, only accept full name match
    return textLower.includes(fullName.toLowerCase());
  } else {
    // For proper names, check variations
    return strategy.variations.some(variation => textLower.includes(variation));
  }
}

/**
 * Gets all name variations for a character (for display/debugging purposes)
 */
export function getNameVariations(fullName: string): string[] {
  const strategy = getNameMatchStrategy(fullName);
  return strategy.variations;
}

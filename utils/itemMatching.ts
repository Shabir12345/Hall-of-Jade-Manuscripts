/**
 * Fuzzy name matching utility for items and techniques
 * Provides intelligent deduplication by matching similar names
 */

/**
 * Normalizes a name for fuzzy matching
 * - Lowercases the text
 * - Trims whitespace
 * - Removes punctuation and special characters
 * - Handles common variants (e.g., "Jade Slip" vs "jade-slip" vs "JadeSlip")
 */
export function normalizeName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\s/g, ''); // Remove all spaces for exact matching
}

/**
 * Calculates Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to transform one string into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create a matrix
  const matrix: number[][] = [];
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // Deletion
        matrix[i][j - 1] + 1,     // Insertion
        matrix[i - 1][j - 1] + cost // Substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculates similarity score between two strings (0-1, where 1 is identical)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeName(str1);
  const normalized2 = normalizeName(str2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }
  
  // If one is empty, return 0
  if (!normalized1 || !normalized2) {
    return 0;
  }
  
  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  
  // Similarity is inverse of normalized distance
  return 1 - (distance / maxLength);
}

/**
 * Match result with confidence score
 */
export interface MatchResult<T> {
  match: T | null;
  confidence: number;
  isExactMatch: boolean;
}

/**
 * Finds the best matching item/technique by name similarity
 * @param name - The name to search for
 * @param existingItems - Array of existing items/techniques to search in
 * @param getName - Function to extract the name from an item
 * @param threshold - Minimum similarity threshold (default 0.85 = 85%)
 * @returns MatchResult with the best match or null if no match above threshold
 */
export function findBestMatch<T>(
  name: string,
  existingItems: T[],
  getName: (item: T) => string,
  threshold: number = 0.85
): MatchResult<T> {
  if (!name || existingItems.length === 0) {
    return { match: null, confidence: 0, isExactMatch: false };
  }
  
  const normalizedSearchName = normalizeName(name);
  let bestMatch: T | null = null;
  let bestConfidence = 0;
  let isExactMatch = false;
  
  for (const item of existingItems) {
    const itemName = getName(item);
    const normalizedItemName = normalizeName(itemName);
    
    // Check for exact match after normalization
    if (normalizedSearchName === normalizedItemName) {
      return {
        match: item,
        confidence: 1.0,
        isExactMatch: true
      };
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(name, itemName);
    
    if (similarity > bestConfidence) {
      bestConfidence = similarity;
      bestMatch = item;
    }
  }
  
  // Only return match if confidence is above threshold
  if (bestConfidence >= threshold) {
    return {
      match: bestMatch,
      confidence: bestConfidence,
      isExactMatch: false
    };
  }
  
  return { match: null, confidence: bestConfidence, isExactMatch: false };
}

/**
 * Checks if two names likely refer to the same item/technique
 * @param name1 - First name
 * @param name2 - Second name
 * @param threshold - Similarity threshold (default 0.85)
 * @returns true if names are similar enough to be considered the same
 */
export function isLikelySame(name1: string, name2: string, threshold: number = 0.85): boolean {
  if (!name1 || !name2) return false;
  
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return true;
  }
  
  // Check similarity
  const similarity = calculateSimilarity(name1, name2);
  return similarity >= threshold;
}

/**
 * Generates a canonical name for an item/technique
 * Uses the first occurrence's normalized name as canonical
 * If a more "authoritative" name is found later, it can be updated
 */
export function generateCanonicalName(name: string): string {
  return normalizeName(name);
}

/**
 * Checks if one name is more "authoritative" than another
 * More specific or longer names are considered more authoritative
 */
export function isMoreAuthoritative(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);
  
  // Prefer longer names (more specific)
  if (norm1.length > norm2.length) {
    return true;
  }
  
  // Prefer original case over all lowercase (if not normalized)
  if (name1 !== name1.toLowerCase() && name2 === name2.toLowerCase()) {
    return true;
  }
  
  return false;
}

/**
 * Grand Saga Analyzer
 * 
 * Extracts character names and key information from Grand Saga text
 * to ensure proper context propagation in arc planning and chapter generation.
 * 
 * Enhanced with entity type detection to avoid false positives (locations, professions).
 */

import type { Character, NovelState } from '../types';

export interface ExtractedCharacter {
  name: string;
  confidence: number;
  context: string; // The sentence or phrase where the character was mentioned
}

/**
 * Common words to exclude from character name extraction
 */
const EXCLUDED_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
  'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
  'he', 'she', 'it', 'they', 'we', 'you', 'i', 'me', 'him', 'her', 'us', 'them',
  'his', 'her', 'its', 'their', 'our', 'your', 'my', 'mine', 'yours', 'hers', 'theirs',
  'world', 'cultivation', 'power', 'strength', 'journey', 'path',
  'destiny', 'fate', 'secret', 'mystery', 'ancient', 'legend', 'myth', 'story', 'tale',
  'beginning', 'end', 'middle', 'chapter', 'arc', 'novel', 'epic', 'saga'
]);

/**
 * Location keywords that indicate a place, not a character
 */
const LOCATION_KEYWORDS = new Set([
  'pits', 'location', 'realm', 'sect', 'temple', 'palace', 'city', 'village',
  'mountain', 'forest', 'desert', 'valley', 'cave', 'tower', 'fortress',
  'kingdom', 'empire', 'region', 'area', 'land', 'territory', 'domain',
  'sanctuary', 'shrine', 'monastery', 'academy', 'school', 'clan', 'guild',
  'dungeon', 'ruins', 'tomb', 'grave', 'cemetery', 'market', 'shop', 'inn',
  'tavern', 'barracks', 'castle', 'manor', 'estate', 'villa', 'mansion',
  'plains', 'hills', 'peaks', 'lake', 'river', 'sea', 'ocean', 'island',
  'archipelago', 'peninsula', 'coast', 'shore', 'beach', 'port', 'harbor',
  'gate', 'bridge', 'road', 'path', 'trail', 'way', 'street', 'alley'
]);

/**
 * Location prepositions that suggest the following word is a location
 */
const LOCATION_PREPOSITIONS = new Set([
  'in', 'at', 'from', 'to', 'within', 'inside', 'outside', 'near', 'beside',
  'beyond', 'through', 'across', 'around', 'along', 'into', 'onto', 'upon',
  'toward', 'towards', 'via', 'throughout', 'amid', 'amidst', 'among', 'amongst'
]);

/**
 * Profession words that are typically not character names when used as professions
 */
const PROFESSION_WORDS = new Set([
  'alchemist', 'blacksmith', 'merchant', 'guard', 'cultivator', 'warrior',
  'scholar', 'priest', 'monk', 'hermit', 'wanderer', 'hunter', 'farmer',
  'artisan', 'craftsman', 'smith', 'tailor', 'cook', 'chef', 'baker',
  'innkeeper', 'bartender', 'servant', 'maid', 'butler', 'steward',
  'scribe', 'librarian', 'teacher', 'instructor', 'trainer', 'coach',
  'healer', 'doctor', 'physician', 'apothecary', 'herbalist'
]);

/**
 * Character action verbs that suggest the following word is a character
 */
const CHARACTER_ACTION_VERBS = new Set([
  'met', 'fought', 'spoke', 'helped', 'betrayed', 'saved', 'killed', 'defeated',
  'befriended', 'allied', 'opposed', 'confronted', 'challenged', 'taught',
  'learned', 'trained', 'guided', 'protected', 'rescued', 'abandoned',
  'loved', 'hated', 'feared', 'respected', 'admired', 'envied', 'trusted',
  'distrusted', 'followed', 'led', 'commanded', 'obeyed', 'served'
]);

/**
 * Character relationship words
 */
const CHARACTER_RELATIONSHIP_WORDS = new Set([
  'friend', 'enemy', 'mentor', 'student', 'master', 'disciple', 'apprentice',
  'ally', 'rival', 'companion', 'partner', 'brother', 'sister', 'father',
  'mother', 'son', 'daughter', 'uncle', 'aunt', 'cousin', 'nephew', 'niece',
  'lover', 'spouse', 'wife', 'husband', 'fiancé', 'fiancée'
]);

/**
 * Titles and prefixes that might precede character names
 */
const CHARACTER_INDICATORS = [
  'protagonist', 'hero', 'heroine', 'villain', 'antagonist', 'mentor', 'master',
  'disciple', 'elder', 'young', 'old', 'ancient', 'legendary', 'famous', 'notorious',
  'prince', 'princess', 'emperor', 'empress', 'king', 'queen', 'lord', 'lady',
  'sect master', 'clan head', 'elder', 'disciple', 'student', 'teacher'
];

/**
 * Track recently created characters to prevent immediate duplicates
 * Key: character name (lowercase), Value: timestamp
 */
const recentlyCreatedCharacters = new Map<string, number>();
const RECENT_CREATION_WINDOW = 5 * 60 * 1000; // 5 minutes

/**
 * Checks if a name exists in any entity type (characters, territories, realms, world entries)
 */
function isExistingEntity(
  name: string,
  state: NovelState
): {
  isCharacter: boolean;
  isTerritory: boolean;
  isRealm: boolean;
  isWorldEntry: boolean;
} {
  const nameLower = name.toLowerCase().trim();
  
  const isCharacter = state.characterCodex.some(
    c => c.name.toLowerCase().trim() === nameLower
  );
  
  const isTerritory = state.territories.some(
    t => t.name.toLowerCase().trim() === nameLower
  );
  
  const isRealm = state.realms.some(
    r => r.name.toLowerCase().trim() === nameLower
  );
  
  const isWorldEntry = state.worldBible.some(
    w => w.title.toLowerCase().trim() === nameLower
  );
  
  return { isCharacter, isTerritory, isRealm, isWorldEntry };
}

/**
 * Analyzes context around a potential name to determine if it's a location, profession, or character
 */
function analyzeEntityContext(
  name: string,
  sentence: string,
  wordIndex: number,
  words: string[]
): {
  isLocation: boolean;
  isProfession: boolean;
  isCharacter: boolean;
  confidence: number;
} {
  const sentenceLower = sentence.toLowerCase();
  const nameLower = name.toLowerCase();
  const nameWords = nameLower.split(/\s+/);
  
  let isLocation = false;
  let isProfession = false;
  let isCharacter = false;
  let confidence = 0.5; // Base confidence
  
  // Check if name contains location keywords
  const hasLocationKeyword = nameWords.some(word => LOCATION_KEYWORDS.has(word));
  if (hasLocationKeyword) {
    isLocation = true;
    confidence -= 0.5;
  }
  
  // Check context before the name (3-5 words before)
  const contextStart = Math.max(0, wordIndex - 5);
  const contextBefore = words.slice(contextStart, wordIndex).map(w => w.toLowerCase());
  
  // Location indicators in context
  const hasLocationPreposition = contextBefore.some(w => LOCATION_PREPOSITIONS.has(w));
  const hasLocationKeywordInContext = contextBefore.some(w => LOCATION_KEYWORDS.has(w));
  if (hasLocationPreposition || hasLocationKeywordInContext) {
    isLocation = true;
    confidence -= 0.3;
  }
  
  // Check for location patterns: "in the X", "at the X", "from X", "to X"
  const prevWords = contextBefore.slice(-3).join(' ');
  if (prevWords.match(/\b(in|at|from|to|within|inside|outside|near|beside)\s+(the\s+)?/)) {
    isLocation = true;
    confidence -= 0.4;
  }
  
  // Profession indicators
  const isProfessionWord = PROFESSION_WORDS.has(nameWords[0]);
  const hasArticleBefore = contextBefore.slice(-2).some(w => ['a', 'an', 'the'].includes(w));
  if (isProfessionWord && hasArticleBefore) {
    isProfession = true;
    confidence -= 0.4;
  }
  
  // If it's a single word that's a profession and appears with article, likely profession
  if (nameWords.length === 1 && isProfessionWord && hasArticleBefore) {
    isProfession = true;
    confidence -= 0.5;
  }
  
  // Character indicators
  const hasCharacterIndicator = contextBefore.some(w => 
    CHARACTER_INDICATORS.some(indicator => w.includes(indicator))
  );
  if (hasCharacterIndicator) {
    isCharacter = true;
    confidence += 0.4;
  }
  
  // Character action verbs nearby
  const contextAfter = words.slice(wordIndex + nameWords.length, wordIndex + nameWords.length + 5)
    .map(w => w.toLowerCase());
  const hasCharacterActionVerb = contextBefore.some(w => CHARACTER_ACTION_VERBS.has(w)) ||
                                  contextAfter.some(w => CHARACTER_ACTION_VERBS.has(w));
  if (hasCharacterActionVerb) {
    isCharacter = true;
    confidence += 0.3;
  }
  
  // Personal pronouns nearby suggest character
  const allContext = [...contextBefore, ...contextAfter];
  const hasPersonalPronoun = allContext.some(w => 
    ['he', 'she', 'his', 'her', 'him', 'hers'].includes(w)
  );
  if (hasPersonalPronoun) {
    isCharacter = true;
    confidence += 0.2;
  }
  
  // Character relationship words
  const hasRelationshipWord = allContext.some(w => CHARACTER_RELATIONSHIP_WORDS.has(w));
  if (hasRelationshipWord) {
    isCharacter = true;
    confidence += 0.2;
  }
  
  // Two-word names are more likely to be characters (common pattern: "Li Wei", "Zhang Sanfeng")
  if (nameWords.length === 2 && !hasLocationKeyword) {
    confidence += 0.2;
    isCharacter = true;
  }
  
  // Three-word names are possible but less common (might be titles + name)
  if (nameWords.length === 3) {
    confidence += 0.1;
  }
  
  // Sentence structure analysis
  // "X went to Y" → Y is location
  if (sentenceLower.match(/\b(went|traveled|journeyed|ventured|headed)\s+(to|toward|towards|into)\s+/)) {
    const afterVerb = sentenceLower.split(/\b(went|traveled|journeyed|ventured|headed)\s+(to|toward|towards|into)\s+/);
    if (afterVerb.length > 2 && afterVerb[afterVerb.length - 1].toLowerCase().includes(nameLower)) {
      isLocation = true;
      confidence -= 0.3;
    }
  }
  
  // "X met Y" → Y is character
  if (sentenceLower.match(/\b(met|encountered|fought|spoke|talked)\s+(with\s+)?/)) {
    const afterVerb = sentenceLower.split(/\b(met|encountered|fought|spoke|talked)\s+(with\s+)?/);
    if (afterVerb.length > 2 && afterVerb[afterVerb.length - 1].toLowerCase().includes(nameLower)) {
      isCharacter = true;
      confidence += 0.3;
    }
  }
  
  // Final determination
  if (isLocation && !isCharacter) {
    confidence = Math.max(0, confidence - 0.5); // Strongly reduce if it's a location
  }
  if (isProfession && nameWords.length === 1 && hasArticleBefore) {
    confidence = Math.max(0, confidence - 0.5); // Strongly reduce if it's a profession with article
  }
  
  return {
    isLocation: isLocation && !isCharacter,
    isProfession: isProfession && !isCharacter,
    isCharacter: isCharacter || (!isLocation && !isProfession && confidence >= 0.7),
    confidence: Math.max(0, Math.min(1.0, confidence))
  };
}

/**
 * Extracts potential character names from Grand Saga text
 * Uses multi-pass analysis with improved heuristics to avoid false positives
 */
export function extractCharactersFromGrandSaga(
  grandSaga: string,
  existingCharacters: Character[] = [],
  state?: NovelState // Optional state for cross-referencing
): ExtractedCharacter[] {
  if (!grandSaga || grandSaga.trim().length === 0) {
    return [];
  }

  const extracted: ExtractedCharacter[] = [];
  const existingNames = new Set(
    existingCharacters.map(c => c.name.toLowerCase().trim())
  );
  const seen = new Set<string>();

  // Split into sentences for better context
  const sentences = grandSaga
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  sentences.forEach(sentence => {
    const words = sentence.split(/\s+/);
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i].replace(/[.,!?;:()"'"]/g, '');
      
      // Skip if too short or not capitalized (unless it's part of a multi-word name)
      if (word.length < 2 || (word[0] !== word[0].toUpperCase() || word[0] === word[0].toLowerCase())) {
        continue;
      }

      // Skip if it's an excluded word
      if (EXCLUDED_WORDS.has(word.toLowerCase())) {
        continue;
      }

      // Try to find multi-word names (e.g., "Li Wei", "Zhang Sanfeng")
      let fullName = word;
      let nameLength = 1;
      
      // Look ahead for additional capitalized words that might be part of the name
      for (let j = i + 1; j < Math.min(i + 3, words.length); j++) {
        const nextWord = words[j].replace(/[.,!?;:()"'"]/g, '');
        if (nextWord.length >= 2 && 
            nextWord[0] === nextWord[0].toUpperCase() && 
            nextWord[0] !== nextWord[0].toLowerCase() &&
            !EXCLUDED_WORDS.has(nextWord.toLowerCase())) {
          fullName += ' ' + nextWord;
          nameLength++;
        } else {
          break;
        }
      }

      const nameLower = fullName.toLowerCase();
      
      // Skip if already seen or if it's an existing character name
      if (seen.has(nameLower) || existingNames.has(nameLower)) {
        continue;
      }

      // Pass 1: Check if it's an existing entity (territory, realm, world entry)
      if (state) {
        const existing = isExistingEntity(fullName, state);
        if (existing.isTerritory || existing.isRealm || existing.isWorldEntry) {
          // Definitely not a character - skip
          seen.add(nameLower);
          continue;
        }
      }

      // Pass 2: Analyze context to determine entity type
      const contextAnalysis = analyzeEntityContext(fullName, sentence, i, words);
      
      // Pass 3: Filter out locations and professions
      if (contextAnalysis.isLocation) {
        seen.add(nameLower);
        continue; // Skip locations
      }
      
      if (contextAnalysis.isProfession && contextAnalysis.confidence < 0.6) {
        seen.add(nameLower);
        continue; // Skip low-confidence professions
      }
      
      // Pass 4: Only include if it's likely a character with sufficient confidence
      // Minimum confidence threshold: 0.7 (raised from 0.5)
      if (contextAnalysis.isCharacter && contextAnalysis.confidence >= 0.7) {
        seen.add(nameLower);
        extracted.push({
          name: fullName,
          confidence: contextAnalysis.confidence,
          context: sentence.substring(0, 200) // First 200 chars of sentence for context
        });
      }
    }
  });

  // Sort by confidence (highest first)
  extracted.sort((a, b) => b.confidence - a.confidence);

  // Return top candidates (limit to 10 to avoid noise)
  return extracted.slice(0, 10);
}

/**
 * Gets characters mentioned in Grand Saga that exist in character codex
 */
export function getGrandSagaCharacters(
  state: NovelState
): Character[] {
  if (!state.grandSaga || state.grandSaga.trim().length === 0) {
    return [];
  }

  const extracted = extractCharactersFromGrandSaga(state.grandSaga, state.characterCodex, state);
  const grandSagaLower = state.grandSaga.toLowerCase();

  // Find matching characters in codex
  const matchingCharacters: Character[] = [];

  state.characterCodex.forEach(char => {
    const charNameLower = char.name.toLowerCase();
    
    // Check if character name appears in Grand Saga
    if (grandSagaLower.includes(charNameLower)) {
      matchingCharacters.push(char);
    } else {
      // Also check if any extracted name matches this character
      const extractedMatch = extracted.find(
        e => e.name.toLowerCase() === charNameLower
      );
      if (extractedMatch) {
        matchingCharacters.push(char);
      }
    }
  });

  return matchingCharacters;
}

/**
 * Gets all potential character names from Grand Saga (both in codex and not yet in codex)
 */
export function getAllGrandSagaCharacterNames(state: NovelState): {
  inCodex: Character[];
  notInCodex: ExtractedCharacter[];
} {
  const extracted = extractCharactersFromGrandSaga(state.grandSaga, state.characterCodex, state);
  const inCodex = getGrandSagaCharacters(state);
  
  const notInCodex: ExtractedCharacter[] = [];
  const codexNames = new Set(inCodex.map(c => c.name.toLowerCase()));

  extracted.forEach(extractedChar => {
    if (!codexNames.has(extractedChar.name.toLowerCase())) {
      notInCodex.push(extractedChar);
    }
  });

  return {
    inCodex,
    notInCodex: notInCodex.slice(0, 5) // Limit to top 5 not in codex
  };
}

/**
 * Creates Character objects for characters mentioned in Grand Saga but not yet in codex
 * Enhanced to check all entity types and prevent duplicates
 * Only creates characters with high confidence (>= 0.8) to avoid false positives
 */
export function createCharactersFromGrandSaga(
  state: NovelState,
  minConfidence: number = 0.8 // Raised from 0.7 to 0.8
): Character[] {
  if (!state.grandSaga || state.grandSaga.trim().length === 0) {
    return [];
  }

  const grandSagaData = getAllGrandSagaCharacterNames(state);
  const newCharacters: Character[] = [];
  const now = Date.now();

  // Clean up old entries from recently created tracking
  recentlyCreatedCharacters.forEach((timestamp, name) => {
    if (now - timestamp > RECENT_CREATION_WINDOW) {
      recentlyCreatedCharacters.delete(name);
    }
  });

  grandSagaData.notInCodex.forEach(extracted => {
    // Only create characters with sufficient confidence (raised to 0.8)
    if (extracted.confidence >= minConfidence) {
      const nameLower = extracted.name.toLowerCase().trim();
      
      // Check if character already exists in codex (case-insensitive)
      const existingChar = state.characterCodex.find(
        c => c.name.toLowerCase().trim() === nameLower
      );

      if (existingChar) {
        return; // Skip - already exists
      }

      // Check if it exists in any other entity type
      const existing = isExistingEntity(extracted.name, state);
      if (existing.isCharacter || existing.isTerritory || existing.isRealm || existing.isWorldEntry) {
        return; // Skip - exists as another entity type
      }

      // Check if it was recently created (prevent rapid duplicates)
      const recentlyCreated = recentlyCreatedCharacters.get(nameLower);
      if (recentlyCreated && (now - recentlyCreated) < RECENT_CREATION_WINDOW) {
        return; // Skip - was recently created
      }

      // Create new character
      const newChar: Character = {
        id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Temporary ID, will be replaced
        name: extracted.name,
        isProtagonist: false, // User can mark as protagonist later
        age: 'Unknown',
        personality: extracted.context ? `Mentioned in Grand Saga: ${extracted.context.substring(0, 200)}` : 'Character mentioned in Grand Saga',
        currentCultivation: 'Unknown',
        skills: [],
        items: [],
        techniqueMasteries: [],
        itemPossessions: [],
        notes: `Automatically extracted from Grand Saga. Context: "${extracted.context || 'No context available'}"`,
        status: 'Alive',
        relationships: [],
      };
      
      newCharacters.push(newChar);
      // Track this creation to prevent immediate duplicates
      recentlyCreatedCharacters.set(nameLower, now);
    }
  });

  return newCharacters;
}

/**
 * Clears the recently created characters tracking (useful for testing or manual reset)
 */
export function clearRecentlyCreatedTracking(): void {
  recentlyCreatedCharacters.clear();
}

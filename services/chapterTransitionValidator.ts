import { Chapter, Character } from '../types';
import { extractChapterEnding } from './promptEngine/contextGatherer';
import { analyzeOpeningSentence, hasGoodOpening } from './openingSentenceAnalyzer';

/**
 * Chapter Transition Validator
 * Validates that new chapters flow smoothly from previous chapters
 */

export interface TransitionValidationResult {
  isValid: boolean;
  score: number; // 0-100
  issues: TransitionIssue[];
  warnings: string[];
  suggestions: string[];
}

export interface TransitionIssue {
  type: 'time_skip' | 'location_jump' | 'character_state_mismatch' | 'opening_cliche' | 'disconnected' | 'missing_reference';
  severity: 'high' | 'medium' | 'low';
  description: string;
  location: 'opening' | 'first_paragraph' | 'transition';
  suggestedFix?: string;
}

/**
 * Validates transition quality between two consecutive chapters
 */
export function validateChapterTransition(
  previousChapter: Chapter,
  newChapter: Chapter
): TransitionValidationResult {
  const issues: TransitionIssue[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  if (!previousChapter || !newChapter) {
    return {
      isValid: false,
      score: 0,
      issues: [{
        type: 'disconnected',
        severity: 'high',
        description: 'Missing previous or new chapter for validation',
        location: 'opening',
      }],
      warnings: [],
      suggestions: ['Ensure both chapters are provided for validation'],
    };
  }

  // Extract ending and beginning for analysis
  const previousEnding = extractChapterEnding(previousChapter, 300); // Last 300 words
  const newBeginning = newChapter.content.substring(0, Math.min(500, newChapter.content.length)); // First 500 chars
  const newBeginningLower = newBeginning.toLowerCase();
  const previousEndingLower = previousEnding.toLowerCase();

  // 1. Check for opening clichés
  const openingAnalysis = analyzeOpeningSentence(newChapter);
  if (openingAnalysis.isCliche) {
    issues.push({
      type: 'opening_cliche',
      severity: openingAnalysis.severity === 'high' ? 'high' : 'medium',
      description: `Opening sentence contains cliché: ${openingAnalysis.clicheType} - "${openingAnalysis.openingSentences[0]?.substring(0, 100)}"`,
      location: 'opening',
      suggestedFix: openingAnalysis.suggestions[0] || 'Rewrite opening to start with character action, dialogue, or thought',
    });
  }

  // Check if opening is good (character-focused) - only add as suggestion, not warning
  // This is a style preference, not a critical issue
  if (!hasGoodOpening(newChapter)) {
    suggestions.push('Consider making opening sentence more character-focused (action, dialogue, or thought)');
  }

  // 2. Check for time skips
  const timeSkipPatterns = [
    /\b(the\s+)?(next|following)\s+(morning|day|night|evening|afternoon)/i,
    /\b(hours?|days?|weeks?)\s+later/i,
    /\b(moments?|minutes?)\s+later/i,
    /\b(as|when)\s+(dawn|dusk|night|morning)\s+(broke|fell|came)/i,
    /\b(later\s+that\s+(day|night|morning|evening))/i,
  ];

  let timeSkipDetected = false;
  for (const pattern of timeSkipPatterns) {
    if (pattern.test(newBeginningLower)) {
      timeSkipDetected = true;
      issues.push({
        type: 'time_skip',
        severity: 'high',
        description: `Time skip detected in opening: "${newBeginning.split(/[.!?]+/)[0]?.substring(0, 100)}"`,
        location: 'opening',
        suggestedFix: 'Remove time skip and continue from the exact moment the previous chapter ended',
      });
      break;
    }
  }

  // 3. Check for location continuity (smarter check)
  const previousLocationIndicators = extractLocationIndicators(previousEndingLower);
  const newLocationIndicators = extractLocationIndicators(newBeginningLower);

  // Only flag location discontinuity if:
  // 1. Both have clear location indicators
  // 2. No time skip was detected (time skips can explain location changes)
  // 3. Locations are clearly different (not similar or generic)
  // 4. There's no mention of location transition in the new beginning
  if (previousLocationIndicators.length > 0 && newLocationIndicators.length > 0 && !timeSkipDetected) {
    const locationOverlap = previousLocationIndicators.filter(loc => 
      newLocationIndicators.some(newLoc => 
        newLoc.includes(loc) || loc.includes(newLoc) || 
        areSimilarLocations(loc, newLoc)
      )
    );

    // Check if there's a location transition mentioned (e.g., "headed to", "went back", "returned")
    const hasLocationTransition = /\b(headed|went|walked|traveled|returned|arrived|reached|entered|came|moved|went\s+back|headed\s+back|returned\s+to)\s+(to|back\s+to|at|in|into)?/i.test(newBeginning);

    // Only flag if there's no overlap AND no transition mentioned AND locations are specific (not generic)
    const previousIsGeneric = previousLocationIndicators.some(loc => 
      ['hut', 'room', 'hall', 'place'].some(gen => loc.toLowerCase().includes(gen))
    );
    const newIsGeneric = newLocationIndicators.some(loc => 
      ['hut', 'room', 'hall', 'place'].some(gen => loc.toLowerCase().includes(gen))
    );

    // If both are generic, they might be the same location - don't flag
    if (locationOverlap.length === 0 && !hasLocationTransition) {
      // Only flag if at least one location is specific (not both generic)
      if (!(previousIsGeneric && newIsGeneric)) {
        issues.push({
          type: 'location_jump',
          severity: 'high',
          description: `Location discontinuity: Previous chapter ended at ${previousLocationIndicators[0] || 'unknown location'}, new chapter starts at ${newLocationIndicators[0] || 'different location'}`,
          location: 'opening',
          suggestedFix: 'Add transition showing how the character moved locations, or continue in the same location',
        });
      }
    }
  }

  // 4. Check for character state continuity
  const previousCharacters = extractCharacterNames(previousEndingLower);
  const newCharacters = extractCharacterNames(newBeginningLower);

  if (previousCharacters.length > 0) {
    const characterOverlap = previousCharacters.filter(char =>
      newCharacters.some(newChar => newChar.includes(char) || char.includes(newChar))
    );

    if (characterOverlap.length === 0 && previousCharacters.length > 0) {
      warnings.push(`Main character(s) from previous chapter ending (${previousCharacters[0]}) not immediately mentioned in new chapter opening`);
    }
  }

  // 5. Check for reference to previous chapter's ending
  const endingKeyPhrases = extractKeyPhrases(previousEnding);
  const beginningKeyPhrases = extractKeyPhrases(newBeginning);
  
  const phraseOverlap = endingKeyPhrases.filter(phrase =>
    beginningKeyPhrases.some(bp => bp.includes(phrase) || phrase.includes(bp))
  );

  // Only flag missing reference if there's ZERO overlap AND no character continuation
  // Relaxed threshold: Changed from phraseOverlap < 2 to phraseOverlap === 0
  // Also check for character name continuation before flagging
  const hasCharacterOverlap = previousCharacters.length > 0 && newCharacters.some(nc => 
    previousCharacters.some(pc => nc.toLowerCase().includes(pc.toLowerCase()) || pc.toLowerCase().includes(nc.toLowerCase()))
  );
  
  if (endingKeyPhrases.length > 0 && phraseOverlap.length === 0 && !hasCharacterOverlap) {
    // Downgrade to low severity - this is a style suggestion, not a critical error
    issues.push({
      type: 'missing_reference',
      severity: 'low',
      description: 'New chapter opening does not clearly reference or continue from previous chapter\'s ending',
      location: 'opening',
      suggestedFix: 'Consider adding explicit reference to the previous chapter\'s ending situation',
    });
  }

  // 6. Check for disconnected opening (no clear connection)
  if (issues.filter(i => i.type === 'disconnected').length === 0) {
    // Check if opening seems completely disconnected
    const hasTransitionWords = /\b(but|however|meanwhile|then|next|as|when|while|still|yet|finally)/i.test(newBeginningLower);
    const hasCharacterContinuation = previousCharacters.length > 0 && newCharacters.some(nc => previousCharacters.some(pc => nc.includes(pc) || pc.includes(nc)));
    
    if (!hasTransitionWords && !hasCharacterContinuation && !phraseOverlap.length && previousCharacters.length > 0) {
      issues.push({
        type: 'disconnected',
        severity: 'high',
        description: 'Opening appears disconnected from previous chapter - no clear continuation',
        location: 'opening',
        suggestedFix: 'Add explicit continuation from previous chapter\'s ending or reference to what just happened',
      });
    }
  }

  // Calculate score (0-100)
  // Adjusted to be less punishing - only truly critical issues significantly impact score
  let score = 100;
  issues.forEach(issue => {
    if (issue.severity === 'high') score -= 20; // Reduced from 30
    else if (issue.severity === 'medium') score -= 10; // Reduced from 15
    else score -= 3; // Reduced from 5 for low severity
  });
  score = Math.max(0, score);

  // Generate suggestions
  if (issues.length === 0 && warnings.length === 0) {
    suggestions.push('Transition quality is good - smooth flow between chapters');
  } else {
    if (issues.some(i => i.type === 'time_skip')) {
      suggestions.push('Continue from the exact moment the previous chapter ended - no time skip');
    }
    if (issues.some(i => i.type === 'location_jump')) {
      suggestions.push('Add transition text showing how character moved locations, or stay in same location');
    }
    if (issues.some(i => i.type === 'opening_cliche')) {
      suggestions.push('Rewrite opening to avoid clichés - start with character action, dialogue, or thought');
    }
    if (issues.some(i => i.type === 'missing_reference')) {
      suggestions.push('Reference the previous chapter\'s ending directly in the opening');
    }
  }

  return {
    isValid: score >= 70 && issues.filter(i => i.severity === 'high').length === 0,
    score,
    issues,
    warnings,
    suggestions,
  };
}

/**
 * Helper functions
 */
function extractLocationIndicators(text: string): string[] {
  const locations: string[] = [];
  
  // Spatial prepositions that indicate actual location mentions
  const spatialPrepositions = /\b(at|in|inside|outside|near|beside|within|beyond|toward|towards|into|onto|upon|within)\s+/gi;
  
  // Location type patterns - must be preceded by spatial context
  const locationPatterns = [
    // Pattern 1: "at/in [adjective] [location type]" (e.g., "in the training hall")
    /\b(at|in|inside|outside|near|beside|within)\s+(the\s+)?([a-z]+(?:\s+[a-z]+){0,3})\s+(grounds?|hall|chamber|room|tower|peak|palace|temple|forest|mountain|city|village|sect|realm|domain)/gi,
    // Pattern 2: "at/in [location type]" (e.g., "at the square")
    /\b(at|in|inside)\s+(the\s+)?([a-z]+(?:\s+[a-z]+){0,2})\s+(square|courtyard|entrance|exit|library|training\s+ground|field|garden|arena|plaza)/gi,
    // Pattern 3: "in [location]" without "the" (e.g., "in Azure Dragon Sect")
    /\b(in|at|inside)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})\s+(Sect|Realm|Domain|Palace|Temple|City|Village|Hall|Grounds)/g,
  ];

  locationPatterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      // Extract the location descriptor (the part between preposition and location type)
      const location = (match[3] || match[2])?.trim();
      if (location && location.length > 2 && location.length < 50) {
        // Check if this looks like a real location (not a metaphorical use)
        if (!isMetaphoricalLocation(location, match[0] || '', text)) {
          locations.push(location);
        }
      }
    }
  });

  // Check for common location words ONLY when they appear in spatial contexts
  const commonLocationWords = ['hut', 'room', 'square', 'courtyard', 'hall', 'training ground', 'forest', 'mountain'];
  commonLocationWords.forEach(loc => {
    // Only match if it appears with spatial prepositions nearby (within 20 chars)
    const locIndex = text.indexOf(loc);
    if (locIndex >= 0) {
      const beforeText = text.substring(Math.max(0, locIndex - 30), locIndex).toLowerCase();
      const afterText = text.substring(locIndex, Math.min(text.length, locIndex + loc.length + 30)).toLowerCase();
      
      // Check if location word appears in a spatial context
      const hasSpatialContext = spatialPrepositions.test(beforeText) || 
                                 /\b(the|his|her|their|this|that)\s+/.test(beforeText) ||
                                 /\b(entered|reached|arrived|left|went|walked|headed|returned|came)\s+(to|at|in|into|back\s+to)?\s*(the\s+)?/.test(beforeText);
      
      // Also check for metaphorical uses (e.g., "azure cloud", "cloud of dust")
      const isMetaphorical = /\b(azure|digital|computing|of\s+(dust|smoke|debris))\s+(cloud|clouds)/i.test(text) ||
                            /\bcloud\s+(of|above|over)/i.test(text);
      
      if (hasSpatialContext && !isMetaphorical) {
        locations.push(loc);
      }
    }
  });

  return [...new Set(locations)];
}

/**
 * Checks if a location mention is metaphorical rather than actual spatial location
 */
function isMetaphoricalLocation(location: string, fullMatch: string, context: string): boolean {
  const locationLower = location.toLowerCase();
  
  // Common metaphorical uses
  const metaphoricalPatterns = [
    /\b(azure|digital|computing|the)\s+cloud/gi, // "azure cloud", "the cloud" (computing)
    /\bcloud\s+(of|above|over|hanging)/gi, // "cloud of dust", "cloud above"
    /\bentire\s+azure\s+cloud/gi, // "entire azure cloud" (metaphorical/descriptive)
    /\b(shadow|darkness|light|mist|fog)\s+(of|over|above)/gi,
  ];
  
  // Check if the full match or context contains metaphorical patterns
  const checkText = fullMatch + ' ' + context.substring(Math.max(0, context.indexOf(fullMatch) - 50), Math.min(context.length, context.indexOf(fullMatch) + 200));
  
  for (const pattern of metaphoricalPatterns) {
    if (pattern.test(checkText)) {
      return true;
    }
  }
  
  // Check if "cloud" is used without spatial context (likely metaphorical)
  if (locationLower.includes('cloud')) {
    const cloudIndex = context.toLowerCase().indexOf(locationLower);
    if (cloudIndex >= 0) {
      const beforeCloud = context.substring(Math.max(0, cloudIndex - 20), cloudIndex).toLowerCase();
      // If "cloud" appears without "in the", "at the", "near the", etc., it's likely metaphorical
      if (!/\b(in|at|near|beside|within|inside)\s+(the\s+)?/.test(beforeCloud)) {
        return true;
      }
    }
  }
  
  return false;
}

function extractCharacterNames(text: string): string[] {
  // Extract capitalized words that might be character names
  const words = text.split(/\s+/);
  const names: string[] = [];
  
  // Look for capitalized words (likely character names)
  words.forEach(word => {
    const clean = word.replace(/[^\w]/g, '');
    if (clean.length > 2 && /^[A-Z][a-z]+$/.test(clean)) {
      names.push(clean);
    }
  });

  return [...new Set(names)].slice(0, 5); // Limit to avoid false positives
}

function extractKeyPhrases(text: string): string[] {
  // Extract meaningful phrases (3-5 words) for comparison
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const phrases: string[] = [];
  
  for (let i = 0; i < words.length - 2; i++) {
    phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  
  return phrases.slice(-10); // Last 10 phrases
}

function areSimilarLocations(loc1: string, loc2: string): boolean {
  // Normalize locations for comparison
  const normalized1 = loc1.toLowerCase().replace(/\s+/g, '').trim();
  const normalized2 = loc2.toLowerCase().replace(/\s+/g, '').trim();
  
  // Exact match or substring match
  if (normalized1 === normalized2 || 
      normalized1.includes(normalized2) || 
      normalized2.includes(normalized1)) {
    return true;
  }
  
  // Length similarity check (for similar-length names)
  if (normalized1.length > 0 && normalized2.length > 0) {
    const lengthRatio = Math.min(normalized1.length, normalized2.length) / Math.max(normalized1.length, normalized2.length);
    if (lengthRatio > 0.7 && lengthRatio < 1.3) {
      // Check if they share common words or patterns
      const words1 = loc1.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const words2 = loc2.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      const commonWords = words1.filter(w => words2.includes(w));
      if (commonWords.length > 0) {
        return true; // They share significant words
      }
    }
  }
  
  // Check for synonym-like locations (e.g., "hut" vs "room", "hall" vs "chamber")
  const locationSynonyms: Record<string, string[]> = {
    'hut': ['room', 'chamber', 'quarters', 'lodging'],
    'room': ['hut', 'chamber', 'quarters', 'lodging'],
    'chamber': ['room', 'hut', 'quarters', 'lodging'],
    'hall': ['chamber', 'room', 'audience chamber'],
    'square': ['courtyard', 'plaza', 'grounds'],
    'courtyard': ['square', 'plaza', 'grounds'],
    'training ground': ['training hall', 'practice yard', 'courtyard'],
    'forest': ['woods', 'woodland', 'grove'],
  };
  
  const loc1Lower = loc1.toLowerCase();
  const loc2Lower = loc2.toLowerCase();
  
  // Check if locations are synonyms
  for (const [key, synonyms] of Object.entries(locationSynonyms)) {
    if ((loc1Lower === key || loc1Lower.includes(key)) && 
        synonyms.some(syn => loc2Lower === syn || loc2Lower.includes(syn))) {
      return true;
    }
    if ((loc2Lower === key || loc2Lower.includes(key)) && 
        synonyms.some(syn => loc1Lower === syn || loc1Lower.includes(syn))) {
      return true;
    }
  }
  
  // If one location is very generic and the other is specific, they might be related
  // (e.g., "hut" is generic, but could be "his hut" which relates to the same location)
  const genericLocations = ['hut', 'room', 'hall', 'place'];
  const isLoc1Generic = genericLocations.some(gen => loc1Lower === gen || loc1Lower.includes(gen));
  const isLoc2Generic = genericLocations.some(gen => loc2Lower === gen || loc2Lower.includes(gen));
  
  // If both are generic or one is generic and contexts are similar, they might be the same
  if (isLoc1Generic && isLoc2Generic) {
    return true; // Both generic, likely same location
  }
  
  return false;
}

/**
 * Quick check if a chapter has a good transition from previous chapter
 * Returns true if transition quality is acceptable (score >= 70)
 */
export function hasGoodTransition(
  previousChapter: Chapter | null,
  newChapter: Chapter
): boolean {
  if (!previousChapter) {
    return true; // First chapter has no transition to validate
  }
  
  try {
    const validation = validateChapterTransition(previousChapter, newChapter);
    return validation.isValid && validation.score >= 70;
  } catch (error) {
    console.warn('[Transition Check] Error validating transition:', error);
    return true; // Default to true on error to not block generation
  }
}

/**
 * Fuzzy name matching utility for antagonists
 * Provides intelligent deduplication by matching similar names
 * Similar to itemMatching.ts but optimized for antagonist names
 */

import { Antagonist } from '../types';
import { normalizeName, calculateSimilarity, findBestMatch, isLikelySame } from './itemMatching';

export interface AntagonistMatchResult {
  antagonist: Antagonist | null;
  wasCreated: boolean;
  similarity: number;
}

/**
 * Normalize antagonist name for matching
 * Handles common variations in antagonist names
 */
export function normalizeAntagonistName(name: string): string {
  return normalizeName(name);
}

/**
 * Find existing antagonist by fuzzy matching
 * Returns the best match if similarity is above threshold
 */
export function findMatchingAntagonist(
  name: string,
  existingAntagonists: Antagonist[],
  threshold: number = 0.85
): AntagonistMatchResult {
  if (!name || !name.trim()) {
    return { antagonist: null, wasCreated: false, similarity: 0 };
  }

  const trimmedName = name.trim();
  const normalizedName = normalizeAntagonistName(trimmedName);

  // First try exact match (case-insensitive)
  const exactMatch = existingAntagonists.find(a => 
    a.name.toLowerCase() === trimmedName.toLowerCase() ||
    normalizeAntagonistName(a.name) === normalizedName
  );

  if (exactMatch) {
    return { antagonist: exactMatch, wasCreated: false, similarity: 1.0 };
  }

  // Try fuzzy matching using itemMatching utility
  const matchResult = findBestMatch(
    trimmedName,
    existingAntagonists,
    (ant) => ant.name,
    threshold
  );

  if (matchResult.match) {
    return {
      antagonist: matchResult.match,
      wasCreated: false,
      similarity: matchResult.confidence
    };
  }

  return { antagonist: null, wasCreated: false, similarity: matchResult.confidence };
}

/**
 * Check if two antagonist names likely refer to the same antagonist
 * Uses fuzzy matching with configurable threshold
 */
export function isLikelySameAntagonist(
  name1: string,
  name2: string,
  threshold: number = 0.85
): boolean {
  return isLikelySame(name1, name2, threshold);
}

/**
 * Generate a canonical name for an antagonist
 * Used for consistent identification across chapters
 */
export function generateAntagonistCanonicalName(name: string): string {
  return normalizeAntagonistName(name);
}

/**
 * Check if a new antagonist name is more authoritative than existing
 * For example, "The Dark Lord" is more authoritative than "dark lord"
 */
export function isMoreAuthoritativeAntagonistName(
  newName: string,
  existingName: string
): boolean {
  // Names with titles/articles are more authoritative
  const hasTitle = /\b(the|a|an|lord|master|emperor|king|queen|prince|princess|duke|duchess)\b/i.test(newName);
  const existingHasTitle = /\b(the|a|an|lord|master|emperor|king|queen|prince|princess|duke|duchess)\b/i.test(existingName);
  
  if (hasTitle && !existingHasTitle) return true;
  if (!hasTitle && existingHasTitle) return false;
  
  // Longer names are often more authoritative
  if (newName.length > existingName.length + 5) return true;
  if (existingName.length > newName.length + 5) return false;
  
  // Capitalized names are more authoritative
  const newStartsWithCap = /^[A-Z]/.test(newName);
  const existingStartsWithCap = /^[A-Z]/.test(existingName);
  
  if (newStartsWithCap && !existingStartsWithCap) return true;
  
  return false;
}

/**
 * Merge antagonist information intelligently
 * Combines information from multiple references to the same antagonist
 */
export function mergeAntagonistInfo(
  existing: Antagonist,
  updates: Partial<Antagonist>
): Antagonist {
  // Merge descriptions (append if different)
  let mergedDescription = existing.description;
  if (updates.description && updates.description.trim() && 
      !existing.description.includes(updates.description)) {
    if (mergedDescription) {
      mergedDescription += ` ${updates.description}`;
    } else {
      mergedDescription = updates.description;
    }
  }

  // Merge motivations (append if different)
  let mergedMotivation = existing.motivation;
  if (updates.motivation && updates.motivation.trim() &&
      !existing.motivation.includes(updates.motivation)) {
    if (mergedMotivation) {
      mergedMotivation += ` ${updates.motivation}`;
    } else {
      mergedMotivation = updates.motivation;
    }
  }

  // Merge notes (append with chapter reference)
  let mergedNotes = existing.notes;
  if (updates.notes && updates.notes.trim()) {
    if (mergedNotes) {
      mergedNotes += `\n[Update]: ${updates.notes}`;
    } else {
      mergedNotes = updates.notes;
    }
  }

  // Update name if new one is more authoritative
  let finalName = existing.name;
  if (updates.name && isMoreAuthoritativeAntagonistName(updates.name, existing.name)) {
    finalName = updates.name;
  }

  // Update status - prefer more specific statuses
  let finalStatus = existing.status;
  if (updates.status) {
    // Active > hinted > dormant for active antagonists
    if (existing.status === 'hinted' && updates.status === 'active') {
      finalStatus = 'active';
    } else if (existing.status === 'dormant' && (updates.status === 'active' || updates.status === 'hinted')) {
      finalStatus = updates.status;
    } else if (updates.status !== existing.status) {
      // If status changed significantly, use new status
      finalStatus = updates.status;
    }
  }

  // Update threat level - use higher threat
  let finalThreatLevel = existing.threatLevel;
  if (updates.threatLevel) {
    const threatOrder: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'extreme': 4
    };
    if (threatOrder[updates.threatLevel] > threatOrder[existing.threatLevel]) {
      finalThreatLevel = updates.threatLevel;
    }
  }

  // Update power level if provided and different
  let finalPowerLevel = existing.powerLevel;
  if (updates.powerLevel && updates.powerLevel.trim() && 
      updates.powerLevel !== existing.powerLevel) {
    finalPowerLevel = updates.powerLevel;
  }

  return {
    ...existing,
    name: finalName,
    description: mergedDescription,
    motivation: mergedMotivation,
    powerLevel: finalPowerLevel,
    status: finalStatus,
    threatLevel: finalThreatLevel,
    notes: mergedNotes,
    lastAppearedChapter: updates.lastAppearedChapter || existing.lastAppearedChapter,
    updatedAt: Date.now()
  };
}

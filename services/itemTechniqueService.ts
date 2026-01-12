/**
 * Item and Technique Service
 * Provides core logic for finding/creating items and techniques with deduplication,
 * merging information, and tracking history across chapters.
 */

import { NovelItem, NovelTechnique, ItemCategory, TechniqueCategory, TechniqueType } from '../types';
import { findBestMatch, generateCanonicalName, isMoreAuthoritative } from '../utils/itemMatching';
import { validateItemName, validateTechniqueName, validateChapterNumber, validateDescription, validatePowersOrFunctions } from '../utils/itemTechniqueValidation';

/**
 * Find or create an item with fuzzy matching
 * If a matching item is found, updates it with new information
 * If no match, creates a new canonical item
 */
export function findOrCreateItem(
  name: string,
  existingItems: NovelItem[],
  novelId: string,
  category: ItemCategory,
  chapterNumber: number,
  description?: string,
  powers?: string[]
): { item: NovelItem; wasCreated: boolean } {
  // Validate inputs
  const nameValidation = validateItemName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error || 'Invalid item name');
  }
  
  const chapterValidation = validateChapterNumber(chapterNumber);
  if (!chapterValidation.valid) {
    throw new Error(chapterValidation.error || 'Invalid chapter number');
  }
  
  if (description !== undefined) {
    const descValidation = validateDescription(description);
    if (!descValidation.valid) {
      throw new Error(descValidation.error || 'Invalid description');
    }
  }
  
  if (powers !== undefined && powers.length > 0) {
    const powersValidation = validatePowersOrFunctions(powers, 'power');
    if (!powersValidation.valid) {
      throw new Error(powersValidation.error || 'Invalid powers array');
    }
  }

  const trimmedName = name.trim();
  const canonicalName = generateCanonicalName(trimmedName);

  // Try to find existing item by exact canonical name match first
  let existingItem = existingItems.find(
    item => item.canonicalName === canonicalName || item.name === trimmedName
  );

  // If no exact match, try fuzzy matching
  if (!existingItem) {
    const matchResult = findBestMatch(
      trimmedName,
      existingItems,
      (item) => item.name,
      0.85 // 85% similarity threshold
    );

    if (matchResult.match) {
      existingItem = matchResult.match;
      
      // If the new name is more authoritative, update the canonical name
      if (isMoreAuthoritative(trimmedName, existingItem.name)) {
        // Update will be handled by the caller
      }
    }
  }

  if (existingItem) {
    // Update existing item
    const updatedItem: NovelItem = {
      ...existingItem,
      // Update name if new one is more authoritative
      name: isMoreAuthoritative(trimmedName, existingItem.name) ? trimmedName : existingItem.name,
      canonicalName: canonicalName,
      // Update description if provided and longer/more detailed
      description: description && description.length > existingItem.description.length 
        ? description 
        : existingItem.description,
      // Merge powers (deduplicated)
      powers: mergePowers(existingItem.powers, powers || []),
      // Update history
      history: appendHistory(existingItem.history, chapterNumber, description || '', powers || []),
      // Update last referenced chapter
      lastReferencedChapter: Math.max(existingItem.lastReferencedChapter || 0, chapterNumber),
      updatedAt: Date.now()
    };

    return { item: updatedItem, wasCreated: false };
  }

  // Create new item
  const newItem: NovelItem = {
    id: crypto.randomUUID(),
    novelId,
    name: trimmedName,
    canonicalName,
    description: description || '',
    category,
    powers: powers || [],
    history: formatHistoryEntry(chapterNumber, description || '', powers || []),
    firstAppearedChapter: chapterNumber,
    lastReferencedChapter: chapterNumber,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return { item: newItem, wasCreated: true };
}

/**
 * Find or create a technique with fuzzy matching
 * If a matching technique is found, updates it with new information
 * If no match, creates a new canonical technique
 */
export function findOrCreateTechnique(
  name: string,
  existingTechniques: NovelTechnique[],
  novelId: string,
  category: TechniqueCategory,
  type: TechniqueType,
  chapterNumber: number,
  description?: string,
  functions?: string[]
): { technique: NovelTechnique; wasCreated: boolean } {
  // Validate inputs
  const nameValidation = validateTechniqueName(name);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error || 'Invalid technique name');
  }
  
  const chapterValidation = validateChapterNumber(chapterNumber);
  if (!chapterValidation.valid) {
    throw new Error(chapterValidation.error || 'Invalid chapter number');
  }
  
  if (description !== undefined) {
    const descValidation = validateDescription(description);
    if (!descValidation.valid) {
      throw new Error(descValidation.error || 'Invalid description');
    }
  }
  
  if (functions !== undefined && functions.length > 0) {
    const functionsValidation = validatePowersOrFunctions(functions, 'function');
    if (!functionsValidation.valid) {
      throw new Error(functionsValidation.error || 'Invalid functions array');
    }
  }

  const trimmedName = name.trim();
  const canonicalName = generateCanonicalName(trimmedName);

  // Try to find existing technique by exact canonical name match first
  let existingTechnique = existingTechniques.find(
    tech => tech.canonicalName === canonicalName || tech.name === trimmedName
  );

  // If no exact match, try fuzzy matching
  if (!existingTechnique) {
    const matchResult = findBestMatch(
      trimmedName,
      existingTechniques,
      (tech) => tech.name,
      0.85 // 85% similarity threshold
    );

    if (matchResult.match) {
      existingTechnique = matchResult.match;
    }
  }

  if (existingTechnique) {
    // Update existing technique
    const updatedTechnique: NovelTechnique = {
      ...existingTechnique,
      // Update name if new one is more authoritative
      name: isMoreAuthoritative(trimmedName, existingTechnique.name) ? trimmedName : existingTechnique.name,
      canonicalName: canonicalName,
      // Update description if provided and longer/more detailed
      description: description && description.length > existingTechnique.description.length 
        ? description 
        : existingTechnique.description,
      // Merge functions (deduplicated)
      functions: mergeFunctions(existingTechnique.functions, functions || []),
      // Update history
      history: appendHistory(existingTechnique.history, chapterNumber, description || '', functions || []),
      // Update last referenced chapter
      lastReferencedChapter: Math.max(existingTechnique.lastReferencedChapter || 0, chapterNumber),
      updatedAt: Date.now()
    };

    return { technique: updatedTechnique, wasCreated: false };
  }

  // Create new technique
  const newTechnique: NovelTechnique = {
    id: crypto.randomUUID(),
    novelId,
    name: trimmedName,
    canonicalName,
    description: description || '',
    category,
    type,
    functions: functions || [],
    history: formatHistoryEntry(chapterNumber, description || '', functions || []),
    firstAppearedChapter: chapterNumber,
    lastReferencedChapter: chapterNumber,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  return { technique: newTechnique, wasCreated: true };
}

/**
 * Merge powers arrays, removing duplicates
 */
function mergePowers(existing: string[], newPowers: string[]): string[] {
  const combined = [...existing, ...newPowers];
  const unique = new Set(combined.map(p => p.trim().toLowerCase()));
  return combined.filter((p, index, self) => 
    self.findIndex(p2 => p2.trim().toLowerCase() === p.trim().toLowerCase()) === index
  );
}

/**
 * Merge functions arrays, removing duplicates
 */
function mergeFunctions(existing: string[], newFunctions: string[]): string[] {
  const combined = [...existing, ...newFunctions];
  const unique = new Set(combined.map(f => f.trim().toLowerCase()));
  return combined.filter((f, index, self) => 
    self.findIndex(f2 => f2.trim().toLowerCase() === f.trim().toLowerCase()) === index
  );
}

/**
 * Append history entry for an item/technique
 */
function appendHistory(
  existingHistory: string,
  chapterNumber: number,
  description: string,
  powersOrFunctions: string[]
): string {
  const newEntry = formatHistoryEntry(chapterNumber, description, powersOrFunctions);
  
  if (!existingHistory) {
    return newEntry;
  }
  
  // Append new entry, avoiding duplicates if same chapter already has an entry
  if (existingHistory.includes(`In Chapter ${chapterNumber}:`)) {
    // Update existing entry for this chapter
    const lines = existingHistory.split('\n');
    const updatedLines = lines.map(line => {
      if (line.includes(`In Chapter ${chapterNumber}:`)) {
        return newEntry;
      }
      return line;
    });
    return updatedLines.join('\n');
  }
  
  return `${existingHistory}\n${newEntry}`;
}

/**
 * Format a history entry for a chapter
 */
function formatHistoryEntry(
  chapterNumber: number,
  description: string,
  powersOrFunctions: string[]
): string {
  const parts: string[] = [];
  
  if (description) {
    parts.push(description);
  }
  
  if (powersOrFunctions.length > 0) {
    if (parts.length > 0) {
      parts.push(`New abilities: ${powersOrFunctions.join(', ')}`);
    } else {
      parts.push(`Abilities: ${powersOrFunctions.join(', ')}`);
    }
  }
  
  const entryContent = parts.length > 0 ? parts.join('. ') : 'Referenced';
  
  return `In Chapter ${chapterNumber}: ${entryContent}`;
}

/**
 * Update item's last referenced chapter
 */
export function updateItemLastReferenced(
  item: NovelItem,
  chapterNumber: number
): NovelItem {
  return {
    ...item,
    lastReferencedChapter: Math.max(item.lastReferencedChapter || 0, chapterNumber),
    updatedAt: Date.now()
  };
}

/**
 * Update technique's last referenced chapter
 */
export function updateTechniqueLastReferenced(
  technique: NovelTechnique,
  chapterNumber: number
): NovelTechnique {
  return {
    ...technique,
    lastReferencedChapter: Math.max(technique.lastReferencedChapter || 0, chapterNumber),
    updatedAt: Date.now()
  };
}

/**
 * Statistics utilities for items and techniques
 * Provides functions to analyze and get statistics about items/techniques
 */

import { NovelItem, NovelTechnique, Character } from '../types';

export interface ItemTechniqueStats {
  totalItems: number;
  totalTechniques: number;
  itemsByCategory: Record<string, number>;
  techniquesByCategory: Record<string, number>;
  techniquesByType: Record<string, number>;
  activeItems: number;
  archivedItems: number;
  activeTechniques: number;
  archivedTechniques: number;
  itemsWithPowers: number;
  techniquesWithFunctions: number;
  averagePowersPerItem: number;
  averageFunctionsPerTechnique: number;
  mostReferencedItems: Array<{ item: NovelItem; referenceCount: number }>;
  mostReferencedTechniques: Array<{ technique: NovelTechnique; referenceCount: number }>;
  charactersWithItems: number;
  charactersWithTechniques: number;
}

/**
 * Get comprehensive statistics about items and techniques in a novel
 */
export function getItemTechniqueStats(
  novelItems: NovelItem[],
  novelTechniques: NovelTechnique[],
  characters: Character[]
): ItemTechniqueStats {
  // Basic counts
  const totalItems = novelItems.length;
  const totalTechniques = novelTechniques.length;

  // Items by category
  const itemsByCategory: Record<string, number> = {};
  novelItems.forEach(item => {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  });

  // Techniques by category
  const techniquesByCategory: Record<string, number> = {};
  novelTechniques.forEach(tech => {
    techniquesByCategory[tech.category] = (techniquesByCategory[tech.category] || 0) + 1;
  });

  // Techniques by type
  const techniquesByType: Record<string, number> = {};
  novelTechniques.forEach(tech => {
    techniquesByType[tech.type] = (techniquesByType[tech.type] || 0) + 1;
  });

  // Status counts (need to check character relationships)
  const activePossessions = characters.reduce((count, char) => {
    return count + (char.itemPossessions?.filter(p => p.status === 'active').length || 0);
  }, 0);

  const archivedPossessions = characters.reduce((count, char) => {
    return count + (char.itemPossessions?.filter(p => p.status !== 'active').length || 0);
  }, 0);

  const activeMasteries = characters.reduce((count, char) => {
    return count + (char.techniqueMasteries?.filter(m => m.status === 'active').length || 0);
  }, 0);

  const archivedMasteries = characters.reduce((count, char) => {
    return count + (char.techniqueMasteries?.filter(m => m.status !== 'active').length || 0);
  }, 0);

  // Items with powers
  const itemsWithPowers = novelItems.filter(item => item.powers.length > 0).length;

  // Techniques with functions
  const techniquesWithFunctions = novelTechniques.filter(tech => tech.functions.length > 0).length;

  // Average powers/functions
  const totalPowers = novelItems.reduce((sum, item) => sum + item.powers.length, 0);
  const totalFunctions = novelTechniques.reduce((sum, tech) => sum + tech.functions.length, 0);
  const averagePowersPerItem = totalItems > 0 ? totalPowers / totalItems : 0;
  const averageFunctionsPerTechnique = totalTechniques > 0 ? totalFunctions / totalTechniques : 0;

  // Most referenced items (by last_referenced_chapter)
  const mostReferencedItems = [...novelItems]
    .map(item => ({
      item,
      referenceCount: item.lastReferencedChapter || item.firstAppearedChapter || 0
    }))
    .sort((a, b) => b.referenceCount - a.referenceCount)
    .slice(0, 10);

  // Most referenced techniques
  const mostReferencedTechniques = [...novelTechniques]
    .map(tech => ({
      technique: tech,
      referenceCount: tech.lastReferencedChapter || tech.firstAppearedChapter || 0
    }))
    .sort((a, b) => b.referenceCount - a.referenceCount)
    .slice(0, 10);

  // Characters with items/techniques
  const charactersWithItems = characters.filter(char => 
    (char.itemPossessions && char.itemPossessions.length > 0) || 
    (char.items && char.items.length > 0) // Backward compatibility
  ).length;

  const charactersWithTechniques = characters.filter(char => 
    (char.techniqueMasteries && char.techniqueMasteries.length > 0) || 
    (char.skills && char.skills.length > 0) // Backward compatibility
  ).length;

  return {
    totalItems,
    totalTechniques,
    itemsByCategory,
    techniquesByCategory,
    techniquesByType,
    activeItems: activePossessions,
    archivedItems: archivedPossessions,
    activeTechniques: activeMasteries,
    archivedTechniques: archivedMasteries,
    itemsWithPowers,
    techniquesWithFunctions,
    averagePowersPerItem,
    averageFunctionsPerTechnique,
    mostReferencedItems,
    mostReferencedTechniques,
    charactersWithItems,
    charactersWithTechniques
  };
}

/**
 * Data Migration Script: Items and Techniques System
 * 
 * This script migrates existing data from the old character_skills and character_items
 * string arrays to the new comprehensive items and techniques system.
 * 
 * Usage:
 * 1. Run the database migration SQL first (DATABASE_MIGRATION_ITEMS_TECHNIQUES.sql)
 * 2. Import this script in your application or run it manually
 * 3. This script will create canonical items/techniques from existing string data
 * 4. Link characters to the new canonical entities
 * 
 * Note: This script preserves backward compatibility by keeping old skills/items arrays
 * until you're ready to fully transition.
 */

import { NovelState, NovelItem, NovelTechnique, CharacterItemPossession, CharacterTechniqueMastery, ItemCategory, TechniqueCategory, TechniqueType } from '../types';
import { generateCanonicalName } from '../utils/itemMatching';

/**
 * Migrates a novel's data from old format to new format
 * @param novel - The novel state to migrate
 * @returns Migrated novel state with new items and techniques
 */
export function migrateNovelData(novel: NovelState): NovelState {
  const novelItems: NovelItem[] = [...(novel.novelItems || [])];
  const novelTechniques: NovelTechnique[] = [...(novel.novelTechniques || [])];
  
  // Track created items/techniques by canonical name to avoid duplicates
  const itemsByName = new Map<string, NovelItem>();
  const techniquesByName = new Map<string, NovelTechnique>();
  
  // Initialize maps with existing items/techniques
  novelItems.forEach(item => {
    itemsByName.set(item.canonicalName, item);
  });
  novelTechniques.forEach(tech => {
    techniquesByName.set(tech.canonicalName, tech);
  });
  
  // Migrate character data
  const migratedCharacters = novel.characterCodex.map(char => {
    const itemPossessions: CharacterItemPossession[] = [...(char.itemPossessions || [])];
    const techniqueMasteries: CharacterTechniqueMastery[] = [...(char.techniqueMasteries || [])];
    
    // Migrate old items array to new format
    if (char.items && char.items.length > 0) {
      char.items.forEach((itemName, index) => {
        if (!itemName || typeof itemName !== 'string') return;
        
        const trimmedName = itemName.trim();
        if (!trimmedName) return;
        
        const canonicalName = generateCanonicalName(trimmedName);
        
        // Check if item already exists
        let item = itemsByName.get(canonicalName);
        
        if (!item) {
          // Create new canonical item
          // Try to determine category from name (default to Essential)
          const category = inferItemCategory(trimmedName);
          
          item = {
            id: crypto.randomUUID(),
            novelId: novel.id,
            name: trimmedName,
            canonicalName,
            description: `Migrated from character items`,
            category,
            powers: [],
            history: `Migrated from legacy items array`,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          
          novelItems.push(item);
          itemsByName.set(canonicalName, item);
        }
        
        // Check if character already has this possession
        const existingPossession = itemPossessions.find(p => p.itemId === item.id);
        if (!existingPossession) {
          itemPossessions.push({
            id: crypto.randomUUID(),
            characterId: char.id,
            itemId: item.id,
            status: 'active',
            notes: 'Migrated from legacy items array',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      });
    }
    
    // Migrate old skills array to new format
    if (char.skills && char.skills.length > 0) {
      char.skills.forEach((skillName, index) => {
        if (!skillName || typeof skillName !== 'string') return;
        
        const trimmedName = skillName.trim();
        if (!trimmedName) return;
        
        const canonicalName = generateCanonicalName(trimmedName);
        
        // Check if technique already exists
        let technique = techniquesByName.get(canonicalName);
        
        if (!technique) {
          // Create new canonical technique
          // Try to determine category and type from name
          const { category, type } = inferTechniqueCategory(trimmedName);
          
          technique = {
            id: crypto.randomUUID(),
            novelId: novel.id,
            name: trimmedName,
            canonicalName,
            description: `Migrated from character skills`,
            category,
            type,
            functions: [],
            history: `Migrated from legacy skills array`,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          
          novelTechniques.push(technique);
          techniquesByName.set(canonicalName, technique);
        }
        
        // Check if character already has this mastery
        const existingMastery = techniqueMasteries.find(m => m.techniqueId === technique.id);
        if (!existingMastery) {
          techniqueMasteries.push({
            id: crypto.randomUUID(),
            characterId: char.id,
            techniqueId: technique.id,
            status: 'active',
            masteryLevel: 'Novice', // Default for migrated data
            notes: 'Migrated from legacy skills array',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      });
    }
    
    return {
      ...char,
      itemPossessions,
      techniqueMasteries
    };
  });
  
  return {
    ...novel,
    novelItems,
    novelTechniques,
    characterCodex: migratedCharacters
  };
}

/**
 * Infers item category from item name
 * Basic heuristic - can be improved with AI or manual review
 */
function inferItemCategory(name: string): ItemCategory {
  const lowerName = name.toLowerCase();
  
  // Treasure keywords
  if (lowerName.includes('jade') || lowerName.includes('phoenix') || 
      lowerName.includes('dragon') || lowerName.includes('heaven') ||
      lowerName.includes('divine') || lowerName.includes('immortal') ||
      lowerName.includes('treasure') || lowerName.includes('artifact')) {
    return 'Treasure';
  }
  
  // Equipment keywords
  if (lowerName.includes('sword') || lowerName.includes('blade') ||
      lowerName.includes('armor') || lowerName.includes('shield') ||
      lowerName.includes('weapon') || lowerName.includes('ring') ||
      lowerName.includes('robe') || lowerName.includes('boot')) {
    return 'Equipment';
  }
  
  // Consumable keywords
  if (lowerName.includes('pill') || lowerName.includes('elixir') ||
      lowerName.includes('talisman') || lowerName.includes('fruit') ||
      lowerName.includes('medicine') || lowerName.includes('herb')) {
    return 'Consumable';
  }
  
  // Essential (default for basic items)
  if (lowerName.includes('water') || lowerName.includes('meat') ||
      lowerName.includes('food') || lowerName.includes('rope') ||
      lowerName.includes('torch') || lowerName.includes('skin')) {
    return 'Essential';
  }
  
  // Default to Essential for unknown items
  return 'Essential';
}

/**
 * Infers technique category and type from technique name
 * Basic heuristic - can be improved with AI or manual review
 */
function inferTechniqueCategory(name: string): { category: TechniqueCategory; type: TechniqueType } {
  const lowerName = name.toLowerCase();
  
  // Determine type first
  let type: TechniqueType = 'Other';
  
  if (lowerName.includes('cultivation') || lowerName.includes('qi') ||
      lowerName.includes('realm') || lowerName.includes('breakthrough') ||
      lowerName.includes('meditation') || lowerName.includes('circulation')) {
    type = 'Cultivation';
  } else if (lowerName.includes('sword') || lowerName.includes('blade') ||
             lowerName.includes('strike') || lowerName.includes('attack') ||
             lowerName.includes('combat') || lowerName.includes('battle')) {
    type = 'Combat';
  } else if (lowerName.includes('heal') || lowerName.includes('restore') ||
             lowerName.includes('support') || lowerName.includes('buff') ||
             lowerName.includes('barrier') || lowerName.includes('shield')) {
    type = 'Support';
  } else if (lowerName.includes('secret') || lowerName.includes('forbidden') ||
             lowerName.includes('hidden') || lowerName.includes('ancient')) {
    type = 'Secret';
  }
  
  // Determine category
  let category: TechniqueCategory = 'Basic';
  
  if (lowerName.includes('divine') || lowerName.includes('heaven') ||
      lowerName.includes('supreme') || lowerName.includes('ultimate') ||
      lowerName.includes('nine') || lowerName.includes('phoenix') ||
      lowerName.includes('dragon')) {
    category = 'Core';
  } else if (lowerName.includes('advanced') || lowerName.includes('expert') ||
             lowerName.includes('master') || lowerName.includes('elite')) {
    category = 'Important';
  } else if (lowerName.includes('basic') || lowerName.includes('foundation') ||
             lowerName.includes('elementary') || lowerName.includes('beginner')) {
    category = 'Basic';
  } else {
    category = 'Standard';
  }
  
  return { category, type };
}

/**
 * Batch migration helper
 * Migrates multiple novels at once
 */
export function migrateNovelsData(novels: NovelState[]): NovelState[] {
  return novels.map(novel => migrateNovelData(novel));
}

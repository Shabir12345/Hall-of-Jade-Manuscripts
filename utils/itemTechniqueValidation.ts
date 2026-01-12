/**
 * Validation utilities for items and techniques
 * Provides validation functions to ensure data quality
 */

import { ItemCategory, TechniqueCategory, TechniqueType } from '../types';

/**
 * Validates technique name
 */
export function validateTechniqueName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Technique name must be a non-empty string' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Technique name cannot be empty or whitespace' };
  }
  
  if (trimmed.length > 200) {
    return { valid: false, error: 'Technique name cannot exceed 200 characters' };
  }
  
  return { valid: true };
}

/**
 * Validates item category
 */
export function validateItemCategory(category: string): category is ItemCategory {
  const validCategories: ItemCategory[] = ['Treasure', 'Equipment', 'Consumable', 'Essential'];
  return validCategories.includes(category as ItemCategory);
}

/**
 * Validates technique category
 */
export function validateTechniqueCategory(category: string): category is TechniqueCategory {
  const validCategories: TechniqueCategory[] = ['Core', 'Important', 'Standard', 'Basic'];
  return validCategories.includes(category as TechniqueCategory);
}

/**
 * Validates technique type
 */
export function validateTechniqueType(type: string): type is TechniqueType {
  const validTypes: TechniqueType[] = ['Cultivation', 'Combat', 'Support', 'Secret', 'Other'];
  return validTypes.includes(type as TechniqueType);
}

/**
 * Validates item name
 */
export function validateItemName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Item name must be a non-empty string' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Item name cannot be empty or whitespace' };
  }
  
  if (trimmed.length > 200) {
    return { valid: false, error: 'Item name cannot exceed 200 characters' };
  }
  
  return { valid: true };
}

/**
 * Validates chapter number
 */
export function validateChapterNumber(chapterNumber: number): { valid: boolean; error?: string } {
  if (typeof chapterNumber !== 'number' || isNaN(chapterNumber)) {
    return { valid: false, error: 'Chapter number must be a valid number' };
  }
  
  if (chapterNumber < 1) {
    return { valid: false, error: 'Chapter number must be positive' };
  }
  
  if (!Number.isInteger(chapterNumber)) {
    return { valid: false, error: 'Chapter number must be an integer' };
  }
  
  return { valid: true };
}

/**
 * Validates power/function array
 */
export function validatePowersOrFunctions(
  powersOrFunctions: string[],
  type: 'power' | 'function' = 'power'
): { valid: boolean; error?: string } {
  if (!Array.isArray(powersOrFunctions)) {
    return { valid: false, error: `${type === 'power' ? 'Powers' : 'Functions'} must be an array` };
  }
  
  for (let i = 0; i < powersOrFunctions.length; i++) {
    const item = powersOrFunctions[i];
    if (typeof item !== 'string') {
      return { valid: false, error: `All ${type === 'power' ? 'powers' : 'functions'} must be strings` };
    }
    
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: `${type === 'power' ? 'Power' : 'Function'} at index ${i} cannot be empty` };
    }
    
    if (trimmed.length > 500) {
      return { valid: false, error: `${type === 'power' ? 'Power' : 'Function'} at index ${i} cannot exceed 500 characters` };
    }
  }
  
  return { valid: true };
}

/**
 * Validates description
 */
export function validateDescription(description: string | undefined): { valid: boolean; error?: string } {
  if (description === undefined || description === null) {
    return { valid: true }; // Description is optional
  }
  
  if (typeof description !== 'string') {
    return { valid: false, error: 'Description must be a string' };
  }
  
  if (description.length > 5000) {
    return { valid: false, error: 'Description cannot exceed 5000 characters' };
  }
  
  return { valid: true };
}

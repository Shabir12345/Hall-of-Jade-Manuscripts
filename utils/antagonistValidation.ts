/**
 * Validation utilities for antagonists
 * Provides validation functions to ensure data quality
 */

import { AntagonistType, AntagonistStatus, ThreatLevel, AntagonistDuration } from '../types';

/**
 * Validates antagonist name
 */
export function validateAntagonistName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Antagonist name must be a non-empty string' };
  }
  
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Antagonist name cannot be empty or whitespace' };
  }
  
  if (trimmed.length > 200) {
    return { valid: false, error: 'Antagonist name cannot exceed 200 characters' };
  }
  
  return { valid: true };
}

/**
 * Validates antagonist type
 */
export function validateAntagonistType(type: string): type is AntagonistType {
  const validTypes: AntagonistType[] = ['individual', 'group', 'system', 'society', 'abstract'];
  return validTypes.includes(type as AntagonistType);
}

/**
 * Validates antagonist status
 */
export function validateAntagonistStatus(status: string): status is AntagonistStatus {
  const validStatuses: AntagonistStatus[] = ['active', 'defeated', 'transformed', 'dormant', 'hinted'];
  return validStatuses.includes(status as AntagonistStatus);
}

/**
 * Validates threat level
 */
export function validateThreatLevel(level: string): level is ThreatLevel {
  const validLevels: ThreatLevel[] = ['low', 'medium', 'high', 'extreme'];
  return validLevels.includes(level as ThreatLevel);
}

/**
 * Validates duration scope
 */
export function validateDurationScope(scope: string): scope is AntagonistDuration {
  const validScopes: AntagonistDuration[] = ['chapter', 'arc', 'novel', 'multi_arc'];
  return validScopes.includes(scope as AntagonistDuration);
}

/**
 * Validates chapter number
 */
export function validateChapterNumber(chapter: number | undefined | null): { valid: boolean; error?: string } {
  if (chapter === undefined || chapter === null) {
    return { valid: true }; // Optional field
  }
  
  if (typeof chapter !== 'number') {
    return { valid: false, error: 'Chapter number must be a number' };
  }
  
  if (chapter < 1) {
    return { valid: false, error: 'Chapter number must be positive' };
  }
  
  if (!Number.isInteger(chapter)) {
    return { valid: false, error: 'Chapter number must be an integer' };
  }
  
  return { valid: true };
}

/**
 * Comprehensive antagonist input validation
 */
export interface AntagonistInput {
  name: string;
  type?: string;
  status?: string;
  threatLevel?: string;
  durationScope?: string;
  description?: string;
  motivation?: string;
  powerLevel?: string;
  firstAppearedChapter?: number;
  lastAppearedChapter?: number;
  resolvedChapter?: number;
}

export function validateAntagonistInput(input: AntagonistInput): { success: boolean; error?: string; data?: AntagonistInput } {
  // Validate name
  const nameValidation = validateAntagonistName(input.name);
  if (!nameValidation.valid) {
    return { success: false, error: nameValidation.error };
  }

  // Validate type (default to 'individual' if not provided)
  const type = input.type || 'individual';
  if (!validateAntagonistType(type)) {
    return { success: false, error: `Invalid antagonist type: ${type}. Must be one of: individual, group, system, society, abstract` };
  }

  // Validate status (default to 'active' if not provided)
  const status = input.status || 'active';
  if (!validateAntagonistStatus(status)) {
    return { success: false, error: `Invalid antagonist status: ${status}. Must be one of: active, defeated, transformed, dormant, hinted` };
  }

  // Validate threat level (default to 'medium' if not provided)
  const threatLevel = input.threatLevel || 'medium';
  if (!validateThreatLevel(threatLevel)) {
    return { success: false, error: `Invalid threat level: ${threatLevel}. Must be one of: low, medium, high, extreme` };
  }

  // Validate duration scope (default to 'arc' if not provided)
  const durationScope = input.durationScope || 'arc';
  if (!validateDurationScope(durationScope)) {
    return { success: false, error: `Invalid duration scope: ${durationScope}. Must be one of: chapter, arc, novel, multi_arc` };
  }

  // Validate chapter numbers
  if (input.firstAppearedChapter !== undefined) {
    const chapterValidation = validateChapterNumber(input.firstAppearedChapter);
    if (!chapterValidation.valid) {
      return { success: false, error: `Invalid first appeared chapter: ${chapterValidation.error}` };
    }
  }

  if (input.lastAppearedChapter !== undefined) {
    const chapterValidation = validateChapterNumber(input.lastAppearedChapter);
    if (!chapterValidation.valid) {
      return { success: false, error: `Invalid last appeared chapter: ${chapterValidation.error}` };
    }
  }

  if (input.resolvedChapter !== undefined) {
    const chapterValidation = validateChapterNumber(input.resolvedChapter);
    if (!chapterValidation.valid) {
      return { success: false, error: `Invalid resolved chapter: ${chapterValidation.error}` };
    }
  }

  // Validate description length
  if (input.description && input.description.length > 5000) {
    return { success: false, error: 'Description cannot exceed 5000 characters' };
  }

  // Validate motivation length
  if (input.motivation && input.motivation.length > 2000) {
    return { success: false, error: 'Motivation cannot exceed 2000 characters' };
  }

  // Validate power level length
  if (input.powerLevel && input.powerLevel.length > 200) {
    return { success: false, error: 'Power level cannot exceed 200 characters' };
  }

  return { 
    success: true, 
    data: {
      name: input.name.trim(),
      type,
      status,
      threatLevel,
      durationScope,
      description: input.description?.trim(),
      motivation: input.motivation?.trim(),
      powerLevel: input.powerLevel?.trim(),
      firstAppearedChapter: input.firstAppearedChapter,
      lastAppearedChapter: input.lastAppearedChapter,
      resolvedChapter: input.resolvedChapter
    }
  };
}

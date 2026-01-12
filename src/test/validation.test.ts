import { describe, it, expect } from 'vitest';
import {
  validateChapterInput,
  validateCharacterInput,
  validateWorldEntryInput,
  isValidChapter,
  isValidCharacter,
} from '../../utils/validation';

describe('validation utilities', () => {
  describe('validateChapterInput', () => {
    it('should validate a correct chapter', () => {
      const chapter = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        number: 1,
        title: 'Test Chapter',
        content: 'Chapter content',
        createdAt: Date.now(),
      };
      const result = validateChapterInput(chapter);
      expect(result.success).toBe(true);
    });

    it('should reject chapter with negative number', () => {
      const chapter = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        number: -1,
        title: 'Test Chapter',
        content: 'Chapter content',
        createdAt: Date.now(),
      };
      const result = validateChapterInput(chapter);
      expect(result.success).toBe(false);
    });

    it('should reject chapter with empty title', () => {
      const chapter = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        number: 1,
        title: '',
        content: 'Chapter content',
        createdAt: Date.now(),
      };
      const result = validateChapterInput(chapter);
      expect(result.success).toBe(false);
    });
  });

  describe('validateCharacterInput', () => {
    it('should validate a correct character', () => {
      const character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test Character',
        age: '25',
        personality: 'Brave',
        currentCultivation: 'Foundation',
        skills: ['Sword Mastery'],
        items: ['Sword'],
        notes: 'A test character',
        status: 'Alive' as const,
        relationships: [],
      };
      const result = validateCharacterInput(character);
      expect(result.success).toBe(true);
    });

    it('should reject character with empty name', () => {
      const character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: '',
        skills: [],
        items: [],
        status: 'Alive' as const,
        relationships: [],
      };
      const result = validateCharacterInput(character);
      expect(result.success).toBe(false);
    });
  });

  describe('validateWorldEntryInput', () => {
    it('should validate a correct world entry', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        realmId: '123e4567-e89b-12d3-a456-426614174001',
        category: 'Geography' as const,
        title: 'Test Location',
        content: 'Location description',
      };
      const result = validateWorldEntryInput(entry);
      expect(result.success).toBe(true);
    });

    it('should reject world entry with empty title', () => {
      const entry = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        realmId: '123e4567-e89b-12d3-a456-426614174001',
        category: 'Geography' as const,
        title: '',
        content: 'Location description',
      };
      const result = validateWorldEntryInput(entry);
      expect(result.success).toBe(false);
    });
  });

  describe('type guards', () => {
    it('isValidChapter should return true for valid chapter', () => {
      const chapter = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        number: 1,
        title: 'Test',
        content: 'Content',
        createdAt: Date.now(),
      };
      expect(isValidChapter(chapter)).toBe(true);
    });

    it('isValidCharacter should return true for valid character', () => {
      const character = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'Test',
        skills: [],
        items: [],
        status: 'Alive' as const,
        relationships: [],
      };
      expect(isValidCharacter(character)).toBe(true);
    });
  });
});

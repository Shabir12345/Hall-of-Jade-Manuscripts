/**
 * Entity Factory Tests
 */

import { describe, it, expect } from 'vitest';
import {
  createNewCharacter,
  createNewWorldEntry,
  createNewArc,
  createDefaultArcChecklist,
  ensureArcDefaults,
} from '../../utils/entityFactories';

describe('entityFactories', () => {
  describe('createNewCharacter', () => {
    it('should create a character with default values', () => {
      const character = createNewCharacter();
      
      expect(character.id).toBeDefined();
      expect(character.name).toBe('');
      expect(character.isProtagonist).toBe(false);
      expect(character.status).toBe('Alive');
      expect(character.skills).toEqual([]);
      expect(character.items).toEqual([]);
      expect(character.relationships).toEqual([]);
    });

    it('should allow overriding default values', () => {
      const character = createNewCharacter({
        name: 'Test Character',
        isProtagonist: true,
        status: 'Deceased',
      });
      
      expect(character.name).toBe('Test Character');
      expect(character.isProtagonist).toBe(true);
      expect(character.status).toBe('Deceased');
    });
  });

  describe('createNewWorldEntry', () => {
    it('should create a world entry with default values', () => {
      const realmId = 'realm-123';
      const entry = createNewWorldEntry(realmId);
      
      expect(entry.id).toBeDefined();
      expect(entry.realmId).toBe(realmId);
      expect(entry.category).toBe('Other');
      expect(entry.title).toBe('');
      expect(entry.content).toBe('');
    });

    it('should allow overriding default values', () => {
      const realmId = 'realm-123';
      const entry = createNewWorldEntry(realmId, {
        title: 'Test Location',
        category: 'Geography',
      });
      
      expect(entry.title).toBe('Test Location');
      expect(entry.category).toBe('Geography');
    });
  });

  describe('createNewArc', () => {
    it('should create an arc with default values', () => {
      const arc = createNewArc();
      
      expect(arc.id).toBeDefined();
      expect(arc.title).toBe('');
      expect(arc.description).toBe('');
      expect(arc.status).toBe('active');
      expect(arc.checklist).toEqual([]);
    });

    it('should allow overriding default values', () => {
      const arc = createNewArc({
        title: 'Test Arc',
        status: 'completed',
      });
      
      expect(arc.title).toBe('Test Arc');
      expect(arc.status).toBe('completed');
    });
  });

  describe('createDefaultArcChecklist', () => {
    it('should create default checklist items', () => {
      const checklist = createDefaultArcChecklist();
      
      expect(checklist.length).toBeGreaterThan(0);
      checklist.forEach(item => {
        expect(item.id).toBeDefined();
        expect(item.label).toBeDefined();
        expect(item.completed).toBe(false);
      });
    });
  });

  describe('ensureArcDefaults', () => {
    it('should add checklist to arc without one', () => {
      const arc = {
        id: 'arc-123',
        title: 'Test Arc',
        description: 'Test description',
        status: 'active' as const,
      };
      
      const ensured = ensureArcDefaults(arc);
      
      expect(ensured.checklist).toBeDefined();
      expect(ensured.checklist!.length).toBeGreaterThan(0);
    });

    it('should preserve existing checklist', () => {
      const existingChecklist = createDefaultArcChecklist();
      const arc = {
        id: 'arc-123',
        title: 'Test Arc',
        description: 'Test description',
        status: 'active' as const,
        checklist: existingChecklist,
      };
      
      const ensured = ensureArcDefaults(arc);
      
      expect(ensured.checklist).toBe(existingChecklist);
    });
  });
});

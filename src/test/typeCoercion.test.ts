/**
 * Type Coercion Tests
 */

import { describe, it, expect } from 'vitest';
import {
  coerceWorldCategory,
  coerceTerritoryType,
  coerceCharStatus,
  coerceItemCategory,
  coerceTechniqueCategory,
  coerceTechniqueType,
} from '../../utils/typeCoercion';

describe('typeCoercion', () => {
  describe('coerceWorldCategory', () => {
    it('should return valid category for valid input', () => {
      expect(coerceWorldCategory('Geography')).toBe('Geography');
      expect(coerceWorldCategory('Sects')).toBe('Sects');
      expect(coerceWorldCategory('PowerLevels')).toBe('PowerLevels');
    });

    it('should return "Other" for invalid input', () => {
      expect(coerceWorldCategory('Invalid')).toBe('Other');
      expect(coerceWorldCategory(null)).toBe('Other');
      expect(coerceWorldCategory(undefined)).toBe('Other');
    });

    it('should handle case-insensitive input', () => {
      expect(coerceWorldCategory('geography')).toBe('Other'); // Exact match required
    });
  });

  describe('coerceTerritoryType', () => {
    it('should return valid type for valid input', () => {
      expect(coerceTerritoryType('Empire')).toBe('Empire');
      expect(coerceTerritoryType('Kingdom')).toBe('Kingdom');
      expect(coerceTerritoryType('Neutral')).toBe('Neutral');
      expect(coerceTerritoryType('Hidden')).toBe('Hidden');
    });

    it('should return "Neutral" for invalid input', () => {
      expect(coerceTerritoryType('Invalid')).toBe('Neutral');
      expect(coerceTerritoryType(null)).toBe('Neutral');
    });
  });

  describe('coerceCharStatus', () => {
    it('should return valid status for valid input', () => {
      expect(coerceCharStatus('Alive')).toBe('Alive');
      expect(coerceCharStatus('Deceased')).toBe('Deceased');
      expect(coerceCharStatus('Unknown')).toBe('Unknown');
    });

    it('should return undefined for invalid input', () => {
      expect(coerceCharStatus('Invalid')).toBeUndefined();
      expect(coerceCharStatus(null)).toBeUndefined();
    });
  });

  describe('coerceItemCategory', () => {
    it('should return valid category for valid input', () => {
      expect(coerceItemCategory('Treasure')).toBe('Treasure');
      expect(coerceItemCategory('Equipment')).toBe('Equipment');
      expect(coerceItemCategory('Consumable')).toBe('Consumable');
      expect(coerceItemCategory('Essential')).toBe('Essential');
    });

    it('should return "Essential" for invalid input', () => {
      expect(coerceItemCategory('Invalid')).toBe('Essential');
      expect(coerceItemCategory(null)).toBe('Essential');
    });
  });

  describe('coerceTechniqueCategory', () => {
    it('should return valid category for valid input', () => {
      expect(coerceTechniqueCategory('Core')).toBe('Core');
      expect(coerceTechniqueCategory('Important')).toBe('Important');
      expect(coerceTechniqueCategory('Standard')).toBe('Standard');
      expect(coerceTechniqueCategory('Basic')).toBe('Basic');
    });

    it('should return "Basic" for invalid input', () => {
      expect(coerceTechniqueCategory('Invalid')).toBe('Basic');
      expect(coerceTechniqueCategory(null)).toBe('Basic');
    });
  });

  describe('coerceTechniqueType', () => {
    it('should return valid type for valid input', () => {
      expect(coerceTechniqueType('Cultivation')).toBe('Cultivation');
      expect(coerceTechniqueType('Combat')).toBe('Combat');
      expect(coerceTechniqueType('Support')).toBe('Support');
      expect(coerceTechniqueType('Secret')).toBe('Secret');
      expect(coerceTechniqueType('Other')).toBe('Other');
    });

    it('should return "Other" for invalid input', () => {
      expect(coerceTechniqueType('Invalid')).toBe('Other');
      expect(coerceTechniqueType(null)).toBe('Other');
    });
  });
});

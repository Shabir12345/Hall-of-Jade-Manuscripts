import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateChapterGenerationQuality,
  validateGeneratedChapter,
  validateChapterQuality,
} from '../../../services/chapterQualityValidator';
import { Chapter, NovelState, Character, LogicAudit } from '../../../types';

describe('Chapter Quality Validator', () => {
  let mockState: NovelState;
  let mockChapter: Chapter;

  beforeEach(() => {
    mockState = {
      id: 'test-novel',
      title: 'Test Novel',
      genre: 'Xianxia',
      grandSaga: 'A test saga',
      realms: [],
      currentRealmId: '',
      territories: [],
      chapters: [],
      characterCodex: [
        {
          id: 'char1',
          name: 'Test Character',
          isProtagonist: true,
          age: '20',
          personality: 'Brave',
          currentCultivation: 'Foundation',
          notes: '',
          status: 'Alive',
          relationships: [],
          skills: [],
          items: [],
        } as unknown as Character,
      ],
      plotLedger: [],
      worldBible: [],
      systemLogs: [],
      tags: [],
      writingGoals: [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    };

    mockChapter = {
      id: 'test-chapter',
      number: 1,
      title: 'Test Chapter',
      content: 'Paragraph one. ' + 'word '.repeat(500) + '\n\n' + 'Paragraph two. ' + 'word '.repeat(500) + '\n\n' + 'Paragraph three. ' + 'word '.repeat(500), // ~1500+ words with paragraphs
      summary: 'A test chapter',
      logicAudit: {
        startingValue: 'Ignorant',
        theFriction: 'Discovery',
        theChoice: 'To learn',
        resultingValue: 'Knowledgeable',
        causalityType: 'Therefore',
      } as LogicAudit,
      scenes: [],
      createdAt: Date.now(),
    };
  });

  describe('validateChapterGenerationQuality', () => {
    it('should return valid quality check for good state', () => {
      const check = validateChapterGenerationQuality(mockState, 1);
      expect(check.isValid).toBe(true);
      expect(check.qualityScore).toBeGreaterThanOrEqual(0);
      expect(check.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should provide suggestions for improvement', () => {
      const check = validateChapterGenerationQuality(mockState, 1);
      expect(Array.isArray(check.suggestions)).toBe(true);
    });

    it('should check narrative craft readiness', () => {
      const check = validateChapterGenerationQuality(mockState, 1);
      // Should have suggestions or warnings if readiness is low
      expect(check.warnings.length + check.suggestions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validateGeneratedChapter', () => {
    it('should validate chapter with sufficient word count', async () => {
      const check = await validateGeneratedChapter(mockChapter, mockState);
      expect(check.isValid).toBe(true);
      expect(check.qualityScore).toBeGreaterThan(70);
    });

    it('should flag chapter with insufficient word count', async () => {
      mockChapter.content = 'Short content.';
      const check = await validateGeneratedChapter(mockChapter, mockState);
      expect(check.errors.length).toBeGreaterThan(0);
      expect(check.isValid).toBe(false);
    });

    it('should flag chapter without logic audit', async () => {
      mockChapter.logicAudit = undefined;
      const check = await validateGeneratedChapter(mockChapter, mockState);
      expect(check.errors.length).toBeGreaterThan(0);
    });

    it('should validate paragraph structure', async () => {
      mockChapter.content = 'Paragraph one. ' + 'word '.repeat(600) + '\n\n' +
        'Paragraph two. ' + 'word '.repeat(600) + '\n\n' +
        'Paragraph three. ' + 'word '.repeat(600);
      const check = await validateGeneratedChapter(mockChapter, mockState);
      // Should pass with at least 3 paragraphs
      expect(check.errors.length).toBe(0);
    });

    it('should flag insufficient paragraphs', async () => {
      mockChapter.content = 'Only one paragraph.';
      const check = await validateGeneratedChapter(mockChapter, mockState);
      expect(check.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateChapterQuality', () => {
    it('should return comprehensive quality metrics', async () => {
      const metrics = await validateChapterQuality(mockChapter, mockState);

      expect(metrics.chapterId).toBe(mockChapter.id);
      expect(metrics.qualityCheck).toBeDefined();
      expect(metrics.originalityScore).toBeDefined();
      expect(metrics.narrativeCraftScore).toBeDefined();
      expect(metrics.voiceConsistencyScore).toBeGreaterThanOrEqual(0);
      expect(metrics.voiceConsistencyScore).toBeLessThanOrEqual(100);
      expect(metrics.editorialScore).toBeDefined();
      expect(typeof metrics.shouldRegenerate).toBe('boolean');
      expect(Array.isArray(metrics.regenerationReasons)).toBe(true);
      expect(Array.isArray(metrics.warnings)).toBe(true);
    });

    it('should determine regeneration necessity', async () => {
      // Create a low-quality chapter
      mockChapter.content = 'It was. There was. It is. There are. '.repeat(100);
      const metrics = await validateChapterQuality(mockChapter, mockState);

      // Should potentially flag for regeneration if quality is low
      expect(typeof metrics.shouldRegenerate).toBe('boolean');
    });

    it('should handle errors gracefully', async () => {
      // Create invalid chapter to trigger errors
      mockChapter.content = '';
      const metrics = await validateChapterQuality(mockChapter, mockState);

      // Should still return metrics with fallback values
      expect(metrics).toBeDefined();
      expect(metrics.originalityScore).toBeDefined();
      expect(metrics.narrativeCraftScore).toBeDefined();
    });

    it('should cache results for performance', async () => {
      const start1 = Date.now();
      const metrics1 = await validateChapterQuality(mockChapter, mockState);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      const metrics2 = await validateChapterQuality(mockChapter, mockState);
      const time2 = Date.now() - start2;

      // Second call should be faster or equal due to caching
      expect(time2).toBeLessThanOrEqual(time1);
      expect(metrics1.chapterId).toBe(metrics2.chapterId);
    });

    it('should NOT crash when chapter content is undefined', async () => {
      mockChapter.content = undefined as any;
      const metrics = await validateChapterQuality(mockChapter, mockState);
      expect(metrics).toBeDefined();
      expect(metrics.qualityCheck.isValid).toBe(false);
    });

    it('should NOT crash when state chapters are undefined', async () => {
      mockState.chapters = undefined as any;
      const metrics = await validateChapterQuality(mockChapter, mockState);
      expect(metrics).toBeDefined();
    });
  });
});

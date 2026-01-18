import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  shouldRegenerate,
  regenerateWithQualityCheck,
} from '../../../services/chapterRegenerationService';
import { ChapterQualityMetrics, RegenerationConfig, NovelState, Chapter } from '../../../types';
import { QUALITY_CONFIG } from '../../../constants';

describe('Chapter Regeneration Service', () => {
  let mockMetrics: ChapterQualityMetrics;
  let mockState: NovelState;
  let mockChapter: Chapter;

  beforeEach(() => {
    mockState = {
      id: 'test-novel',
      title: 'Test Novel',
      grandSaga: 'A test saga',
      chapters: [],
      characterCodex: [],
      plotLedger: [],
      worldBible: [],
      updatedAt: Date.now(),
    };

    mockChapter = {
      id: 'test-chapter',
      number: 1,
      title: 'Test Chapter',
      content: 'Test content',
      summary: 'Test summary',
      scenes: [],
      createdAt: Date.now(),
    };

    mockMetrics = {
      chapterId: 'test-chapter',
      qualityCheck: {
        isValid: true,
        warnings: [],
        errors: [],
        suggestions: [],
        qualityScore: 80,
      },
      originalityScore: {
        id: 'orig1',
        chapterId: 'test-chapter',
        novelId: 'test-novel',
        overallOriginality: 70,
        creativeDistance: 70,
        novelMetaphorScore: 70,
        uniqueImageryScore: 70,
        sceneConstructionOriginality: 70,
        emotionalBeatOriginality: 70,
        genericPatternsDetected: [],
        mechanicalStructuresDetected: [],
        derivativeContentFlags: [],
        clichePatterns: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      narrativeCraftScore: {
        id: 'craft1',
        chapterId: 'test-chapter',
        novelId: 'test-novel',
        overallCraftScore: 70,
        burstinessScore: 70,
        perplexityScore: 70,
        subtextScore: 70,
        interiorityScore: 70,
        sceneIntentScore: 70,
        dialogueNaturalnessScore: 70,
        repetitivePatterns: [],
        overexplanationFlags: [],
        neutralProseFlags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      voiceConsistencyScore: 75,
      editorialScore: {
        readability: 80,
        flow: 80,
        emotionalAuthenticity: 70,
        narrativeCoherence: 80,
        structuralBalance: 80,
      },
      shouldRegenerate: false,
      regenerationReasons: [],
      warnings: [],
      createdAt: Date.now(),
    };
  });

  describe('shouldRegenerate', () => {
    it('should return false for high-quality chapters', () => {
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(false);
    });

    it('should return true for low originality score', () => {
      mockMetrics.originalityScore.overallOriginality = 50; // Below threshold
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Originality score below threshold'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should return true for low narrative craft score', () => {
      mockMetrics.narrativeCraftScore.overallCraftScore = 50; // Below threshold
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Narrative craft score below threshold'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should return true for low voice consistency score', () => {
      mockMetrics.voiceConsistencyScore = 50; // Below threshold
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Voice consistency score below threshold'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should return true when generic patterns detected', () => {
      mockMetrics.originalityScore.genericPatternsDetected = ['Generic pattern detected'];
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Generic patterns detected'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should return true when mechanical structures detected', () => {
      mockMetrics.originalityScore.mechanicalStructuresDetected = ['Mechanical structure detected'];
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Mechanical structures detected'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should return true when derivative content detected', () => {
      mockMetrics.originalityScore.derivativeContentFlags = ['Derivative content detected'];
      mockMetrics.shouldRegenerate = true;
      mockMetrics.regenerationReasons = ['Derivative content detected'];
      const result = shouldRegenerate(mockMetrics, QUALITY_CONFIG);
      expect(result).toBe(true);
    });

    it('should respect disabled regeneration config', () => {
      const disabledConfig: RegenerationConfig = {
        ...QUALITY_CONFIG,
        enabled: false,
      };
      mockMetrics.shouldRegenerate = true;
      const result = shouldRegenerate(mockMetrics, disabledConfig);
      expect(result).toBe(false);
    });
  });

  describe('regenerateWithQualityCheck', () => {
    // Note: This test would require mocking the generation service
    // For now, we'll test the logic structure
    it('should have correct function signature', () => {
      expect(typeof regenerateWithQualityCheck).toBe('function');
    });

    // Integration test would require:
    // - Mocking generateNextChapter
    // - Mocking validateChapterQuality
    // - Testing regeneration loop
    // - Testing max attempts limit
    // - Testing quality improvement tracking
  });
});

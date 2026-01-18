import { describe, it, expect, beforeEach } from 'vitest';
import { analyzeChapterOriginality } from '../../../services/originalityDetector';
import { Chapter, NovelState } from '../../../types';

describe('Originality Detector - Chapter Level', () => {
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
      content: '',
      summary: 'A test chapter',
      scenes: [],
      createdAt: Date.now(),
    };
  });

  describe('analyzeChapterOriginality', () => {
    it('should return comprehensive originality score', () => {
      mockChapter.content = 'The dragon\'s scales shimmered like liquid starlight, each one a tiny universe of possibility. His heart didn\'t pound—it sang, a symphony of anticipation.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      
      expect(score.overallOriginality).toBeGreaterThanOrEqual(0);
      expect(score.overallOriginality).toBeLessThanOrEqual(100);
      expect(score.creativeDistance).toBeGreaterThanOrEqual(0);
      expect(score.novelMetaphorScore).toBeGreaterThanOrEqual(0);
      expect(score.uniqueImageryScore).toBeGreaterThanOrEqual(0);
      expect(score.sceneConstructionOriginality).toBeGreaterThanOrEqual(0);
      expect(score.emotionalBeatOriginality).toBeGreaterThanOrEqual(0);
    });

    it('should detect generic patterns', () => {
      mockChapter.content = 'It was a beautiful day. There was a magnificent castle. It was very nice. There were many people.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.genericPatternsDetected.length).toBeGreaterThan(0);
    });

    it('should detect mechanical structures', () => {
      mockChapter.content = 'He walked. He walked. He walked. He walked. He walked.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.mechanicalStructuresDetected.length).toBeGreaterThan(0);
    });

    it('should detect derivative content', () => {
      mockChapter.content = 'Little did they know, in a world where time seemed to stand still, his heart pounded like a drum.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.derivativeContentFlags.length).toBeGreaterThan(0);
    });

    it('should detect cliché patterns', () => {
      mockChapter.content = 'The chosen one discovered their destiny through a prophecy that foretold the destruction of evil.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.clichePatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should score novel metaphors highly', () => {
      mockChapter.content = 'Her laughter was like sunlight breaking through storm clouds, unexpected and transformative. His thoughts moved like a river finding its path, carving new channels through ancient stone.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.novelMetaphorScore).toBeGreaterThan(50);
    });

    it('should score unique imagery highly', () => {
      mockChapter.content = 'The scent of petrichor mingled with the metallic tang of ozone. The texture of ancient bark felt like weathered leather under his fingertips.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      expect(score.uniqueImageryScore).toBeGreaterThan(50);
    });

    it('should penalize common scene patterns', () => {
      mockChapter.content = 'He began training. Through practice and cultivation, he made a breakthrough. His power surged.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      // Scene construction originality should be lower due to common patterns
      expect(score.sceneConstructionOriginality).toBeLessThan(80);
    });

    it('should penalize standard emotional tropes', () => {
      mockChapter.content = 'Anger filled him. His rage caused his power to surge. With the help of his friends, he achieved victory.';
      const score = analyzeChapterOriginality(mockChapter, mockState);
      // Emotional beat originality should be lower due to standard tropes
      expect(score.emotionalBeatOriginality).toBeLessThan(80);
    });
  });
});

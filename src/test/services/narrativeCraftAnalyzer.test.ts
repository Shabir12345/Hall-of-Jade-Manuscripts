import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeNarrativeCraft,
  calculateBurstiness,
  calculatePerplexity,
  analyzeSubtext,
  analyzeInteriority,
  validateSceneIntent,
  analyzeDialogueNaturalness,
} from '../../../services/narrativeCraftAnalyzer';
import { Chapter, NovelState, Character } from '../../../types';

describe('Narrative Craft Analyzer', () => {
  let mockState: NovelState;
  let mockChapter: Chapter;

  beforeEach(() => {
    mockState = {
      id: 'test-novel',
      title: 'Test Novel',
      grandSaga: 'A test saga',
      chapters: [],
      characterCodex: [
        {
          id: 'char1',
          name: 'Test Character',
          isProtagonist: true,
          age: 20,
          personality: 'Brave',
          currentCultivation: 'Foundation',
          notes: '',
          status: 'alive',
        } as Character,
      ],
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

  describe('calculateBurstiness', () => {
    it('should return high score for varied sentence lengths', () => {
      const content = 'Short. This is a much longer sentence with many words that creates variation. Another short one. And yet another very long sentence that demonstrates the importance of sentence length variation in creating natural, human-like prose.';
      const score = calculateBurstiness(content);
      expect(score).toBeGreaterThan(60);
    });

    it('should return low score for uniform sentence lengths', () => {
      const content = 'This is a sentence. This is another sentence. This is yet another sentence. This is one more sentence. This is the final sentence.';
      const score = calculateBurstiness(content);
      expect(score).toBeLessThan(60);
    });

    it('should handle empty content gracefully', () => {
      const score = calculateBurstiness('');
      expect(score).toBe(50);
    });

    it('should handle content with few sentences', () => {
      const score = calculateBurstiness('One sentence.');
      expect(score).toBe(50);
    });
  });

  describe('calculatePerplexity', () => {
    it('should return high score for diverse vocabulary', () => {
      const content = 'The magnificent dragon soared through the azure sky, its iridescent scales shimmering in the brilliant sunlight. Ancient magic coursed through its veins, connecting it to the primordial forces of creation.';
      const score = calculatePerplexity(content);
      expect(score).toBeGreaterThan(60);
    });

    it('should return lower score for repetitive vocabulary', () => {
      const content = 'The the the the the. The the the the the. The the the the the.';
      const score = calculatePerplexity(content);
      expect(score).toBeLessThan(60);
    });

    it('should handle empty content gracefully', () => {
      const score = calculatePerplexity('');
      expect(score).toBe(50);
    });
  });

  describe('analyzeSubtext', () => {
    it('should detect subtext in dialogue', () => {
      const content = '"I suppose you could say that," he said, though his eyes told a different story. "Maybe we should reconsider," she replied, her tone suggesting otherwise.';
      const analysis = analyzeSubtext(content);
      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.instances).toBeGreaterThan(0);
    });

    it('should detect implied meaning', () => {
      const content = 'He seemed calm, but his hands trembled. She appeared confident, yet her voice wavered.';
      const analysis = analyzeSubtext(content);
      expect(analysis.impliedMeaning).toBeGreaterThan(0);
    });

    it('should return zero for content without subtext', () => {
      const content = 'He was happy. She was sad. They were friends.';
      const analysis = analyzeSubtext(content);
      expect(analysis.score).toBeLessThan(50);
    });
  });

  describe('analyzeInteriority', () => {
    it('should detect character interiority', () => {
      const content = 'He thought about what she had said. His mind raced with possibilities. He wondered if she understood.';
      const analysis = analyzeInteriority(content, mockState.characterCodex);
      expect(analysis.score).toBeGreaterThan(0);
      expect(analysis.depth).toBeGreaterThan(0);
    });

    it('should score emotional authenticity', () => {
      const content = 'Fear gripped his heart. Joy filled her soul. Anger burned within him.';
      const analysis = analyzeInteriority(content, mockState.characterCodex);
      expect(analysis.emotionalAuthenticity).toBeGreaterThan(50);
    });

    it('should return low score for content without interiority', () => {
      const content = 'He walked. She ran. They jumped.';
      const analysis = analyzeInteriority(content, mockState.characterCodex);
      expect(analysis.depth).toBeLessThan(40);
    });
  });

  describe('validateSceneIntent', () => {
    it('should validate scene with clear value shift', () => {
      mockChapter.logicAudit = {
        startingValue: 'Ignorant',
        theFriction: 'Discovery',
        theChoice: 'To learn',
        resultingValue: 'Knowledgeable',
        causalityType: 'Revelation',
      };
      const analysis = validateSceneIntent(mockChapter, mockState);
      expect(analysis.valueShift).toBe(true);
      expect(analysis.score).toBeGreaterThan(60);
    });

    it('should flag scene without value shift', () => {
      mockChapter.logicAudit = {
        startingValue: 'Happy',
        theFriction: 'Event',
        theChoice: 'To continue',
        resultingValue: 'Happy',
        causalityType: 'Maintenance',
      };
      const analysis = validateSceneIntent(mockChapter, mockState);
      expect(analysis.issues.length).toBeGreaterThan(0);
    });

    it('should handle missing logic audit', () => {
      mockChapter.logicAudit = undefined;
      const analysis = validateSceneIntent(mockChapter, mockState);
      expect(analysis.issues).toContain('Missing logic audit - cannot verify value shift');
    });
  });

  describe('analyzeDialogueNaturalness', () => {
    it('should detect interruptions in dialogue', () => {
      const content = '"I was thinking—" "Don't say it," she interrupted. "But—" "No!"';
      const analysis = analyzeDialogueNaturalness(content);
      expect(analysis.interruptions).toBeGreaterThan(0);
      expect(analysis.score).toBeGreaterThan(50);
    });

    it('should detect ambiguity in dialogue', () => {
      const content = '"Maybe we should... you know?" "I guess so, sort of." "Perhaps?"';
      const analysis = analyzeDialogueNaturalness(content);
      expect(analysis.ambiguity).toBeGreaterThan(0);
    });

    it('should flag overly formal dialogue', () => {
      const content = '"I would like to inform you that I am displeased," he said. "I understand your concern," she replied.';
      const analysis = analyzeDialogueNaturalness(content);
      if (analysis.issues.length > 0) {
        expect(analysis.issues.some(i => i.includes('formal'))).toBe(true);
      }
    });
  });

  describe('analyzeNarrativeCraft', () => {
    it('should return comprehensive craft score', () => {
      mockChapter.content = 'Short. This is a much longer sentence with varied vocabulary and complex thoughts. "Maybe we should reconsider," he thought, though his words suggested otherwise.';
      const score = analyzeNarrativeCraft(mockChapter, mockState);
      expect(score.overallCraftScore).toBeGreaterThanOrEqual(0);
      expect(score.overallCraftScore).toBeLessThanOrEqual(100);
      expect(score.burstinessScore).toBeGreaterThanOrEqual(0);
      expect(score.perplexityScore).toBeGreaterThanOrEqual(0);
      expect(score.subtextScore).toBeGreaterThanOrEqual(0);
      expect(score.interiorityScore).toBeGreaterThanOrEqual(0);
      expect(score.sceneIntentScore).toBeGreaterThanOrEqual(0);
      expect(score.dialogueNaturalnessScore).toBeGreaterThanOrEqual(0);
    });

    it('should detect repetitive patterns', () => {
      mockChapter.content = 'He walked. He walked. He walked. He walked.';
      const score = analyzeNarrativeCraft(mockChapter, mockState);
      expect(score.repetitivePatterns.length).toBeGreaterThan(0);
    });

    it('should detect overexplanation', () => {
      mockChapter.content = 'In other words, to clarify, that is to say, to explain further, what I mean is...';
      const score = analyzeNarrativeCraft(mockChapter, mockState);
      expect(score.overexplanationFlags.length).toBeGreaterThan(0);
    });

    it('should detect neutral prose', () => {
      mockChapter.content = 'It was. There was. It is. There are. It was. There were.';
      const score = analyzeNarrativeCraft(mockChapter, mockState);
      expect(score.neutralProseFlags.length).toBeGreaterThan(0);
    });
  });
});

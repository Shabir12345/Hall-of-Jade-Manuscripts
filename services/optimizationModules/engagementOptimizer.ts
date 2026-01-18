import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeEngagement, EngagementAnalysis } from '../engagementAnalyzer';
import { ContextManager } from '../contextManager';

/**
 * Engagement Optimizer
 * Improves reader engagement through hook/cliffhanger audit and information dump conversion
 */
export class EngagementOptimizer {
  /**
   * Analyzes weaknesses in engagement
   */
  static analyzeWeaknesses(state: NovelState): {
    score: number;
    issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }>;
  } {
    // Use context-optimized state for large novels (engagement analysis needs hooks/endings, not full content)
    const stateForAnalysis = state.chapters.length > 40
      ? {
          ...state,
          chapters: state.chapters.map(ch => ({
            ...ch,
            // Keep first 500 chars (hook) and last 500 chars (cliffhanger) for engagement analysis
            content: ch.content.length > 1200
              ? ch.content.substring(0, 500) + '\n...\n' + ch.content.substring(ch.content.length - 500)
              : ch.content,
          })),
        }
      : state;
    
    const engagementAnalysis = analyzeEngagement(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Find weak hooks (first 200 words)
    const weakHooks = engagementAnalysis.metrics
      .filter(m => m.hookStrength < 60)
      .map(m => m.chapterNumber);

    if (weakHooks.length > 0) {
      issues.push({
        type: 'weak_hooks',
        description: `Weak chapter hooks in ${weakHooks.length} chapter(s)`,
        severity: weakHooks.length > state.chapters.length * 0.3 ? 'high' : 'medium',
        chaptersAffected: weakHooks,
        fix: 'Strengthen chapter openings with action, dialogue, or mystery',
      });
    }

    // Find weak cliffhangers
    const weakCliffhangers = engagementAnalysis.metrics
      .filter(m => m.cliffhangerEffectiveness < 60)
      .map(m => m.chapterNumber);

    if (weakCliffhangers.length > 0) {
      issues.push({
        type: 'weak_cliffhangers',
        description: `Weak cliffhangers in ${weakCliffhangers.length} chapter(s)`,
        severity: weakCliffhangers.length > state.chapters.length * 0.3 ? 'high' : 'medium',
        chaptersAffected: weakCliffhangers,
        fix: 'Add compelling chapter endings that create curiosity',
      });
    }

    // Find fatigue chapters
    if (engagementAnalysis.fatigueChapters.length > 0) {
      issues.push({
        type: 'fatigue',
        description: `Reader fatigue detected in ${engagementAnalysis.fatigueChapters.length} chapter(s)`,
        severity: engagementAnalysis.fatigueChapters.length > 2 ? 'high' : 'medium',
        chaptersAffected: engagementAnalysis.fatigueChapters.map(ch => ch.number),
        fix: 'Inject variety, action, or emotional beats to break monotony',
      });
    }

    // Detect information dumps (passive exposition)
    const infoDumpChapters = this.detectInformationDumps(state.chapters);

    if (infoDumpChapters.length > 0) {
      issues.push({
        type: 'information_dump',
        description: `Information dumps detected in ${infoDumpChapters.length} chapter(s)`,
        severity: 'high',
        chaptersAffected: infoDumpChapters,
        fix: 'Convert passive exposition to active dialogue or in-scene action',
      });
    }

    // Find low engagement chapters
    const lowEngagementChapters = engagementAnalysis.metrics
      .filter(m => m.overallEngagementScore < 50)
      .map(m => m.chapterNumber);

    if (lowEngagementChapters.length > 0) {
      issues.push({
        type: 'low_engagement',
        description: `Low overall engagement in ${lowEngagementChapters.length} chapter(s)`,
        severity: lowEngagementChapters.length > state.chapters.length * 0.2 ? 'critical' : 'high',
        chaptersAffected: lowEngagementChapters,
        fix: 'Improve multiple engagement factors: hooks, tension, emotional resonance',
      });
    }

    return {
      score: engagementAnalysis.overallEngagementScore,
      issues,
    };
  }

  /**
   * Detects information dumps (passive exposition)
   */
  private static detectInformationDumps(chapters: Chapter[]): number[] {
    const infoDumpChapters: number[] = [];

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      
      // Heuristics for information dumps:
      // 1. Long paragraphs without dialogue
      // 2. High ratio of "was/were" (passive voice)
      // 3. Lack of action verbs
      // 4. Excessive world-building terms in quick succession

      const paragraphs = content.split(/\n\n+/);
      const longParagraphs = paragraphs.filter(p => p.length > 500 && !p.includes('"'));
      
      const passiveVoiceCount = (content.match(/\b(was|were|is|are|been)\s+\w+ed\b/gi) || []).length;
      const totalWords = content.split(/\s+/).length;
      const passiveRatio = totalWords > 0 ? passiveVoiceCount / totalWords : 0;

      // Check for action verbs
      const actionVerbs = content.match(/\b(ran|jumped|fought|attacked|moved|grabbed|threw|struck)\b/gi) || [];
      const actionRatio = totalWords > 0 ? actionVerbs.length / totalWords : 0;

      // If chapter has many long paragraphs, high passive voice, and low action
      if (longParagraphs.length > 3 && passiveRatio > 0.05 && actionRatio < 0.01) {
        infoDumpChapters.push(chapter.number);
      }
    });

    return infoDumpChapters;
  }

  /**
   * Generates improvement interventions for engagement
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const engagementAnalysis = analyzeEngagement(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];

    // Fix weak hooks
    const weakHooks = engagementAnalysis.metrics
      .filter(m => m.hookStrength < 60)
      .map(m => {
        const chapter = chapters.find(ch => ch.id === m.chapterId);
        return { metric: m, chapter };
      })
      .filter(item => item.chapter)
      .slice(0, 10); // Limit to 10 chapters

    weakHooks.forEach(({ metric, chapter }) => {
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'beginning',
          improvementType: 'add_content',
          description: `Strengthen chapter hook (first 200 words). Add action, dialogue, or mystery to immediately engage readers. Current hook strength: ${metric.hookStrength}/100`,
          estimatedWordCount: 200,
        });
      }
    });

    // Fix weak cliffhangers
    const weakCliffhangers = engagementAnalysis.metrics
      .filter(m => m.cliffhangerEffectiveness < 60)
      .map(m => {
        const chapter = chapters.find(ch => ch.id === m.chapterId);
        return { metric: m, chapter };
      })
      .filter(item => item.chapter)
      .slice(0, 10);

    weakCliffhangers.forEach(({ metric, chapter }) => {
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'end',
          improvementType: 'add_content',
          description: `Add compelling cliffhanger ending. Create curiosity, incomplete action, or revelation that makes readers want to continue. Current cliffhanger effectiveness: ${metric.cliffhangerEffectiveness}/100`,
          estimatedWordCount: 150,
        });
      }
    });

    // Fix fatigue chapters
    engagementAnalysis.fatigueChapters.slice(0, 5).forEach((chapter) => {
      editActions.push({
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        section: 'throughout',
        improvementType: 'enhance_quality',
        description: 'Break reader fatigue by injecting variety: add action, emotional beats, or change pacing. Vary scene types and narrative rhythm.',
        estimatedWordCount: 300,
      });
    });

    // Convert information dumps
    const infoDumpChapters = this.detectInformationDumps(chapters);
    infoDumpChapters.slice(0, 5).forEach((chapterNumber) => {
      const chapter = chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'modify_content',
          description: 'Convert passive information dumps to active scenes. Replace exposition with dialogue, action, or in-scene revelation. Show, don\'t tell.',
          estimatedWordCount: 400,
        });
      }
    });

    // Fix low engagement chapters (comprehensive improvement)
    const lowEngagementChapters = engagementAnalysis.metrics
      .filter(m => m.overallEngagementScore < 50)
      .map(m => {
        const chapter = chapters.find(ch => ch.id === m.chapterId);
        return { metric: m, chapter };
      })
      .filter(item => item.chapter && !editActions.some(a => a.chapterId === item.chapter!.id))
      .slice(0, 5);

    lowEngagementChapters.forEach(({ metric, chapter }) => {
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: `Comprehensive engagement improvement. Strengthen hook (${metric.hookStrength}/100), cliffhanger (${metric.cliffhangerEffectiveness}/100), emotional resonance (${metric.emotionalResonance}/100), and tension (${metric.tensionLevel}/100). Current overall: ${metric.overallEngagementScore}/100`,
          estimatedWordCount: 500,
        });
      }
    });

    // Calculate expected improvement
    const currentScore = engagementAnalysis.overallEngagementScore;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor(editActions.length * 2.5))
    );

    return {
      id: generateUUID(),
      category: 'engagement',
      priority: editActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve reader engagement: strengthen hooks, cliffhangers, eliminate fatigue, convert information dumps`,
      rationale: `Current engagement score is ${currentScore}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: editActions.length > 0 ? editActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: editActions.length > 5 ? 'high' : editActions.length > 2 ? 'medium' : 'low',
      chaptersAffected: editActions.map(a => a.chapterNumber),
      expectedImprovement,
    };
  }
}

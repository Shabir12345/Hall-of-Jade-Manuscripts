import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeTension } from '../tensionAnalyzer';
import { ContextManager } from '../contextManager';

/**
 * Tension Optimizer
 * Improves tension through conflict escalation and stakes multiplier
 */
export class TensionOptimizer {
  /**
   * Analyzes weaknesses in tension
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
    // Use context-optimized state for large novels (tension analysis uses summaries effectively)
    const stateForAnalysis = state.chapters.length > 40
      ? {
          ...state,
          chapters: state.chapters.map(ch => ({
            ...ch,
            content: ch.summary || ch.content.substring(0, 1500), // Use summaries or truncated content
          })),
        }
      : state;
    
    const tensionAnalysis = analyzeTension(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check overall tension score
    if (tensionAnalysis.overallTensionScore < 60) {
      issues.push({
        type: 'low_tension',
        description: `Overall tension score is ${tensionAnalysis.overallTensionScore}/100`,
        severity: tensionAnalysis.overallTensionScore < 40 ? 'critical' : 'high',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Increase conflict and stakes throughout the novel',
      });
    }

    // Check tension-release balance
    if (tensionAnalysis.tensionReleaseBalance < 60) {
      issues.push({
        type: 'tension_balance',
        description: `Tension-release balance is ${tensionAnalysis.tensionReleaseBalance}/100`,
        severity: 'high',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Improve balance between tension and release moments',
      });
    }

    // Find low-tension chapters
    const lowTensionChapters = tensionAnalysis.tensionCurve
      .filter(point => point.tensionLevel < 40)
      .map(point => point.chapterNumber);

    if (lowTensionChapters.length > 0) {
      issues.push({
        type: 'low_tension_chapters',
        description: `Low tension detected in ${lowTensionChapters.length} chapter(s)`,
        severity: lowTensionChapters.length > state.chapters.length * 0.2 ? 'high' : 'medium',
        chaptersAffected: lowTensionChapters,
        fix: 'Inject micro-tensions, conflicts, or external threats',
      });
    }

    // Find chapters with low interpersonal friction
    const lowFrictionChapters = this.detectLowFriction(state.chapters);

    if (lowFrictionChapters.length > 0) {
      issues.push({
        type: 'low_friction',
        description: `Low interpersonal friction in ${lowFrictionChapters.length} chapter(s)`,
        severity: 'medium',
        chaptersAffected: lowFrictionChapters,
        fix: 'Add conflicts, misunderstandings, or interpersonal tension',
      });
    }

    return {
      score: tensionAnalysis.overallTensionScore,
      issues,
    };
  }

  /**
   * Detects chapters with low interpersonal friction
   */
  private static detectLowFriction(chapters: Chapter[]): number[] {
    const lowFrictionChapters: number[] = [];

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      const lowerContent = content.toLowerCase();

      // Indicators of conflict/friction
      const conflictIndicators = [
        'argued', 'disagreed', 'confronted', 'challenged', 'opposed',
        'tension', 'strain', 'hostile', 'angry', 'frustrated',
        'misunderstanding', 'dispute', 'quarrel', 'clash'
      ];

      const conflictCount = conflictIndicators.filter(indicator => lowerContent.includes(indicator)).length;
      const totalWords = content.split(/\s+/).length;
      const conflictRatio = totalWords > 0 ? conflictCount / totalWords : 0;

      // If very low conflict ratio, mark as low friction
      if (conflictRatio < 0.002 && totalWords > 500) {
        lowFrictionChapters.push(chapter.number);
      }
    });

    return lowFrictionChapters;
  }

  /**
   * Generates improvement interventions for tension
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const tensionAnalysis = analyzeTension(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];

    // Fix low-tension chapters
    const lowTensionChapters = tensionAnalysis.tensionCurve
      .filter(point => point.tensionLevel < 40)
      .slice(0, 10);

    lowTensionChapters.forEach((point) => {
      const chapter = chapters.find(ch => ch.number === point.chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'middle',
          improvementType: 'add_content',
          description: `Inject micro-tensions and escalate conflict. Add small conflicts, misunderstandings, or external threats to raise tension from ${point.tensionLevel}/100.`,
          estimatedWordCount: 300,
        });
      }
    });

    // Fix low friction chapters
    const lowFrictionChapters = this.detectLowFriction(chapters);
    lowFrictionChapters.slice(0, 5).forEach((chapterNumber) => {
      const chapter = chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'add_content',
          description: 'Add interpersonal friction: conflicts, disagreements, misunderstandings, or character tensions to increase dramatic tension.',
          estimatedWordCount: 250,
        });
      }
    });

    // Escalate existing conflicts (for chapters with medium tension)
    const mediumTensionChapters = tensionAnalysis.tensionCurve
      .filter(point => point.tensionLevel >= 40 && point.tensionLevel < 60)
      .slice(0, 5);

    mediumTensionChapters.forEach((point) => {
      const chapter = chapters.find(ch => ch.number === point.chapterNumber);
      if (chapter && !editActions.some(a => a.chapterId === chapter.id)) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: `Escalate existing conflicts using stakes multiplier. Raise the consequences and urgency of conflicts to increase tension.`,
          estimatedWordCount: 200,
        });
      }
    });

    // Fix tension-release balance (add release moments if too tense, add tension if too relaxed)
    if (tensionAnalysis.tensionReleaseBalance < 60) {
      // Find chapters that are too tense (need release)
      const overTenseChapters = tensionAnalysis.tensionCurve
        .filter(point => point.tensionLevel > 80)
        .slice(0, 3);

      overTenseChapters.forEach((point) => {
        const chapter = chapters.find(ch => ch.number === point.chapterNumber);
        if (chapter && !editActions.some(a => a.chapterId === chapter.id)) {
          editActions.push({
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            section: 'end',
            improvementType: 'add_content',
            description: 'Add brief release moment to balance tension. Allow small victories or moments of relief before next conflict.',
            estimatedWordCount: 100,
          });
        }
      });
    }

    // Calculate expected improvement
    const currentScore = tensionAnalysis.overallTensionScore;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor(editActions.length * 2))
    );

    return {
      id: generateUUID(),
      category: 'tension',
      priority: editActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve tension: escalate conflicts, inject micro-tensions, fix tension-release balance`,
      rationale: `Current tension score is ${currentScore}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: editActions.length > 0 ? editActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: editActions.length > 5 ? 'high' : editActions.length > 2 ? 'medium' : 'low',
      chaptersAffected: editActions.map(a => a.chapterNumber),
      expectedImprovement,
    };
  }
}

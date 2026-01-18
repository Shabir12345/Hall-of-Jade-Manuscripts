import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeCharacterPsychology } from '../characterPsychologyService';
import { ContextManager } from '../contextManager';

/**
 * Psychology Optimizer
 * Improves character psychology through internal dialectic and logical gap fixing
 */
export class PsychologyOptimizer {
  /**
   * Analyzes weaknesses in character psychology
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
    // Psychology analysis needs dialogue and internal monologue - use character-focused content
    const stateForAnalysis = state.chapters.length > 40
      ? {
          ...state,
          chapters: state.chapters.map(ch => ({
            ...ch,
            content: ch.summary || ch.content.substring(0, 2500), // Keep more for psychology
          })),
        }
      : state;
    
    const psychologyAnalysis = analyzeCharacterPsychology(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check character growth trajectories
    if (psychologyAnalysis.growthTrajectories.length === 0) {
      issues.push({
        type: 'no_growth',
        description: 'No character growth trajectories detected',
        severity: 'critical',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Develop character growth arcs and psychological development',
      });
    }

    // Find characters with low growth scores
    const lowGrowthCharacters = psychologyAnalysis.growthTrajectories
      .filter(t => t.overallGrowthScore < 50)
      .map(t => t.characterName);

    if (lowGrowthCharacters.length > 0) {
      issues.push({
        type: 'low_growth',
        description: `Low character growth for: ${lowGrowthCharacters.join(', ')}`,
        severity: 'high',
        chaptersAffected: [],
        fix: 'Deepen character development and psychological growth',
      });
    }

    // Find chapters with logical gaps (actions without motivation)
    const logicalGapChapters = this.detectLogicalGaps(state.chapters);

    if (logicalGapChapters.length > 0) {
      issues.push({
        type: 'logical_gaps',
        description: `Logical gaps (unclear motivations) in ${logicalGapChapters.length} chapter(s)`,
        severity: 'high',
        chaptersAffected: logicalGapChapters,
        fix: 'Add thought processes or visceral reactions before major actions',
      });
    }

    // Find chapters lacking internal monologue
    const weakInternalMonologue = this.detectWeakInternalMonologue(state.chapters);

    if (weakInternalMonologue.length > 0) {
      issues.push({
        type: 'weak_internal_monologue',
        description: `Weak internal monologue in ${weakInternalMonologue.length} chapter(s)`,
        severity: 'medium',
        chaptersAffected: weakInternalMonologue,
        fix: 'Deepen internal monologue and character thoughts',
      });
    }

    return {
      score: psychologyAnalysis.growthTrajectories.length > 0
        ? psychologyAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / psychologyAnalysis.growthTrajectories.length
        : 30,
      issues,
    };
  }

  /**
   * Detects logical gaps (actions without clear motivation)
   */
  private static detectLogicalGaps(chapters: Chapter[]): number[] {
    const gapChapters: number[] = [];

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      
      // Look for action verbs without preceding thought/emotion indicators
      const actionVerbs = content.match(/\b(decided|chose|acted|moved|attacked|fled|confronted)\b/gi) || [];
      const thoughtIndicators = content.match(/\b(thought|realized|felt|understood|knew|remembered|wondered|considered)\b/gi) || [];
      const emotionIndicators = content.match(/\b(angry|frustrated|afraid|determined|resolved|desperate)\b/gi) || [];

      // If many actions but few thoughts/emotions, likely logical gaps
      if (actionVerbs.length > 3 && (thoughtIndicators.length + emotionIndicators.length) < actionVerbs.length * 0.5) {
        gapChapters.push(chapter.number);
      }
    });

    return gapChapters;
  }

  /**
   * Detects chapters with weak internal monologue
   */
  private static detectWeakInternalMonologue(chapters: Chapter[]): number[] {
    const weakChapters: number[] = [];

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      const lowerContent = content.toLowerCase();

      // Indicators of internal monologue
      const internalIndicators = [
        'thought', 'realized', 'wondered', 'considered', 'felt',
        'knew', 'remembered', 'understood', 'believed', 'hoped',
        'feared', 'doubted', 'questioned'
      ];

      const indicatorCount = internalIndicators.filter(indicator => lowerContent.includes(indicator)).length;
      const totalWords = content.split(/\s+/).length;
      const internalRatio = totalWords > 0 ? indicatorCount / totalWords : 0;

      // If very low internal monologue, mark as weak
      if (internalRatio < 0.003 && totalWords > 500) {
        weakChapters.push(chapter.number);
      }
    });

    return weakChapters;
  }

  /**
   * Generates improvement interventions for psychology
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const psychologyAnalysis = analyzeCharacterPsychology(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];

    // Fix logical gaps
    const logicalGapChapters = this.detectLogicalGaps(chapters);
    logicalGapChapters.slice(0, 10).forEach((chapterNumber) => {
      const chapter = chapters.find(ch => ch.number === chapterNumber);
      if (chapter) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'add_content',
          description: 'Add thought processes or visceral reactions before major actions. Fix logical gaps by showing character motivations and internal reasoning.',
          estimatedWordCount: 300,
        });
      }
    });

    // Enhance internal monologue
    const weakInternalMonologue = this.detectWeakInternalMonologue(chapters);
    weakInternalMonologue.slice(0, 8).forEach((chapterNumber) => {
      const chapter = chapters.find(ch => ch.number === chapterNumber);
      if (chapter && !editActions.some(a => a.chapterId === chapter.id)) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'add_content',
          description: 'Deepen internal monologue. Add character thoughts, reflections, and internal dialogue to reveal psychology and motivations.',
          estimatedWordCount: 250,
        });
      }
    });

    // Enhance character growth (for low-growth characters)
    if (psychologyAnalysis.growthTrajectories.length > 0) {
      const lowGrowthTrajectories = psychologyAnalysis.growthTrajectories
        .filter(t => t.overallGrowthScore < 50)
        .slice(0, 3);

      lowGrowthTrajectories.forEach((trajectory) => {
        // Find key chapters in the trajectory
        const keyChapters = trajectory.trajectory
          .filter(p => p.chapterNumber !== undefined)
          .map(p => p.chapterNumber!)
          .slice(0, 3);

        keyChapters.forEach((chapterNumber) => {
          const chapter = chapters.find(ch => ch.number === chapterNumber);
          if (chapter && !editActions.some(a => a.chapterId === chapter.id)) {
            editActions.push({
              chapterId: chapter.id,
              chapterNumber: chapter.number,
              section: 'middle',
              improvementType: 'add_content',
              description: `Enhance character growth for ${trajectory.characterName}. Add psychological development, internal conflict, or character evolution moments.`,
              estimatedWordCount: 300,
            });
          }
        });
      });
    }

    // Enhance character voice consistency
    const protagonist = state.characterCodex.find(c => c.isProtagonist);
    if (protagonist) {
      // Add character voice to chapters where protagonist appears but voice is weak
      const protagonistChapters = chapters.slice(0, 5); // Sample first 5 chapters
      protagonistChapters.forEach((chapter) => {
        if (!editActions.some(a => a.chapterId === chapter.id)) {
          const hasProtagonistVoice = chapter.content.toLowerCase().includes(protagonist.name.toLowerCase());
          if (hasProtagonistVoice) {
            editActions.push({
              chapterId: chapter.id,
              chapterNumber: chapter.number,
              section: 'throughout',
              improvementType: 'enhance_quality',
              description: `Enhance ${protagonist.name}'s voice consistency. Ensure dialogue and internal thoughts match established personality.`,
              estimatedWordCount: 200,
            });
          }
        }
      });
    }

    // Calculate expected improvement
    const currentScore = psychologyAnalysis.growthTrajectories.length > 0
      ? psychologyAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / psychologyAnalysis.growthTrajectories.length
      : 30;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor(editActions.length * 2.5))
    );

    return {
      id: generateUUID(),
      category: 'character',
      priority: editActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve character psychology: fix logical gaps, deepen internal monologue, enhance character growth, improve voice consistency`,
      rationale: `Current psychology score is ${currentScore.toFixed(1)}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: editActions.length > 0 ? editActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: editActions.length > 5 ? 'high' : editActions.length > 2 ? 'medium' : 'low',
      chaptersAffected: editActions.map(a => a.chapterNumber),
      expectedImprovement,
    };
  }
}

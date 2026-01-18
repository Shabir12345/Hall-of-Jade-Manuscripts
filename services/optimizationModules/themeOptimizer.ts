import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeThemeEvolution, ThemeAnalysis } from '../themeAnalyzer';
import { ContextManager } from '../contextManager';

/**
 * Theme Optimizer
 * Improves themes through motif injection and symbolic language weaving
 */
export class ThemeOptimizer {
  /**
   * Analyzes weaknesses in themes
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
    // Use context-optimized state for large novels (theme analysis works with summaries)
    const stateForAnalysis = state.chapters.length > 40
      ? {
          ...state,
          chapters: state.chapters.map(ch => ({
            ...ch,
            content: ch.summary || ch.content.substring(0, 2000), // Themes need more context than tension
          })),
        }
      : state;
    
    const themeAnalysis = analyzeThemeEvolution(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check if primary themes exist
    if (themeAnalysis.primaryThemes.length === 0) {
      issues.push({
        type: 'no_primary_themes',
        description: 'No primary themes established',
        severity: 'critical',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Establish and develop primary themes throughout the novel',
      });
    }

    // Check theme consistency
    if (themeAnalysis.overallConsistencyScore < 70) {
      issues.push({
        type: 'theme_consistency',
        description: `Theme consistency is ${themeAnalysis.overallConsistencyScore}/100`,
        severity: themeAnalysis.overallConsistencyScore < 50 ? 'high' : 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Weave themes more consistently throughout chapters',
      });
    }

    // Check philosophical depth
    if (themeAnalysis.philosophicalDepthScore < 60) {
      issues.push({
        type: 'philosophical_depth',
        description: `Philosophical depth is ${themeAnalysis.philosophicalDepthScore}/100`,
        severity: 'medium',
        chaptersAffected: state.chapters.map(ch => ch.number),
        fix: 'Deepen thematic exploration and add symbolic language',
      });
    }

    // Find chapters with weak theme presence
    const weakThemeChapters = this.detectWeakThemePresence(state.chapters, themeAnalysis);

    if (weakThemeChapters.length > 0) {
      issues.push({
        type: 'weak_theme_presence',
        description: `Weak theme presence in ${weakThemeChapters.length} chapter(s)`,
        severity: weakThemeChapters.length > state.chapters.length * 0.3 ? 'high' : 'medium',
        chaptersAffected: weakThemeChapters,
        fix: 'Inject thematic elements, motifs, or symbolic language',
      });
    }

    return {
      score: (themeAnalysis.overallConsistencyScore + themeAnalysis.philosophicalDepthScore) / 2,
      issues,
    };
  }

  /**
   * Detects chapters with weak theme presence
   */
  private static detectWeakThemePresence(
    chapters: Chapter[],
    themeAnalysis: ThemeAnalysis
  ): number[] {
    const weakChapters: number[] = [];

    if (themeAnalysis.primaryThemes.length === 0) {
      return chapters.map(ch => ch.number);
    }

    // Get primary theme keywords
    const primaryThemeKeywords = themeAnalysis.primaryThemes
      .flatMap(theme => (theme.themeName || '').toLowerCase().split(/\s+/))
      .filter(word => word.length > 3);

    chapters.forEach((chapter) => {
      const content = chapter.content || '';
      const lowerContent = content.toLowerCase();

      // Count theme keyword mentions
      const themeMentions = primaryThemeKeywords.filter(keyword => lowerContent.includes(keyword)).length;
      const totalWords = content.split(/\s+/).length;
      const themeRatio = totalWords > 0 ? themeMentions / totalWords : 0;

      // If very low theme presence, mark as weak
      if (themeRatio < 0.001 && totalWords > 500) {
        weakChapters.push(chapter.number);
      }
    });

    return weakChapters;
  }

  /**
   * Generates improvement interventions for themes
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const themeAnalysis = analyzeThemeEvolution(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];

    // If no primary themes, establish them
    if (themeAnalysis.primaryThemes.length === 0) {
      // Add thematic content to early chapters
      const earlyChapters = chapters.slice(0, 3);
      earlyChapters.forEach((chapter) => {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'middle',
          improvementType: 'add_content',
          description: 'Establish primary themes through dialogue, action, or symbolic elements. Introduce central thematic questions or motifs.',
          estimatedWordCount: 300,
        });
      });
    } else {
      // Weave themes into weak chapters
      const weakThemeChapters = this.detectWeakThemePresence(chapters, themeAnalysis);
      const primaryTheme = themeAnalysis.primaryThemes[0];

      if (primaryTheme && primaryTheme.themeName) {
        weakThemeChapters.slice(0, 10).forEach((chapterNumber) => {
          const chapter = chapters.find(ch => ch.number === chapterNumber);
          if (chapter) {
            editActions.push({
              chapterId: chapter.id,
              chapterNumber: chapter.number,
              section: 'throughout',
              improvementType: 'add_content',
              description: `Weave primary theme "${primaryTheme.themeName}" into this chapter through symbolic language, recurring metaphors, or thematic dialogue. Enhance thematic resonance.`,
              estimatedWordCount: 250,
            });
          }
        });
      }
    }

    // Enhance philosophical depth
    if (themeAnalysis.philosophicalDepthScore < 60) {
      // Add thematic depth to key chapters (midpoint, climax)
      const midpointChapter = chapters[Math.floor(chapters.length * 0.5)];
      const climaxChapter = chapters[Math.floor(chapters.length * 0.9)];

      [midpointChapter, climaxChapter].forEach((chapter) => {
        if (chapter && !editActions.some(a => a.chapterId === chapter.id)) {
          editActions.push({
            chapterId: chapter.id,
            chapterNumber: chapter.number,
            section: 'middle',
            improvementType: 'add_content',
            description: 'Deepen philosophical exploration of themes. Add symbolic language, thematic dialogue, or moments of thematic revelation.',
            estimatedWordCount: 300,
          });
        }
      });
    }

    // Fix theme consistency
    if (themeAnalysis.overallConsistencyScore < 70) {
      // Add thematic elements to chapters that lack them
      const inconsistentChapters = chapters
        .filter(ch => !editActions.some(a => a.chapterId === ch.id))
        .slice(0, 5);

      inconsistentChapters.forEach((chapter) => {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'add_content',
          description: 'Add thematic consistency by weaving primary themes into descriptions, dialogue, or character actions.',
          estimatedWordCount: 200,
        });
      });
    }

    // Calculate expected improvement
    const currentScore = (themeAnalysis.overallConsistencyScore + themeAnalysis.philosophicalDepthScore) / 2;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor(editActions.length * 2))
    );

    return {
      id: generateUUID(),
      category: 'theme',
      priority: editActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve themes: establish primary themes, weave motifs, enhance philosophical depth, improve consistency`,
      rationale: `Current theme score is ${currentScore.toFixed(1)}/100. Target is ${targetScore}/100.`,
      strategyType: 'edit',
      editActions: editActions.length > 0 ? editActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: editActions.length > 5 ? 'high' : editActions.length > 2 ? 'medium' : 'low',
      chaptersAffected: editActions.map(a => a.chapterNumber),
      expectedImprovement,
    };
  }
}

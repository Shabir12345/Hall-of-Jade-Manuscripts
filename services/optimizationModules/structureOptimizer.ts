import { NovelState, Chapter } from '../../types';
import { ImprovementStrategy, EditAction, InsertAction, CategoryWeaknessAnalysis } from '../../types/improvement';
import { generateUUID } from '../../utils/uuid';
import { analyzeStoryStructure, StoryStructureAnalysis } from '../storyStructureAnalyzer';
import { analyzeHeroJourney, HeroJourneyAnalysis } from '../heroJourneyTracker';
import { ContextManager } from '../contextManager';

/**
 * Structure Optimizer
 * Improves story structure using beat-mapping against 3-Act Structure and Hero's Journey
 */
export class StructureOptimizer {
  /**
   * Analyzes weaknesses in story structure
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
    // Use optimal context config for large novels (structure analysis needs chapter metadata, not full content)
    const contextConfig = ContextManager.getOptimalContextConfig(state);
    const stateForAnalysis = state.chapters.length > 40 
      ? { ...state, chapters: state.chapters.map(ch => ({ ...ch, content: ch.summary || ch.title })) } // Use summaries for analysis
      : state;
    
    const structureAnalysis = analyzeStoryStructure(stateForAnalysis);
    const heroJourney = analyzeHeroJourney(stateForAnalysis);
    
    const issues: Array<{
      type: string;
      description: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      chaptersAffected: number[];
      fix: string;
    }> = [];

    // Check act proportions
    const act1Percent = structureAnalysis.threeActStructure.act1.percentage;
    const act2Percent = structureAnalysis.threeActStructure.act2.percentage;
    const act3Percent = structureAnalysis.threeActStructure.act3.percentage;

    if (act1Percent < 20 || act1Percent > 30) {
      issues.push({
        type: 'act_proportion',
        description: `Act 1 is ${act1Percent.toFixed(1)}% (should be ~25%)`,
        severity: act1Percent < 15 || act1Percent > 35 ? 'high' : 'medium',
        chaptersAffected: Array.from({ length: structureAnalysis.threeActStructure.act1.endChapter }, (_, i) => i + 1),
        fix: act1Percent < 20 ? 'Add content to Act 1' : 'Condense Act 1',
      });
    }

    if (act2Percent < 45 || act2Percent > 55) {
      issues.push({
        type: 'act_proportion',
        description: `Act 2 is ${act2Percent.toFixed(1)}% (should be ~50%)`,
        severity: act2Percent < 40 || act2Percent > 60 ? 'high' : 'medium',
        chaptersAffected: Array.from(
          { length: structureAnalysis.threeActStructure.act2.endChapter - structureAnalysis.threeActStructure.act2.startChapter + 1 },
          (_, i) => structureAnalysis.threeActStructure.act2.startChapter + i
        ),
        fix: act2Percent < 45 ? 'Add content to Act 2' : 'Condense Act 2',
      });
    }

    // Check for missing key beats
    const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax'];
    const detectedBeatTypes = structureAnalysis.detectedBeats.map(b => b.type);
    const missingBeats = requiredBeats.filter(beat => !detectedBeatTypes.includes(beat));

    if (missingBeats.length > 0) {
      issues.push({
        type: 'missing_beats',
        description: `Missing structural beats: ${missingBeats.join(', ')}`,
        severity: 'critical',
        chaptersAffected: [],
        fix: 'Add missing structural beats at appropriate chapters',
      });
    }

    // Check Hero's Journey completion
    if (heroJourney.completionPercentage < 70) {
      issues.push({
        type: 'hero_journey',
        description: `Hero's Journey only ${heroJourney.completionPercentage.toFixed(0)}% complete`,
        severity: heroJourney.missingStages.length > 4 ? 'high' : 'medium',
        chaptersAffected: [],
        fix: 'Add missing Hero\'s Journey stages',
      });
    }

    // Check for pacing sags (chapters with low structural score)
    const chapters = state.chapters.sort((a, b) => a.number - b.number);
    const pacingSags: number[] = [];
    
    chapters.forEach((chapter, index) => {
      // Simple heuristic: chapters without logic audit or very short chapters
      if (!chapter.logicAudit && chapter.content.length < 1000) {
        pacingSags.push(chapter.number);
      }
    });

    if (pacingSags.length > 0) {
      issues.push({
        type: 'pacing_sag',
        description: `Pacing sags detected in chapters: ${pacingSags.slice(0, 5).join(', ')}`,
        severity: pacingSags.length > 3 ? 'high' : 'medium',
        chaptersAffected: pacingSags,
        fix: 'Strengthen pacing in affected chapters or add bridge content',
      });
    }

    return {
      score: structureAnalysis.overallStructureScore,
      issues,
    };
  }

  /**
   * Generates improvement interventions for structure
   */
  static generateInterventions(
    state: NovelState,
    weaknesses: CategoryWeaknessAnalysis,
    targetScore: number
  ): ImprovementStrategy {
    const structureAnalysis = analyzeStoryStructure(state);
    const heroJourney = analyzeHeroJourney(state);
    const chapters = state.chapters.sort((a, b) => a.number - b.number);

    const editActions: EditAction[] = [];
    const insertActions: InsertAction[] = [];

    // Fix act proportions by inserting chapters
    const act1Percent = structureAnalysis.threeActStructure.act1.percentage;
    const act2Percent = structureAnalysis.threeActStructure.act2.percentage;

    if (act1Percent < 20 && chapters.length > 0) {
      // Need to add content to Act 1
      const insertPosition = Math.floor(structureAnalysis.threeActStructure.act1.endChapter * 0.5);
      insertActions.push({
        position: insertPosition,
        chapterCount: 1,
        purpose: 'Expand Act 1 to meet proper structural proportions. Add character development and world-building.',
        estimatedWordCount: 1500,
      });
    }

    if (act2Percent < 45 && chapters.length > 0) {
      // Need to add content to Act 2
      const insertPosition = Math.floor(
        (structureAnalysis.threeActStructure.act2.startChapter + structureAnalysis.threeActStructure.act2.endChapter) / 2
      );
      insertActions.push({
        position: insertPosition,
        chapterCount: 1,
        purpose: 'Expand Act 2 to meet proper structural proportions. Add rising action and character development.',
        estimatedWordCount: 1500,
      });
    }

    // Add missing structural beats
    const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax'];
    const detectedBeatTypes = structureAnalysis.detectedBeats.map(b => b.type);
    const missingBeats = requiredBeats.filter(beat => !detectedBeatTypes.includes(beat));

    missingBeats.forEach((beatType) => {
      const targetChapter = this.findBestChapterForBeat(beatType, structureAnalysis, chapters);
      if (targetChapter) {
        editActions.push({
          chapterId: targetChapter.id,
          chapterNumber: targetChapter.number,
          section: beatType === 'inciting_incident' ? 'beginning' : beatType === 'climax' ? 'end' : 'middle',
          improvementType: 'add_content',
          description: `Add ${beatType.replace(/_/g, ' ')} beat to strengthen structure`,
          estimatedWordCount: 300,
        });
      }
    });

    // Fix pacing sags
    chapters.forEach((chapter) => {
      if (!chapter.logicAudit && chapter.content.length < 1000) {
        editActions.push({
          chapterId: chapter.id,
          chapterNumber: chapter.number,
          section: 'throughout',
          improvementType: 'enhance_quality',
          description: 'Strengthen pacing and add structural elements to eliminate sag',
          estimatedWordCount: 500,
        });
      }
    });

    // Add missing Hero's Journey stages
    if (heroJourney.missingStages.length > 0) {
      const firstMissingStage = heroJourney.missingStages[0];
      const targetChapter = this.findBestChapterForHeroJourneyStage(firstMissingStage, chapters);
      
      if (targetChapter) {
        editActions.push({
          chapterId: targetChapter.id,
          chapterNumber: targetChapter.number,
          section: 'middle',
          improvementType: 'add_content',
          description: `Add Hero's Journey stage ${firstMissingStage} to strengthen narrative structure`,
          estimatedWordCount: 400,
        });
      }
    }

    // Calculate expected improvement
    const currentScore = structureAnalysis.overallStructureScore;
    const expectedImprovement = Math.min(
      targetScore - currentScore,
      Math.max(10, Math.floor((editActions.length * 3 + insertActions.length * 5)))
    );

    return {
      id: generateUUID(),
      category: 'structure',
      priority: editActions.length > 0 || insertActions.length > 0 ? 'high' : 'low',
      targetScore: currentScore,
      goalScore: targetScore,
      description: `Improve story structure: fix act proportions, add missing beats, strengthen pacing`,
      rationale: `Current structure score is ${currentScore}/100. Target is ${targetScore}/100.`,
      strategyType: editActions.length > 0 && insertActions.length > 0 ? 'hybrid' : editActions.length > 0 ? 'edit' : 'insert',
      editActions: editActions.length > 0 ? editActions : undefined,
      insertActions: insertActions.length > 0 ? insertActions : undefined,
      estimatedImpact: expectedImprovement > 15 ? 'high' : expectedImprovement > 8 ? 'medium' : 'low',
      estimatedEffort: (editActions.length + insertActions.length) > 5 ? 'high' : (editActions.length + insertActions.length) > 2 ? 'medium' : 'low',
      chaptersAffected: [...new Set([...editActions.map(a => a.chapterNumber), ...insertActions.flatMap(a => Array.from({ length: a.chapterCount }, (_, i) => a.position + i + 1))])],
      expectedImprovement,
    };
  }

  /**
   * Finds the best chapter to add a structural beat
   */
  private static findBestChapterForBeat(
    beatType: string,
    structureAnalysis: StoryStructureAnalysis,
    chapters: Chapter[]
  ): Chapter | null {
    // Map beat types to ideal positions
    const beatPositions: Record<string, number> = {
      'inciting_incident': Math.floor(structureAnalysis.threeActStructure.act1.endChapter * 0.3),
      'plot_point_1': structureAnalysis.threeActStructure.act1.endChapter,
      'midpoint': Math.floor((structureAnalysis.threeActStructure.act2.startChapter + structureAnalysis.threeActStructure.act2.endChapter) / 2),
      'plot_point_2': structureAnalysis.threeActStructure.act2.endChapter,
      'climax': Math.floor((structureAnalysis.threeActStructure.act3.startChapter + structureAnalysis.threeActStructure.act3.endChapter) * 0.8),
    };

    const targetPosition = beatPositions[beatType];
    if (!targetPosition || targetPosition < 1 || targetPosition > chapters.length) {
      return chapters[0] || null;
    }

    return chapters.find(ch => ch.number === targetPosition) || chapters[Math.min(targetPosition - 1, chapters.length - 1)] || null;
  }

  /**
   * Finds the best chapter to add a Hero's Journey stage
   */
  private static findBestChapterForHeroJourneyStage(
    stageNumber: number,
    chapters: Chapter[]
  ): Chapter | null {
    // Map stages to approximate positions (0-1 ratio)
    const stagePositions: Record<number, number> = {
      1: 0.05,  // Ordinary World - very early
      2: 0.10,  // Call to Adventure
      3: 0.15,  // Refusal of Call
      4: 0.20,  // Meeting the Mentor
      5: 0.25,  // Crossing the Threshold
      6: 0.40,  // Tests, Allies, and Enemies
      7: 0.60,  // Approach to the Inmost Cave
      8: 0.75,  // Ordeal
      9: 0.80,  // Reward
      10: 0.85, // The Road Back
      11: 0.90, // Resurrection
      12: 0.95, // Return with the Elixir
    };

    const ratio = stagePositions[stageNumber];
    if (ratio === undefined || chapters.length === 0) {
      return chapters[0] || null;
    }

    const targetIndex = Math.floor(chapters.length * ratio);
    return chapters[Math.min(targetIndex, chapters.length - 1)] || null;
  }
}

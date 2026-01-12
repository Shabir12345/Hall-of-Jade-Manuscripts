import { NovelState, DraftVersion } from './types';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';
import { analyzeCharacterPsychology } from './characterPsychologyService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeProseQuality } from './proseQualityService';
import { analyzeOriginality } from './originalityDetector';
import { analyzeLiteraryDevices } from './literaryDeviceAnalyzer';
import { analyzeTension } from './tensionAnalyzer';
import { analyzeConflicts } from './conflictTracker';

/**
 * Revision Planner
 * Identifies revision priorities and generates revision strategies
 */

export interface RevisionStrategy {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: 'structure' | 'theme' | 'character' | 'prose' | 'engagement' | 'tension' | 'other';
  description: string;
  rationale: string;
  suggestedActions: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
  chaptersAffected?: number[];
}

export interface RevisionPlan {
  strategies: RevisionStrategy[];
  priorityOrder: RevisionStrategy[];
  estimatedEffort: 'low' | 'medium' | 'high';
  expectedImprovement: number; // Estimated quality score improvement
  recommendations: string[];
}

/**
 * Generates revision plan for a draft
 */
export function generateRevisionPlan(state: NovelState, draftVersion?: DraftVersion): RevisionPlan {
  // Perform comprehensive analysis
  const structureAnalysis = analyzeStoryStructure(state);
  const themeAnalysis = analyzeThemeEvolution(state);
  const characterAnalysis = analyzeCharacterPsychology(state);
  const engagementAnalysis = analyzeEngagement(state);
  const proseQuality = analyzeProseQuality(state);
  const originality = analyzeOriginality(state);
  const literaryDevices = analyzeLiteraryDevices(state);
  const tensionAnalysis = analyzeTension(state);
  const conflictAnalysis = analyzeConflicts(state);

  // Generate revision strategies based on weaknesses
  const strategies: RevisionStrategy[] = [];

  // Structure strategies
  if (structureAnalysis.overallStructureScore < 70) {
    strategies.push(...generateStructureStrategies(structureAnalysis, state));
  }

  // Theme strategies
  if (themeAnalysis.overallConsistencyScore < 70 || themeAnalysis.philosophicalDepthScore < 60) {
    strategies.push(...generateThemeStrategies(themeAnalysis, state));
  }

  // Character strategies
  if (characterAnalysis.growthTrajectories.some(t => t.overallGrowthScore < 50)) {
    strategies.push(...generateCharacterStrategies(characterAnalysis, state));
  }

  // Engagement strategies
  if (engagementAnalysis.overallEngagementScore < 70) {
    strategies.push(...generateEngagementStrategies(engagementAnalysis, state));
  }

  // Prose strategies
  if (proseQuality.overallProseScore < 70) {
    strategies.push(...generateProseStrategies(proseQuality, state));
  }

  // Tension strategies
  if (tensionAnalysis.overallTensionScore < 70) {
    strategies.push(...generateTensionStrategies(tensionAnalysis, state));
  }

  // Sort by priority
  const priorityOrder = strategies.sort((a, b) => {
    const priorityRank = { critical: 4, high: 3, medium: 2, low: 1 };
    return priorityRank[b.priority] - priorityRank[a.priority];
  });

  // Calculate estimated effort and improvement
  const estimatedEffort = calculateEstimatedEffort(strategies);
  const expectedImprovement = estimateExpectedImprovement(strategies);

  // Generate recommendations
  const recommendations = generateRevisionRecommendations(
    strategies,
    priorityOrder,
    structureAnalysis,
    themeAnalysis,
    characterAnalysis,
    engagementAnalysis
  );

  return {
    strategies,
    priorityOrder,
    estimatedEffort,
    expectedImprovement,
    recommendations,
  };
}

/**
 * Generates structure revision strategies
 */
function generateStructureStrategies(
  structureAnalysis: ReturnType<typeof analyzeStoryStructure>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  // Act proportion issues
  const threeAct = structureAnalysis.threeActStructure;
  if (Math.abs(threeAct.act2.percentage - 50) > 10) {
    strategies.push({
      priority: 'high',
      category: 'structure',
      description: `Adjust Act 2 proportion (currently ${threeAct.act2.percentage.toFixed(1)}%, ideal: 50%)`,
      rationale: 'Act 2 is the core of the story. Improper proportion affects pacing.',
      suggestedActions: [
        'Review Act 2 chapters for unnecessary scenes',
        'Add development scenes if Act 2 is too short',
        'Condense repetitive scenes if Act 2 is too long',
      ],
      estimatedImpact: 'high',
    });
  }

  // Missing story beats
  const requiredBeats = ['inciting_incident', 'plot_point_1', 'midpoint', 'plot_point_2', 'climax', 'resolution'];
  const detectedBeatTypes = structureAnalysis.detectedBeats.map(b => b.beatType);
  const missingBeats = requiredBeats.filter(beat => !detectedBeatTypes.includes(beat as any));

  if (missingBeats.length > 0) {
    strategies.push({
      priority: 'critical',
      category: 'structure',
      description: `Add missing story beats: ${missingBeats.join(', ')}`,
      rationale: 'Missing key beats weaken story structure and reader satisfaction.',
      suggestedActions: missingBeats.map(beat => `Add ${beat.replace(/_/g, ' ')} beat in appropriate location`),
      estimatedImpact: 'high',
    });
  }

  return strategies;
}

/**
 * Generates theme revision strategies
 */
function generateThemeStrategies(
  themeAnalysis: ReturnType<typeof analyzeThemeEvolution>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  if (themeAnalysis.primaryThemes.length === 0) {
    strategies.push({
      priority: 'high',
      category: 'theme',
      description: 'Establish 1-2 primary themes',
      rationale: 'Primary themes provide narrative focus and coherence.',
      suggestedActions: [
        'Identify the central message or question of your story',
        'Weave primary theme through multiple arcs',
        'Connect primary theme to protagonist\'s journey',
      ],
      estimatedImpact: 'high',
    });
  }

  if (themeAnalysis.overallConsistencyScore < 60) {
    strategies.push({
      priority: 'medium',
      category: 'theme',
      description: `Improve theme consistency (currently ${themeAnalysis.overallConsistencyScore}/100)`,
      rationale: 'Inconsistent themes weaken thematic impact.',
      suggestedActions: [
        'Review arcs for theme integration',
        'Add thematic elements to underdeveloped arcs',
        'Strengthen theme-character connections',
      ],
      estimatedImpact: 'medium',
    });
  }

  if (themeAnalysis.philosophicalDepthScore < 50) {
    strategies.push({
      priority: 'medium',
      category: 'theme',
      description: `Deepen thematic exploration (currently ${themeAnalysis.philosophicalDepthScore}/100)`,
      rationale: 'Shallow themes limit literary merit and reader engagement.',
      suggestedActions: [
        'Add philosophical questions to key scenes',
        'Explore themes through character choices',
        'Weave theme into dialogue and subtext',
      ],
      estimatedImpact: 'medium',
    });
  }

  return strategies;
}

/**
 * Generates character revision strategies
 */
function generateCharacterStrategies(
  characterAnalysis: ReturnType<typeof analyzeCharacterPsychology>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  const lowGrowthCharacters = characterAnalysis.growthTrajectories.filter(t => t.overallGrowthScore < 50);
  
  if (lowGrowthCharacters.length > 0) {
    strategies.push({
      priority: 'high',
      category: 'character',
      description: `Develop character arcs for: ${lowGrowthCharacters.map(c => c.characterName).join(', ')}`,
      rationale: 'Weak character development reduces reader investment.',
      suggestedActions: [
        'Add character growth moments in key chapters',
        'Develop internal conflicts (want vs need)',
        'Show character transformation over time',
      ],
      estimatedImpact: 'high',
      chaptersAffected: undefined, // Would be determined from analysis
    });
  }

  return strategies;
}

/**
 * Generates engagement revision strategies
 */
function generateEngagementStrategies(
  engagementAnalysis: ReturnType<typeof analyzeEngagement>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  if (engagementAnalysis.fatigueChapters.length > 0) {
    const fatigueChapterNumbers = engagementAnalysis.fatigueChapters.map(ch => ch.number);
    strategies.push({
      priority: 'high',
      category: 'engagement',
      description: `Revise fatigue chapters: ${fatigueChapterNumbers.slice(0, 5).join(', ')}`,
      rationale: 'Fatigue chapters reduce reader retention and momentum.',
      suggestedActions: [
        'Add action or conflict to low-engagement chapters',
        'Introduce new developments or revelations',
        'Tighten pacing and remove unnecessary scenes',
      ],
      estimatedImpact: 'high',
      chaptersAffected: fatigueChapterNumbers,
    });
  }

  if (engagementAnalysis.overallEngagementScore < 70) {
    strategies.push({
      priority: 'medium',
      category: 'engagement',
      description: `Improve overall engagement (currently ${engagementAnalysis.overallEngagementScore}/100)`,
      rationale: 'Low engagement reduces reader retention.',
      suggestedActions: [
        'Strengthen chapter hooks',
        'Improve cliffhangers',
        'Increase emotional resonance',
        'Maintain better narrative momentum',
      ],
      estimatedImpact: 'high',
    });
  }

  return strategies;
}

/**
 * Generates prose revision strategies
 */
function generateProseStrategies(
  proseQuality: ReturnType<typeof analyzeProseQuality>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  if (proseQuality.clichesDetected.length > 0) {
    strategies.push({
      priority: 'medium',
      category: 'prose',
      description: `Replace ${proseQuality.clichesDetected.length} clichés with original expressions`,
      rationale: 'Clichés reduce prose quality and originality.',
      suggestedActions: [
        `Review and replace clichés: ${proseQuality.clichesDetected.slice(0, 5).join(', ')}`,
        'Use fresh, original expressions',
        'Show emotions through actions rather than clichéd phrases',
      ],
      estimatedImpact: 'medium',
    });
  }

  if (proseQuality.showTellBalanceScore < 60) {
    strategies.push({
      priority: 'medium',
      category: 'prose',
      description: `Improve show vs tell balance (currently ${proseQuality.showTellBalanceScore}/100)`,
      rationale: 'Good balance enhances reader immersion and prose quality.',
      suggestedActions: [
        'Convert telling to showing where appropriate',
        'Use sensory details and actions',
        'Balance showing with efficient telling',
      ],
      estimatedImpact: 'medium',
    });
  }

  if (proseQuality.sentenceVarietyScore < 60) {
    strategies.push({
      priority: 'low',
      category: 'prose',
      description: `Improve sentence variety (currently ${proseQuality.sentenceVarietyScore}/100)`,
      rationale: 'Sentence variety improves rhythm and readability.',
      suggestedActions: [
        'Vary sentence lengths (short, medium, long)',
        'Mix simple and complex sentences',
        'Create rhythm through sentence patterns',
      ],
      estimatedImpact: 'low',
    });
  }

  return strategies;
}

/**
 * Generates tension revision strategies
 */
function generateTensionStrategies(
  tensionAnalysis: ReturnType<typeof analyzeTension>,
  state: NovelState
): RevisionStrategy[] {
  const strategies: RevisionStrategy[] = [];

  if (tensionAnalysis.tensionReleaseBalance < 60) {
    strategies.push({
      priority: 'medium',
      category: 'tension',
      description: `Improve tension-release balance (currently ${tensionAnalysis.tensionReleaseBalance}/100)`,
      rationale: 'Proper balance prevents reader fatigue and maintains engagement.',
      suggestedActions: [
        'Add release moments after high-tension chapters',
        'Vary tension levels throughout story',
        'Ensure peaks are followed by valleys',
      ],
      estimatedImpact: 'medium',
    });
  }

  if (tensionAnalysis.tensionPeaks.length < 3 && state.chapters.length >= 10) {
    strategies.push({
      priority: 'high',
      category: 'tension',
      description: `Add more tension peaks (currently ${tensionAnalysis.tensionPeaks.length})`,
      rationale: 'Tension peaks create memorable moments and maintain interest.',
      suggestedActions: [
        'Add high-conflict scenes',
        'Create crisis moments',
        'Escalate stakes at key points',
      ],
      estimatedImpact: 'high',
    });
  }

  return strategies;
}

/**
 * Calculates estimated effort
 */
function calculateEstimatedEffort(strategies: RevisionStrategy[]): 'low' | 'medium' | 'high' {
  const criticalCount = strategies.filter(s => s.priority === 'critical').length;
  const highCount = strategies.filter(s => s.priority === 'high').length;
  
  if (criticalCount > 2 || highCount > 5 || strategies.length > 10) {
    return 'high';
  } else if (criticalCount > 0 || highCount > 2 || strategies.length > 5) {
    return 'medium';
  } else {
    return 'low';
  }
}

/**
 * Estimates expected improvement
 */
function estimateExpectedImprovement(strategies: RevisionStrategy[]): number {
  let improvement = 0;

  strategies.forEach(strategy => {
    switch (strategy.estimatedImpact) {
      case 'high':
        improvement += strategy.priority === 'critical' ? 8 : 5;
        break;
      case 'medium':
        improvement += strategy.priority === 'high' ? 4 : 2;
        break;
      case 'low':
        improvement += 1;
        break;
    }
  });

  // Cap at reasonable improvement (30 points max)
  return Math.min(30, improvement);
}

/**
 * Generates revision recommendations
 */
function generateRevisionRecommendations(
  strategies: RevisionStrategy[],
  priorityOrder: RevisionStrategy[],
  structureAnalysis: ReturnType<typeof analyzeStoryStructure>,
  themeAnalysis: ReturnType<typeof analyzeThemeEvolution>,
  characterAnalysis: ReturnType<typeof analyzeCharacterPsychology>,
  engagementAnalysis: ReturnType<typeof analyzeEngagement>
): string[] {
  const recommendations: string[] = [];

  if (strategies.length === 0) {
    recommendations.push('No major revision priorities identified. Minor refinements may improve quality further.');
    return recommendations;
  }

  // Prioritize critical and high-priority strategies
  const criticalStrategies = priorityOrder.filter(s => s.priority === 'critical');
  const highStrategies = priorityOrder.filter(s => s.priority === 'high');

  if (criticalStrategies.length > 0) {
    recommendations.push(`CRITICAL: ${criticalStrategies.length} critical revision(s) identified. Address these first.`);
    criticalStrategies.slice(0, 2).forEach(strategy => {
      recommendations.push(`- ${strategy.description}`);
    });
  }

  if (highStrategies.length > 0) {
    recommendations.push(`HIGH PRIORITY: ${highStrategies.length} high-priority revision(s). Address after critical items.`);
    highStrategies.slice(0, 2).forEach(strategy => {
      recommendations.push(`- ${strategy.description}`);
    });
  }

  // Suggest revision order
  recommendations.push('Suggested revision order: 1) Structure 2) Engagement 3) Character 4) Theme 5) Prose 6) Tension');

  // Estimate improvement
  const estimatedImprovement = estimateExpectedImprovement(strategies);
  if (estimatedImprovement > 0) {
    recommendations.push(`Expected quality improvement: +${estimatedImprovement} points if all strategies are implemented.`);
  }

  return recommendations;
}

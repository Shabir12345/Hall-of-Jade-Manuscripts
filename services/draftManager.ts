import { NovelState, DraftVersion, DraftChange } from '../types';
import { generateUUID } from '../utils/uuid';
import { analyzeStoryStructure } from './storyStructureAnalyzer';
import { analyzeThemeEvolution } from './themeAnalyzer';
import { analyzeCharacterPsychology } from './characterPsychologyService';
import { analyzeEngagement } from './engagementAnalyzer';
import { analyzeMarketReadiness } from './marketReadinessService';

/**
 * Draft Manager
 * Manages multiple draft versions, tracks changes, and monitors quality progression
 */

export interface DraftManagement {
  drafts: DraftVersion[];
  currentDraft?: DraftVersion;
  draftProgression: Array<{
    draftNumber: number;
    qualityScore: number;
    improvement: number; // Change from previous draft
  }>;
  recommendations: string[];
}

/**
 * Creates a new draft version
 */
export function createDraftVersion(
  state: NovelState,
  draftName?: string,
  createdFromDraftId?: string
): DraftVersion {
  const existingDrafts = state.draftVersions || [];
  const nextDraftNumber = existingDrafts.length > 0
    ? Math.max(...existingDrafts.map(d => d.draftNumber)) + 1
    : 1;

  // Calculate quality scores for current draft
  const qualityScores = calculateDraftQualityScores(state);

  // Create draft version
  const draftVersion: DraftVersion = {
    id: generateUUID(),
    novelId: state.id,
    draftNumber: nextDraftNumber,
    draftName: draftName || `Draft ${nextDraftNumber}`,
    createdFromDraftId,
    qualityScore: qualityScores.overall,
    structureScore: qualityScores.structure,
    thematicScore: qualityScores.thematic,
    characterScore: qualityScores.character,
    engagementScore: qualityScores.engagement,
    revisionGoals: [],
    revisionChecklist: [],
    notes: `Created draft ${nextDraftNumber} from ${createdFromDraftId ? 'previous draft' : 'current version'}`,
    createdAt: Date.now(),
  };

  return draftVersion;
}

/**
 * Calculates quality scores for a draft
 */
function calculateDraftQualityScores(state: NovelState): {
  overall: number;
  structure: number;
  thematic: number;
  character: number;
  engagement: number;
} {
  // Analyze current state
  const structureAnalysis = analyzeStoryStructure(state);
  const themeAnalysis = analyzeThemeEvolution(state);
  const characterAnalysis = analyzeCharacterPsychology(state);
  const engagementAnalysis = analyzeEngagement(state);
  const marketReadiness = analyzeMarketReadiness(state);

  // Calculate scores
  const structureScore = structureAnalysis.overallStructureScore;
  const thematicScore = (themeAnalysis.overallConsistencyScore + themeAnalysis.philosophicalDepthScore) / 2;
  const characterScore = characterAnalysis.growthTrajectories.length > 0
    ? characterAnalysis.growthTrajectories.reduce((sum, t) => sum + t.overallGrowthScore, 0) / characterAnalysis.growthTrajectories.length
    : 50;
  const engagementScore = engagementAnalysis.overallEngagementScore;
  
  // Overall score (weighted average)
  const overallScore = (
    structureScore * 0.25 +
    thematicScore * 0.25 +
    characterScore * 0.25 +
    engagementScore * 0.25
  );

  return {
    overall: Math.round(overallScore),
    structure: structureScore,
    thematic: Math.round(thematicScore),
    character: Math.round(characterScore),
    engagement: engagementScore,
  };
}

/**
 * Gets draft management information
 */
export function getDraftManagement(state: NovelState): DraftManagement {
  const drafts = state.draftVersions || [];
  
  // Sort by draft number
  const sortedDrafts = [...drafts].sort((a, b) => a.draftNumber - b.draftNumber);
  
  // Current draft is the latest
  const currentDraft = sortedDrafts.length > 0 
    ? sortedDrafts[sortedDrafts.length - 1]
    : undefined;

  // Calculate progression
  const draftProgression: DraftManagement['draftProgression'] = sortedDrafts.map((draft, index) => {
    const improvement = index > 0
      ? draft.qualityScore - sortedDrafts[index - 1].qualityScore
      : 0;

    return {
      draftNumber: draft.draftNumber,
      qualityScore: draft.qualityScore,
      improvement,
    };
  });

  // Generate recommendations
  const recommendations = generateDraftRecommendations(drafts, currentDraft);

  return {
    drafts: sortedDrafts,
    currentDraft,
    draftProgression,
    recommendations,
  };
}

/**
 * Compares two drafts
 */
export function compareDrafts(
  draft1: DraftVersion,
  draft2: DraftVersion,
  state: NovelState
): {
  improvements: Array<{
    metric: string;
    change: number;
    direction: 'improved' | 'worsened' | 'unchanged';
  }>;
  overallChange: number;
  recommendations: string[];
} {
  const improvements: Array<{
    metric: string;
    change: number;
    direction: 'improved' | 'worsened' | 'unchanged';
  }> = [];

  // Compare quality scores
  const metrics = [
    { name: 'Overall Quality', score1: draft1.qualityScore, score2: draft2.qualityScore },
    { name: 'Structure', score1: draft1.structureScore, score2: draft2.structureScore },
    { name: 'Thematic', score1: draft1.thematicScore, score2: draft2.thematicScore },
    { name: 'Character', score1: draft1.characterScore, score2: draft2.characterScore },
    { name: 'Engagement', score1: draft1.engagementScore, score2: draft2.engagementScore },
  ];

  metrics.forEach(metric => {
    const change = metric.score2 - metric.score1;
    const direction: 'improved' | 'worsened' | 'unchanged' = 
      change > 5 ? 'improved' :
      change < -5 ? 'worsened' :
      'unchanged';

    improvements.push({
      metric: metric.name,
      change,
      direction,
    });
  });

  // Overall change
  const overallChange = draft2.qualityScore - draft1.qualityScore;

  // Generate recommendations
  const recommendations = generateDraftComparisonRecommendations(improvements, overallChange);

  return {
    improvements,
    overallChange,
    recommendations,
  };
}

/**
 * Generates revision goals for a draft
 */
export function generateRevisionGoals(
  state: NovelState,
  draftVersion: DraftVersion
): string[] {
  const goals: string[] = [];

  // Analyze current state
  const structureAnalysis = analyzeStoryStructure(state);
  const themeAnalysis = analyzeThemeEvolution(state);
  const characterAnalysis = analyzeCharacterPsychology(state);
  const engagementAnalysis = analyzeEngagement(state);

  // Generate goals based on weaknesses
  if (structureAnalysis.overallStructureScore < 70) {
    goals.push(`Improve structure score from ${structureAnalysis.overallStructureScore} to 75+`);
  }

  if (themeAnalysis.overallConsistencyScore < 70) {
    goals.push(`Improve theme consistency from ${themeAnalysis.overallConsistencyScore} to 75+`);
  }

  if (engagementAnalysis.overallEngagementScore < 70) {
    goals.push(`Improve engagement from ${engagementAnalysis.overallEngagementScore} to 75+`);
  }

  // Add specific recommendations from analyses
  structureAnalysis.recommendations.slice(0, 2).forEach(rec => {
    goals.push(`Structure: ${rec}`);
  });

  engagementAnalysis.recommendations.slice(0, 2).forEach(rec => {
    goals.push(`Engagement: ${rec}`);
  });

  return goals.slice(0, 10); // Limit to 10 goals
}

/**
 * Creates revision checklist from goals
 */
export function createRevisionChecklist(goals: string[]): DraftVersion['revisionChecklist'] {
  return goals.map(goal => ({
    goal,
    status: 'pending' as const,
    notes: '',
  }));
}

/**
 * Tracks changes between drafts
 */
export function trackDraftChanges(
  draftVersionId: string,
  state: NovelState,
  previousState: NovelState
): DraftChange[] {
  const changes: DraftChange[] = [];

  // Compare chapters (structure changes)
  if (state.chapters.length !== previousState.chapters.length) {
    changes.push({
      id: generateUUID(),
      draftVersionId,
      changeType: 'structure',
      changeDescription: `Chapter count changed from ${previousState.chapters.length} to ${state.chapters.length}`,
      impactAnalysis: 'This affects story structure and pacing',
      createdAt: Date.now(),
    });
  }

  // Compare themes (thematic changes)
  const prevThemes = previousState.themeEvolutions || [];
  const currThemes = state.themeEvolutions || [];
  if (currThemes.length !== prevThemes.length) {
    changes.push({
      id: generateUUID(),
      draftVersionId,
      changeType: 'theme',
      changeDescription: `Theme count changed from ${prevThemes.length} to ${currThemes.length}`,
      impactAnalysis: 'This affects thematic depth and consistency',
      createdAt: Date.now(),
    });
  }

  // Compare characters (character changes)
  const prevCharacters = previousState.characterCodex.length;
  const currCharacters = state.characterCodex.length;
  if (currCharacters !== prevCharacters) {
    changes.push({
      id: generateUUID(),
      draftVersionId,
      changeType: 'character',
      changeDescription: `Character count changed from ${prevCharacters} to ${currCharacters}`,
      impactAnalysis: 'This affects character development and relationships',
      createdAt: Date.now(),
    });
  }

  // Check prose quality changes (prose changes)
  // This would be enhanced with actual prose comparison
  changes.push({
    id: generateUUID(),
    draftVersionId,
    changeType: 'prose',
    changeDescription: 'Prose refinements and improvements',
    impactAnalysis: 'This affects readability and literary quality',
    createdAt: Date.now(),
  });

  return changes;
}

/**
 * Generates draft recommendations
 */
function generateDraftRecommendations(
  drafts: DraftVersion[],
  currentDraft?: DraftVersion
): string[] {
  const recommendations: string[] = [];

  if (drafts.length === 0) {
    recommendations.push('No drafts created yet. Create your first draft version to track revisions.');
    return recommendations;
  }

  // Check progression
  if (drafts.length >= 2) {
    const progression = drafts.slice(-2);
    const improvement = progression[1].qualityScore - progression[0].qualityScore;
    
    if (improvement > 5) {
      recommendations.push(`Good progress! Quality improved by ${improvement} points between drafts.`);
    } else if (improvement < -5) {
      recommendations.push(`Quality decreased by ${Math.abs(improvement)} points. Review recent changes.`);
    } else {
      recommendations.push('Quality stable. Consider focused revisions on specific areas.');
    }
  }

  // Check current draft
  if (currentDraft) {
    if (currentDraft.qualityScore < 70) {
      recommendations.push(`Current draft quality is ${currentDraft.qualityScore}/100. Focus on areas with lower scores.`);
    }

    // Check revision checklist completion
    const completedGoals = currentDraft.revisionChecklist.filter(item => item.status === 'completed').length;
    const totalGoals = currentDraft.revisionChecklist.length;
    if (totalGoals > 0) {
      const completionRate = (completedGoals / totalGoals) * 100;
      if (completionRate < 50) {
        recommendations.push(`Only ${Math.round(completionRate)}% of revision goals completed. Continue working through checklist.`);
      } else if (completionRate === 100) {
        recommendations.push('All revision goals completed! Consider creating a new draft version.');
      }
    }
  }

  return recommendations;
}

/**
 * Generates draft comparison recommendations
 */
function generateDraftComparisonRecommendations(
  improvements: Array<{ metric: string; change: number; direction: string }>,
  overallChange: number
): string[] {
  const recommendations: string[] = [];

  if (overallChange > 5) {
    recommendations.push(`Overall quality improved by ${overallChange} points. Excellent progress!`);
  } else if (overallChange < -5) {
    recommendations.push(`Overall quality decreased by ${Math.abs(overallChange)} points. Review changes carefully.`);
  }

  // Highlight improved areas
  const improvedMetrics = improvements.filter(imp => imp.direction === 'improved');
  if (improvedMetrics.length > 0) {
    recommendations.push(`Improved areas: ${improvedMetrics.map(m => m.metric).join(', ')}. Great work!`);
  }

  // Highlight worsened areas
  const worsenedMetrics = improvements.filter(imp => imp.direction === 'worsened');
  if (worsenedMetrics.length > 0) {
    recommendations.push(`Areas needing attention: ${worsenedMetrics.map(m => m.metric).join(', ')}.`);
  }

  return recommendations;
}

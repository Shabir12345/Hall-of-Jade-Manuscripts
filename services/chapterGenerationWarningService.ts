/**
 * Chapter Generation Warning Service
 * 
 * Generates actionable warnings and recommendations for chapter generation.
 * Analyzes story state, thread health, character presence, and arc position
 * to produce structured warnings with prompt constraints.
 */

import { NovelState, StoryThread, Character, Arc, Chapter } from '../types';
import { generateUUID } from '../utils/uuid';
import {
  THREAD_DENSITY_STANDARDS,
  THREAD_PROGRESSION_STANDARDS,
  THREAD_TYPE_THRESHOLDS,
  ARC_POSITION_STANDARDS,
  QUALITY_STANDARDS,
  getStaleThreshold,
  getMaxThreadAge,
  getWarningAge,
  determineArcPosition,
  calculateThreadDensity, // Use the updated calculation method
  calculateAverageResolutionTime,
  getProgressionSuggestion,
  calculateStoryHealthScore,
  getAtRiskThreads,
  countRecentProgressions,
  countRecentResolutions,
  ArcPosition,
} from './storyProgressionStandards';

// ============================================================================
// Types
// ============================================================================

export type WarningCategory =
  | 'thread_progression'
  | 'character_presence'
  | 'arc_pacing'
  | 'plot_hole_risk'
  | 'resolution_urgency'
  | 'quality_metric'
  | 'thread_density';

export type WarningSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AffectedEntity {
  type: 'thread' | 'character' | 'arc' | 'chapter';
  id: string;
  name: string;
}

export interface WarningMetric {
  current: number;
  standard: number;
  threshold: number;
  unit?: string;
}

export interface ChapterGenerationWarning {
  id: string;
  category: WarningCategory;
  severity: WarningSeverity;
  title: string;
  description: string;
  affectedEntities: AffectedEntity[];
  recommendation: string;
  promptConstraint?: string;
  autoFixable: boolean;
  metric?: WarningMetric;
  timestamp: number;
}

export interface ThreadProgressionSummary {
  activeThreads: number;
  stalledThreads: number;
  progressedRecently: number;
  resolvedRecently: number;
  atRiskOfPlotHole: number;
  threadDensity: number;
  criticalThreadsCount: number;
  highPriorityThreadsCount: number;
}

export interface ArcPositionAnalysis {
  currentPosition: ArcPosition;
  positionName: string;
  progressPercentage: number;
  expectedProgressions: string[];
  missingElements: string[];
  chaptersRemaining: number;
}

export interface ChapterGenerationReport {
  chapterNumber: number;
  timestamp: number;
  overallHealth: number;
  warnings: ChapterGenerationWarning[];
  blockers: ChapterGenerationWarning[];
  promptConstraints: string[];
  threadProgressionSummary: ThreadProgressionSummary;
  arcPositionAnalysis: ArcPositionAnalysis;
}

// ============================================================================
// Warning Generators
// ============================================================================

/**
 * Analyze thread progression and generate warnings
 */
function analyzeThreadProgression(
  state: NovelState,
  currentChapter: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const threads = state.storyThreads || [];
  const activeThreads = threads.filter(t => t.status === 'active');

  // Check for stalled threads
  activeThreads.forEach(thread => {
    const chaptersSinceUpdate = currentChapter - thread.lastUpdatedChapter;
    const threshold = getStaleThreshold(thread.type, thread.priority);

    if (chaptersSinceUpdate >= threshold) {
      const severity: WarningSeverity =
        thread.priority === 'critical' ? 'critical' :
          chaptersSinceUpdate > threshold * 1.5 ? 'high' : 'medium';

      const suggestion = getProgressionSuggestion(thread);
      warnings.push({
        id: generateUUID(),
        category: 'thread_progression',
        severity,
        title: `Stalled ${thread.type} Thread: "${thread.title}"`,
        description: `This ${thread.type} thread has not progressed in ${chaptersSinceUpdate} chapters (threshold: ${threshold}).`,
        affectedEntities: [{ type: 'thread', id: thread.id, name: thread.title }],
        recommendation: `Progress or reference "${thread.title}" in the next chapter. ${suggestion}`,
        promptConstraint: `[STALLED THREAD "${thread.title}"] You MUST include a scene, dialogue, or plot development for this ${thread.type} thread. Suggestion: ${suggestion}`,
        autoFixable: false,
        metric: {
          current: chaptersSinceUpdate,
          standard: threshold,
          threshold: Math.round(threshold * 1.5),
          unit: 'chapters',
        },
        timestamp: Date.now(),
      });
    }
  });

  // Check for no progression in recent chapters
  const recentProgressions = countRecentProgressions(threads, currentChapter, 3);

  if (recentProgressions === 0 && activeThreads.length > 0) {
    // Get the top 3 highest-priority active threads to suggest
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const topThreads = activeThreads
      .sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3))
      .slice(0, 3);
    const threadNames = topThreads.map(t => `"${t.title}"`).join(', ');

    warnings.push({
      id: generateUUID(),
      category: 'thread_progression',
      severity: 'critical',
      title: 'No Thread Progression in Recent Chapters',
      description: `No story threads have progressed in the last 3 chapters. Story may feel stagnant to readers.`,
      affectedEntities: topThreads.map(t => ({ type: 'thread' as const, id: t.id, name: t.title })),
      recommendation: 'Progress at least 1-2 threads meaningfully in the next chapter to maintain narrative momentum.',
      promptConstraint: `[STORY STAGNATION] The story has had NO thread progression in 3 chapters. This chapter MUST advance at least 2 of these threads: ${threadNames}. Include scenes, dialogue, or discoveries that clearly move these plots forward.`,
      autoFixable: false,
      metric: {
        current: recentProgressions,
        standard: THREAD_PROGRESSION_STANDARDS.perChapter.minProgressions,
        threshold: 0,
        unit: 'progressions',
      },
      timestamp: Date.now(),
    });
  }

  // Check for lack of major progressions
  const recentChapters = state.chapters.slice(-3);
  const majorProgressionsRecent = threads.filter(t => {
    const hasRecentMajor = t.progressionNotes?.some(note =>
      note.significance === 'major' &&
      note.chapterNumber >= currentChapter - 3
    );
    return hasRecentMajor;
  }).length;

  if (majorProgressionsRecent === 0 && currentChapter > 3 && activeThreads.length > 0) {
    warnings.push({
      id: generateUUID(),
      category: 'thread_progression',
      severity: 'high',
      title: 'No Major Thread Progressions Recently',
      description: `No major thread progressions in the last 3 chapters. Story may lack significant developments.`,
      affectedEntities: [],
      recommendation: 'Include at least one major thread progression - a significant revelation, turning point, or advancement.',
      promptConstraint: 'Include at least ONE major story development - a significant revelation, confrontation, or turning point for an active thread.',
      autoFixable: false,
      timestamp: Date.now(),
    });
  }

  return warnings;
}

/**
 * Analyze thread density and generate warnings
 */
function analyzeThreadDensity(
  state: NovelState,
  currentChapter: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const threads = state.storyThreads || [];
  const density = calculateThreadDensity(threads, currentChapter); // Update to use the new calculation method

  // Only issue critical warning if we have enough chapters to establish a pattern
  if (density < THREAD_DENSITY_STANDARDS.critical.low && state.chapters.length > 5) {
    warnings.push({
      id: generateUUID(),
      category: 'thread_density',
      severity: 'critical',
      title: 'Critically Low Thread Density',
      description: `Thread density is ${density} per chapter (critical threshold: ${THREAD_DENSITY_STANDARDS.critical.low}). Story lacks narrative threads.`,
      affectedEntities: [],
      recommendation: 'Introduce new story threads or ensure existing threads are being tracked. Consider adding mystery, conflict, or relationship threads.',
      promptConstraint: 'IMPORTANT: Introduce or establish at least 2 new story threads in this chapter.',
      autoFixable: false,
      metric: {
        current: density,
        standard: THREAD_DENSITY_STANDARDS.optimal.min,
        threshold: THREAD_DENSITY_STANDARDS.critical.low,
        unit: 'threads/chapter',
      },
      timestamp: Date.now(),
    });
  } else if (density < THREAD_DENSITY_STANDARDS.warning.low) {
    warnings.push({
      id: generateUUID(),
      category: 'thread_density',
      severity: 'medium',
      title: 'Low Thread Density',
      description: `Thread density is ${density} per chapter (recommended: ${THREAD_DENSITY_STANDARDS.optimal.min}-${THREAD_DENSITY_STANDARDS.optimal.max}).`,
      affectedEntities: [],
      recommendation: 'Consider introducing new story threads to enrich the narrative.',
      autoFixable: false,
      metric: {
        current: density,
        standard: THREAD_DENSITY_STANDARDS.optimal.min,
        threshold: THREAD_DENSITY_STANDARDS.warning.low,
        unit: 'threads/chapter',
      },
      timestamp: Date.now(),
    });
  } else if (density > THREAD_DENSITY_STANDARDS.critical.high) {
    warnings.push({
      id: generateUUID(),
      category: 'thread_density',
      severity: 'high',
      title: 'Excessive Thread Density',
      description: `Thread density is ${density} per chapter (max recommended: ${THREAD_DENSITY_STANDARDS.maximum}). Too many threads may overwhelm readers.`,
      affectedEntities: [],
      recommendation: 'Focus on resolving existing threads before introducing new ones.',
      promptConstraint: 'PACING: Focus on existing threads. Resolve at least 1-2 threads rather than introducing new ones.',
      autoFixable: false,
      metric: {
        current: density,
        standard: THREAD_DENSITY_STANDARDS.optimal.max,
        threshold: THREAD_DENSITY_STANDARDS.critical.high,
        unit: 'threads/chapter',
      },
      timestamp: Date.now(),
    });
  }

  return warnings;
}

/**
 * Analyze resolution urgency and generate warnings
 */
function analyzeResolutionUrgency(
  state: NovelState,
  currentChapter: number,
  totalPlannedChapters: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const threads = state.storyThreads?.filter(t => t.status === 'active') || [];
  const remainingChapters = totalPlannedChapters - currentChapter;

  // Check if we have enough chapters to resolve all threads
  const criticalThreads = threads.filter(t => t.priority === 'critical');
  const highThreads = threads.filter(t => t.priority === 'high');
  const avgResolutionTime = calculateAverageResolutionTime(state.storyThreads || []);

  // Estimate chapters needed (assuming some parallel resolution)
  const estimatedChaptersNeeded = Math.ceil(
    (criticalThreads.length + highThreads.length * 0.5) * (avgResolutionTime / 2)
  );

  if (estimatedChaptersNeeded > remainingChapters * 1.5 && remainingChapters > 0) {
    warnings.push({
      id: generateUUID(),
      category: 'resolution_urgency',
      severity: 'critical',
      title: 'Insufficient Chapters for Thread Resolution',
      description: `${criticalThreads.length} critical and ${highThreads.length} high-priority threads need resolution, but only ${remainingChapters} chapters remain. Estimated chapters needed: ${estimatedChaptersNeeded}.`,
      affectedEntities: criticalThreads.slice(0, 3).map(t => ({ type: 'thread' as const, id: t.id, name: t.title })),
      recommendation: 'Begin accelerating thread resolutions. Consider combining related threads or resolving multiple threads in single chapters.',
      promptConstraint: `PACING ALERT: Begin resolving story threads urgently. Prioritize: ${criticalThreads.slice(0, 3).map(t => t.title).join(', ')}`,
      autoFixable: false,
      metric: {
        current: remainingChapters,
        standard: estimatedChaptersNeeded,
        threshold: Math.ceil(estimatedChaptersNeeded * 0.7),
        unit: 'chapters',
      },
      timestamp: Date.now(),
    });
  }

  // Individual thread urgency - approaching max age
  threads.forEach(thread => {
    const threadAge = currentChapter - thread.introducedChapter;
    const maxAge = getMaxThreadAge(thread.type, thread.priority);
    const warningAge = getWarningAge(thread.type, thread.priority);

    if (threadAge > maxAge) {
      warnings.push({
        id: generateUUID(),
        category: 'resolution_urgency',
        severity: 'critical',
        title: `Thread "${thread.title}" Exceeded Max Age`,
        description: `This ${thread.type} thread is ${threadAge} chapters old (max recommended: ${maxAge}). Risk of becoming a plot hole.`,
        affectedEntities: [{ type: 'thread', id: thread.id, name: thread.title }],
        recommendation: `Resolve "${thread.title}" immediately or acknowledge why it's taking longer within the story.`,
        promptConstraint: `URGENT: The "${thread.title}" thread must be resolved or significantly advanced in this chapter.`,
        autoFixable: false,
        metric: {
          current: threadAge,
          standard: maxAge,
          threshold: maxAge,
          unit: 'chapters',
        },
        timestamp: Date.now(),
      });
    } else if (threadAge > warningAge) {
      warnings.push({
        id: generateUUID(),
        category: 'resolution_urgency',
        severity: 'high',
        title: `Thread "${thread.title}" Approaching Max Age`,
        description: `This ${thread.type} thread is ${threadAge} chapters old (warning: ${warningAge}, max: ${maxAge}).`,
        affectedEntities: [{ type: 'thread', id: thread.id, name: thread.title }],
        recommendation: `Plan resolution for "${thread.title}" within the next ${maxAge - threadAge} chapters.`,
        autoFixable: false,
        metric: {
          current: threadAge,
          standard: warningAge,
          threshold: maxAge,
          unit: 'chapters',
        },
        timestamp: Date.now(),
      });
    }
  });

  // Check for no resolutions in a long time
  const recentResolutions = countRecentResolutions(state.storyThreads || [], currentChapter, 8);
  if (recentResolutions === 0 && currentChapter > 8 && threads.length > 3) {
    warnings.push({
      id: generateUUID(),
      category: 'resolution_urgency',
      severity: 'high',
      title: 'No Thread Resolutions Recently',
      description: `No story threads have been resolved in the last 8 chapters. Story may lack closure and payoff.`,
      affectedEntities: [],
      recommendation: 'Resolve at least one thread soon to provide narrative satisfaction.',
      promptConstraint: 'Consider resolving at least one story thread to provide closure and maintain reader engagement.',
      autoFixable: false,
      timestamp: Date.now(),
    });
  }

  return warnings;
}

/**
 * Analyze plot hole risks
 */
function analyzePlotHoleRisks(
  state: NovelState,
  currentChapter: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const threads = state.storyThreads || [];
  const atRiskThreads = getAtRiskThreads(threads, currentChapter);

  if (atRiskThreads.length > 0) {
    // Group by severity
    const criticalRisk = atRiskThreads.filter(t => t.priority === 'critical' || t.priority === 'high');

    if (criticalRisk.length >= 3) {
      warnings.push({
        id: generateUUID(),
        category: 'plot_hole_risk',
        severity: 'critical',
        title: 'Multiple Plot Hole Risks',
        description: `${criticalRisk.length} critical/high-priority threads are at risk of becoming plot holes: ${criticalRisk.slice(0, 3).map(t => t.title).join(', ')}${criticalRisk.length > 3 ? '...' : ''}`,
        affectedEntities: criticalRisk.slice(0, 5).map(t => ({ type: 'thread' as const, id: t.id, name: t.title })),
        recommendation: 'Address these threads immediately to prevent narrative inconsistencies.',
        promptConstraint: `CRITICAL: Address at least 2 of these at-risk threads: ${criticalRisk.slice(0, 3).map(t => t.title).join(', ')}`,
        autoFixable: false,
        metric: {
          current: criticalRisk.length,
          standard: 0,
          threshold: 2,
          unit: 'at-risk threads',
        },
        timestamp: Date.now(),
      });
    } else if (atRiskThreads.length > 0) {
      atRiskThreads.forEach(thread => {
        warnings.push({
          id: generateUUID(),
          category: 'plot_hole_risk',
          severity: thread.priority === 'critical' ? 'high' : 'medium',
          title: `Plot Hole Risk: "${thread.title}"`,
          description: `The ${thread.type} thread "${thread.title}" is at risk of becoming a plot hole.`,
          affectedEntities: [{ type: 'thread', id: thread.id, name: thread.title }],
          recommendation: `Reference or progress "${thread.title}" to maintain narrative consistency.`,
          autoFixable: false,
          timestamp: Date.now(),
        });
      });
    }
  }

  return warnings;
}

/**
 * Analyze character presence warnings
 */
function analyzeCharacterPresence(
  state: NovelState,
  currentChapter: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const characters = state.characterCodex || [];
  const chapters = state.chapters || [];
  const previousChapter = chapters[chapters.length - 1];

  if (!previousChapter) return warnings;

  // Get protagonist
  const protagonist = characters.find(c => c.isProtagonist);

  // Check if protagonist was mentioned in previous chapter
  if (protagonist) {
    const prevContent = (previousChapter.content + ' ' + (previousChapter.summary || '')).toLowerCase();
    const protagonistMentioned = prevContent.includes(protagonist.name.toLowerCase());

    // Check chapters since protagonist appeared
    let chaptersSinceProtagonist = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      const chContent = (chapters[i].content + ' ' + (chapters[i].summary || '')).toLowerCase();
      if (chContent.includes(protagonist.name.toLowerCase())) {
        break;
      }
      chaptersSinceProtagonist++;
    }

    if (chaptersSinceProtagonist > 1) {
      warnings.push({
        id: generateUUID(),
        category: 'character_presence',
        severity: 'critical',
        title: 'Protagonist Missing',
        description: `The protagonist "${protagonist.name}" has not appeared in ${chaptersSinceProtagonist} chapter(s).`,
        affectedEntities: [{ type: 'character', id: protagonist.id, name: protagonist.name }],
        recommendation: `Include "${protagonist.name}" in the next chapter to maintain reader connection.`,
        promptConstraint: `CRITICAL: The protagonist "${protagonist.name}" MUST appear in this chapter.`,
        autoFixable: false,
        timestamp: Date.now(),
      });
    }
  }

  // Check for characters mentioned at end of previous chapter
  const lastParagraph = previousChapter.content.slice(-500);
  const charactersMentionedAtEnd = characters.filter(c =>
    lastParagraph.toLowerCase().includes(c.name.toLowerCase())
  );

  // These characters should likely appear in the next chapter
  if (charactersMentionedAtEnd.length > 0) {
    const nonProtagonists = charactersMentionedAtEnd.filter(c => !c.isProtagonist);
    if (nonProtagonists.length > 2) {
      warnings.push({
        id: generateUUID(),
        category: 'character_presence',
        severity: 'medium',
        title: 'Characters in Previous Chapter Ending',
        description: `These characters were present at the end of the previous chapter and should likely continue: ${nonProtagonists.slice(0, 3).map(c => c.name).join(', ')}`,
        affectedEntities: nonProtagonists.slice(0, 3).map(c => ({ type: 'character' as const, id: c.id, name: c.name })),
        recommendation: 'Continue with these characters or explain their departure.',
        promptConstraint: `Continue from the scene with: ${nonProtagonists.slice(0, 3).map(c => c.name).join(', ')}. If they depart, show it happening.`,
        autoFixable: false,
        timestamp: Date.now(),
      });
    }
  }

  // Check for characters absent too long
  characters.filter(c => !c.isProtagonist).forEach(character => {
    const lastAppearance = findLastCharacterAppearance(character, chapters);
    if (lastAppearance !== -1) {
      const chaptersSince = currentChapter - lastAppearance;
      // Warning if important character missing for too long
      if (chaptersSince > 10) {
        warnings.push({
          id: generateUUID(),
          category: 'character_presence',
          severity: 'low',
          title: `Character "${character.name}" Absent`,
          description: `"${character.name}" hasn't appeared in ${chaptersSince} chapters.`,
          affectedEntities: [{ type: 'character', id: character.id, name: character.name }],
          recommendation: `Consider including "${character.name}" if they're relevant to the current arc.`,
          autoFixable: false,
          timestamp: Date.now(),
        });
      }
    }
  });

  return warnings;
}

/**
 * Find last chapter where a character appeared
 */
function findLastCharacterAppearance(character: Character, chapters: Chapter[]): number {
  for (let i = chapters.length - 1; i >= 0; i--) {
    const content = (chapters[i].content + ' ' + (chapters[i].summary || '')).toLowerCase();
    if (content.includes(character.name.toLowerCase())) {
      return chapters[i].number;
    }
  }
  return -1;
}

/**
 * Analyze arc pacing warnings
 */
function analyzeArcPacing(
  state: NovelState,
  currentChapter: number,
  totalPlannedChapters: number
): ChapterGenerationWarning[] {
  const warnings: ChapterGenerationWarning[] = [];
  const position = determineArcPosition(currentChapter, totalPlannedChapters);
  const requirements = ARC_POSITION_STANDARDS[position];
  const threads = state.storyThreads || [];
  const activeThreads = threads.filter(t => t.status === 'active');

  // Check thread progression rate for arc position
  const recentProgressions = countRecentProgressions(threads, currentChapter, 3);
  const progressionRate = activeThreads.length > 0
    ? (recentProgressions / activeThreads.length) * 100
    : 0;

  if (progressionRate < requirements.threadProgressionRate * 0.7) {
    warnings.push({
      id: generateUUID(),
      category: 'arc_pacing',
      severity: 'high',
      title: `Slow Pacing for ${requirements.name} Stage`,
      description: `Thread progression rate is ${Math.round(progressionRate)}% (expected: ${requirements.threadProgressionRate}% for ${requirements.name}).`,
      affectedEntities: [],
      recommendation: `Increase thread progression to match the ${requirements.name} stage of the story.`,
      promptConstraint: `PACING: This is the ${requirements.name} stage. Progress at least ${Math.ceil(activeThreads.length * requirements.threadProgressionRate / 100)} threads.`,
      autoFixable: false,
      metric: {
        current: Math.round(progressionRate),
        standard: requirements.threadProgressionRate,
        threshold: Math.round(requirements.threadProgressionRate * 0.7),
        unit: '%',
      },
      timestamp: Date.now(),
    });
  }

  // Check for new threads in late stages
  if (!requirements.allowNewThreads) {
    const recentNewThreads = threads.filter(t =>
      t.introducedChapter >= currentChapter - 3 && t.status === 'active'
    ).length;

    if (recentNewThreads > 0) {
      warnings.push({
        id: generateUUID(),
        category: 'arc_pacing',
        severity: 'medium',
        title: 'New Threads in Late Story Stage',
        description: `${recentNewThreads} new thread(s) introduced in ${requirements.name} stage. Late stages should focus on resolution.`,
        affectedEntities: [],
        recommendation: 'Focus on resolving existing threads rather than introducing new ones.',
        promptConstraint: 'Do NOT introduce major new story threads. Focus on resolving existing threads.',
        autoFixable: false,
        timestamp: Date.now(),
      });
    }
  }

  // Check for resolution requirements
  if (requirements.requiredResolutions > 0) {
    const recentResolutions = countRecentResolutions(threads, currentChapter, 5);
    const criticalThreads = activeThreads.filter(t => t.priority === 'critical');

    if (position === 'climax' || position === 'resolution') {
      const unresolvedCritical = criticalThreads.length;
      if (unresolvedCritical > 0) {
        warnings.push({
          id: generateUUID(),
          category: 'arc_pacing',
          severity: 'critical',
          title: `Critical Threads Unresolved in ${requirements.name}`,
          description: `${unresolvedCritical} critical thread(s) remain unresolved in the ${requirements.name} stage.`,
          affectedEntities: criticalThreads.slice(0, 3).map(t => ({ type: 'thread' as const, id: t.id, name: t.title })),
          recommendation: 'Resolve critical threads immediately.',
          promptConstraint: `URGENT: Resolve these critical threads: ${criticalThreads.slice(0, 3).map(t => t.title).join(', ')}`,
          autoFixable: false,
          timestamp: Date.now(),
        });
      }
    }
  }

  return warnings;
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * Generate comprehensive chapter generation warnings report
 */
export function generateChapterWarnings(
  state: NovelState,
  nextChapterNumber: number,
  totalPlannedChapters?: number
): ChapterGenerationReport {
  // Estimate total chapters if not provided
  const estimatedTotal = totalPlannedChapters || Math.max(
    state.chapters.length + 20,
    state.plotLedger?.find(a => a.status === 'active')?.targetEndChapter || state.chapters.length + 30
  );

  // Generate all warnings
  const allWarnings: ChapterGenerationWarning[] = [
    ...analyzeThreadProgression(state, nextChapterNumber),
    ...analyzeThreadDensity(state, nextChapterNumber),
    ...analyzeResolutionUrgency(state, nextChapterNumber, estimatedTotal),
    ...analyzePlotHoleRisks(state, nextChapterNumber),
    ...analyzeCharacterPresence(state, nextChapterNumber),
    ...analyzeArcPacing(state, nextChapterNumber, estimatedTotal),
  ];

  // Separate blockers (critical severity)
  const blockers = allWarnings.filter(w => w.severity === 'critical');
  const warnings = allWarnings.filter(w => w.severity !== 'critical');

  // Collect prompt constraints (prioritize by severity)
  const promptConstraints = allWarnings
    .filter(w => w.promptConstraint)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    })
    .slice(0, 5) // Limit to top 5 constraints
    .map(w => w.promptConstraint!);

  // Build thread summary
  const threads = state.storyThreads || [];
  const activeThreads = threads.filter(t => t.status === 'active');
  const stalledThreads = activeThreads.filter(t => {
    const threshold = getStaleThreshold(t.type, t.priority);
    return (nextChapterNumber - t.lastUpdatedChapter) >= threshold;
  });

  const threadProgressionSummary: ThreadProgressionSummary = {
    activeThreads: activeThreads.length,
    stalledThreads: stalledThreads.length,
    progressedRecently: countRecentProgressions(threads, nextChapterNumber, 3),
    resolvedRecently: countRecentResolutions(threads, nextChapterNumber, 5),
    atRiskOfPlotHole: getAtRiskThreads(threads, nextChapterNumber).length,
    threadDensity: calculateThreadDensity(threads, nextChapterNumber), // Use the updated calculation method
    criticalThreadsCount: activeThreads.filter(t => t.priority === 'critical').length,
    highPriorityThreadsCount: activeThreads.filter(t => t.priority === 'high').length,
  };

  // Build arc position analysis
  const position = determineArcPosition(nextChapterNumber, estimatedTotal);
  const requirements = ARC_POSITION_STANDARDS[position];

  const arcPositionAnalysis: ArcPositionAnalysis = {
    currentPosition: position,
    positionName: requirements.name,
    progressPercentage: Math.round((nextChapterNumber / estimatedTotal) * 100),
    expectedProgressions: [
      `Progress ${requirements.threadProgressionRate}% of active threads`,
      requirements.requiredResolutions > 0 ? `Resolve ${requirements.requiredResolutions}+ threads` : 'No resolution requirements',
      requirements.allowNewThreads ? 'New threads allowed' : 'Avoid new threads',
    ],
    missingElements: [],
    chaptersRemaining: estimatedTotal - nextChapterNumber,
  };

  // Calculate overall health
  const overallHealth = calculateStoryHealthScore(threads, nextChapterNumber, estimatedTotal);

  return {
    chapterNumber: nextChapterNumber,
    timestamp: Date.now(),
    overallHealth,
    warnings,
    blockers,
    promptConstraints,
    threadProgressionSummary,
    arcPositionAnalysis,
  };
}

/**
 * Log chapter generation report to console in a structured format
 */
export function logChapterGenerationReport(report: ChapterGenerationReport): void {
  const healthEmoji = report.overallHealth >= 80 ? '✅' :
    report.overallHealth >= 60 ? '⚠️' : '❌';

  console.group(`📊 Chapter ${report.chapterNumber} Generation Health Report`);

  // Overall health
  console.log(`${healthEmoji} Overall Health: ${report.overallHealth}/100`);
  console.log(`📍 Arc Position: ${report.arcPositionAnalysis.positionName} (${report.arcPositionAnalysis.progressPercentage}%)`);

  // Thread summary
  console.group('📚 Thread Summary');
  console.log(`Active Threads: ${report.threadProgressionSummary.activeThreads}`);
  console.log(`Thread Density: ${report.threadProgressionSummary.threadDensity}/chapter`);
  console.log(`Stalled: ${report.threadProgressionSummary.stalledThreads}`);
  console.log(`At Risk: ${report.threadProgressionSummary.atRiskOfPlotHole}`);
  console.log(`Recent Progressions: ${report.threadProgressionSummary.progressedRecently}`);
  console.log(`Recent Resolutions: ${report.threadProgressionSummary.resolvedRecently}`);
  console.groupEnd();

  // Blockers
  if (report.blockers.length > 0) {
    console.group('🚫 BLOCKERS (Must Address)');
    report.blockers.forEach(w => {
      console.error(`[${w.category}] ${w.title}`);
      console.error(`  → ${w.recommendation}`);
    });
    console.groupEnd();
  }

  // High priority warnings
  const highWarnings = report.warnings.filter(w => w.severity === 'high');
  if (highWarnings.length > 0) {
    console.group('⚠️ HIGH Priority Warnings');
    highWarnings.forEach(w => {
      console.warn(`[${w.category}] ${w.title}`);
      console.warn(`  → ${w.recommendation}`);
    });
    console.groupEnd();
  }

  // Medium/Low warnings
  const otherWarnings = report.warnings.filter(w => w.severity === 'medium' || w.severity === 'low');
  if (otherWarnings.length > 0) {
    console.group('📝 Other Warnings');
    otherWarnings.forEach(w => {
      console.log(`[${w.severity.toUpperCase()}] [${w.category}] ${w.title}`);
    });
    console.groupEnd();
  }

  // Prompt constraints
  if (report.promptConstraints.length > 0) {
    console.group('📋 Prompt Constraints Added');
    report.promptConstraints.forEach((c, i) => console.log(`${i + 1}. ${c}`));
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Get a compact summary of the report for display
 */
export function getReportSummary(report: ChapterGenerationReport): string {
  const lines: string[] = [];

  const healthEmoji = report.overallHealth >= 80 ? '✅' :
    report.overallHealth >= 60 ? '⚠️' : '❌';

  lines.push(`${healthEmoji} Health: ${report.overallHealth}/100 | ${report.arcPositionAnalysis.positionName}`);
  lines.push(`📚 Threads: ${report.threadProgressionSummary.activeThreads} active, ${report.threadProgressionSummary.stalledThreads} stalled, ${report.threadProgressionSummary.atRiskOfPlotHole} at risk`);

  if (report.blockers.length > 0) {
    lines.push(`🚫 ${report.blockers.length} blocker(s)`);
  }

  if (report.warnings.filter(w => w.severity === 'high').length > 0) {
    lines.push(`⚠️ ${report.warnings.filter(w => w.severity === 'high').length} high-priority warning(s)`);
  }

  return lines.join('\n');
}

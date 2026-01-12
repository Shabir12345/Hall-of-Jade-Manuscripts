import { NovelState, Chapter, Arc, Scene, ConflictHierarchy } from '../types';
import { generateUUID } from '../utils/uuid';

/**
 * Conflict Tracker
 * Manages conflict hierarchy (story-level, arc-level, chapter-level, scene-level)
 * and tracks conflict resolution
 */

export interface ConflictAnalysis {
  conflicts: ConflictHierarchy[];
  storyLevelConflicts: ConflictHierarchy[];
  arcLevelConflicts: ConflictHierarchy[];
  chapterLevelConflicts: ConflictHierarchy[];
  sceneLevelConflicts: ConflictHierarchy[];
  unresolvedConflicts: ConflictHierarchy[];
  resolvedConflicts: ConflictHierarchy[];
  conflictTypes: {
    man_vs_man: ConflictHierarchy[];
    man_vs_self: ConflictHierarchy[];
    man_vs_nature: ConflictHierarchy[];
    man_vs_society: ConflictHierarchy[];
  };
  recommendations: string[];
}

/**
 * Analyzes conflicts across all levels
 */
export function analyzeConflicts(state: NovelState): ConflictAnalysis {
  const chapters = state.chapters.sort((a, b) => a.number - b.number);

  if (chapters.length === 0) {
    return {
      conflicts: [],
      storyLevelConflicts: [],
      arcLevelConflicts: [],
      chapterLevelConflicts: [],
      sceneLevelConflicts: [],
      unresolvedConflicts: [],
      resolvedConflicts: [],
      conflictTypes: {
        man_vs_man: [],
        man_vs_self: [],
        man_vs_nature: [],
        man_vs_society: [],
      },
      recommendations: ['No chapters available for conflict analysis'],
    };
  }

  // Get or build conflicts
  let conflicts: ConflictHierarchy[] = [];
  if (state.conflictHierarchies && state.conflictHierarchies.length > 0) {
    conflicts = [...state.conflictHierarchies];
  } else {
    conflicts = buildConflictHierarchy(chapters, state);
  }

  // Categorize conflicts by level
  const storyLevelConflicts = conflicts.filter(c => c.conflictLevel === 'story');
  const arcLevelConflicts = conflicts.filter(c => c.conflictLevel === 'arc');
  const chapterLevelConflicts = conflicts.filter(c => c.conflictLevel === 'chapter');
  const sceneLevelConflicts = conflicts.filter(c => c.conflictLevel === 'scene');

  // Categorize by resolution status
  const unresolvedConflicts = conflicts.filter(c => !c.isResolved);
  const resolvedConflicts = conflicts.filter(c => c.isResolved);

  // Categorize by conflict type
  const conflictTypes = {
    man_vs_man: conflicts.filter(c => c.conflictType === 'man_vs_man'),
    man_vs_self: conflicts.filter(c => c.conflictType === 'man_vs_self'),
    man_vs_nature: conflicts.filter(c => c.conflictType === 'man_vs_nature'),
    man_vs_society: conflicts.filter(c => c.conflictType === 'man_vs_society'),
  };

  // Generate recommendations
  const recommendations = generateConflictRecommendations(
    conflicts,
    unresolvedConflicts,
    resolvedConflicts,
    state
  );

  return {
    conflicts,
    storyLevelConflicts,
    arcLevelConflicts,
    chapterLevelConflicts,
    sceneLevelConflicts,
    unresolvedConflicts,
    resolvedConflicts,
    conflictTypes,
    recommendations,
  };
}

/**
 * Builds conflict hierarchy from chapters and arcs
 */
function buildConflictHierarchy(chapters: Chapter[], state: NovelState): ConflictHierarchy[] {
  const conflicts: ConflictHierarchy[] = [];

  // Detect story-level conflict (main conflict spanning the entire story)
  const storyLevelConflict = detectStoryLevelConflict(chapters, state);
  if (storyLevelConflict) {
    conflicts.push(storyLevelConflict);
  }

  // Detect arc-level conflicts
  state.plotLedger.forEach(arc => {
    const arcConflict = detectArcLevelConflict(arc, chapters, state);
    if (arcConflict) {
      conflicts.push(arcConflict);
    }
  });

  // Detect chapter-level conflicts
  chapters.forEach(chapter => {
    const chapterConflict = detectChapterLevelConflict(chapter, state);
    if (chapterConflict) {
      conflicts.push(chapterConflict);
    }
  });

  // Detect scene-level conflicts
  chapters.forEach(chapter => {
    chapter.scenes?.forEach(scene => {
      const sceneConflict = detectSceneLevelConflict(scene, chapter, state);
      if (sceneConflict) {
        conflicts.push(sceneConflict);
      }
    });
  });

  // Link related conflicts
  linkRelatedConflicts(conflicts, chapters);

  return conflicts;
}

/**
 * Detects story-level conflict
 */
function detectStoryLevelConflict(chapters: Chapter[], state: NovelState): ConflictHierarchy | null {
  if (chapters.length === 0) return null;

  // Analyze overall story for main conflict
  const allContent = chapters.map(ch => (ch.content + ' ' + ch.summary).toLowerCase()).join(' ');

  // Look for main conflict indicators
  const mainConflictIndicators = [
    'main goal', 'primary objective', 'ultimate challenge', 'final boss',
    'main antagonist', 'greatest enemy', 'primary conflict', 'overarching'
  ];

  const hasMainConflict = mainConflictIndicators.some(indicator => allContent.includes(indicator));

  if (!hasMainConflict) {
    // Infer from antagonist system
    const mainAntagonist = state.antagonists?.find(a => a.role === 'main' || a.isPrimary);
    if (mainAntagonist) {
      return {
        id: generateUUID(),
        novelId: state.id,
        conflictLevel: 'story',
        conflictType: 'man_vs_man',
        conflictDescription: `Primary conflict with ${mainAntagonist.name}`,
        isResolved: false,
        relatedConflictIds: [],
        notes: 'Inferred from antagonist system',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
  }

  // Determine conflict type
  let conflictType: ConflictHierarchy['conflictType'] = 'man_vs_man';

  if (allContent.includes('internal struggle') || allContent.includes('inner conflict')) {
    conflictType = 'man_vs_self';
  } else if (allContent.includes('nature') || allContent.includes('environment') || allContent.includes('disaster')) {
    conflictType = 'man_vs_nature';
  } else if (allContent.includes('society') || allContent.includes('system') || allContent.includes('authority')) {
    conflictType = 'man_vs_society';
  }

  // Find resolution (if story is complete)
  const lastChapters = chapters.slice(-5);
  const hasResolution = lastChapters.some(ch => {
    const content = (ch.content + ' ' + ch.summary).toLowerCase();
    return content.includes('resolved') || content.includes('resolved') || content.includes('concluded');
  });

  const resolutionChapterId = hasResolution ? lastChapters[lastChapters.length - 1].id : undefined;

  return {
    id: generateUUID(),
    novelId: state.id,
    conflictLevel: 'story',
    conflictType,
    conflictDescription: 'Main story conflict (to be refined based on content)',
    isResolved: hasResolution,
    resolutionChapterId,
    relatedConflictIds: [],
    notes: 'Detected story-level conflict',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Detects arc-level conflict
 */
function detectArcLevelConflict(arc: Arc, chapters: Chapter[], state: NovelState): ConflictHierarchy | null {
  const arcChapters = chapters.filter(ch => 
    (ch.content + ' ' + ch.summary).toLowerCase().includes(arc.title.toLowerCase()) ||
    arc.startedAtChapter && ch.number >= arc.startedAtChapter &&
    arc.endedAtChapter && ch.number <= arc.endedAtChapter
  );

  if (arcChapters.length === 0) return null;

  const arcContent = arcChapters.map(ch => (ch.content + ' ' + ch.summary).toLowerCase()).join(' ');

  // Look for conflict indicators
  const conflictIndicators = [
    'conflict', 'battle', 'fight', 'challenge', 'opponent', 'enemy',
    'antagonist', 'rival', 'threat', 'danger', 'crisis'
  ];

  const hasConflict = conflictIndicators.some(indicator => arcContent.includes(indicator));
  if (!hasConflict) return null;

  // Determine conflict type
  let conflictType: ConflictHierarchy['conflictType'] = 'man_vs_man';

  if (arcContent.includes('internal') || arcContent.includes('struggle')) {
    conflictType = 'man_vs_self';
  } else if (arcContent.includes('nature') || arcContent.includes('environment')) {
    conflictType = 'man_vs_nature';
  } else if (arcContent.includes('society') || arcContent.includes('authority')) {
    conflictType = 'man_vs_society';
  }

  // Check for resolution
  const isResolved = arc.status === 'completed';
  const resolutionChapterId = isResolved && arc.endedAtChapter
    ? chapters.find(ch => ch.number === arc.endedAtChapter)?.id
    : undefined;

  return {
    id: generateUUID(),
    novelId: state.id,
    conflictLevel: 'arc',
    arcId: arc.id,
    conflictType,
    conflictDescription: `Arc conflict: ${arc.title}`,
    isResolved,
    resolutionChapterId,
    relatedConflictIds: [],
    notes: `Detected in arc "${arc.title}"`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Detects chapter-level conflict
 */
function detectChapterLevelConflict(chapter: Chapter, state: NovelState): ConflictHierarchy | null {
  const content = (chapter.content + ' ' + chapter.summary).toLowerCase();

  // Look for conflict indicators
  const conflictIndicators = [
    'conflict', 'battle', 'fight', 'challenge', 'opponent', 'enemy',
    'antagonist', 'rival', 'threat', 'danger', 'crisis', 'clash'
  ];

  const hasConflict = conflictIndicators.some(indicator => content.includes(indicator));
  if (!hasConflict) {
    // Check logic audit for conflict
    if (chapter.logicAudit && chapter.logicAudit.causalityType === 'But') {
      // This is a conflict moment
      return {
        id: generateUUID(),
        novelId: state.id,
        conflictLevel: 'chapter',
        chapterId: chapter.id,
        conflictType: determineConflictTypeFromContent(content),
        conflictDescription: chapter.logicAudit.theFriction || `Conflict in chapter ${chapter.number}`,
        isResolved: false,
        relatedConflictIds: [],
        notes: `Detected from logic audit in chapter ${chapter.number}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }
    return null;
  }

  // Determine conflict type
  const conflictType = determineConflictTypeFromContent(content);

  // Check for resolution
  const hasResolution = content.includes('resolved') || 
                       content.includes('resolved') ||
                       content.includes('concluded') ||
                       content.includes('victory');

  return {
    id: generateUUID(),
    novelId: state.id,
    conflictLevel: 'chapter',
    chapterId: chapter.id,
    conflictType,
    conflictDescription: `Chapter conflict: ${chapter.title || `Chapter ${chapter.number}`}`,
    isResolved: hasResolution,
    resolutionChapterId: hasResolution ? chapter.id : undefined,
    relatedConflictIds: [],
    notes: `Detected in chapter ${chapter.number}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Detects scene-level conflict
 */
function detectSceneLevelConflict(scene: Scene, chapter: Chapter, state: NovelState): ConflictHierarchy | null {
  const content = (scene.content + ' ' + scene.summary).toLowerCase();

  // Look for conflict indicators
  const conflictIndicators = [
    'conflict', 'disagreement', 'argument', 'tension', 'confrontation',
    'clash', 'fight', 'battle', 'challenge'
  ];

  const hasConflict = conflictIndicators.some(indicator => content.includes(indicator));
  if (!hasConflict) return null;

  // Determine conflict type
  const conflictType = determineConflictTypeFromContent(content);

  return {
    id: generateUUID(),
    novelId: state.id,
    conflictLevel: 'scene',
    chapterId: chapter.id,
    sceneId: scene.id,
    conflictType,
    conflictDescription: `Scene conflict: ${scene.title || `Scene ${scene.number}`}`,
    isResolved: false, // Scenes usually resolve within chapter
    relatedConflictIds: [],
    notes: `Detected in scene ${scene.number} of chapter ${chapter.number}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Determines conflict type from content
 */
function determineConflictTypeFromContent(content: string): ConflictHierarchy['conflictType'] {
  if (content.includes('internal') || content.includes('struggle') || content.includes('inner') || content.includes('self')) {
    return 'man_vs_self';
  }

  if (content.includes('nature') || content.includes('environment') || content.includes('disaster') || content.includes('storm')) {
    return 'man_vs_nature';
  }

  if (content.includes('society') || content.includes('authority') || content.includes('system') || content.includes('government')) {
    return 'man_vs_society';
  }

  // Default to man vs man
  return 'man_vs_man';
}

/**
 * Links related conflicts
 */
function linkRelatedConflicts(conflicts: ConflictHierarchy[], chapters: Chapter[]): void {
  conflicts.forEach(conflict => {
    const relatedIds: string[] = [];

    // Link conflicts at different levels that are related
    conflicts.forEach(otherConflict => {
      if (otherConflict.id === conflict.id) return;

      // Check if conflicts are related (same type, similar description, or hierarchical)
      const isRelated = 
        // Same conflict type
        (otherConflict.conflictType === conflict.conflictType) ||
        // Hierarchical relationship (story -> arc -> chapter -> scene)
        ((conflict.conflictLevel === 'story' && otherConflict.conflictLevel === 'arc') ||
         (conflict.conflictLevel === 'arc' && otherConflict.conflictLevel === 'chapter') ||
         (conflict.conflictLevel === 'chapter' && otherConflict.conflictLevel === 'scene')) ||
        // Same arc/chapter
        (conflict.arcId && otherConflict.arcId && conflict.arcId === otherConflict.arcId) ||
        (conflict.chapterId && otherConflict.chapterId && conflict.chapterId === otherConflict.chapterId);

      if (isRelated) {
        relatedIds.push(otherConflict.id);
      }
    });

    conflict.relatedConflictIds = relatedIds;
  });
}

/**
 * Generates conflict recommendations
 */
function generateConflictRecommendations(
  conflicts: ConflictHierarchy[],
  unresolvedConflicts: ConflictHierarchy[],
  resolvedConflicts: ConflictHierarchy[],
  state: NovelState
): string[] {
  const recommendations: string[] = [];

  // Check for story-level conflict
  const storyConflicts = conflicts.filter(c => c.conflictLevel === 'story');
  if (storyConflicts.length === 0) {
    recommendations.push('No story-level conflict detected. Consider establishing a main conflict that spans the entire story.');
  }

  // Check for unresolved conflicts
  if (unresolvedConflicts.length > 10) {
    recommendations.push(`Many unresolved conflicts (${unresolvedConflicts.length}). Consider resolving some conflicts to maintain story momentum.`);
  }

  // Check conflict variety
  const conflictTypeCount = new Set(conflicts.map(c => c.conflictType)).size;
  if (conflictTypeCount < 2 && conflicts.length > 5) {
    recommendations.push(`Limited conflict variety (${conflictTypeCount} types). Consider adding different types of conflicts.`);
  }

  // Check for man vs self conflicts (internal conflict)
  const internalConflicts = conflicts.filter(c => c.conflictType === 'man_vs_self');
  if (internalConflicts.length === 0 && conflicts.length > 5) {
    recommendations.push('No internal conflicts (man vs self) detected. Consider adding character internal struggles.');
  }

  // Check arc conflicts
  const arcs = state.plotLedger;
  const arcConflicts = conflicts.filter(c => c.conflictLevel === 'arc');
  if (arcConflicts.length < arcs.length * 0.5 && arcs.length > 1) {
    recommendations.push(`Not all arcs have detected conflicts. Consider adding conflicts to each arc.`);
  }

  // Check for conflict resolution pattern
  const resolutionRate = resolvedConflicts.length / conflicts.length;
  if (resolutionRate < 0.2 && conflicts.length > 5) {
    recommendations.push(`Low conflict resolution rate (${Math.round(resolutionRate * 100)}%). Consider resolving some conflicts to show progress.`);
  }

  // Positive feedback
  if (storyConflicts.length > 0 && conflictTypeCount >= 3 && resolutionRate >= 0.3) {
    recommendations.push('Good conflict structure! Clear hierarchy, variety, and appropriate resolution rate.');
  }

  return recommendations;
}

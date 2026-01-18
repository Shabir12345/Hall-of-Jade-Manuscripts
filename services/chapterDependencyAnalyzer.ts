/**
 * Chapter Dependency Analyzer
 * 
 * Analyzes chapters for dependencies on entities that were created or updated
 * in other chapters. Used to detect which chapters need regeneration when
 * a chapter is deleted.
 */

import { NovelState, Chapter, Character, WorldEntry, Territory, NovelItem, NovelTechnique, Antagonist } from '../types';
import { logger } from './loggingService';

export interface ChapterDependency {
  chapterId: string;
  chapterNumber: number;
  dependencies: Array<{
    entityType: 'character' | 'worldEntry' | 'territory' | 'item' | 'technique' | 'antagonist';
    entityId: string;
    entityName: string;
    referencedInChapter: number;
    dependencyType: 'created' | 'updated';
    dependencyChapterId: string;
    dependencyChapterNumber: number;
  }>;
}

/**
 * Detect chapters that depend on entities created or updated in a deleted chapter
 */
export function detectDependentChapters(
  novelState: NovelState,
  deletedChapterId: string,
  deletedChapterNumber: number
): ChapterDependency[] {
  logger.info('Detecting dependent chapters', 'chapterDependency', {
    deletedChapterId,
    deletedChapterNumber,
  });

  const dependencies: ChapterDependency[] = [];

  // Find all chapters that come after the deleted chapter
  const subsequentChapters = novelState.chapters.filter(
    c => c.number > deletedChapterNumber
  );

  if (subsequentChapters.length === 0) {
    logger.info('No subsequent chapters to check', 'chapterDependency', {
      deletedChapterId,
    });
    return [];
  }

  // Find entities created or updated in the deleted chapter
  const entitiesFromDeletedChapter = findEntitiesFromChapter(
    novelState,
    deletedChapterId,
    deletedChapterNumber
  );

  logger.info('Found entities from deleted chapter', 'chapterDependency', {
    deletedChapterId,
    entityCounts: {
      characters: entitiesFromDeletedChapter.characters.length,
      worldEntries: entitiesFromDeletedChapter.worldEntries.length,
      territories: entitiesFromDeletedChapter.territories.length,
      items: entitiesFromDeletedChapter.items.length,
      techniques: entitiesFromDeletedChapter.techniques.length,
      antagonists: entitiesFromDeletedChapter.antagonists.length,
    },
  });

  // Check each subsequent chapter for references to these entities
  subsequentChapters.forEach(chapter => {
    const chapterDependencies = analyzeChapterDependencies(
      chapter,
      novelState,
      entitiesFromDeletedChapter,
      deletedChapterId,
      deletedChapterNumber
    );

    if (chapterDependencies.dependencies.length > 0) {
      dependencies.push(chapterDependencies);
      logger.info('Chapter has dependencies', 'chapterDependency', {
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        dependencyCount: chapterDependencies.dependencies.length,
      });
    }
  });

  if (dependencies.length > 0) {
    logger.info('Dependent chapters detected', 'chapterDependency', {
      deletedChapterId,
      dependentChapterCount: dependencies.length,
      totalDependencies: dependencies.reduce(
        (sum, d) => sum + d.dependencies.length,
        0
      ),
    });
  }

  return dependencies;
}

/**
 * Find all entities that were created or updated in a specific chapter
 */
function findEntitiesFromChapter(
  novelState: NovelState,
  chapterId: string,
  chapterNumber: number
): {
  characters: Character[];
  worldEntries: WorldEntry[];
  territories: Territory[];
  items: NovelItem[];
  techniques: NovelTechnique[];
  antagonists: Antagonist[];
} {
  return {
    characters: novelState.characterCodex.filter(
      c => c.createdByChapterId === chapterId || c.lastUpdatedByChapterId === chapterId
    ),
    worldEntries: novelState.worldBible.filter(
      w => w.createdByChapterId === chapterId || w.lastUpdatedByChapterId === chapterId
    ),
    territories: novelState.territories.filter(
      t => t.createdByChapterId === chapterId || t.lastUpdatedByChapterId === chapterId
    ),
    items: (novelState.novelItems || []).filter(
      i => i.createdByChapterId === chapterId || i.lastUpdatedByChapterId === chapterId
    ),
    techniques: (novelState.novelTechniques || []).filter(
      t => t.createdByChapterId === chapterId || t.lastUpdatedByChapterId === chapterId
    ),
    antagonists: (novelState.antagonists || []).filter(
      a => a.createdByChapterId === chapterId || a.lastUpdatedByChapterId === chapterId
    ),
  };
}

/**
 * Analyze a chapter for dependencies on entities from the deleted chapter
 */
function analyzeChapterDependencies(
  chapter: Chapter,
  novelState: NovelState,
  entitiesFromDeletedChapter: ReturnType<typeof findEntitiesFromChapter>,
  deletedChapterId: string,
  deletedChapterNumber: number
): ChapterDependency {
  const dependencies: ChapterDependency['dependencies'] = [];

  // Check chapter content and summary for entity references
  const chapterText = `${chapter.content} ${chapter.summary} ${chapter.title}`.toLowerCase();

  // Check character references
  entitiesFromDeletedChapter.characters.forEach(char => {
    if (chapterText.includes(char.name.toLowerCase())) {
      dependencies.push({
        entityType: 'character',
        entityId: char.id,
        entityName: char.name,
        referencedInChapter: chapter.number,
        dependencyType: char.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  // Check world entry references
  entitiesFromDeletedChapter.worldEntries.forEach(entry => {
    if (chapterText.includes(entry.title.toLowerCase())) {
      dependencies.push({
        entityType: 'worldEntry',
        entityId: entry.id,
        entityName: entry.title,
        referencedInChapter: chapter.number,
        dependencyType: entry.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  // Check territory references
  entitiesFromDeletedChapter.territories.forEach(territory => {
    if (chapterText.includes(territory.name.toLowerCase())) {
      dependencies.push({
        entityType: 'territory',
        entityId: territory.id,
        entityName: territory.name,
        referencedInChapter: chapter.number,
        dependencyType: territory.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  // Check item references
  entitiesFromDeletedChapter.items.forEach(item => {
    if (chapterText.includes(item.name.toLowerCase())) {
      dependencies.push({
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
        referencedInChapter: chapter.number,
        dependencyType: item.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  // Check technique references
  entitiesFromDeletedChapter.techniques.forEach(technique => {
    if (chapterText.includes(technique.name.toLowerCase())) {
      dependencies.push({
        entityType: 'technique',
        entityId: technique.id,
        entityName: technique.name,
        referencedInChapter: chapter.number,
        dependencyType: technique.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  // Check antagonist references
  entitiesFromDeletedChapter.antagonists.forEach(antagonist => {
    if (chapterText.includes(antagonist.name.toLowerCase())) {
      dependencies.push({
        entityType: 'antagonist',
        entityId: antagonist.id,
        entityName: antagonist.name,
        referencedInChapter: chapter.number,
        dependencyType: antagonist.createdByChapterId === deletedChapterId ? 'created' : 'updated',
        dependencyChapterId: deletedChapterId,
        dependencyChapterNumber: deletedChapterNumber,
      });
    }
  });

  return {
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    dependencies,
  };
}

/**
 * Mark chapters as needing regeneration based on dependencies
 */
export function markChaptersForRegeneration(
  novelState: NovelState,
  dependentChapters: ChapterDependency[]
): NovelState {
  if (dependentChapters.length === 0) {
    return novelState;
  }

  logger.info('Marking chapters for regeneration', 'chapterDependency', {
    chapterCount: dependentChapters.length,
  });

  const chapterIds = new Set(dependentChapters.map(d => d.chapterId));
  
  const updatedChapters = novelState.chapters.map(chapter => {
    if (chapterIds.has(chapter.id)) {
      const dependency = dependentChapters.find(d => d.chapterId === chapter.id);
      return {
        ...chapter,
        needsRegeneration: true,
        regenerationReason: `References entities from deleted chapter ${dependency?.dependencies[0]?.dependencyChapterNumber || ''}`,
        dependencyOnChapterId: dependency?.dependencies[0]?.dependencyChapterId,
      };
    }
    return chapter;
  });

  return {
    ...novelState,
    chapters: updatedChapters,
  };
}

/**
 * Indexing Pipeline
 * 
 * Manages the indexing of novel entities into Pinecone for semantic search.
 * Supports full re-indexing, incremental updates, and background sync.
 */

import { NovelState, Character, Chapter, WorldEntry, NovelItem, NovelTechnique, Antagonist, StoryThread, Arc, Territory } from '../../types';
import { logger } from '../loggingService';
import { generateEmbedding, generateEmbeddingsBatch, combineFieldsForEmbedding, prepareTextForEmbedding } from './embeddingService';
import { upsertVectors, deleteVectors, deleteAllVectorsForNovel, getNovelStats, PineconeVector, isPineconeReady } from './pineconeService';

/**
 * Entity types that can be indexed
 */
export type IndexableEntityType = 
  | 'character'
  | 'chapter'
  | 'chapter_summary'
  | 'world_entry'
  | 'item'
  | 'technique'
  | 'antagonist'
  | 'story_thread'
  | 'arc'
  | 'territory';

/**
 * Metadata stored with each vector
 */
export interface VectorMetadata {
  entityType: IndexableEntityType;
  entityId: string;
  novelId: string;
  name?: string;
  title?: string;
  chapterNumber?: number;
  category?: string;
  status?: string;
  cultivation?: string;
  priority?: string;
  threatLevel?: string;
  createdAt: number;
  contentHash: string;
}

/**
 * Indexing result
 */
export interface IndexingResult {
  success: boolean;
  indexedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
}

/**
 * Sync status for tracking what's indexed
 */
export interface SyncStatus {
  entityType: IndexableEntityType;
  entityId: string;
  pineconeId: string;
  lastSynced: number;
  contentHash: string;
}

// In-memory sync status cache
const syncStatusCache = new Map<string, SyncStatus>();

/**
 * Generate a content hash for change detection
 */
function generateContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `hash_${Math.abs(hash).toString(16)}`;
}

/**
 * Generate a Pinecone vector ID
 */
function generateVectorId(entityType: IndexableEntityType, entityId: string, novelId: string): string {
  return `${novelId}_${entityType}_${entityId}`;
}

/**
 * Get sync status cache key
 */
function getSyncKey(novelId: string, entityType: IndexableEntityType, entityId: string): string {
  return `${novelId}:${entityType}:${entityId}`;
}

/**
 * Check if entity needs re-indexing
 */
function needsReindex(novelId: string, entityType: IndexableEntityType, entityId: string, content: string): boolean {
  const key = getSyncKey(novelId, entityType, entityId);
  const existing = syncStatusCache.get(key);
  
  if (!existing) {
    return true; // Never indexed
  }
  
  const newHash = generateContentHash(content);
  return existing.contentHash !== newHash;
}

/**
 * Update sync status after successful indexing
 */
function updateSyncStatus(novelId: string, entityType: IndexableEntityType, entityId: string, content: string): void {
  const key = getSyncKey(novelId, entityType, entityId);
  const pineconeId = generateVectorId(entityType, entityId, novelId);
  
  syncStatusCache.set(key, {
    entityType,
    entityId,
    pineconeId,
    lastSynced: Date.now(),
    contentHash: generateContentHash(content),
  });
}

/**
 * Index a single character
 */
async function indexCharacter(character: Character, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    name: character.name,
    personality: character.personality,
    background: character.background,
    goals: character.goals,
    flaws: character.flaws,
    cultivation: character.currentCultivation,
    appearance: character.appearance,
    notes: character.notes,
  });

  if (!needsReindex(novelId, 'character', character.id, content)) {
    return null; // Already up to date
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'character',
    entityId: character.id,
    novelId,
    name: character.name,
    status: character.status,
    cultivation: character.currentCultivation,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'character', character.id, content);

  return {
    id: generateVectorId('character', character.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a chapter summary
 */
async function indexChapterSummary(chapter: Chapter, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    title: chapter.title,
    summary: chapter.summary,
    chapterNumber: `Chapter ${chapter.number}`,
  });

  if (!content.trim()) {
    return null;
  }

  if (!needsReindex(novelId, 'chapter_summary', chapter.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'chapter_summary',
    entityId: chapter.id,
    novelId,
    title: chapter.title,
    chapterNumber: chapter.number,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'chapter_summary', chapter.id, content);

  return {
    id: generateVectorId('chapter_summary', chapter.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a world entry
 */
async function indexWorldEntry(entry: WorldEntry, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    title: entry.title,
    category: entry.category,
    content: entry.content,
  });

  if (!needsReindex(novelId, 'world_entry', entry.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'world_entry',
    entityId: entry.id,
    novelId,
    title: entry.title,
    category: entry.category,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'world_entry', entry.id, content);

  return {
    id: generateVectorId('world_entry', entry.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a novel item
 */
async function indexItem(item: NovelItem, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    name: item.name,
    description: item.description,
    category: item.category,
    powers: item.powers?.join(', '),
    history: item.history,
  });

  if (!needsReindex(novelId, 'item', item.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'item',
    entityId: item.id,
    novelId,
    name: item.name,
    category: item.category,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'item', item.id, content);

  return {
    id: generateVectorId('item', item.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a technique
 */
async function indexTechnique(technique: NovelTechnique, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    name: technique.name,
    description: technique.description,
    category: technique.category,
    type: technique.type,
    functions: technique.functions?.join(', '),
    history: technique.history,
  });

  if (!needsReindex(novelId, 'technique', technique.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'technique',
    entityId: technique.id,
    novelId,
    name: technique.name,
    category: technique.category,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'technique', technique.id, content);

  return {
    id: generateVectorId('technique', technique.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index an antagonist
 */
async function indexAntagonist(antagonist: Antagonist, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    name: antagonist.name,
    type: antagonist.type,
    description: antagonist.description,
    motivation: antagonist.motivation,
    powerLevel: antagonist.powerLevel,
    notes: antagonist.notes,
  });

  if (!needsReindex(novelId, 'antagonist', antagonist.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'antagonist',
    entityId: antagonist.id,
    novelId,
    name: antagonist.name,
    status: antagonist.status,
    threatLevel: antagonist.threatLevel,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'antagonist', antagonist.id, content);

  return {
    id: generateVectorId('antagonist', antagonist.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a story thread
 */
async function indexStoryThread(thread: StoryThread, novelId: string): Promise<PineconeVector | null> {
  const progressionNotes = thread.progressionNotes?.map(p => p.note).join(' ') || '';
  
  const content = combineFieldsForEmbedding({
    title: thread.title,
    type: thread.type,
    description: thread.description,
    progressionNotes,
    resolutionNotes: thread.resolutionNotes,
  });

  if (!needsReindex(novelId, 'story_thread', thread.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'story_thread',
    entityId: thread.id,
    novelId,
    title: thread.title,
    status: thread.status,
    priority: thread.priority,
    category: thread.type,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'story_thread', thread.id, content);

  return {
    id: generateVectorId('story_thread', thread.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index an arc
 */
async function indexArc(arc: Arc, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    title: arc.title,
    description: arc.description,
    status: arc.status,
  });

  if (!needsReindex(novelId, 'arc', arc.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'arc',
    entityId: arc.id,
    novelId,
    title: arc.title,
    status: arc.status,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'arc', arc.id, content);

  return {
    id: generateVectorId('arc', arc.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Index a territory
 */
async function indexTerritory(territory: Territory, novelId: string): Promise<PineconeVector | null> {
  const content = combineFieldsForEmbedding({
    name: territory.name,
    type: territory.type,
    description: territory.description,
  });

  if (!needsReindex(novelId, 'territory', territory.id, content)) {
    return null;
  }

  const embedding = await generateEmbedding(prepareTextForEmbedding(content));
  if (!embedding) {
    return null;
  }

  const metadata: VectorMetadata = {
    entityType: 'territory',
    entityId: territory.id,
    novelId,
    name: territory.name,
    category: territory.type,
    createdAt: Date.now(),
    contentHash: generateContentHash(content),
  };

  updateSyncStatus(novelId, 'territory', territory.id, content);

  return {
    id: generateVectorId('territory', territory.id, novelId),
    values: embedding,
    metadata,
  };
}

/**
 * Full re-index of all novel entities
 */
export async function fullReindex(state: NovelState): Promise<IndexingResult> {
  const startTime = Date.now();
  const vectors: PineconeVector[] = [];
  const errors: string[] = [];
  let failedCount = 0;

  logger.info('Starting full reindex', 'indexingPipeline', { novelId: state.id });

  // Check if Pinecone is ready
  const ready = await isPineconeReady();
  if (!ready) {
    return {
      success: false,
      indexedCount: 0,
      failedCount: 0,
      errors: ['Pinecone service not available'],
      duration: Date.now() - startTime,
    };
  }

  // Clear existing vectors for this novel
  await deleteAllVectorsForNovel(state.id);
  
  // Clear sync cache for this novel
  for (const key of syncStatusCache.keys()) {
    if (key.startsWith(state.id)) {
      syncStatusCache.delete(key);
    }
  }

  // Index characters
  logger.debug('Indexing characters', 'indexingPipeline', undefined, { count: state.characterCodex.length });
  for (const character of state.characterCodex) {
    try {
      const vector = await indexCharacter(character, state.id);
      if (vector) vectors.push(vector);
    } catch (error) {
      failedCount++;
      errors.push(`Character ${character.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Index chapter summaries
  logger.debug('Indexing chapter summaries', 'indexingPipeline', undefined, { count: state.chapters.length });
  for (const chapter of state.chapters) {
    try {
      const vector = await indexChapterSummary(chapter, state.id);
      if (vector) vectors.push(vector);
    } catch (error) {
      failedCount++;
      errors.push(`Chapter ${chapter.number}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Index world bible entries
  logger.debug('Indexing world entries', 'indexingPipeline', undefined, { count: state.worldBible.length });
  for (const entry of state.worldBible) {
    try {
      const vector = await indexWorldEntry(entry, state.id);
      if (vector) vectors.push(vector);
    } catch (error) {
      failedCount++;
      errors.push(`World entry ${entry.title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Index items
  if (state.novelItems) {
    logger.debug('Indexing items', 'indexingPipeline', undefined, { count: state.novelItems.length });
    for (const item of state.novelItems) {
      try {
        const vector = await indexItem(item, state.id);
        if (vector) vectors.push(vector);
      } catch (error) {
        failedCount++;
        errors.push(`Item ${item.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Index techniques
  if (state.novelTechniques) {
    logger.debug('Indexing techniques', 'indexingPipeline', undefined, { count: state.novelTechniques.length });
    for (const technique of state.novelTechniques) {
      try {
        const vector = await indexTechnique(technique, state.id);
        if (vector) vectors.push(vector);
      } catch (error) {
        failedCount++;
        errors.push(`Technique ${technique.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Index antagonists
  if (state.antagonists) {
    logger.debug('Indexing antagonists', 'indexingPipeline', undefined, { count: state.antagonists.length });
    for (const antagonist of state.antagonists) {
      try {
        const vector = await indexAntagonist(antagonist, state.id);
        if (vector) vectors.push(vector);
      } catch (error) {
        failedCount++;
        errors.push(`Antagonist ${antagonist.name}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Index story threads
  if (state.storyThreads) {
    logger.debug('Indexing story threads', 'indexingPipeline', undefined, { count: state.storyThreads.length });
    for (const thread of state.storyThreads) {
      try {
        const vector = await indexStoryThread(thread, state.id);
        if (vector) vectors.push(vector);
      } catch (error) {
        failedCount++;
        errors.push(`Story thread ${thread.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  // Index arcs
  logger.debug('Indexing arcs', 'indexingPipeline', undefined, { count: state.plotLedger.length });
  for (const arc of state.plotLedger) {
    try {
      const vector = await indexArc(arc, state.id);
      if (vector) vectors.push(vector);
    } catch (error) {
      failedCount++;
      errors.push(`Arc ${arc.title}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Index territories
  logger.debug('Indexing territories', 'indexingPipeline', undefined, { count: state.territories.length });
  for (const territory of state.territories) {
    try {
      const vector = await indexTerritory(territory, state.id);
      if (vector) vectors.push(vector);
    } catch (error) {
      failedCount++;
      errors.push(`Territory ${territory.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Upsert all vectors to Pinecone
  if (vectors.length > 0) {
    logger.debug('Upserting vectors to Pinecone', 'indexingPipeline', undefined, { count: vectors.length });
    const result = await upsertVectors(state.id, vectors);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
  }

  const duration = Date.now() - startTime;
  
  logger.info('Full reindex completed', 'indexingPipeline', {
    novelId: state.id,
    indexedCount: vectors.length,
    failedCount,
    duration,
  });

  return {
    success: errors.length === 0,
    indexedCount: vectors.length,
    failedCount,
    errors,
    duration,
  };
}

/**
 * Incremental index update after chapter generation
 */
export async function incrementalIndex(
  state: NovelState,
  changedEntities: {
    characters?: string[];
    chapters?: string[];
    worldEntries?: string[];
    items?: string[];
    techniques?: string[];
    antagonists?: string[];
    storyThreads?: string[];
    arcs?: string[];
    territories?: string[];
  }
): Promise<IndexingResult> {
  const startTime = Date.now();
  const vectors: PineconeVector[] = [];
  const errors: string[] = [];
  let failedCount = 0;

  logger.debug('Starting incremental index', 'indexingPipeline', undefined, {
    novelId: state.id,
    changedEntities,
  });

  // Check if Pinecone is ready
  const ready = await isPineconeReady();
  if (!ready) {
    return {
      success: false,
      indexedCount: 0,
      failedCount: 0,
      errors: ['Pinecone service not available'],
      duration: Date.now() - startTime,
    };
  }

  // Index changed characters
  if (changedEntities.characters?.length) {
    for (const charId of changedEntities.characters) {
      const character = state.characterCodex.find(c => c.id === charId);
      if (character) {
        try {
          const vector = await indexCharacter(character, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Character ${charId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed chapters
  if (changedEntities.chapters?.length) {
    for (const chapterId of changedEntities.chapters) {
      const chapter = state.chapters.find(c => c.id === chapterId);
      if (chapter) {
        try {
          const vector = await indexChapterSummary(chapter, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Chapter ${chapterId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed world entries
  if (changedEntities.worldEntries?.length) {
    for (const entryId of changedEntities.worldEntries) {
      const entry = state.worldBible.find(e => e.id === entryId);
      if (entry) {
        try {
          const vector = await indexWorldEntry(entry, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`World entry ${entryId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed items
  if (changedEntities.items?.length && state.novelItems) {
    for (const itemId of changedEntities.items) {
      const item = state.novelItems.find(i => i.id === itemId);
      if (item) {
        try {
          const vector = await indexItem(item, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Item ${itemId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed techniques
  if (changedEntities.techniques?.length && state.novelTechniques) {
    for (const techId of changedEntities.techniques) {
      const technique = state.novelTechniques.find(t => t.id === techId);
      if (technique) {
        try {
          const vector = await indexTechnique(technique, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Technique ${techId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed antagonists
  if (changedEntities.antagonists?.length && state.antagonists) {
    for (const antId of changedEntities.antagonists) {
      const antagonist = state.antagonists.find(a => a.id === antId);
      if (antagonist) {
        try {
          const vector = await indexAntagonist(antagonist, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Antagonist ${antId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed story threads
  if (changedEntities.storyThreads?.length && state.storyThreads) {
    for (const threadId of changedEntities.storyThreads) {
      const thread = state.storyThreads.find(t => t.id === threadId);
      if (thread) {
        try {
          const vector = await indexStoryThread(thread, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Story thread ${threadId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed arcs
  if (changedEntities.arcs?.length) {
    for (const arcId of changedEntities.arcs) {
      const arc = state.plotLedger.find(a => a.id === arcId);
      if (arc) {
        try {
          const vector = await indexArc(arc, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Arc ${arcId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Index changed territories
  if (changedEntities.territories?.length) {
    for (const territoryId of changedEntities.territories) {
      const territory = state.territories.find(t => t.id === territoryId);
      if (territory) {
        try {
          const vector = await indexTerritory(territory, state.id);
          if (vector) vectors.push(vector);
        } catch (error) {
          failedCount++;
          errors.push(`Territory ${territoryId}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }

  // Upsert all vectors to Pinecone
  if (vectors.length > 0) {
    const result = await upsertVectors(state.id, vectors);
    if (result.errors.length > 0) {
      errors.push(...result.errors);
    }
  }

  const duration = Date.now() - startTime;

  logger.debug('Incremental index completed', 'indexingPipeline', undefined, {
    novelId: state.id,
    indexedCount: vectors.length,
    failedCount,
    duration,
  });

  return {
    success: errors.length === 0,
    indexedCount: vectors.length,
    failedCount,
    errors,
    duration,
  };
}

/**
 * Index a newly generated chapter and related entities
 */
export async function indexNewChapter(
  state: NovelState,
  chapter: Chapter,
  relatedEntityIds?: {
    characters?: string[];
    items?: string[];
    techniques?: string[];
    antagonists?: string[];
    storyThreads?: string[];
  }
): Promise<IndexingResult> {
  return incrementalIndex(state, {
    chapters: [chapter.id],
    characters: relatedEntityIds?.characters,
    items: relatedEntityIds?.items,
    techniques: relatedEntityIds?.techniques,
    antagonists: relatedEntityIds?.antagonists,
    storyThreads: relatedEntityIds?.storyThreads,
  });
}

/**
 * Get indexing statistics for a novel
 */
export async function getIndexingStats(novelId: string): Promise<{
  vectorCount: number;
  lastIndexed: number | null;
  entityCounts: Record<IndexableEntityType, number>;
} | null> {
  const stats = await getNovelStats(novelId);
  if (!stats) {
    return null;
  }

  // Count entities by type from sync cache
  const entityCounts: Record<IndexableEntityType, number> = {
    character: 0,
    chapter: 0,
    chapter_summary: 0,
    world_entry: 0,
    item: 0,
    technique: 0,
    antagonist: 0,
    story_thread: 0,
    arc: 0,
    territory: 0,
  };

  let lastIndexed: number | null = null;

  for (const [key, status] of syncStatusCache.entries()) {
    if (key.startsWith(novelId)) {
      entityCounts[status.entityType]++;
      if (!lastIndexed || status.lastSynced > lastIndexed) {
        lastIndexed = status.lastSynced;
      }
    }
  }

  return {
    vectorCount: stats.vectorCount,
    lastIndexed,
    entityCounts,
  };
}

/**
 * Clear sync status cache (useful for testing)
 */
export function clearSyncCache(): void {
  syncStatusCache.clear();
}

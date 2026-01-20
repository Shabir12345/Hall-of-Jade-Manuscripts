/**
 * Semantic Search Service
 * 
 * Provides high-level semantic search capabilities over the novel's indexed entities.
 * Uses Pinecone for vector similarity search with metadata filtering.
 */

import { NovelState } from '../../types';
import { logger } from '../loggingService';
import { queryByText, queryVectors, isPineconeReady, PineconeQueryMatch } from './pineconeService';
import { generateEmbedding } from './embeddingService';
import type { IndexableEntityType, VectorMetadata } from './indexingPipeline';

/**
 * Search query options
 */
export interface SemanticSearchQuery {
  /** The search query text */
  query: string;
  /** Novel ID to search within */
  novelId: string;
  /** Filter by entity types */
  types?: IndexableEntityType[];
  /** Filter by chapter range (for chapter-related entities) */
  chapterRange?: {
    min?: number;
    max?: number;
  };
  /** Filter by status (for entities with status) */
  status?: string[];
  /** Filter by priority (for story threads) */
  priority?: string[];
  /** Maximum number of results */
  topK?: number;
  /** Minimum similarity score (0-1) */
  minScore?: number;
}

/**
 * Search result item
 */
export interface SemanticSearchResult {
  /** Entity ID */
  id: string;
  /** Entity type */
  type: IndexableEntityType;
  /** Similarity score (0-1) */
  score: number;
  /** Entity name or title */
  name: string;
  /** Entity metadata */
  metadata: VectorMetadata;
}

/**
 * Search results with context
 */
export interface SemanticSearchResults {
  /** Search results */
  results: SemanticSearchResult[];
  /** Original query */
  query: string;
  /** Total matches found */
  totalMatches: number;
  /** Whether results were truncated */
  truncated: boolean;
  /** Search duration in ms */
  duration: number;
}

/**
 * Build Pinecone filter from search options
 */
function buildFilter(options: SemanticSearchQuery): Record<string, any> | undefined {
  const filters: Record<string, any>[] = [];

  // Filter by entity type
  if (options.types && options.types.length > 0) {
    if (options.types.length === 1) {
      filters.push({ entityType: { $eq: options.types[0] } });
    } else {
      filters.push({ entityType: { $in: options.types } });
    }
  }

  // Filter by chapter range
  if (options.chapterRange) {
    if (options.chapterRange.min !== undefined) {
      filters.push({ chapterNumber: { $gte: options.chapterRange.min } });
    }
    if (options.chapterRange.max !== undefined) {
      filters.push({ chapterNumber: { $lte: options.chapterRange.max } });
    }
  }

  // Filter by status
  if (options.status && options.status.length > 0) {
    if (options.status.length === 1) {
      filters.push({ status: { $eq: options.status[0] } });
    } else {
      filters.push({ status: { $in: options.status } });
    }
  }

  // Filter by priority
  if (options.priority && options.priority.length > 0) {
    if (options.priority.length === 1) {
      filters.push({ priority: { $eq: options.priority[0] } });
    } else {
      filters.push({ priority: { $in: options.priority } });
    }
  }

  // Combine filters
  if (filters.length === 0) {
    return undefined;
  } else if (filters.length === 1) {
    return filters[0];
  } else {
    return { $and: filters };
  }
}

/**
 * Convert Pinecone match to search result
 */
function matchToResult(match: PineconeQueryMatch): SemanticSearchResult | null {
  if (!match.metadata) {
    return null;
  }

  const metadata = match.metadata as VectorMetadata;

  return {
    id: metadata.entityId,
    type: metadata.entityType,
    score: match.score,
    name: metadata.name || metadata.title || metadata.entityId,
    metadata,
  };
}

/**
 * Perform semantic search
 */
export async function semanticSearch(options: SemanticSearchQuery): Promise<SemanticSearchResults> {
  const startTime = Date.now();
  const topK = options.topK || 10;
  const minScore = options.minScore || 0.5;

  logger.debug('Performing semantic search', 'semanticSearchService', undefined, {
    query: options.query.substring(0, 100),
    novelId: options.novelId,
    types: options.types,
    topK,
  });

  // Check if Pinecone is available
  const ready = await isPineconeReady();
  if (!ready) {
    logger.warn('Pinecone not available for semantic search', 'semanticSearchService');
    return {
      results: [],
      query: options.query,
      totalMatches: 0,
      truncated: false,
      duration: Date.now() - startTime,
    };
  }

  // Build filter
  const filter = buildFilter(options);

  // Perform search
  const queryResult = await queryByText(options.novelId, options.query, {
    topK: topK + 5, // Get a few extra to filter by minScore
    filter,
    includeMetadata: true,
  });

  if (!queryResult) {
    return {
      results: [],
      query: options.query,
      totalMatches: 0,
      truncated: false,
      duration: Date.now() - startTime,
    };
  }

  // Convert matches to results and filter by minScore
  const results: SemanticSearchResult[] = [];
  
  for (const match of queryResult.matches) {
    if (match.score < minScore) {
      continue;
    }

    const result = matchToResult(match);
    if (result) {
      results.push(result);
    }

    if (results.length >= topK) {
      break;
    }
  }

  const duration = Date.now() - startTime;

  logger.debug('Semantic search completed', 'semanticSearchService', undefined, {
    resultCount: results.length,
    duration,
  });

  return {
    results,
    query: options.query,
    totalMatches: queryResult.matches.length,
    truncated: results.length < queryResult.matches.length,
    duration,
  };
}

/**
 * Search for characters related to a query
 */
export async function searchCharacters(
  novelId: string,
  query: string,
  options: { topK?: number; minScore?: number; status?: string[] } = {}
): Promise<SemanticSearchResults> {
  return semanticSearch({
    query,
    novelId,
    types: ['character'],
    topK: options.topK || 5,
    minScore: options.minScore || 0.5,
    status: options.status,
  });
}

/**
 * Search for world building entries related to a query
 */
export async function searchWorldBuilding(
  novelId: string,
  query: string,
  options: { topK?: number; minScore?: number; categories?: string[] } = {}
): Promise<SemanticSearchResults> {
  return semanticSearch({
    query,
    novelId,
    types: ['world_entry', 'territory'],
    topK: options.topK || 5,
    minScore: options.minScore || 0.5,
  });
}

/**
 * Search for techniques and items related to a query
 */
export async function searchPowerElements(
  novelId: string,
  query: string,
  options: { topK?: number; minScore?: number } = {}
): Promise<SemanticSearchResults> {
  return semanticSearch({
    query,
    novelId,
    types: ['technique', 'item'],
    topK: options.topK || 5,
    minScore: options.minScore || 0.5,
  });
}

/**
 * Search for story threads and conflicts
 */
export async function searchPlotElements(
  novelId: string,
  query: string,
  options: { topK?: number; minScore?: number; includeResolved?: boolean } = {}
): Promise<SemanticSearchResults> {
  const status = options.includeResolved 
    ? undefined 
    : ['active', 'paused'];

  return semanticSearch({
    query,
    novelId,
    types: ['story_thread', 'antagonist', 'arc'],
    topK: options.topK || 5,
    minScore: options.minScore || 0.5,
    status,
  });
}

/**
 * Search across all entity types
 */
export async function searchAll(
  novelId: string,
  query: string,
  options: { topK?: number; minScore?: number } = {}
): Promise<SemanticSearchResults> {
  return semanticSearch({
    query,
    novelId,
    topK: options.topK || 10,
    minScore: options.minScore || 0.5,
  });
}

/**
 * Multi-query search - performs multiple searches and combines results
 */
export async function multiQuerySearch(
  novelId: string,
  queries: string[],
  options: {
    topK?: number;
    minScore?: number;
    types?: IndexableEntityType[];
    deduplicateById?: boolean;
  } = {}
): Promise<SemanticSearchResults> {
  const startTime = Date.now();
  const topK = options.topK || 10;
  const dedup = options.deduplicateById !== false;

  logger.debug('Performing multi-query search', 'semanticSearchService', undefined, {
    queryCount: queries.length,
    novelId,
  });

  // Perform searches in parallel
  const searchPromises = queries.map(query =>
    semanticSearch({
      query,
      novelId,
      types: options.types,
      topK: Math.ceil(topK / queries.length) + 3, // Get a few extra per query
      minScore: options.minScore || 0.5,
    })
  );

  const searchResults = await Promise.all(searchPromises);

  // Combine and deduplicate results
  const seenIds = new Set<string>();
  const combinedResults: SemanticSearchResult[] = [];
  let totalMatches = 0;

  for (const result of searchResults) {
    totalMatches += result.totalMatches;

    for (const item of result.results) {
      if (dedup && seenIds.has(item.id)) {
        continue;
      }

      seenIds.add(item.id);
      combinedResults.push(item);
    }
  }

  // Sort by score and limit
  combinedResults.sort((a, b) => b.score - a.score);
  const finalResults = combinedResults.slice(0, topK);

  const duration = Date.now() - startTime;

  return {
    results: finalResults,
    query: queries.join(' | '),
    totalMatches,
    truncated: combinedResults.length > topK,
    duration,
  };
}

/**
 * Find similar entities to a given entity
 */
export async function findSimilarEntities(
  novelId: string,
  entityType: IndexableEntityType,
  entityId: string,
  entityContent: string,
  options: { topK?: number; excludeSelf?: boolean } = {}
): Promise<SemanticSearchResults> {
  const startTime = Date.now();
  const topK = options.topK || 5;
  const excludeSelf = options.excludeSelf !== false;

  // Generate embedding for the entity content
  const embedding = await generateEmbedding(entityContent);
  if (!embedding) {
    return {
      results: [],
      query: `Similar to ${entityType} ${entityId}`,
      totalMatches: 0,
      truncated: false,
      duration: Date.now() - startTime,
    };
  }

  // Query with the embedding
  const filter = excludeSelf
    ? { $and: [{ entityType: { $eq: entityType } }, { entityId: { $ne: entityId } }] }
    : { entityType: { $eq: entityType } };

  const queryResult = await queryVectors(novelId, embedding, {
    topK: topK + 1, // Extra in case we need to filter out self
    filter,
    includeMetadata: true,
  });

  if (!queryResult) {
    return {
      results: [],
      query: `Similar to ${entityType} ${entityId}`,
      totalMatches: 0,
      truncated: false,
      duration: Date.now() - startTime,
    };
  }

  // Convert matches to results
  const results: SemanticSearchResult[] = [];
  
  for (const match of queryResult.matches) {
    if (excludeSelf && match.metadata?.entityId === entityId) {
      continue;
    }

    const result = matchToResult(match);
    if (result) {
      results.push(result);
    }

    if (results.length >= topK) {
      break;
    }
  }

  return {
    results,
    query: `Similar to ${entityType} ${entityId}`,
    totalMatches: queryResult.matches.length,
    truncated: results.length < queryResult.matches.length,
    duration: Date.now() - startTime,
  };
}

/**
 * Get context for chapter generation - retrieves relevant entities based on queries
 */
export async function getContextForChapterGeneration(
  novelId: string,
  queries: string[],
  options: {
    maxCharacters?: number;
    maxWorldEntries?: number;
    maxPlotElements?: number;
    maxPowerElements?: number;
    minScore?: number;
  } = {}
): Promise<{
  characters: SemanticSearchResult[];
  worldEntries: SemanticSearchResult[];
  plotElements: SemanticSearchResult[];
  powerElements: SemanticSearchResult[];
  totalDuration: number;
}> {
  const startTime = Date.now();
  const {
    maxCharacters = 5,
    maxWorldEntries = 3,
    maxPlotElements = 3,
    maxPowerElements = 3,
    minScore = 0.5,
  } = options;

  logger.debug('Getting context for chapter generation', 'semanticSearchService', undefined, {
    novelId,
    queryCount: queries.length,
  });

  // Perform searches in parallel
  const [characters, worldEntries, plotElements, powerElements] = await Promise.all([
    multiQuerySearch(novelId, queries, { topK: maxCharacters, minScore, types: ['character'] }),
    multiQuerySearch(novelId, queries, { topK: maxWorldEntries, minScore, types: ['world_entry', 'territory'] }),
    multiQuerySearch(novelId, queries, { topK: maxPlotElements, minScore, types: ['story_thread', 'antagonist', 'arc'] }),
    multiQuerySearch(novelId, queries, { topK: maxPowerElements, minScore, types: ['technique', 'item'] }),
  ]);

  const totalDuration = Date.now() - startTime;

  logger.debug('Context retrieval completed', 'semanticSearchService', undefined, {
    characterCount: characters.results.length,
    worldEntryCount: worldEntries.results.length,
    plotElementCount: plotElements.results.length,
    powerElementCount: powerElements.results.length,
    totalDuration,
  });

  return {
    characters: characters.results,
    worldEntries: worldEntries.results,
    plotElements: plotElements.results,
    powerElements: powerElements.results,
    totalDuration,
  };
}

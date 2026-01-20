/**
 * Vector Database Module
 * 
 * Exports all vector database services for semantic search and indexing.
 */

// Embedding service
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  isEmbeddingServiceAvailable,
  clearEmbeddingCache,
  getEmbeddingCacheStats,
  prepareTextForEmbedding,
  combineFieldsForEmbedding,
} from './embeddingService';

// Pinecone service
export {
  isPineconeReady,
  ensureIndexExists,
  upsertVectors,
  queryVectors,
  queryByText,
  deleteVectors,
  deleteAllVectorsForNovel,
  fetchVectors,
  getIndexStats,
  getNovelStats,
  type PineconeVector,
  type PineconeQueryMatch,
  type PineconeQueryResult,
} from './pineconeService';

// Indexing pipeline
export {
  fullReindex,
  incrementalIndex,
  indexNewChapter,
  getIndexingStats,
  clearSyncCache,
  type IndexableEntityType,
  type VectorMetadata,
  type IndexingResult,
} from './indexingPipeline';

// Semantic search service
export {
  semanticSearch,
  searchCharacters,
  searchWorldBuilding,
  searchPowerElements,
  searchPlotElements,
  searchAll,
  multiQuerySearch,
  findSimilarEntities,
  getContextForChapterGeneration,
  type SemanticSearchQuery,
  type SemanticSearchResult,
  type SemanticSearchResults,
} from './semanticSearchService';

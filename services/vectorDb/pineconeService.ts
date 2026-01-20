/**
 * Pinecone Service
 * 
 * Core service for interacting with Pinecone vector database.
 * Handles connection, CRUD operations, and query execution.
 * 
 * Note: This uses the Pinecone REST API directly to avoid SDK bundle size issues
 * and to support browser environments.
 */

import { PINECONE_CONFIG, getNamespaceForNovel, isPineconeConfigured } from '../../config/pinecone';
import { logger } from '../loggingService';
import { generateEmbedding, generateEmbeddingsBatch, isEmbeddingServiceAvailable } from './embeddingService';

// Types for Pinecone operations
export interface PineconeVector {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface PineconeQueryMatch {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, any>;
}

export interface PineconeQueryResult {
  matches: PineconeQueryMatch[];
  namespace: string;
}

export interface UpsertResult {
  upsertedCount: number;
  errors: string[];
}

export interface DeleteResult {
  success: boolean;
  deletedCount?: number;
}

// Pinecone API base URL (uses serverless architecture)
let pineconeHost: string | null = null;

/**
 * Get the Pinecone host URL for the index
 */
async function getPineconeHost(): Promise<string | null> {
  if (pineconeHost) {
    return pineconeHost;
  }

  if (!isPineconeConfigured()) {
    logger.warn('Pinecone not configured', 'pineconeService');
    return null;
  }

  try {
    // Use the describe index endpoint to get the host
    const response = await fetch(
      `https://api.pinecone.io/indexes/${PINECONE_CONFIG.indexName}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': PINECONE_CONFIG.apiKey!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        logger.warn('Pinecone index not found. You may need to create it.', 'pineconeService', {
          indexName: PINECONE_CONFIG.indexName,
        });
        return null;
      }
      throw new Error(`Failed to get index info: ${response.statusText}`);
    }

    const data = await response.json();
    pineconeHost = data.host;
    
    logger.info('Pinecone host retrieved', 'pineconeService', { host: pineconeHost });
    return pineconeHost;
  } catch (error) {
    logger.error('Failed to get Pinecone host', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Check if Pinecone service is available and ready
 */
export async function isPineconeReady(): Promise<boolean> {
  if (!isPineconeConfigured()) {
    return false;
  }

  const host = await getPineconeHost();
  return host !== null;
}

/**
 * Create the Pinecone index if it doesn't exist
 */
export async function ensureIndexExists(): Promise<boolean> {
  if (!isPineconeConfigured()) {
    logger.warn('Cannot create index - Pinecone not configured', 'pineconeService');
    return false;
  }

  try {
    // Check if index exists
    const checkResponse = await fetch(
      `https://api.pinecone.io/indexes/${PINECONE_CONFIG.indexName}`,
      {
        method: 'GET',
        headers: {
          'Api-Key': PINECONE_CONFIG.apiKey!,
          'Content-Type': 'application/json',
        },
      }
    );

    if (checkResponse.ok) {
      logger.info('Pinecone index already exists', 'pineconeService');
      return true;
    }

    if (checkResponse.status !== 404) {
      throw new Error(`Unexpected response: ${checkResponse.statusText}`);
    }

    // Create the index
    logger.info('Creating Pinecone index', 'pineconeService', {
      indexName: PINECONE_CONFIG.indexName,
      dimension: PINECONE_CONFIG.dimension,
    });

    const createResponse = await fetch('https://api.pinecone.io/indexes', {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: PINECONE_CONFIG.indexName,
        dimension: PINECONE_CONFIG.dimension,
        metric: PINECONE_CONFIG.metric,
        spec: {
          serverless: {
            cloud: 'aws',
            region: PINECONE_CONFIG.environment,
          },
        },
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json().catch(() => ({}));
      throw new Error(`Failed to create index: ${error.message || createResponse.statusText}`);
    }

    logger.info('Pinecone index created successfully', 'pineconeService');
    
    // Reset host cache to force refresh
    pineconeHost = null;
    
    return true;
  } catch (error) {
    logger.error('Failed to ensure index exists', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

/**
 * Upsert vectors to Pinecone
 */
export async function upsertVectors(
  novelId: string,
  vectors: PineconeVector[]
): Promise<UpsertResult> {
  const host = await getPineconeHost();
  if (!host) {
    return { upsertedCount: 0, errors: ['Pinecone not available'] };
  }

  const namespace = getNamespaceForNovel(novelId);
  const errors: string[] = [];
  let upsertedCount = 0;

  // Process in batches of 100 (Pinecone limit)
  const batchSize = 100;
  
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize);

    try {
      const response = await fetch(`https://${host}/vectors/upsert`, {
        method: 'POST',
        headers: {
          'Api-Key': PINECONE_CONFIG.apiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vectors: batch,
          namespace,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || response.statusText);
      }

      const result = await response.json();
      upsertedCount += result.upsertedCount || batch.length;

      logger.debug('Upserted vector batch', 'pineconeService', undefined, {
        batchSize: batch.length,
        namespace,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errorMsg}`);
      logger.error('Batch upsert failed', 'pineconeService', error instanceof Error ? error : new Error(errorMsg));
    }
  }

  return { upsertedCount, errors };
}

/**
 * Query vectors by similarity
 */
export async function queryVectors(
  novelId: string,
  queryVector: number[],
  options: {
    topK?: number;
    filter?: Record<string, any>;
    includeValues?: boolean;
    includeMetadata?: boolean;
  } = {}
): Promise<PineconeQueryResult | null> {
  const host = await getPineconeHost();
  if (!host) {
    return null;
  }

  const {
    topK = 10,
    filter,
    includeValues = false,
    includeMetadata = true,
  } = options;

  const namespace = getNamespaceForNovel(novelId);

  try {
    const response = await fetch(`https://${host}/query`, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vector: queryVector,
        topK,
        filter,
        includeValues,
        includeMetadata,
        namespace,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    const result = await response.json();

    logger.debug('Query completed', 'pineconeService', undefined, {
      matchCount: result.matches?.length || 0,
      namespace,
    });

    return {
      matches: result.matches || [],
      namespace,
    };

  } catch (error) {
    logger.error('Query failed', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Query by text (generates embedding and queries)
 */
export async function queryByText(
  novelId: string,
  text: string,
  options: {
    topK?: number;
    filter?: Record<string, any>;
    includeMetadata?: boolean;
  } = {}
): Promise<PineconeQueryResult | null> {
  if (!isEmbeddingServiceAvailable()) {
    logger.warn('Cannot query by text - embedding service not available', 'pineconeService');
    return null;
  }

  const embedding = await generateEmbedding(text);
  if (!embedding) {
    return null;
  }

  return queryVectors(novelId, embedding, options);
}

/**
 * Delete vectors by IDs
 */
export async function deleteVectors(
  novelId: string,
  ids: string[]
): Promise<DeleteResult> {
  const host = await getPineconeHost();
  if (!host) {
    return { success: false };
  }

  const namespace = getNamespaceForNovel(novelId);

  try {
    const response = await fetch(`https://${host}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids,
        namespace,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    logger.debug('Deleted vectors', 'pineconeService', undefined, {
      count: ids.length,
      namespace,
    });

    return { success: true, deletedCount: ids.length };

  } catch (error) {
    logger.error('Delete failed', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return { success: false };
  }
}

/**
 * Delete all vectors for a novel (clear namespace)
 */
export async function deleteAllVectorsForNovel(novelId: string): Promise<DeleteResult> {
  const host = await getPineconeHost();
  if (!host) {
    return { success: false };
  }

  const namespace = getNamespaceForNovel(novelId);

  try {
    const response = await fetch(`https://${host}/vectors/delete`, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        deleteAll: true,
        namespace,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    logger.info('Deleted all vectors for novel', 'pineconeService', { namespace });

    return { success: true };

  } catch (error) {
    logger.error('Delete all failed', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return { success: false };
  }
}

/**
 * Fetch vectors by IDs
 */
export async function fetchVectors(
  novelId: string,
  ids: string[]
): Promise<Map<string, PineconeVector> | null> {
  const host = await getPineconeHost();
  if (!host) {
    return null;
  }

  const namespace = getNamespaceForNovel(novelId);

  try {
    const response = await fetch(`https://${host}/vectors/fetch?${new URLSearchParams({
      ids: ids.join(','),
      namespace,
    })}`, {
      method: 'GET',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    const result = await response.json();
    const vectors = new Map<string, PineconeVector>();

    if (result.vectors) {
      for (const [id, vector] of Object.entries(result.vectors)) {
        const v = vector as any;
        vectors.set(id, {
          id,
          values: v.values,
          metadata: v.metadata,
        });
      }
    }

    return vectors;

  } catch (error) {
    logger.error('Fetch failed', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get index statistics
 */
export async function getIndexStats(): Promise<{
  totalVectorCount: number;
  namespaces: Record<string, { vectorCount: number }>;
} | null> {
  const host = await getPineconeHost();
  if (!host) {
    return null;
  }

  try {
    const response = await fetch(`https://${host}/describe_index_stats`, {
      method: 'POST',
      headers: {
        'Api-Key': PINECONE_CONFIG.apiKey!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || response.statusText);
    }

    const result = await response.json();

    return {
      totalVectorCount: result.totalVectorCount || 0,
      namespaces: result.namespaces || {},
    };

  } catch (error) {
    logger.error('Get stats failed', 'pineconeService', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Get statistics for a specific novel's namespace
 */
export async function getNovelStats(novelId: string): Promise<{
  vectorCount: number;
  namespace: string;
} | null> {
  const stats = await getIndexStats();
  if (!stats) {
    return null;
  }

  const namespace = getNamespaceForNovel(novelId);
  const namespaceStats = stats.namespaces[namespace];

  return {
    vectorCount: namespaceStats?.vectorCount || 0,
    namespace,
  };
}

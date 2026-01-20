/**
 * Embedding Service
 * 
 * Generates vector embeddings using OpenAI's text-embedding-3-small model.
 * Provides batching, caching, and error handling for efficient embedding operations.
 */

import { env } from '../../utils/env';
import { EMBEDDING_CONFIG } from '../../config/pinecone';
import { logger } from '../loggingService';

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokenCount?: number;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  failedTexts: string[];
}

// Simple in-memory cache for embeddings (cleared on page refresh)
const embeddingCache = new Map<string, number[]>();
const CACHE_MAX_SIZE = 1000;

/**
 * Generate a cache key for a text
 */
function getCacheKey(text: string): string {
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `emb_${hash}_${text.length}`;
}

/**
 * Check if embedding is available
 */
export function isEmbeddingServiceAvailable(): boolean {
  return Boolean(env.openai?.apiKey);
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!isEmbeddingServiceAvailable()) {
    logger.warn('Embedding service unavailable - OpenAI API key not configured', 'embeddingService');
    return null;
  }

  const cacheKey = getCacheKey(text);
  
  // Check cache first
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    logger.debug('Embedding cache hit', 'embeddingService', undefined, { textLength: text.length });
    return cached;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.openai?.apiKey}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_CONFIG.model,
        input: text,
        dimensions: EMBEDDING_CONFIG.dimension,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const embedding = data.data[0].embedding as number[];

    // Cache the result
    if (embeddingCache.size >= CACHE_MAX_SIZE) {
      // Remove oldest entries (first 100)
      const keys = Array.from(embeddingCache.keys()).slice(0, 100);
      keys.forEach(key => embeddingCache.delete(key));
    }
    embeddingCache.set(cacheKey, embedding);

    logger.debug('Generated embedding', 'embeddingService', undefined, { 
      textLength: text.length, 
      tokens: data.usage?.total_tokens 
    });

    return embedding;
  } catch (error) {
    logger.error('Failed to generate embedding', 'embeddingService', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * Automatically chunks large batches to stay within API limits
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<BatchEmbeddingResult> {
  if (!isEmbeddingServiceAvailable()) {
    logger.warn('Embedding service unavailable - OpenAI API key not configured', 'embeddingService');
    return {
      results: [],
      totalTokens: 0,
      failedTexts: texts,
    };
  }

  const results: EmbeddingResult[] = [];
  const failedTexts: string[] = [];
  let totalTokens = 0;

  // Check cache and separate cached vs uncached
  const uncachedTexts: { index: number; text: string }[] = [];
  
  texts.forEach((text, index) => {
    const cacheKey = getCacheKey(text);
    const cached = embeddingCache.get(cacheKey);
    if (cached) {
      results[index] = { text, embedding: cached };
    } else {
      uncachedTexts.push({ index, text });
    }
  });

  if (uncachedTexts.length === 0) {
    logger.debug('All embeddings from cache', 'embeddingService', undefined, { count: texts.length });
    return { results, totalTokens: 0, failedTexts: [] };
  }

  // Process uncached texts in batches
  const batchSize = EMBEDDING_CONFIG.maxBatchSize;
  
  for (let i = 0; i < uncachedTexts.length; i += batchSize) {
    const batch = uncachedTexts.slice(i, i + batchSize);
    const batchTexts = batch.map(item => item.text);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.openai?.apiKey}`,
        },
        body: JSON.stringify({
          model: EMBEDDING_CONFIG.model,
          input: batchTexts,
          dimensions: EMBEDDING_CONFIG.dimension,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      totalTokens += data.usage?.total_tokens || 0;

      // Map embeddings back to original indices
      data.data.forEach((item: { embedding: number[]; index: number }) => {
        const originalItem = batch[item.index];
        const embedding = item.embedding;
        
        results[originalItem.index] = { 
          text: originalItem.text, 
          embedding 
        };

        // Cache the result
        const cacheKey = getCacheKey(originalItem.text);
        if (embeddingCache.size >= CACHE_MAX_SIZE) {
          const keys = Array.from(embeddingCache.keys()).slice(0, 100);
          keys.forEach(key => embeddingCache.delete(key));
        }
        embeddingCache.set(cacheKey, embedding);
      });

      logger.debug('Generated batch embeddings', 'embeddingService', undefined, { 
        batchSize: batch.length, 
        tokens: data.usage?.total_tokens 
      });

    } catch (error) {
      logger.error('Batch embedding failed', 'embeddingService', error instanceof Error ? error : new Error(String(error)));
      batch.forEach(item => failedTexts.push(item.text));
    }

    // Rate limiting - small delay between batches
    if (i + batchSize < uncachedTexts.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Filter out undefined results and collect failed texts
  const finalResults: EmbeddingResult[] = [];
  texts.forEach((text, index) => {
    if (results[index]) {
      finalResults.push(results[index]);
    } else if (!failedTexts.includes(text)) {
      failedTexts.push(text);
    }
  });

  return {
    results: finalResults,
    totalTokens,
    failedTexts,
  };
}

/**
 * Clear the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
  logger.info('Embedding cache cleared', 'embeddingService');
}

/**
 * Get cache statistics
 */
export function getEmbeddingCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: CACHE_MAX_SIZE,
  };
}

/**
 * Prepare text for embedding (truncate if too long)
 */
export function prepareTextForEmbedding(text: string, maxChars: number = 30000): string {
  // Rough estimate: 4 chars per token, max 8191 tokens
  // Using 30000 chars as safe limit (~7500 tokens)
  if (text.length <= maxChars) {
    return text;
  }
  
  // Truncate but try to end at a sentence boundary
  let truncated = text.substring(0, maxChars);
  const lastPeriod = truncated.lastIndexOf('.');
  const lastNewline = truncated.lastIndexOf('\n');
  const breakPoint = Math.max(lastPeriod, lastNewline);
  
  if (breakPoint > maxChars * 0.8) {
    truncated = truncated.substring(0, breakPoint + 1);
  }
  
  return truncated;
}

/**
 * Combine multiple text fields into a single embedding-ready string
 */
export function combineFieldsForEmbedding(fields: Record<string, string | undefined>): string {
  const parts: string[] = [];
  
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.trim()) {
      parts.push(`${key}: ${value.trim()}`);
    }
  }
  
  return parts.join('\n');
}

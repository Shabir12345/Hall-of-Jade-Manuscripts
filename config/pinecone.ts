/**
 * Pinecone Vector Database Configuration
 * 
 * Configures the Pinecone client for semantic search across novel entities.
 * Uses environment variables for API keys and index configuration.
 */

import { env } from '../utils/env';

export interface PineconeConfig {
  apiKey: string | undefined;
  indexName: string;
  environment: string;
  dimension: number; // Must match embedding model output dimension
  metric: 'cosine' | 'euclidean' | 'dotproduct';
}

/**
 * Default Pinecone configuration
 * 
 * - Uses OpenAI text-embedding-3-small which outputs 1536-dimensional vectors
 * - Cosine similarity is best for semantic text similarity
 */
export const PINECONE_CONFIG: PineconeConfig = {
  apiKey: env.pinecone?.apiKey,
  indexName: import.meta.env.VITE_PINECONE_INDEX || 'hall-of-jade-manuscripts',
  environment: import.meta.env.VITE_PINECONE_ENVIRONMENT || 'us-east-1',
  dimension: 1536, // text-embedding-3-small output dimension
  metric: 'cosine',
};

/**
 * Embedding model configuration
 */
export const EMBEDDING_CONFIG = {
  model: 'text-embedding-3-small',
  dimension: 1536,
  maxBatchSize: 100, // Maximum texts per API call
  maxTokensPerText: 8191, // Maximum tokens per text
};

/**
 * Vector database namespace configuration
 * Each novel gets its own namespace to isolate data
 */
export function getNamespaceForNovel(novelId: string): string {
  return `novel_${novelId}`;
}

/**
 * Check if Pinecone is configured
 */
export function isPineconeConfigured(): boolean {
  return Boolean(PINECONE_CONFIG.apiKey);
}

/**
 * Check if embeddings are available (requires OpenAI API key)
 */
export function isEmbeddingAvailable(): boolean {
  return Boolean(env.openai?.apiKey);
}

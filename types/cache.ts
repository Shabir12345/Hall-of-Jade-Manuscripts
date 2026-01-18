/**
 * Cache-related types for prompt caching
 */

export type CacheProvider = 'grok';

export interface CacheMetadata {
  cacheableContent: string;
  dynamicContent: string;
  cacheKey: string;
  estimatedCacheableTokens: number;
  canUseCaching: boolean;
  provider?: CacheProvider;
}

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  totalCachedTokens: number;
  totalTokens: number;
  estimatedSavings: {
    dollars: number;
    percentage: number;
  };
}

export interface CacheSavings {
  hits: number;
  misses: number;
  cachedTokens: number;
  totalTokens: number;
  inputCostWithoutCache: number;
  inputCostWithCache: number;
  savings: number;
  savingsPercentage: number;
}

export interface CacheRecord {
  provider: CacheProvider;
  cacheKey: string;
  cachedTokens: number;
  totalTokens: number;
  timestamp: number;
  isHit: boolean;
}

export interface CacheablePrompt {
  cacheableContent: string;
  dynamicContent: string;
  cacheKey: string;
  estimatedCacheableTokens: number;
  canUseCaching: boolean;
}

export interface ProviderCacheRequirements {
  minimumTokens: number;
  cacheType: 'explicit' | 'implicit';
}

export const PROVIDER_CACHE_REQUIREMENTS: Record<CacheProvider, ProviderCacheRequirements> = {
  grok: {
    minimumTokens: 1024, // 1,024 tokens for Grok
    cacheType: 'implicit', // Implicit prefix matching (similar to Gemini)
  },
};

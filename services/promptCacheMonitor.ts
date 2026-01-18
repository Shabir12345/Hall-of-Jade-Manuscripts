/**
 * Prompt Cache Monitor
 * Tracks cache performance and cost savings
 */

import type { CacheRecord, CacheStatistics, CacheSavings, CacheProvider } from '../types/cache';

/**
 * Cost per 1M tokens (approximate, as of 2024-2025)
 * Cache read costs are much lower than regular input costs
 */
const CACHE_COSTS = {
  grok: {
    inputRegular: 0.20, // $0.20 per 1M input tokens (Grok)
    inputCacheRead: 0.05, // ~75% savings (implicit prefix caching)
  },
};

/**
 * In-memory cache statistics store
 * In production, this could be persisted to a database
 */
const cacheRecords: CacheRecord[] = [];
const MAX_RECORDS = 10000; // Keep last 10,000 records

/**
 * Records a cache hit
 */
export function recordCacheHit(
  provider: CacheProvider,
  cacheKey: string,
  cachedTokens: number,
  totalTokens: number
): void {
  const record: CacheRecord = {
    provider,
    cacheKey,
    cachedTokens,
    totalTokens,
    timestamp: Date.now(),
    isHit: true,
  };
  
  addRecord(record);
  
  // Log cache hit
  console.log(`[Cache] ${provider} HIT: ${cachedTokens} tokens cached (${cachedTokens} / ${totalTokens} = ${((cachedTokens / totalTokens) * 100).toFixed(1)}%)`);
}

/**
 * Records a cache miss
 */
export function recordCacheMiss(
  provider: CacheProvider,
  cacheKey: string,
  totalTokens: number
): void {
  const record: CacheRecord = {
    provider,
    cacheKey,
    cachedTokens: 0,
    totalTokens,
    timestamp: Date.now(),
    isHit: false,
  };
  
  addRecord(record);
  
  // Log cache miss
  console.log(`[Cache] ${provider} MISS: ${totalTokens} tokens (cache key: ${cacheKey.substring(0, 50)}...)`);
}

/**
 * Adds a record to the store (with size limit)
 */
function addRecord(record: CacheRecord): void {
  cacheRecords.push(record);
  
  // Keep only the most recent records
  if (cacheRecords.length > MAX_RECORDS) {
    cacheRecords.shift();
  }
}

/**
 * Calculates cache savings based on hits and misses
 */
export function calculateSavings(hits: number, misses: number, provider: CacheProvider): CacheSavings {
  // Estimate average tokens per request
  // This is approximate - in practice we'd track actual token counts
  const avgCachedTokens = 50000; // Average ~50k tokens of cacheable content
  const avgTotalTokens = 70000; // Average ~70k total tokens
  
  const totalCachedTokens = hits * avgCachedTokens;
  const totalTokens = (hits + misses) * avgTotalTokens;
  
  // Calculate costs
  const costs = CACHE_COSTS[provider];
  const inputCostWithoutCache = (totalTokens / 1_000_000) * costs.inputRegular;
  
  // Grok: implicit prefix caching with ~75% savings on cached tokens
  const cacheReadCost = (totalCachedTokens / 1_000_000) * costs.inputCacheRead;
  const nonCachedCost = ((totalTokens - totalCachedTokens) / 1_000_000) * costs.inputRegular;
  const inputCostWithCache = cacheReadCost + nonCachedCost;
  
  return {
    hits,
    misses,
    cachedTokens: totalCachedTokens,
    totalTokens,
    inputCostWithoutCache,
    inputCostWithCache,
    savings: inputCostWithoutCache - inputCostWithCache,
    savingsPercentage: ((inputCostWithoutCache - inputCostWithCache) / inputCostWithoutCache) * 100,
  };
}

/**
 * Gets cache statistics
 */
export function getCacheStatistics(provider?: CacheProvider): CacheStatistics {
  const records = provider
    ? cacheRecords.filter(r => r.provider === provider)
    : cacheRecords;
  
  if (records.length === 0) {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      totalCachedTokens: 0,
      totalTokens: 0,
      estimatedSavings: {
        dollars: 0,
        percentage: 0,
      },
    };
  }
  
  const hits = records.filter(r => r.isHit).length;
  const misses = records.filter(r => !r.isHit).length;
  const totalRequests = records.length;
  const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
  
  const totalCachedTokens = records
    .filter(r => r.isHit)
    .reduce((sum, r) => sum + r.cachedTokens, 0);
  
  const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0);
  
  // Calculate savings based on provider
  const actualProvider = provider || (records.length > 0 ? records[0].provider : 'grok');
  const savings = calculateSavings(hits, misses, actualProvider);
  
  return {
    hits,
    misses,
    hitRate,
    totalRequests,
    totalCachedTokens,
    totalTokens,
    estimatedSavings: {
      dollars: savings.savings,
      percentage: savings.savingsPercentage,
    },
  };
}

/**
 * Gets cache statistics for a specific time period
 */
export function getCacheStatisticsForPeriod(
  startTime: number,
  endTime: number,
  provider?: CacheProvider
): CacheStatistics {
  const periodRecords = cacheRecords.filter(r => {
    const inPeriod = r.timestamp >= startTime && r.timestamp <= endTime;
    const matchesProvider = !provider || r.provider === provider;
    return inPeriod && matchesProvider;
  });
  
  if (periodRecords.length === 0) {
    return {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      totalCachedTokens: 0,
      totalTokens: 0,
      estimatedSavings: {
        dollars: 0,
        percentage: 0,
      },
    };
  }
  
  const hits = periodRecords.filter(r => r.isHit).length;
  const misses = periodRecords.filter(r => !r.isHit).length;
  const totalRequests = periodRecords.length;
  const hitRate = totalRequests > 0 ? (hits / totalRequests) * 100 : 0;
  
  const totalCachedTokens = periodRecords
    .filter(r => r.isHit)
    .reduce((sum, r) => sum + r.cachedTokens, 0);
  
  const totalTokens = periodRecords.reduce((sum, r) => sum + r.totalTokens, 0);
  
  const actualProvider = provider || (periodRecords.length > 0 ? periodRecords[0].provider : 'claude');
  const savings = calculateSavings(hits, misses, actualProvider);
  
  return {
    hits,
    misses,
    hitRate,
    totalRequests,
    totalCachedTokens,
    totalTokens,
    estimatedSavings: {
      dollars: savings.savings,
      percentage: savings.savingsPercentage,
    },
  };
}

/**
 * Clears all cache statistics
 */
export function clearCacheStatistics(): void {
  cacheRecords.length = 0;
}

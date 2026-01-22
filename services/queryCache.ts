/**
 * Query Cache Service
 * 
 * Provides caching for database queries with TTL (Time To Live) support.
 * Helps reduce database load and improve performance by caching frequently
 * accessed data.
 * 
 * @example
 * ```typescript
 * const cacheKey = `novels:${userId}`;
 * const cached = queryCache.get<NovelState[]>(cacheKey);
 * if (cached) return cached;
 * 
 * const novels = await fetchFromDatabase();
 * queryCache.set(cacheKey, novels, 30000); // 30 second TTL
 * ```
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Query Cache Class
 * 
 * OPTIMIZED: Enhanced in-memory caching with TTL support and LRU eviction
 * Cache entries are automatically expired based on their TTL.
 */
class QueryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private defaultTTL = 60000; // 1 minute default TTL
  private maxCacheSize = 1000; // OPTIMIZED: Increased cache size limit
  private accessOrder = new Map<string, number>(); // Track access for LRU
  private accessCounter = 0; // Counter for LRU tracking

  /**
   * Get cached data by key
   * OPTIMIZED: Added LRU access tracking
   * 
   * @param key - Cache key
   * @returns Cached data if found and not expired, null otherwise
   * @template T - Type of cached data
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order for LRU
    this.accessOrder.set(key, ++this.accessCounter);

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   * OPTIMIZED: Added LRU eviction when cache is full
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds (default: 60000ms = 1 minute)
   * @template T - Type of data to cache
   */
  set<T>(key: string, data: T, ttl = this.defaultTTL): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.evictOldestEntries();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /**
   * Evict oldest entries to make room for new ones (LRU eviction)
   */
  private evictOldestEntries(): void {
    const entriesToEvict = Math.floor(this.maxCacheSize * 0.2); // Evict 20% of cache
    const sortedEntries = Array.from(this.accessOrder.entries())
      .sort(([, a], [, b]) => a - b);

    for (let i = 0; i < entriesToEvict && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      this.cache.delete(key);
      this.accessOrder.delete(key);
    }
  }

  /**
   * Invalidate cache entries
   * OPTIMIZED: Also clear access order tracking
   * 
   * @param pattern - Optional pattern to match keys. If provided, only keys
   *                  containing this pattern will be invalidated. If not provided,
   *                  all cache entries will be cleared.
   */
  invalidate(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      this.accessOrder.clear();
      return;
    }

    // Remove entries matching the pattern
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics including size and keys
   */
  getStats() {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Check if a key exists in cache (without checking expiration)
   * 
   * @param key - Cache key
   * @returns True if key exists, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }
}

/**
 * Singleton instance of QueryCache
 * 
 * Use this instance throughout the application for query caching.
 */
export const queryCache = new QueryCache();

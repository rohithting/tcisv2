import { CacheEntry } from '@/types/auth';

export interface CacheOptions {
  ttl: number; // Time to live in milliseconds
  staleWhileRevalidate: number; // Grace period for stale data
  maxSize: number; // Maximum number of cache entries
  cleanupInterval: number; // How often to clean up expired entries
}

export class CacheManager {
  private cache = new Map<string, CacheEntry<any>>();
  private options: CacheOptions;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = {
      ttl: 5 * 60 * 1000, // 5 minutes default
      staleWhileRevalidate: 2 * 60 * 1000, // 2 minutes grace period
      maxSize: 100, // Maximum 100 entries
      cleanupInterval: 60 * 1000, // Clean up every minute
      ...options
    };

    this.startCleanupInterval();
  }

  /**
   * Get data from cache with intelligent fallback
   */
  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: Partial<CacheOptions>
  ): Promise<T> {
    const config = { ...this.options, ...options };
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && !this.isStale(cached, config)) {
      // Data is fresh, return immediately
      this.updateLastAccessed(key);
      console.log(`✅ Cache hit for key: ${key}`);
      return cached.data;
    }

    if (cached && this.isStaleButRevalidatable(cached, config)) {
      // Data is stale but within revalidation grace period
      console.log(`⚠️ Cache hit (stale) for key: ${key}, returning stale data while revalidating`);
      
      // Return stale data immediately
      this.updateLastAccessed(key);
      
      // Revalidate in background
      this.revalidateInBackground(key, fetcher, config);
      
      return cached.data;
    }

    // No valid cache, fetch fresh data
    console.log(`🔄 Cache miss for key: ${key}, fetching fresh data`);
    const fresh = await fetcher();
    
    // Store in cache
    this.set(key, fresh, config);
    
    return fresh;
  }

  /**
   * Set data in cache
   */
  set<T>(key: string, data: T, options?: Partial<CacheOptions>): void {
    const config = { ...this.options, ...options };
    const now = Date.now();

    // Check cache size limit
    if (this.cache.size >= config.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: config.ttl,
      lastAccessed: now
    };

    this.cache.set(key, entry);
    console.log(`💾 Cached data for key: ${key}`);
  }

  /**
   * Check if cache entry is stale
   */
  private isStale(entry: CacheEntry<any>, options: CacheOptions): boolean {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  /**
   * Check if cache entry is stale but can be revalidated
   */
  private isStaleButRevalidatable(entry: CacheEntry<any>, options: CacheOptions): boolean {
    const now = Date.now();
    const age = now - entry.timestamp;
    return age > entry.ttl && age <= (entry.ttl + options.staleWhileRevalidate);
  }

  /**
   * Update last accessed time for cache entry
   */
  private updateLastAccessed(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
  }

  /**
   * Revalidate cache entry in background
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      console.log(`🔄 Background revalidation for key: ${key}`);
      
      const fresh = await fetcher();
      
      // Update cache with fresh data
      this.set(key, fresh, options);
      
      console.log(`✅ Background revalidation completed for key: ${key}`);
    } catch (error) {
      console.warn(`⚠️ Background revalidation failed for key: ${key}:`, error);
      // Keep old data if revalidation fails
    }
  }

  /**
   * Get cache entry without fetching
   */
  getEntry<T>(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      this.updateLastAccessed(key);
    }
    return entry;
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove specific key from cache
   */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`🗑️ Deleted cache entry for key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let freshEntries = 0;
    let staleEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (this.isStale(entry, this.options)) {
        if (this.isStaleButRevalidatable(entry, this.options)) {
          staleEntries++;
        } else {
          expiredEntries++;
        }
      } else {
        freshEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      freshEntries,
      staleEntries,
      expiredEntries,
      maxSize: this.options.maxSize,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of cache
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key length + data size + overhead
      totalSize += key.length + JSON.stringify(entry.data).length + 100;
    }
    
    return totalSize;
  }

  /**
   * Evict oldest cache entries when size limit is reached
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed time (oldest first)
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    
    // Remove oldest entries until we're under the limit
    const toRemove = entries.slice(0, entries.length - this.options.maxSize + 1);
    
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
    
    console.log(`🗑️ Evicted ${toRemove.length} old cache entries`);
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isStale(entry, this.options) && 
          !this.isStaleButRevalidatable(entry, this.options)) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * Stop cleanup interval
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all cache values
   */
  values<T>(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.data);
  }

  /**
   * Get all cache entries
   */
  entries<T>(): [string, CacheEntry<T>][] {
    return Array.from(this.cache.entries());
  }
}

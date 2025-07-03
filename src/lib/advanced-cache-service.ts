// Advanced Cache Service - Multi-tier caching with intelligent optimization
// Provides advanced query result caching beyond the basic router cache

import { ModernOrder } from "./api-first-data-service";
import { EnhancedSearchResult } from "./enhanced-vector-pipeline";
import { RoutedQueryResult } from "./query-router";
import crypto from "crypto";

export interface CacheEntry<T = any> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
  lastAccessed: number;
  size: number;
  tags: string[];
  metadata: {
    source: string;
    confidence?: number;
    freshness: "fresh" | "cached" | "stale";
    strategy?: string;
  };
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageAge: number;
  performanceMetrics: {
    averageRetrievalTime: number;
    averageStorageTime: number;
    evictionRate: number;
  };
  topKeys: Array<{ key: string; hits: number; size: number }>;
}

export interface CacheConfig {
  maxMemorySize: number;
  defaultTTL: number;
  evictionPolicy: "lru" | "lfu" | "intelligent";
  performanceTracking: boolean;
}

export class AdvancedCacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hitStats: Map<string, number> = new Map();
  private missStats: Map<string, number> = new Map();
  private performanceMetrics = {
    totalRetrievals: 0,
    totalStorageOps: 0,
    totalRetrievalTime: 0,
    totalStorageTime: 0,
    evictionCount: 0,
  };

  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxMemorySize: 150 * 1024 * 1024, // 150MB
      defaultTTL: 20 * 60 * 1000, // 20 minutes
      evictionPolicy: "intelligent",
      performanceTracking: true,
      ...config,
    };

    this.setupPeriodicMaintenance();
  }

  // Main cache operations
  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const entry = this.memoryCache.get(key);
      if (entry && this.isValid(entry)) {
        entry.hits++;
        entry.lastAccessed = Date.now();
        this.recordHit(key);
        this.recordPerformance("retrieval", Date.now() - startTime);
        return entry.value as T;
      }

      this.recordMiss(key);
      this.recordPerformance("retrieval", Date.now() - startTime);
      return null;
    } catch (error) {
      console.error(`❌ Cache retrieval failed for key: ${key}`, error);
      this.recordMiss(key);
      return null;
    }
  }

  async set<T>(
    key: string,
    value: T,
    options: {
      ttl?: number;
      tags?: string[];
      metadata?: Partial<CacheEntry["metadata"]>;
      priority?: "high" | "medium" | "low";
    } = {}
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const size = this.calculateSize(value);

      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl,
        hits: 0,
        lastAccessed: Date.now(),
        size,
        tags: options.tags || [],
        metadata: {
          source: "api",
          freshness: "fresh",
          ...options.metadata,
        },
      };

      // Ensure capacity before storing
      await this.ensureCapacity(size);
      this.memoryCache.set(key, entry);
      this.recordPerformance("storage", Date.now() - startTime);
    } catch (error) {
      console.error(`❌ Cache storage failed for key: ${key}`, error);
    }
  }

  // Specialized cache methods for different data types
  async cacheQueryResult(
    query: string,
    result: RoutedQueryResult,
    context: any = {}
  ): Promise<void> {
    const key = this.generateQueryKey(query, context);
    const tags = [
      "query-result",
      `strategy:${result.strategy}`,
      `confidence:${Math.floor(result.confidence * 10) / 10}`,
    ];

    await this.set(key, result, {
      ttl: this.getQueryTTL(result),
      tags,
      metadata: {
        source: "query-router",
        confidence: result.confidence,
        freshness: result.dataFreshness,
        strategy: result.strategy,
      },
      priority: result.confidence > 0.8 ? "high" : "medium",
    });
  }

  async cacheOrderData(
    orders: ModernOrder[],
    source: string,
    filters: any = {}
  ): Promise<void> {
    const key = this.generateOrderDataKey(filters, source);
    const tags = ["order-data", `source:${source}`, `count:${orders.length}`];

    await this.set(key, orders, {
      ttl: source === "api" ? 5 * 60 * 1000 : 15 * 60 * 1000,
      tags,
      metadata: { source, freshness: source === "api" ? "fresh" : "cached" },
      priority: "high",
    });
  }

  async cacheVectorResults(
    query: string,
    results: EnhancedSearchResult[],
    filters: any = {}
  ): Promise<void> {
    const key = this.generateVectorKey(query, filters);
    const tags = ["vector-results", `count:${results.length}`];

    await this.set(key, results, {
      ttl: 20 * 60 * 1000, // 20 minutes
      tags,
      metadata: {
        source: "vector-db",
        confidence: results.length > 0 ? results[0].score : 0,
        freshness: "cached",
      },
      priority: "medium",
    });
  }

  // Cache invalidation methods
  async invalidateByTag(tag: string): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tags.includes(tag)) {
        this.memoryCache.delete(key);
        invalidatedCount++;
      }
    }

    console.log(
      `🗑️ Invalidated ${invalidatedCount} cache entries with tag: ${tag}`
    );
    return invalidatedCount;
  }

  async invalidateByPattern(pattern: string | RegExp): Promise<number> {
    let invalidatedCount = 0;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const [key] of this.memoryCache.entries()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        invalidatedCount++;
      }
    }

    console.log(
      `🗑️ Invalidated ${invalidatedCount} cache entries matching: ${pattern}`
    );
    return invalidatedCount;
  }

  async invalidateStaleEntries(): Promise<number> {
    let invalidatedCount = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
        invalidatedCount++;
      }
    }

    if (invalidatedCount > 0) {
      console.log(`🧹 Cleaned up ${invalidatedCount} stale cache entries`);
    }

    return invalidatedCount;
  }

  // Performance optimization
  async optimizeCache(): Promise<void> {
    console.log("⚡ Optimizing cache performance...");

    // Remove stale entries
    await this.invalidateStaleEntries();

    // Optimize memory usage if needed
    const currentSize = Array.from(this.memoryCache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );
    if (currentSize > this.config.maxMemorySize * 0.8) {
      await this.evictEntries(currentSize * 0.2); // Free up 20%
    }

    console.log("✅ Cache optimization completed");
  }

  getStats(): CacheStats {
    const totalHits = Array.from(this.hitStats.values()).reduce(
      (sum, hits) => sum + hits,
      0
    );
    const totalMisses = Array.from(this.missStats.values()).reduce(
      (sum, misses) => sum + misses,
      0
    );
    const totalRequests = totalHits + totalMisses;

    const memoryEntries = Array.from(this.memoryCache.values());
    const totalSize = memoryEntries.reduce((sum, entry) => sum + entry.size, 0);
    const averageAge =
      memoryEntries.length > 0
        ? memoryEntries.reduce(
            (sum, entry) => sum + (Date.now() - entry.timestamp),
            0
          ) / memoryEntries.length
        : 0;

    const topKeys = Array.from(this.memoryCache.entries())
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, 10)
      .map(([key, entry]) => ({
        key: key.length > 50 ? key.substring(0, 47) + "..." : key,
        hits: entry.hits,
        size: entry.size,
      }));

    return {
      totalEntries: this.memoryCache.size,
      totalSize,
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      missRate: totalRequests > 0 ? totalMisses / totalRequests : 0,
      totalHits,
      totalMisses,
      averageAge,
      topKeys,
      performanceMetrics: {
        averageRetrievalTime:
          this.performanceMetrics.totalRetrievals > 0
            ? this.performanceMetrics.totalRetrievalTime /
              this.performanceMetrics.totalRetrievals
            : 0,
        averageStorageTime:
          this.performanceMetrics.totalStorageOps > 0
            ? this.performanceMetrics.totalStorageTime /
              this.performanceMetrics.totalStorageOps
            : 0,
        evictionRate:
          this.performanceMetrics.evictionCount /
          Math.max(this.memoryCache.size, 1),
      },
    };
  }

  // Utility methods
  private generateQueryKey(query: string, context: any): string {
    const contextHash = crypto
      .createHash("md5")
      .update(JSON.stringify(context))
      .digest("hex")
      .substring(0, 8);
    const queryHash = crypto
      .createHash("md5")
      .update(query.toLowerCase())
      .digest("hex")
      .substring(0, 12);
    return `query:${queryHash}:${contextHash}`;
  }

  private generateOrderDataKey(filters: any, source: string): string {
    const filtersHash = crypto
      .createHash("md5")
      .update(JSON.stringify(filters))
      .digest("hex")
      .substring(0, 8);
    return `orders:${source}:${filtersHash}`;
  }

  private generateVectorKey(query: string, filters: any): string {
    const queryHash = crypto
      .createHash("md5")
      .update(query.toLowerCase())
      .digest("hex")
      .substring(0, 12);
    const filtersHash = crypto
      .createHash("md5")
      .update(JSON.stringify(filters))
      .digest("hex")
      .substring(0, 8);
    return `vector:${queryHash}:${filtersHash}`;
  }

  private getQueryTTL(result: RoutedQueryResult): number {
    const baseTTL = this.config.defaultTTL;

    if (result.strategy === "api" && result.confidence > 0.8) {
      return baseTTL * 0.5; // API data expires faster
    } else if (result.strategy === "vector" && result.confidence > 0.7) {
      return baseTTL * 1.5; // Vector results last longer
    }

    return baseTTL;
  }

  private isValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  private calculateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2; // UTF-16 estimate
    } catch {
      return 1024; // Default size
    }
  }

  private recordHit(key: string): void {
    this.hitStats.set(key, (this.hitStats.get(key) || 0) + 1);
  }

  private recordMiss(key: string): void {
    this.missStats.set(key, (this.missStats.get(key) || 0) + 1);
  }

  private recordPerformance(
    operation: "retrieval" | "storage",
    time: number
  ): void {
    if (!this.config.performanceTracking) return;

    if (operation === "retrieval") {
      this.performanceMetrics.totalRetrievals++;
      this.performanceMetrics.totalRetrievalTime += time;
    } else {
      this.performanceMetrics.totalStorageOps++;
      this.performanceMetrics.totalStorageTime += time;
    }
  }

  private setupPeriodicMaintenance(): void {
    // Clean up every 15 minutes
    setInterval(async () => {
      await this.invalidateStaleEntries();
    }, 15 * 60 * 1000);

    // Optimize every hour
    setInterval(async () => {
      await this.optimizeCache();
    }, 60 * 60 * 1000);
  }

  private async ensureCapacity(newEntrySize: number): Promise<void> {
    const currentSize = Array.from(this.memoryCache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    if (currentSize + newEntrySize > this.config.maxMemorySize) {
      await this.evictEntries(newEntrySize);
    }
  }

  private async evictEntries(requiredSpace: number): Promise<void> {
    switch (this.config.evictionPolicy) {
      case "lru":
        await this.evictLRU(requiredSpace);
        break;
      case "lfu":
        await this.evictLFU(requiredSpace);
        break;
      case "intelligent":
        await this.evictIntelligent(requiredSpace);
        break;
    }
  }

  private async evictLRU(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries()).sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed
    );

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;

      this.memoryCache.delete(key);
      freedSpace += entry.size;
      this.performanceMetrics.evictionCount++;
    }
  }

  private async evictLFU(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries()).sort(
      (a, b) => a[1].hits - b[1].hits
    );

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;

      this.memoryCache.delete(key);
      freedSpace += entry.size;
      this.performanceMetrics.evictionCount++;
    }
  }

  private async evictIntelligent(requiredSpace: number): Promise<void> {
    const entries = Array.from(this.memoryCache.entries())
      .map(([key, entry]) => ({
        key,
        entry,
        score: this.calculateEvictionScore(entry),
      }))
      .sort((a, b) => a.score - b.score);

    let freedSpace = 0;
    for (const { key, entry } of entries) {
      if (freedSpace >= requiredSpace) break;

      this.memoryCache.delete(key);
      freedSpace += entry.size;
      this.performanceMetrics.evictionCount++;
    }
  }

  private calculateEvictionScore(entry: CacheEntry): number {
    const age = Date.now() - entry.timestamp;
    const remainingTTL = entry.ttl - age;
    const hitFrequency = entry.hits / Math.max(age / (60 * 1000), 1);
    const confidenceBonus = (entry.metadata.confidence || 0.5) * 20;
    const sizePenalty = entry.size / 1024;
    const freshnessBonus =
      remainingTTL > 0 ? Math.min(remainingTTL / (60 * 1000), 30) : -50;

    return hitFrequency + confidenceBonus - sizePenalty + freshnessBonus;
  }

  async cleanup(): Promise<void> {
    console.log("🧹 Cleaning up advanced cache service...");
    await this.invalidateStaleEntries();
    this.memoryCache.clear();
    this.hitStats.clear();
    this.missStats.clear();
  }
}

// Export singleton instance
export const advancedCacheService = new AdvancedCacheService();

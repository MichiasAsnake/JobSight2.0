// Modern Hybrid Data Service - API-first with intelligent caching and fallbacks
// Provides smart hybrid functionality using the enhanced API client and modern data service

import {
  ModernOrder,
  apiFirstDataService,
  OrderSearchOptions,
} from "./api-first-data-service";
import { enhancedAPIClient } from "./enhanced-api-client";

// Enhanced order interface with hybrid metadata
export interface EnhancedOrder extends ModernOrder {
  // Hybrid-specific metadata
  dataSource: "api" | "cached" | "hybrid";
  dataFreshness: "fresh" | "stale" | "very-stale";
  lastAPIUpdate: string;
  cacheHit: boolean;

  // API enrichment indicators
  apiEnrichment: {
    shipmentTracking: boolean;
    realTimeStatus: boolean;
    lineItemDetails: boolean;
    fileAttachments: boolean;
    completenessScore: number; // 0-100
  };

  // Performance metrics
  performance: {
    fetchTime: number;
    cacheAge: number;
    apiLatency?: number;
  };

  // Quality indicators
  dataQuality: {
    confidence: number; // 0-1
    completeness: number; // 0-1
    accuracy: number; // 0-1
    staleness: number; // hours since last update
  };
}

interface HybridConfig {
  cachePreferred: boolean; // Whether to prefer cache over fresh API calls
  maxCacheAge: number; // Max cache age in minutes
  apiTimeoutMs: number;
  batchSize: number; // For bulk operations
  enableRealTimeUpdates: boolean;
  qualityThreshold: number; // Minimum quality score (0-1)
  performanceMode: "speed" | "accuracy" | "balanced";
}

export class ModernHybridDataService {
  private apiClient = enhancedAPIClient;
  private dataService = apiFirstDataService;
  private config: HybridConfig;
  private cache = new Map<string, { data: EnhancedOrder; timestamp: number }>();
  private metrics = {
    apiCalls: 0,
    cacheHits: 0,
    errors: 0,
    totalFetchTime: 0,
  };

  constructor() {
    this.config = {
      cachePreferred: true,
      maxCacheAge: 15, // 15 minutes
      apiTimeoutMs: 30000,
      batchSize: 50,
      enableRealTimeUpdates: true,
      qualityThreshold: 0.8,
      performanceMode: "balanced",
    };
  }

  // Configure hybrid behavior
  setConfig(config: Partial<HybridConfig>): void {
    this.config = { ...this.config, ...config };
    console.log("🔧 Hybrid config updated:", this.config);
  }

  // Get enhanced orders with intelligent caching and quality scoring
  async getEnhancedOrders(
    options: OrderSearchOptions = {}
  ): Promise<EnhancedOrder[]> {
    const startTime = Date.now();
    console.log("📊 Fetching enhanced orders with hybrid service...");

    try {
      // Check cache first if enabled
      const cacheKey = this.generateCacheKey("orders", options);
      const cached = this.getCachedData(cacheKey);

      if (cached && this.config.cachePreferred) {
        console.log("📦 Returning cached orders");
        this.metrics.cacheHits++;
        return cached;
      }

      // Fetch from API with enhanced options
      const enhancedOptions: OrderSearchOptions = {
        ...options,
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
        pageSize: options.pageSize || this.config.batchSize,
      };

      const ordersData = await this.dataService.getAllOrders(enhancedOptions);
      this.metrics.apiCalls++;

      // Convert to enhanced orders
      const enhancedOrders = ordersData.orders.map((order) =>
        this.convertToEnhancedOrder(order, {
          apiLatency: Date.now() - startTime,
          cacheHit: false,
          source: "api",
        })
      );

      // Cache the results
      if (enhancedOrders.length > 0) {
        this.setCachedData(cacheKey, enhancedOrders);
      }

      const totalTime = Date.now() - startTime;
      this.metrics.totalFetchTime += totalTime;

      console.log(
        `✅ Fetched ${enhancedOrders.length} enhanced orders in ${totalTime}ms`
      );
      return enhancedOrders;
    } catch (error) {
      this.metrics.errors++;
      console.error("❌ Failed to fetch enhanced orders:", error);

      // Try to return cached data as fallback
      const cacheKey = this.generateCacheKey("orders", options);
      const cached = this.getCachedData(cacheKey, true); // Allow stale cache

      if (cached) {
        console.log("🔄 Returning stale cached data as fallback");
        return cached;
      }

      throw error;
    }
  }

  // Get enhanced order by job number with full enrichment
  async getEnhancedOrderByJobNumber(
    jobNumber: string
  ): Promise<EnhancedOrder | null> {
    const startTime = Date.now();
    console.log(`🔍 Fetching enhanced order: ${jobNumber}`);

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey("order", { jobNumber });
      const cached = this.getCachedData(cacheKey);

      if (cached && this.config.cachePreferred) {
        console.log("📦 Returning cached order");
        this.metrics.cacheHits++;
        return cached[0] || null;
      }

      // Fetch from API
      const order = await this.dataService.getOrderByJobNumber(jobNumber);
      this.metrics.apiCalls++;

      if (!order) {
        return null;
      }

      // Convert to enhanced order
      const enhancedOrder = this.convertToEnhancedOrder(order, {
        apiLatency: Date.now() - startTime,
        cacheHit: false,
        source: "api",
      });

      // Cache the result
      this.setCachedData(cacheKey, [enhancedOrder]);

      const totalTime = Date.now() - startTime;
      console.log(`✅ Fetched enhanced order ${jobNumber} in ${totalTime}ms`);

      return enhancedOrder;
    } catch (error) {
      this.metrics.errors++;
      console.error(`❌ Failed to fetch enhanced order ${jobNumber}:`, error);

      // Try cached fallback
      const cacheKey = this.generateCacheKey("order", { jobNumber });
      const cached = this.getCachedData(cacheKey, true);

      if (cached && cached[0]) {
        console.log("🔄 Returning stale cached order as fallback");
        return cached[0];
      }

      return null;
    }
  }

  // Search with enhanced semantic capabilities
  async searchEnhancedOrders(
    query: string,
    options: OrderSearchOptions = {}
  ): Promise<EnhancedOrder[]> {
    console.log(`🔍 Enhanced search for: "${query}"`);

    try {
      // Use the data service's search capability
      const results = await this.dataService.searchOrdersByQuery(query, {
        ...options,
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
      });

      // Convert to enhanced orders
      const enhancedResults = results.map((order) =>
        this.convertToEnhancedOrder(order, {
          apiLatency: 0,
          cacheHit: false,
          source: "api",
        })
      );

      console.log(
        `✅ Found ${enhancedResults.length} enhanced orders matching "${query}"`
      );
      return enhancedResults;
    } catch (error) {
      console.error(`❌ Enhanced search failed for "${query}":`, error);
      return [];
    }
  }

  // Get orders by status with enhanced metadata
  async getEnhancedOrdersByStatus(status: string): Promise<EnhancedOrder[]> {
    const orders = await this.dataService.getOrdersByStatus(status);
    return orders.map((order) =>
      this.convertToEnhancedOrder(order, {
        apiLatency: 0,
        cacheHit: false,
        source: "api",
      })
    );
  }

  // Get orders by customer with enhanced metadata
  async getEnhancedOrdersByCustomer(
    customerName: string
  ): Promise<EnhancedOrder[]> {
    const orders = await this.dataService.getOrdersByCustomer(customerName);
    return orders.map((order) =>
      this.convertToEnhancedOrder(order, {
        apiLatency: 0,
        cacheHit: false,
        source: "api",
      })
    );
  }

  // Get recent orders with enhanced metadata
  async getEnhancedRecentOrders(limit: number = 10): Promise<EnhancedOrder[]> {
    const orders = await this.dataService.getRecentOrders(limit);
    return orders.map((order) =>
      this.convertToEnhancedOrder(order, {
        apiLatency: 0,
        cacheHit: false,
        source: "api",
      })
    );
  }

  // Get rush orders with enhanced metadata
  async getEnhancedRushOrders(): Promise<EnhancedOrder[]> {
    const orders = await this.dataService.getRushOrders();
    return orders.map((order) =>
      this.convertToEnhancedOrder(order, {
        apiLatency: 0,
        cacheHit: false,
        source: "api",
      })
    );
  }

  // Get late orders with enhanced metadata
  async getEnhancedLateOrders(): Promise<EnhancedOrder[]> {
    const orders = await this.dataService.getLateOrders();
    return orders.map((order) =>
      this.convertToEnhancedOrder(order, {
        apiLatency: 0,
        cacheHit: false,
        source: "api",
      })
    );
  }

  // Convert modern order to enhanced order with quality scoring
  private convertToEnhancedOrder(
    order: ModernOrder,
    meta: { apiLatency: number; cacheHit: boolean; source: "api" | "cached" }
  ): EnhancedOrder {
    const now = new Date();
    const lastUpdate = new Date(order.metadata.lastAPIUpdate);
    const staleness = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60); // hours

    // Calculate quality scores
    const completeness = this.calculateCompleteness(order);
    const confidence = this.calculateConfidence(order);
    const accuracy = this.calculateAccuracy(order);

    // Calculate enrichment indicators
    const apiEnrichment = {
      shipmentTracking:
        order.shipments.length > 0 &&
        order.shipments.some((s) => s.trackingDetails),
      realTimeStatus: staleness < 1, // Updated within last hour
      lineItemDetails: order.lineItems.length > 0,
      fileAttachments: order.files.length > 0,
      completenessScore: Math.round(completeness * 100),
    };

    const enhancedOrder: EnhancedOrder = {
      ...order,
      dataSource: meta.source,
      dataFreshness: this.calculateDataFreshness(staleness),
      lastAPIUpdate: now.toISOString(),
      cacheHit: meta.cacheHit,
      apiEnrichment,
      performance: {
        fetchTime: meta.apiLatency,
        cacheAge: meta.cacheHit ? staleness * 60 : 0, // minutes
        apiLatency: meta.apiLatency,
      },
      dataQuality: {
        confidence,
        completeness,
        accuracy,
        staleness,
      },
    };

    return enhancedOrder;
  }

  // Calculate data completeness score
  private calculateCompleteness(order: ModernOrder): number {
    const fields = [
      order.jobNumber,
      order.orderNumber,
      order.description,
      order.customer.company,
      order.status.master,
      order.dates.dateEntered,
      order.dates.dateDue,
    ];

    const completedFields = fields.filter(
      (field) => field && field !== "" && field !== null && field !== undefined
    ).length;

    return completedFields / fields.length;
  }

  // Calculate confidence score based on data source and freshness
  private calculateConfidence(order: ModernOrder): number {
    let confidence = 0.8; // Base confidence for API data

    // Boost for comprehensive data
    if (order.lineItems.length > 0) confidence += 0.1;
    if (order.shipments.length > 0) confidence += 0.05;
    if (order.files.length > 0) confidence += 0.05;

    // Reduce for stale data
    const staleness =
      (Date.now() - new Date(order.metadata.lastAPIUpdate).getTime()) /
      (1000 * 60 * 60);
    if (staleness > 24) confidence -= 0.2;
    if (staleness > 72) confidence -= 0.3;

    return Math.max(0, Math.min(1, confidence));
  }

  // Calculate accuracy score based on data consistency
  private calculateAccuracy(order: ModernOrder): number {
    let accuracy = 0.9; // Base accuracy for API data

    // Check for data consistency
    if (order.jobQuantity <= 0) accuracy -= 0.1;
    if (
      !order.dates.dateDue ||
      new Date(order.dates.dateDue).getTime() <
        new Date(order.dates.dateEntered).getTime()
    ) {
      accuracy -= 0.2;
    }

    return Math.max(0, Math.min(1, accuracy));
  }

  // Calculate data freshness category
  private calculateDataFreshness(
    hoursOld: number
  ): "fresh" | "stale" | "very-stale" {
    if (hoursOld < 1) return "fresh";
    if (hoursOld < 24) return "stale";
    return "very-stale";
  }

  // Cache management
  private generateCacheKey(type: string, options: any): string {
    return `${type}:${JSON.stringify(options)}`;
  }

  private getCachedData(
    key: string,
    allowStale = false
  ): EnhancedOrder[] | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
    const isStale = ageMinutes > this.config.maxCacheAge;

    if (isStale && !allowStale) {
      this.cache.delete(key);
      return null;
    }

    return Array.isArray(cached.data) ? cached.data : [cached.data];
  }

  private setCachedData(key: string, data: EnhancedOrder[]): void {
    this.cache.set(key, {
      data: data as any,
      timestamp: Date.now(),
    });

    // Clean up old cache entries
    if (this.cache.size > 1000) {
      const oldestKey = Array.from(this.cache.keys())[0];
      this.cache.delete(oldestKey);
    }
  }

  // Health and monitoring
  async getSystemHealth() {
    const apiHealth = await this.dataService.healthCheck();

    return {
      api: apiHealth,
      cache: {
        size: this.cache.size,
        hitRate:
          this.metrics.cacheHits /
          Math.max(this.metrics.apiCalls + this.metrics.cacheHits, 1),
      },
      metrics: this.metrics,
      config: this.config,
      healthy: apiHealth.healthy,
      lastCheck: new Date().toISOString(),
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log("🗑️ Hybrid service cache cleared");
  }

  // Get performance metrics
  getMetrics() {
    const totalRequests = this.metrics.apiCalls + this.metrics.cacheHits;
    return {
      ...this.metrics,
      cacheHitRate:
        totalRequests > 0 ? this.metrics.cacheHits / totalRequests : 0,
      averageFetchTime:
        this.metrics.apiCalls > 0
          ? this.metrics.totalFetchTime / this.metrics.apiCalls
          : 0,
      errorRate: totalRequests > 0 ? this.metrics.errors / totalRequests : 0,
    };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      apiCalls: 0,
      cacheHits: 0,
      errors: 0,
      totalFetchTime: 0,
    };
    console.log("📊 Metrics reset");
  }
}

// Export singleton instance
export const modernHybridDataService = new ModernHybridDataService();

// Export for backward compatibility
export const hybridOMSDataService = modernHybridDataService;

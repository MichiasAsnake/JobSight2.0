// Hybrid Data Service - Modern API-first Integration with Intelligent Fallbacks
// Provides smart hybrid functionality using the enhanced API client and modern data service

import { ModernOrder, apiFirstDataService } from "./api-first-data-service";
import { enhancedAPIClient } from "./enhanced-api-client";

// Type definitions for hybrid service
export interface EnhancedOrder extends ModernOrder {
  dataSource: "api" | "cached" | "hybrid";
  dataFreshness: "fresh" | "stale" | "very-stale";
  lastAPIUpdate: string;
  apiEnrichment?: {
    shipmentTracking?: boolean;
    realTimeStatus?: boolean;
    lineItemDetails?: boolean;
    fileAttachments?: boolean;
  };
}

interface HybridConfig {
  apiPreferred: boolean; // Whether to prefer API over scraping
  maxApiRetries: number;
  apiTimeoutMs: number;
  fallbackToScraping: boolean;
  apiToScrapingRatio: number; // 0.0 = all scraping, 1.0 = all API
}

export class HybridOMSDataService {
  private apiClient = enhancedAPIClient;
  private apiEnabled = true; // Always enabled in API-first architecture
  private dataService = apiFirstDataService;
  private config: HybridConfig;
  private apiHealthy = true;
  private lastApiHealthCheck = 0;
  private readonly API_HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.config = {
      apiPreferred: true,
      maxApiRetries: 3,
      apiTimeoutMs: 10000,
      fallbackToScraping: true,
      apiToScrapingRatio: 0.7, // Prefer API but use some scraping
    };
  }

  // Configure hybrid behavior
  setHybridConfig(config: Partial<HybridConfig>) {
    this.config = { ...this.config, ...config };
    console.log("🔧 Hybrid config updated:", this.config);
  }

  // Enable API integration with authentication
  async enableAPIIntegration(authCookies?: string): Promise<boolean> {
    try {
      if (authCookies) {
        this.apiClient.setAuthCookies(authCookies);
      }

      // Test API health immediately
      const healthCheck = await this.performApiHealthCheck();

      if (healthCheck.healthy) {
        this.apiEnabled = true;
        this.apiHealthy = true;
        console.log("✅ API integration enabled and healthy");
        return true;
      } else {
        console.warn(
          "⚠️ API integration enabled but health check failed:",
          healthCheck.details
        );
        this.apiEnabled = true; // Still enable for fallback scenarios
        this.apiHealthy = false;
        return false;
      }
    } catch (error) {
      console.error("❌ Failed to enable API integration:", error);
      this.apiEnabled = false;
      this.apiHealthy = false;
      return false;
    }
  }

  // Disable API integration (fallback to scraping only)
  disableAPIIntegration() {
    this.apiEnabled = false;
    this.apiHealthy = false;
    console.log("⚠️ API integration disabled - using scraped data only");
  }

  // Perform API health check with caching
  private async performApiHealthCheck(): Promise<{
    healthy: boolean;
    details: unknown;
  }> {
    const now = Date.now();

    // Use cached result if recent
    if (
      now - this.lastApiHealthCheck < this.API_HEALTH_CHECK_INTERVAL &&
      this.lastApiHealthCheck > 0
    ) {
      return { healthy: this.apiHealthy, details: { cached: true } };
    }

    try {
      const health = await this.apiClient.checkAPIHealth();
      this.apiHealthy = health.healthy;
      this.lastApiHealthCheck = now;

      console.log(
        `🏥 API health check: ${health.healthy ? "✅ Healthy" : "❌ Unhealthy"}`
      );

      return { healthy: health.healthy, details: health };
    } catch (error) {
      this.apiHealthy = false;
      this.lastApiHealthCheck = now;
      console.error("❌ API health check failed:", error);

      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  // Enhanced hybrid order retrieval with API integration
  async getEnhancedOrders(): Promise<EnhancedOrder[]> {
    try {
      // Get all orders from API-first data service
      const ordersData = await this.dataService.getAllOrders();
      const apiOrders = ordersData.orders;

      console.log(
        `📊 Retrieved ${apiOrders.length} orders from API-first service`
      );

      // Convert to enhanced orders
      const enhancedOrders = apiOrders.map((order) =>
        this.modernOrderToEnhanced(order, "api")
      );

      console.log(
        `🔄 Enhanced result: ${enhancedOrders.length} API orders processed`
      );

      return enhancedOrders;
    } catch (error) {
      console.error("❌ Failed to get enhanced orders:", error);

      // Return empty array as fallback since we're API-first
      console.log("🔄 Returning empty array as fallback");
      return [];
    }
  }

  // Enhanced single order retrieval with API enrichment
  async getEnhancedOrderByJobNumber(
    jobNumber: string
  ): Promise<EnhancedOrder | null> {
    try {
      // Get order from API-first data service
      const orderData = await this.dataService.getOrderByJobNumber(jobNumber);

      if (!orderData) {
        console.log(`📋 No order found for job number: ${jobNumber}`);
        return null;
      }

      // Convert to enhanced order
      const enhancedOrder = this.modernOrderToEnhanced(orderData, "api");
      console.log(`✅ Retrieved enhanced order for job: ${jobNumber}`);

      return enhancedOrder;
    } catch (error) {
      console.error(`❌ Failed to get enhanced order ${jobNumber}:`, error);
      return null;
    }
  }

  // Enhance multiple orders with API data
  private async enhanceOrdersWithAPI(
    scrapedOrders: Order[]
  ): Promise<EnhancedOrder[]> {
    const enhancedOrders: EnhancedOrder[] = [];
    const batchSize = 10; // Process in smaller batches to avoid overwhelming API

    for (let i = 0; i < scrapedOrders.length; i += batchSize) {
      const batch = scrapedOrders.slice(i, i + batchSize);

      const batchPromises = batch.map(async (order) => {
        try {
          // Determine if this order should use API based on ratio
          const useAPI = Math.random() < this.config.apiToScrapingRatio;

          if (useAPI) {
            return await this.enrichOrderWithAPI(order);
          } else {
            return this.orderToEnhanced(order, "scraped");
          }
        } catch (error) {
          console.warn(
            `⚠️ Failed to enhance order ${order.jobNumber}, using scraped data:`,
            error
          );
          return this.orderToEnhanced(order, "scraped");
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === "fulfilled") {
          enhancedOrders.push(result.value);
        }
      });

      // Small delay between batches
      if (i + batchSize < scrapedOrders.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return enhancedOrders;
  }

  // Enrich a single order with API data
  private async enrichOrderWithAPI(
    scrapedOrder: Order
  ): Promise<EnhancedOrder> {
    try {
      // Get live API data for this job
      const [jobStatus, jobShipments, jobFiles] = await Promise.allSettled([
        this.apiClient.getJobStatus(scrapedOrder.jobNumber),
        this.apiClient.getJobShipments(
          scrapedOrder.jobNumber,
          scrapedOrder.customer?.customerId?.toString()
        ),
        this.apiClient.getJobFiles(scrapedOrder.jobNumber),
      ]);

      const enhancedOrder: EnhancedOrder = {
        ...scrapedOrder,
        dataSource: "hybrid",
        lastAPIUpdate: new Date().toISOString(),
        needsRefresh: false,
        staleness: "fresh",
        apiErrors: [],
      };

      // Add successful API data
      if (jobStatus.status === "fulfilled" && jobStatus.value.isSuccess) {
        enhancedOrder.liveStatus = jobStatus.value.data;
      } else if (jobStatus.status === "rejected") {
        enhancedOrder.apiErrors?.push(`Status: ${jobStatus.reason}`);
      }

      if (jobShipments.status === "fulfilled" && jobShipments.value.isSuccess) {
        enhancedOrder.liveShipping = jobShipments.value.data;
      } else if (jobShipments.status === "rejected") {
        enhancedOrder.apiErrors?.push(`Shipments: ${jobShipments.reason}`);
      }

      if (jobFiles.status === "fulfilled" && jobFiles.value.isSuccess) {
        enhancedOrder.liveFiles = jobFiles.value.data;
      } else if (jobFiles.status === "rejected") {
        enhancedOrder.apiErrors?.push(`Files: ${jobFiles.reason}`);
      }

      return enhancedOrder;
    } catch (error) {
      console.warn(
        `⚠️ API enrichment failed for ${scrapedOrder.jobNumber}:`,
        error
      );
      return this.orderToEnhanced(scrapedOrder, "scraped");
    }
  }

  // Get order directly from API (when no scraped data exists)
  private async getOrderFromAPI(jobNumber: string): Promise<Order | null> {
    try {
      console.log(
        `🔍 API-only order retrieval not yet implemented for job ${jobNumber}`
      );
      return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (_error) {
      console.log(
        `🔍 API-only order retrieval not yet implemented for job ${jobNumber}`
      );
      return null;
    }
  }

  // Determine if API should be used based on config and health
  private shouldUseAPI(): boolean {
    if (!this.apiEnabled) return false;

    // Check if API health check is needed
    const now = Date.now();
    if (now - this.lastApiHealthCheck > this.API_HEALTH_CHECK_INTERVAL) {
      // Health check needed but don't wait for it
      this.performApiHealthCheck().catch((error) => {
        console.warn("Background API health check failed:", error);
      });
    }

    return this.apiHealthy;
  }

  // Convert regular Order to EnhancedOrder with source tracking
  private modernOrderToEnhanced(
    order: ModernOrder,
    source: "api" | "cached" | "hybrid"
  ): EnhancedOrder {
    return {
      ...order,
      dataSource: source,
      dataFreshness: source === "api" ? "fresh" : "stale",
      lastAPIUpdate: new Date().toISOString(),
      apiEnrichment: {
        shipmentTracking: order.shipments && order.shipments.length > 0,
        realTimeStatus: source === "api",
        lineItemDetails: order.lineItems && order.lineItems.length > 0,
        fileAttachments: order.files && order.files.length > 0,
      },
    };
  }

  private orderToEnhanced(
    order: ModernOrder,
    source: "api" | "cached" | "hybrid"
  ): EnhancedOrder {
    return {
      ...order,
      dataSource: source,
      lastAPIUpdate:
        source === "scraped" ? undefined : new Date().toISOString(),
      needsRefresh: source === "scraped" && this.apiEnabled,
      staleness: this.calculateStaleness(order.metadata.lastUpdated),
    };
  }

  // Calculate data staleness
  private calculateStaleness(
    lastUpdated: string
  ): "fresh" | "stale" | "very-stale" {
    if (!lastUpdated) return "very-stale";

    const updateTime = new Date(lastUpdated);
    const now = new Date();
    const hoursOld = (now.getTime() - updateTime.getTime()) / (1000 * 60 * 60);

    if (hoursOld < 2) return "fresh";
    if (hoursOld < 12) return "stale";
    return "very-stale";
  }

  // API Health Check with detailed results
  async checkAPIHealth(): Promise<{ healthy: boolean; details: unknown }> {
    if (!this.apiEnabled) {
      return {
        healthy: false,
        details: { reason: "API integration disabled" },
      };
    }

    return await this.performApiHealthCheck();
  }

  // Get comprehensive system status
  async getSystemStatus(): Promise<{
    scraped: { healthy: boolean; orderCount: number };
    api: { healthy: boolean; details: unknown };
    hybrid: {
      enabled: boolean;
      config: HybridConfig;
      lastHealthCheck: number;
      apiPreference: number;
    };
  }> {
    try {
      const orders = await this.dataService.getOrders();
      const apiHealth = await this.checkAPIHealth();

      return {
        scraped: {
          healthy: orders.length > 0,
          orderCount: orders.length,
        },
        api: apiHealth,
        hybrid: {
          enabled: this.apiEnabled,
          config: this.config,
          lastHealthCheck: this.lastApiHealthCheck,
          apiPreference: this.config.apiToScrapingRatio,
        },
      };
    } catch (error) {
      return {
        scraped: { healthy: false, orderCount: 0 },
        api: {
          healthy: false,
          details: { error: "Failed to check API health" },
        },
        hybrid: {
          enabled: false,
          config: this.config,
          lastHealthCheck: 0,
          apiPreference: 0,
        },
      };
    }
  }

  // Override existing methods to use hybrid approach
  async getOrdersByStatus(status: string): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    return orders.filter(
      (order) =>
        order.status.toLowerCase().includes(status.toLowerCase()) ||
        order.liveStatus?.MasterStatus?.Status?.toLowerCase().includes(
          status.toLowerCase()
        )
    );
  }

  async getOrdersByCustomer(customerName: string): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    return orders.filter((order) =>
      order.customer.company.toLowerCase().includes(customerName.toLowerCase())
    );
  }

  async searchOrdersByQuery(query: string): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    const queryLower = query.toLowerCase();

    return orders.filter((order) => {
      // Basic text matching
      const textMatch =
        order.jobNumber.includes(query) ||
        order.orderNumber.toLowerCase().includes(queryLower) ||
        order.description.toLowerCase().includes(queryLower) ||
        order.customer.company.toLowerCase().includes(queryLower);

      // Enhanced: Smart date-aware searching for fallback cases
      if (
        queryLower.includes("due") ||
        queryLower.includes("today") ||
        queryLower.includes("tomorrow")
      ) {
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(today.getDate() + 1);

        if (order.requestedShipDate) {
          try {
            const shipDate = new Date(order.requestedShipDate);
            const shipDateStr = shipDate.toISOString().split("T")[0];
            const todayStr = today.toISOString().split("T")[0];
            const tomorrowStr = tomorrow.toISOString().split("T")[0];

            if (queryLower.includes("today") && shipDateStr === todayStr) {
              return true;
            }
            if (
              queryLower.includes("tomorrow") &&
              shipDateStr === tomorrowStr
            ) {
              return true;
            }
          } catch (error) {
            // Ignore date parsing errors for this fallback
          }
        }
      }

      // Enhanced: Status and priority matching
      if (queryLower.includes("rush") || queryLower.includes("urgent")) {
        if (
          order.workflow.isRush ||
          order.priority.toLowerCase().includes("rush") ||
          order.priority.toLowerCase().includes("urgent")
        ) {
          return true;
        }
      }

      // Enhanced: Line item searching
      const lineItemMatch = order.lineItems.some(
        (item) =>
          item.description.toLowerCase().includes(queryLower) ||
          item.category.toLowerCase().includes(queryLower) ||
          item.comment.toLowerCase().includes(queryLower)
      );

      return textMatch || lineItemMatch;
    });
  }

  async getRushOrders(): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    return orders.filter(
      (order) =>
        order.workflow.isRush ||
        order.priority.toLowerCase().includes("rush") ||
        order.priority.toLowerCase().includes("urgent")
    );
  }

  async getLateOrders(): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    const now = new Date();

    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      const shipDate = new Date(order.requestedShipDate);
      return shipDate < now;
    });
  }

  async getOrdersDueToday(): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0]; // YYYY-MM-DD format

    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        const shipDateStr = shipDate.toISOString().split("T")[0];
        return shipDateStr === todayStr && order.status !== "Closed";
      } catch (error) {
        console.warn(
          `Invalid requestedShipDate for order ${order.jobNumber}:`,
          order.requestedShipDate
        );
        return false;
      }
    });
  }

  async getOrdersDueTomorrow(): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // YYYY-MM-DD format

    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        const shipDateStr = shipDate.toISOString().split("T")[0];
        return shipDateStr === tomorrowStr && order.status !== "Closed";
      } catch (error) {
        console.warn(
          `Invalid requestedShipDate for order ${order.jobNumber}:`,
          order.requestedShipDate
        );
        return false;
      }
    });
  }

  async getOrdersDueThisWeek(): Promise<EnhancedOrder[]> {
    const orders = await this.getEnhancedOrders();
    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);

    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        return (
          shipDate >= today &&
          shipDate <= weekFromNow &&
          order.status !== "Closed"
        );
      } catch (error) {
        console.warn(
          `Invalid requestedShipDate for order ${order.jobNumber}:`,
          order.requestedShipDate
        );
        return false;
      }
    });
  }

  // Get detailed API statistics for monitoring
  getAPIStats() {
    return {
      enabled: this.apiEnabled,
      healthy: this.apiHealthy,
      lastHealthCheck: this.lastApiHealthCheck,
      config: this.config,
      clientConfigured: !!this.apiClient,
    };
  }

  // Force API health check refresh
  async refreshAPIHealth(): Promise<boolean> {
    this.lastApiHealthCheck = 0; // Force refresh
    const health = await this.performApiHealthCheck();
    return health.healthy;
  }
}

// Create enhanced singleton instance
export const hybridOMSDataService = new HybridOMSDataService();

// Export configuration type for external use
export type { HybridConfig };

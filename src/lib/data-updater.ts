import fs from "fs";
import path from "path";
import { Order, OrdersData } from "./oms-data";
import { vectorDBService, UpsertVector } from "./vector-db";
import { embeddingService } from "./embeddings";
import { hybridOMSDataService, HybridConfig } from "./hybrid-data-service";

interface UpdateStats {
  totalOrders: number;
  newOrders: number;
  updatedOrders: number;
  deletedOrders: number;
  unchangedOrders: number;
  lastUpdate: string;
  updateDuration: number;
  // Vector update tracking
  vectorUpdateTriggered: boolean;
  vectorUpdateStatus: "pending" | "success" | "failed" | "skipped";
  vectorUpdateDuration?: number;
  vectorUpdateError?: string;
  // Hybrid data tracking
  hybridDataUsed: boolean;
  apiOrdersCount: number;
  scrapedOrdersCount: number;
  hybridOrdersCount: number;
}

interface DataUpdaterConfig {
  useHybridData: boolean;
  hybridConfig: Partial<HybridConfig>;
  enableAPIAuthentication: boolean;
  apiAuthCookies?: string;
}

interface DataHealth {
  totalOrders: number;
  dataAge: number; // hours since last update
  completeness: number; // percentage of orders with complete data
  dataQuality: {
    missingCustomerInfo: number;
    missingPricing: number;
    missingShipDates: number;
    incompleteLineItems: number;
  };
  recommendations: string[];
  // Vector sync health
  vectorSyncHealth: {
    lastVectorUpdate: string;
    vectorDataAge: number; // hours since last vector update
    isInSync: boolean;
    syncRecommendations: string[];
  };
  // Hybrid data health
  hybridHealth: {
    enabled: boolean;
    apiEnabled: boolean;
    apiHealthy: boolean;
    lastApiCheck: number;
    dataSourceBreakdown: {
      scraped: number;
      api: number;
      hybrid: number;
    };
  };
}

class DataUpdater {
  private dataPath: string;
  private backupPath: string;
  private lastUpdatePath: string;
  private updateStatsPath: string;
  private vectorUpdatePath: string;
  private configPath: string;
  private vectorDB = vectorDBService;
  private embeddings = embeddingService;
  private hybridService = hybridOMSDataService;
  private config: DataUpdaterConfig;

  constructor() {
    this.dataPath = path.join(process.cwd(), "data", "orders.json");
    this.backupPath = path.join(process.cwd(), "data", "orders.backup.json");
    this.lastUpdatePath = path.join(process.cwd(), "data", "last-update.json");
    this.updateStatsPath = path.join(
      process.cwd(),
      "data",
      "update-stats.json"
    );
    this.vectorUpdatePath = path.join(
      process.cwd(),
      "data",
      "last-vector-update.json"
    );
    this.configPath = path.join(
      process.cwd(),
      "data",
      "data-updater-config.json"
    );

    // Load configuration
    this.config = this.loadConfig();

    // Configure hybrid service if enabled
    if (this.config.useHybridData) {
      this.initializeHybridService();
    }
  }

  // Load data updater configuration
  private loadConfig(): DataUpdaterConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, "utf8");
        return { ...this.getDefaultConfig(), ...JSON.parse(configData) };
      }
    } catch (error) {
      console.warn(
        "Failed to load data updater config, using defaults:",
        error
      );
    }

    return this.getDefaultConfig();
  }

  // Get default configuration
  private getDefaultConfig(): DataUpdaterConfig {
    return {
      useHybridData: true,
      hybridConfig: {
        apiPreferred: true,
        fallbackToScraping: true,
        apiToScrapingRatio: 0.3, // Conservative - mostly scraping with some API enhancement
      },
      enableAPIAuthentication: false, // Disabled by default until auth setup
    };
  }

  // Save configuration
  private saveConfig(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Failed to save data updater config:", error);
    }
  }

  // Configure the data updater
  setConfig(newConfig: Partial<DataUpdaterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();

    console.log("🔧 Data updater configuration updated");

    // Reinitialize hybrid service if needed
    if (this.config.useHybridData) {
      this.initializeHybridService();
    } else {
      this.hybridService.disableAPIIntegration();
    }
  }

  // Initialize hybrid service based on configuration
  private async initializeHybridService(): Promise<void> {
    try {
      if (this.config.hybridConfig) {
        this.hybridService.setHybridConfig(this.config.hybridConfig);
      }

      if (this.config.enableAPIAuthentication) {
        const apiEnabled = await this.hybridService.enableAPIIntegration(
          this.config.apiAuthCookies
        );

        if (apiEnabled) {
          console.log("✅ Hybrid service initialized with API integration");
        } else {
          console.warn(
            "⚠️ Hybrid service initialized but API integration failed"
          );
        }
      } else {
        console.log("📋 Hybrid service initialized in scraping-only mode");
      }
    } catch (error) {
      console.error("❌ Failed to initialize hybrid service:", error);
    }
  }

  // Check if data needs updating based on age and business rules
  async shouldUpdate(): Promise<{ needsUpdate: boolean; reason: string }> {
    try {
      const lastUpdate = await this.getLastUpdateTime();
      const now = new Date();
      const hoursSinceUpdate =
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      // Business hours: 8 AM - 6 PM, Monday-Friday
      const isBusinessHours = this.isBusinessHours(now);

      // Update rules:
      // - During business hours: every 2 hours
      // - Outside business hours: every 6 hours
      // - Always update if more than 24 hours old
      const updateInterval = isBusinessHours ? 2 : 6;

      if (hoursSinceUpdate >= 24) {
        return { needsUpdate: true, reason: "Data is over 24 hours old" };
      }

      if (hoursSinceUpdate >= updateInterval) {
        return {
          needsUpdate: true,
          reason: `Data is ${Math.round(
            hoursSinceUpdate
          )} hours old (threshold: ${updateInterval}h)`,
        };
      }

      return { needsUpdate: false, reason: "Data is current" };
    } catch (error) {
      console.error("Error checking update status:", error);
      return { needsUpdate: true, reason: "Error checking update status" };
    }
  }

  // Perform smart incremental update with hybrid data and vector DB sync
  async performUpdate(): Promise<UpdateStats> {
    console.log("🔄 Starting smart data update with hybrid approach...");
    const updateStartTime = Date.now();

    try {
      // Create backup before update
      await this.createBackup();

      // Load current data
      const currentData = await this.loadCurrentData();
      const currentOrders = currentData.orders || [];

      // Get fresh data using hybrid approach
      let freshOrders: Order[];
      let hybridStats = { api: 0, scraped: 0, hybrid: 0 };

      if (this.config.useHybridData) {
        console.log("🔀 Using hybrid data approach (API + scraping)");
        const enhancedOrders = await this.hybridService.getEnhancedOrders();

        // Convert enhanced orders back to regular orders for storage
        freshOrders = enhancedOrders.map(
          (order) =>
            ({
              ...order,
              // Remove enhanced fields for storage
              dataSource: undefined,
              lastAPIUpdate: undefined,
              needsRefresh: undefined,
              staleness: undefined,
              liveStatus: undefined,
              liveShipping: undefined,
              liveFiles: undefined,
              apiJobData: undefined,
              apiErrors: undefined,
              dataAge: undefined,
            } as Order)
        );

        // Calculate hybrid statistics
        hybridStats = {
          api: enhancedOrders.filter((o) => o.dataSource === "api").length,
          scraped: enhancedOrders.filter((o) => o.dataSource === "scraped")
            .length,
          hybrid: enhancedOrders.filter((o) => o.dataSource === "hybrid")
            .length,
        };

        console.log(
          `📊 Hybrid data breakdown: ${hybridStats.hybrid} enhanced, ${hybridStats.api} API-only, ${hybridStats.scraped} scraped-only`
        );
      } else {
        console.log("⚠️ API failed, no fallback available in API-first mode");
        // In API-first architecture, we don't have scraping fallback
        hybridStats.scraped = 0;
        freshOrders = [];
      }

      // Compare and merge data
      const updateStats = await this.mergeData(currentOrders, freshOrders);
      updateStats.updateDuration = Date.now() - updateStartTime;

      // Add hybrid statistics
      updateStats.hybridDataUsed = this.config.useHybridData;
      updateStats.apiOrdersCount = hybridStats.api;
      updateStats.scrapedOrdersCount = hybridStats.scraped;
      updateStats.hybridOrdersCount = hybridStats.hybrid;

      // Save updated data
      const updatedData: OrdersData = {
        orders: freshOrders,
        summary: {
          totalOrders: freshOrders.length,
          lastUpdated: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        },
      };

      await this.saveData(updatedData);
      await this.saveUpdateStats(updateStats);
      await this.saveLastUpdateTime();

      console.log("✅ Data update completed successfully");

      // Trigger vector DB update if significant changes occurred
      await this.triggerVectorUpdateIfNeeded(updateStats, freshOrders);

      return updateStats;
    } catch (error) {
      console.error("❌ Error during data update:", error);

      // Restore from backup if update failed
      await this.restoreFromBackup();

      throw error;
    }
  }

  // Trigger vector DB update based on change significance
  private async triggerVectorUpdateIfNeeded(
    updateStats: UpdateStats,
    freshOrders: Order[]
  ): Promise<void> {
    const significantChanges = this.hasSignificantUpdateChanges(updateStats);

    console.log(
      `📊 Update summary: ${updateStats.newOrders} new, ${updateStats.updatedOrders} updated, ${updateStats.deletedOrders} deleted`
    );

    if (!significantChanges) {
      console.log(
        "⏭️ No significant changes detected - skipping vector update"
      );
      updateStats.vectorUpdateTriggered = false;
      updateStats.vectorUpdateStatus = "skipped";
      this.logVectorUpdate("skip", {
        reason: "No significant changes detected",
        changesSummary: `${updateStats.newOrders} new, ${updateStats.updatedOrders} updated, ${updateStats.deletedOrders} deleted`,
      });
      await this.saveUpdateStats(updateStats);
      return;
    }

    console.log(
      "🚀 Significant changes detected - triggering vector DB update"
    );
    updateStats.vectorUpdateTriggered = true;
    updateStats.vectorUpdateStatus = "pending";
    await this.saveUpdateStats(updateStats);

    // Trigger vector update asynchronously to not block data updates
    // Use Promise.catch to ensure vector update failures don't crash the main process
    this.runVectorUpdateAsync(updateStats, freshOrders).catch((error) => {
      console.error("🔥 Critical: Vector update process crashed:", error);
      // Log the crash but don't throw - data update already succeeded
    });
  }

  // Run vector update asynchronously with comprehensive error handling
  private async runVectorUpdateAsync(
    updateStats: UpdateStats,
    orders: Order[]
  ): Promise<void> {
    const vectorStartTime = Date.now();

    try {
      console.log("🧠 Starting vector DB update...");
      this.logVectorUpdate("start", { ordersCount: orders.length });

      // Initialize vector DB if needed
      await this.vectorDB.initialize();

      // Run the vector update
      await this.updateVectorDatabase(orders);

      // Update stats with success
      updateStats.vectorUpdateStatus = "success";
      updateStats.vectorUpdateDuration = Date.now() - vectorStartTime;

      // Save vector update timestamp
      await this.saveVectorUpdateTime();

      console.log(
        `✅ Vector DB update completed in ${updateStats.vectorUpdateDuration}ms`
      );
      this.logVectorUpdate("success", {
        duration: updateStats.vectorUpdateDuration,
        ordersProcessed: orders.length,
      });
    } catch (error) {
      console.error("❌ Vector DB update failed:", error);

      updateStats.vectorUpdateStatus = "failed";
      updateStats.vectorUpdateError =
        error instanceof Error ? error.message : "Unknown error";
      updateStats.vectorUpdateDuration = Date.now() - vectorStartTime;

      this.logVectorUpdate("error", {
        error: updateStats.vectorUpdateError,
        duration: updateStats.vectorUpdateDuration,
      });
    }

    // Always save final stats
    await this.saveUpdateStats(updateStats);
  }

  // Logging for vector updates with structured data
  private logVectorUpdate(
    event: "start" | "success" | "error" | "skip",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any> = {}
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...data,
    };

    console.log(
      `${this.getEventEmoji(event)} Vector Update [${event.toUpperCase()}]:`,
      logEntry
    );

    // Also save to persistent log file
    this.saveVectorLogEntry(logEntry);
  }

  // Save log entry to file for persistent tracking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private saveVectorLogEntry(logEntry: Record<string, any>): void {
    try {
      const logDir = path.join(process.cwd(), "logs");
      const logFile = path.join(logDir, "vector-updates.log");

      // Ensure log directory exists
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // Append log entry as JSON line
      const logLine = JSON.stringify(logEntry) + "\n";
      fs.appendFileSync(logFile, logLine, "utf8");
    } catch (error) {
      console.error("Failed to write vector log entry:", error);
    }
  }

  // Enhanced vector update with incremental change detection
  private async updateVectorDatabase(orders: Order[]): Promise<void> {
    const startTime = Date.now();
    console.log("📊 Starting incremental vector database update...");

    try {
      // Use the new incremental update functionality
      const result = await this.vectorDB.performIncrementalUpdate(orders);

      console.log(`✅ Incremental vector update completed:`);
      console.log(`  • ${result.newVectors} new vectors created`);
      console.log(`  • ${result.updatedVectors} vectors updated`);
      console.log(`  • ${result.deletedVectors} vectors deleted`);
      console.log(`  • ${result.unchangedVectors} vectors unchanged`);
      console.log(`  • Total processing time: ${result.processingTime}ms`);

      if (result.errors.length > 0) {
        console.warn(
          `⚠️ ${result.errors.length} errors occurred during update:`,
          result.errors
        );
      }

      const duration = Date.now() - startTime;
      console.log(`⏱️ Total vector update completed in ${duration}ms`);
    } catch (error) {
      console.error("❌ Incremental vector database update failed:", error);

      // Fallback to legacy update for critical failures
      console.log("🔄 Attempting fallback to legacy vector update...");
      await this.legacyUpdateVectorDatabase(orders);
    }
  }

  // Legacy full vector update as fallback
  private async legacyUpdateVectorDatabase(orders: Order[]): Promise<void> {
    console.log(
      `📝 Processing ${orders.length} orders for legacy vector updates...`
    );

    const batchSize = 25; // Process in smaller batches for reliability
    const totalBatches = Math.ceil(orders.length / batchSize);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(
        `📦 Processing vector batch ${batchNumber}/${totalBatches} (${batch.length} orders)...`
      );

      // Convert orders to vectors
      const vectors: UpsertVector[] = [];

      for (const order of batch) {
        try {
          const searchText = this.vectorDB.orderToSearchText(order);
          const embedding = await this.embeddings.createEmbedding(searchText);
          const metadata = this.vectorDB.orderToMetadata(order);

          vectors.push({
            id: `order-${order.jobNumber}`,
            values: embedding,
            metadata,
          });

          // Small delay between embeddings to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `❌ Failed to process order ${order.jobNumber}:`,
            error
          );
          // Continue with other orders instead of failing the whole batch
        }
      }

      // Upsert batch to vector DB with retry logic
      if (vectors.length > 0) {
        await this.upsertVectorsWithRetry(vectors, 3);
        console.log(`✅ Upserted ${vectors.length} vectors to database`);
      } else {
        console.warn(
          `⚠️ Batch ${batchNumber} had no successful vectors to upsert`
        );
      }

      // Pause between batches to avoid overwhelming APIs
      if (batchNumber < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  // Retry logic for vector upserts
  private async upsertVectorsWithRetry(
    vectors: UpsertVector[],
    maxRetries: number
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.vectorDB.upsertVectors(vectors);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `⚠️ Vector upsert attempt ${attempt}/${maxRetries} failed: ${lastError.message}`
        );

        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          console.log(`⏱️ Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(
      `Vector upsert failed after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  // Determine if changes are significant enough to warrant vector update
  private hasSignificantUpdateChanges(updateStats: UpdateStats): boolean {
    const { newOrders, updatedOrders, deletedOrders, totalOrders } =
      updateStats;

    // Always update if we have new or deleted orders
    if (newOrders > 0 || deletedOrders > 0) {
      return true;
    }

    // Update if more than 5% of orders changed or more than 10 orders changed
    const changeRatio = updatedOrders / totalOrders;
    if (changeRatio > 0.05 || updatedOrders > 10) {
      return true;
    }

    return false;
  }

  // Save vector update timestamp
  private async saveVectorUpdateTime(): Promise<void> {
    const vectorUpdateData = {
      lastVectorUpdate: new Date().toISOString(),
      updatedBy: "auto-updater",
    };

    fs.writeFileSync(
      this.vectorUpdatePath,
      JSON.stringify(vectorUpdateData, null, 2),
      "utf8"
    );
  }

  // Get last vector update time
  private async getLastVectorUpdateTime(): Promise<Date> {
    try {
      if (fs.existsSync(this.vectorUpdatePath)) {
        const data = JSON.parse(fs.readFileSync(this.vectorUpdatePath, "utf8"));
        return new Date(data.lastVectorUpdate);
      }
    } catch (error) {
      console.warn("Could not read last vector update time:", error);
    }
    return new Date(0); // Return epoch if no record found
  }

  // Smart data merging with change detection
  private async mergeData(
    currentOrders: Order[],
    freshOrders: Order[]
  ): Promise<UpdateStats> {
    const stats: UpdateStats = {
      totalOrders: freshOrders.length,
      newOrders: 0,
      updatedOrders: 0,
      deletedOrders: 0,
      unchangedOrders: 0,
      lastUpdate: new Date().toISOString(),
      updateDuration: 0,
      vectorUpdateTriggered: false,
      vectorUpdateStatus: "pending",
      hybridDataUsed: false,
      apiOrdersCount: 0,
      scrapedOrdersCount: 0,
      hybridOrdersCount: 0,
    };

    const currentOrderMap = new Map(
      currentOrders.map((order) => [order.jobNumber, order])
    );
    const freshOrderMap = new Map(
      freshOrders.map((order) => [order.jobNumber, order])
    );

    // Find new orders
    for (const [jobNumber] of freshOrderMap) {
      if (!currentOrderMap.has(jobNumber)) {
        stats.newOrders++;
        console.log(`🆕 New order detected: Job ${jobNumber}`);
      }
    }

    // Find updated orders
    for (const [jobNumber, freshOrder] of freshOrderMap) {
      const currentOrder = currentOrderMap.get(jobNumber);
      if (
        currentOrder &&
        this.hasSignificantChanges(currentOrder, freshOrder)
      ) {
        stats.updatedOrders++;
        console.log(`🔄 Order updated: Job ${jobNumber}`);
      } else if (currentOrder) {
        stats.unchangedOrders++;
      }
    }

    // Find deleted orders (orders that exist in current but not in fresh)
    for (const [jobNumber] of currentOrderMap) {
      if (!freshOrderMap.has(jobNumber)) {
        stats.deletedOrders++;
        console.log(`🗑️ Order deleted: Job ${jobNumber}`);
      }
    }

    return stats;
  }

  // Detect significant changes in order data
  private hasSignificantChanges(current: Order, fresh: Order): boolean {
    const significantFields = [
      "status",
      "priority",
      "requestedShipDate",
      "pricing.totalDue",
      "customer.contactPerson",
      "customer.phone",
      "customer.email",
    ];

    for (const field of significantFields) {
      const currentValue = this.getNestedValue(current, field);
      const freshValue = this.getNestedValue(fresh, field);

      if (currentValue !== freshValue) {
        return true;
      }
    }

    return false;
  }

  // Get nested property value using dot notation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getNestedValue(obj: Order, path: string): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return path.split(".").reduce((curr: any, key) => curr?.[key], obj);
  }

  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Monday-Friday (1-5), 8 AM to 6 PM
    return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
  }

  async assessDataHealth(): Promise<DataHealth> {
    try {
      const data = await this.loadCurrentData();
      const orders = data.orders || [];

      const lastUpdate = await this.getLastUpdateTime();
      const lastVectorUpdate = await this.getLastVectorUpdateTime();
      const now = new Date();

      const dataAge = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);
      const vectorDataAge =
        (now.getTime() - lastVectorUpdate.getTime()) / (1000 * 60 * 60);

      const dataQuality = {
        missingCustomerInfo: 0,
        missingPricing: 0,
        missingShipDates: 0,
        incompleteLineItems: 0,
      };

      let completeOrders = 0;

      for (const order of orders) {
        let isComplete = true;

        // Check customer info
        if (
          !order.customer?.contactPerson ||
          !order.customer?.phone ||
          !order.customer?.email
        ) {
          dataQuality.missingCustomerInfo++;
          isComplete = false;
        }

        // Check pricing
        if (!order.pricing?.totalDue || order.pricing.totalDue === 0) {
          dataQuality.missingPricing++;
          isComplete = false;
        }

        // Check ship dates
        if (!order.requestedShipDate) {
          dataQuality.missingShipDates++;
          isComplete = false;
        }

        // Check line items
        if (!order.lineItems || order.lineItems.length === 0) {
          dataQuality.incompleteLineItems++;
          isComplete = false;
        }

        if (isComplete) completeOrders++;
      }

      const completeness =
        orders.length > 0 ? (completeOrders / orders.length) * 100 : 0;

      const recommendations = [];
      const syncRecommendations = [];

      if (dataAge > 24) {
        recommendations.push("Data is over 24 hours old - consider updating");
      }

      if (dataQuality.missingCustomerInfo > orders.length * 0.1) {
        recommendations.push("Many orders missing customer information");
      }

      if (dataQuality.missingPricing > orders.length * 0.05) {
        recommendations.push("Some orders missing pricing information");
      }

      // Vector sync health assessment
      const isInSync = vectorDataAge < dataAge + 1; // Vectors should be within 1 hour of data

      if (!isInSync) {
        syncRecommendations.push("Vector database is behind data updates");
      }

      if (vectorDataAge > 48) {
        syncRecommendations.push("Vector database is very stale (>48h old)");
      }

      // Get hybrid health information
      const hybridSystemStatus = await this.hybridService.getSystemStatus();

      return {
        totalOrders: orders.length,
        dataAge,
        completeness,
        dataQuality,
        recommendations,
        vectorSyncHealth: {
          lastVectorUpdate: lastVectorUpdate.toISOString(),
          vectorDataAge,
          isInSync,
          syncRecommendations,
        },
        hybridHealth: {
          enabled: this.config.useHybridData,
          apiEnabled: hybridSystemStatus.hybrid.enabled,
          apiHealthy: hybridSystemStatus.api.healthy,
          lastApiCheck: hybridSystemStatus.hybrid.lastHealthCheck,
          dataSourceBreakdown: {
            scraped: this.config.useHybridData ? 0 : orders.length, // Will be updated in next update cycle
            api: 0,
            hybrid: 0,
          },
        },
      };
    } catch (error) {
      console.error("Error assessing data health:", error);
      return {
        totalOrders: 0,
        dataAge: 0,
        completeness: 0,
        dataQuality: {
          missingCustomerInfo: 0,
          missingPricing: 0,
          missingShipDates: 0,
          incompleteLineItems: 0,
        },
        recommendations: ["Error assessing data health"],
        vectorSyncHealth: {
          lastVectorUpdate: new Date(0).toISOString(),
          vectorDataAge: 0,
          isInSync: false,
          syncRecommendations: ["Unable to assess vector sync health"],
        },
        hybridHealth: {
          enabled: false,
          apiEnabled: false,
          apiHealthy: false,
          lastApiCheck: 0,
          dataSourceBreakdown: {
            scraped: 0,
            api: 0,
            hybrid: 0,
          },
        },
      };
    }
  }

  // Backup and restore functions
  private async createBackup(): Promise<void> {
    if (fs.existsSync(this.dataPath)) {
      fs.copyFileSync(this.dataPath, this.backupPath);
    }
  }

  private async restoreFromBackup(): Promise<void> {
    if (fs.existsSync(this.backupPath)) {
      fs.copyFileSync(this.backupPath, this.dataPath);
      console.log("🔄 Restored data from backup");
    }
  }

  // Data loading and saving
  private async loadCurrentData(): Promise<OrdersData> {
    if (fs.existsSync(this.dataPath)) {
      const data = fs.readFileSync(this.dataPath, "utf8");
      return JSON.parse(data);
    }
    return {
      orders: [],
      summary: { totalOrders: 0, lastUpdated: "", scrapedAt: "" },
    };
  }

  private async saveData(data: OrdersData): Promise<void> {
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), "utf8");
  }

  private async getLastUpdateTime(): Promise<Date> {
    try {
      if (fs.existsSync(this.lastUpdatePath)) {
        const data = JSON.parse(fs.readFileSync(this.lastUpdatePath, "utf8"));
        return new Date(data.lastUpdate);
      }
    } catch (error) {
      console.warn("Could not read last update time:", error);
    }
    return new Date(0);
  }

  private async saveLastUpdateTime(): Promise<void> {
    const updateData = {
      lastUpdate: new Date().toISOString(),
    };
    fs.writeFileSync(
      this.lastUpdatePath,
      JSON.stringify(updateData, null, 2),
      "utf8"
    );
  }

  private async saveUpdateStats(stats: UpdateStats): Promise<void> {
    fs.writeFileSync(
      this.updateStatsPath,
      JSON.stringify(stats, null, 2),
      "utf8"
    );
  }

  // Get update statistics
  async getUpdateStats(): Promise<UpdateStats | null> {
    try {
      if (fs.existsSync(this.updateStatsPath)) {
        const data = fs.readFileSync(this.updateStatsPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading update stats:", error);
    }
    return null;
  }

  // Get emoji for log events
  private getEventEmoji(event: "start" | "success" | "error" | "skip"): string {
    const emojiMap = {
      start: "🚀",
      success: "✅",
      error: "❌",
      skip: "⏭️",
    };
    return emojiMap[event];
  }
}

// Create and export singleton instance
export const dataUpdater = new DataUpdater();
export { DataUpdater };
export type { UpdateStats, DataHealth };

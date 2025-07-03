#!/usr/bin/env node
// API Data Updater - Replaces scraping-based auto-updater with API-first approach
// Manages data updates, health checks, and maintenance for the enhanced API system

import { enhancedAPIClient } from "../src/lib/enhanced-api-client.js";
import { apiFirstDataService } from "../src/lib/api-first-data-service.js";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const LOGS_DIR = path.join(process.cwd(), "logs");

// Ensure directories exist
[DATA_DIR, LOGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class APIDataUpdater {
  constructor() {
    this.logFile = path.join(LOGS_DIR, "api-data-updater.log");
    this.statsFile = path.join(DATA_DIR, "api-update-stats.json");
  }

  log(message, level = "INFO") {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}`;
    console.log(logEntry);

    try {
      fs.appendFileSync(this.logFile, logEntry + "\n");
    } catch (error) {
      console.error("Failed to write to log file:", error);
    }
  }

  async saveStats(stats) {
    try {
      fs.writeFileSync(this.statsFile, JSON.stringify(stats, null, 2));
      this.log(
        `Saved update statistics: ${stats.totalOrders} orders processed`
      );
    } catch (error) {
      this.log(`Failed to save statistics: ${error.message}`, "ERROR");
    }
  }

  async loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`Failed to load statistics: ${error.message}`, "WARN");
    }
    return null;
  }

  // Update data from API
  async updateData() {
    this.log("🚀 Starting API data update...");

    try {
      const startTime = Date.now();

      // Check API health first
      const health = await this.checkAPIHealth();
      if (!health.healthy) {
        throw new Error(
          `API health check failed: ${JSON.stringify(health.endpoints)}`
        );
      }

      this.log("✅ API health check passed");

      // Fetch comprehensive order data
      this.log("📊 Fetching order data from API...");

      const ordersData = await apiFirstDataService.getAllOrders({
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
        pageSize: 500,
      });

      if (ordersData.summary.apiHealth === "offline") {
        throw new Error("API is offline - cannot fetch order data");
      }

      // Generate summary statistics
      this.log("📈 Calculating summary statistics...");
      const summaryStats = await apiFirstDataService.getSummaryStats();

      // Prepare update statistics
      const updateStats = {
        timestamp: new Date().toISOString(),
        success: true,
        totalOrders: ordersData.orders.length,
        totalResults: ordersData.summary.totalResults,
        currentPage: ordersData.summary.currentPage,
        totalPages: ordersData.summary.totalPages,
        apiHealth: ordersData.summary.apiHealth,
        processingTime: Date.now() - startTime,
        dataFreshness: "fresh",
        summary: summaryStats,
        healthCheck: health,
      };

      // Save statistics
      await this.saveStats(updateStats);

      // Save backup of orders data (for debugging/analytics)
      const backupFile = path.join(
        DATA_DIR,
        `orders-backup-${Date.now()}.json`
      );
      try {
        fs.writeFileSync(
          backupFile,
          JSON.stringify(
            {
              orders: ordersData.orders.slice(0, 100), // Save sample for debugging
              summary: ordersData.summary,
              generatedAt: new Date().toISOString(),
            },
            null,
            2
          )
        );
        this.log(`Saved data backup to: ${backupFile}`);
      } catch (error) {
        this.log(`Failed to save backup: ${error.message}`, "WARN");
      }

      this.log(`✅ Data update completed successfully!`);
      this.log(
        `📊 Processed ${ordersData.orders.length} orders in ${updateStats.processingTime}ms`
      );
      this.log(
        `💰 Total order value: $${summaryStats.totalValue.toLocaleString()}`
      );
      this.log(`🏃 Rush orders: ${summaryStats.urgentOrders}`);
      this.log(`⏰ Late orders: ${summaryStats.lateOrders}`);

      return updateStats;
    } catch (error) {
      this.log(`❌ Data update failed: ${error.message}`, "ERROR");

      const errorStats = {
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime,
      };

      await this.saveStats(errorStats);
      throw error;
    }
  }

  // Check API and system health
  async checkAPIHealth() {
    this.log("🏥 Performing API health check...");

    try {
      const health = await apiFirstDataService.healthCheck();

      this.log(`API Health: ${health.healthy ? "✅ Healthy" : "❌ Unhealthy"}`);

      if (health.apiEndpoints) {
        Object.entries(health.apiEndpoints).forEach(([endpoint, status]) => {
          this.log(`  ${endpoint}: ${status ? "✅" : "❌"}`);
        });
      }

      if (health.cache) {
        this.log(`Cache: ${health.cache.size} entries`);
      }

      if (health.rateLimit) {
        this.log(
          `Rate Limit: ${health.rateLimit.tokensRemaining} tokens remaining`
        );
      }

      if (health.connections) {
        this.log(
          `Connections: ${health.connections.active} active, ${health.connections.queued} queued`
        );
      }

      return health;
    } catch (error) {
      this.log(`❌ Health check failed: ${error.message}`, "ERROR");
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  // Perform system maintenance
  async performMaintenance() {
    this.log("🔧 Performing system maintenance...");

    try {
      // Clear old log files (keep last 7 days)
      const logFiles = fs
        .readdirSync(LOGS_DIR)
        .filter((f) => f.endsWith(".log"));
      const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000;

      for (const logFile of logFiles) {
        const filePath = path.join(LOGS_DIR, logFile);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          this.log(`Removed old log file: ${logFile}`);
        }
      }

      // Clear old backup files (keep last 30 days)
      const dataFiles = fs
        .readdirSync(DATA_DIR)
        .filter((f) => f.startsWith("orders-backup-"));
      const backupCutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

      for (const dataFile of dataFiles) {
        const filePath = path.join(DATA_DIR, dataFile);
        const stats = fs.statSync(filePath);

        if (stats.mtime.getTime() < backupCutoffTime) {
          fs.unlinkSync(filePath);
          this.log(`Removed old backup file: ${dataFile}`);
        }
      }

      // Clear API cache
      enhancedAPIClient.clearCache();
      this.log("Cleared API cache");

      // Warm up API cache
      await enhancedAPIClient.warmupCache();
      this.log("Warmed up API cache");

      this.log("✅ Maintenance completed successfully");
    } catch (error) {
      this.log(`❌ Maintenance failed: ${error.message}`, "ERROR");
      throw error;
    }
  }

  // Get current data status
  async getDataStatus() {
    try {
      const stats = await this.loadStats();
      const health = await this.checkAPIHealth();

      const status = {
        lastUpdate: stats?.timestamp || "Never",
        lastUpdateSuccess: stats?.success || false,
        totalOrders: stats?.totalOrders || 0,
        apiHealth: health.healthy ? "Healthy" : "Unhealthy",
        dataFreshness: this.calculateDataFreshness(stats?.timestamp),
        cacheSize: health.cache?.size || 0,
        rateLimitTokens: health.rateLimit?.tokensRemaining || 0,
        errors: stats?.error ? [stats.error] : [],
      };

      return status;
    } catch (error) {
      this.log(`❌ Failed to get data status: ${error.message}`, "ERROR");
      return {
        lastUpdate: "Error",
        lastUpdateSuccess: false,
        apiHealth: "Error",
        error: error.message,
      };
    }
  }

  calculateDataFreshness(lastUpdate) {
    if (!lastUpdate) return "never";

    const hoursSinceUpdate =
      (Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60);

    if (hoursSinceUpdate < 1) return "fresh";
    if (hoursSinceUpdate < 6) return "recent";
    if (hoursSinceUpdate < 24) return "stale";
    return "very-stale";
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || "help";
  const updater = new APIDataUpdater();

  try {
    switch (command) {
      case "update":
        await updater.updateData();
        break;

      case "check":
        const health = await updater.checkAPIHealth();
        console.log("\n📊 API Health Status:");
        console.log(JSON.stringify(health, null, 2));
        break;

      case "health":
        const status = await updater.getDataStatus();
        console.log("\n📈 Data Status:");
        console.log(JSON.stringify(status, null, 2));
        break;

      case "maintenance":
        await updater.performMaintenance();
        break;

      case "stats":
        const stats = await updater.loadStats();
        if (stats) {
          console.log("\n📊 Latest Update Statistics:");
          console.log(JSON.stringify(stats, null, 2));
        } else {
          console.log("No statistics available");
        }
        break;

      case "help":
      default:
        console.log(`
🔧 API Data Updater Commands:

  update      - Fetch latest data from API and update statistics
  check       - Check API health and connectivity
  health      - Show current data status and freshness
  maintenance - Perform system maintenance (cleanup, cache management)
  stats       - Show latest update statistics
  help        - Show this help message

Examples:
  npm run update-data     # Update data
  npm run check-data      # Check health
  npm run data-health     # Show status
        `);
        break;
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Command failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { APIDataUpdater };

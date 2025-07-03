#!/usr/bin/env node
// Real-time Vector Updater - Continuous vector synchronization with API data
// Provides automatic incremental updates and health monitoring for the vector pipeline

import { enhancedVectorPipeline } from "../src/lib/enhanced-vector-pipeline.ts";
import { apiFirstDataService } from "../src/lib/api-first-data-service.ts";
import fs from "fs";
import path from "path";

const LOGS_DIR = path.join(process.cwd(), "logs");
const DATA_DIR = path.join(process.cwd(), "data");

// Ensure directories exist
[LOGS_DIR, DATA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

class RealtimeVectorUpdater {
  constructor() {
    this.logFile = path.join(LOGS_DIR, "realtime-vector-updates.log");
    this.statsFile = path.join(DATA_DIR, "realtime-vector-stats.json");
    this.isRunning = false;
    this.interval = null;
    this.updateStats = {
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      totalVectorsProcessed: 0,
      averageUpdateTime: 0,
      lastSuccessfulUpdate: null,
      lastFailedUpdate: null,
      startTime: new Date().toISOString(),
    };
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

  async saveStats() {
    try {
      fs.writeFileSync(
        this.statsFile,
        JSON.stringify(this.updateStats, null, 2)
      );
    } catch (error) {
      this.log(`Failed to save stats: ${error.message}`, "ERROR");
    }
  }

  async loadStats() {
    try {
      if (fs.existsSync(this.statsFile)) {
        const data = fs.readFileSync(this.statsFile, "utf8");
        this.updateStats = { ...this.updateStats, ...JSON.parse(data) };
      }
    } catch (error) {
      this.log(`Failed to load stats: ${error.message}`, "WARN");
    }
  }

  // Perform a single real-time update
  async performUpdate() {
    const updateId = `update_${Date.now()}`;
    this.log(`🔄 Starting real-time update: ${updateId}`);

    try {
      const startTime = Date.now();

      // Check API health first
      const apiHealth = await apiFirstDataService.healthCheck();
      if (!apiHealth.healthy) {
        throw new Error(`API health check failed: ${apiHealth.error}`);
      }

      // Perform the vector update
      const updateResult = await enhancedVectorPipeline.performRealtimeUpdate();

      const updateTime = Date.now() - startTime;

      // Update statistics
      this.updateStats.totalUpdates++;
      this.updateStats.successfulUpdates++;
      this.updateStats.totalVectorsProcessed += updateResult.totalProcessed;
      this.updateStats.averageUpdateTime =
        (this.updateStats.averageUpdateTime *
          (this.updateStats.successfulUpdates - 1) +
          updateTime) /
        this.updateStats.successfulUpdates;
      this.updateStats.lastSuccessfulUpdate = new Date().toISOString();

      // Log detailed results
      this.log(
        `✅ Update ${updateId} completed successfully in ${updateTime}ms`
      );
      this.log(
        `📊 Results: +${updateResult.newVectors} new, ~${updateResult.updatedVectors} updated, -${updateResult.deletedVectors} deleted`
      );
      this.log(
        `⚡ Performance: ${updateResult.performance.throughputPerSecond.toFixed(
          2
        )} orders/sec`
      );

      if (updateResult.errors.length > 0) {
        this.log(`⚠️ Warnings: ${updateResult.errors.join(", ")}`, "WARN");
      }

      await this.saveStats();
      return updateResult;
    } catch (error) {
      this.updateStats.totalUpdates++;
      this.updateStats.failedUpdates++;
      this.updateStats.lastFailedUpdate = new Date().toISOString();

      this.log(`❌ Update ${updateId} failed: ${error.message}`, "ERROR");
      await this.saveStats();
      throw error;
    }
  }

  // Start continuous updates
  async startContinuousUpdates(intervalMinutes = 15) {
    if (this.isRunning) {
      this.log("⚠️ Real-time updater is already running", "WARN");
      return;
    }

    this.log(
      `🚀 Starting continuous vector updates (every ${intervalMinutes} minutes)...`
    );

    // Load existing stats
    await this.loadStats();

    this.isRunning = true;

    // Perform initial update
    try {
      await this.performUpdate();
    } catch (error) {
      this.log(`Initial update failed: ${error.message}`, "ERROR");
    }

    // Schedule recurring updates
    this.interval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.performUpdate();
      } catch (error) {
        this.log(`Scheduled update failed: ${error.message}`, "ERROR");

        // If we have too many consecutive failures, consider stopping
        if (
          this.updateStats.failedUpdates > 10 &&
          this.updateStats.successfulUpdates === 0
        ) {
          this.log(
            "🛑 Too many consecutive failures, stopping continuous updates",
            "ERROR"
          );
          this.stopContinuousUpdates();
        }
      }
    }, intervalMinutes * 60 * 1000);

    // Graceful shutdown handlers
    process.on("SIGINT", () => {
      this.log("🛑 Received SIGINT, stopping continuous updates...");
      this.stopContinuousUpdates();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      this.log("🛑 Received SIGTERM, stopping continuous updates...");
      this.stopContinuousUpdates();
      process.exit(0);
    });

    this.log(`✅ Continuous updates started. Use Ctrl+C to stop.`);
  }

  // Stop continuous updates
  stopContinuousUpdates() {
    if (!this.isRunning) {
      this.log("⚠️ Real-time updater is not running", "WARN");
      return;
    }

    this.log("🛑 Stopping continuous updates...");

    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.log("✅ Continuous updates stopped");
  }

  // Perform a full rebuild of vectors
  async performFullRebuild() {
    this.log("🔄 Starting full vector rebuild...");

    try {
      const startTime = Date.now();
      const result = await enhancedVectorPipeline.performFullRebuild();
      const rebuildTime = Date.now() - startTime;

      this.log(`✅ Full rebuild completed in ${rebuildTime}ms`);
      this.log(
        `📊 Created ${result.newVectors} vectors from ${result.totalProcessed} orders`
      );
      this.log(
        `⚡ Performance: ${result.performance.throughputPerSecond.toFixed(
          2
        )} orders/sec`
      );

      // Reset stats for fresh tracking
      this.updateStats = {
        totalUpdates: 1,
        successfulUpdates: 1,
        failedUpdates: 0,
        totalVectorsProcessed: result.totalProcessed,
        averageUpdateTime: rebuildTime,
        lastSuccessfulUpdate: new Date().toISOString(),
        lastFailedUpdate: null,
        startTime: new Date().toISOString(),
      };

      await this.saveStats();
      return result;
    } catch (error) {
      this.log(`❌ Full rebuild failed: ${error.message}`, "ERROR");
      throw error;
    }
  }

  // Check system health
  async checkHealth() {
    this.log("🏥 Performing health check...");

    try {
      const [apiHealth, vectorHealth] = await Promise.all([
        apiFirstDataService.healthCheck(),
        enhancedVectorPipeline.healthCheck(),
      ]);

      const overallHealth = {
        healthy: apiHealth.healthy && vectorHealth.healthy,
        api: apiHealth,
        vectors: vectorHealth,
        updater: {
          isRunning: this.isRunning,
          stats: this.updateStats,
          successRate:
            this.updateStats.totalUpdates > 0
              ? (this.updateStats.successfulUpdates /
                  this.updateStats.totalUpdates) *
                100
              : 0,
        },
        lastCheck: new Date().toISOString(),
      };

      this.log(
        `Health Status: ${
          overallHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"
        }`
      );
      this.log(
        `API: ${apiHealth.healthy ? "✅" : "❌"}, Vectors: ${
          vectorHealth.healthy ? "✅" : "❌"
        }`
      );
      this.log(
        `Updater Success Rate: ${overallHealth.updater.successRate.toFixed(1)}%`
      );

      return overallHealth;
    } catch (error) {
      this.log(`❌ Health check failed: ${error.message}`, "ERROR");
      return {
        healthy: false,
        error: error.message,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  // Get current status and statistics
  async getStatus() {
    await this.loadStats();

    const uptime = Date.now() - new Date(this.updateStats.startTime).getTime();
    const uptimeHours = uptime / (1000 * 60 * 60);

    return {
      running: this.isRunning,
      uptime: {
        milliseconds: uptime,
        hours: uptimeHours.toFixed(2),
        formatted: this.formatUptime(uptime),
      },
      statistics: {
        ...this.updateStats,
        successRate:
          this.updateStats.totalUpdates > 0
            ? (this.updateStats.successfulUpdates /
                this.updateStats.totalUpdates) *
              100
            : 0,
        averageVectorsPerUpdate:
          this.updateStats.successfulUpdates > 0
            ? this.updateStats.totalVectorsProcessed /
              this.updateStats.successfulUpdates
            : 0,
      },
      vectorPipeline: await enhancedVectorPipeline.getUpdateHistory(),
      lastCheck: new Date().toISOString(),
    };
  }

  // Format uptime in human-readable format
  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Performance monitoring and alerts
  async monitorPerformance() {
    const status = await this.getStatus();
    const health = await this.checkHealth();

    // Performance alerts
    const alerts = [];

    if (status.statistics.successRate < 80) {
      alerts.push({
        level: "warning",
        message: `Low success rate: ${status.statistics.successRate.toFixed(
          1
        )}%`,
      });
    }

    if (status.statistics.averageUpdateTime > 60000) {
      // > 1 minute
      alerts.push({
        level: "warning",
        message: `Slow updates: ${(
          status.statistics.averageUpdateTime / 1000
        ).toFixed(1)}s average`,
      });
    }

    if (!health.healthy) {
      alerts.push({
        level: "critical",
        message: "System health check failed",
      });
    }

    if (alerts.length > 0) {
      this.log("🚨 Performance alerts:", "WARN");
      alerts.forEach((alert) => {
        this.log(
          `  ${alert.level.toUpperCase()}: ${alert.message}`,
          alert.level.toUpperCase()
        );
      });
    } else {
      this.log("✅ Performance monitoring: All systems normal");
    }

    return {
      healthy: alerts.length === 0,
      alerts,
      performance: status.statistics,
      systemHealth: health,
    };
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || "help";
  const updater = new RealtimeVectorUpdater();

  try {
    switch (command) {
      case "start":
        const interval = parseInt(process.argv[3]) || 15;
        await updater.startContinuousUpdates(interval);
        break;

      case "update":
        const result = await updater.performUpdate();
        console.log("\n📊 Update Results:");
        console.log(JSON.stringify(result, null, 2));
        break;

      case "rebuild":
        const rebuildResult = await updater.performFullRebuild();
        console.log("\n🔧 Rebuild Results:");
        console.log(JSON.stringify(rebuildResult, null, 2));
        break;

      case "health":
        const health = await updater.checkHealth();
        console.log("\n🏥 Health Status:");
        console.log(JSON.stringify(health, null, 2));
        break;

      case "status":
        const status = await updater.getStatus();
        console.log("\n📈 Updater Status:");
        console.log(JSON.stringify(status, null, 2));
        break;

      case "monitor":
        const monitoring = await updater.monitorPerformance();
        console.log("\n📊 Performance Monitoring:");
        console.log(JSON.stringify(monitoring, null, 2));
        break;

      case "help":
      default:
        console.log(`
🔄 Real-time Vector Updater Commands:

  start [interval]  - Start continuous updates (default: 15 minutes)
  update           - Perform single real-time update
  rebuild          - Perform full vector rebuild
  health           - Check system health
  status           - Show updater status and statistics
  monitor          - Run performance monitoring and alerts
  help             - Show this help message

Examples:
  npm run update-vectors start 10  # Update every 10 minutes
  npm run update-vectors update    # Single update
  npm run update-vectors health    # Health check
        `);
        break;
    }

    if (command !== "start") {
      process.exit(0);
    }
  } catch (error) {
    console.error("\n❌ Command failed:", error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { RealtimeVectorUpdater };

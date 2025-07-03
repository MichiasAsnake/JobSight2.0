#!/usr/bin/env node
// API Health Check - Continuous monitoring and alerting for API endpoints
// Provides detailed health monitoring, performance metrics, and alerting capabilities

import { enhancedAPIClient } from "../src/lib/enhanced-api-client.js";
import { apiFirstDataService } from "../src/lib/api-first-data-service.js";
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

class APIHealthMonitor {
  constructor() {
    this.healthLogFile = path.join(LOGS_DIR, "api-health.log");
    this.metricsFile = path.join(DATA_DIR, "api-metrics.json");
    this.alertsFile = path.join(DATA_DIR, "api-alerts.json");
  }

  log(message, level = "INFO") {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} [${level}] ${message}`;
    console.log(logEntry);

    try {
      fs.appendFileSync(this.healthLogFile, logEntry + "\n");
    } catch (error) {
      console.error("Failed to write to health log:", error);
    }
  }

  async saveMetrics(metrics) {
    try {
      fs.writeFileSync(this.metricsFile, JSON.stringify(metrics, null, 2));
    } catch (error) {
      this.log(`Failed to save metrics: ${error.message}`, "ERROR");
    }
  }

  async loadMetrics() {
    try {
      if (fs.existsSync(this.metricsFile)) {
        const data = fs.readFileSync(this.metricsFile, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      this.log(`Failed to load metrics: ${error.message}`, "WARN");
    }
    return { checks: [], summary: {} };
  }

  async saveAlert(alert) {
    try {
      let alerts = [];
      if (fs.existsSync(this.alertsFile)) {
        const data = fs.readFileSync(this.alertsFile, "utf8");
        alerts = JSON.parse(data);
      }

      alerts.push({
        ...alert,
        timestamp: new Date().toISOString(),
        id: `alert_${Date.now()}`,
      });

      // Keep only last 100 alerts
      if (alerts.length > 100) {
        alerts = alerts.slice(-100);
      }

      fs.writeFileSync(this.alertsFile, JSON.stringify(alerts, null, 2));
      this.log(`ALERT: ${alert.message}`, "ALERT");
    } catch (error) {
      this.log(`Failed to save alert: ${error.message}`, "ERROR");
    }
  }

  // Comprehensive health check with performance metrics
  async comprehensiveHealthCheck() {
    this.log("🏥 Starting comprehensive API health check...");

    const startTime = Date.now();
    const healthData = {
      timestamp: new Date().toISOString(),
      overall: { healthy: true, score: 100 },
      endpoints: {},
      performance: {},
      cache: {},
      rateLimit: {},
      connections: {},
      dataQuality: {},
      alerts: [],
    };

    try {
      // 1. Basic API client health
      const basicHealth = await enhancedAPIClient.getHealthStatus();
      healthData.cache = basicHealth.cache;
      healthData.rateLimit = basicHealth.rateLimit;
      healthData.connections = basicHealth.connections;

      this.log(`Cache: ${basicHealth.cache.size} entries`);
      this.log(
        `Rate Limit: ${basicHealth.rateLimit.tokensRemaining} tokens remaining`
      );
      this.log(
        `Connections: ${basicHealth.connections.active} active, ${basicHealth.connections.queued} queued`
      );

      // 2. Endpoint-specific health checks with performance timing
      const endpoints = [
        {
          name: "job-list",
          test: () => enhancedAPIClient.getJobList({ "page-size": "10" }),
        },
        {
          name: "category-units",
          test: () => enhancedAPIClient.getAllCategoryUnits(),
        },
      ];

      for (const endpoint of endpoints) {
        const endpointStartTime = Date.now();
        try {
          const response = await endpoint.test();
          const responseTime = Date.now() - endpointStartTime;

          healthData.endpoints[endpoint.name] = {
            status: "healthy",
            responseTime,
            success: response.isSuccess || false,
            lastCheck: new Date().toISOString(),
          };

          this.log(`✅ ${endpoint.name}: ${responseTime}ms`);

          // Performance alerts
          if (responseTime > 5000) {
            await this.saveAlert({
              type: "performance",
              severity: "warning",
              endpoint: endpoint.name,
              message: `Slow response time: ${responseTime}ms`,
              responseTime,
            });
            healthData.overall.score -= 10;
          }
        } catch (error) {
          healthData.endpoints[endpoint.name] = {
            status: "error",
            error: error.message,
            lastCheck: new Date().toISOString(),
          };

          this.log(`❌ ${endpoint.name}: ${error.message}`, "ERROR");

          await this.saveAlert({
            type: "endpoint-failure",
            severity: "critical",
            endpoint: endpoint.name,
            message: `Endpoint failed: ${error.message}`,
          });

          healthData.overall.healthy = false;
          healthData.overall.score -= 25;
        }
      }

      // 3. Data quality checks
      try {
        this.log("📊 Checking data quality...");
        const ordersData = await apiFirstDataService.getAllOrders({
          pageSize: 50,
        });

        healthData.dataQuality = {
          totalOrders: ordersData.orders.length,
          dataFreshness: ordersData.summary.lastUpdated,
          apiHealth: ordersData.summary.apiHealth,
          completenessScore: this.calculateDataCompleteness(ordersData.orders),
          lastCheck: new Date().toISOString(),
        };

        this.log(
          `📈 Data Quality: ${healthData.dataQuality.completenessScore}% complete`
        );

        if (healthData.dataQuality.completenessScore < 80) {
          await this.saveAlert({
            type: "data-quality",
            severity: "warning",
            message: `Low data completeness: ${healthData.dataQuality.completenessScore}%`,
          });
          healthData.overall.score -= 15;
        }
      } catch (error) {
        this.log(`❌ Data quality check failed: ${error.message}`, "ERROR");
        healthData.dataQuality = { error: error.message };
        healthData.overall.score -= 20;
      }

      // 4. System resource checks
      const totalCheckTime = Date.now() - startTime;
      healthData.performance = {
        totalCheckTime,
        averageResponseTime: Object.values(healthData.endpoints)
          .filter((e) => e.responseTime)
          .reduce((avg, e, _, arr) => avg + e.responseTime / arr.length, 0),
        cacheHitRate: basicHealth.cache.hitRate || 0,
        systemLoad: process.memoryUsage(),
      };

      // Overall health calculation
      if (healthData.overall.score < 70) {
        healthData.overall.healthy = false;
      }

      // 5. Save metrics
      const metrics = await this.loadMetrics();
      metrics.checks.push(healthData);

      // Keep only last 100 checks
      if (metrics.checks.length > 100) {
        metrics.checks = metrics.checks.slice(-100);
      }

      // Update summary
      metrics.summary = {
        lastCheck: healthData.timestamp,
        overallHealth: healthData.overall.healthy,
        healthScore: healthData.overall.score,
        averageResponseTime: healthData.performance.averageResponseTime,
        uptime: this.calculateUptime(metrics.checks),
        totalChecks: metrics.checks.length,
      };

      await this.saveMetrics(metrics);

      this.log(`✅ Health check completed in ${totalCheckTime}ms`);
      this.log(`📊 Overall Health Score: ${healthData.overall.score}/100`);

      return healthData;
    } catch (error) {
      this.log(`❌ Health check failed: ${error.message}`, "ERROR");

      healthData.overall.healthy = false;
      healthData.overall.score = 0;
      healthData.error = error.message;

      await this.saveAlert({
        type: "system-failure",
        severity: "critical",
        message: `Health check system failure: ${error.message}`,
      });

      return healthData;
    }
  }

  calculateDataCompleteness(orders) {
    if (orders.length === 0) return 0;

    let totalFields = 0;
    let completedFields = 0;

    const requiredFields = [
      "jobNumber",
      "orderNumber",
      "description",
      "customer.company",
      "status.master",
      "dates.dateEntered",
      "dates.dateDue",
    ];

    orders.forEach((order) => {
      requiredFields.forEach((field) => {
        totalFields++;
        const value = field.split(".").reduce((obj, key) => obj?.[key], order);
        if (value && value !== "" && value !== null && value !== undefined) {
          completedFields++;
        }
      });
    });

    return Math.round((completedFields / totalFields) * 100);
  }

  calculateUptime(checks) {
    if (checks.length < 2) return 100;

    const healthyChecks = checks.filter(
      (check) => check.overall.healthy
    ).length;
    return Math.round((healthyChecks / checks.length) * 100);
  }

  // Quick health check for frequent monitoring
  async quickHealthCheck() {
    try {
      const startTime = Date.now();
      const response = await enhancedAPIClient.getJobList({ "page-size": "1" });
      const responseTime = Date.now() - startTime;

      const isHealthy = response.isSuccess && responseTime < 3000;

      return {
        healthy: isHealthy,
        responseTime,
        timestamp: new Date().toISOString(),
        success: response.isSuccess,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Continuous monitoring mode
  async startContinuousMonitoring(intervalMinutes = 5) {
    this.log(
      `🔄 Starting continuous monitoring (every ${intervalMinutes} minutes)...`
    );

    const runCheck = async () => {
      try {
        const health = await this.quickHealthCheck();

        if (!health.healthy) {
          await this.saveAlert({
            type: "monitoring",
            severity: "warning",
            message: `API unhealthy: ${health.error || "slow response"}`,
            responseTime: health.responseTime,
          });
        }

        this.log(
          `Health: ${health.healthy ? "✅" : "❌"} (${health.responseTime}ms)`
        );
      } catch (error) {
        this.log(`Monitoring check failed: ${error.message}`, "ERROR");
      }
    };

    // Run initial check
    await runCheck();

    // Schedule recurring checks
    const interval = setInterval(runCheck, intervalMinutes * 60 * 1000);

    // Graceful shutdown
    process.on("SIGINT", () => {
      this.log("🛑 Stopping continuous monitoring...");
      clearInterval(interval);
      process.exit(0);
    });

    return interval;
  }

  // Load and display recent alerts
  async getRecentAlerts(limit = 10) {
    try {
      if (fs.existsSync(this.alertsFile)) {
        const data = fs.readFileSync(this.alertsFile, "utf8");
        const alerts = JSON.parse(data);
        return alerts.slice(-limit).reverse(); // Most recent first
      }
    } catch (error) {
      this.log(`Failed to load alerts: ${error.message}`, "ERROR");
    }
    return [];
  }

  // Generate health report
  async generateHealthReport() {
    const metrics = await this.loadMetrics();
    const alerts = await this.getRecentAlerts(20);

    return {
      summary: metrics.summary || {},
      recentAlerts: alerts,
      lastChecks: (metrics.checks || []).slice(-10),
      reportGenerated: new Date().toISOString(),
    };
  }
}

// CLI interface
async function main() {
  const command = process.argv[2] || "help";
  const monitor = new APIHealthMonitor();

  try {
    switch (command) {
      case "check":
        const health = await monitor.comprehensiveHealthCheck();
        console.log("\n🏥 API Health Report:");
        console.log(JSON.stringify(health, null, 2));
        break;

      case "quick":
        const quickHealth = await monitor.quickHealthCheck();
        console.log("\n⚡ Quick Health Check:");
        console.log(JSON.stringify(quickHealth, null, 2));
        break;

      case "monitor":
        const interval = parseInt(process.argv[3]) || 5;
        await monitor.startContinuousMonitoring(interval);
        break;

      case "alerts":
        const limit = parseInt(process.argv[3]) || 10;
        const alerts = await monitor.getRecentAlerts(limit);
        console.log(`\n🚨 Recent Alerts (${alerts.length}):`);
        alerts.forEach((alert) => {
          console.log(
            `${alert.timestamp} [${alert.severity.toUpperCase()}] ${
              alert.message
            }`
          );
        });
        break;

      case "report":
        const report = await monitor.generateHealthReport();
        console.log("\n📊 Health Report:");
        console.log(JSON.stringify(report, null, 2));
        break;

      case "help":
      default:
        console.log(`
🏥 API Health Monitor Commands:

  check          - Run comprehensive health check with performance metrics
  quick          - Run quick health check (fast response time test)
  monitor [min]  - Start continuous monitoring (default: 5 minutes)
  alerts [limit] - Show recent alerts (default: 10)
  report         - Generate comprehensive health report
  help           - Show this help message

Examples:
  npm run api-health check     # Full health check
  npm run api-health quick     # Quick check
  npm run api-health monitor 2 # Monitor every 2 minutes
  npm run api-health alerts 20 # Show last 20 alerts
        `);
        break;
    }

    if (command !== "monitor") {
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

export { APIHealthMonitor };

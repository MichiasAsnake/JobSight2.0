#!/usr/bin/env tsx
// Pinecone Performance Monitor
// Tracks performance metrics and success rates for the vector database population

// Load environment variables FIRST, before any other imports
import dotenv from "dotenv";
dotenv.config();

import { PineconePopulationStrategy } from "../src/lib/pinecone-population-strategy";
import { EnhancedQueryService } from "../src/lib/enhanced-query-service";
import { IntelligentQueryRouter } from "../src/lib/query-router";

interface PerformanceMetrics {
  timestamp: string;
  population: {
    totalJobs: number;
    processedJobs: number;
    failedJobs: number;
    successRate: number;
    averageProcessingTime: number;
    lastUpdate: string;
  };
  queries: {
    totalQueries: number;
    apiQueries: number;
    vectorQueries: number;
    hybridQueries: number;
    averageResponseTime: number;
    cacheHitRate: number;
    successRate: number;
  };
  realtimePopulation: {
    jobsAdded: number;
    jobsFailed: number;
    errorRate: number;
    averageProcessingTime: number;
  };
  system: {
    apiHealth: "healthy" | "degraded" | "offline";
    vectorHealth: "healthy" | "degraded" | "offline";
    cacheHealth: "healthy" | "degraded" | "offline";
  };
}

export class PineconePerformanceMonitor {
  private populationStrategy: PineconePopulationStrategy;
  private queryService: EnhancedQueryService;
  private queryRouter: IntelligentQueryRouter;
  private metrics: PerformanceMetrics[] = [];
  private maxMetricsHistory = 1000; // Keep last 1000 data points

  constructor() {
    this.populationStrategy = new PineconePopulationStrategy();
    this.queryService = new EnhancedQueryService();
    this.queryRouter = new IntelligentQueryRouter();
  }

  async initialize(): Promise<void> {
    await this.populationStrategy.initialize();
    await this.queryService.initialize();
    console.log("✅ Performance monitor initialized");
  }

  /**
   * Collect current performance metrics
   */
  async collectMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date().toISOString();

    try {
      // Get population metrics
      const populationStats = await this.populationStrategy.getStats();
      const changeTracker =
        await this.populationStrategy.getChangeTrackerStats();

      // Get query metrics
      const queryStats = this.queryRouter.getPerformanceStats();
      const cacheStats = this.queryRouter.getCacheStats();

      // Get system health
      const populationHealth = await this.populationStrategy.healthCheck();
      const queryServiceStats = await this.queryService.getStats();

      const metrics: PerformanceMetrics = {
        timestamp,
        population: {
          totalJobs: populationStats.totalJobs,
          processedJobs: populationStats.processedJobs,
          failedJobs: populationStats.failedJobs,
          successRate:
            populationStats.totalJobs > 0
              ? ((populationStats.processedJobs - populationStats.failedJobs) /
                  populationStats.totalJobs) *
                100
              : 0,
          averageProcessingTime: populationStats.averageProcessingTime || 0,
          lastUpdate: changeTracker.lastUpdate,
        },
        queries: {
          totalQueries: queryStats.totalQueries,
          apiQueries: queryStats.apiQueries,
          vectorQueries: queryStats.vectorQueries,
          hybridQueries: queryStats.hybridQueries,
          averageResponseTime: queryStats.averageResponseTime,
          cacheHitRate: 0, // Cache hit rate is calculated in performance stats
          successRate: queryStats.successRate,
        },
        realtimePopulation: {
          jobsAdded: 0, // Will be updated from query results
          jobsFailed: 0, // Will be updated from query results
          errorRate: 0,
          averageProcessingTime: 0,
        },
        system: {
          apiHealth: populationHealth.healthy ? "healthy" : "degraded",
          vectorHealth: populationHealth.healthy ? "healthy" : "degraded",
          cacheHealth: "healthy", // Cache health based on query performance stats
        },
      };

      // Store metrics
      this.metrics.push(metrics);

      // Keep only recent metrics
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics = this.metrics.slice(-this.maxMetricsHistory);
      }

      return metrics;
    } catch (error) {
      console.error("❌ Failed to collect metrics:", error);

      // Return error metrics
      return {
        timestamp,
        population: {
          totalJobs: 0,
          processedJobs: 0,
          failedJobs: 0,
          successRate: 0,
          averageProcessingTime: 0,
          lastUpdate: new Date().toISOString(),
        },
        queries: {
          totalQueries: 0,
          apiQueries: 0,
          vectorQueries: 0,
          hybridQueries: 0,
          averageResponseTime: 0,
          cacheHitRate: 0,
          successRate: 0,
        },
        realtimePopulation: {
          jobsAdded: 0,
          jobsFailed: 0,
          errorRate: 100,
          averageProcessingTime: 0,
        },
        system: {
          apiHealth: "offline",
          vectorHealth: "offline",
          cacheHealth: "offline",
        },
      };
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(): Promise<string> {
    const currentMetrics = await this.collectMetrics();

    const report = `
📊 Pinecone Performance Report
Generated: ${new Date().toLocaleString()}

🔧 SYSTEM HEALTH
API Health: ${currentMetrics.system.apiHealth}
Vector Health: ${currentMetrics.system.vectorHealth}
Cache Health: ${currentMetrics.system.cacheHealth}

📦 POPULATION METRICS
Total Jobs: ${currentMetrics.population.totalJobs}
Processed Jobs: ${currentMetrics.population.processedJobs}
Failed Jobs: ${currentMetrics.population.failedJobs}
Success Rate: ${currentMetrics.population.successRate.toFixed(1)}%
Average Processing Time: ${currentMetrics.population.averageProcessingTime.toFixed(
      0
    )}ms
Last Update: ${new Date(currentMetrics.population.lastUpdate).toLocaleString()}

🔍 QUERY METRICS
Total Queries: ${currentMetrics.queries.totalQueries}
API Queries: ${currentMetrics.queries.apiQueries}
Vector Queries: ${currentMetrics.queries.vectorQueries}
Hybrid Queries: ${currentMetrics.queries.hybridQueries}
Average Response Time: ${currentMetrics.queries.averageResponseTime.toFixed(
      0
    )}ms
Cache Hit Rate: ${currentMetrics.queries.cacheHitRate.toFixed(1)}%
Query Success Rate: ${currentMetrics.queries.successRate.toFixed(1)}%

⚡ REALTIME POPULATION
Jobs Added: ${currentMetrics.realtimePopulation.jobsAdded}
Jobs Failed: ${currentMetrics.realtimePopulation.jobsFailed}
Error Rate: ${currentMetrics.realtimePopulation.errorRate.toFixed(1)}%
Average Processing Time: ${currentMetrics.realtimePopulation.averageProcessingTime.toFixed(
      0
    )}ms

${this.generateRecommendations(currentMetrics)}
`;

    return report;
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(metrics: PerformanceMetrics): string {
    const recommendations: string[] = [];

    // Population recommendations
    if (metrics.population.successRate < 95) {
      recommendations.push(
        "⚠️  Population success rate is below 95%. Check for API errors or rate limits."
      );
    }

    if (metrics.population.averageProcessingTime > 5000) {
      recommendations.push(
        "🐌 Population processing is slow. Consider reducing batch size or increasing delays."
      );
    }

    // Query recommendations
    if (metrics.queries.cacheHitRate < 0.5) {
      recommendations.push(
        "💾 Cache hit rate is low. Consider increasing cache TTL or optimizing cache keys."
      );
    }

    if (metrics.queries.averageResponseTime > 2000) {
      recommendations.push(
        "⏱️  Query response time is high. Consider optimizing vector search or reducing result count."
      );
    }

    // System health recommendations
    if (metrics.system.apiHealth !== "healthy") {
      recommendations.push(
        "🔴 API health is degraded. Check API connectivity and authentication."
      );
    }

    if (metrics.system.vectorHealth !== "healthy") {
      recommendations.push(
        "🔴 Vector database health is degraded. Check Pinecone connectivity and index status."
      );
    }

    // Realtime population recommendations
    if (metrics.realtimePopulation.errorRate > 10) {
      recommendations.push(
        "⚠️  High real-time population error rate. Check API rate limits and job data validity."
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("✅ All systems are performing well!");
    }

    return `\n💡 RECOMMENDATIONS\n${recommendations
      .map((rec) => `• ${rec}`)
      .join("\n")}`;
  }

  /**
   * Get historical metrics
   */
  getHistoricalMetrics(hours: number = 24): PerformanceMetrics[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.metrics.filter((m) => new Date(m.timestamp).getTime() > cutoff);
  }

  /**
   * Get performance trends
   */
  getPerformanceTrends(hours: number = 24): {
    populationSuccessRate: number[];
    queryResponseTime: number[];
    cacheHitRate: number[];
    timestamps: string[];
  } {
    const historical = this.getHistoricalMetrics(hours);

    return {
      populationSuccessRate: historical.map((m) => m.population.successRate),
      queryResponseTime: historical.map((m) => m.queries.averageResponseTime),
      cacheHitRate: historical.map((m) => m.queries.cacheHitRate * 100),
      timestamps: historical.map((m) => m.timestamp),
    };
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics: this.metrics,
        summary: {
          totalDataPoints: this.metrics.length,
          dateRange: {
            start: this.metrics[0]?.timestamp,
            end: this.metrics[this.metrics.length - 1]?.timestamp,
          },
        },
      },
      null,
      2
    );
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(days: number = 7): void {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    this.metrics = this.metrics.filter(
      (m) => new Date(m.timestamp).getTime() > cutoff
    );
    console.log(`🧹 Cleared metrics older than ${days} days`);
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "report";

  const monitor = new PineconePerformanceMonitor();
  await monitor.initialize();

  switch (command) {
    case "report":
      const report = await monitor.generateReport();
      console.log(report);
      break;

    case "metrics":
      const metrics = await monitor.collectMetrics();
      console.log(JSON.stringify(metrics, null, 2));
      break;

    case "trends":
      const trends = monitor.getPerformanceTrends(parseInt(args[1]) || 24);
      console.log("📈 Performance Trends:");
      console.log("Population Success Rate:", trends.populationSuccessRate);
      console.log("Query Response Time:", trends.queryResponseTime);
      console.log("Cache Hit Rate:", trends.cacheHitRate);
      break;

    case "export":
      const exported = monitor.exportMetrics();
      console.log(exported);
      break;

    case "clear":
      const days = parseInt(args[1]) || 7;
      monitor.clearOldMetrics(days);
      break;

    default:
      console.log("Available commands: report, metrics, trends, export, clear");
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

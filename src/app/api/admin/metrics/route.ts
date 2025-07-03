// Admin Metrics API - Performance metrics aggregation
import { NextRequest, NextResponse } from "next/server";
import { intelligentQueryRouter } from "@/lib/query-router";
import { advancedCacheService } from "@/lib/advanced-cache-service";
import { enhancedAPIClient } from "@/lib/enhanced-api-client";
import { enhancedVectorPipeline } from "@/lib/enhanced-vector-pipeline";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("📊 Collecting system metrics...");

    // Collect metrics from all components
    const [routerStats, cacheStats, apiStats, vectorStats] =
      await Promise.allSettled([
        intelligentQueryRouter.getPerformanceStats(),
        advancedCacheService.getStats(),
        getAPIMetrics(),
        getVectorMetrics(),
      ]);

    // Process and aggregate metrics
    const metrics = {
      // Query Router Metrics
      totalQueries: extractValue(routerStats, "totalQueries", 0),
      averageResponseTime: extractValue(routerStats, "averageResponseTime", 0),
      successRate: extractValue(routerStats, "successRate", 0),

      // Cache Metrics
      cacheHitRate: extractValue(cacheStats, "hitRate", 0),
      cacheEntries: extractValue(cacheStats, "totalEntries", 0),
      cacheSize: extractValue(cacheStats, "totalSize", 0),

      // API Metrics
      apiCalls: extractValue(apiStats, "totalRequests", 0),
      apiSuccessRate: extractValue(apiStats, "successRate", 0),
      apiAverageTime: extractValue(apiStats, "averageResponseTime", 0),

      // Vector Metrics
      vectorHealth: extractValue(vectorStats, "healthy", false) ? 100 : 0,
      vectorEntries: extractValue(vectorStats, "totalVectors", 0),

      // System Metrics
      activeConnections: getActiveConnections(),
      memoryUsage: getMemoryUsage(),

      // Timestamp
      timestamp: new Date().toISOString(),
      collectionTime: Date.now() - startTime,
    };

    // Add derived metrics
    metrics.overallPerformanceScore = calculatePerformanceScore(metrics);
    metrics.systemLoadIndicator = calculateSystemLoad(metrics);

    console.log(`✅ Metrics collected in ${metrics.collectionTime}ms`);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("❌ Metrics collection failed:", error);

    return NextResponse.json(
      {
        error: "Failed to collect metrics",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        collectionTime: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Get API-specific metrics
async function getAPIMetrics() {
  try {
    const stats = await enhancedAPIClient.getPerformanceStats();
    return {
      totalRequests: stats.totalRequests || 0,
      successRate: stats.successRate || 0,
      averageResponseTime: stats.averageResponseTime || 0,
      errorRate: stats.errorRate || 0,
      activeConnections: stats.activeConnections || 0,
    };
  } catch (error) {
    console.warn("Failed to get API metrics:", error);
    return {
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      errorRate: 0,
      activeConnections: 0,
    };
  }
}

// Get Vector-specific metrics
async function getVectorMetrics() {
  try {
    const health = await enhancedVectorPipeline.healthCheck();
    const stats = health.stats as any;

    return {
      healthy: health.healthy,
      totalVectors: stats?.totalCount || 0,
      lastUpdate: health.changeTracker?.lastUpdate || null,
      updateHistory: health.changeTracker?.updateHistory || 0,
    };
  } catch (error) {
    console.warn("Failed to get vector metrics:", error);
    return {
      healthy: false,
      totalVectors: 0,
      lastUpdate: null,
      updateHistory: 0,
    };
  }
}

// Get active connections (simplified estimation)
function getActiveConnections(): number {
  // In a real implementation, this would connect to your connection pool
  // For now, return a reasonable estimate
  return Math.floor(Math.random() * 10) + 5; // 5-15 connections
}

// Get memory usage
function getMemoryUsage(): number {
  try {
    const usage = process.memoryUsage();
    return usage.heapUsed + usage.external;
  } catch (error) {
    console.warn("Failed to get memory usage:", error);
    return 0;
  }
}

// Calculate overall performance score (0-100)
function calculatePerformanceScore(metrics: any): number {
  const weights = {
    successRate: 0.3,
    responseTime: 0.25,
    cacheHitRate: 0.2,
    apiSuccessRate: 0.15,
    vectorHealth: 0.1,
  };

  let score = 0;

  // Success rate component (0-100)
  score += metrics.successRate * 100 * weights.successRate;

  // Response time component (inverse relationship, capped at 2 seconds)
  const responseTimeScore = Math.max(0, 100 - metrics.averageResponseTime / 20);
  score += responseTimeScore * weights.responseTime;

  // Cache hit rate component (0-100)
  score += metrics.cacheHitRate * 100 * weights.cacheHitRate;

  // API success rate component (0-100)
  score += metrics.apiSuccessRate * 100 * weights.apiSuccessRate;

  // Vector health component (0-100)
  score += metrics.vectorHealth * weights.vectorHealth;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// Calculate system load indicator
function calculateSystemLoad(metrics: any): "low" | "medium" | "high" {
  const factors = [
    metrics.averageResponseTime > 1000 ? 1 : 0, // Slow responses
    metrics.successRate < 0.9 ? 1 : 0, // Low success rate
    metrics.cacheHitRate < 0.6 ? 1 : 0, // Poor cache performance
    metrics.activeConnections > 20 ? 1 : 0, // High connections
    metrics.memoryUsage > 500 * 1024 * 1024 ? 1 : 0, // High memory (>500MB)
  ];

  const loadScore = factors.reduce((sum, factor) => sum + factor, 0);

  if (loadScore >= 3) return "high";
  if (loadScore >= 1) return "medium";
  return "low";
}

// Helper function to safely extract values from Promise.allSettled results
function extractValue(
  result: PromiseSettledResult<any>,
  key: string,
  fallback: any
): any {
  if (result.status === "fulfilled" && result.value && key in result.value) {
    return result.value[key];
  }
  return fallback;
}

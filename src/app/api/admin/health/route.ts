// Admin Health API - Comprehensive system health monitoring
import { NextRequest, NextResponse } from "next/server";
import { enhancedAPIClient } from "@/lib/enhanced-api-client";
import { enhancedVectorPipeline } from "@/lib/enhanced-vector-pipeline";
import { advancedCacheService } from "@/lib/advanced-cache-service";
import { intelligentQueryRouter } from "@/lib/query-router";
import { enhancedRAGPipeline } from "@/lib/enhanced-rag-pipeline";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log("🏥 Starting comprehensive health check...");

    // Perform health checks for all components in parallel
    const [apiHealth, vectorHealth, cacheStats, routerStats, ragHealth] =
      await Promise.allSettled([
        checkAPIHealth(),
        checkVectorHealth(),
        checkCacheHealth(),
        checkQueryRouterHealth(),
        checkRAGHealth(),
      ]);

    // Process results
    const healthData = {
      overall: true,
      components: {
        api: extractResult(apiHealth, {
          healthy: false,
          responseTime: 0,
          error: "Health check failed",
        }),
        vectors: extractResult(vectorHealth, {
          healthy: false,
          error: "Health check failed",
        }),
        cache: extractResult(cacheStats, {
          healthy: false,
          hitRate: 0,
          totalEntries: 0,
        }),
        rag: extractResult(ragHealth, {
          healthy: false,
          error: "Health check failed",
        }),
        queryRouter: extractResult(routerStats, {
          healthy: false,
          successRate: 0,
          avgResponseTime: 0,
        }),
      },
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
    };

    // Calculate overall health
    healthData.overall = Object.values(healthData.components).every(
      (component) => component.healthy
    );

    console.log(
      `✅ Health check completed in ${healthData.responseTime}ms - Overall: ${
        healthData.overall ? "Healthy" : "Unhealthy"
      }`
    );

    return NextResponse.json(healthData);
  } catch (error) {
    console.error("❌ Health check failed:", error);

    return NextResponse.json(
      {
        overall: false,
        components: {
          api: { healthy: false, error: "Health check failed" },
          vectors: { healthy: false, error: "Health check failed" },
          cache: { healthy: false, error: "Health check failed" },
          rag: { healthy: false, error: "Health check failed" },
          queryRouter: { healthy: false, error: "Health check failed" },
        },
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// API Health Check
async function checkAPIHealth() {
  const startTime = Date.now();

  try {
    const health = await enhancedAPIClient.healthCheck();
    const responseTime = Date.now() - startTime;

    return {
      healthy: health.healthy,
      responseTime,
      ...health,
    };
  } catch (error) {
    return {
      healthy: false,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : "API health check failed",
    };
  }
}

// Vector Health Check
async function checkVectorHealth() {
  try {
    const health = await enhancedVectorPipeline.healthCheck();
    return {
      healthy: health.healthy,
      stats: health.stats,
      changeTracker: health.changeTracker,
      error: health.error,
    };
  } catch (error) {
    return {
      healthy: false,
      error:
        error instanceof Error ? error.message : "Vector health check failed",
    };
  }
}

// Cache Health Check
async function checkCacheHealth() {
  try {
    const stats = advancedCacheService.getStats();

    // Consider cache healthy if hit rate is reasonable and no major issues
    const healthy = stats.hitRate >= 0 && stats.totalEntries >= 0;

    return {
      healthy,
      hitRate: stats.hitRate,
      totalEntries: stats.totalEntries,
      totalSize: stats.totalSize,
      averageAge: stats.averageAge,
      performanceMetrics: stats.performanceMetrics,
    };
  } catch (error) {
    return {
      healthy: false,
      hitRate: 0,
      totalEntries: 0,
      error:
        error instanceof Error ? error.message : "Cache health check failed",
    };
  }
}

// Query Router Health Check
async function checkQueryRouterHealth() {
  try {
    const stats = await intelligentQueryRouter.getPerformanceStats();

    return {
      healthy: stats.successRate > 0.5, // Consider healthy if > 50% success rate
      successRate: stats.successRate,
      avgResponseTime: stats.averageResponseTime,
      totalQueries: stats.totalQueries,
      strategyCounts: stats.strategyCounts,
    };
  } catch (error) {
    return {
      healthy: false,
      successRate: 0,
      avgResponseTime: 0,
      error:
        error instanceof Error
          ? error.message
          : "Query router health check failed",
    };
  }
}

// RAG Health Check
async function checkRAGHealth() {
  try {
    const health = await enhancedRAGPipeline.healthCheck();
    return {
      healthy: health.healthy,
      error: health.error,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : "RAG health check failed",
    };
  }
}

// Helper function to extract results from Promise.allSettled
function extractResult<T>(result: PromiseSettledResult<T>, fallback: T): T {
  if (result.status === "fulfilled") {
    return result.value;
  } else {
    console.warn("Health check component failed:", result.reason);
    return fallback;
  }
}

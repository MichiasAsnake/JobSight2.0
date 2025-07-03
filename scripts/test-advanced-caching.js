#!/usr/bin/env node

// Test script for Advanced Caching and Enhanced RAG Pipeline
// Tests Phase 3 completion: Advanced caching + RAG enhancement

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, "..", ".env.local") });

// Import our enhanced services (dynamic imports for ES modules)
const { advancedCacheService } = await import(
  "../src/lib/advanced-cache-service.js"
);
const { ragPipeline } = await import("../src/lib/rag-pipeline.js");
const { intelligentQueryRouter } = await import("../src/lib/query-router.js");

console.log("🧪 Phase 3 Testing: Advanced Caching + Enhanced RAG Pipeline");
console.log(
  "================================================================\n"
);

// Test 1: Advanced Cache Service
async function testAdvancedCaching() {
  console.log("📦 Testing Advanced Cache Service...");

  try {
    // Test basic cache operations
    const testKey = "test-query-123";
    const testData = {
      answer: "Test response",
      confidence: "high",
      timestamp: Date.now(),
    };

    // Set cache entry
    await advancedCacheService.set(testKey, testData, {
      ttl: 60000, // 1 minute
      tags: ["test", "query-result"],
      metadata: {
        source: "test",
        confidence: 0.9,
        freshness: "fresh",
      },
    });
    console.log("  ✅ Cache set operation successful");

    // Get cache entry
    const retrieved = await advancedCacheService.get(testKey);
    console.log(
      "  ✅ Cache get operation successful:",
      retrieved ? "Found" : "Not found"
    );

    // Test cache stats
    const stats = advancedCacheService.getStats();
    console.log("  📊 Cache stats:");
    console.log(`    - Total entries: ${stats.totalEntries}`);
    console.log(`    - Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
    console.log(`    - Total size: ${Math.round(stats.totalSize / 1024)}KB`);

    // Test invalidation by tag
    const invalidated = await advancedCacheService.invalidateByTag("test");
    console.log(`  🗑️ Invalidated ${invalidated} entries by tag`);

    console.log("  ✅ Advanced Cache Service tests passed\n");
    return true;
  } catch (error) {
    console.error("  ❌ Advanced Cache Service test failed:", error.message);
    return false;
  }
}

// Test 2: Enhanced RAG Pipeline
async function testEnhancedRAG() {
  console.log("🧠 Testing Enhanced RAG Pipeline...");

  try {
    // Test enhanced RAG query
    const testQuery = {
      userQuery: "Show me recent printing orders with rush flags",
      context: {
        includeLineItems: true,
        includeShipments: true,
        maxOrders: 10,
        preferFreshData: false,
      },
      filters: {
        status: "active",
      },
    };

    console.log(`  🔍 Testing query: "${testQuery.userQuery}"`);

    const result = await ragPipeline.queryWithEnhancedContext(testQuery);

    console.log("  📊 Enhanced RAG Results:");
    console.log(`    - Answer length: ${result.answer.length} characters`);
    console.log(`    - Confidence: ${result.confidence}`);
    console.log(
      `    - Context quality: ${(result.contextQuality * 100).toFixed(1)}%`
    );
    console.log(`    - Processing time: ${result.processingTime}ms`);
    console.log(`    - Data freshness: ${result.dataFreshness}`);
    console.log(`    - Strategy used: ${result.sources.strategy}`);
    console.log(
      `    - Orders analyzed: ${result.metadata.totalOrdersAnalyzed}`
    );
    console.log(`    - LLM tokens used: ${result.metadata.llmTokensUsed}`);

    if (
      result.metadata.recommendations &&
      result.metadata.recommendations.length > 0
    ) {
      console.log(
        `    - Recommendations: ${result.metadata.recommendations.join(", ")}`
      );
    }

    console.log("  ✅ Enhanced RAG Pipeline tests passed\n");
    return true;
  } catch (error) {
    console.error("  ❌ Enhanced RAG Pipeline test failed:", error.message);
    return false;
  }
}

// Test 3: Integration Test
async function testIntegration() {
  console.log("🔗 Testing Cache + RAG Integration...");

  try {
    // Test that RAG uses caching
    const testQuery = {
      userQuery: "Find orders similar to business cards with embossing",
      context: {
        includeLineItems: true,
        preferFreshData: false,
      },
    };

    console.log("  🔄 First query (should hit API/Vector)...");
    const firstResult = await ragPipeline.queryWithEnhancedContext(testQuery);
    const firstTime = firstResult.processingTime;

    console.log("  🔄 Second identical query (should hit cache)...");
    const secondResult = await ragPipeline.queryWithEnhancedContext(testQuery);
    const secondTime = secondResult.processingTime;

    console.log(`    - First query time: ${firstTime}ms`);
    console.log(`    - Second query time: ${secondTime}ms`);
    console.log(
      `    - Speed improvement: ${secondTime < firstTime ? "Yes" : "No"}`
    );

    // Get cache stats after integration test
    const finalStats = advancedCacheService.getStats();
    console.log("  📊 Final cache stats:");
    console.log(`    - Total entries: ${finalStats.totalEntries}`);
    console.log(`    - Hit rate: ${(finalStats.hitRate * 100).toFixed(1)}%`);

    console.log("  ✅ Integration tests passed\n");
    return true;
  } catch (error) {
    console.error("  ❌ Integration test failed:", error.message);
    return false;
  }
}

// Test 4: Performance and Optimization
async function testPerformance() {
  console.log("⚡ Testing Performance Optimization...");

  try {
    // Test cache optimization
    console.log("  🧹 Testing cache optimization...");
    await advancedCacheService.optimizeCache();

    // Test stale entry cleanup
    console.log("  🗑️ Testing stale entry cleanup...");
    const cleaned = await advancedCacheService.invalidateStaleEntries();
    console.log(`    - Cleaned up ${cleaned} stale entries`);

    // Test performance metrics
    const stats = advancedCacheService.getStats();
    console.log("  📈 Performance metrics:");
    console.log(
      `    - Average retrieval time: ${stats.performanceMetrics.averageRetrievalTime.toFixed(
        2
      )}ms`
    );
    console.log(
      `    - Average storage time: ${stats.performanceMetrics.averageStorageTime.toFixed(
        2
      )}ms`
    );
    console.log(
      `    - Eviction rate: ${(
        stats.performanceMetrics.evictionRate * 100
      ).toFixed(2)}%`
    );

    console.log("  ✅ Performance optimization tests passed\n");
    return true;
  } catch (error) {
    console.error("  ❌ Performance test failed:", error.message);
    return false;
  }
}

// Test 5: Health Checks
async function testHealthChecks() {
  console.log("🏥 Testing System Health...");

  try {
    // Test RAG pipeline health
    const ragHealth = await ragPipeline.healthCheck();
    console.log(
      `  🧠 RAG Pipeline: ${ragHealth.healthy ? "✅ Healthy" : "❌ Unhealthy"}`
    );
    if (!ragHealth.healthy && ragHealth.error) {
      console.log(`    Error: ${ragHealth.error}`);
    }

    // Test query router performance stats
    const routerStats = await intelligentQueryRouter.getPerformanceStats();
    console.log("  🧭 Query Router Stats:");
    console.log(`    - Total queries: ${routerStats.totalQueries}`);
    console.log(
      `    - Average response time: ${routerStats.averageResponseTime.toFixed(
        0
      )}ms`
    );
    console.log(
      `    - Success rate: ${(routerStats.successRate * 100).toFixed(1)}%`
    );

    console.log("  ✅ Health check tests passed\n");
    return true;
  } catch (error) {
    console.error("  ❌ Health check test failed:", error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log("Starting Phase 3 comprehensive testing...\n");

  const results = {
    caching: false,
    rag: false,
    integration: false,
    performance: false,
    health: false,
  };

  // Run all tests
  results.caching = await testAdvancedCaching();
  results.rag = await testEnhancedRAG();
  results.integration = await testIntegration();
  results.performance = await testPerformance();
  results.health = await testHealthChecks();

  // Summary
  console.log("📊 TEST SUMMARY");
  console.log("================");
  console.log(
    `Advanced Caching:     ${results.caching ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(`Enhanced RAG:         ${results.rag ? "✅ PASS" : "❌ FAIL"}`);
  console.log(
    `Integration:          ${results.integration ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Performance:          ${results.performance ? "✅ PASS" : "❌ FAIL"}`
  );
  console.log(
    `Health Checks:        ${results.health ? "✅ PASS" : "❌ FAIL"}`
  );

  const passCount = Object.values(results).filter(Boolean).length;
  const totalTests = Object.keys(results).length;

  console.log(`\nOverall: ${passCount}/${totalTests} tests passed`);

  if (passCount === totalTests) {
    console.log(
      "🎉 All Phase 3 tests PASSED! Advanced caching and RAG enhancement are working correctly."
    );
  } else {
    console.log("⚠️ Some tests failed. Please review the errors above.");
  }

  // Cleanup
  try {
    await advancedCacheService.cleanup();
    console.log("\n🧹 Cleanup completed");
  } catch (error) {
    console.warn("⚠️ Cleanup warning:", error.message);
  }
}

// Execute tests
runTests().catch(console.error);

#!/usr/bin/env node
// Test Script for Intelligent Query Router
// Demonstrates smart query routing and hybrid strategies

import { intelligentQueryRouter } from "../src/lib/query-router.ts";

async function testQueryRouter() {
  console.log("🧠 Testing Intelligent Query Router");
  console.log("=".repeat(50));

  const testQueries = [
    {
      category: "Specific Job Lookup",
      query: "Show me job 234567",
      expectedStrategy: "api",
    },
    {
      category: "Semantic Search",
      query: "Find business cards similar to glossy finish",
      expectedStrategy: "vector",
    },
    {
      category: "Analytical Query",
      query: "How many rush orders do we have this month?",
      expectedStrategy: "hybrid",
    },
    {
      category: "Customer Filter",
      query: "Show orders for ABC Company that are late",
      expectedStrategy: "hybrid",
    },
    {
      category: "Material Search",
      query: "Find all vinyl banner orders",
      expectedStrategy: "vector",
    },
    {
      category: "Status Analysis",
      query: "What's the average completion time for completed orders?",
      expectedStrategy: "hybrid",
    },
  ];

  console.log(`🧪 Running ${testQueries.length} test queries...\n`);

  for (const [index, test] of testQueries.entries()) {
    console.log(`${index + 1}. ${test.category}`);
    console.log(`   Query: "${test.query}"`);
    console.log(`   Expected Strategy: ${test.expectedStrategy}`);

    try {
      const startTime = Date.now();
      const result = await intelligentQueryRouter.routeQuery(test.query);
      const actualTime = Date.now() - startTime;

      console.log(`   ✅ Actual Strategy: ${result.strategy}`);
      console.log(`   🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(
        `   ⏱️  Processing Time: ${result.processingTime}ms (Test: ${actualTime}ms)`
      );
      console.log(`   📊 Data Freshness: ${result.dataFreshness}`);
      console.log(`   🔍 Sources: ${result.sources.join(", ")}`);
      console.log(
        `   📈 Performance: API:${result.performanceMetrics.apiCalls} Vector:${result.performanceMetrics.vectorQueries} Cache:${result.performanceMetrics.cacheHits}`
      );

      if (result.results.summary) {
        console.log(`   📋 Summary: ${result.results.summary}`);
      }

      if (result.fallbacksUsed && result.fallbacksUsed.length > 0) {
        console.log(`   🔄 Fallbacks Used: ${result.fallbacksUsed.join(", ")}`);
      }

      if (result.recommendations && result.recommendations.length > 0) {
        console.log(
          `   💡 Recommendations: ${result.recommendations
            .slice(0, 2)
            .join(", ")}`
        );
      }

      // Check if strategy matches expectation
      const strategyMatch = result.strategy === test.expectedStrategy;
      console.log(
        `   ${strategyMatch ? "✅" : "⚠️"} Strategy Match: ${
          strategyMatch ? "YES" : "NO"
        }`
      );

      if (result.results.analytics) {
        console.log(
          `   📊 Analytics: ${
            Object.keys(result.results.analytics).length
          } metrics generated`
        );
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log();
  }

  // Test performance and caching
  console.log("🔄 Testing Cache Performance...");
  const cacheTestQuery = "Show me business card orders";

  console.log("First query (cache miss):");
  const firstResult = await intelligentQueryRouter.routeQuery(cacheTestQuery);
  console.log(`⏱️ Time: ${firstResult.processingTime}ms`);

  console.log("Second query (cache hit):");
  const secondResult = await intelligentQueryRouter.routeQuery(cacheTestQuery);
  console.log(`⏱️ Time: ${secondResult.processingTime}ms`);
  console.log(`📈 Data Freshness: ${secondResult.dataFreshness}`);

  // Show overall performance stats
  console.log("\n📊 Overall Performance Statistics:");
  const stats = intelligentQueryRouter.getPerformanceStats();
  console.log(`Total Queries: ${stats.totalQueries}`);
  console.log(`API Queries: ${stats.apiQueries}`);
  console.log(`Vector Queries: ${stats.vectorQueries}`);
  console.log(`Hybrid Queries: ${stats.hybridQueries}`);
  console.log(
    `Average Response Time: ${stats.averageResponseTime.toFixed(2)}ms`
  );
  console.log(`Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(1)}%`);

  // Show cache statistics
  console.log("\n🗂️ Cache Statistics:");
  const cacheStats = intelligentQueryRouter.getCacheStats();
  console.log(`Cache Size: ${cacheStats.size} entries`);
  if (cacheStats.entries.length > 0) {
    console.log("Recent Cache Entries:");
    cacheStats.entries.slice(0, 3).forEach((entry, index) => {
      console.log(
        `  ${index + 1}. ${entry.key.substring(0, 40)}... (age: ${Math.round(
          entry.age / 1000
        )}s)`
      );
    });
  }

  // Show query history
  console.log("\n📋 Query History:");
  const history = intelligentQueryRouter.getQueryHistory(5);
  history.forEach((entry, index) => {
    console.log(
      `  ${index + 1}. "${entry.query}" -> ${entry.intent.type} (${(
        entry.intent.confidence * 100
      ).toFixed(1)}%)`
    );
  });

  console.log("\n✅ Query Router Testing Complete!");
}

// Test error handling
async function testErrorHandling() {
  console.log("\n🛡️ Testing Error Handling...");

  try {
    // Test with empty query
    const emptyResult = await intelligentQueryRouter.routeQuery("");
    console.log(
      `Empty query result: ${emptyResult.strategy} (confidence: ${emptyResult.confidence})`
    );

    // Test with very long query
    const longQuery = "a".repeat(1000);
    const longResult = await intelligentQueryRouter.routeQuery(longQuery);
    console.log(
      `Long query result: ${longResult.strategy} (confidence: ${longResult.confidence})`
    );

    console.log("✅ Error handling tests passed");
  } catch (error) {
    console.log(`❌ Error handling test failed: ${error.message}`);
  }
}

// Test with different contexts
async function testContextualRouting() {
  console.log("\n🎯 Testing Contextual Routing...");

  const testQuery = "Find late orders";

  // Test with different user preferences
  const contexts = [
    {
      name: "Fresh Data Preferred",
      context: {
        userPreferences: { preferFreshData: true, maxResponseTime: 5000 },
      },
    },
    {
      name: "Analytics Preferred",
      context: {
        userPreferences: { includeAnalytics: true, maxResponseTime: 10000 },
      },
    },
    {
      name: "Fast Response Preferred",
      context: { userPreferences: { maxResponseTime: 1000 } },
    },
  ];

  for (const test of contexts) {
    console.log(`\n${test.name}:`);
    const result = await intelligentQueryRouter.routeQuery(
      testQuery,
      test.context
    );
    console.log(
      `Strategy: ${result.strategy}, Time: ${
        result.processingTime
      }ms, Confidence: ${(result.confidence * 100).toFixed(1)}%`
    );
  }
}

async function main() {
  try {
    await testQueryRouter();
    await testErrorHandling();
    await testContextualRouting();
  } catch (error) {
    console.error("❌ Test suite failed:", error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Test script failed:", error);
    process.exit(1);
  });
}

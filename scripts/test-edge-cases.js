#!/usr/bin/env node

/**
 * Test script to validate edge case fixes in the query router
 * Tests the specific issues identified in the chat logs
 */

const { IntelligentQueryRouter } = require("../src/lib/query-router.ts");

async function testEdgeCases() {
  console.log("🧪 Testing Edge Cases in Query Router\n");

  const router = new IntelligentQueryRouter();

  // Test cases based on the issues identified in chat logs
  const testCases = [
    {
      name: "Tag filtering with @laser",
      query: "show me orders due next week tagged @laser",
      expected: {
        hasTagFilter: true,
        tagValue: "@laser",
        hasDateRange: true,
        strategy: "hybrid",
      },
    },
    {
      name: "Tag filtering with production",
      query: "show me orders due this week tagged in production",
      expected: {
        hasTagFilter: true,
        tagValue: "production",
        hasDateRange: true,
        strategy: "hybrid",
      },
    },
    {
      name: "Exclude tags",
      query: "show me orders not tagged gamma",
      expected: {
        hasExcludeTagFilter: true,
        excludeTagValue: "gamma",
        strategy: "hybrid",
      },
    },
    {
      name: "Date range this week",
      query: "show me orders due this week",
      expected: {
        hasDateRange: true,
        dateDescription: "this week",
        strategy: "hybrid",
      },
    },
    {
      name: "Date range next week",
      query: "show me orders due next week",
      expected: {
        hasDateRange: true,
        dateDescription: "next week",
        strategy: "hybrid",
      },
    },
    {
      name: "Simple tag query",
      query: "show me orders tagged urgent",
      expected: {
        hasTagFilter: true,
        tagValue: "urgent",
        strategy: "hybrid",
      },
    },
  ];

  let passedTests = 0;
  let totalTests = testCases.length;

  for (const testCase of testCases) {
    console.log(`\n📋 Testing: ${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);

    try {
      const startTime = Date.now();
      const result = await router.routeQuery(testCase.query);
      const processingTime = Date.now() - startTime;

      console.log(`⏱️  Processing time: ${processingTime}ms`);
      console.log(`🎯 Strategy: ${result.strategy}`);
      console.log(`📊 Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      console.log(`📦 Results: ${result.results.orders?.length || 0} orders`);

      // Validate intent parsing
      const intent = await router.analyzeQueryIntent(testCase.query);
      console.log(`🧠 Intent type: ${intent.type}`);
      console.log(
        `🏷️  Tags: ${intent.extractedEntities.tags?.join(", ") || "none"}`
      );
      console.log(
        `🚫 Exclude tags: ${
          intent.extractedEntities.excludeTags?.join(", ") || "none"
        }`
      );
      console.log(
        `📅 Date ranges: ${intent.extractedEntities.dateRanges?.length || 0}`
      );

      // Check expectations
      let testPassed = true;

      if (testCase.expected.hasTagFilter) {
        const hasTag = intent.extractedEntities.tags?.includes(
          testCase.expected.tagValue
        );
        if (!hasTag) {
          console.log(
            `❌ Expected tag "${testCase.expected.tagValue}" not found`
          );
          testPassed = false;
        }
      }

      if (testCase.expected.hasExcludeTagFilter) {
        const hasExcludeTag = intent.extractedEntities.excludeTags?.includes(
          testCase.expected.excludeTagValue
        );
        if (!hasExcludeTag) {
          console.log(
            `❌ Expected exclude tag "${testCase.expected.excludeTagValue}" not found`
          );
          testPassed = false;
        }
      }

      if (testCase.expected.hasDateRange) {
        const hasDateRange = intent.extractedEntities.dateRanges?.length > 0;
        if (!hasDateRange) {
          console.log(`❌ Expected date range not found`);
          testPassed = false;
        }
      }

      if (
        testCase.expected.strategy &&
        result.strategy !== testCase.expected.strategy
      ) {
        console.log(
          `❌ Expected strategy "${testCase.expected.strategy}", got "${result.strategy}"`
        );
        testPassed = false;
      }

      if (processingTime > 5000) {
        console.log(
          `⚠️  Performance warning: Query took ${processingTime}ms (>5s)`
        );
      }

      if (testPassed) {
        console.log(`✅ Test PASSED`);
        passedTests++;
      } else {
        console.log(`❌ Test FAILED`);
      }
    } catch (error) {
      console.log(`💥 Test ERROR: ${error.message}`);
    }
  }

  console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

  if (passedTests === totalTests) {
    console.log("🎉 All edge case tests passed!");
  } else {
    console.log("⚠️  Some edge case tests failed. Review the output above.");
  }

  // Test cache performance
  console.log("\n🧪 Testing Cache Performance");
  const cacheTestQuery = "show me orders tagged urgent";

  try {
    // First call (cache miss)
    const start1 = Date.now();
    await router.routeQuery(cacheTestQuery);
    const time1 = Date.now() - start1;

    // Second call (should be cache hit)
    const start2 = Date.now();
    await router.routeQuery(cacheTestQuery);
    const time2 = Date.now() - start2;

    console.log(`First call: ${time1}ms`);
    console.log(`Second call: ${time2}ms`);
    console.log(
      `Cache improvement: ${(((time1 - time2) / time1) * 100).toFixed(1)}%`
    );

    if (time2 < time1 * 0.5) {
      console.log("✅ Cache is working effectively");
    } else {
      console.log("⚠️  Cache may not be working optimally");
    }
  } catch (error) {
    console.log(`💥 Cache test error: ${error.message}`);
  }
}

// Run the tests
testEdgeCases().catch(console.error);

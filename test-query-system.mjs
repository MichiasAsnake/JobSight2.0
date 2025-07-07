// Test script for enhanced query system
import { intelligentQueryRouter } from "./src/lib/query-router.ts";

async function testDynamicTopK() {
  console.log("Testing Dynamic TopK Implementation...\n");

  const testQueries = [
    { query: "show me all orders", expectedType: "broad" },
    { query: "urgent orders due today", expectedType: "urgent" },
    { query: "orders for SpaceX", expectedType: "specific" },
    { query: "screen printing orders", expectedType: "process" },
    { query: "analyze all orders by customer", expectedType: "analytical" },
  ];

  for (const testCase of testQueries) {
    try {
      console.log(`Testing: "${testCase.query}"`);
      const result = await intelligentQueryRouter.routeQuery(testCase.query);
      console.log(`  Strategy: ${result.strategy}`);
      console.log(`  Results: ${result.results.vectorResults?.length || 0}`);
      console.log(`  Confidence: ${result.confidence.toFixed(3)}`);
      console.log(`  Processing Time: ${result.processingTime}ms`);
      if (result.fallbacksUsed?.length > 0) {
        console.log(`  Fallbacks: ${result.fallbacksUsed.join(", ")}`);
      }
      console.log("");
    } catch (error) {
      console.log(`  Error: ${error.message}\n`);
    }
  }
}

testDynamicTopK();

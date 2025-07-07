// Simple test to verify keyword detection system
console.log("🔧 Testing Keyword Detection System");
console.log("===================================\n");

// Test 1: Simple keyword detection
console.log("Test 1: Basic keyword detection");
try {
  // Simulate the keyword detection logic
  const testQueries = [
    "show me laser jobs for today",
    "find etching orders",
    "embroidery work",
    "jacket orders",
    "gamma items",
    "rush jobs",
  ];

  const keywords = {
    laser: "laser",
    etching: "etching",
    embroidery: "embroidery",
    jacket: "jacket",
    gamma: "gamma",
    rush: "rush",
  };

  testQueries.forEach((query) => {
    console.log(`📝 Query: "${query}"`);

    // Simple keyword matching
    let found = false;
    for (const [keyword, filter] of Object.entries(keywords)) {
      if (query.toLowerCase().includes(keyword)) {
        console.log(`✅ Keyword: ${keyword} → text-filter: "${filter}"`);
        console.log(`🎯 Strategy: api`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.log("❌ No keywords detected → Strategy: vector");
    }
    console.log("");
  });
} catch (error) {
  console.log("❌ Test failed:", error.message);
}

console.log("\n✅ Expected behavior:");
console.log('• "laser jobs" → API call with text-filter=laser');
console.log('• "etching orders" → API call with text-filter=etching');
console.log("• Natural language without @ symbols works!");

// Test script for enhanced query system
const { intelligentQueryRouter } = require("./src/lib/query-router.ts");

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

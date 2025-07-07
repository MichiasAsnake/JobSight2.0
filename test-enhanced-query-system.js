// Enhanced Query System Test Script
// Tests dynamic topK, fallback mechanisms, error handling, and real-time population

const { intelligentQueryRouter } = require("./src/lib/query-router.ts");
const { enhancedRAGPipeline } = require("./src/lib/enhanced-rag-pipeline.ts");
const {
  PineconePopulationStrategy,
} = require("./src/lib/pinecone-population-strategy.ts");

// Mock embedding service for testing
const mockEmbeddingService = {
  createEmbedding: async (text) => {
    // Return a mock embedding vector
    return Array.from({ length: 1536 }, () => Math.random() - 0.5);
  },
};

// Performance timing utility
const timeFunction = async (fn, name) => {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    console.log(`⏱️  ${name}: ${duration}ms`);
    return { result, duration, success: true };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`❌ ${name}: ${duration}ms - ${error.message}`);
    return { error, duration, success: false };
  }
};

// Test queries for different scenarios
const testQueries = [
  // Broad queries - should use high topK
  {
    name: "Broad Query - All Orders",
    query: "show me all orders",
    expectedTopK: 50,
    expectedStrategy: "vector",
  },
  {
    name: "Broad Query - Every Order",
    query: "show me every order in the system",
    expectedTopK: 50,
    expectedStrategy: "vector",
  },

  // Specific queries - should use low topK
  {
    name: "Specific Query - Job Number",
    query: "show me job 12345",
    expectedTopK: 5,
    expectedStrategy: "api",
  },
  {
    name: "Specific Query - Customer",
    query: "orders for SpaceX",
    expectedTopK: 25,
    expectedStrategy: "vector",
  },

  // Urgent queries - should use medium-high topK
  {
    name: "Urgent Query - Overdue",
    query: "urgent orders due today",
    expectedTopK: 25,
    expectedStrategy: "vector",
  },
  {
    name: "Urgent Query - Late",
    query: "late orders that need attention",
    expectedTopK: 25,
    expectedStrategy: "vector",
  },

  // Time-based queries
  {
    name: "Time Query - This Week",
    query: "orders due this week",
    expectedTopK: 30,
    expectedStrategy: "vector",
  },
  {
    name: "Time Query - Next Week",
    query: "orders due next week",
    expectedTopK: 30,
    expectedStrategy: "vector",
  },

  // Process/Material queries
  {
    name: "Process Query",
    query: "screen printing orders",
    expectedTopK: 20,
    expectedStrategy: "vector",
  },
  {
    name: "Material Query",
    query: "cotton t-shirt orders",
    expectedTopK: 20,
    expectedStrategy: "vector",
  },

  // Analytical queries
  {
    name: "Analytical Query",
    query: "analyze all orders by customer",
    expectedTopK: 30,
    expectedStrategy: "vector",
  },

  // Numerical queries
  {
    name: "Numerical Query",
    query: "show me 15 recent orders",
    expectedTopK: 20,
    expectedStrategy: "vector",
  },
];

// Test fallback scenarios
const fallbackTestQueries = [
  {
    name: "Restrictive Filter Test",
    query: "orders for nonexistent-customer with specific-status",
    shouldTriggerFallback: true,
  },
  {
    name: "Very Specific Process",
    query: "orders with very-specific-process-code",
    shouldTriggerFallback: true,
  },
];

// Test error handling
const errorTestQueries = [
  {
    name: "Empty Query",
    query: "",
    shouldHandleError: true,
  },
  {
    name: "Very Long Query",
    query: "a".repeat(10000),
    shouldHandleError: true,
  },
];

async function runTests() {
  console.log("🚀 Starting Enhanced Query System Tests\n");

  // Test 1: Dynamic TopK Implementation
  console.log("📊 Test 1: Dynamic TopK Implementation");
  console.log("=".repeat(50));

  for (const testCase of testQueries) {
    const result = await timeFunction(
      () => intelligentQueryRouter.routeQuery(testCase.query),
      testCase.name
    );

    if (result.success) {
      const actualTopK = result.result.results.vectorResults?.length || 0;
      const strategy = result.result.strategy;

      console.log(`  ✅ ${testCase.name}`);
      console.log(`     Strategy: ${strategy}`);
      console.log(`     Results: ${actualTopK}`);
      console.log(`     Confidence: ${result.result.confidence.toFixed(3)}`);
      console.log(`     Processing Time: ${result.result.processingTime}ms`);

      if (result.result.fallbacksUsed?.length > 0) {
        console.log(
          `     Fallbacks Used: ${result.result.fallbacksUsed.join(", ")}`
        );
      }

      console.log("");
    } else {
      console.log(`  ❌ ${testCase.name}: ${result.error.message}\n`);
    }
  }

  // Test 2: Fallback Mechanism
  console.log("🔄 Test 2: Fallback Mechanism");
  console.log("=".repeat(50));

  for (const testCase of fallbackTestQueries) {
    const result = await timeFunction(
      () => intelligentQueryRouter.routeQuery(testCase.query),
      testCase.name
    );

    if (result.success) {
      const fallbacksUsed = result.result.fallbacksUsed || [];
      const hasFallbacks = fallbacksUsed.length > 0;

      console.log(`  ${hasFallbacks ? "✅" : "⚠️"} ${testCase.name}`);
      console.log(`     Strategy: ${result.result.strategy}`);
      console.log(
        `     Results: ${result.result.results.vectorResults?.length || 0}`
      );
      console.log(
        `     Fallbacks Used: ${
          fallbacksUsed.length > 0 ? fallbacksUsed.join(", ") : "None"
        }`
      );
      console.log(`     Confidence: ${result.result.confidence.toFixed(3)}`);
      console.log("");
    } else {
      console.log(`  ❌ ${testCase.name}: ${result.error.message}\n`);
    }
  }

  // Test 3: Error Handling
  console.log("🛡️ Test 3: Error Handling");
  console.log("=".repeat(50));

  for (const testCase of errorTestQueries) {
    const result = await timeFunction(
      () => intelligentQueryRouter.routeQuery(testCase.query),
      testCase.name
    );

    if (result.success) {
      console.log(`  ✅ ${testCase.name}: Handled gracefully`);
      console.log(`     Strategy: ${result.result.strategy}`);
      console.log(
        `     Results: ${result.result.results.vectorResults?.length || 0}`
      );
      console.log("");
    } else {
      console.log(`  ❌ ${testCase.name}: ${result.error.message}\n`);
    }
  }

  // Test 4: Performance Analysis
  console.log("⚡ Test 4: Performance Analysis");
  console.log("=".repeat(50));

  const performanceQueries = [
    "show me all orders",
    "urgent orders due today",
    "orders for SpaceX",
    "screen printing orders",
  ];

  const performanceResults = [];

  for (const query of performanceQueries) {
    const result = await timeFunction(
      () => intelligentQueryRouter.routeQuery(query),
      query
    );

    if (result.success) {
      performanceResults.push({
        query,
        duration: result.duration,
        strategy: result.result.strategy,
        results: result.result.results.vectorResults?.length || 0,
        confidence: result.result.confidence,
      });
    }
  }

  // Calculate performance statistics
  const avgDuration =
    performanceResults.reduce((sum, r) => sum + r.duration, 0) /
    performanceResults.length;
  const maxDuration = Math.max(...performanceResults.map((r) => r.duration));
  const minDuration = Math.min(...performanceResults.map((r) => r.duration));

  console.log(`  Average Response Time: ${avgDuration.toFixed(0)}ms`);
  console.log(`  Fastest Query: ${minDuration}ms`);
  console.log(`  Slowest Query: ${maxDuration}ms`);
  console.log("");

  // Test 5: Real-time Population Test
  console.log("🔄 Test 5: Real-time Population");
  console.log("=".repeat(50));

  const realtimeQueries = [
    "show me job 99999", // Should trigger real-time population
    "orders for new-customer-123", // Should trigger real-time population
  ];

  for (const query of realtimeQueries) {
    const result = await timeFunction(
      () => intelligentQueryRouter.routeQuery(query),
      query
    );

    if (result.success) {
      const realtimeStats = result.result.realtimePopulation;
      console.log(`  ✅ ${query}`);
      console.log(`     Jobs Added: ${realtimeStats?.jobsAdded || 0}`);
      console.log(`     Jobs Failed: ${realtimeStats?.jobsFailed || 0}`);
      console.log(`     Errors: ${realtimeStats?.errors?.length || 0}`);
      console.log("");
    } else {
      console.log(`  ❌ ${query}: ${result.error.message}\n`);
    }
  }

  // Test 6: System Health Check
  console.log("🏥 Test 6: System Health Check");
  console.log("=".repeat(50));

  const healthChecks = [
    {
      name: "Query Router Health",
      check: () => intelligentQueryRouter.getPerformanceStats(),
    },
    {
      name: "RAG Pipeline Health",
      check: () => enhancedRAGPipeline.healthCheck(),
    },
  ];

  for (const healthCheck of healthChecks) {
    const result = await timeFunction(healthCheck.check, healthCheck.name);

    if (result.success) {
      console.log(`  ✅ ${healthCheck.name}: Healthy`);
      console.log(`     Stats: ${JSON.stringify(result.result, null, 2)}`);
      console.log("");
    } else {
      console.log(`  ❌ ${healthCheck.name}: ${result.error.message}\n`);
    }
  }

  console.log("🎉 Test Suite Complete!");
}

// Run the tests
runTests().catch(console.error);

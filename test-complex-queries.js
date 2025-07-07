// Comprehensive test suite for complex OMS chat queries
// Tests various query types and validates responses

const testQueries = [
  // 1. Simple keyword queries (our original issue)
  {
    query: "jackets",
    expectedKeywords: ["pirelli", "jacket"],
    description: "Simple jacket search - should find PIRELLI JACKETS",
    expectedStrategy: "api",
  },

  // 2. Other keyword searches
  {
    query: "embroidery",
    expectedKeywords: ["emb", "embroidery"],
    description: "Embroidery process search",
    expectedStrategy: "api",
  },

  // 3. Complex multi-criteria queries
  {
    query: "show me jackets that are approved and due this week",
    expectedKeywords: ["jacket", "approved"],
    description: "Complex query combining keywords, status, and time",
    expectedStrategy: "api",
  },

  // 4. Customer-specific queries
  {
    query: "what orders does Canary LLC have?",
    expectedKeywords: ["canary"],
    description: "Customer-specific search",
    expectedStrategy: "api",
  },

  // 5. Status-based queries
  {
    query: "show me all approved orders",
    expectedKeywords: ["approved"],
    description: "Status-based search",
    expectedStrategy: "api",
  },

  // 6. Process-specific queries
  {
    query: "what orders need laser cutting?",
    expectedKeywords: ["laser"],
    description: "Process-specific search using natural language",
    expectedStrategy: "api",
  },

  // 7. Semantic queries (should use vector)
  {
    query: "what orders are similar to promotional products?",
    expectedKeywords: [],
    description: "Semantic similarity search",
    expectedStrategy: "vector",
  },

  // 8. Job number queries
  {
    query: "tell me about job 50576",
    expectedKeywords: ["50576"],
    description: "Specific job number query",
    expectedStrategy: "api",
  },

  // 9. Complex analytical queries
  {
    query: "how many jacket orders are overdue?",
    expectedKeywords: ["jacket", "overdue"],
    description: "Analytical query with filtering",
    expectedStrategy: "api",
  },

  // 10. Edge case - empty/minimal query
  {
    query: "bags",
    expectedKeywords: ["bag"],
    description: "Simple bag search",
    expectedStrategy: "api",
  },
];

async function testQuery(testCase, index) {
  console.log(`\n🧪 Test ${index + 1}: ${testCase.description}`);
  console.log(`📝 Query: "${testCase.query}"`);
  console.log(`🎯 Expected strategy: ${testCase.expectedStrategy}`);

  try {
    const startTime = Date.now();

    const response = await fetch("http://localhost:3000/api/oms-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: testCase.query,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    console.log(`⏱️  Response time: ${responseTime}ms`);
    console.log(
      `📊 Orders analyzed: ${data.metadata?.totalOrdersAnalyzed || "Unknown"}`
    );
    console.log(`🎯 Confidence: ${data.confidence}`);
    console.log(`📋 Strategy used: ${data.metadata?.strategy || "Unknown"}`);

    // Check if expected keywords are mentioned
    const responseLower = data.message.toLowerCase();
    const foundKeywords = testCase.expectedKeywords.filter((keyword) =>
      responseLower.includes(keyword.toLowerCase())
    );

    console.log(
      `🔍 Expected keywords: [${testCase.expectedKeywords.join(", ")}]`
    );
    console.log(`✅ Found keywords: [${foundKeywords.join(", ")}]`);

    // Validate strategy
    const strategyMatch = data.metadata?.strategy === testCase.expectedStrategy;
    console.log(
      `🎯 Strategy match: ${strategyMatch ? "✅" : "❌"} (expected: ${
        testCase.expectedStrategy
      }, got: ${data.metadata?.strategy})`
    );

    // Show response preview
    const preview =
      data.message.length > 200
        ? data.message.substring(0, 200) + "..."
        : data.message;
    console.log(`💬 Response preview: "${preview}"`);

    // Overall assessment
    const keywordScore =
      foundKeywords.length / Math.max(testCase.expectedKeywords.length, 1);
    const overallScore =
      strategyMatch && keywordScore > 0.5 ? "PASS" : "NEEDS_REVIEW";

    console.log(`🎉 Overall: ${overallScore}`);

    return {
      testCase,
      data,
      responseTime,
      foundKeywords,
      strategyMatch,
      overallScore,
      keywordScore,
    };
  } catch (error) {
    console.error(`❌ Test failed:`, error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("💡 Make sure the Next.js server is running: npm run dev");
    }

    return {
      testCase,
      error: error.message,
      overallScore: "ERROR",
    };
  }
}

async function runAllTests() {
  console.log("🚀 Starting comprehensive OMS chat query tests...\n");

  const results = [];

  for (let i = 0; i < testQueries.length; i++) {
    const result = await testQuery(testQueries[i], i);
    results.push(result);

    // Add a small delay between tests to avoid overwhelming the API
    if (i < testQueries.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log("\n📊 TEST SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.overallScore === "PASS").length;
  const needsReview = results.filter(
    (r) => r.overallScore === "NEEDS_REVIEW"
  ).length;
  const errors = results.filter((r) => r.overallScore === "ERROR").length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`⚠️  Needs Review: ${needsReview}/${results.length}`);
  console.log(`❌ Errors: ${errors}/${results.length}`);

  if (needsReview > 0) {
    console.log("\n🔍 TESTS NEEDING REVIEW:");
    results
      .filter((r) => r.overallScore === "NEEDS_REVIEW")
      .forEach((result, i) => {
        console.log(
          `${i + 1}. "${result.testCase.query}" - ${
            result.testCase.description
          }`
        );
        if (!result.strategyMatch) {
          console.log(
            `   📋 Strategy issue: expected ${result.testCase.expectedStrategy}, got ${result.data?.metadata?.strategy}`
          );
        }
        if (result.keywordScore < 0.5) {
          console.log(
            `   🔍 Keyword issue: found ${result.foundKeywords.length}/${result.testCase.expectedKeywords.length} expected keywords`
          );
        }
      });
  }

  if (errors > 0) {
    console.log("\n❌ ERRORS:");
    results
      .filter((r) => r.overallScore === "ERROR")
      .forEach((result, i) => {
        console.log(`${i + 1}. "${result.testCase.query}" - ${result.error}`);
      });
  }

  return results;
}

// Run the tests
runAllTests()
  .then(() => {
    console.log("\n🏁 Testing complete!");
  })
  .catch((error) => {
    console.error("💥 Test suite failed:", error);
  });

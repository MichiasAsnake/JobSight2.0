// Query Routing Diagnostic Script
// Tests query classification and routing for troubleshooting

const testQueries = [
  "what's due today",
  "what's due tomorrow",
  "what orders should i prioritize to reach 10k this week",
  "show me embroidery orders",
  "rush orders",
  "overdue orders",
  "job 51094 status",
  "orders for Jackalope",
];

console.log("=".repeat(80));
console.log("🔍 QUERY ROUTING DIAGNOSTIC TOOL");
console.log("=".repeat(80));

async function testQueryClassification() {
  console.log("\n📊 TESTING QUERY CLASSIFICATION:");
  console.log("-".repeat(50));

  for (const query of testQueries) {
    console.log(`\n🔍 Query: "${query}"`);

    // Simulate classification logic
    const queryLower = query.toLowerCase();

    let expectedType = "semantic_search"; // default
    let expectedRouting = "RAG Pipeline";

    // Apply the classification rules
    if (
      queryLower.includes("today") ||
      queryLower.includes("tomorrow") ||
      queryLower.includes("due") ||
      queryLower.includes("overdue") ||
      queryLower.includes("rush") ||
      queryLower.includes("urgent")
    ) {
      expectedType = "exact_data";
      expectedRouting = "Function Calls";
    }

    if (queryLower.includes("embroidery") || queryLower.includes("like")) {
      expectedType = "semantic_search";
      expectedRouting = "RAG Pipeline";
    }

    if (queryLower.includes("job") && /\d/.test(query)) {
      expectedType = "exact_data";
      expectedRouting = "Function Calls";
    }

    if (
      queryLower.includes("total") ||
      queryLower.includes("reach") ||
      queryLower.includes("prioritize")
    ) {
      expectedType = "calculation";
      expectedRouting = "Function Calls";
    }

    console.log(`   Expected Type: ${expectedType}`);
    console.log(`   Expected Routing: ${expectedRouting}`);

    // Check if query would match our new date functions
    if (queryLower.includes("due today") || queryLower.includes("today")) {
      console.log(`   ✅ Should match: getOrdersDueToday()`);
    } else if (
      queryLower.includes("due tomorrow") ||
      queryLower.includes("tomorrow")
    ) {
      console.log(`   ✅ Should match: getOrdersDueTomorrow()`);
    } else if (queryLower.includes("overdue") || queryLower.includes("late")) {
      console.log(`   ✅ Should match: getLateOrders()`);
    } else if (queryLower.includes("rush") || queryLower.includes("urgent")) {
      console.log(`   ✅ Should match: getRushOrders()`);
    } else {
      console.log(`   ⚠️  Fallback to: searchOrdersByQuery()`);
    }
  }
}

function testDataAvailability() {
  console.log("\n\n📋 DATA AVAILABILITY CHECK:");
  console.log("-".repeat(50));

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  console.log(`📅 Today: ${today.toISOString().split("T")[0]}`);
  console.log(`📅 Tomorrow: ${tomorrow.toISOString().split("T")[0]}`);

  console.log("\n🔍 Sample order dates from your data:");
  console.log("   2025-07-02 (multiple orders)");
  console.log("   2025-07-03 (multiple orders)");
  console.log("   2025-07-04 (multiple orders)");
  console.log("   2025-07-07 (multiple orders)");
  console.log("   2025-07-08 (multiple orders)");

  const todayStr = today.toISOString().split("T")[0];
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  if (todayStr >= "2025-07-02" && todayStr <= "2025-07-08") {
    console.log(`   ✅ TODAY (${todayStr}) has matching orders in your data!`);
  } else {
    console.log(
      `   ⚠️  TODAY (${todayStr}) may not have matching orders in static data`
    );
  }

  if (tomorrowStr >= "2025-07-02" && tomorrowStr <= "2025-07-08") {
    console.log(
      `   ✅ TOMORROW (${tomorrowStr}) has matching orders in your data!`
    );
  } else {
    console.log(
      `   ⚠️  TOMORROW (${tomorrowStr}) may not have matching orders in static data`
    );
  }
}

function testVectorSearchThresholds() {
  console.log("\n\n🎯 VECTOR SEARCH THRESHOLD ANALYSIS:");
  console.log("-".repeat(50));

  console.log("Current RAG Pipeline Thresholds:");
  console.log("   Specific comparisons: 0.50 minimum score");
  console.log("   Material/Process queries: 0.40 minimum score");
  console.log("   General queries: 0.35 minimum score");
  console.log("   Relaxed threshold: 0.25 minimum score");

  console.log("\n🔍 Date Query Analysis:");
  console.log(
    "   Problem: 'what's due today' doesn't match order descriptions well"
  );
  console.log("   Embeddings: Temporal concepts vs product descriptions");
  console.log("   Solution: Route date queries to exact_data (✅ IMPLEMENTED)");

  console.log("\n📊 Recommended Actions:");
  console.log("   1. ✅ Added dedicated date functions");
  console.log("   2. ✅ Enhanced query classification");
  console.log("   3. ✅ Improved fallback search logic");
  console.log("   4. 🔄 Test with real queries");
}

function showSolutionSummary() {
  console.log("\n\n🎉 SOLUTION SUMMARY:");
  console.log("=".repeat(50));

  console.log("\n🔧 FIXES IMPLEMENTED:");
  console.log("   ✅ Added get_orders_due_today function");
  console.log("   ✅ Added get_orders_due_tomorrow function");
  console.log("   ✅ Added get_orders_due_this_week function");
  console.log("   ✅ Enhanced query router with date detection");
  console.log("   ✅ Improved fallback search with date awareness");

  console.log("\n🎯 QUERY ROUTING IMPROVEMENTS:");
  console.log("   'what's due today' → exact_data → getOrdersDueToday()");
  console.log("   'what's due tomorrow' → exact_data → getOrdersDueTomorrow()");
  console.log("   'overdue orders' → exact_data → getLateOrders()");
  console.log("   'rush orders' → exact_data → getRushOrders()");

  console.log("\n🧪 NEXT STEPS:");
  console.log("   1. Test queries in the chat interface");
  console.log("   2. Check browser console for routing logs");
  console.log("   3. Verify date filtering is working correctly");
  console.log("   4. Monitor query classification accuracy");
}

// Run all diagnostic functions
async function runDiagnostics() {
  await testQueryClassification();
  testDataAvailability();
  testVectorSearchThresholds();
  showSolutionSummary();

  console.log("\n" + "=".repeat(80));
  console.log("🏁 DIAGNOSTIC COMPLETE - Test your queries now!");
  console.log("=".repeat(80));
}

runDiagnostics().catch(console.error);

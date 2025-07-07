// Edge case and debugging tests
const edgeCaseTests = [
  {
    name: "Job Number Investigation",
    query: "job 50576",
    expectedMentions: ["50576"],
    description: "Investigating why direct job lookup isn't working",
  },
  {
    name: "Alternative Job Format",
    query: "#50576",
    expectedMentions: ["50576"],
    description: "Testing alternative job number format",
  },
  {
    name: "Job with Text",
    query: "show me job number 50576",
    expectedMentions: ["50576"],
    description: "More verbose job number query",
  },
  {
    name: "Known Good Job",
    query: "job 51144",
    expectedMentions: ["51144"],
    description: "Testing a job that appeared in customer search",
  },
  {
    name: "Complex Multi-Word",
    query: "promotional products for events",
    expectedMentions: ["promotional", "event"],
    description: "Complex semantic query",
  },
  {
    name: "Process with Context",
    query: "laser cutting orders",
    expectedMentions: ["laser"],
    description: "Process query with context",
  },
  {
    name: "Urgent Orders",
    query: "rush orders",
    expectedMentions: ["rush", "urgent"],
    description: "Urgency-based query",
  },
  {
    name: "Customer Partial Match",
    query: "Proforma",
    expectedMentions: ["proforma"],
    description: "Partial customer name",
  },
];

async function runEdgeCaseTest(test) {
  console.log(`\n🧪 Testing: ${test.name}`);
  console.log(`📝 Query: "${test.query}"`);
  console.log(`🎯 Expected mentions: [${test.expectedMentions.join(", ")}]`);

  try {
    const response = await fetch("http://localhost:3000/api/oms-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: test.query,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const responseLower = data.message.toLowerCase();

    // Check for expected mentions
    const foundMentions = test.expectedMentions.filter((mention) =>
      responseLower.includes(mention.toLowerCase())
    );

    // For job numbers, also check if it says "no information available"
    const noInfoFound =
      responseLower.includes("no information available") ||
      responseLower.includes("not found") ||
      responseLower.includes("does not exist");

    const success = foundMentions.length > 0 && !noInfoFound;

    console.log(
      `📊 Orders analyzed: ${data.metadata?.totalOrdersAnalyzed || "Unknown"}`
    );
    console.log(`🎯 Confidence: ${data.confidence}`);
    console.log(`📋 Strategy: ${data.metadata?.strategy || "Unknown"}`);
    console.log(
      `✅ Found mentions: [${foundMentions.join(", ")}] (${
        foundMentions.length
      }/${test.expectedMentions.length})`
    );
    console.log(`⚠️  "No info" response: ${noInfoFound ? "Yes" : "No"}`);
    console.log(`🎉 Result: ${success ? "PASS" : "NEEDS REVIEW"}`);

    // Show a preview of the response
    const preview =
      data.message.length > 400
        ? data.message.substring(0, 400) + "..."
        : data.message;
    console.log(`💬 Response preview:\n"${preview}"`);

    return { test, success, foundMentions, noInfoFound, data };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { test, success: false, error: error.message };
  }
}

async function runEdgeCaseTests() {
  console.log("🔍 Running edge case tests...\n");

  const results = [];

  for (const test of edgeCaseTests) {
    const result = await runEdgeCaseTest(test);
    results.push(result);

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Summary
  console.log("\n📊 EDGE CASE TEST SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.success).length;
  const needsReview = results.filter((r) => !r.success && !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`⚠️  Needs Review: ${needsReview}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  // Detailed analysis
  console.log("\n🔍 DETAILED ANALYSIS:");

  const jobNumberTests = results.filter((r) => r.test.name.includes("Job"));
  const jobNumberPassed = jobNumberTests.filter((r) => r.success).length;
  console.log(
    `📋 Job Number Queries: ${jobNumberPassed}/${jobNumberTests.length} passed`
  );

  const noInfoResponses = results.filter((r) => r.noInfoFound).length;
  console.log(
    `⚠️  "No Information" responses: ${noInfoResponses}/${results.length}`
  );

  if (needsReview > 0 || failed > 0) {
    console.log("\n❌ ISSUES FOUND:");
    results
      .filter((r) => !r.success)
      .forEach((result, i) => {
        console.log(`${i + 1}. ${result.test.name}: "${result.test.query}"`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        } else {
          console.log(
            `   Found: [${result.foundMentions?.join(", ") || "none"}]`
          );
          console.log(
            `   Expected: [${result.test.expectedMentions.join(", ")}]`
          );
          if (result.noInfoFound) {
            console.log(
              `   Issue: System responded with "no information available"`
            );
          }
        }
      });
  }

  return results;
}

runEdgeCaseTests();

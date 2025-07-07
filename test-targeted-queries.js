// Targeted tests for specific query types
const targetedTests = [
  {
    name: "Customer Query",
    query: "what orders does Canary LLC have?",
    expectedMentions: ["canary"],
    description: "Should find orders for Canary LLC customer",
  },
  {
    name: "Process Query",
    query: "what orders need embroidery?",
    expectedMentions: ["embroidery", "emb"],
    description: "Should find orders requiring embroidery process",
  },
  {
    name: "Specific Job Query",
    query: "tell me about job 50576",
    expectedMentions: ["50576", "pirelli"],
    description: "Should find specific PIRELLI JACKETS job",
  },
  {
    name: "Status Query",
    query: "show me approved orders",
    expectedMentions: ["approved"],
    description: "Should find approved orders",
  },
  {
    name: "Bags Query",
    query: "bags",
    expectedMentions: ["bag"],
    description: "Should find orders related to bags",
  },
];

async function runTargetedTest(test) {
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

    const success = foundMentions.length > 0;

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
    console.log(`🎉 Result: ${success ? "PASS" : "NEEDS REVIEW"}`);

    // Show a preview of the response
    const preview =
      data.message.length > 300
        ? data.message.substring(0, 300) + "..."
        : data.message;
    console.log(`💬 Response preview:\n"${preview}"`);

    return { test, success, foundMentions, data };
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return { test, success: false, error: error.message };
  }
}

async function runAllTargetedTests() {
  console.log("🚀 Running targeted query tests...\n");

  const results = [];

  for (const test of targetedTests) {
    const result = await runTargetedTest(test);
    results.push(result);

    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Summary
  console.log("\n📊 TARGETED TEST SUMMARY");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:");
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
        }
      });
  }

  return results;
}

runAllTargetedTests();

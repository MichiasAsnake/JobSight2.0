// Simple debug test for job number lookup
console.log("🧪 Testing job number lookup...");

async function testJobLookup() {
  try {
    console.log('📝 Testing: "job 50576"');

    const response = await fetch("http://localhost:3000/api/oms-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "job 50576",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Response received");
    console.log("📋 Strategy:", data.metadata?.strategy || "Unknown");
    console.log(
      "📊 Orders analyzed:",
      data.metadata?.totalOrdersAnalyzed || "Unknown"
    );

    const responseLower = data.message.toLowerCase();
    const mentions50576 = responseLower.includes("50576");
    const mentionsPirelli = responseLower.includes("pirelli");
    const noInfoFound = responseLower.includes("no information available");

    console.log("🔍 Mentions 50576:", mentions50576 ? "✅" : "❌");
    console.log("🔍 Mentions PIRELLI:", mentionsPirelli ? "✅" : "❌");
    console.log('⚠️ "No info" response:', noInfoFound ? "❌" : "✅");

    console.log("\n💬 Full Response:");
    console.log(data.message);

    // Now test the jackets query to compare
    console.log("\n" + "=".repeat(50));
    console.log('📝 Comparing with: "jackets"');

    const jacketsResponse = await fetch("http://localhost:3000/api/oms-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "jackets",
      }),
    });

    const jacketsData = await jacketsResponse.json();
    const jacketsLower = jacketsData.message.toLowerCase();
    const jacketsHas50576 = jacketsLower.includes("50576");
    const jacketsHasPirelli = jacketsLower.includes("pirelli");

    console.log(
      "🔍 Jackets query mentions 50576:",
      jacketsHas50576 ? "✅" : "❌"
    );
    console.log(
      "🔍 Jackets query mentions PIRELLI:",
      jacketsHasPirelli ? "✅" : "❌"
    );

    console.log("\n🎯 ANALYSIS:");
    if (jacketsHas50576 && !mentions50576) {
      console.log(
        "❌ Issue: Job 50576 is found in jackets search but not direct job lookup"
      );
      console.log(
        "💡 This suggests a routing or filtering issue with direct job queries"
      );
    } else if (mentions50576) {
      console.log("✅ Job lookup is working correctly");
    } else {
      console.log("⚠️ Neither query finds job 50576 - may be a data issue");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testJobLookup();

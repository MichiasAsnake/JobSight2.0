// Single test for the jackets query to verify our fix
async function testJacketsQuery() {
  console.log("🧪 Testing jackets query...");

  try {
    // Wait a moment for server to be ready
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const response = await fetch("http://localhost:3000/api/oms-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "jackets",
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    console.log("✅ Response received!");
    console.log(
      "📊 Orders analyzed:",
      data.metadata?.totalOrdersAnalyzed || "Unknown"
    );
    console.log("🎯 Confidence:", data.confidence);
    console.log("📋 Strategy used:", data.metadata?.strategy || "Unknown");

    // Check if PIRELLI is mentioned
    const responseLower = data.message.toLowerCase();
    const mentionsPirelli = responseLower.includes("pirelli");
    const mentionsJackets = responseLower.includes("jacket");

    console.log("🔍 Mentions PIRELLI:", mentionsPirelli ? "✅" : "❌");
    console.log("🔍 Mentions jackets/jacket:", mentionsJackets ? "✅" : "❌");

    console.log("\n💬 Full Response:");
    console.log(data.message);

    // Success criteria
    if (mentionsPirelli && mentionsJackets) {
      console.log("\n🎉 SUCCESS: The jacket query fix is working!");
      console.log(
        "✅ The system now properly finds and mentions PIRELLI JACKETS"
      );
    } else if (mentionsJackets && !mentionsPirelli) {
      console.log(
        "\n⚠️  PARTIAL SUCCESS: System mentions jackets but may not have found the specific PIRELLI order"
      );
    } else {
      console.log(
        "\n❌ ISSUE: System still not properly handling jacket queries"
      );
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("💡 Server may still be starting up. Try again in a moment.");
    }
  }
}

testJacketsQuery();

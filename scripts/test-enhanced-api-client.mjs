import { getEnhancedAPIClient } from "../src/lib/enhanced-api-client.ts";

async function testEnhancedAPIClient() {
  console.log("🔍 Testing Enhanced API Client...");

  try {
    const client = getEnhancedAPIClient();

    console.log("📋 Testing basic job list request...");

    // Test with minimal filters to see what happens
    const result = await client.getJobList({
      "page-size": "5",
      "requested-page": "1",
    });

    console.log("✅ Success!");
    console.log("📊 Response:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error("🔍 Error details:", error);
  }
}

testEnhancedAPIClient();

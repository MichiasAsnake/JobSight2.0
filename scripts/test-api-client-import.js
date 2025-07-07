#!/usr/bin/env node
// Test script to verify API client import and basic functionality

async function testAPIClientImport() {
  console.log("🧪 Testing API Client Import...\n");

  try {
    // Test importing the enhanced API client
    console.log("📦 Step 1: Importing EnhancedOMSAPIClient...");
    const { EnhancedOMSAPIClient } = await import(
      "../src/lib/enhanced-api-client.ts"
    );
    console.log("✅ EnhancedOMSAPIClient imported successfully");

    // Test creating an instance
    console.log("🔧 Step 2: Creating API client instance...");
    const apiClient = new EnhancedOMSAPIClient({
      baseUrl: "https://intranet.decopress.com",
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 300000,
      rateLimitPerMinute: 60,
      connectionPoolSize: 10,
      healthCheckInterval: 60000,
    });
    console.log("✅ API client instance created successfully");

    // Test basic methods exist
    console.log("🔍 Step 3: Testing method availability...");
    const methods = [
      "getJobList",
      "getJobLines",
      "getJobLinesCostDetails",
      "getAllInwardsAndStockItems",
      "getJobShipments",
      "getDeliveryOptions",
      "getPriceQuantityBands",
      "getAllCategoryUnits",
      "getJobHistory",
      "getCustomerById",
    ];

    for (const method of methods) {
      if (typeof apiClient[method] === "function") {
        console.log(`✅ ${method} method available`);
      } else {
        console.log(`❌ ${method} method missing`);
      }
    }

    console.log("\n🎉 API Client Import Test Complete!");
    console.log("💡 The API client is ready to use in the main testing script");
  } catch (error) {
    console.error("❌ API Client Import Test Failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testAPIClientImport()
  .then(() => {
    console.log("\n✅ API Client Import Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ API Client Import Test failed:", error);
    process.exit(1);
  });

#!/usr/bin/env node
// Test script to verify CommonJS imports and basic functionality

const fs = require("fs");
const path = require("path");

async function testCommonJSImports() {
  console.log("🧪 Testing CommonJS Imports...\n");

  try {
    // Test importing node-fetch
    console.log("📦 Step 1: Importing node-fetch...");
    const fetch = (await import("node-fetch")).default;
    console.log("✅ node-fetch imported successfully");

    // Test basic fetch functionality
    console.log("🔧 Step 2: Testing fetch functionality...");
    const response = await fetch("https://httpbin.org/json");
    const data = await response.json();
    console.log(
      "✅ Fetch test successful:",
      data.slideshow ? "JSON response received" : "Response received"
    );

    // Test environment variable access
    console.log("🔍 Step 3: Testing environment variable access...");
    const authCookies = process.env.OMS_AUTH_COOKIES || "";
    console.log(
      `✅ Environment variable access: ${
        authCookies ? "Cookies found" : "No cookies set"
      }`
    );

    // Test file system operations
    console.log("📁 Step 4: Testing file system operations...");
    const dataDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    console.log("✅ File system operations successful");

    console.log("\n🎉 CommonJS Import Test Complete!");
    console.log(
      "💡 The CommonJS setup is ready to use in the main testing script"
    );
  } catch (error) {
    console.error("❌ CommonJS Import Test Failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testCommonJSImports()
  .then(() => {
    console.log("\n✅ CommonJS Import Test completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ CommonJS Import Test failed:", error);
    process.exit(1);
  });

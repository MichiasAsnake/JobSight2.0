// Test script for function calling implementation
const { omsFunctionCaller } = require("./src/lib/oms-function-caller.ts");

async function testFunctionCalling() {
  console.log("🧪 Testing OMS Function Calling...\n");

  // Test 1: Get available functions
  console.log("📋 Available Functions:");
  const functions = omsFunctionCaller.getAvailableFunctions();
  functions.forEach((func) => {
    console.log(`  - ${func.name}: ${func.description}`);
  });
  console.log("");

  // Test 2: Test function execution
  console.log("🔧 Testing function execution...");

  try {
    // Test get_job_list function
    const result = await omsFunctionCaller.executeFunction("get_job_list", {
      job_status: "5,6,7,8",
      due_date: "1,2,3",
    });

    console.log("✅ Function call result:", {
      success: result.success,
      functionName: result.functionName,
      hasData: !!result.data,
      error: result.error,
    });

    if (result.success && result.data) {
      console.log(`📊 Retrieved ${result.data.length || 0} jobs`);
    }
  } catch (error) {
    console.error("❌ Function call failed:", error);
  }

  console.log("\n✅ Function calling test completed!");
}

// Run the test
testFunctionCalling().catch(console.error);

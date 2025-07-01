import {
  loadOrders,
  validateAllOrders,
  getOrdersSummary,
} from "../lib/utils/dataPersistence.js";

/**
 * Test the data pipeline
 */
async function testDataPipeline() {
  console.log("🧪 Testing OMS Data Pipeline...");
  console.log("=".repeat(50));

  try {
    // Test 1: Load orders
    console.log("📂 Test 1: Loading orders...");
    const ordersData = await loadOrders();

    if (ordersData) {
      console.log(`✅ Successfully loaded ${ordersData.orders.length} orders`);
      console.log(`   Last updated: ${ordersData.summary.lastUpdated}`);
      console.log(`   Version: ${ordersData.summary.version}`);
    } else {
      console.log("❌ Failed to load orders data");
      return;
    }

    // Test 2: Validate orders
    console.log("\n🔍 Test 2: Validating orders...");
    const validationResult = await validateAllOrders();

    if (validationResult.success) {
      console.log(`✅ Validation successful:`);
      console.log(`   Total orders: ${validationResult.totalOrders}`);
      console.log(`   Valid orders: ${validationResult.validOrders}`);
      console.log(`   Invalid orders: ${validationResult.invalidOrders}`);
      console.log(`   Warnings: ${validationResult.totalWarnings}`);
      console.log(`   Errors: ${validationResult.totalErrors}`);

      // Show some validation details if there are issues
      if (
        validationResult.totalErrors > 0 ||
        validationResult.totalWarnings > 0
      ) {
        console.log("\n📋 Validation Details:");
        validationResult.orderResults
          .filter(
            (result) => result.errors.length > 0 || result.warnings.length > 0
          )
          .slice(0, 5) // Show first 5 problematic orders
          .forEach((result) => {
            console.log(`   Job ${result.jobNumber}:`);
            if (result.errors.length > 0) {
              console.log(`     ❌ Errors: ${result.errors.join(", ")}`);
            }
            if (result.warnings.length > 0) {
              console.log(`     ⚠️ Warnings: ${result.warnings.join(", ")}`);
            }
          });
      }
    } else {
      console.log("❌ Validation failed:", validationResult.error);
    }

    // Test 3: Get summary
    console.log("\n📊 Test 3: Getting summary...");
    const summary = await getOrdersSummary();

    if (summary.hasData) {
      console.log(`✅ Summary generated successfully:`);
      console.log(`   Total orders: ${summary.totalOrders}`);
      console.log(`   Last updated: ${summary.lastUpdated}`);
      console.log(`   Scraped at: ${summary.scrapedAt}`);

      if (summary.statusBreakdown) {
        console.log("\n📋 Status Breakdown:");
        Object.entries(summary.statusBreakdown).forEach(([status, count]) => {
          console.log(`   ${status}: ${count}`);
        });
      }

      if (summary.priorityBreakdown) {
        console.log("\n🚨 Priority Breakdown:");
        Object.entries(summary.priorityBreakdown).forEach(
          ([priority, count]) => {
            console.log(`   ${priority}: ${count}`);
          }
        );
      }

      if (summary.topCustomers && summary.topCustomers.length > 0) {
        console.log("\n🏢 Top Customers:");
        summary.topCustomers.forEach(({ customer, count }) => {
          console.log(`   ${customer}: ${count} orders`);
        });
      }
    } else {
      console.log("📭 No data available for summary");
    }

    // Test 4: Sample order structure (if data exists)
    if (ordersData.orders.length > 0) {
      console.log("\n📄 Test 4: Sample order structure...");
      const sampleOrder = ordersData.orders[0];
      console.log(`✅ Sample order (Job ${sampleOrder.jobNumber}):`);
      console.log(`   Order Number: ${sampleOrder.orderNumber}`);
      console.log(`   Status: ${sampleOrder.status}`);
      console.log(`   Priority: ${sampleOrder.priority}`);
      console.log(`   Customer: ${sampleOrder.customer?.company || "N/A"}`);
      console.log(
        `   Description: ${sampleOrder.description?.substring(0, 50)}...`
      );
      console.log(`   Date Entered: ${sampleOrder.dateEntered}`);
      console.log(`   Ship Date: ${sampleOrder.requestedShipDate}`);
      console.log(`   Line Items: ${sampleOrder.lineItems?.length || 0}`);
      console.log(
        `   Tags: ${sampleOrder.metadata?.tags?.join(", ") || "None"}`
      );
    }

    console.log("\n🎉 All tests completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Run the test
testDataPipeline();

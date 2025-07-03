// Test script for enriched OMS data system
import { enrichedOMSDataService } from "./src/lib/enhanced-data-service.js";
import { omsAPIClient } from "./src/lib/api-client.js";

async function testEnrichedSystem() {
  console.log("🧪 Testing Enriched OMS Data System");
  console.log("=====================================\n");

  // Test 1: Check API Health
  console.log("1. Testing API Health...");
  try {
    const health = await omsAPIClient.checkAPIHealth();
    console.log(`✅ API Health: ${health.healthy ? "Healthy" : "Degraded"}`);
    console.log(`   Endpoints: ${JSON.stringify(health.endpoints, null, 2)}`);
  } catch (error) {
    console.error(`❌ API Health Check Failed:`, error.message);
  }
  console.log("");

  // Test 2: Test Single Enriched Order
  console.log("2. Testing Single Enriched Order...");
  try {
    // Get basic job list first to get a job number
    const jobList = await omsAPIClient.getJobList({ "page-size": "5" });
    if (jobList.isSuccess && jobList.data.Entities.length > 0) {
      const firstJob = jobList.data.Entities[0];
      console.log(`   Testing with Job ${firstJob.JobNumber}`);

      const enrichedOrder =
        await enrichedOMSDataService.getEnrichedOrderByJobNumber(
          firstJob.JobNumber.toString()
        );

      if (enrichedOrder) {
        console.log(`✅ Successfully enriched Job ${enrichedOrder.jobNumber}`);
        console.log(`   Customer: ${enrichedOrder.customer.company}`);
        console.log(`   Status: ${enrichedOrder.status}`);
        console.log(`   Job Lines: ${enrichedOrder.jobLines.length}`);
        console.log(`   Stock Items: ${enrichedOrder.stockItems.length}`);
        console.log(`   Tags: ${enrichedOrder.tags.length}`);
        console.log(`   Shipments: ${enrichedOrder.shipments.length}`);
        console.log(`   History Entries: ${enrichedOrder.history.length}`);
        console.log(
          `   Pricing Total: ${enrichedOrder.pricing.totalFormatted}`
        );

        // Show detailed breakdown
        console.log("\n   Detailed Data Available:");
        console.log(
          `   - Customer Contact: ${enrichedOrder.customer.contactPerson} (${enrichedOrder.customer.email})`
        );
        console.log(`   - Price Tier: ${enrichedOrder.customer.priceTier}`);
        console.log(
          `   - Due Date: ${enrichedOrder.dateDue} (${enrichedOrder.daysToDue} days)`
        );
        console.log(
          `   - Stock Status: ${enrichedOrder.stockStatus.description}`
        );

        if (enrichedOrder.jobLines.length > 0) {
          const firstLine = enrichedOrder.jobLines[0];
          console.log(
            `   - First Production Task: ${firstLine.program} - ${firstLine.description} (${firstLine.quantity} @ $${firstLine.unitPrice})`
          );
        }

        if (enrichedOrder.tags.length > 0) {
          console.log(
            `   - Tags: ${enrichedOrder.tags.map((t) => t.tag).join(", ")}`
          );
        }
      } else {
        console.log(`❌ Failed to enrich Job ${firstJob.JobNumber}`);
      }
    } else {
      console.log(`❌ No jobs found in basic list`);
    }
  } catch (error) {
    console.error(`❌ Single Order Test Failed:`, error.message);
  }
  console.log("");

  // Test 3: Test Multiple Enriched Orders
  console.log("3. Testing Multiple Enriched Orders...");
  try {
    const enrichedOrders = await enrichedOMSDataService.getEnrichedOrders();
    console.log(
      `✅ Successfully retrieved ${enrichedOrders.orders.length} enriched orders`
    );
    console.log(`   Total Orders: ${enrichedOrders.summary.totalOrders}`);
    console.log(`   Data Source: ${enrichedOrders.summary.dataSource}`);
    console.log(`   API Health: ${enrichedOrders.summary.apiHealth}`);

    // Show status breakdown
    console.log("\n   Status Breakdown:");
    Object.entries(enrichedOrders.summary.statusBreakdown).forEach(
      ([status, count]) => {
        console.log(`   - ${status}: ${count}`);
      }
    );

    // Show customer breakdown (top 5)
    console.log("\n   Top Customers:");
    const topCustomers = Object.entries(
      enrichedOrders.summary.customerBreakdown
    )
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    topCustomers.forEach(([customer, count]) => {
      console.log(`   - ${customer}: ${count}`);
    });
  } catch (error) {
    console.error(`❌ Multiple Orders Test Failed:`, error.message);
  }
  console.log("");

  // Test 4: Test Search Functionality
  console.log("4. Testing Search Functionality...");
  try {
    const searchQueries = [
      "embroidery",
      "Family Industries",
      "approved",
      "laser",
    ];

    for (const query of searchQueries) {
      const results = await enrichedOMSDataService.searchEnrichedOrders(query);
      console.log(`   "${query}": ${results.length} results`);

      if (results.length > 0) {
        const firstResult = results[0];
        console.log(
          `     Example: Job ${firstResult.jobNumber} - ${firstResult.customer.company}`
        );
      }
    }
  } catch (error) {
    console.error(`❌ Search Test Failed:`, error.message);
  }
  console.log("");

  console.log("🏁 Testing Complete!");
  console.log(
    "\nThe enriched system should now provide comprehensive order data including:"
  );
  console.log("• Detailed job lines and production tasks");
  console.log("• Complete stock and inventory information");
  console.log("• Full customer contact details and pricing tiers");
  console.log("• Cost breakdowns and pricing information");
  console.log("• Shipping details and tracking");
  console.log("• Production history and workflow");
  console.log("• Tags and process annotations");
  console.log("• Delivery options and methods");

  console.log(
    "\nThe AI now has access to all this rich data for intelligent responses!"
  );
}

// Run the test
testEnrichedSystem().catch(console.error);

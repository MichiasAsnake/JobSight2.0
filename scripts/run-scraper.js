import { scrapeOrders } from "../scrape.js";
import {
  saveOrders,
  validateAllOrders,
  getOrdersSummary,
} from "../lib/utils/dataPersistence.js";

/**
 * Main function to run the scraper with validation
 */
async function runScraper() {
  console.log("🚀 Starting OMS Order Scraper...");
  console.log("=".repeat(50));

  try {
    // Step 1: Run the scraper
    console.log("📋 Step 1: Running scraper...");
    const startTime = Date.now();

    // This will handle login and scraping
    await scrapeOrders();

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    console.log(`✅ Scraping completed in ${duration} seconds`);

    // Step 2: Validate the scraped data
    console.log("\n📊 Step 2: Validating scraped data...");
    const validationResult = await validateAllOrders();

    if (validationResult.success) {
      console.log(
        `✅ Validation complete: ${validationResult.validOrders}/${validationResult.totalOrders} orders valid`
      );
      if (validationResult.totalWarnings > 0) {
        console.log(`⚠️ ${validationResult.totalWarnings} warnings found`);
      }
      if (validationResult.totalErrors > 0) {
        console.log(`❌ ${validationResult.totalErrors} errors found`);
      }
    } else {
      console.error("❌ Validation failed:", validationResult.error);
    }

    // Step 3: Get summary statistics
    console.log("\n📈 Step 3: Generating summary statistics...");
    const summary = await getOrdersSummary();

    if (summary.hasData) {
      console.log(`📊 Summary:`);
      console.log(`   Total Orders: ${summary.totalOrders}`);
      console.log(`   Last Updated: ${summary.lastUpdated}`);
      console.log(`   Scraped At: ${summary.scrapedAt}`);

      if (summary.statusBreakdown) {
        console.log(`   Status Breakdown:`);
        Object.entries(summary.statusBreakdown).forEach(([status, count]) => {
          console.log(`     ${status}: ${count}`);
        });
      }

      if (summary.priorityBreakdown) {
        console.log(`   Priority Breakdown:`);
        Object.entries(summary.priorityBreakdown).forEach(
          ([priority, count]) => {
            console.log(`     ${priority}: ${count}`);
          }
        );
      }

      if (summary.topCustomers && summary.topCustomers.length > 0) {
        console.log(`   Top Customers:`);
        summary.topCustomers.forEach(({ customer, count }) => {
          console.log(`     ${customer}: ${count} orders`);
        });
      }
    } else {
      console.log("📭 No data found or data is empty");
    }

    console.log("\n🎉 Scraper run completed successfully!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("❌ Scraper run failed:", error);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

/**
 * Function to run validation only (without scraping)
 */
async function runValidationOnly() {
  console.log("🔍 Running validation only...");

  const validationResult = await validateAllOrders();
  const summary = await getOrdersSummary();

  console.log("\n📊 Current Data Status:");
  console.log(`   Total Orders: ${summary.totalOrders}`);
  console.log(`   Last Updated: ${summary.lastUpdated}`);
  console.log(`   Has Data: ${summary.hasData}`);

  if (validationResult.success) {
    console.log(`\n✅ Validation Results:`);
    console.log(
      `   Valid Orders: ${validationResult.validOrders}/${validationResult.totalOrders}`
    );
    console.log(`   Warnings: ${validationResult.totalWarnings}`);
    console.log(`   Errors: ${validationResult.totalErrors}`);
  }
}

/**
 * Function to show data summary only
 */
async function showSummary() {
  console.log("📈 Showing data summary...");

  const summary = await getOrdersSummary();

  console.log("\n📊 Data Summary:");
  console.log(`   Total Orders: ${summary.totalOrders}`);
  console.log(`   Last Updated: ${summary.lastUpdated}`);
  console.log(`   Scraped At: ${summary.scrapedAt}`);
  console.log(`   Has Data: ${summary.hasData}`);

  if (summary.hasData && summary.statusBreakdown) {
    console.log("\n📋 Status Breakdown:");
    Object.entries(summary.statusBreakdown).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });
  }

  if (summary.hasData && summary.topCustomers) {
    console.log("\n🏢 Top Customers:");
    summary.topCustomers.forEach(({ customer, count }) => {
      console.log(`   ${customer}: ${count} orders`);
    });
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "validate":
    runValidationOnly();
    break;
  case "summary":
    showSummary();
    break;
  case "scrape":
  default:
    runScraper();
    break;
}

// Export for use in other modules
export { runScraper, runValidationOnly, showSummary };

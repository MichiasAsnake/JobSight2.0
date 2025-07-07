#!/usr/bin/env node
// Initial Vector Database Population Script
// Uses the existing VectorDBService for consistent vector creation

import dotenv from "dotenv";
import { apiFirstDataService } from "../src/lib/api-first-data-service";
import { vectorDBService } from "../src/lib/vector-db";

// Load environment variables
dotenv.config();

async function initialVectorPopulation() {
  console.log("🚀 Starting Initial Vector Database Population...\n");

  try {
    // 1. Initialize vector database service
    await vectorDBService.initialize();
    console.log("✅ Vector database service initialized");

    // 2. Fetch all orders from API
    console.log("📡 Fetching all orders from API...");
    const { orders } = await apiFirstDataService.getAllOrders({
      includeLineItems: true,
      includeShipments: true,
      includeFiles: true,
      useCache: false, // Don't use cache for initial population
    });
    console.log(`✅ Loaded ${orders.length} orders from API`);

    if (orders.length === 0) {
      console.log("❌ No orders found. Check your API connection.");
      return;
    }

    // 3. Force full rebuild (this will process all orders)
    console.log("🔄 Starting full vector database rebuild...");
    const result = await vectorDBService.forceFullRebuild(orders);

    // 4. Display results
    console.log("\n🎉 Initial Vector Population Complete!");
    console.log(`📊 Results:`);
    console.log(`  • New vectors: ${result.newVectors}`);
    console.log(`  • Updated vectors: ${result.updatedVectors}`);
    console.log(`  • Deleted vectors: ${result.deletedVectors}`);
    console.log(`  • Unchanged vectors: ${result.unchangedVectors}`);
    console.log(`  • Total processed: ${result.totalProcessed}`);
    console.log(`  • Processing time: ${result.processingTime}ms`);

    if (result.errors.length > 0) {
      console.log(`  • Errors: ${result.errors.length}`);
      result.errors.forEach((error) => console.log(`    - ${error}`));
    }

    // 5. Health check
    console.log("\n🏥 Performing health check...");
    const health = await vectorDBService.healthCheck();
    if (health.healthy) {
      console.log("✅ Vector database is healthy");
      const stats = await vectorDBService.getIndexStats();
      console.log(`📈 Index stats:`, JSON.stringify(stats, null, 2));
    } else {
      console.log("❌ Vector database health check failed:", health.error);
    }
  } catch (error) {
    console.error("❌ Initial population failed:", error);
    process.exit(1);
  }
}

// Run the population
initialVectorPopulation()
  .then(() => {
    console.log("\n✅ Initial population completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Initial population failed:", error);
    process.exit(1);
  });

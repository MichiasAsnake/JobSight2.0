#!/usr/bin/env node
// Daily Vector Database Update Script (API-only)
// Uses VectorDBService for consistent vector creation and incremental updates
// Maintains data freshness for RAG system

import dotenv from "dotenv";
import { apiFirstDataService } from "../src/lib/api-first-data-service";
import { vectorDBService } from "../src/lib/vector-db";

// Load environment variables
dotenv.config();

async function dailyVectorUpdate() {
  console.log("🚀 Starting Daily Vector Database Update (API-only)...\n");

  try {
    // 1. Initialize vector database service
    await vectorDBService.initialize();
    console.log("✅ Vector database service initialized");

    // 2. Fetch all orders from the API
    console.log("📡 Fetching all orders from API...");
    const { orders } = await apiFirstDataService.getAllOrders({
      includeLineItems: true,
      includeShipments: true,
      includeFiles: true,
      useCache: true, // Use API cache if available
    });
    console.log(`✅ Loaded ${orders.length} orders from API`);

    if (orders.length === 0) {
      console.log("❌ No orders found. Check your API connection.");
      return;
    }

    // 3. Perform incremental update (only processes new/changed orders)
    console.log("🔄 Performing incremental vector update...");
    const result = await vectorDBService.performIncrementalUpdate(orders);

    // 4. Display results
    console.log("\n🎉 Daily Vector Update Complete!");
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

    // 5. Test the updates with a sample search
    console.log("\n🧪 Testing updated semantic search...");
    const testQuery = "rush urgent priority orders";
    const { embeddingService } = await import("../src/lib/embeddings");
    const testEmbedding = await embeddingService.createEmbedding(testQuery);
    const searchResults = await vectorDBService.searchSimilarOrders(
      testEmbedding,
      3
    );

    console.log(
      `✅ Test search for "${testQuery}" found ${searchResults.length} results`
    );
    if (searchResults.length > 0) {
      console.log(
        `  Top result: Job ${
          searchResults[0].metadata.jobNumber
        } (score: ${searchResults[0].score.toFixed(3)})`
      );
    }

    // 6. Display change tracker stats
    const trackerStats = vectorDBService.getChangeTrackerStats();
    console.log("\n📈 Change Tracker Stats:");
    console.log(`  • Last update: ${trackerStats.lastVectorUpdate}`);
    console.log(`  • Processed orders: ${trackerStats.processedOrdersCount}`);
    console.log(`  • Deleted orders: ${trackerStats.deletedOrdersCount}`);
    console.log(`  • Tracked hashes: ${trackerStats.trackedHashesCount}`);

    console.log("\n🎉 Daily Vector Update Complete!");
    console.log(
      `🕒 Vector database is now current as of: ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("❌ Daily update failed:", error);
    process.exit(1);
  }
}

// Run the update
dailyVectorUpdate()
  .then(() => {
    console.log("\n✅ Daily update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Daily update failed:", error);
    process.exit(1);
  });

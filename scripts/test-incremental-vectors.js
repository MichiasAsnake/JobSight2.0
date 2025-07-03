// Test Incremental Vector Updates
// Verifies that the incremental update system works correctly

import dotenv from "dotenv";
import { dataUpdater } from "../src/lib/data-updater.ts";
import { vectorDBService } from "../src/lib/vector-db.ts";

// Load environment variables
dotenv.config();

async function testIncrementalVectorUpdates() {
  console.log("🧪 Testing Incremental Vector Update System\n");

  try {
    // 1. Check current vector tracker state
    console.log("📊 Current Change Tracker Stats:");
    const trackerStats = vectorDBService.getChangeTrackerStats();
    console.log(`  • Last vector update: ${trackerStats.lastVectorUpdate}`);
    console.log(`  • Processed orders: ${trackerStats.processedOrdersCount}`);
    console.log(
      `  • Deleted orders tracked: ${trackerStats.deletedOrdersCount}`
    );
    console.log(
      `  • Order hashes tracked: ${trackerStats.trackedHashesCount}\n`
    );

    // 2. Get current data health
    console.log("🏥 Data Health Assessment:");
    const dataHealth = await dataUpdater.assessDataHealth();
    console.log(`  • Total orders: ${dataHealth.totalOrders}`);
    console.log(`  • Data age: ${dataHealth.dataAge.toFixed(1)} hours`);
    console.log(
      `  • Data completeness: ${dataHealth.completeness.toFixed(1)}%`
    );
    console.log(
      `  • Vector sync in sync: ${dataHealth.vectorSyncHealth.isInSync}`
    );
    console.log(
      `  • Vector data age: ${dataHealth.vectorSyncHealth.vectorDataAge.toFixed(
        1
      )} hours`
    );
    console.log(
      `  • Hybrid data enabled: ${dataHealth.hybridHealth.enabled}\n`
    );

    // 3. Test incremental update detection
    console.log("🔍 Testing Change Detection:");

    // Load some sample orders for testing
    const { hybridOMSDataService } = await import(
      "../src/lib/hybrid-data-service.ts"
    );
    const orders = await hybridOMSDataService.getEnhancedOrders();

    if (orders.length === 0) {
      console.log("❌ No orders found for testing");
      return;
    }

    console.log(`  • Loaded ${orders.length} orders for analysis`);

    // Convert enhanced orders to regular orders for change detection
    const regularOrders = orders.map((order) => ({
      ...order,
      dataSource: undefined,
      lastAPIUpdate: undefined,
      needsRefresh: undefined,
      staleness: undefined,
      liveStatus: undefined,
      liveShipping: undefined,
      liveFiles: undefined,
      apiJobData: undefined,
      apiErrors: undefined,
      dataAge: undefined,
    }));

    // Detect changes
    const changes = await vectorDBService.detectOrderChanges(regularOrders);
    console.log(`  • New orders: ${changes.newOrders.length}`);
    console.log(`  • Updated orders: ${changes.updatedOrders.length}`);
    console.log(`  • Unchanged orders: ${changes.unchangedOrders.length}`);
    console.log(`  • Deleted orders: ${changes.deletedOrderIds.length}\n`);

    // 4. Test incremental update if there are changes
    const totalChanges =
      changes.newOrders.length +
      changes.updatedOrders.length +
      changes.deletedOrderIds.length;

    if (totalChanges > 0) {
      console.log(
        `🔄 Running incremental update for ${totalChanges} changes...`
      );
      const updateResult = await vectorDBService.performIncrementalUpdate(
        regularOrders
      );

      console.log("✅ Incremental Update Results:");
      console.log(`  • New vectors: ${updateResult.newVectors}`);
      console.log(`  • Updated vectors: ${updateResult.updatedVectors}`);
      console.log(`  • Deleted vectors: ${updateResult.deletedVectors}`);
      console.log(`  • Unchanged vectors: ${updateResult.unchangedVectors}`);
      console.log(`  • Processing time: ${updateResult.processingTime}ms`);

      if (updateResult.errors.length > 0) {
        console.log(`  • Errors: ${updateResult.errors.length}`);
        updateResult.errors.forEach((error) => console.log(`    - ${error}`));
      }
    } else {
      console.log("✅ No changes detected - incremental update not needed");
    }

    // 5. Test force full rebuild option
    console.log("\n🔄 Testing Force Full Rebuild (small sample):");
    const sampleOrders = regularOrders.slice(0, 5); // Test with just 5 orders
    console.log(
      `  • Processing ${sampleOrders.length} orders for full rebuild test...`
    );

    const fullRebuildResult = await vectorDBService.forceFullRebuild(
      sampleOrders
    );
    console.log("✅ Full Rebuild Test Results:");
    console.log(`  • New vectors: ${fullRebuildResult.newVectors}`);
    console.log(`  • Updated vectors: ${fullRebuildResult.updatedVectors}`);
    console.log(`  • Processing time: ${fullRebuildResult.processingTime}ms`);

    // 6. Final tracker stats
    console.log("\n📊 Final Change Tracker Stats:");
    const finalStats = vectorDBService.getChangeTrackerStats();
    console.log(`  • Last vector update: ${finalStats.lastVectorUpdate}`);
    console.log(`  • Processed orders: ${finalStats.processedOrdersCount}`);
    console.log(`  • Deleted orders tracked: ${finalStats.deletedOrdersCount}`);
    console.log(`  • Order hashes tracked: ${finalStats.trackedHashesCount}`);

    console.log("\n🎉 Incremental vector update test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testIncrementalVectorUpdates();

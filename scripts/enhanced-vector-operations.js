#!/usr/bin/env node
// Enhanced Vector Operations - Management script for the enhanced vector pipeline
// Provides commands for rebuild, health checks, and statistics

import { enhancedVectorPipeline } from "../src/lib/enhanced-vector-pipeline.ts";
import { apiFirstDataService } from "../src/lib/api-first-data-service.ts";

const command = process.argv[2] || "help";

async function main() {
  console.log("🚀 Enhanced Vector Operations");
  console.log("=".repeat(50));

  try {
    switch (command) {
      case "rebuild":
        console.log("🔄 Starting full vector rebuild...");
        const rebuildStats = await enhancedVectorPipeline.performFullRebuild();
        console.log("\n📊 Rebuild Results:");
        console.log(`✅ Created ${rebuildStats.newVectors} vectors`);
        console.log(`⏱️  Processing time: ${rebuildStats.processingTime}ms`);
        console.log(`🔧 API calls: ${rebuildStats.apiCalls}`);
        console.log(`📝 Embedding tokens: ${rebuildStats.embeddingTokens}`);
        console.log(
          `⚡ Throughput: ${rebuildStats.performance.throughputPerSecond.toFixed(
            2
          )} orders/sec`
        );
        break;

      case "update":
        console.log("🔄 Starting incremental vector update...");
        const updateStats =
          await enhancedVectorPipeline.performRealtimeUpdate();
        console.log("\n📊 Update Results:");
        console.log(`➕ New vectors: ${updateStats.newVectors}`);
        console.log(`🔄 Updated vectors: ${updateStats.updatedVectors}`);
        console.log(`➖ Deleted vectors: ${updateStats.deletedVectors}`);
        console.log(`💤 Unchanged vectors: ${updateStats.unchangedVectors}`);
        console.log(`⏱️  Processing time: ${updateStats.processingTime}ms`);
        console.log(
          `⚡ Throughput: ${updateStats.performance.throughputPerSecond.toFixed(
            2
          )} orders/sec`
        );
        if (updateStats.errors.length > 0) {
          console.log(`⚠️  Warnings: ${updateStats.errors.join(", ")}`);
        }
        break;

      case "health":
        console.log("🔍 Checking enhanced vector pipeline health...");
        const health = await enhancedVectorPipeline.healthCheck();
        console.log(
          `\n${health.healthy ? "✅" : "❌"} Vector Pipeline Health: ${
            health.healthy ? "HEALTHY" : "UNHEALTHY"
          }`
        );

        if (health.stats) {
          console.log(`📊 Index Stats:`, health.stats);
        }

        if (health.changeTracker) {
          console.log(`📈 Change Tracker:`, health.changeTracker);
        }

        if (health.error) {
          console.log(`❌ Error: ${health.error}`);
        }

        // Check API health too
        console.log("\n🔍 Checking API data service health...");
        const apiHealth = await apiFirstDataService.healthCheck();
        console.log(
          `${apiHealth.healthy ? "✅" : "❌"} API Health: ${
            apiHealth.healthy ? "HEALTHY" : "UNHEALTHY"
          }`
        );
        if (apiHealth.error) {
          console.log(`❌ API Error: ${apiHealth.error}`);
        }
        break;

      case "stats":
        console.log("📊 Getting vector pipeline statistics...");
        const indexStats = await enhancedVectorPipeline.getIndexStats();
        console.log("\n🗂️  Index Statistics:", indexStats);

        const updateHistory = enhancedVectorPipeline.getUpdateHistory();
        console.log("\n📈 Update History:");
        console.log(`Last update: ${updateHistory.summary.lastUpdate}`);
        console.log(
          `Last full rebuild: ${updateHistory.summary.lastFullRebuild}`
        );
        console.log(
          `Total processed orders: ${updateHistory.summary.totalProcessedOrders}`
        );
        console.log(`Total updates: ${updateHistory.summary.totalUpdates}`);

        if (updateHistory.updateHistory.length > 0) {
          console.log("\n📋 Recent Updates:");
          updateHistory.updateHistory.slice(-5).forEach((update, index) => {
            console.log(
              `${index + 1}. ${update.timestamp}: +${
                update.stats.newVectors
              } new, ~${update.stats.updatedVectors} updated, -${
                update.stats.deletedVectors
              } deleted`
            );
          });
        }
        break;

      case "search":
        const query = process.argv[3];
        if (!query) {
          console.log(
            "❌ Please provide a search query: npm run enhanced-vectors search 'your query'"
          );
          break;
        }

        console.log(`🔍 Searching for: "${query}"`);
        const results = await enhancedVectorPipeline.searchSimilarOrders(
          query,
          {
            topK: 5,
            includeHighlights: true,
          }
        );

        console.log(`\n📋 Found ${results.length} similar orders:`);
        results.forEach((result, index) => {
          console.log(
            `\n${index + 1}. Job ${
              result.metadata.jobNumber
            } (Score: ${result.score.toFixed(3)})`
          );
          console.log(`   📋 Customer: ${result.metadata.customerCompany}`);
          console.log(`   📊 Status: ${result.metadata.masterStatus}`);
          console.log(`   📅 Due: ${result.metadata.dateDue}`);
          console.log(
            `   🏷️  Line Items: ${result.metadata.lineItemCount}, Files: ${result.metadata.fileCount}`
          );
          if (result.highlights && result.highlights.length > 0) {
            console.log(`   💡 Highlights: ${result.highlights.join(", ")}`);
          }
        });
        break;

      case "help":
      default:
        console.log("Available commands:");
        console.log("  rebuild  - Perform full vector rebuild from API data");
        console.log("  update   - Perform incremental vector update");
        console.log("  health   - Check pipeline and API health");
        console.log("  stats    - Show vector database statistics");
        console.log(
          "  search   - Search vectors (e.g., 'search \"business cards\"')"
        );
        console.log("  help     - Show this help message");
        console.log("\nExamples:");
        console.log("  npm run enhanced-vectors rebuild");
        console.log("  npm run enhanced-vectors update");
        console.log("  npm run enhanced-vectors health");
        console.log("  npm run enhanced-vectors search 'business cards'");
        break;
    }
  } catch (error) {
    console.error("❌ Command failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

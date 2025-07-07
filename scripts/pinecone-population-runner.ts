import dotenv from "dotenv";
dotenv.config();

import {
  PineconePopulationStrategy,
  PopulationConfig,
} from "../src/lib/pinecone-population-strategy";

// Configuration presets
const CONFIG_PRESETS: Record<string, Partial<PopulationConfig>> = {
  development: {
    batchSize: 10,
    maxConcurrentBatches: 1,
    embeddingDelay: 200,
    upsertDelay: 1000,
    freshnessThreshold: 24,
    completenessThreshold: 50,
    enableIncrementalUpdates: true,
    enableDataValidation: true,
    enablePerformanceMonitoring: true,
  },
  production: {
    batchSize: 50,
    maxConcurrentBatches: 3,
    embeddingDelay: 100,
    upsertDelay: 500,
    freshnessThreshold: 24,
    completenessThreshold: 70,
    enableIncrementalUpdates: true,
    enableDataValidation: true,
    enablePerformanceMonitoring: true,
  },
  fast: {
    batchSize: 100,
    maxConcurrentBatches: 5,
    embeddingDelay: 50,
    upsertDelay: 200,
    freshnessThreshold: 48,
    completenessThreshold: 60,
    enableIncrementalUpdates: false,
    enableDataValidation: false,
    enablePerformanceMonitoring: false,
  },
  conservative: {
    batchSize: 25,
    maxConcurrentBatches: 1,
    embeddingDelay: 300,
    upsertDelay: 1000,
    freshnessThreshold: 12,
    completenessThreshold: 80,
    enableIncrementalUpdates: true,
    enableDataValidation: true,
    enablePerformanceMonitoring: true,
  },
};

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const preset = args[1] || "production";
  const indexName = args[2] || process.env.PINECONE_INDEX_NAME || "oms-orders";

  console.log("🚀 Pinecone Population Runner");
  console.log(`📋 Command: ${command}`);
  console.log(`⚙️  Preset: ${preset}`);
  console.log(`🗄️  Index: ${indexName}\n`);

  // Debug environment variables
  console.log("🔍 Environment Variables Debug:");
  console.log(
    "PINECONE_API_KEY:",
    process.env.PINECONE_API_KEY ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OPENAI_API_KEY:",
    process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OMS_API_BASE_URL:",
    process.env.OMS_API_BASE_URL ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OMS_AUTH_COOKIES:",
    process.env.OMS_AUTH_COOKIES ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OMS_AUTH_COOKIE:",
    process.env.OMS_AUTH_COOKIE ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "AUTH_COOKIES:",
    process.env.AUTH_COOKIES ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "AUTH_COOKIE:",
    process.env.AUTH_COOKIE ? "✅ Set" : "❌ Missing"
  );
  console.log("");

  // Validate environment variables
  if (!process.env.PINECONE_API_KEY) {
    console.error("❌ PINECONE_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!process.env.OMS_API_BASE_URL) {
    console.error("❌ OMS_API_BASE_URL environment variable is required");
    process.exit(1);
  }

  // Get configuration
  const config = CONFIG_PRESETS[preset];
  if (!config) {
    console.error(`❌ Unknown preset: ${preset}`);
    console.log("Available presets:", Object.keys(CONFIG_PRESETS).join(", "));
    process.exit(1);
  }

  // Initialize strategy
  console.log("🔧 Initializing Pinecone Population Strategy...");
  const strategy = new PineconePopulationStrategy(indexName, config);

  try {
    // Health check
    console.log("🏥 Performing health check...");
    const health = await strategy.healthCheck();
    if (!health.healthy) {
      console.error(`❌ Health check failed: ${health.error}`);
      process.exit(1);
    }
    console.log("✅ Health check passed\n");

    // Execute command
    switch (command) {
      case "full":
        await runFullPopulation(strategy);
        break;
      case "incremental":
        await runIncrementalUpdate(strategy);
        break;
      case "health":
        await runHealthCheck(strategy);
        break;
      case "stats":
        await runStatsCheck(strategy);
        break;
      case "reset":
        await runReset(strategy);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log(
          "Available commands: full, incremental, health, stats, reset"
        );
        process.exit(1);
    }
  } catch (error) {
    console.error("❌ Execution failed:", error);
    process.exit(1);
  }
}

async function runFullPopulation(strategy: PineconePopulationStrategy) {
  console.log("🔄 Starting full population...");
  const startTime = Date.now();

  try {
    const stats = await strategy.populateFullDatabase();

    const duration = (Date.now() - startTime) / 1000;
    console.log("\n📊 Full Population Results:");
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📦 Total Jobs: ${stats.totalJobs}`);
    console.log(`✅ Processed: ${stats.processedJobs}`);
    console.log(`❌ Failed: ${stats.failedJobs}`);
    console.log(`📤 Vectors Upserted: ${stats.upsertedVectors}`);
    console.log(`🗑️  Vectors Deleted: ${stats.deletedVectors}`);

    if (stats.errors.length > 0) {
      console.log(`⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    const successRate = (
      ((stats.processedJobs - stats.failedJobs) / stats.totalJobs) *
      100
    ).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);

    if (stats.averageProcessingTime) {
      console.log(
        `⚡ Average Processing Time: ${stats.averageProcessingTime.toFixed(
          2
        )}ms per job`
      );
    }
  } catch (error) {
    console.error("❌ Full population failed:", error);
    throw error;
  }
}

async function runIncrementalUpdate(strategy: PineconePopulationStrategy) {
  console.log("🔄 Starting incremental update...");
  const startTime = Date.now();

  try {
    const stats = await strategy.updateIncremental();

    const duration = (Date.now() - startTime) / 1000;
    console.log("\n📊 Incremental Update Results:");
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`📦 Total Jobs: ${stats.totalJobs}`);
    console.log(`✅ Processed: ${stats.processedJobs}`);
    console.log(`❌ Failed: ${stats.failedJobs}`);
    console.log(`📤 Vectors Upserted: ${stats.upsertedVectors}`);

    if (stats.errors.length > 0) {
      console.log(`⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (stats.totalJobs > 0) {
      const successRate = (
        ((stats.processedJobs - stats.failedJobs) / stats.totalJobs) *
        100
      ).toFixed(1);
      console.log(`📈 Success Rate: ${successRate}%`);
    }
  } catch (error) {
    console.error("❌ Incremental update failed:", error);
    throw error;
  }
}

async function runHealthCheck(strategy: PineconePopulationStrategy) {
  console.log("🏥 Performing comprehensive health check...");

  try {
    const health = await strategy.healthCheck();
    const stats = await strategy.getChangeTrackerStats();

    console.log("\n📊 Health Check Results:");
    console.log(`✅ Status: ${health.healthy ? "Healthy" : "Unhealthy"}`);

    if (!health.healthy) {
      console.log(`❌ Error: ${health.error}`);
    }

    console.log("\n📈 Change Tracker Stats:");
    console.log(`📦 Total Jobs: ${stats.stats.totalJobs}`);
    console.log(`👥 Total Customers: ${stats.stats.totalCustomers}`);
    console.log(`📊 Total Vectors: ${stats.stats.totalVectors}`);
    console.log(`🕒 Last Full Sync: ${stats.stats.lastFullSync}`);
    console.log(`🔄 Last Update: ${stats.lastUpdate}`);

    const jobUpdateCount = Object.keys(stats.jobUpdates).length;
    const customerUpdateCount = Object.keys(stats.customerUpdates).length;
    const vectorHashCount = Object.keys(stats.vectorHashes).length;

    console.log(`📝 Job Updates Tracked: ${jobUpdateCount}`);
    console.log(`👤 Customer Updates Tracked: ${customerUpdateCount}`);
    console.log(`🔗 Vector Hashes Tracked: ${vectorHashCount}`);
  } catch (error) {
    console.error("❌ Health check failed:", error);
    throw error;
  }
}

async function runStatsCheck(strategy: PineconePopulationStrategy) {
  console.log("📊 Checking current stats...");

  try {
    const stats = await strategy.getStats();
    const changeTracker = await strategy.getChangeTrackerStats();

    console.log("\n📈 Current Population Stats:");
    console.log(`📦 Total Jobs: ${stats.totalJobs}`);
    console.log(`✅ Processed Jobs: ${stats.processedJobs}`);
    console.log(`❌ Failed Jobs: ${stats.failedJobs}`);
    console.log(`📤 Vectors Upserted: ${stats.upsertedVectors}`);
    console.log(`🗑️  Vectors Deleted: ${stats.deletedVectors}`);

    if (stats.startTime) {
      console.log(`🕒 Start Time: ${stats.startTime}`);
    }

    if (stats.endTime) {
      console.log(`⏰ End Time: ${stats.endTime}`);
    }

    if (stats.duration) {
      console.log(
        `⏱️  Duration: ${(stats.duration / 1000).toFixed(2)} seconds`
      );
    }

    if (stats.averageProcessingTime) {
      console.log(
        `⚡ Average Processing Time: ${stats.averageProcessingTime.toFixed(
          2
        )}ms per job`
      );
    }

    if (stats.errors.length > 0) {
      console.log(`⚠️  Errors: ${stats.errors.length}`);
      stats.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    console.log("\n📋 Change Tracker Stats:");
    console.log(`🔄 Last Update: ${changeTracker.lastUpdate}`);
    console.log(`📦 Total Jobs: ${changeTracker.stats.totalJobs}`);
    console.log(`👥 Total Customers: ${changeTracker.stats.totalCustomers}`);
    console.log(`📊 Total Vectors: ${changeTracker.stats.totalVectors}`);
    console.log(`🕒 Last Full Sync: ${changeTracker.stats.lastFullSync}`);
  } catch (error) {
    console.error("❌ Stats check failed:", error);
    throw error;
  }
}

async function runReset(strategy: PineconePopulationStrategy) {
  console.log("🔄 Resetting change tracker...");

  try {
    await strategy.resetChangeTracker();
    console.log("✅ Change tracker reset successfully");

    // Show new stats
    const changeTracker = await strategy.getChangeTrackerStats();
    console.log("\n📋 New Change Tracker Stats:");
    console.log(`🔄 Last Update: ${changeTracker.lastUpdate}`);
    console.log(`📦 Total Jobs: ${changeTracker.stats.totalJobs}`);
    console.log(`👥 Total Customers: ${changeTracker.stats.totalCustomers}`);
    console.log(`📊 Total Vectors: ${changeTracker.stats.totalVectors}`);
    console.log(`🕒 Last Full Sync: ${changeTracker.stats.lastFullSync}`);
  } catch (error) {
    console.error("❌ Reset failed:", error);
    throw error;
  }
}

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n⚠️  Process interrupted by user");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n⚠️  Process terminated");
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});

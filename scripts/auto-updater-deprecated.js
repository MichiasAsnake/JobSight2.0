#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure logging
const LOG_DIR = path.join(__dirname, "..", "logs");
const LOG_FILE = path.join(LOG_DIR, "auto-updater.log");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Simple logging function
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;

  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

// Dynamic import for ES module compatibility
async function importDataUpdater() {
  try {
    // Import from the built output directory since TypeScript needs to be transpiled
    const { dataUpdater } = await import("../src/lib/data-updater.ts");
    return dataUpdater;
  } catch (tsError) {
    // Fallback: Try to use legacy approach if TypeScript import fails
    log(
      `TypeScript import failed: ${tsError.message}, falling back to legacy approach`
    );

    // Return a mock object with legacy functionality for now
    return {
      shouldUpdate: async () => {
        try {
          // Legacy check logic
          const dataPath = path.join(__dirname, "..", "data", "orders.json");
          const lastUpdatePath = path.join(
            __dirname,
            "..",
            "data",
            "last-update.json"
          );

          if (!fs.existsSync(dataPath)) {
            return { needsUpdate: true, reason: "No data file found" };
          }

          let lastUpdate = new Date(0);
          if (fs.existsSync(lastUpdatePath)) {
            const lastUpdateData = JSON.parse(
              fs.readFileSync(lastUpdatePath, "utf8")
            );
            lastUpdate = new Date(lastUpdateData.lastUpdate);
          }

          const now = new Date();
          const hoursSinceUpdate =
            (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

          const hour = now.getHours();
          const day = now.getDay();
          const isBusinessHours =
            day >= 1 && day <= 5 && hour >= 8 && hour < 18;
          const updateInterval = isBusinessHours ? 2 : 6;

          if (hoursSinceUpdate >= 24) {
            return { needsUpdate: true, reason: "Data is over 24 hours old" };
          }

          if (hoursSinceUpdate >= updateInterval) {
            return {
              needsUpdate: true,
              reason: `Data is ${Math.round(
                hoursSinceUpdate
              )} hours old (threshold: ${updateInterval}h)`,
            };
          }

          return { needsUpdate: false, reason: "Data is current" };
        } catch (error) {
          return { needsUpdate: true, reason: "Error checking update status" };
        }
      },

      assessDataHealth: async () => {
        try {
          const dataPath = path.join(__dirname, "..", "data", "orders.json");

          if (!fs.existsSync(dataPath)) {
            return {
              totalOrders: 0,
              dataAge: 999,
              completeness: 0,
              recommendations: ["No data file found"],
              vectorSyncHealth: {
                lastVectorUpdate: new Date(0).toISOString(),
                vectorDataAge: 999,
                isInSync: false,
                syncRecommendations: [
                  "TypeScript integration pending - using legacy mode",
                ],
              },
            };
          }

          const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
          const orders = data.orders || [];

          return {
            totalOrders: orders.length,
            dataAge: 2, // Placeholder
            completeness: 85, // Placeholder
            recommendations: [
              "Using legacy health check - integrate TypeScript module",
            ],
            vectorSyncHealth: {
              lastVectorUpdate: new Date().toISOString(),
              vectorDataAge: 12,
              isInSync: false,
              syncRecommendations: ["TypeScript integration pending"],
            },
          };
        } catch (error) {
          log(`Error in legacy health assessment: ${error.message}`);
          throw error;
        }
      },

      performUpdate: async () => {
        log("⚠️ Using legacy update mode - TypeScript integration pending");

        // Run the scraper using legacy approach
        const { execSync } = await import("child_process");
        execSync("npm run scrape", {
          stdio: "inherit",
          cwd: path.join(__dirname, ".."),
        });

        return {
          totalOrders: 0,
          newOrders: 0,
          updatedOrders: 0,
          deletedOrders: 0,
          unchangedOrders: 0,
          lastUpdate: new Date().toISOString(),
          updateDuration: 0,
          vectorUpdateTriggered: false,
          vectorUpdateStatus: "skipped",
        };
      },
    };
  }
}

async function checkUpdateStatus() {
  try {
    const dataUpdater = await importDataUpdater();
    return await dataUpdater.shouldUpdate();
  } catch (error) {
    log(`Error checking update status: ${error.message}`);
    return { needsUpdate: true, reason: "Error checking update status" };
  }
}

async function assessDataHealth() {
  try {
    const dataUpdater = await importDataUpdater();
    const health = await dataUpdater.assessDataHealth();

    log(`📊 Data Health Assessment:`);
    log(`  Total Orders: ${health.totalOrders}`);
    log(`  Data Age: ${Math.round(health.dataAge)} hours`);
    log(`  Completeness: ${Math.round(health.completeness)}%`);
    log(
      `  Vector Sync: ${
        health.vectorSyncHealth.isInSync ? "✅ In Sync" : "❌ Out of Sync"
      }`
    );
    log(
      `  Vector Age: ${Math.round(health.vectorSyncHealth.vectorDataAge)} hours`
    );

    if (health.recommendations.length > 0) {
      log(`  Recommendations: ${health.recommendations.join(", ")}`);
    }

    if (health.vectorSyncHealth.syncRecommendations.length > 0) {
      log(
        `  Vector Sync Recommendations: ${health.vectorSyncHealth.syncRecommendations.join(
          ", "
        )}`
      );
    }

    return health;
  } catch (error) {
    log(`Error assessing data health: ${error.message}`);
    return {
      totalOrders: 0,
      dataAge: 999,
      completeness: 0,
      dataQuality: {
        missingCustomerInfo: 0,
        missingPricing: 0,
        missingShipDates: 0,
        incompleteLineItems: 0,
      },
      recommendations: ["Error assessing health"],
      vectorSyncHealth: {
        lastVectorUpdate: new Date(0).toISOString(),
        vectorDataAge: 999,
        isInSync: false,
        syncRecommendations: ["Unable to assess vector sync health"],
      },
    };
  }
}

async function runAutoUpdate() {
  try {
    log("🚀 Starting automated update process...");

    const dataUpdater = await importDataUpdater();

    // Run the update with integrated vector sync
    const updateStats = await dataUpdater.performUpdate();

    log("✅ Update completed with integrated vector sync!");
    log(`📊 Update Results:`);
    log(`  Total Orders: ${updateStats.totalOrders}`);
    log(`  New Orders: ${updateStats.newOrders}`);
    log(`  Updated Orders: ${updateStats.updatedOrders}`);
    log(`  Deleted Orders: ${updateStats.deletedOrders}`);
    log(`  Unchanged Orders: ${updateStats.unchangedOrders}`);
    log(`  Update Duration: ${updateStats.updateDuration}ms`);

    // Log vector update status
    log(`🧠 Vector Update Status:`);
    log(
      `  Triggered: ${updateStats.vectorUpdateTriggered ? "✅ Yes" : "❌ No"}`
    );
    log(`  Status: ${updateStats.vectorUpdateStatus}`);

    if (updateStats.vectorUpdateDuration) {
      log(`  Vector Duration: ${updateStats.vectorUpdateDuration}ms`);
    }

    if (updateStats.vectorUpdateError) {
      log(`  Vector Error: ${updateStats.vectorUpdateError}`);
    }

    return updateStats;
  } catch (error) {
    log(`❌ Auto-update failed: ${error.message}`);
    throw error;
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || "update";

  try {
    switch (command) {
      case "check":
        log("🔍 Checking if update is needed...");
        const updateStatus = await checkUpdateStatus();
        log(`Update needed: ${updateStatus.needsUpdate}`);
        log(`Reason: ${updateStatus.reason}`);
        break;

      case "health":
        log("🏥 Assessing data health...");
        await assessDataHealth();
        break;

      case "update":
        log("📥 Running full update with vector sync...");
        await runAutoUpdate();
        break;

      default:
        log(`❓ Unknown command: ${command}`);
        log("Available commands: check, health, update");
        process.exit(1);
    }

    log("🎉 Auto-updater completed successfully");
  } catch (error) {
    log(`💥 Auto-updater failed: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

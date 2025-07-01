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

async function checkUpdateStatus() {
  try {
    // Check if data file exists
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

    // Check last update time
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

    // Business hours: 8 AM - 6 PM, Monday-Friday
    const hour = now.getHours();
    const day = now.getDay();
    const isBusinessHours = day >= 1 && day <= 5 && hour >= 8 && hour < 18;

    // Update rules
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
    log(`Error checking update status: ${error.message}`);
    return { needsUpdate: true, reason: "Error checking update status" };
  }
}

async function assessDataHealth() {
  try {
    const dataPath = path.join(__dirname, "..", "data", "orders.json");

    if (!fs.existsSync(dataPath)) {
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
        recommendations: ["No data file found"],
      };
    }

    const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const orders = data.orders || [];

    const lastUpdatePath = path.join(
      __dirname,
      "..",
      "data",
      "last-update.json"
    );
    let lastUpdate = new Date(0);
    if (fs.existsSync(lastUpdatePath)) {
      const lastUpdateData = JSON.parse(
        fs.readFileSync(lastUpdatePath, "utf8")
      );
      lastUpdate = new Date(lastUpdateData.lastUpdate);
    }

    const now = new Date();
    const dataAge = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    const dataQuality = {
      missingCustomerInfo: 0,
      missingPricing: 0,
      missingShipDates: 0,
      incompleteLineItems: 0,
    };

    let completeOrders = 0;

    for (const order of orders) {
      let isComplete = true;

      // Check customer info
      if (
        !order.customer?.contactPerson ||
        !order.customer?.phone ||
        !order.customer?.email
      ) {
        dataQuality.missingCustomerInfo++;
        isComplete = false;
      }

      // Check pricing
      if (!order.pricing?.totalDue || order.pricing.totalDue === 0) {
        dataQuality.missingPricing++;
        isComplete = false;
      }

      // Check ship dates
      if (!order.requestedShipDate) {
        dataQuality.missingShipDates++;
        isComplete = false;
      }

      // Check line items
      if (!order.lineItems || order.lineItems.length === 0) {
        dataQuality.incompleteLineItems++;
        isComplete = false;
      }

      if (isComplete) completeOrders++;
    }

    const completeness =
      orders.length > 0 ? (completeOrders / orders.length) * 100 : 0;

    const recommendations = [];

    if (dataAge > 24) {
      recommendations.push("Data is over 24 hours old - consider updating");
    }

    if (dataQuality.missingCustomerInfo > orders.length * 0.1) {
      recommendations.push("Many orders missing customer information");
    }

    if (dataQuality.missingPricing > orders.length * 0.05) {
      recommendations.push("Some orders missing pricing information");
    }

    return {
      totalOrders: orders.length,
      dataAge,
      completeness,
      dataQuality,
      recommendations,
    };
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
      recommendations: [`Error: ${error.message}`],
    };
  }
}

async function runAutoUpdate() {
  log("🚀 Starting automated data update check...");

  try {
    // Check if update is needed
    const updateStatus = await checkUpdateStatus();

    if (updateStatus.needsUpdate) {
      log(`📋 Update needed: ${updateStatus.reason}`);

      // Run the scraper
      const startTime = Date.now();

      // Import and run the scraper
      const { execSync } = await import("child_process");
      execSync("npm run scrape", {
        stdio: "inherit",
        cwd: path.join(__dirname, ".."),
      });

      const duration = Date.now() - startTime;

      log(`✅ Update completed successfully in ${duration}ms`);

      // Assess data health after update
      const health = await assessDataHealth();
      log(
        `📈 Data health: ${Math.round(
          health.completeness
        )}% complete, ${Math.round(health.dataAge)}h old`
      );

      if (health.recommendations.length > 0) {
        log(`💡 Recommendations: ${health.recommendations.join(", ")}`);
      }
    } else {
      log(`✅ No update needed: ${updateStatus.reason}`);
    }
  } catch (error) {
    log(`❌ Error during auto update: ${error.message}`);
    log(`🔍 Error details: ${error.stack}`);

    // Exit with error code for monitoring systems
    process.exit(1);
  }

  log("🏁 Automated update check completed");
}

// Handle command line arguments
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case "update":
    runAutoUpdate();
    break;

  case "check":
    checkUpdateStatus().then((status) => {
      log(
        `Update status: ${status.needsUpdate ? "Needed" : "Not needed"} - ${
          status.reason
        }`
      );
      process.exit(status.needsUpdate ? 1 : 0);
    });
    break;

  case "health":
    assessDataHealth().then((health) => {
      log(
        `Data health: ${Math.round(
          health.completeness
        )}% complete, ${Math.round(health.dataAge)}h old`
      );
      process.exit(health.completeness < 70 ? 1 : 0);
    });
    break;

  default:
    console.log("Usage: node auto-updater.js [update|check|health]");
    console.log("");
    console.log("Commands:");
    console.log("  update  - Check and perform update if needed");
    console.log(
      "  check   - Check if update is needed (exit code 1 if needed)"
    );
    console.log("  health  - Check data health (exit code 1 if poor health)");
    console.log("");
    console.log("Examples:");
    console.log("  node auto-updater.js update");
    console.log("  node auto-updater.js check");
    console.log("  node auto-updater.js health");
    process.exit(0);
}

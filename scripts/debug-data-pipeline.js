#!/usr/bin/env node

/**
 * Debug script to check the actual data pipeline
 * This will help identify why orders with @zairap tags aren't being found
 */

import { EnhancedFilteringService } from "../src/lib/enhanced-filtering-service.js";
import { apiFirstDataService } from "../src/lib/api-first-data-service.js";

async function debugDataPipeline() {
  console.log("🔍 Debugging Data Pipeline\n");

  try {
    const apiService = apiFirstDataService;
    const filteringService = new EnhancedFilteringService();

    // Step 1: Check what orders are actually loaded
    console.log("📊 Step 1: Loading orders from API...");
    const allOrders = await apiService.getAllOrders();
    console.log(`   Total orders loaded: ${allOrders.length}`);

    // Step 2: Check for orders with @zairap tags
    console.log("\n📋 Step 2: Checking for @zairap tags...");
    const ordersWithZairap = allOrders.filter(
      (order) =>
        order.tags &&
        order.tags.some((tag) => tag.tag.toLowerCase().includes("zairap"))
    );

    console.log(`   Orders with @zairap tags: ${ordersWithZairap.length}`);

    if (ordersWithZairap.length > 0) {
      console.log("\n   Orders found:");
      ordersWithZairap.forEach((order) => {
        const tags = order.tags?.map((t) => t.tag).join(", ") || "No tags";
        console.log(
          `   - Job ${order.jobNumber}: ${tags} (Due: ${order.dates.dateDue})`
        );
      });
    }

    // Step 3: Check date filtering
    console.log("\n📅 Step 3: Checking date filtering...");
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);

    console.log(
      `   This week range: ${startOfWeek.toISOString()} to ${endOfWeek.toISOString()}`
    );

    const ordersInDateRange = allOrders.filter((order) => {
      const orderDate = new Date(order.dates.dateDue);
      return orderDate >= startOfWeek && orderDate <= endOfWeek;
    });

    console.log(`   Orders in date range: ${ordersInDateRange.length}`);

    // Step 4: Check orders with @zairap in date range
    console.log("\n🎯 Step 4: Checking @zairap orders in date range...");
    const zairapInDateRange = ordersInDateRange.filter(
      (order) =>
        order.tags &&
        order.tags.some((tag) => tag.tag.toLowerCase().includes("zairap"))
    );

    console.log(`   @zairap orders in date range: ${zairapInDateRange.length}`);

    if (zairapInDateRange.length > 0) {
      console.log("\n   Orders found in date range:");
      zairapInDateRange.forEach((order) => {
        const tags = order.tags?.map((t) => t.tag).join(", ") || "No tags";
        console.log(
          `   - Job ${order.jobNumber}: ${tags} (Due: ${order.dates.dateDue})`
        );
      });
    }

    // Step 5: Test the actual filtering service
    console.log("\n🔧 Step 5: Testing EnhancedFilteringService...");

    const filterCriteria = {
      includeTags: ["@zairap"],
      dateRange: {
        start: startOfWeek,
        end: endOfWeek,
      },
    };

    const filteredResults = filteringService.filterOrders(
      ordersInDateRange,
      filterCriteria
    );
    console.log(`   Filtered results: ${filteredResults.length} orders`);

    if (filteredResults.length > 0) {
      console.log("\n   Filtered orders:");
      filteredResults.forEach((order) => {
        const tags = order.tags?.map((t) => t.tag).join(", ") || "No tags";
        console.log(
          `   - Job ${order.jobNumber}: ${tags} (Due: ${order.dates.dateDue})`
        );
      });
    }

    // Step 6: Check all unique tags in the system
    console.log("\n🏷️ Step 6: Checking all unique tags...");
    const allTags = new Set();
    allOrders.forEach((order) => {
      if (order.tags) {
        order.tags.forEach((tag) => {
          allTags.add(tag.tag);
        });
      }
    });

    const sortedTags = Array.from(allTags).sort();
    console.log(`   Total unique tags: ${sortedTags.length}`);
    console.log("   Sample tags:");
    sortedTags.slice(0, 20).forEach((tag) => {
      console.log(`   - ${tag}`);
    });

    if (sortedTags.length > 20) {
      console.log(`   ... and ${sortedTags.length - 20} more tags`);
    }
  } catch (error) {
    console.error("❌ Error debugging data pipeline:", error.message);
    console.error(error.stack);
  }
}

// Run the debug
debugDataPipeline();

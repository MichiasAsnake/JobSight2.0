import fs from "fs";
import path from "path";
import { omsDataService, Order, OrdersData } from "./oms-data";

interface UpdateStats {
  totalOrders: number;
  newOrders: number;
  updatedOrders: number;
  deletedOrders: number;
  unchangedOrders: number;
  lastUpdate: string;
  updateDuration: number;
}

interface DataHealth {
  totalOrders: number;
  dataAge: number; // hours since last update
  completeness: number; // percentage of orders with complete data
  dataQuality: {
    missingCustomerInfo: number;
    missingPricing: number;
    missingShipDates: number;
    incompleteLineItems: number;
  };
  recommendations: string[];
}

class DataUpdater {
  private dataPath: string;
  private backupPath: string;
  private lastUpdatePath: string;
  private updateStatsPath: string;

  constructor() {
    this.dataPath = path.join(process.cwd(), "data", "orders.json");
    this.backupPath = path.join(process.cwd(), "data", "orders.backup.json");
    this.lastUpdatePath = path.join(process.cwd(), "data", "last-update.json");
    this.updateStatsPath = path.join(
      process.cwd(),
      "data",
      "update-stats.json"
    );
  }

  // Check if data needs updating based on age and business rules
  async shouldUpdate(): Promise<{ needsUpdate: boolean; reason: string }> {
    try {
      const lastUpdate = await this.getLastUpdateTime();
      const now = new Date();
      const hoursSinceUpdate =
        (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      // Business hours: 8 AM - 6 PM, Monday-Friday
      const isBusinessHours = this.isBusinessHours(now);

      // Update rules:
      // - During business hours: every 2 hours
      // - Outside business hours: every 6 hours
      // - Always update if more than 24 hours old
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
      console.error("Error checking update status:", error);
      return { needsUpdate: true, reason: "Error checking update status" };
    }
  }

  // Perform smart incremental update
  async performUpdate(): Promise<UpdateStats> {
    console.log("🔄 Starting smart data update...");

    try {
      // Create backup before update
      await this.createBackup();

      // Load current data
      const currentData = await this.loadCurrentData();
      const currentOrders = currentData.orders || [];

      // Run scraper to get fresh data
      const { scrapeOrders } = await import("../../scrape.js");
      const freshOrders = await scrapeOrders();

      // Compare and merge data
      const updateStats = await this.mergeData(currentOrders, freshOrders);

      // Save updated data
      const updatedData: OrdersData = {
        orders: freshOrders,
        summary: {
          totalOrders: freshOrders.length,
          lastUpdated: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
        },
      };

      await this.saveData(updatedData);
      await this.saveUpdateStats(updateStats);
      await this.saveLastUpdateTime();

      console.log("✅ Data update completed successfully");
      return updateStats;
    } catch (error) {
      console.error("❌ Error during data update:", error);

      // Restore from backup if update failed
      await this.restoreFromBackup();

      throw error;
    }
  }

  // Smart data merging with change detection
  private async mergeData(
    currentOrders: Order[],
    freshOrders: Order[]
  ): Promise<UpdateStats> {
    const stats: UpdateStats = {
      totalOrders: freshOrders.length,
      newOrders: 0,
      updatedOrders: 0,
      deletedOrders: 0,
      unchangedOrders: 0,
      lastUpdate: new Date().toISOString(),
      updateDuration: 0,
    };

    const currentOrderMap = new Map(
      currentOrders.map((order) => [order.jobNumber, order])
    );
    const freshOrderMap = new Map(
      freshOrders.map((order) => [order.jobNumber, order])
    );

    // Find new orders
    for (const [jobNumber] of freshOrderMap) {
      if (!currentOrderMap.has(jobNumber)) {
        stats.newOrders++;
        console.log(`🆕 New order detected: Job ${jobNumber}`);
      }
    }

    // Find updated orders
    for (const [jobNumber, freshOrder] of freshOrderMap) {
      const currentOrder = currentOrderMap.get(jobNumber);
      if (
        currentOrder &&
        this.hasSignificantChanges(currentOrder, freshOrder)
      ) {
        stats.updatedOrders++;
        console.log(`🔄 Order updated: Job ${jobNumber}`);
      } else if (currentOrder) {
        stats.unchangedOrders++;
      }
    }

    // Find deleted orders (orders that exist in current but not in fresh)
    for (const [jobNumber] of currentOrderMap) {
      if (!freshOrderMap.has(jobNumber)) {
        stats.deletedOrders++;
        console.log(`🗑️ Order deleted: Job ${jobNumber}`);
      }
    }

    return stats;
  }

  // Detect significant changes in order data
  private hasSignificantChanges(current: Order, fresh: Order): boolean {
    const significantFields = [
      "status",
      "priority",
      "requestedShipDate",
      "pricing.totalDue",
      "customer.contactPerson",
      "customer.phone",
      "customer.email",
    ];

    for (const field of significantFields) {
      const currentValue = this.getNestedValue(current, field);
      const freshValue = this.getNestedValue(fresh, field);

      if (currentValue !== freshValue) {
        return true;
      }
    }

    // Check for changes in line items count
    if (current.lineItems.length !== fresh.lineItems.length) {
      return true;
    }

    // Check for changes in shipments
    if (current.shipments.length !== fresh.shipments.length) {
      return true;
    }

    return false;
  }

  // Get nested object value
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  // Check if current time is during business hours
  private isBusinessHours(date: Date): boolean {
    const hour = date.getHours();
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

    // Monday-Friday, 8 AM - 6 PM
    return day >= 1 && day <= 5 && hour >= 8 && hour < 18;
  }

  // Data health assessment
  async assessDataHealth(): Promise<DataHealth> {
    try {
      const orders = await omsDataService.getOrders();
      const lastUpdate = await this.getLastUpdateTime();
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
          !order.customer.contactPerson ||
          !order.customer.phone ||
          !order.customer.email
        ) {
          dataQuality.missingCustomerInfo++;
          isComplete = false;
        }

        // Check pricing
        if (order.pricing.totalDue === 0) {
          dataQuality.missingPricing++;
          isComplete = false;
        }

        // Check ship dates
        if (!order.requestedShipDate) {
          dataQuality.missingShipDates++;
          isComplete = false;
        }

        // Check line items
        if (
          order.lineItems.length === 0 ||
          order.lineItems.some((item) => !item.description)
        ) {
          dataQuality.incompleteLineItems++;
          isComplete = false;
        }

        if (isComplete) completeOrders++;
      }

      const completeness = (completeOrders / orders.length) * 100;

      const recommendations: string[] = [];

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
      console.error("Error assessing data health:", error);
      throw error;
    }
  }

  // Backup and restore functions
  private async createBackup(): Promise<void> {
    if (fs.existsSync(this.dataPath)) {
      fs.copyFileSync(this.dataPath, this.backupPath);
      console.log("💾 Backup created");
    }
  }

  private async restoreFromBackup(): Promise<void> {
    if (fs.existsSync(this.backupPath)) {
      fs.copyFileSync(this.backupPath, this.dataPath);
      console.log("🔄 Restored from backup");
    }
  }

  // Data loading and saving
  private async loadCurrentData(): Promise<OrdersData> {
    if (fs.existsSync(this.dataPath)) {
      const data = fs.readFileSync(this.dataPath, "utf8");
      return JSON.parse(data);
    }
    return {
      orders: [],
      summary: { totalOrders: 0, lastUpdated: "", scrapedAt: "" },
    };
  }

  private async saveData(data: OrdersData): Promise<void> {
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), "utf8");
  }

  private async getLastUpdateTime(): Promise<Date> {
    if (fs.existsSync(this.lastUpdatePath)) {
      const data = fs.readFileSync(this.lastUpdatePath, "utf8");
      const parsed = JSON.parse(data);
      return new Date(parsed.lastUpdate);
    }
    return new Date(0); // Return epoch time if no last update
  }

  private async saveLastUpdateTime(): Promise<void> {
    const data = { lastUpdate: new Date().toISOString() };
    fs.writeFileSync(
      this.lastUpdatePath,
      JSON.stringify(data, null, 2),
      "utf8"
    );
  }

  private async saveUpdateStats(stats: UpdateStats): Promise<void> {
    fs.writeFileSync(
      this.updateStatsPath,
      JSON.stringify(stats, null, 2),
      "utf8"
    );
  }

  // Get update statistics
  async getUpdateStats(): Promise<UpdateStats | null> {
    if (fs.existsSync(this.updateStatsPath)) {
      const data = fs.readFileSync(this.updateStatsPath, "utf8");
      return JSON.parse(data);
    }
    return null;
  }
}

export const dataUpdater = new DataUpdater();

#!/usr/bin/env node
// Simple API Response Collector
// Makes HTTP requests to the running development server to collect API responses

const fs = require("fs");
const path = require("path");

// Configuration
const BASE_URL = "http://localhost:3001";
const DATA_DIR = path.join(process.cwd(), "data");

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class SimpleAPIResponseCollector {
  constructor() {
    this.responses = [];
    this.selectedJobNumber = "";
    this.selectedCustomerId = "";
  }

  async makeRequest(url, options = {}) {
    const fetch = (await import("node-fetch")).default;

    try {
      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Request failed for ${url}:`, error.message);
      throw error;
    }
  }

  async collectAllResponses() {
    console.log("🚀 Starting Simple API Response Collection...\n");

    try {
      // Step 1: Test the server is running
      console.log("🔍 Step 1: Testing server connection...");
      try {
        await this.makeRequest(`${BASE_URL}/api/admin/health`);
        console.log("✅ Server is running");
      } catch (error) {
        console.log("❌ Server not responding, trying to start it...");
        console.log(
          "💡 Please run 'npm run dev' in another terminal and try again"
        );
        return;
      }

      // Step 2: Get vector stats to see what data is available
      console.log("📊 Step 2: Getting vector database stats...");
      const vectorStatsResponse = await this.callGetVectorStats();
      this.responses.push(vectorStatsResponse);

      // Step 3: Get admin health data
      console.log("🏥 Step 3: Getting admin health data...");
      const healthResponse = await this.callGetAdminHealth();
      this.responses.push(healthResponse);

      // Step 4: Get admin metrics
      console.log("📈 Step 4: Getting admin metrics...");
      const metricsResponse = await this.callGetAdminMetrics();
      this.responses.push(metricsResponse);

      // Step 5: Get admin logs
      console.log("📋 Step 5: Getting admin logs...");
      const logsResponse = await this.callGetAdminLogs();
      this.responses.push(logsResponse);

      // Step 6: Get admin config
      console.log("⚙️ Step 6: Getting admin config...");
      const configResponse = await this.callGetAdminConfig();
      this.responses.push(configResponse);

      // Step 7: Test data update endpoint
      console.log("🔄 Step 7: Testing data update endpoint...");
      const dataUpdateResponse = await this.callGetDataUpdate();
      this.responses.push(dataUpdateResponse);

      // Save all responses
      await this.saveResponses();

      console.log("\n🎉 Simple API Response Collection Complete!");
      console.log(`📊 Collected ${this.responses.length} API responses`);
      console.log("💾 Responses saved to data/simple-api-responses.json");
    } catch (error) {
      console.error("❌ API Response Collection failed:", error);
      await this.saveResponses();
      process.exit(1);
    }
  }

  async callGetVectorStats() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/vector-stats`);
      return {
        endpoint: "vector-stats",
        url: "/api/vector-stats",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "vector-stats",
        url: "/api/vector-stats",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAdminHealth() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/admin/health`);
      return {
        endpoint: "admin-health",
        url: "/api/admin/health",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "admin-health",
        url: "/api/admin/health",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAdminMetrics() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/admin/metrics`);
      return {
        endpoint: "admin-metrics",
        url: "/api/admin/metrics",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "admin-metrics",
        url: "/api/admin/metrics",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAdminLogs() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/admin/logs`);
      return {
        endpoint: "admin-logs",
        url: "/api/admin/logs",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "admin-logs",
        url: "/api/admin/logs",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAdminConfig() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/admin/config`);
      return {
        endpoint: "admin-config",
        url: "/api/admin/config",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "admin-config",
        url: "/api/admin/config",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetDataUpdate() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/data/update`);
      return {
        endpoint: "data-update",
        url: "/api/data/update",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "data-update",
        url: "/api/data/update",
        method: "GET",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async saveResponses() {
    const outputPath = path.join(DATA_DIR, "simple-api-responses.json");

    const output = {
      metadata: {
        collectedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
        totalEndpoints: this.responses.length,
        successfulCalls: this.responses.filter((r) => !r.error).length,
        failedCalls: this.responses.filter((r) => r.error).length,
      },
      responses: this.responses,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved API responses to ${outputPath}`);
  }
}

// Run the collection
const collector = new SimpleAPIResponseCollector();
collector
  .collectAllResponses()
  .then(() => {
    console.log("\n✅ Simple API Response Collection completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Simple API Response Collection failed:", error);
    process.exit(1);
  });

#!/usr/bin/env node

// Admin Dashboard Test Script - Tests all admin endpoints and functionality

const http = require("http");
const url = require("url");

const BASE_URL = "http://localhost:3000";

async function makeRequest(endpoint, method = "GET") {
  return new Promise((resolve, reject) => {
    const options = {
      ...url.parse(`${BASE_URL}${endpoint}`),
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AdminDashboardTest/1.0",
      },
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: data,
            error: "Invalid JSON response",
          });
        }
      });
    });

    req.on("error", reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.end();
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

async function testHealthEndpoint() {
  console.log("\n🏥 Testing Health Endpoint...");

  try {
    const response = await makeRequest("/api/admin/health");

    if (response.status === 200) {
      const { data } = response;
      console.log(`✅ Health endpoint responding (${response.status})`);
      console.log(`📊 Overall health: ${data.status}`);
      console.log(
        `🔧 Components checked: ${Object.keys(data.components || {}).length}`
      );

      if (data.components) {
        Object.entries(data.components).forEach(([name, status]) => {
          const icon = status.status === "healthy" ? "✅" : "❌";
          console.log(
            `   ${icon} ${name}: ${status.status} (${formatDuration(
              status.responseTime || 0
            )})`
          );
        });
      }

      return true;
    } else {
      console.log(`❌ Health endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Health endpoint error: ${error.message}`);
    return false;
  }
}

async function testMetricsEndpoint() {
  console.log("\n📊 Testing Metrics Endpoint...");

  try {
    const response = await makeRequest("/api/admin/metrics");

    if (response.status === 200) {
      const { data } = response;
      console.log(`✅ Metrics endpoint responding (${response.status})`);

      if (data.performance) {
        console.log(`🎯 Performance score: ${data.performance.score}/100`);
        console.log(
          `📈 Success rate: ${(data.performance.successRate * 100).toFixed(1)}%`
        );
        console.log(
          `⚡ Avg response time: ${formatDuration(
            data.performance.avgResponseTime || 0
          )}`
        );
      }

      if (data.cache) {
        console.log(
          `💾 Cache hit rate: ${(data.cache.hitRate * 100).toFixed(1)}%`
        );
        console.log(`📦 Cache size: ${formatBytes(data.cache.size || 0)}`);
        console.log(`🗂️  Cache entries: ${data.cache.entries || 0}`);
      }

      return true;
    } else {
      console.log(`❌ Metrics endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Metrics endpoint error: ${error.message}`);
    return false;
  }
}

async function testLogsEndpoint() {
  console.log("\n📝 Testing Logs Endpoint...");

  try {
    const response = await makeRequest("/api/admin/logs");

    if (response.status === 200) {
      const { data } = response;
      console.log(`✅ Logs endpoint responding (${response.status})`);
      console.log(`📄 Total logs: ${data.logs?.length || 0}`);

      if (data.summary) {
        console.log("📊 Log levels summary:");
        Object.entries(data.summary.levels || {}).forEach(([level, count]) => {
          const icon =
            level === "error" ? "🔴" : level === "warn" ? "🟡" : "🟢";
          console.log(`   ${icon} ${level}: ${count}`);
        });
      }

      return true;
    } else {
      console.log(`❌ Logs endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Logs endpoint error: ${error.message}`);
    return false;
  }
}

async function testConfigEndpoint() {
  console.log("\n⚙️  Testing Config Endpoint...");

  try {
    const response = await makeRequest("/api/admin/config");

    if (response.status === 200) {
      const { data } = response;
      console.log(`✅ Config endpoint responding (${response.status})`);
      console.log(
        `🔧 Configuration categories: ${data.categories?.length || 0}`
      );

      if (data.environment) {
        console.log(`🌍 Environment: ${data.environment.environment}`);
        console.log(`📦 Version: ${data.environment.version}`);
      }

      return true;
    } else {
      console.log(`❌ Config endpoint failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Config endpoint error: ${error.message}`);
    return false;
  }
}

async function runFullTest() {
  console.log("🚀 OMS Admin Dashboard - Comprehensive Test Suite");
  console.log("================================================");

  const startTime = Date.now();
  const results = {
    health: false,
    metrics: false,
    logs: false,
    config: false,
  };

  // Test all endpoints
  results.health = await testHealthEndpoint();
  results.metrics = await testMetricsEndpoint();
  results.logs = await testLogsEndpoint();
  results.config = await testConfigEndpoint();

  // Summary
  const totalDuration = Date.now() - startTime;
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;

  console.log("\n📋 Test Results Summary");
  console.log("========================");
  console.log(`✅ Passed: ${passed}/${total} tests`);
  console.log(`⏱️  Total time: ${formatDuration(totalDuration)}`);
  console.log(`🎯 Success rate: ${((passed / total) * 100).toFixed(1)}%`);

  console.log("\n🔍 Detailed Results:");
  Object.entries(results).forEach(([test, passed]) => {
    console.log(
      `   ${passed ? "✅" : "❌"} ${
        test.charAt(0).toUpperCase() + test.slice(1)
      }`
    );
  });

  if (passed === total) {
    console.log("\n🎉 All tests passed! Admin dashboard is fully operational.");
    console.log("🌟 Phase 4 admin dashboard implementation complete!");
  } else {
    console.log(
      "\n⚠️  Some tests failed. Please check the server and try again."
    );
  }

  console.log("\n📚 Next Steps:");
  console.log("   1. Visit http://localhost:3000/admin to see the dashboard");
  console.log("   2. Check system health and metrics");
  console.log("   3. Review recent logs and configuration");

  process.exit(passed === total ? 0 : 1);
}

// Run the test suite
runFullTest();

#!/usr/bin/env node
require("dotenv").config();

// Debug: print cookie length
console.log(
  "🔍 OMS_AUTH_COOKIES length:",
  process.env.OMS_AUTH_COOKIES ? process.env.OMS_AUTH_COOKIES.length : "Not set"
);

// Direct OMS API Endpoint Tester (CommonJS Version)
// Calls OMS APIs directly for vector database population

const fs = require("fs");
const path = require("path");

// Configuration
const DATA_DIR = path.join(process.cwd(), "data");

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class DirectOMSAPITester {
  constructor() {
    this.responses = [];
    this.jobNumbers = [];
    this.customerIds = [];
    this.categoryUnitIds = [];
    this.priceCodes = [];
    this.assetTags = [];
  }

  async makeRequest(url, options = {}) {
    const fetch = (await import("node-fetch")).default;

    try {
      console.log(`🔍 Making request to: ${url}`);
      console.log(
        `🔍 Using cookies: ${process.env.OMS_AUTH_COOKIES ? "Set" : "Not set"}`
      );
      if (process.env.OMS_AUTH_COOKIES) {
        console.log(
          `🔍 Cookie length: ${process.env.OMS_AUTH_COOKIES.length} characters`
        );
      }

      const response = await fetch(url, {
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Content-Type": options.contentType || "application/json",
          Cookie: process.env.OMS_AUTH_COOKIES || "",
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const text = await response.text();
        console.log(`🔍 Response status: ${response.status}`);
        console.log(
          `🔍 Response headers:`,
          Object.fromEntries(response.headers.entries())
        );
        console.log(
          `🔍 Response body (first 500 chars):`,
          text.substring(0, 500)
        );
        if (text.includes("<!DOCTYPE") || text.includes("<html")) {
          throw new Error(`Authentication failed - redirected to login page`);
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Try to parse as JSON first, regardless of content-type
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return data;
      } catch (parseError) {
        // If JSON parsing fails, then it's not a JSON response
        throw new Error(
          `Expected JSON response, got: ${text.substring(0, 200)}...`
        );
      }
    } catch (error) {
      console.error(`❌ Request failed for ${url}:`, error.message);
      throw error;
    }
  }

  async collectAllResponses() {
    console.log("🚀 Starting Direct OMS API Endpoint Testing...\n");

    try {
      // Step 1: Test API connection
      console.log("🔧 Step 1: Testing API connection...");
      try {
        // Test with a simple request to verify connectivity
        const defaultFilters = {
          "machine-filter":
            "US,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384",
          "status-line-format": "[MASTERJOBSTATUS] - [STOCKSTATUS]",
          "no-loc-token": "[NOLOC]",
          "show-due-date-filter": "true",
          "tagged-user": "@laser",
          "app-timezone": "America/Los_Angeles",
          location: "-1",
          "job-status-codes": "approved,ontime,runninglate,problem",
          "sort-by": "dateduefactory",
          "sort-direction": "asc",
          "job-status": "5,6,7,8",
          "due-date": "1,2,3",
          "stock-status": "0,1,2",
          "process-filter":
            "HW,AP,TC,MP,PR,NA,CR,DS,ES,PP,PA,EM,SW,SC,DF,Misc,Sewing,Dispatch,Stock,Bagging",
          bit: "get-job-list",
          "page-size": "200",
          "requested-page": "",
          "get-job-counts": "true",
        };
        const formData = new URLSearchParams(defaultFilters);

        await this.makeRequest(
          "https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
          {
            method: "POST",
            headers: {
              Accept: "application/json, text/javascript, */*; q=0.01",
              "Accept-Language": "en-US,en;q=0.9",
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Content-Type": "application/x-www-form-urlencoded",
              Cookie: process.env.OMS_AUTH_COOKIES || "",
            },
            body: formData.toString(),
          }
        );
        console.log("✅ API connection successful");
      } catch (error) {
        console.log("❌ API connection failed:", error.message);
        console.log(
          "💡 Please check your OMS_AUTH_COOKIES environment variable"
        );
        return;
      }

      // Step 2: Get job list (foundation for other endpoints)
      console.log("📋 Step 2: Getting job list...");
      const jobListResponse = await this.callGetJobList();
      this.responses.push(jobListResponse);

      // Extract job numbers and customer IDs for dependent calls
      if (
        jobListResponse.response &&
        jobListResponse.response.data &&
        jobListResponse.response.data.Entities
      ) {
        const jobs = jobListResponse.response.data.Entities;
        this.jobNumbers = jobs
          .map((job) => job.JobNumber.toString())
          .slice(0, 5); // Limit to 5 jobs
        this.customerIds = [
          ...new Set(
            jobs.map((job) => job.CustomerId.toString()).filter(Boolean)
          ),
        ].slice(0, 3); // Limit to 3 customers

        console.log(
          `📊 Found ${jobs.length} jobs, testing ${this.jobNumbers.length} jobs and ${this.customerIds.length} customers`
        );
      } else {
        console.log("⚠️ No jobs found in job list response");
        console.log("💡 This might be due to authentication or no active jobs");
        return;
      }

      // Step 3: Get job lines for each job
      console.log("📦 Step 3: Getting job lines for each job...");
      for (const jobNumber of this.jobNumbers) {
        const jobLinesResponse = await this.callGetJoblines(jobNumber);
        this.responses.push(jobLinesResponse);

        // Extract category unit IDs and price codes for pricing calls
        if (
          jobLinesResponse.response &&
          jobLinesResponse.response.data &&
          jobLinesResponse.response.data.length > 0
        ) {
          const jobLines = jobLinesResponse.response.data;

          // Extract category unit IDs from process codes or asset SKUs
          const categoryUnitIds = jobLines
            .map((line) => {
              // Try to extract category unit ID from process codes or asset SKU
              if (line.ProcessCodes && line.ProcessCodes.length > 0) {
                return line.ProcessCodes[0];
              }
              if (line.AssetSKU) {
                // Extract numeric part from asset SKU if it looks like a category unit ID
                const match = line.AssetSKU.match(/\d+/);
                return match ? match[0] : null;
              }
              return null;
            })
            .filter(Boolean);
          this.categoryUnitIds.push(...categoryUnitIds);

          // For price codes, we'll use defaults since they're not directly available
          this.priceCodes.push("EM_DIRECT", "EM_WHOLESALE", "EM_RETAIL");
        }
      }

      // Step 4: Get cost details for each job
      console.log("💰 Step 4: Getting cost details for each job...");
      for (const jobNumber of this.jobNumbers) {
        const costDetailsResponse = await this.callGetJoblinesCostDetails(
          jobNumber
        );
        this.responses.push(costDetailsResponse);
      }

      // Step 5: Get stock/inward items for each job
      console.log("📦 Step 5: Getting stock/inward items for each job...");
      for (const jobNumber of this.jobNumbers) {
        const stockResponse = await this.callGetAllInwardsAndStockItems(
          jobNumber
        );
        this.responses.push(stockResponse);
      }

      // Step 6: Get shipments for each job
      console.log("🚚 Step 6: Getting shipments for each job...");
      for (const jobNumber of this.jobNumbers) {
        const shipmentsResponse = await this.callGetJobShipments(jobNumber);
        this.responses.push(shipmentsResponse);
      }

      // Step 7: Get delivery options for each customer
      console.log("📬 Step 7: Getting delivery options for each customer...");
      for (const customerId of this.customerIds) {
        const deliveryResponse = await this.callGetDeliveryOptions(customerId);
        this.responses.push(deliveryResponse);
      }

      // Step 8: Get pricing quantity bands for extracted data
      console.log("💰 Step 8: Getting pricing quantity bands...");
      const uniqueCategoryUnitIds = [...new Set(this.categoryUnitIds)].slice(
        0,
        3
      ); // Limit to 3
      const uniquePriceCodes = [...new Set(this.priceCodes)].slice(0, 3); // Limit to 3

      for (const categoryUnitId of uniqueCategoryUnitIds) {
        for (const priceCode of uniquePriceCodes) {
          const pricingResponse = await this.callGetPriceQuantityBands(
            categoryUnitId,
            "F",
            priceCode
          );
          this.responses.push(pricingResponse);
        }
      }

      // Step 9: Get all category units (reference data)
      console.log("📂 Step 9: Getting all category units...");
      const categoryUnitsResponse = await this.callGetAllCategoryUnits();
      this.responses.push(categoryUnitsResponse);

      // Step 10: Get job history for each job
      console.log("📋 Step 10: Getting job history for each job...");
      for (const jobNumber of this.jobNumbers) {
        const historyResponse = await this.callGetJobHistory(jobNumber);
        this.responses.push(historyResponse);
      }

      // Step 11: Get customer details for each customer
      console.log("👤 Step 11: Getting customer details for each customer...");
      for (const customerId of this.customerIds) {
        const customerResponse = await this.callGetCustomerById(customerId);
        this.responses.push(customerResponse);
      }

      // Save all responses
      await this.saveResponses();

      console.log("\n🎉 Direct OMS API Endpoint Testing Complete!");
      console.log(`📊 Collected ${this.responses.length} API responses`);
      console.log(`📋 Tested ${this.jobNumbers.length} jobs`);
      console.log(`👤 Tested ${this.customerIds.length} customers`);
      console.log("💾 Responses saved to data/direct-oms-responses.json");
    } catch (error) {
      console.error("❌ Direct OMS API Endpoint Testing failed:", error);
      await this.saveResponses();
      process.exit(1);
    }
  }

  async callGetJobList() {
    try {
      const formData = new URLSearchParams({
        "machine-filter":
          "US,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384",
        "status-line-format": "[MASTERJOBSTATUS] - [STOCKSTATUS]",
        "no-loc-token": "[NOLOC]",
        "show-due-date-filter": "true",
        "tagged-user": "@laser",
        "app-timezone": "America/Los_Angeles",
        "text-filter": "",
        location: "-1",
        "job-status-codes": "approved,ontime,runninglate,problem",
        "sort-by": "dateduefactory",
        "sort-direction": "asc",
        "job-status": "5,6,7,8",
        "due-date": "1,2,3",
        "stock-status": "0,1,2",
        "process-filter":
          "HW,AP,TC,MP,PR,NA,CR,DS,ES,PP,PA,EM,SW,SC,DF,Misc,Sewing,Dispatch,Stock,Bagging",
        bit: "get-job-list",
        "page-size": "50",
        "requested-page": "1",
        "user-def-sort-def": "status,stockstatus",
        "get-job-counts": "true",
      });

      const response = await this.makeRequest(
        "https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
        {
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          body: formData.toString(),
        }
      );

      return {
        endpoint: "get-job-list",
        url: "https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: Object.fromEntries(formData.entries()),
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-list",
        url: "https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: {},
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetJoblines(jobNumber) {
    try {
      const response = await this.makeRequest(
        `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`
      );
      return {
        endpoint: "get-joblines",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-joblines",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-joblines",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-joblines",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetJoblinesCostDetails(jobNumber) {
    try {
      const formData = new URLSearchParams({
        bit: "get-joblines-cost-details",
        jobNumber: jobNumber,
      });

      const response = await this.makeRequest(
        "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        {
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          body: formData.toString(),
        }
      );

      return {
        endpoint: "get-joblines-cost-details",
        url: "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: Object.fromEntries(formData.entries()),
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-joblines-cost-details",
        url: "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: {
          bit: "get-joblines-cost-details",
          jobNumber: jobNumber,
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAllInwardsAndStockItems(jobNumber) {
    try {
      const response = await this.makeRequest(
        `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber=${jobNumber}`
      );
      return {
        endpoint: "get-all-inwards-and-stock-items",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-all-inwards-and-stock-items",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-all-inwards-and-stock-items",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-all-inwards-and-stock-items",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetJobShipments(jobNumber) {
    try {
      const response = await this.makeRequest(
        `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber=${jobNumber}`
      );
      return {
        endpoint: "get-job-shipments",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-job-shipments",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-shipments",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-job-shipments",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetDeliveryOptions(customerId) {
    try {
      const response = await this.makeRequest(
        `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId=${customerId}`
      );
      return {
        endpoint: "get-delivery-options",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId=${customerId}`,
        method: "GET",
        parameters: {
          customerId: customerId,
          bit: "get-delivery-options",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-delivery-options",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId=${customerId}`,
        method: "GET",
        parameters: {
          customerId: customerId,
          bit: "get-delivery-options",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetPriceQuantityBands(categoryUnitId, priceTier, priceCode) {
    try {
      const formData = new URLSearchParams({
        "category-unit-id": categoryUnitId,
        "price-tier": priceTier,
        "price-code": priceCode,
        bit: "get-price-quantity-bands",
      });

      const response = await this.makeRequest(
        "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx",
        {
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          body: formData.toString(),
        }
      );

      return {
        endpoint: "get-price-quantity-bands",
        url: "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: Object.fromEntries(formData.entries()),
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-price-quantity-bands",
        url: "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: {
          "category-unit-id": categoryUnitId,
          "price-tier": priceTier,
          "price-code": priceCode,
          bit: "get-price-quantity-bands",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetAllCategoryUnits() {
    try {
      const response = await this.makeRequest(
        "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units"
      );
      return {
        endpoint: "get-all-category-units",
        url: "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units",
        method: "GET",
        parameters: {
          bit: "get-all-category-units",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-all-category-units",
        url: "https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units",
        method: "GET",
        parameters: {
          bit: "get-all-category-units",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetJobHistory(jobNumber) {
    try {
      const response = await this.makeRequest(
        `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`
      );
      return {
        endpoint: "get-job-history",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-job-history",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-history",
        url: `https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`,
        method: "GET",
        parameters: {
          jobNumber: jobNumber,
          bit: "get-job-history",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetCustomerById(customerId) {
    try {
      const formData = new URLSearchParams({
        customerId,
        bit: "get-customer-by-id",
      });

      const response = await this.makeRequest(
        "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        {
          method: "POST",
          contentType: "application/x-www-form-urlencoded",
          body: formData.toString(),
        }
      );
      return {
        endpoint: "get-customer-by-id",
        url: "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: Object.fromEntries(formData.entries()),
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-customer-by-id",
        url: "https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        parameters: {
          customerId,
          bit: "get-customer-by-id",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async saveResponses() {
    const outputPath = path.join(DATA_DIR, "direct-oms-responses.json");

    const output = {
      metadata: {
        collectedAt: new Date().toISOString(),
        baseUrl: "https://intranet.decopress.com",
        totalEndpoints: this.responses.length,
        successfulCalls: this.responses.filter((r) => !r.error).length,
        failedCalls: this.responses.filter((r) => r.error).length,
        jobsTested: this.jobNumbers,
        customersTested: this.customerIds,
        categoryUnitIdsTested: [...new Set(this.categoryUnitIds)],
        priceCodesTested: [...new Set(this.priceCodes)],
        endpointsCovered: [
          "get-job-list",
          "get-joblines",
          "get-joblines-cost-details",
          "get-all-inwards-and-stock-items",
          "get-job-shipments",
          "get-delivery-options",
          "get-price-quantity-bands",
          "get-all-category-units",
          "get-job-history",
          "get-customer-by-id",
        ],
      },
      responses: this.responses,
      relationships: {
        jobDependencies: this.jobNumbers.map((jobNumber) => ({
          jobNumber,
          dependentEndpoints: [
            "get-joblines",
            "get-joblines-cost-details",
            "get-all-inwards-and-stock-items",
            "get-job-shipments",
            "get-job-history",
          ],
        })),
        customerDependencies: this.customerIds.map((customerId) => ({
          customerId,
          dependentEndpoints: ["get-delivery-options", "get-customer-by-id"],
        })),
      },
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`💾 Saved direct OMS responses to ${outputPath}`);
  }
}

// Run the testing
const tester = new DirectOMSAPITester();
tester
  .collectAllResponses()
  .then(() => {
    console.log("\n✅ Direct OMS API Endpoint Testing completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Direct OMS API Endpoint Testing failed:", error);
    process.exit(1);
  });

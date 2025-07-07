#!/usr/bin/env node
// Comprehensive OMS API Endpoint Tester
// Tests all endpoints from api_knowledge.md and structures responses for vector database population

const fs = require("fs");
const path = require("path");

// Configuration
const BASE_URL = "http://localhost:3000";
const DATA_DIR = path.join(process.cwd(), "data");

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

class OMSAPIEndpointTester {
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
    console.log("🚀 Starting Comprehensive OMS API Endpoint Testing...\n");

    try {
      // Step 1: Test server connection
      console.log("🔍 Step 1: Testing server connection...");
      try {
        await this.makeRequest(`${BASE_URL}/api/admin/health`);
        console.log("✅ Server is running");
      } catch (error) {
        console.log("❌ Server not responding");
        console.log(
          "💡 Please run 'npm run dev' in another terminal and try again"
        );
        return;
      }

      // Step 2: Get job list (foundation for other endpoints)
      console.log("📋 Step 2: Getting job list...");
      const jobListResponse = await this.callGetJobList();
      this.responses.push(jobListResponse);

      // Extract job numbers and customer IDs for dependent calls
      if (jobListResponse.response && jobListResponse.response.length > 0) {
        this.jobNumbers = jobListResponse.response
          .map((job) => job.JobNumber)
          .slice(0, 5); // Limit to 5 jobs
        this.customerIds = [
          ...new Set(
            jobListResponse.response
              .map((job) => job.CustomerId)
              .filter(Boolean)
          ),
        ].slice(0, 3); // Limit to 3 customers
      }

      // Step 3: Get job lines for each job
      console.log("📦 Step 3: Getting job lines for each job...");
      for (const jobNumber of this.jobNumbers) {
        const jobLinesResponse = await this.callGetJoblines(jobNumber);
        this.responses.push(jobLinesResponse);

        // Extract category unit IDs and price codes for pricing calls
        if (jobLinesResponse.response && jobLinesResponse.response.length > 0) {
          const categoryUnitIds = jobLinesResponse.response
            .map((line) => line.CategoryUnitId)
            .filter(Boolean);
          this.categoryUnitIds.push(...categoryUnitIds);

          const priceCodes = jobLinesResponse.response
            .map((line) => line.PriceCode)
            .filter(Boolean);
          this.priceCodes.push(...priceCodes);
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

      console.log("\n🎉 Comprehensive OMS API Endpoint Testing Complete!");
      console.log(`📊 Collected ${this.responses.length} API responses`);
      console.log(`📋 Tested ${this.jobNumbers.length} jobs`);
      console.log(`👤 Tested ${this.customerIds.length} customers`);
      console.log(
        "💾 Responses saved to data/comprehensive-oms-responses.json"
      );
    } catch (error) {
      console.error("❌ OMS API Endpoint Testing failed:", error);
      await this.saveResponses();
      process.exit(1);
    }
  }

  async callGetJobList() {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: "Show me today's jobs",
          endpoint: "get-job-list",
          parameters: {
            "job-status": "5,6,7,8",
            "due-date": "1",
            "stock-status": "0,1,2",
            "text-filter": "",
            bit: "get-job-list",
          },
        }),
      });
      return {
        endpoint: "get-job-list",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          "job-status": "5,6,7,8",
          "due-date": "1",
          "stock-status": "0,1,2",
          "text-filter": "",
          bit: "get-job-list",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-list",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          "job-status": "5,6,7,8",
          "due-date": "1",
          "stock-status": "0,1,2",
          "text-filter": "",
          bit: "get-job-list",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async callGetJoblines(jobNumber) {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `What's in order #${jobNumber}?`,
          endpoint: "get-joblines",
          parameters: {
            jobNumber: jobNumber,
            bit: "get-joblines",
          },
        }),
      });
      return {
        endpoint: "get-joblines",
        url: "/api/oms-chat",
        method: "POST",
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
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `How much is order #${jobNumber}?`,
          endpoint: "get-joblines-cost-details",
          parameters: {
            bit: "get-joblines-cost-details",
            jobNumber: jobNumber,
          },
        }),
      });
      return {
        endpoint: "get-joblines-cost-details",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          bit: "get-joblines-cost-details",
          jobNumber: jobNumber,
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-joblines-cost-details",
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `What materials are in job #${jobNumber}?`,
          endpoint: "get-all-inwards-and-stock-items",
          parameters: {
            jobNumber: jobNumber,
            bit: "get-all-inwards-and-stock-items",
          },
        }),
      });
      return {
        endpoint: "get-all-inwards-and-stock-items",
        url: "/api/oms-chat",
        method: "POST",
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
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `Has anything shipped for order #${jobNumber}?`,
          endpoint: "get-job-shipments",
          parameters: {
            jobNumber: jobNumber,
            bit: "get-job-shipments",
          },
        }),
      });
      return {
        endpoint: "get-job-shipments",
        url: "/api/oms-chat",
        method: "POST",
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
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `What delivery options does customer ${customerId} have?`,
          endpoint: "get-delivery-options",
          parameters: {
            customerId: customerId,
            bit: "get-delivery-options",
          },
        }),
      });
      return {
        endpoint: "get-delivery-options",
        url: "/api/oms-chat",
        method: "POST",
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
        url: "/api/oms-chat",
        method: "POST",
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

  async callGetPriceQuantityBands(categoryUnitId, priceCode) {
    try {
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `How is pricing calculated for category unit ${categoryUnitId} with price code ${priceCode}?`,
          endpoint: "get-price-quantity-bands",
          parameters: {
            "category-unit-id": categoryUnitId,
            "price-tier": "F", // Default tier
            "price-code": priceCode,
            bit: "get-price-quantity-bands",
          },
        }),
      });
      return {
        endpoint: "get-price-quantity-bands",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          "category-unit-id": categoryUnitId,
          "price-tier": "F",
          "price-code": priceCode,
          bit: "get-price-quantity-bands",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-price-quantity-bands",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          "category-unit-id": categoryUnitId,
          "price-tier": "F",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: "Show me all product types",
          endpoint: "get-all-category-units",
          parameters: {
            bit: "get-all-category-units",
          },
        }),
      });
      return {
        endpoint: "get-all-category-units",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          bit: "get-all-category-units",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-all-category-units",
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `When was job #${jobNumber} last updated?`,
          endpoint: "get-job-history",
          parameters: {
            jobNumber: jobNumber,
            bit: "get-job-history",
          },
        }),
      });
      return {
        endpoint: "get-job-history",
        url: "/api/oms-chat",
        method: "POST",
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
        url: "/api/oms-chat",
        method: "POST",
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
      const response = await this.makeRequest(`${BASE_URL}/api/oms-chat`, {
        method: "POST",
        body: JSON.stringify({
          message: `Who is customer ${customerId}?`,
          endpoint: "get-customer-by-id",
          parameters: {
            id: customerId,
            bit: "get-customer-by-id",
          },
        }),
      });
      return {
        endpoint: "get-customer-by-id",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          id: customerId,
          bit: "get-customer-by-id",
        },
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-customer-by-id",
        url: "/api/oms-chat",
        method: "POST",
        parameters: {
          id: customerId,
          bit: "get-customer-by-id",
        },
        timestamp: new Date().toISOString(),
        response: null,
        error: error.message,
      };
    }
  }

  async saveResponses() {
    const outputPath = path.join(DATA_DIR, "comprehensive-oms-responses.json");

    const output = {
      metadata: {
        collectedAt: new Date().toISOString(),
        baseUrl: BASE_URL,
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
    console.log(`💾 Saved comprehensive OMS responses to ${outputPath}`);
  }
}

// Run the testing
const tester = new OMSAPIEndpointTester();
tester
  .collectAllResponses()
  .then(() => {
    console.log(
      "\n✅ Comprehensive OMS API Endpoint Testing completed successfully"
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Comprehensive OMS API Endpoint Testing failed:", error);
    process.exit(1);
  });

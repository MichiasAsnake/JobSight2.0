#!/usr/bin/env node
// API Response Collector for Vector Database Documentation
// Systematically calls each API endpoint and records response objects

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { enhancedAPIClient } from "../src/lib/enhanced-api-client";

// Load environment variables
dotenv.config();

interface APIResponse {
  endpoint: string;
  url: string;
  method: string;
  parameters: any;
  timestamp: string;
  response: any;
  error?: string;
}

class APIResponseCollector {
  private responses: APIResponse[] = [];
  private selectedJobNumber: string = "";
  private selectedCustomerId: string = "";

  async collectAllResponses() {
    console.log(
      "🚀 Starting API Response Collection for Vector Database Documentation...\n"
    );

    try {
      // Step 1: Get job list to find a job number and customer ID
      console.log("📋 Step 1: Getting job list...");
      const jobListResponse = await this.callGetJobList();
      this.responses.push(jobListResponse);

      if (jobListResponse.error) {
        throw new Error(`Failed to get job list: ${jobListResponse.error}`);
      }

      // Extract job number and customer ID from the first job
      const jobs =
        jobListResponse.response?.data?.Entities ||
        jobListResponse.response?.Entities ||
        [];
      if (jobs.length === 0) {
        throw new Error("No jobs found in the response");
      }

      const firstJob = jobs[0];
      this.selectedJobNumber =
        firstJob.JobNumber?.toString() ||
        firstJob.jobNumber?.toString() ||
        "51132";
      this.selectedCustomerId =
        firstJob.CustomerId?.toString() ||
        firstJob.customerId?.toString() ||
        "1";

      console.log(`✅ Selected Job Number: ${this.selectedJobNumber}`);
      console.log(`✅ Selected Customer ID: ${this.selectedCustomerId}\n`);

      // Step 2: Get job lines
      console.log("📋 Step 2: Getting job lines...");
      const jobLinesResponse = await this.callGetJobLines(
        this.selectedJobNumber
      );
      this.responses.push(jobLinesResponse);

      // Step 3: Get job lines cost details
      console.log("💰 Step 3: Getting job lines cost details...");
      const costDetailsResponse = await this.callGetJobLinesCostDetails(
        this.selectedJobNumber
      );
      this.responses.push(costDetailsResponse);

      // Step 4: Get all inwards and stock items
      console.log("📦 Step 4: Getting inwards and stock items...");
      const stockItemsResponse = await this.callGetAllInwardsAndStockItems(
        this.selectedJobNumber
      );
      this.responses.push(stockItemsResponse);

      // Step 5: Get job shipments
      console.log("🚚 Step 5: Getting job shipments...");
      const shipmentsResponse = await this.callGetJobShipments(
        this.selectedJobNumber
      );
      this.responses.push(shipmentsResponse);

      // Step 6: Get delivery options
      console.log("📬 Step 6: Getting delivery options...");
      const deliveryOptionsResponse = await this.callGetDeliveryOptions(
        this.selectedCustomerId
      );
      this.responses.push(deliveryOptionsResponse);

      // Step 7: Get all category units
      console.log("📂 Step 7: Getting all category units...");
      const categoryUnitsResponse = await this.callGetAllCategoryUnits();
      this.responses.push(categoryUnitsResponse);

      // Step 8: Get job history
      console.log("📋 Step 8: Getting job history...");
      const historyResponse = await this.callGetJobHistory(
        this.selectedJobNumber
      );
      this.responses.push(historyResponse);

      // Step 9: Get customer by ID
      console.log("👤 Step 9: Getting customer by ID...");
      const customerResponse = await this.callGetCustomerById(
        this.selectedCustomerId
      );
      this.responses.push(customerResponse);

      // Step 10: Get price quantity bands (if we have the required data)
      console.log("🧾 Step 10: Getting price quantity bands...");
      const priceBandsResponse = await this.callGetPriceQuantityBands();
      this.responses.push(priceBandsResponse);

      // Save all responses
      await this.saveResponses();

      console.log("\n🎉 API Response Collection Complete!");
      console.log(`📊 Collected ${this.responses.length} API responses`);
      console.log("💾 Responses saved to data/api-responses.json");
    } catch (error) {
      console.error("❌ API Response Collection failed:", error);
      // Save what we have so far
      await this.saveResponses();
      process.exit(1);
    }
  }

  private async callGetJobList(): Promise<APIResponse> {
    const parameters = {
      "job-status": "5,6,7,8",
      "due-date": "1,2,3",
      "stock-status": "0,1,2",
      "text-filter": "",
      bit: "get-job-list",
    };

    try {
      const response = await enhancedAPIClient.getJobList(parameters);
      return {
        endpoint: "get-job-list",
        url: "/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-list",
        url: "/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetJobLines(jobNumber: string): Promise<APIResponse> {
    const parameters = { jobNumber, bit: "get-joblines" };

    try {
      const response = await enhancedAPIClient.getJobLines(jobNumber);
      return {
        endpoint: "get-joblines",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-joblines",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetJobLinesCostDetails(
    jobNumber: string
  ): Promise<APIResponse> {
    const parameters = {
      bit: "get-joblines-cost-details",
      jobNumber: jobNumber,
    };

    try {
      const response = await enhancedAPIClient.getJobLinesCostDetails(
        jobNumber
      );
      return {
        endpoint: "get-joblines-cost-details",
        url: "/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-joblines-cost-details",
        url: "/Jobs/ajax/JobHandler.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetAllInwardsAndStockItems(
    jobNumber: string
  ): Promise<APIResponse> {
    const parameters = { jobNumber, bit: "get-all-inwards-and-stock-items" };

    try {
      const response = await enhancedAPIClient.getAllInwardsAndStockItems(
        jobNumber
      );
      return {
        endpoint: "get-all-inwards-and-stock-items",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-all-inwards-and-stock-items",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetJobShipments(jobNumber: string): Promise<APIResponse> {
    const parameters = { jobNumber, bit: "get-job-shipments" };

    try {
      const response = await enhancedAPIClient.getJobShipments(jobNumber);
      return {
        endpoint: "get-job-shipments",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-shipments",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetDeliveryOptions(
    customerId: string
  ): Promise<APIResponse> {
    const parameters = { customerId, bit: "get-delivery-options" };

    try {
      const response = await enhancedAPIClient.getDeliveryOptions(customerId);
      return {
        endpoint: "get-delivery-options",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId=${customerId}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-delivery-options",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId=${customerId}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetAllCategoryUnits(): Promise<APIResponse> {
    const parameters = { bit: "get-all-category-units" };

    try {
      const response = await enhancedAPIClient.getAllCategoryUnits();
      return {
        endpoint: "get-all-category-units",
        url: "/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units",
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-all-category-units",
        url: "/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units",
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetJobHistory(jobNumber: string): Promise<APIResponse> {
    const parameters = { jobNumber, bit: "get-job-history" };

    try {
      const response = await enhancedAPIClient.getJobHistory(jobNumber);
      return {
        endpoint: "get-job-history",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-job-history",
        url: `/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetCustomerById(customerId: string): Promise<APIResponse> {
    const parameters = { id: customerId, bit: "get-customer-by-id" };

    try {
      const response = await enhancedAPIClient.getCustomerById(customerId);
      return {
        endpoint: "get-customer-by-id",
        url: `/customer/ajax/CustomerHandler.ashx?bit=get-customer-by-id&id=${customerId}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-customer-by-id",
        url: `/customer/ajax/CustomerHandler.ashx?bit=get-customer-by-id&id=${customerId}`,
        method: "GET",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async callGetPriceQuantityBands(): Promise<APIResponse> {
    const parameters = {
      "category-unit-id": "13476", // Default value, would normally come from jobline data
      "price-tier": "F", // Default value
      "price-code": "EM_DIRECT:EM_DIRECT", // Default value
      bit: "get-price-quantity-bands",
    };

    try {
      const response = await enhancedAPIClient.getPriceQuantityBands(
        parameters["category-unit-id"],
        parameters["price-tier"],
        parameters["price-code"]
      );
      return {
        endpoint: "get-price-quantity-bands",
        url: "/assetmanager/ajax/assetbit.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response,
      };
    } catch (error) {
      return {
        endpoint: "get-price-quantity-bands",
        url: "/assetmanager/ajax/assetbit.ashx",
        method: "POST",
        parameters,
        timestamp: new Date().toISOString(),
        response: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async saveResponses() {
    const outputPath = path.join(process.cwd(), "data", "api-responses.json");

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const output = {
      metadata: {
        collectedAt: new Date().toISOString(),
        selectedJobNumber: this.selectedJobNumber,
        selectedCustomerId: this.selectedCustomerId,
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
const collector = new APIResponseCollector();
collector
  .collectAllResponses()
  .then(() => {
    console.log("\n✅ API Response Collection completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ API Response Collection failed:", error);
    process.exit(1);
  });

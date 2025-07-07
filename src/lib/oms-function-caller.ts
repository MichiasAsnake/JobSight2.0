// OMS Function Caller - Provides functions for AI to call instead of direct API access
// This allows the AI to use structured function calls rather than making API requests directly

import {
  apiFirstDataService,
  ModernOrder,
  toModernOrder,
} from "./api-first-data-service";
import { enhancedAPIClient } from "./enhanced-api-client";

export interface FunctionCallResult {
  success: boolean;
  data?: any;
  error?: string;
  functionName: string;
  parameters: any;
}

export interface AvailableFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required: string[];
  };
}

export class OMSFunctionCaller {
  private apiClient = enhancedAPIClient;

  // Get list of available functions for the AI
  getAvailableFunctions(): AvailableFunction[] {
    return [
      {
        name: "get_job_list",
        description:
          "Retrieve a list of active jobs/orders with filtering capabilities",
        parameters: {
          type: "object",
          properties: {
            job_status: {
              type: "string",
              description:
                "Job status filter: 5=Approved, 6=On Time, 7=Running Late, 8=Problem",
              enum: ["5", "6", "7", "8", "5,6,7,8"],
            },
            due_date: {
              type: "string",
              description:
                "Due date filter: 1=Today, 2=Tomorrow, 3=Not Yet Due",
              enum: ["1", "2", "3", "1,2,3"],
            },
            stock_status: {
              type: "string",
              description: "Stock status filter: 0=None, 1=Partial, 2=Complete",
              enum: ["0", "1", "2", "0,1,2"],
            },
            text_filter: {
              type: "string",
              description: "Text filter for keywords, tags, or customer names",
            },
          },
          required: [],
        },
      },
      {
        name: "get_job_details",
        description:
          "Get detailed line items, pricing, and artwork for a specific job",
        parameters: {
          type: "object",
          properties: {
            job_number: {
              type: "string",
              description: "The job number to get details for",
            },
          },
          required: ["job_number"],
        },
      },
      {
        name: "get_job_cost",
        description: "Get subtotal, tax, and total cost for a job",
        parameters: {
          type: "object",
          properties: {
            job_number: {
              type: "string",
              description: "The job number to get cost details for",
            },
          },
          required: ["job_number"],
        },
      },
      {
        name: "get_job_stock",
        description:
          "Get garment/inward items and stock status for a specific job",
        parameters: {
          type: "object",
          properties: {
            job_number: {
              type: "string",
              description: "The job number to get stock information for",
            },
          },
          required: ["job_number"],
        },
      },
      {
        name: "get_job_shipments",
        description: "Get shipment status for a job",
        parameters: {
          type: "object",
          properties: {
            job_number: {
              type: "string",
              description: "The job number to get shipment information for",
            },
          },
          required: ["job_number"],
        },
      },
      {
        name: "get_delivery_options",
        description: "Get delivery method options for a customer",
        parameters: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "The customer ID to get delivery options for",
            },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "get_job_history",
        description: "Get history/timeline of job activity",
        parameters: {
          type: "object",
          properties: {
            job_number: {
              type: "string",
              description: "The job number to get history for",
            },
          },
          required: ["job_number"],
        },
      },
      {
        name: "get_customer_info",
        description: "Get customer information and contact details",
        parameters: {
          type: "object",
          properties: {
            customer_id: {
              type: "string",
              description: "The customer ID to get information for",
            },
          },
          required: ["customer_id"],
        },
      },
      {
        name: "get_price_bands",
        description: "Get pricing rules based on quantity bands",
        parameters: {
          type: "object",
          properties: {
            category_unit_id: {
              type: "string",
              description: "The category unit ID for pricing",
            },
            price_tier: {
              type: "string",
              description: "The price tier (e.g., F)",
            },
            price_code: {
              type: "string",
              description: "The price code (e.g., EM_DIRECT:...)",
            },
          },
          required: ["category_unit_id", "price_tier", "price_code"],
        },
      },
      {
        name: "get_category_units",
        description: "Get list of all product types/materials used across jobs",
        parameters: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ];
  }

  // Execute a function call
  async executeFunction(
    functionName: string,
    parameters: any
  ): Promise<FunctionCallResult> {
    console.log(
      `🔧 [FUNCTION] Executing ${functionName} with params:`,
      parameters
    );

    try {
      let result: any;

      switch (functionName) {
        case "get_job_list":
          result = await this.getJobList(parameters);
          break;
        case "get_job_details":
          result = await this.getJobDetails(parameters);
          break;
        case "get_job_cost":
          result = await this.getJobCost(parameters);
          break;
        case "get_job_stock":
          result = await this.getJobStock(parameters);
          break;
        case "get_job_shipments":
          result = await this.getJobShipments(parameters);
          break;
        case "get_delivery_options":
          result = await this.getDeliveryOptions(parameters);
          break;
        case "get_job_history":
          result = await this.getJobHistory(parameters);
          break;
        case "get_customer_info":
          result = await this.getCustomerInfo(parameters);
          break;
        case "get_price_bands":
          result = await this.getPriceBands(parameters);
          break;
        case "get_category_units":
          result = await this.getCategoryUnits(parameters);
          break;
        default:
          throw new Error(`Unknown function: ${functionName}`);
      }

      return {
        success: true,
        data: result,
        functionName,
        parameters,
      };
    } catch (error) {
      console.error(`❌ [FUNCTION] ${functionName} failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        functionName,
        parameters,
      };
    }
  }

  // Individual function implementations
  private async getJobList(params: any): Promise<any> {
    const filters: any = {
      bit: "get-job-list",
    };

    if (params.job_status) filters["job-status"] = params.job_status;
    if (params.due_date) filters["due-date"] = params.due_date;
    if (params.stock_status) filters["stock-status"] = params.stock_status;
    if (params.text_filter) filters["text-filter"] = params.text_filter;

    const response = await this.apiClient.getJobList(filters);

    // ✅ FIX: Properly handle the API response structure
    if (response.isSuccess && response.data?.Entities) {
      const orders = response.data.Entities.map(toModernOrder);
      return orders;
    }

    // Return empty array if no data or error
    console.warn(`⚠️ [FUNCTION] getJobList: No data returned or API error`);
    return [];
  }

  private async getJobDetails(params: any): Promise<any> {
    // Use the optimized method that includes price bands
    const rawJobDetails = await this.apiClient.getJobDetails(
      params.job_number,
      {
        includePriceBands: true, // Pre-fetch price bands for all line items
        includeHistory: false,
        includeShipments: true,
        includeFiles: true,
      }
    );

    // The getJobDetails method returns { job, lines, history, shipments, files }
    // We need to combine job data with line items for a complete order
    if (rawJobDetails.job && rawJobDetails.lines) {
      const completeOrder = {
        ...rawJobDetails.job,
        lineItems: rawJobDetails.lines,
        shipments: rawJobDetails.shipments || [],
        files: rawJobDetails.files || [],
      };
      const jobDetails = toModernOrder(completeOrder);
      return jobDetails;
    }

    // Fallback if job data is missing
    return null;
  }

  private async getJobCost(params: any): Promise<any> {
    const rawJobCostDetails = await this.apiClient.getJobLinesCostDetails(
      params.job_number
    );
    const jobCostDetails = toModernOrder(rawJobCostDetails);
    return jobCostDetails;
  }

  private async getJobStock(params: any): Promise<any> {
    const rawJobStock = await this.apiClient.getAllInwardsAndStockItems(
      params.job_number
    );
    const jobStock = toModernOrder(rawJobStock);
    return jobStock;
  }

  private async getJobShipments(params: any): Promise<any> {
    const rawJobShipments = await this.apiClient.getJobShipments(
      params.job_number
    );
    const jobShipments = toModernOrder(rawJobShipments);
    return jobShipments;
  }

  private async getDeliveryOptions(params: any): Promise<any> {
    const rawDeliveryOptions = await this.apiClient.getDeliveryOptions(
      params.customer_id
    );
    const deliveryOptions = toModernOrder(rawDeliveryOptions);
    return deliveryOptions;
  }

  private async getJobHistory(params: any): Promise<any> {
    const rawJobHistory = await this.apiClient.getJobHistory(params.job_number);
    const jobHistory = toModernOrder(rawJobHistory);
    return jobHistory;
  }

  private async getCustomerInfo(params: any): Promise<any> {
    const rawCustomerInfo = await this.apiClient.getCustomerById(
      params.customer_id
    );
    const customerInfo = toModernOrder(rawCustomerInfo);
    return customerInfo;
  }

  private async getPriceBands(params: any): Promise<any> {
    const rawPriceBands = await this.apiClient.getPriceQuantityBands(
      params.category_unit_id,
      params.price_tier,
      params.price_code
    );
    const priceBands = toModernOrder(rawPriceBands);
    return priceBands;
  }

  private async getCategoryUnits(params: any): Promise<any> {
    const rawCategoryUnits = await this.apiClient.getAllCategoryUnits();
    const categoryUnits = toModernOrder(rawCategoryUnits);
    return categoryUnits;
  }
}

// Export singleton instance
export const omsFunctionCaller = new OMSFunctionCaller();

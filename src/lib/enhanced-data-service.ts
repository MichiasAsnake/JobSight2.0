// Enhanced OMS Data Service - Comprehensive order data with rich API integration
import {
  omsAPIClient,
  APIJob,
  APIJobLines,
  APIStockItems,
  APICustomer,
  APIJobCostDetails,
  APIJobShipments,
  APIJobHistory,
  APIDeliveryOptions,
} from "./api-client";

export interface EnrichedOrder {
  // Core order information
  jobNumber: string;
  orderNumber: string;
  status: string;
  priority: string;
  customer: {
    id: number;
    company: string;
    priceTier: string;
    contactPerson: string;
    phone: string;
    email: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    accountOnCreditHold: boolean;
    allUsers: Array<{
      name: string;
      email: string;
      phone: string;
      isAdmin: boolean;
    }>;
  };
  description: string;
  comments: string;
  dateEntered: string;
  dateDue: string;
  daysToDue: number;
  mustDate: boolean;
  timeSensitive: boolean;

  // Production information
  jobQuantity: number;
  stockStatus: {
    code: number;
    description: string;
    isComplete: boolean;
  };
  location: {
    code: string;
    name: string;
  };

  // Job lines (production tasks)
  jobLines: Array<{
    id: number;
    program: string;
    description: string;
    quantity: number;
    unitPrice: number;
    garment: string;
    comments: string;
    progComment: string;
    progress: number;
    isScheduleable: boolean;
    machineNumber: string;
    hasImage: boolean;
    hasPDF: boolean;
    assetId: number;
    order: number;
    gang: string;
  }>;

  // Stock and inventory
  stockItems: Array<{
    id: number;
    description: string;
    locationCode: string;
    supplier: string;
    quantity: number;
    deliveryDate: string;
    cartons: number;
    packageType: string;
    items: Array<{
      code: string;
      garment: string;
      colour: string;
      totalQuantity: number;
      sizeDescription: string;
    }>;
  }>;

  // Pricing information
  pricing: {
    subtotal: number;
    tax: number;
    total: number;
    subtotalFormatted: string;
    taxFormatted: string;
    totalFormatted: string;
  };

  // Shipping information
  shipments: Array<{
    id: number;
    title: string;
    method: {
      label: string;
      value: string;
      isCollection: boolean;
      rank: number;
    };
    address: {
      contactName: string;
      organization: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      phone: string;
      email: string;
    };
    shipped: boolean;
    dateShipped?: string;
    trackingDetails?: any;
    canShip: boolean;
    notes: string;
  }>;

  // Production history and workflow
  history: Array<{
    entry: string;
    detail: string;
    timestamp?: string;
  }>;

  // Tags and metadata
  tags: Array<{
    tag: string;
    enteredBy: string;
    whenEntered: string;
    code?: string;
    meta?: any;
  }>;

  // Process quantities (what work needs to be done)
  processQuantities: Array<{
    code: string;
    displayCode: string;
    quantity: number;
    hasSuggestedMachine: boolean;
    suggestedMachineLabel?: string;
  }>;

  // Delivery options for customer
  availableDeliveryOptions: Array<{
    label: string;
    value: string;
    isCollection: boolean;
    rank: number;
  }>;

  // Data freshness and source tracking
  dataSource: "api" | "hybrid" | "cache";
  lastUpdated: string;
  dataAge: number; // minutes since last update
  apiHealth: boolean;
}

export interface EnrichedOrdersData {
  orders: EnrichedOrder[];
  summary: {
    totalOrders: number;
    lastUpdated: string;
    apiHealth: boolean;
    dataSource: "api" | "hybrid" | "cache";
    statusBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
    customerBreakdown: Record<string, number>;
  };
}

class EnrichedOMSDataService {
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for rich data
  private readonly BASIC_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for basic data

  constructor() {
    // Initialize with auth cookie if available
    const authCookie = process.env.OMS_AUTH_COOKIE;
    if (authCookie) {
      omsAPIClient.setAuthCookies(authCookie);
    }
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    return cached ? Date.now() < cached.expiry : false;
  }

  private setCache(
    key: string,
    data: any,
    duration: number = this.CACHE_DURATION
  ): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + duration,
    });
  }

  private getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)!.data;
    }
    return null;
  }

  // Transform API job data to enriched order format
  private async transformToEnrichedOrder(
    job: APIJob,
    jobLines: APIJobLines["data"] | null,
    stockItems: APIStockItems["data"] | null,
    customer: APICustomer["data"] | null,
    costDetails: APIJobCostDetails["data"] | null,
    shipments: APIJobShipments["data"] | null,
    history: APIJobHistory["data"] | null,
    deliveryOptions: APIDeliveryOptions["data"] | null
  ): Promise<EnrichedOrder> {
    return {
      jobNumber: job.JobNumber.toString(),
      orderNumber: job.OrderNumber || "",
      status: job.MasterJobStatus || "Unknown",
      priority: job.TimeSensitive ? "High" : job.MustDate ? "Medium" : "Normal",
      customer: {
        id: job.CustomerId,
        company: job.Client || "",
        priceTier: customer?.PriceTierCode || "",
        contactPerson: customer?.Users?.[0]?.UserName?.FullName || "",
        phone: customer?.Users?.[0]?.Phone || "",
        email: customer?.Users?.[0]?.EmailAddress || "",
        address: {
          street: customer?.Address?.StreetAddress || "",
          city: customer?.Address?.City || "",
          state: customer?.Address?.State || "",
          zipCode: customer?.Address?.PostalCode || "",
          country: customer?.Address?.Country || "",
        },
        accountOnCreditHold: customer?.AccountOnCreditHold || false,
        allUsers:
          customer?.Users?.map((user) => ({
            name: user.UserName.FullName,
            email: user.EmailAddress,
            phone: user.Phone,
            isAdmin: user.IsCustomerAdmin,
          })) || [],
      },
      description: job.Description || "",
      comments: job.Comments || "",
      dateEntered: job.DateIn || "",
      dateDue: job.DateDue || "",
      daysToDue: job.DaysToDueDate || 0,
      mustDate: job.MustDate || false,
      timeSensitive: job.TimeSensitive || false,
      jobQuantity: job.JobQuantity || 0,
      stockStatus: {
        code: job.StockComplete || 0,
        description: job.StockCompleteStatus || "",
        isComplete: job.StockComplete === 2,
      },
      location: {
        code: job.LocationCode || "",
        name: job.JobLocationName || "",
      },
      jobLines:
        jobLines?.map((line) => ({
          id: line.ID,
          program: line.Prgram,
          description: line.Description,
          quantity: line.Qty,
          unitPrice: line.UnitPrice,
          garment: line.Garment,
          comments: line.Comments,
          progComment: line.ProgComment,
          progress: line.Progress,
          isScheduleable: line.IsScheduleable,
          machineNumber: line.MachineNumber,
          hasImage: line.HasImage,
          hasPDF: line.AssetHasPDF,
          assetId: line.AssetId,
          order: line.Order,
          gang: line.Gang,
        })) || [],
      stockItems:
        stockItems?.map((stock) => ({
          id: stock.ID,
          description: stock.Description,
          locationCode: stock.LocCode,
          supplier: stock.Supplier,
          quantity: stock.Quantity,
          deliveryDate: stock.DeliveryDateUtc,
          cartons: stock.Cartons,
          packageType: stock.PackageType,
          items:
            stock.Items?.map((item) => ({
              code: item.Code,
              garment: item.Garment,
              colour: item.Colour,
              totalQuantity: item.Totals,
              sizeDescription: item.SzDescription,
            })) || [],
        })) || [],
      pricing: {
        subtotal: costDetails?.jobLinesSubTotal || 0,
        tax: costDetails?.jobLinesTaxTotal || 0,
        total: costDetails?.jobLinesTotalCost || 0,
        subtotalFormatted:
          costDetails?.jobLinesSubTotalFormattedText || "$0.00",
        taxFormatted: costDetails?.jobLinesTaxTotalFormattedText || "$0.00",
        totalFormatted: costDetails?.jobLinesTotalCostFormattedText || "$0.00",
      },
      shipments:
        shipments?.JobShipments?.map((shipment) => ({
          id: shipment.Id,
          title: shipment.Title,
          method: {
            label: shipment.ShipmentMethod.label,
            value: shipment.ShipmentMethod.value,
            isCollection: shipment.ShipmentMethod.iscollection,
            rank: shipment.ShipmentMethod.rank,
          },
          address: {
            contactName: shipment.Address.ContactName,
            organization: shipment.Address.Organisation,
            street: shipment.Address.StreetAddress,
            city: shipment.Address.City,
            state: shipment.Address.AdministrativeArea,
            zipCode: shipment.Address.ZipCode,
            phone: shipment.Address.Phone,
            email: shipment.Address.EmailAddress,
          },
          shipped: shipment.Shipped,
          dateShipped: shipment.DateShipped,
          trackingDetails: shipment.TrackingDetails,
          canShip: shipment.CanShip,
          notes: shipment.ShipmentNotes,
        })) || [],
      history:
        history?.map((entry) => ({
          entry: entry.Entry,
          detail: entry.Detail,
        })) || [],
      tags:
        job.JobTags?.map((tag) => ({
          tag: tag.Tag,
          enteredBy: tag.WhoEnteredUsername,
          whenEntered: tag.WhenEntered,
          code: tag.Code,
          meta: tag.Meta,
        })) || [],
      processQuantities:
        job.ProcessQuantities?.map((pq) => ({
          code: pq.Code,
          displayCode: pq.DisplayCode,
          quantity: pq.Qty,
          hasSuggestedMachine: pq.HasSuggestedMachine || false,
          suggestedMachineLabel: pq.SuggestedMachineLabel,
        })) || [],
      availableDeliveryOptions:
        deliveryOptions?.map((option) => ({
          label: option.label,
          value: option.value,
          isCollection: option.iscollection,
          rank: option.rank,
        })) || [],
      dataSource: "api",
      lastUpdated: new Date().toISOString(),
      dataAge: 0,
      apiHealth: true,
    };
  }

  // Get all orders with rich data
  async getEnrichedOrders(): Promise<EnrichedOrdersData> {
    const cacheKey = "enriched_orders";
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      console.log("🔍 Fetching enriched orders from API...");

      // Get basic order list first
      const jobListResponse = await omsAPIClient.getJobList({
        "page-size": "200", // Get more orders
      });

      if (!jobListResponse.isSuccess) {
        throw new Error("Failed to fetch job list");
      }

      const jobs = jobListResponse.data.Entities;
      console.log(
        `📋 Found ${jobs.length} orders, enriching with detailed data...`
      );

      // Enrich each order with detailed data (limit to prevent overwhelming the API)
      const enrichmentPromises = jobs.slice(0, 50).map(async (job) => {
        try {
          const enrichedData = await omsAPIClient.getEnrichedJobData(
            job.JobNumber.toString(),
            job.CustomerId.toString()
          );

          return await this.transformToEnrichedOrder(
            job,
            enrichedData.jobLines,
            enrichedData.stockItems,
            enrichedData.customer,
            enrichedData.costDetails,
            enrichedData.shipments,
            enrichedData.history,
            enrichedData.deliveryOptions
          );
        } catch (error) {
          console.warn(`⚠️ Failed to enrich job ${job.JobNumber}:`, error);
          // Return basic order data if enrichment fails
          return await this.transformToEnrichedOrder(
            job,
            null,
            null,
            null,
            null,
            null,
            null,
            null
          );
        }
      });

      const enrichedOrders = await Promise.all(enrichmentPromises);

      // Calculate summary statistics
      const statusBreakdown: Record<string, number> = {};
      const priorityBreakdown: Record<string, number> = {};
      const customerBreakdown: Record<string, number> = {};

      enrichedOrders.forEach((order) => {
        statusBreakdown[order.status] =
          (statusBreakdown[order.status] || 0) + 1;
        priorityBreakdown[order.priority] =
          (priorityBreakdown[order.priority] || 0) + 1;
        customerBreakdown[order.customer.company] =
          (customerBreakdown[order.customer.company] || 0) + 1;
      });

      const result: EnrichedOrdersData = {
        orders: enrichedOrders,
        summary: {
          totalOrders: enrichedOrders.length,
          lastUpdated: new Date().toISOString(),
          apiHealth: true,
          dataSource: "api",
          statusBreakdown,
          priorityBreakdown,
          customerBreakdown,
        },
      };

      // Cache the enriched data
      this.setCache(cacheKey, result);
      console.log(`✅ Successfully enriched ${enrichedOrders.length} orders`);

      return result;
    } catch (error) {
      console.error("❌ Failed to fetch enriched orders:", error);
      throw error;
    }
  }

  // Get single enriched order by job number
  async getEnrichedOrderByJobNumber(
    jobNumber: string
  ): Promise<EnrichedOrder | null> {
    const cacheKey = `enriched_order_${jobNumber}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      console.log(`🔍 Fetching enriched data for job ${jobNumber}...`);

      const enrichedData = await omsAPIClient.getEnrichedJobData(jobNumber);

      if (!enrichedData.job) {
        return null;
      }

      const enrichedOrder = await this.transformToEnrichedOrder(
        enrichedData.job,
        enrichedData.jobLines,
        enrichedData.stockItems,
        enrichedData.customer,
        enrichedData.costDetails,
        enrichedData.shipments,
        enrichedData.history,
        enrichedData.deliveryOptions
      );

      // Cache the individual order
      this.setCache(cacheKey, enrichedOrder, this.BASIC_CACHE_DURATION);
      console.log(`✅ Successfully enriched job ${jobNumber}`);

      return enrichedOrder;
    } catch (error) {
      console.error(`❌ Failed to fetch enriched order ${jobNumber}:`, error);
      return null;
    }
  }

  // Search enriched orders
  async searchEnrichedOrders(query: string): Promise<EnrichedOrder[]> {
    const allOrders = await this.getEnrichedOrders();
    const queryLower = query.toLowerCase();

    return allOrders.orders.filter((order) => {
      // Search across multiple fields
      const searchableText = [
        order.jobNumber,
        order.orderNumber,
        order.description,
        order.comments,
        order.customer.company,
        order.customer.contactPerson,
        order.status,
        ...order.tags.map((tag) => tag.tag),
        ...order.jobLines.map((line) => line.description),
        ...order.processQuantities.map((pq) => pq.displayCode),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(queryLower);
    });
  }

  // Get orders by specific criteria with rich data
  async getOrdersByStatus(status: string): Promise<EnrichedOrder[]> {
    const allOrders = await this.getEnrichedOrders();
    return allOrders.orders.filter((order) =>
      order.status.toLowerCase().includes(status.toLowerCase())
    );
  }

  async getOrdersByCustomer(customer: string): Promise<EnrichedOrder[]> {
    const allOrders = await this.getEnrichedOrders();
    return allOrders.orders.filter((order) =>
      order.customer.company.toLowerCase().includes(customer.toLowerCase())
    );
  }

  async getOrdersByTags(tags: string[]): Promise<EnrichedOrder[]> {
    const allOrders = await this.getEnrichedOrders();
    return allOrders.orders.filter((order) => {
      const orderTags = order.tags.map((tag) => tag.tag.toLowerCase());
      return tags.some((tag) =>
        orderTags.some((orderTag) => orderTag.includes(tag.toLowerCase()))
      );
    });
  }

  async getOrdersByProcess(processCode: string): Promise<EnrichedOrder[]> {
    const allOrders = await this.getEnrichedOrders();
    return allOrders.orders.filter((order) =>
      order.processQuantities.some(
        (pq) =>
          pq.code.toLowerCase().includes(processCode.toLowerCase()) ||
          pq.displayCode.toLowerCase().includes(processCode.toLowerCase())
      )
    );
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log("🗑️ Enriched data cache cleared");
  }

  // Health check
  async checkHealth(): Promise<{ healthy: boolean; details: any }> {
    try {
      const health = await omsAPIClient.checkAPIHealth();
      return {
        healthy: health.healthy,
        details: health.endpoints,
      };
    } catch (error) {
      return {
        healthy: false,
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}

// Create singleton instance
export const enrichedOMSDataService = new EnrichedOMSDataService();

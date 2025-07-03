// API-First Data Service - Replaces file-based data with direct API calls
// Uses the enhanced API client for real-time data access with intelligent caching

import {
  enhancedAPIClient,
  APIJob,
  APIJobLine,
  APIJobShipment,
  APIJobFile,
} from "./enhanced-api-client";

export interface ModernOrder {
  // Core identifiers
  jobNumber: string;
  orderNumber: string;

  // Customer information
  customer: {
    id: number;
    company: string;
    contactPerson?: string;
    phone?: string;
    email?: string;
  };

  // Order details
  description: string;
  comments: string;
  jobQuantity: number;

  // Status information
  status: {
    master: string;
    masterStatusId: number;
    stock: string;
    stockComplete: number;
    statusLine: string;
    statusLineHtml: string;
  };

  // Dates (all in ISO format)
  dates: {
    dateEntered: string;
    dateEnteredUtc: string;
    dateDue: string;
    dateDueUtc: string;
    dateDueFactory: string;
    daysToDueDate: number;
    dateOut?: string;
    dateOutUtc?: string;
  };

  // Location and logistics
  location: {
    code: string;
    name: string;
    deliveryOption: string;
  };

  // Production details
  production: {
    processes: Array<{
      code: string;
      displayCode: string;
      quantity: number;
      bitVal: number;
      suggestedMachineId?: number;
      suggestedMachineLabel?: string;
    }>;
    gangCodes: string[];
    timeSensitive: boolean;
    mustDate: boolean;
    isReprint: boolean;
    isDupe: boolean;
    canSuggestMachines: boolean;
  };

  // Line items (from get-joblines)
  lineItems: Array<{
    lineId?: number;
    assetSKU?: string;
    description: string;
    category?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    comment?: string;
    status?: string;
    processCodes?: string[];
    materials?: string[];
    hasImage?: boolean;
    hasPDF?: boolean;
  }>;

  // Shipments (from get-job-shipments)
  shipments: Array<{
    id: number;
    index: number;
    title: string;
    shipped: boolean;
    dateShipped?: string;
    canShip: boolean;
    trackingDetails?: {
      trackingLink: string;
      status: string;
      lastUpdate: string;
      deliveryStatus: string;
    };
    address: {
      contactName: string;
      organisation: string;
      streetAddress: string;
      city: string;
      state: string;
      zipCode: string;
      validated: boolean;
    };
    method: {
      label: string;
      value: string;
    };
  }>;

  // Files (from get-job-files)
  files: Array<{
    guid: string;
    fileName: string;
    contentType: string;
    fileSize: number;
    formattedSize: string;
    fileType: string;
    category: string;
    uri: string;
    createdDate: string;
    createdBy: string;
  }>;

  // Tags and notes
  tags: Array<{
    tag: string;
    enteredBy: string;
    dateEntered: string;
  }>;

  // Workflow flags
  workflow: {
    hasScheduleableJobLines: boolean;
    canPrintJobLineLabels: boolean;
    hasJobFiles: boolean;
    hasProof: boolean;
  };

  // Metadata
  metadata: {
    lastAPIUpdate: string;
    dataSource: "api";
    dataFreshness: "fresh" | "stale" | "very-stale";
    bitVal: number;
    sortKey: string;
  };
}

export interface ModernOrdersData {
  orders: ModernOrder[];
  summary: {
    totalOrders: number;
    totalResults: number;
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    lastUpdated: string;
    apiHealth: "healthy" | "degraded" | "offline";
  };
}

export interface OrderSearchOptions {
  // Filtering
  jobNumber?: string;
  customer?: string;
  status?: string;
  priority?: string;
  dateRange?: {
    start: string;
    end: string;
  };

  // Pagination
  page?: number;
  pageSize?: number;

  // Data enrichment
  includeLineItems?: boolean;
  includeShipments?: boolean;
  includeFiles?: boolean;
  includeHistory?: boolean;

  // Performance
  useCache?: boolean;
  freshDataRequired?: boolean;
}

class APIFirstDataService {
  private apiClient = enhancedAPIClient;

  // Convert API job to modern order format
  private async convertAPIJobToModernOrder(
    apiJob: APIJob,
    options: {
      includeLineItems?: boolean;
      includeShipments?: boolean;
      includeFiles?: boolean;
    } = {}
  ): Promise<ModernOrder> {
    const order: ModernOrder = {
      jobNumber: apiJob.JobNumber.toString(),
      orderNumber: apiJob.OrderNumber,

      customer: {
        id: apiJob.CustomerId,
        company: apiJob.Client,
      },

      description: apiJob.Description,
      comments: apiJob.Comments,
      jobQuantity: apiJob.JobQuantity,

      status: {
        master: apiJob.MasterJobStatus,
        masterStatusId: apiJob.MasterJobStatusId,
        stock: apiJob.StockCompleteStatus,
        stockComplete: apiJob.StockComplete,
        statusLine: apiJob.StatusLine,
        statusLineHtml: apiJob.StatusLineHtml,
      },

      dates: {
        dateEntered: apiJob.DateIn,
        dateEnteredUtc: apiJob.DateInUtc,
        dateDue: apiJob.DateDue,
        dateDueUtc: apiJob.DateDueUtc,
        dateDueFactory: apiJob.DateDueFactory,
        daysToDueDate: apiJob.DaysToDueDate,
      },

      location: {
        code: apiJob.JobLocationCode || apiJob.LocationCode,
        name: apiJob.JobLocationName,
        deliveryOption: apiJob.DeliveryOption,
      },

      production: {
        processes: apiJob.ProcessQuantities.map((pq) => ({
          code: pq.Code,
          displayCode: pq.DisplayCode,
          quantity: pq.Qty,
          bitVal: pq.BitVal,
          suggestedMachineId: pq.SuggestedMachineId,
          suggestedMachineLabel: pq.SuggestedMachineLabel,
        })),
        gangCodes: apiJob.GangCodes,
        timeSensitive: apiJob.TimeSensitive,
        mustDate: apiJob.MustDate,
        isReprint: apiJob.IsReprint,
        isDupe: apiJob.IsDupe,
        canSuggestMachines: apiJob.CanSuggestMachines,
      },

      lineItems: [], // Will be populated if requested
      shipments: [], // Will be populated if requested
      files: [], // Will be populated if requested

      tags: apiJob.JobTags.map((tag) => ({
        tag: tag.Tag,
        enteredBy: tag.WhoEnteredUsername,
        dateEntered: tag.WhenEnteredUtc,
      })),

      workflow: {
        hasScheduleableJobLines: apiJob.HasScheduleableJobLines,
        canPrintJobLineLabels: apiJob.CanPrintJobLineLabels,
        hasJobFiles: false, // Will be set if files are loaded
        hasProof: false, // Will be determined from files/tags
      },

      metadata: {
        lastAPIUpdate: new Date().toISOString(),
        dataSource: "api",
        dataFreshness: "fresh",
        bitVal: apiJob.BitVal,
        sortKey: apiJob.SortKey,
      },
    };

    // Enrich with additional data if requested
    if (
      options.includeLineItems ||
      options.includeShipments ||
      options.includeFiles
    ) {
      try {
        const jobDetails = await this.apiClient.getJobDetails(
          apiJob.JobNumber.toString()
        );

        if (options.includeLineItems && jobDetails.lines) {
          order.lineItems = jobDetails.lines.map((line) => ({
            lineId: line.LineId,
            assetSKU: line.AssetSKU,
            description: line.Description,
            category: line.Category,
            quantity: line.Quantity,
            unitPrice: line.UnitPrice,
            totalPrice: line.TotalPrice,
            comment: line.Comment,
            status: line.Status,
            processCodes: line.ProcessCodes,
            materials: line.Materials,
            hasImage: line.HasImage,
            hasPDF: line.HasPDF,
          }));
        }

        if (options.includeShipments && jobDetails.shipments) {
          order.shipments = jobDetails.shipments.map((shipment) => ({
            id: shipment.Id,
            index: shipment.Index,
            title: shipment.Title,
            shipped: shipment.Shipped,
            dateShipped: shipment.DateShipped || undefined,
            canShip: shipment.CanShip,
            trackingDetails: shipment.TrackingDetails
              ? {
                  trackingLink: shipment.TrackingDetails.TrackingLink,
                  status: shipment.TrackingDetails.Status,
                  lastUpdate: shipment.TrackingDetails.LastUpdate,
                  deliveryStatus: shipment.TrackingDetails.DeliveryStatus,
                }
              : undefined,
            address: {
              contactName: shipment.Address.ContactName,
              organisation: shipment.Address.Organisation,
              streetAddress: shipment.Address.StreetAddress,
              city: shipment.Address.City,
              state: shipment.Address.AdministrativeAreaAbbreviation,
              zipCode: shipment.Address.ZipCode,
              validated: shipment.Address.Validated,
            },
            method: {
              label: shipment.ShipmentMethod.label,
              value: shipment.ShipmentMethod.value,
            },
          }));
        }

        if (options.includeFiles && jobDetails.files) {
          order.files = jobDetails.files.map((file) => ({
            guid: file.Guid,
            fileName: file.FileName,
            contentType: file.ContentType,
            fileSize: file.FileSizeBytes,
            formattedSize: file.FormattedFileSize,
            fileType: file.FileType,
            category: file.Category,
            uri: file.Uri,
            createdDate: file.CreatedDate,
            createdBy: file.CreatedBy.FullName,
          }));

          order.workflow.hasJobFiles = jobDetails.files.length > 0;
          order.workflow.hasProof = jobDetails.files.some(
            (f) =>
              f.FileName.toLowerCase().includes("proof") ||
              f.Category.toLowerCase().includes("proof")
          );
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to enrich order ${apiJob.JobNumber} with additional data:`,
          error
        );
      }
    }

    return order;
  }

  // Get all active orders with optional enrichment
  async getAllOrders(
    options: OrderSearchOptions = {}
  ): Promise<ModernOrdersData> {
    console.log("📊 Fetching all orders from API...");

    try {
      const startTime = Date.now();

      // Build API filters
      const filters: any = {
        "page-size": (options.pageSize || 200).toString(),
        "requested-page": (options.page || 1).toString(),
      };

      if (options.jobNumber) {
        filters["text-filter"] = options.jobNumber;
      }

      if (options.status) {
        // Map status to API format
        const statusMap: Record<string, string> = {
          approved: "5",
          production: "6,7",
          shipped: "8",
          completed: "9,10",
        };
        filters["job-status"] =
          statusMap[options.status.toLowerCase()] || options.status;
      }

      // Fetch from API
      const apiResponse = await this.apiClient.getJobList(filters);

      if (!apiResponse.isSuccess) {
        throw new Error(`API request failed: ${apiResponse.error?.Message}`);
      }

      // Convert API jobs to modern orders
      const orders = await Promise.all(
        apiResponse.data.Entities.map((apiJob) =>
          this.convertAPIJobToModernOrder(apiJob, {
            includeLineItems: options.includeLineItems,
            includeShipments: options.includeShipments,
            includeFiles: options.includeFiles,
          })
        )
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Converted ${orders.length} API orders in ${processingTime}ms`
      );

      return {
        orders,
        summary: {
          totalOrders: orders.length,
          totalResults: apiResponse.data.TotalResults,
          currentPage: apiResponse.data.CurrentPage,
          totalPages: apiResponse.data.TotalPages,
          hasNext: apiResponse.data.HasNext,
          hasPrevious: apiResponse.data.HasPrevious,
          lastUpdated: new Date().toISOString(),
          apiHealth: "healthy",
        },
      };
    } catch (error) {
      console.error("❌ Failed to fetch orders from API:", error);

      return {
        orders: [],
        summary: {
          totalOrders: 0,
          totalResults: 0,
          currentPage: 1,
          totalPages: 0,
          hasNext: false,
          hasPrevious: false,
          lastUpdated: new Date().toISOString(),
          apiHealth: "offline",
        },
      };
    }
  }

  // Get a specific order by job number with full details
  async getOrderByJobNumber(jobNumber: string): Promise<ModernOrder | null> {
    console.log(`🔍 Fetching order ${jobNumber} from API...`);

    try {
      const jobDetails = await this.apiClient.getJobDetails(jobNumber);

      if (!jobDetails.job) {
        console.warn(`⚠️ Order ${jobNumber} not found`);
        return null;
      }

      const order = await this.convertAPIJobToModernOrder(jobDetails.job, {
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
      });

      console.log(`✅ Retrieved complete order details for ${jobNumber}`);
      return order;
    } catch (error) {
      console.error(`❌ Failed to fetch order ${jobNumber}:`, error);
      return null;
    }
  }

  // Search orders by query with semantic matching
  async searchOrdersByQuery(
    query: string,
    options: OrderSearchOptions = {}
  ): Promise<ModernOrder[]> {
    console.log(`🔍 Searching orders for: "${query}"`);

    try {
      // Use text filter for API search
      const allOrders = await this.getAllOrders({
        ...options,
        pageSize: 500, // Get more results for better search coverage
      });

      // Smart search logic with stop word filtering and semantic analysis
      const stopWords = new Set([
        "what",
        "where",
        "when",
        "who",
        "how",
        "why",
        "the",
        "a",
        "an",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "with",
        "by",
        "i",
        "you",
        "he",
        "she",
        "it",
        "we",
        "they",
        "me",
        "him",
        "her",
        "us",
        "them",
        "my",
        "your",
        "his",
        "her",
        "its",
        "our",
        "their",
        "this",
        "that",
        "these",
        "those",
        "is",
        "are",
        "was",
        "were",
        "be",
        "been",
        "being",
        "have",
        "has",
        "had",
        "do",
        "does",
        "did",
        "will",
        "would",
        "could",
        "should",
        "may",
        "might",
        "must",
        "can",
        "get",
        "need",
        "want",
        "focus",
        "today",
        "orders",
      ]);

      // Extract meaningful terms and special patterns
      const searchTerms = query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2 && !stopWords.has(term));

      // Look for value patterns (like 10k, $1000, etc.)
      const valuePattern = /(\d+k|\$\d+|dollar|revenue|value|profit|sales)/gi;
      const valueMatches = query.match(valuePattern) || [];

      // Look for job/order number patterns
      const jobPattern = /(?:job|order|#)\s*(\d+)/gi;
      const jobMatches = Array.from(query.matchAll(jobPattern)).map(
        (m) => m[1]
      );

      // Look for customer patterns
      const customerPattern = /(?:customer|client|company)\s+([a-zA-Z\s&]+)/gi;
      const customerMatches = Array.from(query.matchAll(customerPattern)).map(
        (m) => m[1].trim()
      );

      // Look for status patterns
      const statusPattern =
        /(urgent|rush|late|overdue|approved|completed|running\s+late|on\s+time|problem|critical)/gi;
      const statusMatches = query.match(statusPattern) || [];

      // If we have specific job numbers, search for those first
      if (jobMatches.length > 0) {
        const jobResults = allOrders.orders.filter((order) =>
          jobMatches.some((jobNum) => order.jobNumber === jobNum)
        );
        if (jobResults.length > 0) {
          console.log(`✅ Found ${jobResults.length} orders by job number`);
          return jobResults;
        }
      }

      // Filter orders based on meaningful criteria
      const filteredOrders = allOrders.orders.filter((order) => {
        const searchableText = [
          order.description,
          order.customer.company,
          order.orderNumber,
          order.jobNumber,
          order.comments,
          order.status.master,
          ...order.tags.map((t) => t.tag),
          ...order.lineItems.map((l) => l.description),
        ]
          .join(" ")
          .toLowerCase();

        // Check for value-related queries (10k = looking for high-value orders)
        if (valueMatches.length > 0) {
          const orderValue = order.lineItems.reduce(
            (sum, item) => sum + (item.totalPrice || 0),
            0
          );

          // If looking for "10k" type queries, prioritize higher value orders
          if (valueMatches.some((v) => v.includes("10k") || v.includes("10"))) {
            if (orderValue >= 1000) return true; // $1000+ orders for "10k" goals
          }
          if (
            valueMatches.some((v) => v.includes("dollar") || v.includes("$"))
          ) {
            if (orderValue > 500) return true; // Medium+ value orders
          }
        }

        // Check for customer matches
        if (customerMatches.length > 0) {
          if (
            customerMatches.some((customer) =>
              searchableText.includes(customer.toLowerCase())
            )
          )
            return true;
        }

        // Check for status matches
        if (statusMatches.length > 0) {
          if (
            statusMatches.some((status) =>
              searchableText.includes(status.toLowerCase())
            )
          )
            return true;
        }

        // Check for meaningful search terms (only need SOME, not ALL)
        if (searchTerms.length > 0) {
          const matchCount = searchTerms.filter((term) =>
            searchableText.includes(term)
          ).length;

          // Return true if at least 30% of meaningful terms match
          const matchRatio = matchCount / searchTerms.length;
          if (matchRatio >= 0.3) return true;
        }

        // Special handling for analytical queries
        if (
          query.toLowerCase().includes("focus") ||
          query.toLowerCase().includes("priority")
        ) {
          // Return high-value, urgent, or due-soon orders
          const orderValue = order.lineItems.reduce(
            (sum, item) => sum + (item.totalPrice || 0),
            0
          );

          return (
            orderValue >= 500 || // High value
            order.production.timeSensitive || // Time sensitive
            order.production.mustDate || // Must date
            order.dates.daysToDueDate <= 3 || // Due soon
            order.status.master.includes("Late") || // Running late
            order.tags.some(
              (t) =>
                t.tag.toLowerCase().includes("urgent") ||
                t.tag.toLowerCase().includes("rush")
            )
          );
        }

        return false;
      });

      console.log(
        `✅ Found ${filteredOrders.length} orders matching "${query}"`
      );
      return filteredOrders;
    } catch (error) {
      console.error(`❌ Search failed for "${query}":`, error);
      return [];
    }
  }

  // Get orders by status
  async getOrdersByStatus(status: string): Promise<ModernOrder[]> {
    const ordersData = await this.getAllOrders({ status });
    return ordersData.orders;
  }

  // Get orders by customer
  async getOrdersByCustomer(customerName: string): Promise<ModernOrder[]> {
    const allOrders = await this.getAllOrders({ pageSize: 500 });
    return allOrders.orders.filter((order) =>
      order.customer.company.toLowerCase().includes(customerName.toLowerCase())
    );
  }

  // Get orders by date range
  async getOrdersByDateRange(
    startDate: string,
    endDate: string
  ): Promise<ModernOrder[]> {
    const allOrders = await this.getAllOrders({
      dateRange: { start: startDate, end: endDate },
      pageSize: 500,
    });

    return allOrders.orders.filter((order) => {
      const orderDate = new Date(order.dates.dateEntered);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return orderDate >= start && orderDate <= end;
    });
  }

  // Get recent orders
  async getRecentOrders(limit: number = 10): Promise<ModernOrder[]> {
    const ordersData = await this.getAllOrders({
      pageSize: Math.min(limit, 200),
    });

    return ordersData.orders
      .sort(
        (a, b) =>
          new Date(b.dates.dateEntered).getTime() -
          new Date(a.dates.dateEntered).getTime()
      )
      .slice(0, limit);
  }

  // Get rush/urgent orders
  async getRushOrders(): Promise<ModernOrder[]> {
    const allOrders = await this.getAllOrders({ pageSize: 500 });
    return allOrders.orders.filter(
      (order) =>
        order.production.timeSensitive ||
        order.production.mustDate ||
        order.tags.some(
          (tag) =>
            tag.tag.toLowerCase().includes("rush") ||
            tag.tag.toLowerCase().includes("urgent")
        )
    );
  }

  // Get late orders
  async getLateOrders(): Promise<ModernOrder[]> {
    const allOrders = await this.getAllOrders({ pageSize: 500 });
    const now = new Date();

    return allOrders.orders.filter((order) => {
      const dueDate = new Date(order.dates.dateDue);
      return dueDate < now && !order.shipments.some((s) => s.shipped);
    });
  }

  // Get summary statistics
  async getSummaryStats() {
    console.log("📊 Calculating summary statistics...");

    try {
      const ordersData = await this.getAllOrders({ pageSize: 500 });
      const orders = ordersData.orders;

      const stats = {
        totalOrders: orders.length,
        totalValue: orders.reduce(
          (sum, order) =>
            sum +
            order.lineItems.reduce(
              (lineSum, line) => lineSum + (line.totalPrice || 0),
              0
            ),
          0
        ),
        statusBreakdown: {} as Record<string, number>,
        customerBreakdown: {} as Record<string, number>,
        recentActivity: orders.filter((order) => {
          const daysSinceUpdate =
            (Date.now() - new Date(order.dates.dateEntered).getTime()) /
            (1000 * 60 * 60 * 24);
          return daysSinceUpdate <= 7;
        }).length,
        urgentOrders: orders.filter(
          (order) => order.production.timeSensitive || order.production.mustDate
        ).length,
        lateOrders: orders.filter((order) => {
          const dueDate = new Date(order.dates.dateDue);
          return (
            dueDate < new Date() && !order.shipments.some((s) => s.shipped)
          );
        }).length,
        averageOrderValue: 0,
        lastUpdated: new Date().toISOString(),
      };

      // Calculate status breakdown
      orders.forEach((order) => {
        const status = order.status.master;
        stats.statusBreakdown[status] =
          (stats.statusBreakdown[status] || 0) + 1;
      });

      // Calculate customer breakdown (top 10)
      orders.forEach((order) => {
        const customer = order.customer.company;
        stats.customerBreakdown[customer] =
          (stats.customerBreakdown[customer] || 0) + 1;
      });

      // Keep only top 10 customers
      const topCustomers = Object.entries(stats.customerBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {});
      stats.customerBreakdown = topCustomers;

      stats.averageOrderValue = stats.totalValue / Math.max(orders.length, 1);

      console.log(`✅ Calculated statistics for ${orders.length} orders`);
      return stats;
    } catch (error) {
      console.error("❌ Failed to calculate summary stats:", error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const health = await this.apiClient.getHealthStatus();
      return {
        healthy: health.healthy,
        apiEndpoints: health.endpoints,
        cache: health.cache,
        rateLimit: health.rateLimit,
        connections: health.connections,
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
        lastCheck: new Date().toISOString(),
      };
    }
  }

  // Clear cache
  clearCache(): void {
    this.apiClient.clearCache();
    console.log("🗑️ Data service cache cleared");
  }
}

// Export singleton instance
export const apiFirstDataService = new APIFirstDataService();

// Export for backward compatibility (can be used to gradually replace old imports)
export const omsDataService = apiFirstDataService;

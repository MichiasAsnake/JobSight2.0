// Enhanced OMS API Client - Professional API-first data access
// Supports all discovered endpoints with intelligent caching, retries, and health monitoring

// ===== COMPREHENSIVE API INTERFACES =====

export interface APIJobListResponse {
  isSuccess: boolean;
  isError: boolean;
  data: {
    PageSize: number;
    ReturnedResults: number;
    TotalResults: number;
    TotalPages: number;
    CurrentPage: number;
    HasNext: boolean;
    HasPrevious: boolean;
    Entities: APIJob[];
  };
  responseText?: string;
  error?: APIError;
}

export interface APIJob {
  JobNumber: number;
  Client: string;
  CustomerId: number;
  Description: string;
  OrderNumber: string;
  DateIn: string;
  DateInUtc: string;
  DateDue: string;
  DateDueUtc: string;
  DateDueFactory: string;
  DaysToDueDate: number;
  MasterJobStatus: string;
  MasterJobStatusId: number;
  StockComplete: number;
  StockCompleteStatus: string;
  StatusLineHtml: string;
  StatusLine: string;
  DeliveryOption: string;
  JobQuantity: number;
  LocationCode: string;
  MustDate: boolean;
  TimeSensitive: boolean;
  IsReprint: boolean;
  IsDupe: boolean;
  Comments: string;
  JobTags: APIJobTag[];
  ProcessQuantities: APIProcessQuantity[];
  GangCodes: string[];
  BitVal: number;
  SortKey: string;
  JobLocationCode: string;
  JobLocationName: string;
  CanSuggestMachines: boolean;
  CanPrintJobLineLabels: boolean;
  HasScheduleableJobLines: boolean;
}

export interface APIJobTag {
  Tag: string;
  WhoEnteredUsername: string;
  WhenEntered: string;
  WhenEnteredUtc: string;
  Code: string;
  Meta: unknown;
}

export interface APIProcessQuantity {
  BitVal: number;
  Code: string;
  DisplayCode: string;
  Qty: number;
  SuggestedMachineId: number;
  SuggestedMachineLabel: string;
  HasSuggestedMachine: boolean;
}

export interface APIJobLines {
  isSuccess: boolean;
  isError: boolean;
  data: APIJobLine[];
  responseText?: string;
  error?: APIError;
}

export interface APIJobLine {
  // Core identification
  ID: number;
  JobNumber: number;
  Prgram: string; // Program/SKU/Asset code

  // Basic information
  Description: string;
  Garment: string; // Garment type/name
  Comments: string; // Detailed comments
  ProgComment: string; // Program-specific comments

  // Quantities and pricing
  Qty: number; // Requested quantity
  ActQty: number; // Actual quantity
  UnitPrice: number;

  // Status and progress
  Progress: number;
  MachineNumber: string;
  MachNum: number;

  // File and asset information
  PDFInstructions: string | null;
  PDFId: number;
  AssetImage: string | null;
  AssetImagePreviewUrl: string | null;
  AssetId: number;
  HasImage: boolean;
  AssetHasPDF: boolean;

  // Relationships
  ParentJobLineID: number;
  IsParentJobline: boolean;
  IsChildJobline: boolean;
  IsJoblineAlone: boolean;
  Order: number;

  // Capabilities and permissions
  IsScheduleable: boolean;
  IsEditable: boolean;
  CanUploadPDF: boolean;
  CanEdit: boolean;
  CanDelete: boolean;
  CanUploadImage: boolean;
  CanDuplicate: boolean;
  CanPrintLabel: boolean;
  CanReprintSeps: boolean;
  CanQCComplete: boolean;
  CanCheckSeps: boolean;

  // Type classification
  IsStock: boolean;
  IsAsset: boolean;
  IsOther: boolean;
  AssetIsNew: boolean;

  // Additional information
  Gang: string;
  GangMondayLink: string;
  Supplier: string;
  WorksheetId: number;
  WorksheetType: string;
  ExternalArtworkUrl: string | null;
  ExternalSupplier: string | null;

  // Encryption (for API calls)
  EncrptedJobLineId: string;
  EncrptedPrgram: string;

  // Machine types available for this job line
  JoblineTypes: Array<{
    ID: number;
    Machine: string;
    isAutoAdd: boolean;
  }>;

  // Price band information (optional)
  priceBand?: {
    categoryCode?: string;
    unitType?: string;
    priceCode?: string;
    humanName?: string;
    filterName?: string;
    processCode?: string;
    categorySetupMultiplier?: number;
    priceFormulaType?: string;
    active?: boolean;
  };

  // Legacy fields for backward compatibility
  LineId?: number;
  AssetSKU?: string;
  Category?: string;
  TotalPrice?: number;
  Comment?: string;
  Status?: string;
  ProcessCodes?: string[];
  Materials?: string[];
  HasPDF?: boolean;
}

export interface APIJobShipments {
  isSuccess: boolean;
  isError: boolean;
  data: {
    JobShipments: APIJobShipment[];
  };
  responseText?: string;
  error?: APIError;
}

export interface APIJobShipment {
  Id: number;
  Guid: string;
  Index: number;
  Title: string;
  MailingLabel: string;
  AddressSummaryOneLine: string;
  ContactDetailsOneLine: string;
  ShipmentNotes: string;
  IsShipmentIntl: boolean;
  CanShip: boolean;
  Shipped: boolean;
  DateShipped: string | null;
  CanCollect: boolean;
  Collected: boolean;
  CollectionDate: string | null;
  Validated: boolean;
  TrackingDetails: APITrackingDetails | null;
  ShipmentMethod: {
    label: string;
    value: string;
    iscollection: boolean;
    rank: number;
    deliveryLabelEnabled: boolean;
  };
  Address: APIAddress;
  ShipmentPackages: APIPackage[];
}

export interface APITrackingDetails {
  Logo: string;
  LogoPath: string;
  TrackingLink: string;
  TrackingLinkText: string;
  DeliveryStatus: string;
  InfoLine: string | null;
  ShippedVia: string;
  Status: string;
  LastUpdate: string;
}

export interface APIAddress {
  Id: number;
  Guid: string;
  ContactName: string;
  Organisation: string;
  Phone: string;
  Mobile: string;
  EmailAddress: string;
  CountryCodeISO2: string;
  CountryName: string;
  StreetAddress: string;
  AddressLine2: string;
  City: string;
  District: string;
  AdministrativeArea: string;
  AdministrativeAreaAbbreviation: string;
  ZipCode: string;
  Validated: boolean;
  AddressSummaryOneLine: string;
  MailingLabel: string;
}

export interface APIPackage {
  Name: string;
  Length: number;
  Width: number;
  Height: number;
  DimensionUnit: string;
  Weight: number;
  WeightUnit: string;
  IsCustom: boolean;
}

export interface APIJobHistory {
  isSuccess: boolean;
  isError: boolean;
  data: {
    MasterStatus: {
      Id: number;
      Status: string;
    };
    StockStatus: {
      Id: number;
      Status: string;
    };
    Location: {
      Id: number;
      Code: string;
      Name: string;
    };
    StatusFormat: string;
    StatusLineHtml: string;
    StatusLineText: string;
  };
  responseText?: string;
  error?: APIError;
}

export interface APIJobFiles {
  isSuccess: boolean;
  isError: boolean;
  data: never[];
  Aux4: {
    PageSize: number;
    ReturnedResults: number;
    TotalResults: number;
    TotalPages: number;
    CurrentPage: number;
    HasNext: boolean;
    HasPrevious: boolean;
    Entities: APIJobFile[];
  };
  responseText?: string;
  error?: APIError;
}

export interface APIJobFile {
  Guid: string;
  FileName: string;
  ContentType: string;
  FileSizeBytes: number;
  FormattedFileSize: string;
  EntityId: string;
  EntityType: string;
  CreatedBy: APIUser;
  CreatedDate: string;
  LastUpdatedBy: APIUser;
  LastUpdate: string;
  FileStatus: string;
  FileType: string;
  Uri: string;
  Category: string;
  Subcategory: string;
}

export interface APIUser {
  FirstName: string;
  LastName: string;
  FullName: string;
  Initials: string;
}

export interface APICategoryUnits {
  isSuccess: boolean;
  isError: boolean;
  data: APICategoryUnit[];
  responseText?: string;
  error?: APIError;
}

export interface APICategoryUnit {
  CategoryId: number;
  CategoryName: string;
  Units: string[];
  Materials: string[];
  Processes: string[];
}

export interface APIError {
  Message: string;
  ClassName: string;
  Data?: unknown;
}

export interface APIJobLinesCostDetails {
  isSuccess: boolean;
  isError: boolean;
  data: {
    jobLinesSubTotal: number;
    jobLinesTaxTotal: number;
    jobLinesTotalCost: number;
    jobLinesSubTotalFormattedText: string;
    jobLinesTaxTotalFormattedText: string;
    jobLinesTotalCostFormattedText: string;
  };
  responseText?: string;
  error?: APIError;
}

// ===== REQUEST INTERFACES =====

export interface JobListFilters {
  "machine-filter"?: string;
  "status-line-format"?: string;
  "no-loc-token"?: string;
  "show-due-date-filter"?: string;
  "tagged-user"?: string;
  "app-timezone"?: string;
  "text-filter"?: string;
  location?: string;
  "job-status-codes"?: string;
  "sort-by"?: string;
  "sort-direction"?: string;
  "job-status"?: string;
  "tagged-only"?: string;
  "due-date"?: string;
  "stock-status"?: string;
  "process-filter"?: string;
  "page-size"?: string;
  "requested-page"?: string;
  "get-job-counts"?: string;
  bit?: string;
}

// ===== CACHE INTERFACES =====

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
  etag?: string;
}

interface APIClientConfig {
  baseUrl: string;
  defaultTimeout: number;
  maxRetries: number;
  retryDelay: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  rateLimitPerMinute: number;
  connectionPoolSize: number;
  healthCheckInterval: number;
}

interface RequestOptions {
  timeout?: number;
  retries?: number;
  skipCache?: boolean;
  priority?: "low" | "normal" | "high";
}

// ===== ENHANCED API CLIENT CLASS =====

export class EnhancedOMSAPIClient {
  private config: APIClientConfig;
  private cache = new Map<string, CacheEntry<unknown>>();
  private rateLimitTokens: number;
  private lastRateLimitReset: number;
  private healthStatus = new Map<string, boolean>();
  private authCookies = "";
  private requestQueue: Array<() => Promise<void>> = [];
  private activeRequests = 0;

  // Statistics tracking
  private stats = {
    totalRequests: 0,
    totalErrors: 0,
    totalResponseTime: 0,
    averageResponseTime: 0,
  };

  // Cache for category unit mappings
  private categoryUnitCache: Map<string, number | any[]> | null = null;
  private categoryUnitCacheInitializing: Promise<void> | null = null;

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = {
      baseUrl: process.env.OMS_API_BASE_URL || "https://intranet.decopress.com",
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      rateLimitPerMinute: 60,
      connectionPoolSize: 5,
      healthCheckInterval: 30 * 1000, // 30 seconds
      ...config,
    };

    this.rateLimitTokens = this.config.rateLimitPerMinute;
    this.lastRateLimitReset = Date.now();

    // Auto-configure authentication from environment
    const authCookies =
      process.env.OMS_AUTH_COOKIES ||
      process.env.OMS_AUTH_COOKIE ||
      process.env.AUTH_COOKIES ||
      process.env.AUTH_COOKIE ||
      "";

    if (authCookies) {
      this.setAuthCookies(authCookies);
      console.log("🔐 Authentication cookie loaded from environment");
    }

    // Start periodic health checks
    setInterval(
      () => this.performHealthCheck(),
      this.config.healthCheckInterval
    );
  }

  // ===== AUTHENTICATION =====

  setAuthCookies(cookies: string): void {
    this.authCookies = cookies;
    console.log("🔐 Authentication cookies updated");
  }

  // ===== RATE LIMITING =====

  private checkRateLimit(): boolean {
    const now = Date.now();
    const timeSinceReset = now - this.lastRateLimitReset;

    // Reset tokens every minute
    if (timeSinceReset >= 60000) {
      this.rateLimitTokens = this.config.rateLimitPerMinute;
      this.lastRateLimitReset = now;
    }

    if (this.rateLimitTokens > 0) {
      this.rateLimitTokens--;
      return true;
    }

    return false;
  }

  private async waitForRateLimit(): Promise<void> {
    const waitTime = 60000 - (Date.now() - this.lastRateLimitReset);
    if (waitTime > 0) {
      console.log(`⏳ Rate limit reached, waiting ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  // ===== CONNECTION POOLING =====

  private async acquireConnection<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        if (this.activeRequests >= this.config.connectionPoolSize) {
          // Add to queue
          this.requestQueue.push(async () => {
            try {
              this.activeRequests++;
              const result = await operation();
              resolve(result);
            } catch (error) {
              reject(error);
            } finally {
              this.activeRequests--;
              this.processQueue();
            }
          });
        } else {
          // Execute immediately
          try {
            this.activeRequests++;
            const result = await operation();
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.activeRequests--;
            this.processQueue();
          }
        }
      };

      execute();
    });
  }

  private processQueue(): void {
    if (
      this.requestQueue.length > 0 &&
      this.activeRequests < this.config.connectionPoolSize
    ) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        nextRequest();
      }
    }
  }

  // ===== CACHING =====

  private getCacheKey(url: string, options: RequestInit = {}): string {
    const body = options.body?.toString() || "";
    return `${url}:${body}`;
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.config.cacheEnabled) return null;

    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    console.log(`📦 Cache hit for: ${key.substring(0, 50)}...`);
    return entry.data;
  }

  private setCache<T>(key: string, data: T, customTTL?: number): void {
    if (!this.config.cacheEnabled) return;

    const ttl = customTTL || this.config.cacheTTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    };

    this.cache.set(key, entry);
    console.log(`💾 Cached response for: ${key.substring(0, 50)}...`);
  }

  // ===== CORE REQUEST HANDLING =====

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {},
    requestOptions: RequestOptions = {}
  ): Promise<T> {
    const cacheKey = this.getCacheKey(url, options);

    // Check cache first
    if (!requestOptions.skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) return cached;
    }

    // Check rate limit
    if (!this.checkRateLimit()) {
      await this.waitForRateLimit();
    }

    return this.acquireConnection(async () => {
      const retries = requestOptions.retries ?? this.config.maxRetries;
      const timeout = requestOptions.timeout ?? this.config.defaultTimeout;

      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          console.log(`🌐 Making request to: ${url} (attempt ${attempt + 1})`);

          // Track request statistics
          const requestStartTime = Date.now();
          this.stats.totalRequests++;

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          const response = await fetch(`${this.config.baseUrl}${url}`, {
            ...options,
            headers: {
              Accept: "application/json, text/javascript, */*; q=0.01",
              "Accept-Language": "en-US,en;q=0.9",
              "X-Requested-With": "XMLHttpRequest",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              Cookie: this.authCookies,
              ...options.headers,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // Track response time
          const responseTime = Date.now() - requestStartTime;
          this.stats.totalResponseTime += responseTime;
          this.stats.averageResponseTime =
            this.stats.totalResponseTime / this.stats.totalRequests;

          if (!response.ok) {
            this.stats.totalErrors++;
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Get response text first to check if it's HTML
          const responseText = await response.text();

          // Check if response is HTML (likely an error page)
          if (
            responseText.includes("<!DOCTYPE") ||
            responseText.includes("<html")
          ) {
            this.stats.totalErrors++;
            throw new Error(
              `Authentication failed - received HTML response instead of JSON. Session may have expired.`
            );
          }

          // Try to parse as JSON
          let data: T;
          try {
            data = JSON.parse(responseText) as T;
          } catch (parseError) {
            this.stats.totalErrors++;
            throw new Error(
              `Failed to parse JSON response: ${parseError}. Response preview: ${responseText.substring(
                0,
                200
              )}`
            );
          }

          // Cache successful responses
          if (!requestOptions.skipCache) {
            this.setCache(cacheKey, data);
          }

          console.log(`✅ Request successful: ${url} (${responseTime}ms)`);
          return data;
        } catch (error) {
          console.error(`❌ Request failed (attempt ${attempt + 1}): ${error}`);

          if (attempt === retries) {
            throw new Error(
              `Request failed after ${retries + 1} attempts: ${error}`
            );
          }

          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      throw new Error("Request failed - should not reach here");
    });
  }

  // ===== PRIMARY API ENDPOINTS =====

  async getJobList(filters: JobListFilters = {}): Promise<APIJobListResponse> {
    const defaultFilters: JobListFilters = {
      "machine-filter":
        "US,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384",
      "status-line-format": "[MASTERJOBSTATUS] - [STOCKSTATUS]",
      "no-loc-token": "[NOLOC]",
      "show-due-date-filter": "true",
      "tagged-user": "@laser",
      "app-timezone": "America/Los_Angeles",
      location: "-1",
      "job-status-codes":
        "awaitingproof,changerequested,proofed,approved,ontime,runninglate,problem,completed,dispatched",
      "sort-by": "dateduefactory",
      "sort-direction": "asc",
      "job-status": "2,18,3,4,11,5,6,7,8,9,10",
      "due-date": "1,2,3",
      "stock-status": "0,1,2",
      "process-filter":
        "HW,AP,TC,MP,PR,NA,CR,DS,ES,PP,PA,EM,SW,SC,DF,Misc,Sewing,Dispatch,Stock,Bagging",
      bit: "get-job-list",
      "page-size": "200",
      "requested-page": "",
      "get-job-counts": "true",
      ...filters,
    };

    const body = new URLSearchParams(defaultFilters as Record<string, string>);

    return this.makeRequest<APIJobListResponse>(
      "/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      { priority: "high" }
    );
  }

  async getJobLines(
    jobNumber: string,
    customerId?: string
  ): Promise<APIJobLines> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-joblines",
      ...(customerId && { customerId }),
    });

    return this.makeRequest<APIJobLines>(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getJobHistory(jobNumber: string): Promise<APIJobHistory> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-job-history",
    });

    return this.makeRequest<APIJobHistory>(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getJobShipments(
    jobNumber: string,
    customerId?: string
  ): Promise<APIJobShipments> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-job-shipments",
      ...(customerId && { customerId }),
    });

    return this.makeRequest<APIJobShipments>(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getJobFiles(jobNumber: string): Promise<APIJobFiles> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-job-files",
    });

    return this.makeRequest<APIJobFiles>(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getCustomerById(customerId: string): Promise<unknown> {
    const params = new URLSearchParams({
      customerId,
      bit: "get-customer-by-id",
    });

    return this.makeRequest(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getDeliveryOptions(customerId: string): Promise<unknown> {
    const params = new URLSearchParams({
      "customer-id": customerId,
      bit: "get-delivery-options",
    });

    return this.makeRequest(`/Jobs/ajax/jobhandler.ashx?${params}`, {
      method: "GET",
    });
  }

  async getAllInwardsAndStockItems(jobNumber: string): Promise<unknown> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-all-inwards-and-stock-items",
    });

    return this.makeRequest(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getJobLinesCostDetails(
    jobNumber: string
  ): Promise<APIJobLinesCostDetails> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-joblines-cost-details",
    });

    return this.makeRequest<APIJobLinesCostDetails>(
      `/Jobs/ajax/JobHandler.ashx`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      }
    );
  }

  async getJobByNumber(jobNumber: string): Promise<APIJobListResponse> {
    const filters: JobListFilters = {
      "text-filter": jobNumber, // Filter by job number
      "page-size": "1", // We only need one result
      "requested-page": "1",
    };

    return this.getJobList(filters);
  }

  /**
   * Get job details with optional additional data
   * This allows us to minimize API calls by only fetching what's needed
   */
  async getJobDetailsOptimized(
    jobNumber: string,
    options: {
      includeHistory?: boolean;
      includeShipments?: boolean;
      includeFiles?: boolean;
    } = {}
  ): Promise<{
    job: APIJob | null;
    lines: APIJobLine[];
    history: APIJobHistory["data"] | null;
    shipments: APIJobShipment[];
    files: APIJobFile[];
  }> {
    const startTime = Date.now();
    console.log(`📡 Fetching optimized job details for ${jobNumber}...`);

    try {
      // Always fetch job info and line items (essential data)
      const promises: Promise<any>[] = [
        this.getJobByNumber(jobNumber),
        this.getJobLines(jobNumber),
      ];

      // Only fetch additional data if requested
      if (options.includeHistory) {
        promises.push(this.getJobHistory(jobNumber));
      }
      if (options.includeShipments) {
        promises.push(this.getJobShipments(jobNumber));
      }
      if (options.includeFiles) {
        promises.push(this.getJobFiles(jobNumber));
      }

      const responses = await Promise.allSettled(promises);
      const [jobResponse, linesResponse, ...additionalResponses] = responses;

      // Extract job data from responses
      let job: APIJob | null = null;
      let lines: APIJobLine[] = [];
      let history: APIJobHistory["data"] | null = null;
      let shipments: APIJobShipment[] = [];
      let files: APIJobFile[] = [];

      // Process job response
      if (
        jobResponse.status === "fulfilled" &&
        jobResponse.value.isSuccess &&
        jobResponse.value.data.Entities.length > 0
      ) {
        job = jobResponse.value.data.Entities[0];
      }

      // Process lines response
      if (
        linesResponse.status === "fulfilled" &&
        linesResponse.value.isSuccess
      ) {
        lines = linesResponse.value.data;
      }

      // Process additional responses based on what was requested
      let responseIndex = 0;
      if (options.includeHistory) {
        const historyResponse = additionalResponses[responseIndex++];
        if (
          historyResponse.status === "fulfilled" &&
          historyResponse.value.isSuccess
        ) {
          history = historyResponse.value.data;
        }
      }

      if (options.includeShipments) {
        const shipmentsResponse = additionalResponses[responseIndex++];
        if (
          shipmentsResponse.status === "fulfilled" &&
          shipmentsResponse.value.isSuccess
        ) {
          shipments = shipmentsResponse.value.data.JobShipments;
        }
      }

      if (options.includeFiles) {
        const filesResponse = additionalResponses[responseIndex++];
        if (
          filesResponse.status === "fulfilled" &&
          filesResponse.value.isSuccess
        ) {
          files = filesResponse.value.Aux4.Entities;
        }
      }

      const duration = Date.now() - startTime;
      const apiCalls =
        2 +
        (options.includeHistory ? 1 : 0) +
        (options.includeShipments ? 1 : 0) +
        (options.includeFiles ? 1 : 0);
      console.log(
        `✅ Optimized job details fetched for ${jobNumber} in ${duration}ms (${apiCalls} API calls)`
      );

      return {
        job,
        lines,
        history,
        shipments,
        files,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Failed to fetch optimized job details for ${jobNumber} after ${duration}ms:`,
        error
      );
      throw error;
    }
  }

  // ===== SECONDARY API ENDPOINTS =====

  async getAllCategoryUnits(): Promise<APICategoryUnits> {
    const params = new URLSearchParams({
      bit: "get-all-category-units",
      "no-cache": "0",
    });

    return this.makeRequest<APICategoryUnits>(
      `/assetmanager/ajax/assetbit.ashx?${params}`,
      {
        method: "GET",
      },
      { skipCache: false } // Cache this as it changes rarely
    );
  }

  async getAssetByTag(tag: string): Promise<unknown> {
    const params = new URLSearchParams({
      tag,
      bit: "get-asset-by-tag",
    });

    return this.makeRequest(`/Assets/ajax/AssetHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  async getPriceQuantityBands(
    categoryUnitId: string,
    priceTier: string,
    priceCode: string
  ): Promise<unknown> {
    const params = new URLSearchParams({
      "category-unit-id": categoryUnitId,
      "price-tier": priceTier,
      "price-code": priceCode,
      bit: "get-price-quantity-bands",
    });

    return this.makeRequest(`/assetmanager/ajax/assetbit.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  }

  /**
   * Get the appropriate category unit ID for a given program and quantity
   * This maps programs to their correct category unit IDs for pricing based on actual API data
   */
  public async getCategoryUnitIdForProgram(
    program: string,
    quantity?: number
  ): Promise<number> {
    // Initialize cache if needed
    if (!this.categoryUnitCache) {
      await this.initializeCategoryUnitCache();
    }

    // Double-check cache is available after initialization
    if (!this.categoryUnitCache) {
      console.warn(
        "⚠️ [CATEGORY-UNIT] Cache initialization failed, using fallback"
      );
      return 1; // Fallback category unit ID
    }

    console.log(
      `🔍 [CATEGORY-UNIT] Looking for program: "${program}" (qty: ${quantity})`
    );

    // Try to find a direct match first
    if (this.categoryUnitCache.has(program)) {
      const cached = this.categoryUnitCache.get(program)!;
      if (typeof cached === "number") {
        console.log(
          `✅ [CATEGORY-UNIT] Found direct cache match for "${program}": ID ${cached}`
        );
        return cached;
      }
    }

    console.log(
      `🔍 [CATEGORY-UNIT] No direct cache match for "${program}", searching full data...`
    );

    // If we have the full category units data, use it to find the best match
    if (this.categoryUnitCache.has("__full_data__")) {
      const fullData = this.categoryUnitCache.get("__full_data__") as any[];
      const programUpper = program.toUpperCase();

      console.log(
        `🔍 [CATEGORY-UNIT] Searching ${fullData.length} units for program "${program}"`
      );

      // Strategy 1: Try exact match on CategoryCode
      let matchingUnits = fullData.filter(
        (unit) =>
          unit.CategoryCode && unit.CategoryCode.toUpperCase() === programUpper
      );

      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 1 - Exact match: Found ${matchingUnits.length} matches for "${program}"`
      );

      if (matchingUnits.length > 0) {
        // If we have quantity, find the best matching unit based on quantity ranges
        if (quantity) {
          const bestMatch = this.findBestQuantityMatch(matchingUnits, quantity);
          if (bestMatch) {
            console.log(
              `🔍 [PRICE-BAND] Found exact quantity match for "${program}" (qty: ${quantity}): ID ${bestMatch.Id} (${bestMatch.UnitType})`
            );
            return bestMatch.Id;
          }
        }

        // Otherwise, use the first (lowest rank) unit
        const firstUnit = matchingUnits.sort((a, b) => a.Rank - b.Rank)[0];
        console.log(
          `🔍 [PRICE-BAND] Using first available unit for "${program}": ID ${firstUnit.Id} (${firstUnit.UnitType})`
        );
        return firstUnit.Id;
      }

      // Strategy 2: Try base program matching
      const baseProgram = this.extractBaseProgram(program);
      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 2 - Base program "${baseProgram}" for "${program}"`
      );

      matchingUnits = fullData.filter(
        (unit) =>
          unit.CategoryCode &&
          unit.CategoryCode.toUpperCase().includes(baseProgram.toUpperCase())
      );

      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 2 - Base program match: Found ${matchingUnits.length} matches for "${baseProgram}"`
      );

      if (matchingUnits.length > 0) {
        const firstMatch = matchingUnits.sort((a, b) => a.Rank - b.Rank)[0];
        console.log(
          `🔍 [PRICE-BAND] Found base program match for "${program}": ID ${firstMatch.Id} (${firstMatch.CategoryCode})`
        );
        return firstMatch.Id;
      }

      // Strategy 3: Try process code matching
      const processCode = this.extractProcessCode(program);
      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 3 - Process code "${processCode}" for "${program}"`
      );

      matchingUnits = fullData.filter(
        (unit) =>
          unit.ProcessCode &&
          unit.ProcessCode.toUpperCase() === processCode.toUpperCase()
      );

      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 3 - Process code match: Found ${matchingUnits.length} matches for "${processCode}"`
      );

      if (matchingUnits.length > 0) {
        const firstMatch = matchingUnits.sort((a, b) => a.Rank - b.Rank)[0];
        console.log(
          `🔍 [PRICE-BAND] Found process code match for "${program}": ID ${firstMatch.Id} (${firstMatch.ProcessCode})`
        );
        return firstMatch.Id;
      }
    }

    // Strategy 4: Try partial matches on category code
    if (this.categoryUnitCache.has("__full_data__")) {
      const fullData = this.categoryUnitCache.get("__full_data__") as any[];
      const programUpper = program.toUpperCase();

      const partialMatches = fullData.filter(
        (unit) =>
          unit.CategoryCode &&
          unit.CategoryCode.toUpperCase().includes(programUpper)
      );

      console.log(
        `🔍 [CATEGORY-UNIT] Strategy 4 - Partial match: Found ${partialMatches.length} matches for "${program}"`
      );

      if (partialMatches.length > 0) {
        const firstMatch = partialMatches.sort((a, b) => a.Rank - b.Rank)[0];
        console.log(
          `🔍 [PRICE-BAND] Found partial match for "${program}": ID ${firstMatch.Id} (${firstMatch.CategoryCode})`
        );
        return firstMatch.Id;
      }
    }

    // Last resort: find any active unit with the lowest rank
    if (this.categoryUnitCache.has("__full_data__")) {
      const fullData = this.categoryUnitCache.get("__full_data__") as any[];
      const activeUnits = fullData.filter((unit) => unit.Active === true);

      if (activeUnits.length > 0) {
        const lowestRankUnit = activeUnits.sort((a, b) => a.Rank - b.Rank)[0];
        console.warn(
          `⚠️ [PRICE-BAND] No specific mapping found for program "${program}", using lowest rank active unit: ID ${lowestRankUnit.Id} (${lowestRankUnit.CategoryCode})`
        );
        return lowestRankUnit.Id;
      }
    }

    // If we have no data at all, throw an error
    console.error(
      `❌ [CATEGORY-UNIT] No mapping found for program "${program}"`
    );
    console.error(
      `❌ [CATEGORY-UNIT] Available category codes:`,
      this.categoryUnitCache.has("__full_data__")
        ? Array.from(
            new Set(
              (this.categoryUnitCache.get("__full_data__") as any[])
                .map((u) => u.CategoryCode)
                .filter(Boolean)
            )
          ).slice(0, 10)
        : "No full data available"
    );
    throw new Error(
      `No category unit mapping found for program "${program}" and no fallback data available`
    );
  }

  /**
   * Get the appropriate price code for a given program
   * This constructs the price code based on the category unit data
   */
  public async getPriceCodeForProgram(program: string): Promise<string> {
    // Initialize cache if needed
    if (!this.categoryUnitCache) {
      await this.initializeCategoryUnitCache();
    }

    // Double-check cache is available after initialization
    if (!this.categoryUnitCache) {
      console.warn(
        "⚠️ [PRICE-CODE] Cache initialization failed, using fallback"
      );
      return `${program}:${program}`; // Fallback price code
    }

    // If we have full data, try to find the price code
    if (this.categoryUnitCache.has("__full_data__")) {
      const fullData = this.categoryUnitCache.get("__full_data__") as any[];
      const programUpper = program.toUpperCase();

      // Find the first unit for this program
      const matchingUnit = fullData.find(
        (unit) =>
          unit.CategoryCode && unit.CategoryCode.toUpperCase() === programUpper
      );

      if (matchingUnit && matchingUnit.PriceCode) {
        return matchingUnit.PriceCode;
      }
    }

    // Fallback: construct a basic price code
    return `${program}:${program}`;
  }

  /**
   * Get the price tier for a given program based on category unit data
   * This determines the appropriate pricing tier dynamically
   */
  public async getPriceTierForProgram(program: string): Promise<string> {
    try {
      // Ensure category unit cache is initialized
      if (!this.categoryUnitCache) {
        await this.initializeCategoryUnitCache();
      }

      // Double-check cache is available
      if (!this.categoryUnitCache) {
        console.warn(
          "⚠️ [PRICE-TIER] Category unit cache initialization failed, using fallback"
        );
        return "F"; // Fallback
      }

      // Get the full category unit data
      const fullData = this.categoryUnitCache.get("__full_data__") as any[];
      if (!fullData) {
        console.warn(
          "⚠️ [PRICE-TIER] No category unit data available, using fallback"
        );
        return "F"; // Fallback
      }

      // Find category units that match this program
      const matchingUnits = fullData.filter(
        (unit: any) =>
          unit.CategoryCode === program ||
          unit.HumanName?.toLowerCase().includes(program.toLowerCase())
      );

      if (matchingUnits.length === 0) {
        console.warn(
          `⚠️ [PRICE-TIER] No matching units found for program "${program}", using fallback`
        );
        return "F"; // Fallback
      }

      // Sort by rank (lower rank = higher priority)
      const sortedUnits = matchingUnits.sort(
        (a: any, b: any) => a.Rank - b.Rank
      );
      const bestUnit = sortedUnits[0];

      // Extract price tier from the unit data
      // The price tier is typically in the PriceCode field or can be derived from the unit type
      if (bestUnit.PriceCode) {
        // Try to extract tier from price code (e.g., "JACKET:F" -> "F")
        const tierMatch = bestUnit.PriceCode.match(/:([A-Z])$/);
        if (tierMatch) {
          console.log(
            `✅ [PRICE-TIER] Found tier "${tierMatch[1]}" for program "${program}" from price code`
          );
          return tierMatch[1];
        }
      }

      // If no price code, try to determine from unit type or other fields
      if (bestUnit.UnitType) {
        // Look for tier indicators in unit type
        const tierMatch = bestUnit.UnitType.match(/([A-Z])\s*$/);
        if (tierMatch) {
          console.log(
            `✅ [PRICE-TIER] Found tier "${tierMatch[1]}" for program "${program}" from unit type`
          );
          return tierMatch[1];
        }
      }

      // If still no match, use the first unit's default tier or fallback
      console.log(
        `ℹ️ [PRICE-TIER] Using fallback tier "F" for program "${program}"`
      );
      return "F";
    } catch (error) {
      console.error(
        `❌ [PRICE-TIER] Error determining price tier for program "${program}":`,
        error
      );
      return "F"; // Fallback
    }
  }

  /**
   * Extract the base program type from a program code
   * e.g., "HW13669" -> "HW", "EMB_BORDER_L" -> "EMB"
   */
  private extractBaseProgram(program: string): string {
    // Remove numbers and special characters, keep only letters
    const base = program.replace(/[0-9_]/g, "").toUpperCase();

    // Common mappings
    if (base.includes("EMB") || base.includes("EMBROIDERY")) return "EM";
    if (base.includes("HW") || base.includes("HEAT")) return "HW";
    if (base.includes("CR") || base.includes("SCREEN")) return "CR";
    if (base.includes("DF") || base.includes("DIGITAL")) return "DF";
    if (base.includes("DS") || base.includes("SUPPLIED")) return "DS";

    return base;
  }

  /**
   * Extract the process code from a program
   * e.g., "HW13669" -> "HW", "EMB_BORDER_L" -> "EM"
   */
  private extractProcessCode(program: string): string {
    const base = this.extractBaseProgram(program);

    // Map base programs to process codes
    switch (base) {
      case "EMB":
        return "EM";
      case "HW":
        return "HW";
      case "CR":
        return "CR";
      case "DF":
        return "DF";
      case "DS":
        return "DS";
      default:
        return base;
    }
  }

  /**
   * Find the best matching category unit based on quantity ranges
   */
  private findBestQuantityMatch(units: any[], quantity: number): any | null {
    // Sort units by rank (lower rank = higher priority)
    const sortedUnits = units.sort((a, b) => a.Rank - b.Rank);

    for (const unit of sortedUnits) {
      const unitType = unit.UnitType;

      // Parse quantity ranges like "1 to 6000", "6001 to 7000", etc.
      const rangeMatch = unitType.match(/(\d+)\s+to\s+(\d+)/);
      if (rangeMatch) {
        const minQty = parseInt(rangeMatch[1]);
        const maxQty = parseInt(rangeMatch[2]);

        if (quantity >= minQty && quantity <= maxQty) {
          return unit;
        }
      }

      // Handle single quantity ranges like "1 to 6000"
      if (unitType === "1 to 6000" && quantity <= 6000) {
        return unit;
      }
    }

    // If no exact match, return the first unit (lowest rank)
    return sortedUnits[0] || null;
  }

  /**
   * Initialize the category unit cache by fetching all category units
   * Handles concurrent access to prevent multiple simultaneous initializations
   */
  private async initializeCategoryUnitCache(): Promise<void> {
    // If already initializing, wait for that to complete
    if (this.categoryUnitCacheInitializing) {
      console.log(
        "⏳ [PRICE-BAND] Waiting for existing cache initialization..."
      );
      await this.categoryUnitCacheInitializing;
      return;
    }

    // If already initialized, return immediately
    if (this.categoryUnitCache) {
      return;
    }

    // Start initialization and store the promise
    this.categoryUnitCacheInitializing = this._initializeCategoryUnitCache();

    try {
      await this.categoryUnitCacheInitializing;
    } catch (error) {
      console.error("❌ [PRICE-BAND] Cache initialization failed:", error);
      // Reset the cache to null so we can retry
      this.categoryUnitCache = null;
      throw error;
    } finally {
      // Clear the initialization promise
      this.categoryUnitCacheInitializing = null;
    }
  }

  /**
   * Internal method to actually perform the cache initialization
   */
  private async _initializeCategoryUnitCache(): Promise<void> {
    try {
      console.log("🔄 [PRICE-BAND] Initializing category unit cache...");
      const response = await this.getAllCategoryUnits();

      if (response.isSuccess && response.data) {
        // Create a new Map instance
        const newCache = new Map<string, number | any[]>();

        // Store the full data for dynamic lookups
        newCache.set("__full_data__", response.data);

        // Debug: Log some sample data to understand the structure
        const sampleUnits = (response.data as any[]).slice(0, 3);
        console.log(
          "🔍 [PRICE-BAND] Sample category units:",
          sampleUnits.map((u) => ({
            id: u.Id,
            categoryCode: u.CategoryCode,
            humanName: u.HumanName,
            unitType: u.UnitType,
            priceCode: u.PriceCode,
            rank: u.Rank,
            active: u.Active,
          }))
        );

        // Create quick lookup mappings from the actual data
        const quickLookups = new Map<string, number>();

        // Find the first (lowest rank) unit for each unique category code
        const categoryGroups = new Map<string, any[]>();
        for (const unit of response.data as any[]) {
          if (unit.CategoryCode) {
            if (!categoryGroups.has(unit.CategoryCode)) {
              categoryGroups.set(unit.CategoryCode, []);
            }
            categoryGroups.get(unit.CategoryCode)!.push(unit);
          }
        }

        // Add the first unit for each category code as a quick lookup
        for (const [categoryCode, units] of categoryGroups) {
          const firstUnit = units.sort((a: any, b: any) => a.Rank - b.Rank)[0];
          quickLookups.set(categoryCode, firstUnit.Id);
        }

        // Add quick lookup entries
        for (const [categoryCode, id] of quickLookups) {
          newCache.set(categoryCode, id);
        }

        // Only assign the cache after it's fully populated
        this.categoryUnitCache = newCache;

        console.log(
          `✅ [PRICE-BAND] Category unit cache initialized with ${response.data.length} units, ${categoryGroups.size} unique categories`
        );

        // Debug: Log some mappings
        const sampleMappings = Array.from(quickLookups.entries()).slice(0, 5);
        console.log(
          "🔍 [PRICE-BAND] Sample category mappings:",
          sampleMappings
        );
      } else {
        console.warn(
          "⚠️ [PRICE-BAND] Failed to initialize category unit cache, using fallback mappings"
        );
        this.categoryUnitCache = new Map();
      }
    } catch (error) {
      console.error(
        "❌ [PRICE-BAND] Error initializing category unit cache:",
        error
      );
      // Don't set an empty cache, let it remain null so we can retry
      throw error;
    }
  }

  // ===== BATCH OPERATIONS =====

  async getJobDetails(
    jobNumber: string,
    options: {
      includePriceBands?: boolean;
      includeHistory?: boolean;
      includeShipments?: boolean;
      includeFiles?: boolean;
    } = {}
  ): Promise<{
    job: APIJob | null;
    lines: APIJobLine[];
    history: APIJobHistory["data"] | null;
    shipments: APIJobShipment[];
    files: APIJobFile[];
  }> {
    const startTime = Date.now();
    console.log(`📡 Fetching job details for ${jobNumber}...`);

    try {
      // For most queries, we only need job info and line items with pricing
      // Only fetch additional data if specifically requested
      const [jobResponse, linesResponse] = await Promise.allSettled([
        this.getJobByNumber(jobNumber),
        this.getJobLines(jobNumber),
      ]);

      // Extract job data from responses
      let job: APIJob | null = null;
      let lines: APIJobLine[] = [];
      let history: APIJobHistory["data"] | null = null;
      let shipments: APIJobShipment[] = [];
      let files: APIJobFile[] = [];

      // Process job response
      if (
        jobResponse.status === "fulfilled" &&
        jobResponse.value.isSuccess &&
        jobResponse.value.data.Entities.length > 0
      ) {
        job = jobResponse.value.data.Entities[0];
      }

      // Process lines response
      if (
        linesResponse.status === "fulfilled" &&
        linesResponse.value.isSuccess
      ) {
        lines = linesResponse.value.data;

        // Optionally fetch price bands for each line item
        if (options.includePriceBands && lines.length > 0) {
          console.log(
            `💰 Fetching price bands for ${lines.length} line items...`
          );

          // Fetch price bands in parallel for all line items
          const priceBandPromises = lines.map(async (line) => {
            try {
              console.log(`🔍 [PRICE-BAND] Processing line ${line.ID}:`, {
                program: line.Prgram,
                quantity: line.Qty,
                description: line.Description,
                garment: line.Garment,
              });

              // Get the correct category unit ID for this program and quantity
              const categoryUnitId = await this.getCategoryUnitIdForProgram(
                line.Prgram,
                line.Qty
              );
              const priceTier = await this.getPriceTierForProgram(line.Prgram);
              const priceCode = await this.getPriceCodeForProgram(line.Prgram);

              console.log(`🔍 [PRICE-BAND] Fetching for line ${line.ID}:`, {
                categoryUnitId,
                priceTier,
                priceCode,
                program: line.Prgram,
                assetId: line.AssetId,
              });

              const priceBand = (await this.getPriceQuantityBands(
                categoryUnitId.toString(),
                priceTier,
                priceCode
              )) as any; // Type assertion for now since the response type is unknown

              console.log(
                `📡 [PRICE-BAND] Raw response for line ${line.ID}:`,
                priceBand
              );

              const transformedPriceBand = {
                categoryCode: priceBand?.CategoryCode,
                unitType: priceBand?.UnitType,
                priceCode: priceBand?.PriceCode,
                humanName: priceBand?.HumanName,
                filterName: priceBand?.FilterName,
                processCode: priceBand?.ProcessCode,
                categorySetupMultiplier: priceBand?.CategorySetupMultiplier,
                priceFormulaType: priceBand?.PriceFormulaType,
                active: priceBand?.Active,
              };

              console.log(
                `✅ [PRICE-BAND] Transformed for line ${line.ID}:`,
                transformedPriceBand
              );

              return {
                lineId: line.ID,
                priceBand: transformedPriceBand,
              };
            } catch (error) {
              console.warn(
                `⚠️ Failed to fetch price band for line ${line.ID}:`,
                error
              );
              return { lineId: line.ID, priceBand: null };
            }
          });

          const priceBandResults = await Promise.allSettled(priceBandPromises);

          // Attach price band data to line items
          priceBandResults.forEach((result, index) => {
            if (result.status === "fulfilled" && result.value.priceBand) {
              lines[index] = {
                ...lines[index],
                priceBand: result.value.priceBand,
              };
            }
          });

          console.log(`✅ Price bands fetched for ${lines.length} line items`);
        }
      }

      // For now, we'll skip history, shipments, and files unless specifically needed
      // This reduces API calls from 5 to 2 for most queries
      // TODO: Add optional parameters to fetch additional data when needed

      const duration = Date.now() - startTime;
      console.log(
        `✅ Job details fetched for ${jobNumber} in ${duration}ms (lines: ${lines.length}, shipments: ${shipments.length}, files: ${files.length})`
      );

      return {
        job,
        lines,
        history,
        shipments,
        files,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(
        `❌ Failed to fetch job details for ${jobNumber} after ${duration}ms:`,
        error
      );
      throw error;
    }
  }

  /**
   * Batch get job details for multiple jobs to reduce API calls
   */
  async getJobDetailsBatch(jobNumbers: string[]): Promise<
    Map<
      string,
      {
        job: APIJob | null;
        lines: APIJobLine[];
        history: APIJobHistory["data"] | null;
        shipments: APIJobShipment[];
        files: APIJobFile[];
      }
    >
  > {
    const startTime = Date.now();
    console.log(
      `📡 Batch fetching job details for ${jobNumbers.length} jobs...`
    );

    const results = new Map<
      string,
      {
        job: APIJob | null;
        lines: APIJobLine[];
        history: APIJobHistory["data"] | null;
        shipments: APIJobShipment[];
        files: APIJobFile[];
      }
    >();

    // Process in smaller batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < jobNumbers.length; i += batchSize) {
      const batch = jobNumbers.slice(i, i + batchSize);
      console.log(
        `📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          jobNumbers.length / batchSize
        )}`
      );

      // Process batch in parallel with rate limiting
      const batchPromises = batch.map(async (jobNumber) => {
        try {
          const details = await this.getJobDetails(jobNumber);
          return { jobNumber, details };
        } catch (error) {
          console.error(
            `❌ Failed to fetch details for job ${jobNumber}:`,
            error
          );
          return {
            jobNumber,
            details: {
              job: null,
              lines: [],
              history: null,
              shipments: [],
              files: [],
            },
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // Add results to map
      for (const { jobNumber, details } of batchResults) {
        results.set(jobNumber, details);
      }

      // Add delay between batches to respect rate limits
      if (i + batchSize < jobNumbers.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `✅ Batch job details completed in ${duration}ms for ${results.size} jobs`
    );

    return results;
  }

  async getAllActiveJobs(): Promise<APIJob[]> {
    console.log(
      "📊 Fetching all active jobs with comprehensive filters and pagination..."
    );

    const allJobs: APIJob[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.getJobList({
          "requested-page": currentPage.toString(),
          "page-size": "200", // Ensure we get maximum jobs per page
        });

        if (response.isSuccess && response.data.Entities) {
          allJobs.push(...response.data.Entities);
          console.log(
            `📄 Page ${currentPage}: ${response.data.Entities.length} jobs (${allJobs.length}/${response.data.TotalResults} total)`
          );

          hasMore = response.data.HasNext;
          currentPage++;

          // Add a small delay between pages to avoid overwhelming the API
          if (hasMore) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        } else {
          console.error("❌ Failed to fetch job list page:", response.error);
          break;
        }
      } catch (error) {
        console.error(`❌ Error fetching page ${currentPage}:`, error);
        break;
      }
    }

    console.log(
      `✅ Fetched ${allJobs.length} total active jobs with comprehensive status coverage`
    );
    console.log(`📊 Job status breakdown:`);

    // Log status breakdown for verification
    const statusCounts = allJobs.reduce((acc, job) => {
      acc[job.MasterJobStatus] = (acc[job.MasterJobStatus] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   - ${status}: ${count} jobs`);
    });

    return allJobs;
  }

  // ===== HEALTH & MONITORING =====

  private async performHealthCheck(): Promise<void> {
    const endpoints = [
      "/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
      "/Jobs/ajax/JobHandler.ashx",
      "/ajax/GeneralHandler.ashx",
    ];

    for (const endpoint of endpoints) {
      try {
        // Make a lightweight test request
        const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
          method: "HEAD",
          headers: { Cookie: this.authCookies },
        });

        this.healthStatus.set(endpoint, response.ok);
      } catch {
        this.healthStatus.set(endpoint, false);
      }
    }
  }

  async getHealthStatus(): Promise<{
    healthy: boolean;
    endpoints: Record<string, boolean>;
    cache: {
      size: number;
      hitRate: number;
    };
    rateLimit: {
      tokensRemaining: number;
      resetTime: number;
    };
    connections: {
      active: number;
      queued: number;
    };
  }> {
    const endpointStatus = Object.fromEntries(this.healthStatus);
    const allHealthy = Object.values(endpointStatus).every(Boolean);

    return {
      healthy: allHealthy,
      endpoints: endpointStatus,
      cache: {
        size: this.cache.size,
        hitRate: 0, // TODO: Implement cache hit rate tracking
      },
      rateLimit: {
        tokensRemaining: this.rateLimitTokens,
        resetTime: this.lastRateLimitReset + 60000,
      },
      connections: {
        active: this.activeRequests,
        queued: this.requestQueue.length,
      },
    };
  }

  // Health check method for admin dashboard
  async healthCheck(): Promise<{
    healthy: boolean;
    responseTime?: number;
    endpoints?: Record<string, boolean>;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Test basic API connectivity with a simple endpoint
      const testResponse = await this.getJobList({ "page-size": "1" });
      const responseTime = Date.now() - startTime;

      // Get current health status
      const healthStatus = await this.getHealthStatus();

      return {
        healthy: healthStatus.healthy,
        responseTime,
        endpoints: healthStatus.endpoints,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Health check failed",
      };
    }
  }

  // Get basic statistics
  getStats() {
    return { ...this.stats };
  }

  // Get performance statistics for admin dashboard
  async getPerformanceStats(): Promise<{
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  }> {
    const stats = this.getStats();

    return {
      totalRequests: stats.totalRequests,
      successRate:
        stats.totalRequests > 0
          ? (stats.totalRequests - stats.totalErrors) / stats.totalRequests
          : 0,
      averageResponseTime: stats.averageResponseTime,
      errorRate:
        stats.totalRequests > 0 ? stats.totalErrors / stats.totalRequests : 0,
      activeConnections: this.activeRequests,
    };
  }

  clearCache(): void {
    this.cache.clear();
    console.log("🗑️ API cache cleared");
  }

  async warmupCache(): Promise<void> {
    console.log("🔥 Warming up API cache...");

    try {
      // Warm up with basic job list and category data
      await Promise.all([
        this.getJobList({ "page-size": "50" }),
        this.getAllCategoryUnits(),
      ]);

      console.log("✅ Cache warmup completed");
    } catch (error) {
      console.error("❌ Cache warmup failed:", error);
    }
  }
}

// ===== AUTHENTICATION HELPERS =====

function loadAuthCookiesFromEnv(): string {
  // Load authentication cookies from environment variables
  const cookieString =
    process.env.OMS_AUTH_COOKIES ||
    process.env.OMS_AUTH_COOKIE ||
    process.env.AUTH_COOKIES ||
    process.env.AUTH_COOKIE ||
    "";

  if (!cookieString) {
    console.warn("⚠️ No authentication cookies found in environment variables");
    console.warn(
      "💡 Set OMS_AUTH_COOKIES or OMS_AUTH_COOKIE environment variable with your session cookies"
    );
    return "";
  }

  console.log("🔐 Authentication cookie loaded from environment");
  return cookieString;
}

// ===== SINGLETON INSTANCE =====

let _enhancedAPIClient: EnhancedOMSAPIClient | null = null;

function getEnhancedAPIClient(): EnhancedOMSAPIClient {
  if (!_enhancedAPIClient) {
    _enhancedAPIClient = new EnhancedOMSAPIClient({
      cacheEnabled: true,
      cacheTTL: 5 * 60 * 1000, // 5 minutes
      rateLimitPerMinute: 60,
      connectionPoolSize: 10,
    });

    // Set authentication cookies on first access
    if (typeof window === "undefined") {
      // Server-side only - load auth cookies from environment
      const authCookies = loadAuthCookiesFromEnv();
      if (authCookies) {
        _enhancedAPIClient.setAuthCookies(authCookies);
        console.log("🔐 Authentication cookies updated for singleton");
      }

      // Skip cache warmup during build to avoid expired cookie errors
      // Cache will warm up during actual runtime requests
      if (process.env.NODE_ENV !== "production") {
        setTimeout(() => {
          _enhancedAPIClient!.warmupCache().catch(console.error);
        }, 1000);
      }
    }
  }
  return _enhancedAPIClient;
}

// Export a getter that creates the instance on first access
export const enhancedAPIClient = new Proxy({} as EnhancedOMSAPIClient, {
  get(target, prop) {
    const instance = getEnhancedAPIClient();
    return (instance as any)[prop];
  },
});

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
  LineId: number;
  JobNumber: number;
  AssetSKU: string;
  Description: string;
  Category: string;
  Quantity: number;
  UnitPrice: number;
  TotalPrice: number;
  Comment: string;
  Status: string;
  ProcessCodes: string[];
  Materials: string[];
  HasImage: boolean;
  HasPDF: boolean;
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

  constructor(config: Partial<APIClientConfig> = {}) {
    this.config = {
      baseUrl: "https://intranet.decopress.com",
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
    if (process.env.OMS_AUTH_COOKIE) {
      this.setAuthCookies(process.env.OMS_AUTH_COOKIE);
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

          const data = (await response.json()) as T;

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

  async getJobLinesCostDetails(jobNumber: string): Promise<unknown> {
    const params = new URLSearchParams({
      jobNumber,
      bit: "get-joblines-cost-details",
    });

    return this.makeRequest(`/Jobs/ajax/JobHandler.ashx`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
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

  // ===== BATCH OPERATIONS =====

  async getJobDetails(jobNumber: string): Promise<{
    job: APIJob | null;
    lines: APIJobLine[];
    history: APIJobHistory["data"] | null;
    shipments: APIJobShipment[];
    files: APIJobFile[];
  }> {
    console.log(`📊 Fetching complete job details for: ${jobNumber}`);

    try {
      // Get job from list first
      const jobListResponse = await this.getJobList({
        "text-filter": jobNumber,
      });
      const job =
        jobListResponse.data.Entities.find(
          (j) => j.JobNumber.toString() === jobNumber
        ) || null;

      if (!job) {
        console.warn(`⚠️ Job ${jobNumber} not found in job list`);
        return {
          job: null,
          lines: [],
          history: null,
          shipments: [],
          files: [],
        };
      }

      // Fetch all related data in parallel
      const [linesResponse, historyResponse, shipmentsResponse, filesResponse] =
        await Promise.all([
          this.getJobLines(jobNumber, job.CustomerId.toString()).catch(
            (err) => {
              console.warn(
                `⚠️ Failed to fetch job lines for ${jobNumber}:`,
                err
              );
              return {
                isSuccess: false,
                isError: true,
                data: [],
                error: {
                  Message: err.message || "Failed to fetch job lines",
                  ClassName: "APIError",
                },
              } as APIJobLines;
            }
          ),
          this.getJobHistory(jobNumber).catch((err) => {
            console.warn(
              `⚠️ Failed to fetch job history for ${jobNumber}:`,
              err
            );
            return {
              isSuccess: false,
              isError: true,
              data: {
                MasterStatus: { Id: 0, Status: "Unknown" },
                StockStatus: { Id: 0, Status: "Unknown" },
                Location: { Id: 0, Code: "", Name: "" },
                StatusFormat: "",
                StatusLineHtml: "",
                StatusLineText: "",
              },
              error: {
                Message: err.message || "Failed to fetch job history",
                ClassName: "APIError",
              },
            } as APIJobHistory;
          }),
          this.getJobShipments(jobNumber, job.CustomerId.toString()).catch(
            (err) => {
              console.warn(
                `⚠️ Failed to fetch job shipments for ${jobNumber}:`,
                err
              );
              return {
                isSuccess: false,
                isError: true,
                data: { JobShipments: [] },
                error: {
                  Message: err.message || "Failed to fetch job shipments",
                  ClassName: "APIError",
                },
              } as APIJobShipments;
            }
          ),
          this.getJobFiles(jobNumber).catch((err) => {
            console.warn(`⚠️ Failed to fetch job files for ${jobNumber}:`, err);
            return {
              isSuccess: false,
              isError: true,
              data: [],
              Aux4: {
                PageSize: 0,
                ReturnedResults: 0,
                TotalResults: 0,
                TotalPages: 0,
                CurrentPage: 1,
                HasNext: false,
                HasPrevious: false,
                Entities: [],
              },
              error: {
                Message: err.message || "Failed to fetch job files",
                ClassName: "APIError",
              },
            } as APIJobFiles;
          }),
        ]);

      return {
        job,
        lines: linesResponse.data || [],
        history: historyResponse.isSuccess ? historyResponse.data : null,
        shipments: shipmentsResponse.data?.JobShipments || [],
        files: filesResponse.Aux4?.Entities || [],
      };
    } catch (error) {
      console.error(`❌ Failed to fetch job details for ${jobNumber}:`, error);
      throw error;
    }
  }

  async getAllActiveJobs(): Promise<APIJob[]> {
    console.log("📊 Fetching all active jobs with pagination...");

    const allJobs: APIJob[] = [];
    let currentPage = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.getJobList({
          "requested-page": currentPage.toString(),
          "page-size": "200",
        });

        if (response.isSuccess && response.data.Entities) {
          allJobs.push(...response.data.Entities);
          console.log(
            `📄 Page ${currentPage}: ${response.data.Entities.length} jobs (${allJobs.length}/${response.data.TotalResults} total)`
          );

          hasMore = response.data.HasNext;
          currentPage++;
        } else {
          console.error("❌ Failed to fetch job list page:", response.error);
          break;
        }
      } catch (error) {
        console.error(`❌ Error fetching page ${currentPage}:`, error);
        break;
      }
    }

    console.log(`✅ Fetched ${allJobs.length} total active jobs`);
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

export const enhancedAPIClient = new EnhancedOMSAPIClient({
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  rateLimitPerMinute: 60,
  connectionPoolSize: 10,
});

// Set authentication cookies on initialization
if (typeof window === "undefined") {
  // Server-side only - load auth cookies from environment
  const authCookies = loadAuthCookiesFromEnv();
  if (authCookies) {
    enhancedAPIClient.setAuthCookies(authCookies);
    console.log("🔐 Authentication cookies updated");
  }

  // Skip cache warmup during build to avoid expired cookie errors
  // Cache will warm up during actual runtime requests
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      enhancedAPIClient.warmupCache().catch(console.error);
    }, 1000);
  }
}

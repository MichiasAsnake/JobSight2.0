// OMS API Client - Handles all discovered OMS endpoints
// Based on reverse-engineered API endpoints from network traffic analysis

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
  DaysToDueDate: number;
  MasterJobStatus: string;
  MasterJobStatusId: number;
  StockComplete: number;
  StockCompleteStatus: string;
  StatusLineHtml: string;
  DeliveryOption: string;
  JobTags: Array<{
    Tag: string;
    WhoEnteredUsername: string;
    WhenEntered: string;
    WhenEnteredUtc: string;
    Code?: string;
    Meta?: any;
  }>;
  ProcessQuantities: Array<{
    BitVal: number;
    Code: string;
    DisplayCode: string;
    Qty: number;
    SuggestedMachineId?: number;
    SuggestedMachineLabel?: string;
    HasSuggestedMachine?: boolean;
  }>;
  Comments?: string;
  JobQuantity?: number;
  LocationCode?: string;
  MustDate?: boolean;
  TimeSensitive?: boolean;
  StopCredit?: string;
  IsReprint?: boolean;
  IsDupe?: boolean;
}

// New interfaces for missing endpoints
export interface APIJobLines {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    ID: number;
    Prgram: string;
    Description: string;
    Qty: number;
    UnitPrice: number;
    Garment: string;
    Comments: string;
    ProgComment: string;
    JobNumber: number;
    ActQty: number;
    MachineNumber: string;
    Progress: number;
    IsScheduleable: boolean;
    IsEditable: boolean;
    AssetImage?: string;
    AssetImagePreviewUrl?: string;
    HasImage: boolean;
    AssetHasPDF: boolean;
    CanEdit: boolean;
    CanDelete: boolean;
    IsStock: boolean;
    IsAsset: boolean;
    IsOther: boolean;
    Order: number;
    Gang: string;
    AssetId: number;
    ExternalArtworkUrl?: string;
    ExternalSupplier?: string;
  }>;
  Aux1?: any;
  Aux2?: any;
  Aux3?: {
    MasterStatus: { Id: number; Status: string };
    StockStatus: { Id: number; Status: string };
    Location: { Id: number; Code: string; Name: string };
    StatusLineHtml: string;
    StatusLineText: string;
  };
}

export interface APIJobHistory {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    Entry: string;
    Detail: string;
  }>;
}

export interface APIStockItems {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    Items: Array<{
      Id: number;
      TxtDelId: number;
      SzId: number;
      Code: string;
      Garment: string;
      Colour: string;
      Sz1: number;
      Sz2: number;
      Sz3: number;
      // ... up to Sz20
      Totals: number;
      SzDescription: string;
      Deducted: number;
    }>;
    ID: number;
    Description: string;
    LocCode: string;
    ClientOrderNumber: string;
    Customer: string;
    Supplier: string;
    DateIn: string;
    Quantity: number;
    DeliveryDateUtc: string;
    Cartons: number;
    PackageType: string;
  }>;
}

export interface APICustomer {
  isSuccess: boolean;
  isError: boolean;
  data: {
    Id: number;
    Name: string;
    PriceTierCode: string;
    Identifier: string;
    AccountOnCreditHold: boolean;
    LocationId?: number;
    LocationName: string;
    Address: {
      StreetAddress: string;
      AddressLine2: string;
      City: string;
      State: string;
      PostalCode: string;
      Country: string;
      FullAddress: string;
    };
    Users: Array<{
      Id: number;
      UserName: {
        FirstName: string;
        LastName: string;
        FullName: string;
        Initials: string;
      };
      EmailAddress: string;
      Phone: string;
      IsCustomerAdmin: boolean;
      UserAddress: {
        StreetAddress: string;
        City: string;
        State: string;
        PostalCode: string;
        Country: string;
      };
    }>;
  };
}

export interface APIJobCostDetails {
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
}

export interface APIDeliveryOptions {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    label: string;
    value: string;
    iscollection: boolean;
    rank: number;
    deliveryLabelEnabled: boolean;
  }>;
}

export interface APIPriceQuantityBands {
  isSuccess: boolean;
  isError: boolean;
  data: {
    CategoryUnitId: number;
    CategoryCode: string;
    UnitType: string;
    CategoryName: string;
    Setup: number;
    Reset: number;
    PriceCalcType: string;
    ProcessCode: string;
    PriceTierCode: string;
    QuantityBands: Array<{
      Id: number;
      From: number;
      To: number | null;
      PerUnit: number;
      MinCharge: number;
      Tier: string;
    }>;
  };
}

export interface APICategoryUnits {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    Id: number;
    CategoryCode: string;
    UnitType: string;
    Rank: number;
    CatName: string;
    PriceCalcType: string;
    ProcessCode: string;
    CategorySetupMultiplier: number;
    HumanName: string;
    FilterName: string;
    PriceCode: string;
    Active: boolean;
    MapsToMasterProcess: string;
  }>;
}

export interface APIJobShipments {
  isSuccess: boolean;
  isError: boolean;
  data: {
    JobShipments: Array<{
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
      DateShipped?: string;
      CanCollect: boolean;
      Collected: boolean;
      CollectionDate?: string;
      Validated: boolean;
      IsCollection: boolean;
      IsComplete: boolean;
      ActionsAvailable: string[];
      ShipmentMethod: {
        label: string;
        value: string;
        iscollection: boolean;
        rank: number;
        deliveryLabelEnabled: boolean;
      };
      IsSaturdayDelivery: boolean;
      TrackingDetails?: any;
      Address: {
        Id: number;
        Guid: string;
        ContactName: string;
        Organisation: string;
        Phone: string;
        EmailAddress: string;
        CountryCodeISO2: string;
        CountryName: string;
        StreetAddress: string;
        AddressLine2: string;
        City: string;
        AdministrativeArea: string;
        AdministrativeAreaAbbreviation: string;
        ZipCode: string;
        Validated: boolean;
        AddressSummaryOneLine: string;
        MailingLabel: string;
      };
    }>;
  };
}

export interface APIJobStatus {
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
    StatusLineHtml: string;
    StatusLineText: string;
  };
}

export interface APIJobFiles {
  isSuccess: boolean;
  isError: boolean;
  data: Array<{
    fileName: string;
    fileType: string;
    uploadDate: string;
    fileSize?: number;
  }>;
}

export interface APIResponse<T = unknown> {
  isSuccess: boolean;
  isError: boolean;
  data: T;
  responseText?: string;
  error?: {
    Message: string;
    ClassName: string;
  };
}

export class OMSAPIClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl = "https://intranet.decopress.com") {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      Accept: "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    };
  }

  // Set authentication cookies (to be called after user login)
  setAuthCookies(cookies: string) {
    this.defaultHeaders["Cookie"] = cookies;
  }

  private async makeRequest<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<APIResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${url}`, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as APIResponse<T>;
      return data;
    } catch (error) {
      console.error("API request failed:", error);
      return {
        isSuccess: false,
        isError: true,
        data: null as T,
        responseText: error instanceof Error ? error.message : "Unknown error",
        error: {
          Message: error instanceof Error ? error.message : "Unknown error",
          ClassName: "NetworkError",
        },
      };
    }
  }

  // Job List API - Main job listing with pagination
  async getJobList(
    filters: Record<string, string> = {}
  ): Promise<APIJobListResponse> {
    const defaultFilters = {
      "machine-filter":
        "US,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384",
      "status-line-format": "[MASTERJOBSTATUS] - [STOCKSTATUS]",
      "no-loc-token": "[NOLOC]",
      "show-due-date-filter": "true",
      "tagged-user": "@laser",
      "app-timezone": "America/Los_Angeles",
      "text-filter": "",
      location: "-1",
      "job-status-codes": "approved,ontime,runninglate,problem,closed",
      "sort-by": "dateduefactory",
      "sort-direction": "asc",
      "job-status": "2,18,3,4,11,5,6,7,8,9,10,12",
      "tagged-only": "0",
      "due-date": "1,2,3",
      "stock-status": "0,1,2",
      "process-filter":
        "HW,AP,TC,MP,PR,NA,CR,DS,ES,PP,PA,EM,SW,SC,DF,Misc,Sewing,Dispatch,Stock,Bagging",
      bit: "get-job-list",
      "page-size": "200",
      "requested-page": "",
      "user-def-sort-def": "status,stockstatus",
      "get-job-counts": "true",
    };

    const body = new URLSearchParams({
      ...defaultFilters,
      ...filters,
    }).toString();

    return this.makeRequest<APIJobListResponse["data"]>(
      "/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      }
    );
  }

  // Job Detail APIs
  async getJobStatus(jobNumber: string): Promise<APIJobStatus> {
    return this.makeRequest<APIJobStatus["data"]>(
      `/Jobs/ajax/JobHandler.ashx?bit=get-job-status&jobNumber=${jobNumber}`
    );
  }

  async getJobShipments(
    jobNumber: string,
    customerId?: string
  ): Promise<APIJobShipments> {
    const params = new URLSearchParams({
      bit: "get-job-shipments",
      jobNumber,
    });

    if (customerId) {
      params.append("customer-id", customerId);
    }

    return this.makeRequest<APIJobShipments["data"]>(
      `/Jobs/ajax/jobhandler.ashx?${params.toString()}`
    );
  }

  async getJobHistory(jobNumber: string): Promise<APIJobHistory> {
    return this.makeRequest<APIJobHistory["data"]>(
      `/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber=${jobNumber}`
    );
  }

  async getJobFiles(jobNumber: string): Promise<APIJobFiles> {
    return this.makeRequest<APIJobFiles["data"]>(
      `/Jobs/ajax/JobHandler.ashx?bit=get-job-files&jobNumber=${jobNumber}`
    );
  }

  async getJobLines(jobNumber: string): Promise<APIJobLines> {
    return this.makeRequest<APIJobLines["data"]>(
      `/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber=${jobNumber}`
    );
  }

  // NEW: Stock and inventory information
  async getStockItems(jobNumber: string): Promise<APIStockItems> {
    const body = new URLSearchParams({
      jobNumber,
      bit: "get-all-inwards-and-stock-items",
    }).toString();

    return this.makeRequest<APIStockItems["data"]>(
      "/Jobs/ajax/JobHandler.ashx",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      }
    );
  }

  // NEW: Customer detailed information
  async getCustomerById(customerId: string): Promise<APICustomer> {
    const body = new URLSearchParams({
      customerId,
      bit: "get-customer-by-id",
    }).toString();

    return this.makeRequest<APICustomer["data"]>("/Jobs/ajax/JobHandler.ashx", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body,
    });
  }

  // NEW: Job cost and pricing details
  async getJobCostDetails(jobNumber: string): Promise<APIJobCostDetails> {
    const body = new URLSearchParams({
      bit: "get-joblines-cost-details",
      jobNumber,
    }).toString();

    return this.makeRequest<APIJobCostDetails["data"]>(
      "/Jobs/ajax/JobHandler.ashx",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      }
    );
  }

  // NEW: Delivery options for customer
  async getDeliveryOptions(customerId: string): Promise<APIDeliveryOptions> {
    return this.makeRequest<APIDeliveryOptions["data"]>(
      `/Jobs/ajax/jobhandler.ashx?bit=get-delivery-options&customer-id=${customerId}`
    );
  }

  // NEW: Price quantity bands for pricing calculations
  async getPriceQuantityBands(
    categoryUnitId: string,
    priceTier: string,
    priceCode: string
  ): Promise<APIPriceQuantityBands> {
    const body = new URLSearchParams({
      "category-unit-id": categoryUnitId,
      "price-tier": priceTier,
      "price-code": priceCode,
      bit: "get-price-quantity-bands",
    }).toString();

    return this.makeRequest<APIPriceQuantityBands["data"]>(
      "/assetmanager/ajax/assetbit.ashx",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
        body,
      }
    );
  }

  // Asset Management API
  async getAssetCategories(): Promise<APICategoryUnits> {
    return this.makeRequest<APICategoryUnits["data"]>(
      "/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units&no-cache=0"
    );
  }

  // NEW: Get enriched job data with all related information
  async getEnrichedJobData(
    jobNumber: string,
    customerId?: string
  ): Promise<{
    job: APIJob | null;
    jobLines: APIJobLines["data"] | null;
    stockItems: APIStockItems["data"] | null;
    customer: APICustomer["data"] | null;
    costDetails: APIJobCostDetails["data"] | null;
    shipments: APIJobShipments["data"] | null;
    history: APIJobHistory["data"] | null;
    deliveryOptions: APIDeliveryOptions["data"] | null;
  }> {
    const results = {
      job: null as APIJob | null,
      jobLines: null as APIJobLines["data"] | null,
      stockItems: null as APIStockItems["data"] | null,
      customer: null as APICustomer["data"] | null,
      costDetails: null as APIJobCostDetails["data"] | null,
      shipments: null as APIJobShipments["data"] | null,
      history: null as APIJobHistory["data"] | null,
      deliveryOptions: null as APIDeliveryOptions["data"] | null,
    };

    try {
      // First get basic job info to get customer ID
      const jobListResponse = await this.getJobList({
        "text-filter": jobNumber,
        "page-size": "1",
      });

      if (
        jobListResponse.isSuccess &&
        jobListResponse.data.Entities.length > 0
      ) {
        results.job =
          jobListResponse.data.Entities.find(
            (job) => job.JobNumber.toString() === jobNumber
          ) || null;

        if (results.job) {
          const actualCustomerId =
            customerId || results.job.CustomerId.toString();

          // Make parallel requests for all job details
          const [
            jobLinesResponse,
            stockItemsResponse,
            customerResponse,
            costDetailsResponse,
            shipmentsResponse,
            historyResponse,
            deliveryOptionsResponse,
          ] = await Promise.allSettled([
            this.getJobLines(jobNumber),
            this.getStockItems(jobNumber),
            this.getCustomerById(actualCustomerId),
            this.getJobCostDetails(jobNumber),
            this.getJobShipments(jobNumber, actualCustomerId),
            this.getJobHistory(jobNumber),
            this.getDeliveryOptions(actualCustomerId),
          ]);

          // Extract successful responses
          if (
            jobLinesResponse.status === "fulfilled" &&
            jobLinesResponse.value.isSuccess
          ) {
            results.jobLines = jobLinesResponse.value.data;
          }
          if (
            stockItemsResponse.status === "fulfilled" &&
            stockItemsResponse.value.isSuccess
          ) {
            results.stockItems = stockItemsResponse.value.data;
          }
          if (
            customerResponse.status === "fulfilled" &&
            customerResponse.value.isSuccess
          ) {
            results.customer = customerResponse.value.data;
          }
          if (
            costDetailsResponse.status === "fulfilled" &&
            costDetailsResponse.value.isSuccess
          ) {
            results.costDetails = costDetailsResponse.value.data;
          }
          if (
            shipmentsResponse.status === "fulfilled" &&
            shipmentsResponse.value.isSuccess
          ) {
            results.shipments = shipmentsResponse.value.data;
          }
          if (
            historyResponse.status === "fulfilled" &&
            historyResponse.value.isSuccess
          ) {
            results.history = historyResponse.value.data;
          }
          if (
            deliveryOptionsResponse.status === "fulfilled" &&
            deliveryOptionsResponse.value.isSuccess
          ) {
            results.deliveryOptions = deliveryOptionsResponse.value.data;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching enriched job data:", error);
    }

    return results;
  }

  // Health check method
  async checkAPIHealth(): Promise<{
    healthy: boolean;
    endpoints: Record<string, boolean>;
  }> {
    const endpoints = {
      jobList: false,
      assetCategories: false,
      jobLines: false,
      customerData: false,
    };

    try {
      // Test job list endpoint (lightweight call)
      const jobListResponse = await this.getJobList({ "page-size": "1" });
      endpoints.jobList = jobListResponse.isSuccess;

      // Test asset categories endpoint
      const assetsResponse = await this.getAssetCategories();
      endpoints.assetCategories = assetsResponse.isSuccess;

      // Test job lines endpoint if we have job data
      if (
        jobListResponse.isSuccess &&
        jobListResponse.data.Entities.length > 0
      ) {
        const firstJob = jobListResponse.data.Entities[0];
        const jobLinesResponse = await this.getJobLines(
          firstJob.JobNumber.toString()
        );
        endpoints.jobLines = jobLinesResponse.isSuccess;

        const customerResponse = await this.getCustomerById(
          firstJob.CustomerId.toString()
        );
        endpoints.customerData = customerResponse.isSuccess;
      }
    } catch (error) {
      console.error("API health check failed:", error);
    }

    const healthy = Object.values(endpoints).some((status) => status);
    return { healthy, endpoints };
  }
}

// Create singleton instance
export const omsAPIClient = new OMSAPIClient();

// API-First Data Service - Replaces file-based data with direct API calls
// Uses the enhanced API client for real-time data access with intelligent caching

import {
  enhancedAPIClient,
  APIJob,
  APIJobLine,
  APIJobShipment,
  APIJobFile,
  APIJobLinesCostDetails,
} from "./enhanced-api-client";
import OpenAI from "openai";
import {
  intelligentEndpointMapper,
  EnrichedOrderData,
} from "./intelligent-endpoint-mapper";

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
      hasSuggestedMachine?: boolean;
    }>;
    gangCodes: string[];
    timeSensitive: boolean;
    mustDate: boolean;
    isReprint: boolean;
    isDupe: boolean;
    canSuggestMachines: boolean;
    canPrintJobLineLabels: boolean;
    hasScheduleableJobLines: boolean;
  };

  // Line items (from get-joblines)
  lineItems: Array<{
    // Core identification
    lineId?: number;
    jobNumber?: number;
    program?: string; // Program/SKU/Asset code

    // Basic information
    description: string;
    garment?: string; // Garment type/name
    comment?: string; // Detailed comments
    progComment?: string; // Program-specific comments

    // Quantities and pricing
    quantity: number;
    actualQuantity?: number;
    unitPrice?: number;
    totalPrice?: number;

    // Status and progress
    progress?: number;
    machineNumber?: string;
    machineNum?: number;

    // File and asset information
    pdfInstructions?: string;
    pdfId?: number;
    assetImage?: string;
    assetImagePreviewUrl?: string;
    assetId?: number;
    hasImage?: boolean;
    assetHasPDF?: boolean;

    // Relationships
    parentJobLineId?: number;
    isParentJobline?: boolean;
    isChildJobline?: boolean;
    isJoblineAlone?: boolean;
    order?: number;

    // Capabilities and permissions
    isScheduleable?: boolean;
    isEditable?: boolean;
    canUploadPDF?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canUploadImage?: boolean;
    canDuplicate?: boolean;
    canPrintLabel?: boolean;
    canReprintSeps?: boolean;
    canQCComplete?: boolean;
    canCheckSeps?: boolean;

    // Type classification
    isStock?: boolean;
    isAsset?: boolean;
    isOther?: boolean;
    assetIsNew?: boolean;

    // Additional information
    gang?: string;
    gangMondayLink?: string;
    supplier?: string;
    worksheetId?: number;
    worksheetType?: string;
    externalArtworkUrl?: string;
    externalSupplier?: string;

    // Machine types available for this job line
    joblineTypes?: string[];

    // Price band information (will be populated when needed)
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
    status?: string;
    category?: string;
    processCodes?: string[];
    materials?: string[];
    hasPDF?: boolean;
    assetSKU?: string;
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
    code?: string;
    meta?: any;
  }>;

  // Workflow flags
  workflow: {
    hasScheduleableJobLines: boolean;
    canPrintJobLineLabels: boolean;
    hasJobFiles: boolean;
    hasProof: boolean;
  };

  // Pricing information (calculated from line items)
  pricing?: {
    total: number;
    totalFormatted: string;
    subtotal?: number;
    subtotalFormatted?: string;
    tax?: number;
    taxFormatted?: string;
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
      includeHistory?: boolean;
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
          hasSuggestedMachine: pq.HasSuggestedMachine,
        })),
        gangCodes: apiJob.GangCodes,
        timeSensitive: apiJob.TimeSensitive,
        mustDate: apiJob.MustDate,
        isReprint: apiJob.IsReprint,
        isDupe: apiJob.IsDupe,
        canSuggestMachines: apiJob.CanSuggestMachines,
        canPrintJobLineLabels: apiJob.CanPrintJobLineLabels,
        hasScheduleableJobLines: apiJob.HasScheduleableJobLines,
      },

      lineItems: [], // Will be populated if requested
      shipments: [], // Will be populated if requested
      files: [], // Will be populated if requested

      tags: apiJob.JobTags.map((tag) => ({
        tag: tag.Tag,
        enteredBy: tag.WhoEnteredUsername,
        dateEntered: tag.WhenEnteredUtc,
        code: tag.Code,
        meta: tag.Meta,
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
          apiJob.JobNumber.toString(),
          {
            includePriceBands: true,
            includeHistory: options.includeHistory,
            includeShipments: options.includeShipments,
            includeFiles: options.includeFiles,
          }
        );

        if (options.includeLineItems && jobDetails.lines) {
          // Extract materials from tags for enrichment
          const materialTags = order.tags
            .filter(
              (tag) =>
                tag.tag.toLowerCase().includes("gamma") ||
                tag.tag.toLowerCase().includes("emb") ||
                tag.tag.toLowerCase().includes("patch")
            )
            .map((tag) => tag.tag);

          order.lineItems = jobDetails.lines.map((line) => {
            // Try to get quantity from line item, fallback to job quantity if line quantity is 0
            let quantity = line.Qty || 0;
            if (quantity === 0 && order.jobQuantity > 0) {
              // For setup items or items without specific quantities, use job quantity
              if (
                line.Description.toLowerCase().includes("setup") ||
                line.UnitPrice === 0
              ) {
                quantity = order.jobQuantity;
              }
            }

            // Enhance materials from tags if not available in line item
            let materials = line.Materials || [];
            if (materials.length === 0 && materialTags.length > 0) {
              materials = materialTags;
            }

            return {
              // Core identification
              lineId: line.ID || line.LineId || undefined,
              jobNumber: line.JobNumber || undefined,
              program: line.Prgram || undefined, // Program/SKU/Asset code

              // Basic information
              description: line.Description || "Unknown item",
              garment: line.Garment || undefined, // Garment type/name
              comment: line.Comments || line.Comment || undefined, // Detailed comments
              progComment: line.ProgComment || undefined, // Program-specific comments

              // Quantities and pricing
              quantity: quantity,
              actualQuantity: line.ActQty || undefined,
              unitPrice: line.UnitPrice || undefined,
              totalPrice:
                line.TotalPrice ||
                (line.UnitPrice ? line.UnitPrice * quantity : undefined),

              // Status and progress
              progress: line.Progress || undefined,
              machineNumber: line.MachineNumber || undefined,
              machineNum: line.MachNum || undefined,

              // File and asset information
              pdfInstructions: line.PDFInstructions || undefined,
              pdfId: line.PDFId || undefined,
              assetImage: line.AssetImage || undefined,
              assetImagePreviewUrl: line.AssetImagePreviewUrl || undefined,
              assetId: line.AssetId || undefined,
              hasImage: line.HasImage || false,
              assetHasPDF: line.AssetHasPDF || false,

              // Relationships
              parentJobLineId: line.ParentJobLineID,
              isParentJobline: line.IsParentJobline,
              isChildJobline: line.IsChildJobline,
              isJoblineAlone: line.IsJoblineAlone,
              order: line.Order,

              // Capabilities and permissions
              isScheduleable: line.IsScheduleable,
              isEditable: line.IsEditable,
              canUploadPDF: line.CanUploadPDF,
              canEdit: line.CanEdit,
              canDelete: line.CanDelete,
              canUploadImage: line.CanUploadImage,
              canDuplicate: line.CanDuplicate,
              canPrintLabel: line.CanPrintLabel,
              canReprintSeps: line.CanReprintSeps,
              canQCComplete: line.CanQCComplete,
              canCheckSeps: line.CanCheckSeps,

              // Type classification
              isStock: line.IsStock,
              isAsset: line.IsAsset,
              isOther: line.IsOther,
              assetIsNew: line.AssetIsNew,

              // Additional information
              gang: line.Gang || undefined,
              gangMondayLink: line.GangMondayLink || undefined,
              supplier: line.Supplier || undefined,
              worksheetId: line.WorksheetId || undefined,
              worksheetType: line.WorksheetType || undefined,
              externalArtworkUrl: line.ExternalArtworkUrl || undefined,
              externalSupplier: line.ExternalSupplier || undefined,

              // Machine types available for this job line
              joblineTypes: line.JoblineTypes
                ? line.JoblineTypes.map((type: any) => type.Machine).filter(
                    Boolean
                  )
                : undefined,

              // Price band information (pre-fetched if available)
              priceBand: line.priceBand || undefined,

              // Legacy fields for backward compatibility
              status: line.Status || undefined,
              category: line.Category || undefined,
              processCodes: line.ProcessCodes || undefined,
              materials: materials,
              hasPDF: line.HasPDF || false,
              assetSKU: line.AssetSKU || undefined,
            };
          });
        }

        // Also fetch cost details for accurate pricing
        if (options.includeLineItems) {
          try {
            console.log(`💰 Fetching cost details for ${apiJob.JobNumber}...`);
            const costDetails = await this.apiClient.getJobLinesCostDetails(
              apiJob.JobNumber.toString()
            );

            console.log(`💰 Cost details response for ${apiJob.JobNumber}:`, {
              isSuccess: costDetails.isSuccess,
              hasData: !!costDetails.data,
              error: costDetails.error?.Message,
            });

            if (costDetails.isSuccess && costDetails.data) {
              const costData = costDetails.data;
              order.pricing = {
                total: costData.jobLinesTotalCost || 0,
                totalFormatted:
                  costData.jobLinesTotalCostFormattedText ||
                  `$${(costData.jobLinesTotalCost || 0).toLocaleString(
                    "en-US",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}`,
                subtotal: costData.jobLinesSubTotal || 0,
                subtotalFormatted:
                  costData.jobLinesSubTotalFormattedText ||
                  `$${(costData.jobLinesSubTotal || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                tax: costData.jobLinesTaxTotal || 0,
                taxFormatted:
                  costData.jobLinesTaxTotalFormattedText ||
                  `$${(costData.jobLinesTaxTotal || 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
              };
              console.log(
                `✅ Pricing added to order ${apiJob.JobNumber}: $${order.pricing.totalFormatted}`
              );
            } else {
              console.warn(
                `⚠️ No cost details available for ${apiJob.JobNumber}:`,
                costDetails.error?.Message || "No data returned"
              );
            }
          } catch (error) {
            console.warn(
              `⚠️ Failed to fetch cost details for ${apiJob.JobNumber}:`,
              error
            );
          }
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

    // Calculate pricing from line items
    if (order.lineItems && order.lineItems.length > 0) {
      const total = order.lineItems.reduce((sum, item) => {
        // Use totalPrice if available, otherwise calculate from unitPrice * quantity
        if (item.totalPrice && item.totalPrice > 0) {
          return sum + item.totalPrice;
        } else if (item.unitPrice && item.quantity) {
          return sum + item.unitPrice * item.quantity;
        }
        return sum;
      }, 0);

      if (total > 0) {
        order.pricing = {
          total,
          totalFormatted: `$${total.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
        };
      }
    }

    return order;
  }

  // Get all active orders WITHOUT enrichment (default for performance)
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

      // Convert API jobs to modern orders WITHOUT enrichment by default
      // This prevents excessive API calls when we just need basic job data
      const orders = await Promise.all(
        apiResponse.data.Entities.map((apiJob) =>
          this.convertAPIJobToModernOrder(apiJob, {
            includeLineItems: false, // Don't enrich by default
            includeShipments: false, // Don't enrich by default
            includeFiles: false, // Don't enrich by default
          })
        )
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Converted ${orders.length} API orders in ${processingTime}ms (no enrichment)`
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

  // Get all active orders WITH enrichment (use sparingly due to API call overhead)
  async getAllOrdersWithEnrichment(
    options: OrderSearchOptions = {}
  ): Promise<ModernOrdersData> {
    console.log("📊 Fetching all orders from API WITH enrichment...");

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

      // Convert API jobs to modern orders WITH enrichment
      const orders = await Promise.all(
        apiResponse.data.Entities.map((apiJob) =>
          this.convertAPIJobToModernOrder(apiJob, {
            includeLineItems: options.includeLineItems ?? true,
            includeShipments: options.includeShipments ?? true,
            includeFiles: options.includeFiles ?? false,
          })
        )
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Converted ${orders.length} API orders in ${processingTime}ms (WITH enrichment)`
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
      // Fetch job details and cost details in parallel
      console.log(
        `📡 Fetching job details and cost details for ${jobNumber}...`
      );
      const [jobDetails, costDetails] = await Promise.allSettled([
        this.apiClient.getJobDetails(jobNumber, {
          includePriceBands: true, // Pre-fetch price bands for all line items
          includeHistory: false,
          includeShipments: true,
          includeFiles: true,
        }),
        this.apiClient.getJobLinesCostDetails(jobNumber),
      ]);

      console.log(`📊 Cost details result:`, {
        status: costDetails.status,
        isSuccess:
          costDetails.status === "fulfilled"
            ? costDetails.value.isSuccess
            : "N/A",
        hasData:
          costDetails.status === "fulfilled" ? !!costDetails.value.data : "N/A",
      });

      if (jobDetails.status === "rejected" || !jobDetails.value.job) {
        console.warn(`⚠️ Order ${jobNumber} not found`);
        return null;
      }

      const order = await this.convertAPIJobToModernOrder(
        jobDetails.value.job,
        {
          includeLineItems: true,
          includeShipments: true,
          includeFiles: true,
        }
      );

      // Add pricing from cost details if available
      if (
        costDetails.status === "fulfilled" &&
        costDetails.value.isSuccess &&
        costDetails.value.data
      ) {
        const costData = costDetails.value
          .data as APIJobLinesCostDetails["data"];
        console.log(`💰 Cost data for ${jobNumber}:`, costData);
        order.pricing = {
          total: costData.jobLinesTotalCost || 0,
          totalFormatted:
            costData.jobLinesTotalCostFormattedText ||
            `$${(costData.jobLinesTotalCost || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          subtotal: costData.jobLinesSubTotal || 0,
          subtotalFormatted:
            costData.jobLinesSubTotalFormattedText ||
            `$${(costData.jobLinesSubTotal || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
          tax: costData.jobLinesTaxTotal || 0,
          taxFormatted:
            costData.jobLinesTaxTotalFormattedText ||
            `$${(costData.jobLinesTaxTotal || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
        };
        console.log(`✅ Pricing added to order ${jobNumber}:`, order.pricing);
      } else {
        console.log(`⚠️ No cost details available for ${jobNumber}:`, {
          status: costDetails.status,
          value: costDetails.status === "fulfilled" ? costDetails.value : "N/A",
        });
      }

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

      // Use GPT-4 for intelligent semantic filtering
      const { semanticSearchService } = await import("./semantic-search");
      const semanticFilters =
        await semanticSearchService.generateSemanticFilters(query);

      console.log(
        "🔍 Semantic filters generated:",
        JSON.stringify(semanticFilters, null, 2)
      );

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

        // TEMPORAL & URGENCY SEMANTIC MATCHING (check BEFORE text matching)
        const queryLower = query.toLowerCase();

        // Check for urgency indicators
        if (
          queryLower.includes("urgent") ||
          queryLower.includes("rush") ||
          queryLower.includes("asap")
        ) {
          if (order.production.timeSensitive || order.production.mustDate) {
            return true;
          }
        }

        // Check for temporal indicators - THIS WEEK
        if (
          queryLower.includes("this week") ||
          queryLower.includes("due this week")
        ) {
          const now = new Date();
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);

          const orderDueDate = new Date(order.dates.dateDue);
          if (orderDueDate >= startOfWeek && orderDueDate <= endOfWeek) {
            return true;
          }
        }

        // Check for TODAY
        if (queryLower.includes("today") || queryLower.includes("due today")) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const endOfToday = new Date(today);
          endOfToday.setHours(23, 59, 59, 999);

          const orderDueDate = new Date(order.dates.dateDue);
          if (orderDueDate >= today && orderDueDate <= endOfToday) {
            return true;
          }
        }

        // Check for OVERDUE
        if (
          queryLower.includes("overdue") ||
          queryLower.includes("late") ||
          queryLower.includes("behind")
        ) {
          if (
            order.dates.daysToDueDate < 0 ||
            order.status.master.toLowerCase().includes("late")
          ) {
            return true;
          }
        }

        // Check for NEXT X DAYS
        const nextDaysMatch = queryLower.match(/next (\d+) days?/);
        if (nextDaysMatch) {
          const days = parseInt(nextDaysMatch[1]);
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const futureDate = new Date(now);
          futureDate.setDate(now.getDate() + days);
          futureDate.setHours(23, 59, 59, 999);

          const orderDueDate = new Date(order.dates.dateDue);
          if (orderDueDate >= now && orderDueDate <= futureDate) {
            return true;
          }
        }

        return true; // Get all orders first
      });

      // Apply GPT-powered semantic filtering
      const semanticallyFilteredOrders =
        semanticSearchService.applySemanticFilters(
          allOrders.orders,
          semanticFilters
        );

      console.log(
        `✅ Found ${semanticallyFilteredOrders.length} orders matching "${query}" (${allOrders.orders.length} total orders processed)`
      );

      return semanticallyFilteredOrders;
    } catch (error) {
      console.error(`❌ Search failed for "${query}":`, error);
      return [];
    }
  }

  // Enhanced search with intelligent endpoint-based data enrichment
  async searchOrdersWithIntelligentEnrichment(
    query: string,
    options: OrderSearchOptions = {}
  ): Promise<ModernOrder[]> {
    console.log(`🧠 Enhanced search with intelligent enrichment: "${query}"`);

    try {
      // Step 1: Get base orders using existing semantic search
      const baseOrders = await this.searchOrdersByQuery(query, options);

      if (baseOrders.length === 0) {
        return [];
      }

      console.log(
        `📋 Found ${baseOrders.length} base orders, analyzing endpoints needed...`
      );

      // Step 2: Analyze query to determine which endpoints to call
      const endpointAnalysis =
        await intelligentEndpointMapper.analyzeQueryForEndpoints(
          query,
          baseOrders.slice(0, 5) // Sample for analysis
        );

      console.log(
        `🔧 Will enrich with ${endpointAnalysis.requiredEndpoints.length} endpoints (confidence: ${endpointAnalysis.confidence})`
      );

      // Step 3: Only enrich if we have meaningful endpoints to call
      if (
        endpointAnalysis.requiredEndpoints.length === 0 ||
        endpointAnalysis.confidence === "low"
      ) {
        console.log(
          "📤 No significant enrichment needed, returning base orders"
        );
        return baseOrders;
      }

      // Step 4: Enrich orders with additional endpoint data
      const enrichedData =
        await intelligentEndpointMapper.enrichOrdersWithEndpoints(
          baseOrders.slice(0, 10), // Limit enrichment for performance
          endpointAnalysis
        );

      // Step 5: Convert enriched data back to ModernOrder format with additional context
      const enrichedOrders = enrichedData.map((enriched) =>
        this.mergeEnrichedDataIntoOrder(enriched)
      );

      console.log(
        `✅ Enhanced search complete: ${enrichedOrders.length} orders with intelligent enrichment`
      );
      return enrichedOrders;
    } catch (error) {
      console.error(
        "❌ Enhanced search failed, falling back to basic search:",
        error
      );
      return await this.searchOrdersByQuery(query, options);
    }
  }

  // Merge enriched endpoint data into ModernOrder structure
  private mergeEnrichedDataIntoOrder(enriched: EnrichedOrderData): ModernOrder {
    const baseOrder = enriched.baseOrder as ModernOrder;

    // Enhance line items if we got detailed data
    if (enriched.jobLines && enriched.jobLines.length > 0) {
      baseOrder.lineItems = enriched.jobLines.map((line: any) => ({
        lineId: line.LineId,
        assetSKU: line.AssetSKU,
        description: line.Description || line.description,
        category: line.Category,
        quantity: line.Quantity || line.quantity || 0,
        unitPrice: line.UnitPrice || line.unitPrice,
        totalPrice: line.TotalPrice || line.totalPrice,
        comment: line.Comment || line.comment,
        status: line.Status || line.status,
        processCodes: line.ProcessCodes || line.processCodes || [],
        materials: line.Materials || line.materials || [],
        hasImage: line.HasImage || line.hasImage || false,
        hasPDF: line.HasPDF || line.hasPDF || false,
      }));
    }

    // Enhance shipment data if available
    if (enriched.shipments && enriched.shipments.length > 0) {
      baseOrder.shipments = enriched.shipments.map((shipment: any) => ({
        id: shipment.Id,
        index: shipment.Index,
        title: shipment.Title,
        shipped: shipment.Shipped || false,
        dateShipped: shipment.DateShipped,
        canShip: shipment.CanShip || false,
        trackingDetails: shipment.TrackingDetails
          ? {
              trackingLink: shipment.TrackingDetails.TrackingLink,
              status: shipment.TrackingDetails.Status,
              lastUpdate: shipment.TrackingDetails.LastUpdate,
              deliveryStatus: shipment.TrackingDetails.DeliveryStatus,
            }
          : undefined,
        address: {
          contactName: shipment.Address?.ContactName || "",
          organisation: shipment.Address?.Organisation || "",
          streetAddress: shipment.Address?.StreetAddress || "",
          city: shipment.Address?.City || "",
          state: shipment.Address?.AdministrativeArea || "",
          zipCode: shipment.Address?.ZipCode || "",
          validated: shipment.Address?.Validated || false,
        },
        method: {
          label: shipment.ShipmentMethod?.label || "",
          value: shipment.ShipmentMethod?.value || "",
        },
      }));
    }

    // Enhance file data if available
    if (enriched.files && enriched.files.length > 0) {
      baseOrder.files = enriched.files.map((file: any) => ({
        guid: file.Guid,
        fileName: file.FileName,
        contentType: file.ContentType,
        fileSize: file.FileSizeBytes,
        formattedSize: file.FormattedFileSize,
        fileType: file.FileType,
        category: file.Category,
        uri: file.Uri,
        createdDate: file.CreatedDate,
        createdBy: file.CreatedBy?.FullName || "",
      }));
    }

    // Add cost information to metadata if available
    if (enriched.costDetails) {
      (baseOrder as any).costDetails = {
        subtotal: enriched.costDetails.jobLinesSubTotal,
        tax: enriched.costDetails.jobLinesTaxTotal,
        total: enriched.costDetails.jobLinesTotalCost,
      };
    }

    // Add customer details if available
    if (enriched.customer) {
      baseOrder.customer = {
        ...baseOrder.customer,
        contactPerson:
          enriched.customer.ContactName || baseOrder.customer.contactPerson,
        phone: enriched.customer.Phone || baseOrder.customer.phone,
        email: enriched.customer.Email || baseOrder.customer.email,
      };
    }

    return baseOrder;
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

// Utility: Convert any raw order (API, vector, enriched, etc.) to ModernOrder
export function toModernOrder(raw: any): ModernOrder {
  console.log(`🔍 [toModernOrder] Input raw object:`, {
    jobNumber: raw.jobNumber,
    hasPricing: !!raw.pricing,
    pricing: raw.pricing,
  });

  // Defensive: handle missing/partial fields and map as needed
  const result = {
    jobNumber: raw.jobNumber || raw.JobNumber || raw.id || "",
    orderNumber: raw.orderNumber || raw.OrderNumber || "",
    customer:
      typeof raw.customer === "object" && raw.customer !== null
        ? raw.customer
        : {
            id: raw.customerId || raw.customer?.id || 0,
            company: raw.customer?.company || raw.customer || raw.Client || "",
            contactPerson: raw.contactPerson || "",
            phone: raw.phone || "",
            email: raw.email || "",
          },
    description: raw.description || raw.Description || "",
    comments: raw.comments || raw.Comments || "",
    jobQuantity: raw.jobQuantity || raw.quantity || raw.JobQuantity || 0,
    status: {
      master: raw.status?.master || raw.status || "",
      masterStatusId: raw.status?.masterStatusId || 0,
      stock: raw.status?.stock || "",
      stockComplete: raw.status?.stockComplete || 0,
      statusLine: raw.status?.statusLine || "",
      statusLineHtml: raw.status?.statusLineHtml || "",
    },
    dates: {
      dateEntered: raw.dates?.dateEntered || raw.dateEntered || "",
      dateEnteredUtc: raw.dates?.dateEnteredUtc || raw.dateEnteredUtc || "",
      dateDue: raw.dates?.dateDue || raw.dateDue || "",
      dateDueUtc: raw.dates?.dateDueUtc || raw.dateDueUtc || "",
      dateDueFactory: raw.dates?.dateDueFactory || raw.dateDueFactory || "",
      daysToDueDate: raw.dates?.daysToDueDate ?? raw.daysToDueDate ?? 0,
      dateOut: raw.dates?.dateOut || raw.dateOut || undefined,
      dateOutUtc: raw.dates?.dateOutUtc || raw.dateOutUtc || undefined,
    },
    location: {
      code: raw.location?.code || "",
      name: raw.location?.name || "",
      deliveryOption: raw.location?.deliveryOption || "",
    },
    production: {
      processes: (raw.production?.processes || raw.processes || []).map(
        (p: any) => ({
          code: p.code || "",
          displayCode: p.displayCode || "",
          quantity: p.quantity || 0,
          bitVal: p.bitVal || 0,
          suggestedMachineId: p.suggestedMachineId,
          suggestedMachineLabel: p.suggestedMachineLabel,
          hasSuggestedMachine: p.hasSuggestedMachine,
        })
      ),
      gangCodes: raw.production?.gangCodes || [],
      timeSensitive: raw.production?.timeSensitive || false,
      mustDate: raw.production?.mustDate || false,
      isReprint: raw.production?.isReprint || false,
      isDupe: raw.production?.isDupe || false,
      canSuggestMachines: raw.production?.canSuggestMachines || false,
      canPrintJobLineLabels: raw.production?.canPrintJobLineLabels || false,
      hasScheduleableJobLines: raw.production?.hasScheduleableJobLines || false,
    },
    lineItems: (raw.lineItems || []).map((li: any) => ({
      // Core identification
      lineId: li.lineId || li.ID,
      jobNumber: li.jobNumber || li.JobNumber,
      program: li.program || li.Prgram || li.assetSKU || li.AssetSKU,

      // Basic information
      description: li.description || li.Description || "",
      garment: li.garment || li.Garment,
      comments: li.comment || li.Comment || li.comments || li.Comments,
      progComment: li.progComment || li.ProgComment,

      // Quantities and pricing
      quantity: li.quantity || li.Qty || 0,
      actualQuantity: li.actualQuantity || li.ActQty,
      unitPrice: li.unitPrice || li.UnitPrice,
      totalPrice: li.totalPrice || li.TotalPrice,

      // Status and progress
      progress: li.progress || li.Progress,
      machineNumber: li.machineNumber || li.MachineNumber,
      machineNum: li.machineNum || li.MachNum,

      // File and asset information
      pdfInstructions: li.pdfInstructions || li.PDFInstructions,
      pdfId: li.pdfId || li.PDFId,
      assetImage: li.assetImage || li.AssetImage,
      assetImagePreviewUrl: li.assetImagePreviewUrl || li.AssetImagePreviewUrl,
      assetId: li.assetId || li.AssetId,
      hasImage: li.hasImage || li.HasImage,
      assetHasPDF: li.assetHasPDF || li.AssetHasPDF,

      // Relationships
      parentJobLineId: li.parentJobLineId || li.ParentJobLineID,
      isParentJobline: li.isParentJobline || li.IsParentJobline,
      isChildJobline: li.isChildJobline || li.IsChildJobline,
      isJoblineAlone: li.isJoblineAlone || li.IsJoblineAlone,
      order: li.order || li.Order,

      // Capabilities and permissions
      isScheduleable: li.isScheduleable || li.IsScheduleable,
      isEditable: li.isEditable || li.IsEditable,
      canUploadPDF: li.canUploadPDF || li.CanUploadPDF,
      canEdit: li.canEdit || li.CanEdit,
      canDelete: li.canDelete || li.CanDelete,
      canUploadImage: li.canUploadImage || li.CanUploadImage,
      canDuplicate: li.canDuplicate || li.CanDuplicate,
      canPrintLabel: li.canPrintLabel || li.CanPrintLabel,
      canReprintSeps: li.canReprintSeps || li.CanReprintSeps,
      canQCComplete: li.canQCComplete || li.CanQCComplete,
      canCheckSeps: li.canCheckSeps || li.CanCheckSeps,

      // Type classification
      isStock: li.isStock || li.IsStock,
      isAsset: li.isAsset || li.IsAsset,
      isOther: li.isOther || li.IsOther,
      assetIsNew: li.assetIsNew || li.AssetIsNew,

      // Additional information
      gang: li.gang || li.Gang,
      gangMondayLink: li.gangMondayLink || li.GangMondayLink,
      supplier: li.supplier || li.Supplier,
      worksheetId: li.worksheetId || li.WorksheetId,
      worksheetType: li.worksheetType || li.WorksheetType,
      externalArtworkUrl: li.externalArtworkUrl || li.ExternalArtworkUrl,
      externalSupplier: li.externalSupplier || li.ExternalSupplier,

      // Machine types available for this job line
      joblineTypes: li.joblineTypes || li.JoblineTypes,

      // Price band information (will be populated when needed)
      priceBand: li.priceBand || undefined,

      // Legacy fields for backward compatibility
      status: li.status || li.Status,
      category: li.category || li.Category,
      processCodes: li.processCodes || li.ProcessCodes,
      materials: li.materials || li.Materials,
      hasPDF: li.hasPDF || li.HasPDF,
      assetSKU: li.assetSKU || li.AssetSKU,
    })),
    shipments: (raw.shipments || []).map((s: any) => ({
      id: s.id,
      index: s.index,
      title: s.title,
      shipped: s.shipped,
      dateShipped: s.dateShipped,
      canShip: s.canShip,
      trackingDetails: s.trackingDetails,
      address: s.address,
      method: s.method,
    })),
    files: (raw.files || []).map((f: any) => ({
      guid: f.guid,
      fileName: f.fileName,
      contentType: f.contentType,
      fileSize: f.fileSize,
      formattedSize: f.formattedSize,
      fileType: f.fileType,
      category: f.category,
      uri: f.uri,
      createdDate: f.createdDate,
      createdBy: f.createdBy,
    })),
    tags: (raw.tags || []).map((t: any) => ({
      tag: t.tag || t,
      enteredBy: t.enteredBy || "",
      dateEntered: t.dateEntered || "",
      code: t.code,
      meta: t.meta,
    })),
    workflow: {
      hasScheduleableJobLines: raw.workflow?.hasScheduleableJobLines || false,
      canPrintJobLineLabels: raw.workflow?.canPrintJobLineLabels || false,
      hasJobFiles: raw.workflow?.hasJobFiles || false,
      hasProof: raw.workflow?.hasProof || false,
    },
    metadata: {
      lastAPIUpdate: raw.metadata?.lastAPIUpdate || "",
      dataSource: raw.metadata?.dataSource || "api",
      dataFreshness: raw.metadata?.dataFreshness || "fresh",
      bitVal: raw.metadata?.bitVal || 0,
      sortKey: raw.metadata?.sortKey || "",
    },
    // Include pricing information if available
    ...(raw.pricing && {
      pricing: {
        total: raw.pricing.total || 0,
        totalFormatted: raw.pricing.totalFormatted || "",
        subtotal: raw.pricing.subtotal,
        subtotalFormatted: raw.pricing.subtotalFormatted,
        tax: raw.pricing.tax,
        taxFormatted: raw.pricing.taxFormatted,
      },
    }),
  };

  console.log(`🔍 [toModernOrder] Output result:`, {
    jobNumber: result.jobNumber,
    hasPricing: !!result.pricing,
    pricing: result.pricing,
  });

  return result;
}

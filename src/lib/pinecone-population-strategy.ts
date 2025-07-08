// Pinecone Vector DB Population Strategy
// Handles data freshness and optimal ingestion for OMS order data

import { Pinecone } from "@pinecone-database/pinecone";
import {
  EnhancedOMSAPIClient,
  APIJob,
  APIJobLine,
  APIJobShipment,
} from "./enhanced-api-client";
import { embeddingService } from "./embeddings";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ===== VECTOR DOCUMENT INTERFACES =====

export interface VectorDocument {
  id: string;
  content: string; // Text content for reference
  embedding: number[]; // The actual embedding vector
  metadata: VectorMetadata;
  relationships?: Record<string, string[]>;
}

export interface VectorMetadata {
  // Core identifiers
  type: "job" | "customer" | "jobline" | "shipment" | "history" | "stock";
  jobNumber?: number;
  customerId?: number;
  orderNumber?: string;

  // Content metadata
  status?: string;
  stockStatus?: string;
  dueDate?: string;
  dateEntered?: string;
  program?: string;

  // Search optimization
  dataSource: "api";
  dataFreshness: "fresh" | "stale" | "very-stale";
  lastUpdated: string;
  completenessScore: number; // 0-100

  // Filtering fields
  customerCompany?: string;
  deliveryOption?: string;
  locationCode?: string;
  timeSensitive?: boolean;
  mustDate?: boolean;
  isReprint?: boolean;

  // Content analysis
  descriptionLength?: number;
  commentsLength?: number;
  totalTextLength?: number;

  // Process and material tags
  processes?: string[];
  materials?: string[];
  categories?: string[];

  // Pricing information
  unitPrice?: number;
  totalPrice?: number;
  lineQuantity?: number;

  // Relationship indicators
  hasLineItems?: boolean;
  hasShipments?: boolean;
  hasHistory?: boolean;
  hasStock?: boolean;
  lineItemCount?: number;
  shipmentCount?: number;
  historyCount?: number;
}

export interface PopulationConfig {
  batchSize: number;
  maxConcurrentBatches: number;
  embeddingDelay: number;
  upsertDelay: number;
  freshnessThreshold: number; // hours
  completenessThreshold: number; // 0-100
  enableIncrementalUpdates: boolean;
  enableDataValidation: boolean;
  enablePerformanceMonitoring: boolean;
}

export interface PopulationStats {
  totalJobs: number;
  processedJobs: number;
  failedJobs: number;
  totalVectors: number;
  upsertedVectors: number;
  deletedVectors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  averageProcessingTime?: number;
  errors: string[];
}

// ===== CHANGE TRACKING =====

interface ChangeTracker {
  lastUpdate: string;
  jobUpdates: Record<string, string>; // jobNumber -> lastUpdate
  customerUpdates: Record<string, string>; // customerId -> lastUpdate
  vectorHashes: Record<string, string>; // vectorId -> contentHash
  stats: {
    totalJobs: number;
    totalCustomers: number;
    totalVectors: number;
    lastFullSync: string;
  };
}

// ===== MAIN POPULATION SERVICE =====

export class PineconePopulationStrategy {
  private pinecone: Pinecone;
  private apiClient: EnhancedOMSAPIClient;
  private indexName: string;
  private config: PopulationConfig;
  private changeTracker: ChangeTracker;
  private changeTrackerPath: string;
  private stats: PopulationStats;

  constructor(
    indexName: string = process.env.PINECONE_INDEX_NAME || "serene-laurel",
    config: Partial<PopulationConfig> = {}
  ) {
    this.indexName = indexName;
    this.config = {
      batchSize: 25,
      maxConcurrentBatches: 2,
      embeddingDelay: 200,
      upsertDelay: 1000,
      freshnessThreshold: 24, // 24 hours
      completenessThreshold: 70,
      enableIncrementalUpdates: true,
      enableDataValidation: true,
      enablePerformanceMonitoring: true,
      ...config,
    };

    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY || "",
    });

    // Load authentication cookies from environment
    const authCookies =
      process.env.OMS_AUTH_COOKIES ||
      process.env.OMS_AUTH_COOKIE ||
      process.env.AUTH_COOKIES ||
      process.env.AUTH_COOKIE ||
      "";

    this.apiClient = new EnhancedOMSAPIClient({
      baseUrl: process.env.OMS_API_BASE_URL || "https://intranet.decopress.com",
      cacheEnabled: true,
      cacheTTL: 300, // 5 minutes
    });

    // Set authentication cookies explicitly
    if (authCookies) {
      this.apiClient.setAuthCookies(authCookies);
      console.log("🔐 Authentication cookies set for API client");
    } else {
      console.warn("⚠️ No authentication cookies found for API client");
    }

    this.changeTrackerPath = path.join(
      process.cwd(),
      "data",
      "pinecone-change-tracker.json"
    );
    this.changeTracker = this.loadChangeTracker();
    this.stats = this.initializeStats();
  }

  // ===== INITIALIZATION =====

  async initialize(): Promise<void> {
    console.log("🚀 Initializing Pinecone Population Strategy...");

    try {
      // Initialize embedding service
      await embeddingService.initialize();

      // Test API connection
      const health = await this.apiClient.healthCheck();
      if (!health.healthy) {
        throw new Error(`API health check failed: ${health.error}`);
      }

      // Test Pinecone connection
      const index = this.pinecone.index(this.indexName);
      await index.describeIndexStats();

      console.log("✅ Pinecone Population Strategy initialized successfully");
    } catch (error) {
      console.error("❌ Failed to initialize:", error);
      throw error;
    }
  }

  // ===== FULL POPULATION =====

  async populateFullDatabase(): Promise<PopulationStats> {
    console.log("🔄 Starting full database population...");
    this.stats = this.initializeStats();

    // Add global error handlers
    process.on("unhandledRejection", (reason, promise) => {
      console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
      this.stats.errors.push(`Unhandled Rejection: ${reason}`);
    });

    process.on("uncaughtException", (error) => {
      console.error("❌ Uncaught Exception:", error);
      this.stats.errors.push(`Uncaught Exception: ${error.message}`);
    });

    // Add timeout for the entire process
    const processTimeout = setTimeout(() => {
      console.error("❌ Process timeout - taking too long to complete");
      this.stats.errors.push("Process timeout - taking too long to complete");
      process.exit(1);
    }, 30 * 60 * 1000); // 30 minutes timeout

    try {
      // 1. Get all active jobs
      console.log("📥 Fetching all active jobs...");
      const jobs = await Promise.race([
        this.apiClient.getAllActiveJobs(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Failed to fetch jobs - timeout")),
            60000
          )
        ),
      ]);
      this.stats.totalJobs = jobs.length;
      console.log(`✅ Found ${jobs.length} active jobs`);

      // 2. Process jobs in batches
      await this.processJobsInBatches(jobs);

      // 3. Update change tracker
      this.updateChangeTracker(jobs);

      // 4. Finalize stats
      this.finalizeStats();

      // Clear the timeout
      clearTimeout(processTimeout);

      console.log("🎉 Full database population completed!");
      return this.stats;
    } catch (error) {
      clearTimeout(processTimeout);
      console.error("❌ Full population failed:", error);
      this.stats.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  // ===== INCREMENTAL UPDATES =====

  async updateIncremental(): Promise<PopulationStats> {
    if (!this.config.enableIncrementalUpdates) {
      throw new Error("Incremental updates are disabled");
    }

    console.log("🔄 Starting incremental update...");
    this.stats = this.initializeStats();

    try {
      // 1. Get recently updated jobs
      const recentJobs = await this.getRecentlyUpdatedJobs();
      this.stats.totalJobs = recentJobs.length;
      console.log(`✅ Found ${recentJobs.length} recently updated jobs`);

      // 2. Process only changed jobs
      const changedJobs = await this.filterChangedJobs(recentJobs);
      console.log(`✅ Found ${changedJobs.length} jobs with changes`);

      // 3. Process changed jobs
      await this.processJobsInBatches(changedJobs);

      // 4. Update change tracker
      this.updateChangeTracker(changedJobs);

      // 5. Finalize stats
      this.finalizeStats();

      console.log("🎉 Incremental update completed!");
      return this.stats;
    } catch (error) {
      console.error("❌ Incremental update failed:", error);
      this.stats.errors.push(
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  // ===== JOB PROCESSING =====

  private async processJobsInBatches(jobs: APIJob[]): Promise<void> {
    const totalBatches = Math.ceil(jobs.length / this.config.batchSize);
    console.log(
      `📦 Processing ${jobs.length} jobs in ${totalBatches} batches...`
    );

    for (let i = 0; i < jobs.length; i += this.config.batchSize) {
      const batch = jobs.slice(i, i + this.config.batchSize);
      const batchNumber = Math.floor(i / this.config.batchSize) + 1;

      console.log(
        `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} jobs)...`
      );

      // Add timeout for each batch
      const batchTimeout = setTimeout(() => {
        console.error(`❌ Batch ${batchNumber} timeout - taking too long`);
        this.stats.errors.push(`Batch ${batchNumber} timeout`);
      }, 10 * 60 * 1000); // 10 minutes per batch

      try {
        await Promise.race([
          this.processJobBatch(batch),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error(`Batch ${batchNumber} timeout`)),
              10 * 60 * 1000
            )
          ),
        ]);

        this.stats.processedJobs += batch.length;
        clearTimeout(batchTimeout);

        // Delay between batches
        if (batchNumber < totalBatches) {
          console.log(
            `⏳ Waiting ${this.config.upsertDelay}ms before next batch...`
          );
          await this.delay(this.config.upsertDelay);
        }
      } catch (error) {
        clearTimeout(batchTimeout);
        console.error(`❌ Batch ${batchNumber} failed:`, error);
        this.stats.failedJobs += batch.length;
        this.stats.errors.push(
          `Batch ${batchNumber}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );

        // Continue with next batch instead of stopping
        console.log(`🔄 Continuing with next batch...`);
      }
    }
  }

  private async processJobBatch(jobs: APIJob[]): Promise<void> {
    console.log(`📦 Processing batch of ${jobs.length} jobs...`);
    const batchStartTime = Date.now();
    let successfulJobs = 0;
    let failedJobs = 0;
    let totalVectors = 0;

    try {
      // Process jobs concurrently within batch
      const jobPromises = jobs.map(async (job) => {
        try {
          console.log(`🚀 Starting job ${job.JobNumber}...`);
          const jobVectors = await this.createJobVectors(job);
          console.log(
            `✅ Job ${job.JobNumber} completed with ${jobVectors.length} vectors`
          );
          successfulJobs++;
          return jobVectors;
        } catch (error) {
          console.error(`❌ Failed to process job ${job.JobNumber}:`, error);
          failedJobs++;
          this.stats.errors.push(
            `Job ${job.JobNumber}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          return [];
        }
      });

      const jobResults = await Promise.all(jobPromises);
      const allVectors = jobResults.flat();
      totalVectors = allVectors.length;

      // Upsert vectors to Pinecone
      if (allVectors.length > 0) {
        console.log(
          `📤 Upserting ${allVectors.length} vectors from ${successfulJobs} successful jobs...`
        );
        await this.upsertVectors(allVectors);
        this.stats.upsertedVectors += allVectors.length;
      }

      const batchTime = Date.now() - batchStartTime;
      console.log(
        `📊 Batch completed in ${batchTime}ms: ${successfulJobs} successful, ${failedJobs} failed, ${totalVectors} vectors upserted`
      );
    } catch (error) {
      const batchTime = Date.now() - batchStartTime;
      console.error(`❌ Batch processing failed after ${batchTime}ms:`, error);
      this.stats.failedJobs += jobs.length;
      this.stats.errors.push(
        `Batch processing: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  // ===== VECTOR CREATION =====

  private async createJobVectors(job: APIJob): Promise<VectorDocument[]> {
    const vectors: VectorDocument[] = [];
    const startTime = Date.now();
    let lastHeartbeat = Date.now();

    // Heartbeat function to detect hanging
    const heartbeat = () => {
      const now = Date.now();
      if (now - lastHeartbeat > 30000) {
        // 30 seconds without activity
        console.warn(
          `⚠️ Job ${job.JobNumber} may be hanging (${Math.floor(
            (now - startTime) / 1000
          )}s elapsed)`
        );
      }
      lastHeartbeat = now;
    };

    const heartbeatInterval = setInterval(heartbeat, 10000); // Check every 10 seconds

    try {
      console.log(`🔍 Processing job ${job.JobNumber}...`);

      // 1. Get related data first (single API call) with timeout
      console.log(`📡 Fetching job details for ${job.JobNumber}...`);
      const jobDetails = await Promise.race([
        this.apiClient.getJobDetails(job.JobNumber.toString()),
        new Promise<never>(
          (_, reject) =>
            setTimeout(
              () => reject(new Error("Job details API timeout")),
              120000
            ) // Increased to 2 minutes
        ),
      ]);
      console.log(
        `✅ Job details fetched for ${job.JobNumber} in ${
          Date.now() - startTime
        }ms`
      );

      // 2. Prepare all content for batch embedding
      const contentBatch: { content: string; type: string; id: string }[] = [];

      // Add job content
      const jobContent = this.generateJobContent(job);
      contentBatch.push({
        content: jobContent,
        type: "job",
        id: `job_${job.JobNumber}`,
      });

      // Add jobline content
      if (jobDetails.lines && jobDetails.lines.length > 0) {
        console.log(
          `📋 Found ${jobDetails.lines.length} joblines for job ${job.JobNumber}`
        );
        for (const jobline of jobDetails.lines) {
          const content = this.generateJoblineContent(jobline, job);
          contentBatch.push({
            content,
            type: "jobline",
            id: `jobline_${jobline.LineId}`,
          });
        }
      }

      // Add shipment content
      if (jobDetails.shipments && jobDetails.shipments.length > 0) {
        console.log(
          `📦 Found ${jobDetails.shipments.length} shipments for job ${job.JobNumber}`
        );
        for (const shipment of jobDetails.shipments) {
          const content = this.generateShipmentContent(shipment, job);
          contentBatch.push({
            content,
            type: "shipment",
            id: `shipment_${shipment.Id}`,
          });
        }
      }

      // Add history content
      if (jobDetails.history) {
        console.log(`📜 Found history for job ${job.JobNumber}`);
        const content = this.generateHistoryContent(jobDetails.history, job);
        contentBatch.push({
          content,
          type: "history",
          id: `history_${job.JobNumber}`,
        });
      }

      // 3. Create all embeddings in a single batch call with timeout
      console.log(
        `🔧 Creating batch embeddings for job ${job.JobNumber} (${contentBatch.length} items)`
      );
      const texts = contentBatch.map((item) => item.content);

      const embeddingStartTime = Date.now();
      const batchResponse = await Promise.race([
        embeddingService.createBatchEmbeddings(texts),
        new Promise<never>(
          (_, reject) =>
            setTimeout(() => reject(new Error("Embedding API timeout")), 120000) // Increased to 2 minutes
        ),
      ]);
      console.log(
        `✅ Embeddings created for job ${job.JobNumber} in ${
          Date.now() - embeddingStartTime
        }ms`
      );

      // 4. Create vector documents with embeddings
      for (let i = 0; i < contentBatch.length; i++) {
        const item = contentBatch[i];
        const embedding = batchResponse.embeddings[i];

        if (!embedding) {
          console.error(
            `❌ Missing embedding for item ${item.id} in job ${job.JobNumber}`
          );
          continue;
        }

        if (item.type === "job") {
          const metadata: VectorMetadata = {
            type: "job",
            jobNumber: job.JobNumber,
            customerId: job.CustomerId,
            orderNumber: job.OrderNumber,
            status: job.MasterJobStatus,
            stockStatus: job.StockCompleteStatus,
            dueDate: job.DateDue,
            dateEntered: job.DateIn,
            dataSource: "api",
            dataFreshness: this.calculateDataFreshness(job.DateIn),
            lastUpdated: new Date().toISOString(),
            completenessScore: this.calculateCompletenessScore(job),
            customerCompany: job.Client,
            deliveryOption: job.DeliveryOption,
            locationCode: job.LocationCode,
            timeSensitive: job.TimeSensitive,
            mustDate: job.MustDate,
            isReprint: job.IsReprint,
            descriptionLength: job.Description?.length || 0,
            commentsLength: job.Comments?.length || 0,
            totalTextLength: item.content.length,
            processes: job.ProcessQuantities?.map((pq) => pq.Code) || [],
            hasLineItems: jobDetails.lines && jobDetails.lines.length > 0,
            hasShipments:
              jobDetails.shipments && jobDetails.shipments.length > 0,
            hasHistory: !!jobDetails.history,
          };

          vectors.push({
            id: item.id,
            content: item.content,
            embedding,
            metadata,
            relationships: {
              customer: [`customer_${job.CustomerId}`],
              joblines:
                jobDetails.lines?.map((line) => `jobline_${line.LineId}`) || [],
              shipments:
                jobDetails.shipments?.map((ship) => `shipment_${ship.Id}`) ||
                [],
              history: [`history_${job.JobNumber}`],
            },
          });
        } else if (item.type === "jobline") {
          const jobline = jobDetails.lines!.find(
            (line) => `jobline_${line.LineId}` === item.id
          );
          if (jobline) {
            const metadata: VectorMetadata = {
              type: "jobline",
              jobNumber: job.JobNumber,
              customerId: job.CustomerId,
              orderNumber: job.OrderNumber,
              program: jobline.AssetSKU,
              dataSource: "api",
              dataFreshness: this.calculateDataFreshness(job.DateIn),
              lastUpdated: new Date().toISOString(),
              completenessScore:
                this.calculateJoblineCompletenessScore(jobline),
              customerCompany: job.Client,
              status: job.MasterJobStatus,
              descriptionLength: jobline.Description?.length || 0,
              commentsLength: jobline.Comment?.length || 0,
              totalTextLength: item.content.length,
              processes: jobline.ProcessCodes || [],
              materials: jobline.Materials || [],
              categories: [jobline.Category],
              unitPrice: jobline.UnitPrice,
              totalPrice: jobline.TotalPrice,
              lineQuantity: jobline.Quantity,
            };

            vectors.push({
              id: item.id,
              content: item.content,
              embedding,
              metadata,
              relationships: {
                job: [`job_${job.JobNumber}`],
                customer: [`customer_${job.CustomerId}`],
              },
            });
          }
        } else if (item.type === "shipment") {
          const shipment = jobDetails.shipments!.find(
            (ship) => `shipment_${ship.Id}` === item.id
          );
          if (shipment) {
            const metadata: VectorMetadata = {
              type: "shipment",
              jobNumber: job.JobNumber,
              customerId: job.CustomerId,
              orderNumber: job.OrderNumber,
              dataSource: "api",
              dataFreshness: this.calculateDataFreshness(job.DateIn),
              lastUpdated: new Date().toISOString(),
              completenessScore:
                this.calculateShipmentCompletenessScore(shipment),
              customerCompany: job.Client,
              status: job.MasterJobStatus,
              totalTextLength: item.content.length,
            };

            vectors.push({
              id: item.id,
              content: item.content,
              embedding,
              metadata,
              relationships: {
                job: [`job_${job.JobNumber}`],
                customer: [`customer_${job.CustomerId}`],
              },
            });
          }
        } else if (item.type === "history") {
          const metadata: VectorMetadata = {
            type: "history",
            jobNumber: job.JobNumber,
            customerId: job.CustomerId,
            orderNumber: job.OrderNumber,
            dataSource: "api",
            dataFreshness: this.calculateDataFreshness(job.DateIn),
            lastUpdated: new Date().toISOString(),
            completenessScore: 90, // History is usually complete
            customerCompany: job.Client,
            status: job.MasterJobStatus,
            totalTextLength: item.content.length,
          };

          vectors.push({
            id: item.id,
            content: item.content,
            embedding,
            metadata,
            relationships: {
              job: [`job_${job.JobNumber}`],
              customer: [`customer_${job.CustomerId}`],
            },
          });
        }
      }

      clearInterval(heartbeatInterval);
      const totalTime = Date.now() - startTime;
      console.log(
        `✅ Created ${vectors.length} vectors for job ${job.JobNumber} in ${totalTime}ms`
      );
      return vectors;
    } catch (error) {
      clearInterval(heartbeatInterval);
      const totalTime = Date.now() - startTime;
      console.error(
        `❌ Failed to create vectors for job ${job.JobNumber} after ${totalTime}ms:`,
        error
      );
      throw error; // Re-throw to ensure it's caught by the batch processor
    }
  }

  // ===== CONTENT GENERATION =====

  private generateJobContent(job: APIJob): string {
    const parts = [
      `Job Number: ${job.JobNumber}`,
      `Customer: ${job.Client} (ID: ${job.CustomerId})`,
      `Order Number: ${job.OrderNumber}`,
      `Status: ${job.MasterJobStatus}`,
      `Stock Status: ${job.StockCompleteStatus}`,
      `Due Date: ${job.DateDue}`,
      `Date Entered: ${job.DateIn}`,
      `Delivery Option: ${job.DeliveryOption}`,
      `Location: ${job.LocationCode}`,
      `Time Sensitive: ${job.TimeSensitive}`,
      `Must Date: ${job.MustDate}`,
      `Is Reprint: ${job.IsReprint}`,
    ];

    if (job.Description) {
      parts.push(`Description: ${job.Description}`);
    }

    if (job.Comments) {
      parts.push(`Comments: ${job.Comments}`);
    }

    if (job.ProcessQuantities && job.ProcessQuantities.length > 0) {
      const processes = job.ProcessQuantities.map(
        (pq) => `${pq.Code}: ${pq.Quantity}`
      ).join(", ");
      parts.push(`Processes: ${processes}`);
    }

    return parts.filter(Boolean).join("\n");
  }

  private generateJoblineContent(jobline: any, job: APIJob): string {
    const parts = [
      `Jobline ID: ${jobline.LineId}`,
      `Job Number: ${job.JobNumber}`,
      `Program: ${jobline.AssetSKU}`,
      `Category: ${jobline.Category}`,
      `Quantity: ${jobline.Quantity}`,
      `Status: ${jobline.Status}`,
    ];

    // Add pricing information
    if (jobline.UnitPrice !== undefined && jobline.UnitPrice !== null) {
      parts.push(`Unit Price: $${jobline.UnitPrice.toFixed(2)}`);
    }

    if (jobline.TotalPrice !== undefined && jobline.TotalPrice !== null) {
      parts.push(`Total Price: $${jobline.TotalPrice.toFixed(2)}`);
    }

    if (jobline.Description) {
      parts.push(`Description: ${jobline.Description}`);
    }

    if (jobline.Comment) {
      parts.push(`Comment: ${jobline.Comment}`);
    }

    if (jobline.ProcessCodes && jobline.ProcessCodes.length > 0) {
      parts.push(`Process Codes: ${jobline.ProcessCodes.join(", ")}`);
    }

    if (jobline.Materials && jobline.Materials.length > 0) {
      parts.push(`Materials: ${jobline.Materials.join(", ")}`);
    }

    return parts.filter(Boolean).join("\n");
  }

  private generateShipmentContent(shipment: any, job: APIJob): string {
    const parts = [
      `Shipment ID: ${shipment.Id}`,
      `Job Number: ${job.JobNumber}`,
      `Shipment Date: ${shipment.ShipmentDate}`,
      `Status: ${shipment.Status}`,
    ];

    if (shipment.TrackingNumber) {
      parts.push(`Tracking Number: ${shipment.TrackingNumber}`);
    }

    if (shipment.Carrier) {
      parts.push(`Carrier: ${shipment.Carrier}`);
    }

    if (shipment.Notes) {
      parts.push(`Notes: ${shipment.Notes}`);
    }

    return parts.filter(Boolean).join("\n");
  }

  private generateHistoryContent(history: any, job: APIJob): string {
    const parts = [
      `Job Number: ${job.JobNumber}`,
      `History Entries: ${history.length || 0}`,
    ];

    if (history && Array.isArray(history)) {
      const recentEntries = history.slice(0, 5); // Limit to recent entries
      const entryTexts = recentEntries.map((entry: any) => {
        return `${entry.Date}: ${
          entry.Description || entry.Status || entry.Action
        }`;
      });
      parts.push(`Recent Activity:\n${entryTexts.join("\n")}`);
    }

    return parts.filter(Boolean).join("\n");
  }

  // ===== UTILITY METHODS =====

  private initializeStats(): PopulationStats {
    return {
      totalJobs: 0,
      processedJobs: 0,
      failedJobs: 0,
      totalVectors: 0,
      upsertedVectors: 0,
      deletedVectors: 0,
      startTime: new Date(),
      errors: [],
    };
  }

  private loadChangeTracker(): ChangeTracker {
    try {
      if (fs.existsSync(this.changeTrackerPath)) {
        const data = fs.readFileSync(this.changeTrackerPath, "utf8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.warn("Failed to load change tracker:", error);
    }

    return {
      lastUpdate: new Date().toISOString(),
      jobUpdates: {},
      customerUpdates: {},
      vectorHashes: {},
      stats: {
        totalJobs: 0,
        totalCustomers: 0,
        totalVectors: 0,
        lastFullSync: new Date().toISOString(),
      },
    };
  }

  private updateChangeTracker(jobs: APIJob[]): void {
    try {
      const now = new Date().toISOString();
      this.changeTracker.lastUpdate = now;

      for (const job of jobs) {
        this.changeTracker.jobUpdates[job.JobNumber.toString()] = now;
        this.changeTracker.customerUpdates[job.CustomerId.toString()] = now;
      }

      this.changeTracker.stats.totalJobs = jobs.length;
      this.changeTracker.stats.lastFullSync = now;

      fs.writeFileSync(
        this.changeTrackerPath,
        JSON.stringify(this.changeTracker, null, 2)
      );
      console.log("✅ Change tracker updated");
    } catch (error) {
      console.error("Failed to update change tracker:", error);
    }
  }

  private finalizeStats(): void {
    this.stats.endTime = new Date();
    this.stats.duration =
      this.stats.endTime.getTime() - this.stats.startTime.getTime();

    if (this.stats.processedJobs > 0) {
      this.stats.averageProcessingTime =
        this.stats.duration / this.stats.processedJobs;
    }

    console.log("📊 Final Stats:", {
      totalJobs: this.stats.totalJobs,
      processedJobs: this.stats.processedJobs,
      failedJobs: this.stats.failedJobs,
      totalVectors: this.stats.totalVectors,
      upsertedVectors: this.stats.upsertedVectors,
      duration: `${Math.round(this.stats.duration / 1000)}s`,
      errors: this.stats.errors.length,
    });
  }

  private async getRecentlyUpdatedJobs(): Promise<APIJob[]> {
    // Get jobs updated in the last 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    try {
      const allJobs = await this.apiClient.getAllActiveJobs();
      return allJobs.filter((job) => {
        const jobDate = new Date(job.DateIn);
        return jobDate >= cutoffDate;
      });
    } catch (error) {
      console.error("Failed to get recently updated jobs:", error);
      return [];
    }
  }

  private async filterChangedJobs(jobs: APIJob[]): Promise<APIJob[]> {
    const changedJobs: APIJob[] = [];

    for (const job of jobs) {
      const lastUpdate =
        this.changeTracker.jobUpdates[job.JobNumber.toString()];
      if (!lastUpdate) {
        changedJobs.push(job);
        continue;
      }

      const lastUpdateDate = new Date(lastUpdate);
      const jobDate = new Date(job.DateIn);

      if (jobDate > lastUpdateDate) {
        changedJobs.push(job);
      }
    }

    return changedJobs;
  }

  private calculateDataFreshness(
    dateIn: string
  ): "fresh" | "stale" | "very-stale" {
    const jobDate = new Date(dateIn);
    const now = new Date();
    const hoursDiff = (now.getTime() - jobDate.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < this.config.freshnessThreshold) {
      return "fresh";
    } else if (hoursDiff < this.config.freshnessThreshold * 2) {
      return "stale";
    } else {
      return "very-stale";
    }
  }

  private calculateCompletenessScore(job: APIJob): number {
    let score = 0;
    let total = 0;

    // Basic job info
    total += 5;
    if (job.JobNumber) score += 1;
    if (job.CustomerId) score += 1;
    if (job.OrderNumber) score += 1;
    if (job.MasterJobStatus) score += 1;
    if (job.DateDue) score += 1;

    // Description and comments
    total += 2;
    if (job.Description) score += 1;
    if (job.Comments) score += 1;

    // Process information
    total += 1;
    if (job.ProcessQuantities && job.ProcessQuantities.length > 0) score += 1;

    return Math.round((score / total) * 100);
  }

  private calculateJoblineCompletenessScore(jobline: any): number {
    let score = 0;
    let total = 0;

    total += 4;
    if (jobline.LineId) score += 1;
    if (jobline.AssetSKU) score += 1;
    if (jobline.Quantity) score += 1;
    if (jobline.Status) score += 1;

    total += 2;
    if (jobline.Description) score += 1;
    if (jobline.Comment) score += 1;

    return Math.round((score / total) * 100);
  }

  private calculateShipmentCompletenessScore(shipment: any): number {
    let score = 0;
    let total = 0;

    total += 3;
    if (shipment.Id) score += 1;
    if (shipment.ShipmentDate) score += 1;
    if (shipment.Status) score += 1;

    total += 1;
    if (shipment.TrackingNumber) score += 1;

    return Math.round((score / total) * 100);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===== PUBLIC METHODS FOR RUNNER SCRIPT =====

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Check API connection
      const apiHealth = await this.apiClient.healthCheck();
      if (!apiHealth.healthy) {
        return {
          healthy: false,
          error: `API health check failed: ${apiHealth.error}`,
        };
      }

      // Check Pinecone connection
      const index = this.pinecone.index(this.indexName);
      await index.describeIndexStats();

      // Check embedding service
      await embeddingService.healthCheck();

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getStats(): Promise<PopulationStats> {
    return { ...this.stats };
  }

  async getChangeTrackerStats(): Promise<ChangeTracker> {
    return { ...this.changeTracker };
  }

  // ===== VECTOR SEARCHING =====

  /**
   * Search for similar orders using vector similarity
   * @param queryEmbedding - The embedding vector of the search query
   * @param topK - Number of results to return (default: 10)
   * @param filters - Optional filters to apply to the search
   * @returns Array of search results with metadata
   */
  async searchSimilarOrders(
    queryEmbedding: number[],
    topK: number = 10,
    filters?: Record<string, string | number | boolean>
  ): Promise<
    Array<{
      id: string;
      score: number;
      metadata: VectorMetadata;
    }>
  > {
    if (!this.pinecone) {
      throw new Error("Pinecone client not initialized");
    }

    try {
      const index = this.pinecone.index(this.indexName);

      // Prepare query request
      const queryRequest: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        filter?: Record<string, string | number | boolean>;
      } = {
        vector: queryEmbedding,
        topK,
        includeMetadata: true,
      };

      // Apply filters if provided
      if (filters && Object.keys(filters).length > 0) {
        queryRequest.filter = this.buildPineconeFilter(filters);
      }

      console.log(
        `🔍 Searching with topK=${topK}, filters:`,
        filters || "none"
      );

      // Execute search
      const results = await index.query(queryRequest);

      // Transform results to match expected format
      const searchResults = (results.matches || [])
        .filter((match) => match.score && match.score > 0 && match.metadata)
        .map((match) => ({
          id: match.id || "",
          score: match.score || 0,
          metadata: this.parseVectorMetadata(
            match.metadata as Record<string, any>
          ),
        }));

      console.log(
        `✅ Found ${searchResults.length} results with scores:`,
        searchResults.map((r) => `${r.id}:${r.score.toFixed(3)}`).join(", ")
      );

      return searchResults;
    } catch (error) {
      console.error("❌ Vector search failed:", error);

      // Return empty results instead of throwing to allow fallback strategies
      console.warn("⚠️ Returning empty results due to search failure");
      return [];
    }
  }

  /**
   * Build Pinecone-compatible filter from generic filters
   */
  private buildPineconeFilter(
    filters: Record<string, string | number | boolean>
  ): Record<string, any> {
    const pineconeFilter: Record<string, any> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        // Map generic filter keys to Pinecone metadata keys
        switch (key) {
          case "customerCompany":
            pineconeFilter.customerCompany = String(value);
            break;
          case "status":
            pineconeFilter.status = String(value);
            break;
          case "timeSensitive":
            pineconeFilter.timeSensitive = Boolean(value);
            break;
          case "mustDate":
            pineconeFilter.mustDate = Boolean(value);
            break;
          case "isReprint":
            pineconeFilter.isReprint = Boolean(value);
            break;
          case "minPrice":
            pineconeFilter.totalPrice = { $gte: Number(value) };
            break;
          case "maxPrice":
            pineconeFilter.totalPrice = { $lte: Number(value) };
            break;
          case "priceRange":
            if (Array.isArray(value) && value.length === 2) {
              pineconeFilter.totalPrice = {
                $gte: Number(value[0]),
                $lte: Number(value[1]),
              };
            }
            break;
          case "hasLineItems":
            pineconeFilter.hasLineItems = Boolean(value);
            break;
          case "hasShipments":
            pineconeFilter.hasShipments = Boolean(value);
            break;
          case "dataSource":
            pineconeFilter.dataSource = String(value);
            break;
          case "locationCode":
            pineconeFilter.locationCode = String(value);
            break;
          case "deliveryOption":
            pineconeFilter.deliveryOption = String(value);
            break;
          case "completenessScore":
            // For numeric filters, we'll need to handle range queries
            if (typeof value === "number") {
              pineconeFilter.completenessScore = value;
            }
            break;
          case "processes":
            // Handle process codes - convert human-readable terms to actual codes
            if (Array.isArray(value)) {
              const processCodes = this.mapProcessTermsToCodes(value);
              if (processCodes.length > 0) {
                // Pinecone expects arrays to be joined as strings for filtering
                pineconeFilter.processes = processCodes.join(", ");
              }
            } else if (typeof value === "string") {
              const processCodes = this.mapProcessTermsToCodes([value]);
              if (processCodes.length > 0) {
                pineconeFilter.processes = processCodes.join(", ");
              }
            }
            break;
          default:
            // For unknown filters, try to apply them directly
            pineconeFilter[key] = value;
        }
      }
    }

    return pineconeFilter;
  }

  /**
   * Map human-readable process terms to actual process codes
   */
  private mapProcessTermsToCodes(terms: string[]): string[] {
    const processMapping: Record<string, string[]> = {
      embroidery: ["EM"],
      "embroidery process": ["EM"],
      emb: ["EM"],
      supacolor: ["SC"],
      "supa color": ["SC"],
      supa: ["SC"],
      sc: ["SC"],
      "head wear": ["HW"],
      headwear: ["HW"],
      head: ["HW"],
      hw: ["HW"],
      bagging: ["Bagging"],
      bag: ["Bagging"],
      dispatch: ["Dispatch"],
      misc: ["Misc"],
      miscellaneous: ["Misc"],
      pa: ["PA"],
      patch: ["PA"],
      patches: ["PA"],
      cr: ["CR"],
      cutting: ["CR"],
      cut: ["CR"],
    };

    const codes: string[] = [];

    for (const term of terms) {
      const termLower = term.toLowerCase();
      for (const [key, codeArray] of Object.entries(processMapping)) {
        if (termLower.includes(key.toLowerCase())) {
          codes.push(...codeArray);
        }
      }
    }

    // Remove duplicates
    return [...new Set(codes)];
  }

  /**
   * Parse metadata from Pinecone search results back to VectorMetadata format
   */
  private parseVectorMetadata(metadata: Record<string, any>): VectorMetadata {
    return {
      type: metadata.type || "job",
      jobNumber: metadata.jobNumber ? parseInt(metadata.jobNumber) : undefined,
      customerId: metadata.customerId
        ? parseInt(metadata.customerId)
        : undefined,
      orderNumber: metadata.orderNumber,
      status: metadata.status,
      stockStatus: metadata.stockStatus,
      dueDate: metadata.dueDate,
      dateEntered: metadata.dateEntered,
      program: metadata.program,
      dataSource: metadata.dataSource || "api",
      dataFreshness: metadata.dataFreshness || "stale",
      lastUpdated: metadata.lastUpdated || new Date().toISOString(),
      completenessScore: metadata.completenessScore
        ? parseInt(metadata.completenessScore)
        : 0,
      customerCompany: metadata.customerCompany,
      deliveryOption: metadata.deliveryOption,
      locationCode: metadata.locationCode,
      timeSensitive: Boolean(metadata.timeSensitive),
      mustDate: Boolean(metadata.mustDate),
      isReprint: Boolean(metadata.isReprint),
      descriptionLength: metadata.descriptionLength
        ? parseInt(metadata.descriptionLength)
        : undefined,
      commentsLength: metadata.commentsLength
        ? parseInt(metadata.commentsLength)
        : undefined,
      totalTextLength: metadata.totalTextLength
        ? parseInt(metadata.totalTextLength)
        : undefined,
      processes: metadata.processes
        ? metadata.processes.split(", ")
        : undefined,
      materials: metadata.materials
        ? metadata.materials.split(", ")
        : undefined,
      categories: metadata.categories
        ? metadata.categories.split(", ")
        : undefined,
      hasLineItems: Boolean(metadata.hasLineItems),
      hasShipments: Boolean(metadata.hasShipments),
      hasHistory: Boolean(metadata.hasHistory),
      hasStock: Boolean(metadata.hasStock),
      lineItemCount: metadata.lineItemCount
        ? parseInt(metadata.lineItemCount)
        : undefined,
      shipmentCount: metadata.shipmentCount
        ? parseInt(metadata.shipmentCount)
        : undefined,
      historyCount: metadata.historyCount
        ? parseInt(metadata.historyCount)
        : undefined,
      unitPrice: metadata.unitPrice
        ? parseFloat(metadata.unitPrice)
        : undefined,
      totalPrice: metadata.totalPrice
        ? parseFloat(metadata.totalPrice)
        : undefined,
      lineQuantity: metadata.lineQuantity
        ? parseInt(metadata.lineQuantity)
        : undefined,
    };
  }

  // ===== VECTOR UPSERTING =====

  private async upsertVectors(vectors: VectorDocument[]): Promise<void> {
    if (!this.pinecone) {
      throw new Error("Pinecone client not initialized");
    }

    try {
      const index = this.pinecone.index(this.indexName);

      // Convert VectorDocument to UpsertVector format
      const upsertVectors = vectors.map((vector) => ({
        id: vector.id,
        values: vector.embedding,
        metadata: this.convertMetadataForPinecone(vector.metadata),
      }));

      // Process in batches to respect API limits
      const batchSize = 100;
      for (let i = 0; i < upsertVectors.length; i += batchSize) {
        const batch = upsertVectors.slice(i, i + batchSize);
        const records = batch.map((vector) => ({
          id: vector.id,
          values: vector.values,
          metadata: this.cleanMetadataForPinecone(vector.metadata),
        }));

        await index.upsert(records);
        console.log(
          `📤 Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            upsertVectors.length / batchSize
          )}`
        );

        // Add delay between batches to respect rate limits
        if (i + batchSize < upsertVectors.length) {
          await this.delay(this.config.upsertDelay);
        }
      }
      console.log(`✅ Successfully upserted ${vectors.length} vectors`);
    } catch (error) {
      console.error("❌ Failed to upsert vectors:", error);
      throw error;
    }
  }

  // Convert VectorMetadata to Pinecone-compatible format
  private convertMetadataForPinecone(
    metadata: VectorMetadata
  ): Record<string, any> {
    return {
      type: metadata.type,
      jobNumber: metadata.jobNumber?.toString() || "",
      customerId: metadata.customerId,
      orderNumber: metadata.orderNumber,
      status: metadata.status,
      stockStatus: metadata.stockStatus,
      dueDate: metadata.dueDate,
      dateEntered: metadata.dateEntered,
      program: metadata.program,
      dataSource: metadata.dataSource,
      dataFreshness: metadata.dataFreshness,
      lastUpdated: metadata.lastUpdated,
      completenessScore: metadata.completenessScore,
      customerCompany: metadata.customerCompany,
      deliveryOption: metadata.deliveryOption,
      locationCode: metadata.locationCode,
      timeSensitive: metadata.timeSensitive,
      mustDate: metadata.mustDate,
      isReprint: metadata.isReprint,
      descriptionLength: metadata.descriptionLength,
      commentsLength: metadata.commentsLength,
      totalTextLength: metadata.totalTextLength,
      processes: metadata.processes,
      materials: metadata.materials,
      categories: metadata.categories,
      hasLineItems: metadata.hasLineItems,
      hasShipments: metadata.hasShipments,
      hasHistory: metadata.hasHistory,
      hasStock: metadata.hasStock,
      lineItemCount: metadata.lineItemCount,
      shipmentCount: metadata.shipmentCount,
      historyCount: metadata.historyCount,
    };
  }

  // Clean metadata for Pinecone (remove undefined values and convert to string/number/boolean)
  private cleanMetadataForPinecone(
    metadata: Record<string, any>
  ): Record<string, string | number | boolean> {
    const cleaned: Record<string, string | number | boolean> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined && value !== null) {
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
        ) {
          cleaned[key] = value;
        } else if (Array.isArray(value)) {
          cleaned[key] = value.join(", ");
        } else {
          cleaned[key] = String(value);
        }
      }
    }

    return cleaned;
  }
}

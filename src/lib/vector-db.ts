// Vector Database Service using Pinecone v2.2.2
// Full implementation for RAG pipeline and semantic search

import { Pinecone } from "@pinecone-database/pinecone";
import { Order } from "./oms-data";
import { APIJob } from "./enhanced-api-client";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { embeddingService } from "./embeddings";

export interface VectorMetadata {
  jobNumber: string;
  customerCompany: string;
  customerId?: number;
  status: string;
  priority?: string;
  totalDue?: number;
  dateEntered: string;
  description: string;
  orderNumber: string;
  dataSource: "scraped" | "api" | "hybrid";
  lastUpdated: string;
}

// Clean metadata for Pinecone (remove undefined values)
function cleanMetadataForPinecone(
  metadata: VectorMetadata
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {
    jobNumber: metadata.jobNumber,
    customerCompany: metadata.customerCompany,
    status: metadata.status,
    dateEntered: metadata.dateEntered,
    description: metadata.description,
    orderNumber: metadata.orderNumber,
    dataSource: metadata.dataSource,
    lastUpdated: metadata.lastUpdated,
  };

  // Only add optional fields if they have values
  if (metadata.customerId !== undefined) {
    cleaned.customerId = metadata.customerId;
  }
  if (metadata.priority !== undefined) {
    cleaned.priority = metadata.priority;
  }
  if (metadata.totalDue !== undefined) {
    cleaned.totalDue = metadata.totalDue;
  }

  return cleaned;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

export interface UpsertVector {
  id: string;
  values: number[];
  metadata: VectorMetadata;
}

export interface VectorChangeTracker {
  lastVectorUpdate: string;
  processedOrders: Set<string>; // Job numbers that have been vectorized
  orderHashes: Map<string, string>; // Job number -> hash of order content
  deletedOrders: Set<string>; // Job numbers that were deleted
}

export interface IncrementalUpdateResult {
  newVectors: number;
  updatedVectors: number;
  deletedVectors: number;
  unchangedVectors: number;
  totalProcessed: number;
  processingTime: number;
  errors: string[];
}

export class VectorDBService {
  private pinecone: Pinecone | null = null;
  private indexName: string;
  private initialized = false;
  private changeTracker: VectorChangeTracker;
  private changeTrackerPath: string;

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || "oms-orders";
    this.changeTrackerPath = path.join(
      process.cwd(),
      "data",
      "vector-change-tracker.json"
    );
    this.changeTracker = this.loadChangeTracker();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize Pinecone client
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || "",
      });

      this.initialized = true;
      console.log(`✅ Vector database initialized: ${this.indexName}`);
    } catch (error) {
      console.error("❌ Failed to initialize vector database:", error);
      throw new Error("Vector database initialization failed");
    }
  }

  // Load change tracker state from disk
  private loadChangeTracker(): VectorChangeTracker {
    try {
      if (fs.existsSync(this.changeTrackerPath)) {
        const data = JSON.parse(
          fs.readFileSync(this.changeTrackerPath, "utf8")
        );
        return {
          lastVectorUpdate: data.lastVectorUpdate || new Date(0).toISOString(),
          processedOrders: new Set(data.processedOrders || []),
          orderHashes: new Map(Object.entries(data.orderHashes || {})),
          deletedOrders: new Set(data.deletedOrders || []),
        };
      }
    } catch (error) {
      console.warn("Failed to load change tracker, using empty state:", error);
    }

    return {
      lastVectorUpdate: new Date(0).toISOString(),
      processedOrders: new Set(),
      orderHashes: new Map(),
      deletedOrders: new Set(),
    };
  }

  // Save change tracker state to disk
  private saveChangeTracker(): void {
    try {
      const data = {
        lastVectorUpdate: this.changeTracker.lastVectorUpdate,
        processedOrders: Array.from(this.changeTracker.processedOrders),
        orderHashes: Object.fromEntries(this.changeTracker.orderHashes),
        deletedOrders: Array.from(this.changeTracker.deletedOrders),
      };

      // Ensure directory exists
      const dir = path.dirname(this.changeTrackerPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.changeTrackerPath,
        JSON.stringify(data, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("Failed to save change tracker:", error);
    }
  }

  // Generate a hash for order content to detect changes
  private generateOrderHash(order: any): string {
    // Include fields that matter for search relevance
    const relevantFields = {
      jobNumber: order.jobNumber,
      description: order.description,
      status: order.status,
      customer: order.customer,
      lineItems: order.lineItems,
      production: order.production,
      workflow: order.workflow,
      priority: order.priority,
      metadata: order.metadata,
    };

    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify(relevantFields, Object.keys(relevantFields).sort())
      )
      .digest("hex");
  }

  // Detect changes between current orders and tracked state
  async detectOrderChanges(currentOrders: any[]): Promise<{
    newOrders: any[];
    updatedOrders: any[];
    unchangedOrders: any[];
    deletedOrderIds: string[];
  }> {
    const newOrders: any[] = [];
    const updatedOrders: any[] = [];
    const unchangedOrders: any[] = [];
    const currentJobNumbers = new Set(currentOrders.map((o) => o.jobNumber));

    // Check each current order
    for (const order of currentOrders) {
      const jobNumber = order.jobNumber;
      const currentHash = this.generateOrderHash(order);

      if (!this.changeTracker.processedOrders.has(jobNumber)) {
        // New order
        newOrders.push(order);
      } else {
        const existingHash = this.changeTracker.orderHashes.get(jobNumber);
        if (existingHash !== currentHash) {
          // Updated order
          updatedOrders.push(order);
        } else {
          // Unchanged order
          unchangedOrders.push(order);
        }
      }
    }

    // Find deleted orders
    const deletedOrderIds: string[] = [];
    for (const jobNumber of this.changeTracker.processedOrders) {
      if (!currentJobNumbers.has(jobNumber)) {
        deletedOrderIds.push(jobNumber);
      }
    }

    console.log(
      `📊 Change detection: ${newOrders.length} new, ${updatedOrders.length} updated, ${unchangedOrders.length} unchanged, ${deletedOrderIds.length} deleted`
    );

    return { newOrders, updatedOrders, unchangedOrders, deletedOrderIds };
  }

  // Perform incremental vector database update
  async performIncrementalUpdate(
    orders: any[]
  ): Promise<IncrementalUpdateResult> {
    const startTime = Date.now();
    console.log("🔄 Starting incremental vector database update...");

    const result: IncrementalUpdateResult = {
      newVectors: 0,
      updatedVectors: 0,
      deletedVectors: 0,
      unchangedVectors: 0,
      totalProcessed: 0,
      processingTime: 0,
      errors: [],
    };

    try {
      // Detect what changed
      const changes = await this.detectOrderChanges(orders);

      // Process deletions first
      if (changes.deletedOrderIds.length > 0) {
        console.log(
          `🗑️ Deleting ${changes.deletedOrderIds.length} vectors for deleted orders...`
        );
        try {
          await this.deleteVectors(
            changes.deletedOrderIds.map((id) => `order-${id}`)
          );
          result.deletedVectors = changes.deletedOrderIds.length;

          // Update tracker
          for (const jobNumber of changes.deletedOrderIds) {
            this.changeTracker.processedOrders.delete(jobNumber);
            this.changeTracker.orderHashes.delete(jobNumber);
            this.changeTracker.deletedOrders.add(jobNumber);
          }
        } catch (error) {
          const errorMsg = `Failed to delete vectors: ${error}`;
          console.error("❌", errorMsg);
          result.errors.push(errorMsg);
        }
      }

      // Process new and updated orders
      const ordersToProcess = [...changes.newOrders, ...changes.updatedOrders];

      if (ordersToProcess.length > 0) {
        console.log(
          `📤 Processing ${ordersToProcess.length} orders (${changes.newOrders.length} new, ${changes.updatedOrders.length} updated)...`
        );

        const vectors = await this.createVectorsFromOrders(ordersToProcess);

        if (vectors.length > 0) {
          await this.upsertVectors(vectors);

          // Update tracker
          for (const order of ordersToProcess) {
            const jobNumber = order.jobNumber;
            const isNew = changes.newOrders.some(
              (o) => o.jobNumber === jobNumber
            );

            if (isNew) {
              result.newVectors++;
            } else {
              result.updatedVectors++;
            }

            this.changeTracker.processedOrders.add(jobNumber);
            this.changeTracker.orderHashes.set(
              jobNumber,
              this.generateOrderHash(order)
            );
            this.changeTracker.deletedOrders.delete(jobNumber); // Remove from deleted if re-added
          }
        }
      }

      result.unchangedVectors = changes.unchangedOrders.length;
      result.totalProcessed = orders.length;

      // Update tracker timestamp
      this.changeTracker.lastVectorUpdate = new Date().toISOString();
      this.saveChangeTracker();

      result.processingTime = Date.now() - startTime;

      console.log(
        `✅ Incremental update complete: ${result.newVectors} new, ${result.updatedVectors} updated, ${result.deletedVectors} deleted, ${result.unchangedVectors} unchanged (${result.processingTime}ms)`
      );

      return result;
    } catch (error) {
      const errorMsg = `Incremental update failed: ${error}`;
      console.error("❌", errorMsg);
      result.errors.push(errorMsg);
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }

  // Create vectors from orders (enhanced version with better text generation)
  private async createVectorsFromOrders(
    orders: any[]
  ): Promise<UpsertVector[]> {
    const vectors: UpsertVector[] = [];

    for (const order of orders) {
      try {
        // Enhanced searchable text generation
        const searchText = this.generateEnhancedSearchText(order);
        const embedding = await embeddingService.createEmbedding(searchText);

        const metadata: any = {
          jobNumber: order.jobNumber,
          customerCompany: order.customer?.company || order.client || "Unknown",
          status: order.masterJobStatus || order.status || "Unknown",
          dateEntered:
            order.dateInUtc || order.dateEntered || new Date().toISOString(),
          description: (order.description || "").substring(0, 500),
          orderNumber: order.orderNumber || order.jobNumber,
          dataSource: order.dataSource || "scraped",
          lastUpdated: new Date().toISOString(),
        };

        // Add optional metadata fields
        if (order.customer?.customerId || order.customerId)
          metadata.customerId = order.customer?.customerId || order.customerId;
        if (order.priority) metadata.priority = order.priority;
        if (order.pricing?.totalDue) metadata.totalDue = order.pricing.totalDue;

        // Priority and workflow flags
        if (order.timeSensitive) metadata.timeSensitive = order.timeSensitive;
        if (order.mustDate) metadata.mustDate = order.mustDate;
        if (order.isReprint) metadata.isReprint = order.isReprint;
        if (order.isDupe) metadata.isDupe = order.isDupe;

        // Location and delivery
        if (order.locationCode) metadata.locationCode = order.locationCode;
        if (order.deliveryOption)
          metadata.deliveryOption = order.deliveryOption;

        // Workflow capabilities
        if (order.workflow?.hasJobFiles)
          metadata.hasFiles = order.workflow.hasJobFiles;
        if (order.workflow?.hasProof)
          metadata.hasProof = order.workflow.hasProof;
        if (order.workflow?.hasScheduleableJobLines)
          metadata.scheduleable = order.workflow.hasScheduleableJobLines;

        // Dates
        if (order.dateDueUtc) metadata.dateDue = order.dateDueUtc;
        if (order.daysToDueDate) metadata.daysToDue = order.daysToDueDate;

        vectors.push({
          id: `order-${order.jobNumber}`,
          values: embedding,
          metadata,
        });
      } catch (error) {
        console.error(
          `❌ Failed to create vector for order ${order.jobNumber}:`,
          error
        );
      }
    }

    return vectors;
  }

  // Enhanced search text generation with better keyword extraction
  private generateEnhancedSearchText(order: any): string {
    const parts = [];

    // Core identifiers (HIGH PRIORITY)
    parts.push(`Job ${order.jobNumber}`);
    if (order.orderNumber && order.orderNumber !== order.jobNumber) {
      parts.push(`Order ${order.orderNumber}`);
    }

    // Customer context (HIGH PRIORITY)
    if (order.customer?.company) {
      parts.push(`Customer ${order.customer.company}`);
    }
    if (order.client) {
      parts.push(`Customer ${order.client}`);
    }

    // Descriptions and comments (HIGH PRIORITY)
    if (order.description) parts.push(order.description);
    if (order.comment) parts.push(order.comment);
    if (order.comments) parts.push(order.comments);

    // Line item details with enhanced keyword extraction (HIGH PRIORITY)
    if (order.lineItems) {
      for (const item of order.lineItems) {
        const itemParts = [];
        if (item.description) itemParts.push(item.description);
        if (item.category) itemParts.push(item.category);
        if (item.comment) itemParts.push(item.comment);
        if (item.assetSKU) itemParts.push(`SKU ${item.assetSKU}`);
        if (item.processCodes) itemParts.push(...item.processCodes);
        if (item.materials)
          itemParts.push(...item.materials.map((m: string) => `material ${m}`));
        if (item.hasImage) itemParts.push("has image");
        if (item.hasPDF) itemParts.push("has pdf");

        parts.push(itemParts.join(" "));
      }
    }

    // Production and workflow context (HIGH PRIORITY)
    if (order.production?.productionNotes) {
      parts.push(...order.production.productionNotes);
    }
    if (order.processQuantities) {
      for (const process of order.processQuantities) {
        if (process.code) parts.push(process.code);
        if (process.displayCode) parts.push(process.displayCode);
        if (process.suggestedMachineLabel)
          parts.push(`machine ${process.suggestedMachineLabel}`);
      }
    }

    // Priority and status indicators (HIGH PRIORITY)
    if (order.workflow?.isRush) {
      parts.push("rush urgent priority");
    }
    if (order.timeSensitive) {
      parts.push("rush urgent priority time sensitive");
    }
    if (order.mustDate) {
      parts.push("must date required");
    }
    if (order.isReprint) {
      parts.push("reprint job");
    }
    if (order.isDupe) {
      parts.push("duplicate job");
    }

    // Status information (HIGH PRIORITY)
    if (order.masterJobStatus) parts.push(order.masterJobStatus);
    if (order.stockCompleteStatus) parts.push(order.stockCompleteStatus);
    if (order.statusLine) parts.push(order.statusLine);
    if (order.statusLineHtml) {
      // Strip HTML tags for plain text
      const plainText = order.statusLineHtml.replace(/<[^>]*>/g, "");
      parts.push(plainText);
    }

    // Location and delivery (MEDIUM PRIORITY)
    if (order.locationCode) parts.push(`location ${order.locationCode}`);
    if (order.jobLocationCode) parts.push(`location ${order.jobLocationCode}`);
    if (order.jobLocationName) parts.push(`location ${order.jobLocationName}`);
    if (order.deliveryOption) parts.push(`delivery ${order.deliveryOption}`);

    // Gang codes and process information (MEDIUM PRIORITY)
    if (order.gangCodes) {
      parts.push(...order.gangCodes.map((code: string) => `gang ${code}`));
    }

    // Shipping information (MEDIUM PRIORITY)
    if (order.shipments) {
      for (const shipment of order.shipments) {
        const shipParts = [];
        if (shipment.title) shipParts.push(shipment.title);
        if (shipment.shipped) shipParts.push("shipped");
        if (shipment.collected) shipParts.push("collected");
        if (shipment.shipmentNotes) shipParts.push(shipment.shipmentNotes);

        // Address information
        if (shipment.address) {
          const addr = shipment.address;
          if (addr.organisation) shipParts.push(addr.organisation);
          if (addr.contactName) shipParts.push(addr.contactName);
          if (addr.streetAddress) shipParts.push(addr.streetAddress);
          if (addr.city) shipParts.push(addr.city);
          if (addr.administrativeArea) shipParts.push(addr.administrativeArea);
          if (addr.administrativeAreaAbbreviation)
            shipParts.push(addr.administrativeAreaAbbreviation);
          if (addr.countryName) shipParts.push(addr.countryName);
        }

        // Shipping method
        if (shipment.shipmentMethod?.label) {
          shipParts.push(`shipping ${shipment.shipmentMethod.label}`);
        }

        // Tracking information
        if (shipment.trackingDetails) {
          const tracking = shipment.trackingDetails;
          if (tracking.deliveryStatus) shipParts.push(tracking.deliveryStatus);
          if (tracking.status) shipParts.push(tracking.status);
          if (tracking.shippedVia) shipParts.push(`via ${tracking.shippedVia}`);
          if (tracking.infoLine) shipParts.push(tracking.infoLine);
        }

        if (shipParts.length > 0) {
          parts.push(shipParts.join(" "));
        }
      }
    }

    // File attachments (MEDIUM PRIORITY)
    if (order.files) {
      for (const file of order.files) {
        const fileParts = [];
        if (file.fileName) fileParts.push(`file ${file.fileName}`);
        if (file.fileType) fileParts.push(`type ${file.fileType}`);
        if (file.category) fileParts.push(`category ${file.category}`);
        if (file.subcategory) fileParts.push(`subcategory ${file.subcategory}`);
        if (file.fileStatus) fileParts.push(`status ${file.fileStatus}`);
        if (file.createdBy?.fullName)
          fileParts.push(`by ${file.createdBy.fullName}`);

        if (fileParts.length > 0) {
          parts.push(fileParts.join(" "));
        }
      }
    }

    // Tags and metadata (MEDIUM PRIORITY)
    if (order.metadata?.tags) {
      parts.push(...order.metadata.tags);
    }
    if (order.metadata?.department) {
      parts.push(`department ${order.metadata.department}`);
    }
    if (order.metadata?.complexity) {
      parts.push(`complexity ${order.metadata.complexity}`);
    }
    if (order.jobTags) {
      parts.push(...order.jobTags.map((tag: any) => tag.tag));
    }

    // Workflow indicators (LOW PRIORITY)
    if (order.workflow?.hasJobFiles) {
      parts.push("has files");
    }
    if (order.workflow?.hasProof) {
      parts.push("has proof");
    }
    if (order.workflow?.hasScheduleableJobLines) {
      parts.push("scheduleable");
    }
    if (order.workflow?.canPrintJobLineLabels) {
      parts.push("can print labels");
    }

    return parts.filter(Boolean).join(" ").trim();
  }

  // Delete vectors by IDs
  async deleteVectors(vectorIds: string[]): Promise<void> {
    if (vectorIds.length === 0) return;

    try {
      await this.pinecone?.index(this.indexName).deleteMany(vectorIds);
      console.log(`✅ Deleted ${vectorIds.length} vectors`);
    } catch (error) {
      console.error("❌ Failed to delete vectors:", error);
      throw error;
    }
  }

  // Get change tracker statistics
  getChangeTrackerStats() {
    return {
      lastVectorUpdate: this.changeTracker.lastVectorUpdate,
      processedOrdersCount: this.changeTracker.processedOrders.size,
      deletedOrdersCount: this.changeTracker.deletedOrders.size,
      trackedHashesCount: this.changeTracker.orderHashes.size,
    };
  }

  // Reset change tracker (for full rebuilds)
  resetChangeTracker(): void {
    this.changeTracker = {
      lastVectorUpdate: new Date(0).toISOString(),
      processedOrders: new Set(),
      orderHashes: new Map(),
      deletedOrders: new Set(),
    };
    this.saveChangeTracker();
    console.log("🔄 Change tracker reset");
  }

  // Force full rebuild (clears tracker and processes all orders)
  async forceFullRebuild(orders: any[]): Promise<IncrementalUpdateResult> {
    console.log("🔄 Forcing full vector database rebuild...");
    this.resetChangeTracker();
    return await this.performIncrementalUpdate(orders);
  }

  // Convert Order (scraped data) to searchable text
  orderToSearchText(order: Order): string {
    return [
      // Core identifiers
      `Job ${order.jobNumber}`,
      `Order ${order.orderNumber}`,

      // Customer context
      `Customer ${order.customer.company}`,
      `Contact ${order.customer.contactPerson}`,

      // Main description
      order.description,
      order.comment,

      // Line item details (critical for material/process searches)
      ...order.lineItems.map((item) =>
        [
          item.description,
          item.category,
          item.comment,
          // Extract material and process keywords
          this.extractKeywords(item.comment || "", "materials"),
          this.extractKeywords(item.comment || "", "processes"),
        ]
          .filter(Boolean)
          .join(" ")
      ),

      // Production and workflow context
      ...order.production.productionNotes,
      order.workflow.isRush ? "rush urgent priority" : "",

      // Shipping context
      ...order.shipments.map(
        (ship) =>
          `${ship.shipToAddress.company} ${ship.shipToAddress.city} ${ship.shipToAddress.state} ${ship.specialInstructions}`
      ),

      // Metadata tags
      ...order.metadata.tags,
      order.metadata.department,
      order.metadata.complexity,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Convert APIJob (live API data) to searchable text
  apiJobToSearchText(job: APIJob): string {
    return [
      // Core identifiers
      `Job ${job.JobNumber}`,
      `Order ${job.OrderNumber}`,

      // Customer and description
      `Customer ${job.Client}`,
      job.Description,

      // Status information
      job.MasterJobStatus,
      job.StockCompleteStatus,
      job.DeliveryOption,

      // Process information
      ...job.ProcessQuantities.map(
        (process) =>
          `${process.Code} ${process.DisplayCode} ${process.Qty} quantity`
      ),

      // Job tags
      ...job.JobTags.map((tag) => tag.Tag),
    ]
      .filter(Boolean)
      .join(" ");
  }

  // Extract material and process keywords for better search
  private extractKeywords(
    text: string,
    type: "materials" | "processes"
  ): string {
    const lowerText = text.toLowerCase();

    if (type === "materials") {
      const materials = [
        "leatherette",
        "leather",
        "vinyl",
        "fabric",
        "cotton",
        "polyester",
        "canvas",
        "denim",
        "fleece",
        "mesh",
        "nylon",
        "spandex",
        "silk",
        "wool",
        "synthetic",
        "plastic",
        "metal",
        "rubber",
      ];
      return materials
        .filter((material) => lowerText.includes(material))
        .join(" ");
    } else {
      const processes = [
        "embroidery",
        "heat press",
        "screen print",
        "vinyl",
        "patches",
        "applique",
        "stitching",
        "direct garment",
        "sublimation",
        "dtg",
        "heat transfer",
        "cut",
        "sew",
        "print",
        "laser",
        "engrave",
      ];
      return processes
        .filter((process) => lowerText.includes(process))
        .join(" ");
    }
  }

  // Convert Order to vector metadata
  orderToMetadata(order: Order): VectorMetadata {
    return {
      jobNumber: order.jobNumber,
      customerCompany: order.customer.company,
      status: order.status,
      priority: order.priority,
      totalDue: order.pricing.totalDue,
      dateEntered: order.dateEntered,
      description: order.description.substring(0, 500), // Limit for metadata
      orderNumber: order.orderNumber,
      dataSource: "scraped",
      lastUpdated: order.metadata.lastUpdated,
    };
  }

  // Convert APIJob to vector metadata
  apiJobToMetadata(job: APIJob): VectorMetadata {
    return {
      jobNumber: job.JobNumber.toString(),
      customerCompany: job.Client,
      customerId: job.CustomerId,
      status: job.MasterJobStatus,
      dateEntered: job.DateInUtc,
      description: job.Description.substring(0, 500),
      orderNumber: job.OrderNumber,
      dataSource: "api",
      lastUpdated: new Date().toISOString(),
    };
  }

  // Upsert a single vector
  async upsertVector(vector: UpsertVector): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.pinecone) throw new Error("Pinecone client not initialized");

    try {
      const index = this.pinecone.index(this.indexName);
      await index.upsert([
        {
          id: vector.id,
          values: vector.values,
          metadata: cleanMetadataForPinecone(vector.metadata),
        },
      ]);
    } catch (error) {
      console.error("❌ Failed to upsert vector:", error);
      throw error;
    }
  }

  // Upsert multiple vectors in batch
  async upsertVectors(vectors: UpsertVector[]): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.pinecone) throw new Error("Pinecone client not initialized");

    try {
      const index = this.pinecone.index(this.indexName);

      // Process in batches to respect API limits
      const batchSize = 100;
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);
        const records = batch.map((vector) => ({
          id: vector.id,
          values: vector.values,
          metadata: cleanMetadataForPinecone(vector.metadata),
        }));

        await index.upsert(records);
        console.log(
          `📤 Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            vectors.length / batchSize
          )}`
        );
      }
      console.log(`✅ Successfully upserted ${vectors.length} vectors`);
    } catch (error) {
      console.error("❌ Failed to upsert vectors:", error);
      throw error;
    }
  }

  // Search for similar orders
  async searchSimilarOrders(
    queryVector: number[],
    topK: number = 5,
    filter?: Record<string, string | number | boolean>
  ): Promise<SearchResult[]> {
    if (!this.initialized) await this.initialize();
    if (!this.pinecone) throw new Error("Pinecone client not initialized");

    try {
      const index = this.pinecone.index(this.indexName);

      const queryRequest: {
        vector: number[];
        topK: number;
        includeMetadata: boolean;
        filter?: Record<string, string | number | boolean>;
      } = {
        vector: queryVector,
        topK,
        includeMetadata: true,
      };

      if (filter) {
        queryRequest.filter = filter;
      }

      const results = await index.query(queryRequest);

      return (
        results.matches?.map((match) => ({
          id: match.id || "",
          score: match.score || 0,
          metadata: match.metadata as unknown as VectorMetadata,
        })) || []
      );
    } catch (error) {
      console.error("❌ Vector search failed:", error);
      throw error;
    }
  }

  // Delete vectors by job numbers
  async deleteOrderVectors(jobNumbers: string[]): Promise<void> {
    if (!this.initialized) await this.initialize();
    if (!this.pinecone) throw new Error("Pinecone client not initialized");

    try {
      const index = this.pinecone.index(this.indexName);
      const ids = jobNumbers.map((jobNumber) => `order-${jobNumber}`);
      await index.deleteMany(ids);
      console.log(`🗑️ Deleted ${ids.length} vectors`);
    } catch (error) {
      console.error("❌ Failed to delete vectors:", error);
      throw error;
    }
  }

  // Get index statistics
  async getIndexStats(): Promise<unknown> {
    if (!this.initialized) await this.initialize();
    if (!this.pinecone) throw new Error("Pinecone client not initialized");

    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      console.error("❌ Failed to get index stats:", error);
      throw error;
    }
  }

  // Health check
  async healthCheck(): Promise<{
    healthy: boolean;
    stats?: unknown;
    error?: string;
  }> {
    try {
      if (!this.initialized) await this.initialize();

      const stats = await this.getIndexStats();
      return { healthy: true, stats };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Create singleton instance
export const vectorDBService = new VectorDBService();

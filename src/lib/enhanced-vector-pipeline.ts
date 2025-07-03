// Enhanced Vector Pipeline - Modern API-driven vector generation and management
// Leverages rich ModernOrder data for superior semantic search capabilities

import { Pinecone } from "@pinecone-database/pinecone";
import { ModernOrder, apiFirstDataService } from "./api-first-data-service";
import { embeddingService } from "./embeddings";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// Enhanced vector metadata with rich API data
export interface EnhancedVectorMetadata {
  // Core identifiers
  jobNumber: string;
  orderNumber: string;

  // Customer information
  customerCompany: string;
  customerId: number;

  // Status and workflow
  masterStatus: string;
  masterStatusId: number;
  stockStatus: string;
  stockComplete: number;

  // Dates and timing
  dateEntered: string;
  dateDue: string;
  dateDueFactory: string;
  daysToDueDate: number;

  // Production details
  processes: string[]; // Array of process codes
  gangCodes: string[];
  timeSensitive: boolean;
  mustDate: boolean;
  isReprint: boolean;

  // Location and delivery
  locationCode: string;
  locationName: string;
  deliveryOption: string;

  // Enrichment indicators
  hasLineItems: boolean;
  hasShipments: boolean;
  hasFiles: boolean;
  lineItemCount: number;
  shipmentCount: number;
  fileCount: number;

  // Content categories
  categories: string[]; // From line items
  materials: string[]; // From line items
  fileTypes: string[]; // From attachments

  // Quality and freshness
  dataSource: "api";
  dataFreshness: "fresh" | "stale" | "very-stale";
  completenessScore: number; // 0-100
  lastAPIUpdate: string;

  // Text content length for filtering
  descriptionLength: number;
  commentsLength: number;
  totalTextLength: number;
}

export interface EnhancedSearchResult {
  id: string;
  score: number;
  metadata: EnhancedVectorMetadata;
  highlights?: string[]; // Key matching phrases
}

export interface EnhancedUpsertVector {
  id: string;
  values: number[];
  metadata: EnhancedVectorMetadata;
}

export interface VectorUpdateStats {
  newVectors: number;
  updatedVectors: number;
  deletedVectors: number;
  unchangedVectors: number;
  totalProcessed: number;
  processingTime: number;
  apiCalls: number;
  embeddingTokens: number;
  errors: string[];
  performance: {
    averageEmbeddingTime: number;
    averageUpsertTime: number;
    batchSize: number;
    throughputPerSecond: number;
  };
}

export interface VectorChangeTracker {
  lastUpdate: string;
  lastFullRebuild: string;
  processedOrders: Set<string>;
  orderHashes: Map<string, string>;
  deletedOrders: Set<string>;
  updateHistory: Array<{
    timestamp: string;
    stats: VectorUpdateStats;
  }>;
}

export class EnhancedVectorPipeline {
  private pinecone: Pinecone | null = null;
  private indexName: string;
  private initialized = false;
  private changeTracker: VectorChangeTracker;
  private changeTrackerPath: string;
  private batchSize = 50; // Optimal batch size for Pinecone

  constructor() {
    this.indexName = process.env.PINECONE_INDEX_NAME || "oms-orders-enhanced";
    this.changeTrackerPath = path.join(
      process.cwd(),
      "data",
      "enhanced-vector-tracker.json"
    );
    this.changeTracker = this.loadChangeTracker();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || "",
      });

      this.initialized = true;
      console.log(`✅ Enhanced vector pipeline initialized: ${this.indexName}`);

      // Warm up the embedding service
      await embeddingService.initialize();
    } catch (error) {
      console.error("❌ Failed to initialize enhanced vector pipeline:", error);
      throw new Error("Enhanced vector pipeline initialization failed");
    }
  }

  // Perform real-time incremental update using API data
  async performRealtimeUpdate(): Promise<VectorUpdateStats> {
    console.log("🔄 Starting real-time vector update...");

    const startTime = Date.now();
    let apiCalls = 0;
    let embeddingTokens = 0;
    const errors: string[] = [];

    try {
      await this.initialize();

      // Fetch fresh data from API
      console.log("📊 Fetching latest orders from API...");
      const ordersData = await apiFirstDataService.getAllOrders({
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
        pageSize: 500,
      });
      apiCalls++;

      if (ordersData.summary.apiHealth !== "healthy") {
        errors.push("API health check failed - data may be incomplete");
      }

      // Detect changes
      const changes = await this.detectOrderChanges(ordersData.orders);

      let newVectors = 0;
      let updatedVectors = 0;
      let deletedVectors = 0;

      // Process new orders
      if (changes.newOrders.length > 0) {
        console.log(`➕ Processing ${changes.newOrders.length} new orders...`);
        const vectors = await this.createEnhancedVectors(changes.newOrders);
        embeddingTokens += this.estimateTokens(changes.newOrders);

        await this.upsertVectors(vectors);
        newVectors = vectors.length;

        // Update tracker
        changes.newOrders.forEach((order) => {
          this.changeTracker.processedOrders.add(order.jobNumber);
          this.changeTracker.orderHashes.set(
            order.jobNumber,
            this.generateOrderHash(order)
          );
        });
      }

      // Process updated orders
      if (changes.updatedOrders.length > 0) {
        console.log(
          `🔄 Processing ${changes.updatedOrders.length} updated orders...`
        );
        const vectors = await this.createEnhancedVectors(changes.updatedOrders);
        embeddingTokens += this.estimateTokens(changes.updatedOrders);

        await this.upsertVectors(vectors);
        updatedVectors = vectors.length;

        // Update tracker
        changes.updatedOrders.forEach((order) => {
          this.changeTracker.orderHashes.set(
            order.jobNumber,
            this.generateOrderHash(order)
          );
        });
      }

      // Process deleted orders
      if (changes.deletedOrderIds.length > 0) {
        console.log(`➖ Deleting ${changes.deletedOrderIds.length} vectors...`);
        await this.deleteVectors(changes.deletedOrderIds);
        deletedVectors = changes.deletedOrderIds.length;

        // Update tracker
        changes.deletedOrderIds.forEach((id) => {
          this.changeTracker.processedOrders.delete(id);
          this.changeTracker.orderHashes.delete(id);
          this.changeTracker.deletedOrders.add(id);
        });
      }

      // Update tracker and save
      this.changeTracker.lastUpdate = new Date().toISOString();

      const processingTime = Date.now() - startTime;
      const stats: VectorUpdateStats = {
        newVectors,
        updatedVectors,
        deletedVectors,
        unchangedVectors: changes.unchangedOrders.length,
        totalProcessed: ordersData.orders.length,
        processingTime,
        apiCalls,
        embeddingTokens,
        errors,
        performance: {
          averageEmbeddingTime:
            embeddingTokens > 0 ? processingTime / embeddingTokens : 0,
          averageUpsertTime:
            newVectors + updatedVectors > 0
              ? processingTime / (newVectors + updatedVectors)
              : 0,
          batchSize: this.batchSize,
          throughputPerSecond:
            ordersData.orders.length / (processingTime / 1000),
        },
      };

      // Save update history
      this.changeTracker.updateHistory.push({
        timestamp: new Date().toISOString(),
        stats,
      });

      // Keep only last 50 updates in history
      if (this.changeTracker.updateHistory.length > 50) {
        this.changeTracker.updateHistory =
          this.changeTracker.updateHistory.slice(-50);
      }

      this.saveChangeTracker();

      console.log(`✅ Real-time update completed in ${processingTime}ms`);
      console.log(
        `📊 Results: +${newVectors} new, ~${updatedVectors} updated, -${deletedVectors} deleted`
      );

      return stats;
    } catch (error) {
      console.error("❌ Real-time update failed:", error);
      errors.push(error instanceof Error ? error.message : "Unknown error");

      return {
        newVectors: 0,
        updatedVectors: 0,
        deletedVectors: 0,
        unchangedVectors: 0,
        totalProcessed: 0,
        processingTime: Date.now() - startTime,
        apiCalls,
        embeddingTokens,
        errors,
        performance: {
          averageEmbeddingTime: 0,
          averageUpsertTime: 0,
          batchSize: this.batchSize,
          throughputPerSecond: 0,
        },
      };
    }
  }

  // Create enhanced vectors from modern orders
  private async createEnhancedVectors(
    orders: ModernOrder[]
  ): Promise<EnhancedUpsertVector[]> {
    console.log(`🧮 Creating enhanced vectors for ${orders.length} orders...`);

    const vectors: EnhancedUpsertVector[] = [];
    const batchSize = 10; // For embedding generation

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);

      // Generate embeddings for the batch
      const texts = batch.map((order) =>
        this.generateEnhancedSearchText(order)
      );
      const embeddings = await embeddingService.createEmbeddings(texts);

      // Create vectors with enhanced metadata
      for (let j = 0; j < batch.length; j++) {
        const order = batch[j];
        const embedding = embeddings[j];

        vectors.push({
          id: `job-${order.jobNumber}`,
          values: embedding,
          metadata: this.orderToEnhancedMetadata(order),
        });
      }

      console.log(
        `📝 Processed batch ${Math.ceil(
          (i + batchSize) / batchSize
        )}/${Math.ceil(orders.length / batchSize)}`
      );
    }

    return vectors;
  }

  // Generate comprehensive search text leveraging all API data
  private generateEnhancedSearchText(order: ModernOrder): string {
    const textParts: string[] = [];

    // Core order information
    textParts.push(`Job ${order.jobNumber} Order ${order.orderNumber}`);
    textParts.push(`Customer: ${order.customer.company}`);
    textParts.push(`Description: ${order.description}`);

    if (order.comments) {
      textParts.push(`Comments: ${order.comments}`);
    }

    // Status information
    textParts.push(`Status: ${order.status.master} - ${order.status.stock}`);

    // Production details
    if (order.production.processes.length > 0) {
      const processes = order.production.processes
        .map((p) => `${p.displayCode} (${p.quantity})`)
        .join(", ");
      textParts.push(`Processes: ${processes}`);
    }

    if (order.production.gangCodes.length > 0) {
      textParts.push(`Gang Codes: ${order.production.gangCodes.join(", ")}`);
    }

    // Priority indicators
    const priorityFlags: string[] = [];
    if (order.production.timeSensitive) priorityFlags.push("time sensitive");
    if (order.production.mustDate) priorityFlags.push("must date");
    if (order.production.isReprint) priorityFlags.push("reprint");
    if (priorityFlags.length > 0) {
      textParts.push(`Priority: ${priorityFlags.join(", ")}`);
    }

    // Line items details
    if (order.lineItems.length > 0) {
      const lineDetails = order.lineItems.map((line) => {
        const parts = [line.description];
        if (line.category) parts.push(`Category: ${line.category}`);
        if (line.materials && line.materials.length > 0) {
          parts.push(`Materials: ${line.materials.join(", ")}`);
        }
        if (line.processCodes && line.processCodes.length > 0) {
          parts.push(`Processes: ${line.processCodes.join(", ")}`);
        }
        if (line.comment) parts.push(`Note: ${line.comment}`);
        return parts.join(" | ");
      });

      textParts.push(`Line Items: ${lineDetails.join(" ;; ")}`);
    }

    // Shipment information
    if (order.shipments.length > 0) {
      const shipmentDetails = order.shipments.map((shipment) => {
        const parts = [
          `Ship to: ${
            shipment.address.organisation || shipment.address.contactName
          }`,
        ];
        parts.push(`${shipment.address.city}, ${shipment.address.state}`);
        parts.push(`Method: ${shipment.method.label}`);
        if (shipment.shipped) parts.push("SHIPPED");
        if (shipment.trackingDetails)
          parts.push(`Status: ${shipment.trackingDetails.status}`);
        return parts.join(" | ");
      });

      textParts.push(`Shipments: ${shipmentDetails.join(" ;; ")}`);
    }

    // File attachments
    if (order.files.length > 0) {
      const fileDetails = order.files.map(
        (file) => `${file.fileName} (${file.fileType}, ${file.category})`
      );
      textParts.push(`Files: ${fileDetails.join(", ")}`);
    }

    // Tags
    if (order.tags.length > 0) {
      const tagDetails = order.tags.map((tag) => tag.tag);
      textParts.push(`Tags: ${tagDetails.join(", ")}`);
    }

    // Location and delivery
    textParts.push(`Location: ${order.location.name} (${order.location.code})`);
    textParts.push(`Delivery: ${order.location.deliveryOption}`);

    // Dates for temporal context
    const dueDate = new Date(order.dates.dateDue);
    const enteredDate = new Date(order.dates.dateEntered);
    textParts.push(`Due: ${dueDate.toLocaleDateString()}`);
    textParts.push(`Entered: ${enteredDate.toLocaleDateString()}`);

    return textParts.join("\n");
  }

  // Convert modern order to enhanced metadata
  private orderToEnhancedMetadata(order: ModernOrder): EnhancedVectorMetadata {
    // Extract categories and materials from line items
    const categories = [
      ...new Set(order.lineItems.map((item) => item.category).filter(Boolean)),
    ];
    const materials = [
      ...new Set(order.lineItems.flatMap((item) => item.materials || [])),
    ];
    const fileTypes = [...new Set(order.files.map((file) => file.fileType))];

    // Calculate completeness score
    const requiredFields = [
      order.jobNumber,
      order.orderNumber,
      order.description,
      order.customer.company,
      order.status.master,
      order.dates.dateEntered,
      order.dates.dateDue,
    ];

    const completedFields = requiredFields.filter(
      (field) => field && field !== "" && field !== null && field !== undefined
    ).length;

    const completenessScore = Math.round(
      (completedFields / requiredFields.length) * 100
    );

    // Calculate text lengths
    const descriptionLength = order.description.length;
    const commentsLength = order.comments.length;
    const totalTextLength =
      descriptionLength +
      commentsLength +
      order.lineItems.reduce((sum, item) => sum + item.description.length, 0);

    return {
      jobNumber: order.jobNumber,
      orderNumber: order.orderNumber,
      customerCompany: order.customer.company,
      customerId: order.customer.id,
      masterStatus: order.status.master,
      masterStatusId: order.status.masterStatusId,
      stockStatus: order.status.stock,
      stockComplete: order.status.stockComplete,
      dateEntered: order.dates.dateEntered,
      dateDue: order.dates.dateDue,
      dateDueFactory: order.dates.dateDueFactory,
      daysToDueDate: order.dates.daysToDueDate,
      processes: order.production.processes.map((p) => p.code),
      gangCodes: order.production.gangCodes,
      timeSensitive: order.production.timeSensitive,
      mustDate: order.production.mustDate,
      isReprint: order.production.isReprint,
      locationCode: order.location.code,
      locationName: order.location.name,
      deliveryOption: order.location.deliveryOption,
      hasLineItems: order.lineItems.length > 0,
      hasShipments: order.shipments.length > 0,
      hasFiles: order.files.length > 0,
      lineItemCount: order.lineItems.length,
      shipmentCount: order.shipments.length,
      fileCount: order.files.length,
      categories,
      materials,
      fileTypes,
      dataSource: "api",
      dataFreshness: order.metadata.dataFreshness,
      completenessScore,
      lastAPIUpdate: order.metadata.lastAPIUpdate,
      descriptionLength,
      commentsLength,
      totalTextLength,
    };
  }

  // Enhanced semantic search with rich filtering
  async searchSimilarOrders(
    query: string,
    options: {
      topK?: number;
      filters?: {
        customerCompany?: string;
        status?: string;
        hasLineItems?: boolean;
        hasShipments?: boolean;
        hasFiles?: boolean;
        timeSensitive?: boolean;
        mustDate?: boolean;
        minCompletenessScore?: number;
        dateRange?: {
          start: string;
          end: string;
        };
        processes?: string[];
        materials?: string[];
        categories?: string[];
      };
      includeHighlights?: boolean;
    } = {}
  ): Promise<EnhancedSearchResult[]> {
    await this.initialize();

    const { topK = 10, filters = {}, includeHighlights = false } = options;

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.createEmbedding(query);

      // Build Pinecone filter
      const pineconeFilter: Record<string, any> = {};

      if (filters.customerCompany) {
        pineconeFilter.customerCompany = { $eq: filters.customerCompany };
      }

      if (filters.status) {
        pineconeFilter.masterStatus = { $eq: filters.status };
      }

      if (filters.hasLineItems !== undefined) {
        pineconeFilter.hasLineItems = { $eq: filters.hasLineItems };
      }

      if (filters.hasShipments !== undefined) {
        pineconeFilter.hasShipments = { $eq: filters.hasShipments };
      }

      if (filters.hasFiles !== undefined) {
        pineconeFilter.hasFiles = { $eq: filters.hasFiles };
      }

      if (filters.timeSensitive !== undefined) {
        pineconeFilter.timeSensitive = { $eq: filters.timeSensitive };
      }

      if (filters.mustDate !== undefined) {
        pineconeFilter.mustDate = { $eq: filters.mustDate };
      }

      if (filters.minCompletenessScore !== undefined) {
        pineconeFilter.completenessScore = {
          $gte: filters.minCompletenessScore,
        };
      }

      if (filters.dateRange) {
        pineconeFilter.dateEntered = {
          $gte: filters.dateRange.start,
          $lte: filters.dateRange.end,
        };
      }

      // Search Pinecone
      const index = this.pinecone!.index(this.indexName);
      const searchResponse = await index.query({
        vector: queryEmbedding,
        topK,
        filter:
          Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
        includeMetadata: true,
      });

      // Convert to enhanced search results
      const results: EnhancedSearchResult[] =
        searchResponse.matches?.map((match) => ({
          id: match.id || "",
          score: match.score || 0,
          metadata: match.metadata as EnhancedVectorMetadata,
          highlights: includeHighlights
            ? this.generateHighlights(
                query,
                match.metadata as EnhancedVectorMetadata
              )
            : undefined,
        })) || [];

      console.log(
        `🔍 Found ${results.length} similar orders for query: "${query}"`
      );
      return results;
    } catch (error) {
      console.error("❌ Enhanced search failed:", error);
      throw error;
    }
  }

  // Generate highlights for search results
  private generateHighlights(
    query: string,
    metadata: EnhancedVectorMetadata
  ): string[] {
    const highlights: string[] = [];
    const queryLower = query.toLowerCase();

    // Check various fields for matches with safe access
    const fields = [
      { name: "description", value: metadata.jobNumber || "" },
      { name: "customer", value: metadata.customerCompany || "" },
      { name: "status", value: metadata.masterStatus || "" },
      { name: "location", value: metadata.locationName || "" },
      { name: "processes", value: (metadata.processes || []).join(" ") },
      { name: "materials", value: (metadata.materials || []).join(" ") },
      { name: "categories", value: (metadata.categories || []).join(" ") },
    ];

    fields.forEach((field) => {
      if (field.value && field.value.toLowerCase().includes(queryLower)) {
        highlights.push(`${field.name}: ${field.value}`);
      }
    });

    return highlights.slice(0, 3); // Limit to top 3 highlights
  }

  // Change detection and tracking
  private async detectOrderChanges(currentOrders: ModernOrder[]): Promise<{
    newOrders: ModernOrder[];
    updatedOrders: ModernOrder[];
    unchangedOrders: ModernOrder[];
    deletedOrderIds: string[];
  }> {
    const newOrders: ModernOrder[] = [];
    const updatedOrders: ModernOrder[] = [];
    const unchangedOrders: ModernOrder[] = [];

    const currentJobNumbers = new Set(currentOrders.map((o) => o.jobNumber));
    const previousJobNumbers = new Set(this.changeTracker.processedOrders);

    // Find deleted orders
    const deletedOrderIds = Array.from(previousJobNumbers).filter(
      (jobNumber) => !currentJobNumbers.has(jobNumber)
    );

    // Check each current order
    for (const order of currentOrders) {
      const jobNumber = order.jobNumber;
      const currentHash = this.generateOrderHash(order);
      const previousHash = this.changeTracker.orderHashes.get(jobNumber);

      if (!this.changeTracker.processedOrders.has(jobNumber)) {
        // New order
        newOrders.push(order);
      } else if (previousHash !== currentHash) {
        // Updated order
        updatedOrders.push(order);
      } else {
        // Unchanged order
        unchangedOrders.push(order);
      }
    }

    return {
      newOrders,
      updatedOrders,
      unchangedOrders,
      deletedOrderIds,
    };
  }

  // Utility methods
  private generateOrderHash(order: ModernOrder): string {
    // Include all fields that affect search relevance
    const hashableContent = {
      description: order.description,
      comments: order.comments,
      status: order.status,
      lineItems: order.lineItems,
      shipments: order.shipments,
      files: order.files,
      tags: order.tags,
      production: order.production,
      workflow: order.workflow,
      metadata: {
        lastAPIUpdate: order.metadata.lastAPIUpdate,
        dataFreshness: order.metadata.dataFreshness,
      },
    };

    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify(hashableContent, Object.keys(hashableContent).sort())
      )
      .digest("hex");
  }

  private estimateTokens(orders: ModernOrder[]): number {
    // Rough estimation: 1 token ≈ 4 characters
    return orders.reduce((total, order) => {
      const text = this.generateEnhancedSearchText(order);
      return total + Math.ceil(text.length / 4);
    }, 0);
  }

  // Vector operations
  private async upsertVectors(vectors: EnhancedUpsertVector[]): Promise<void> {
    if (!this.pinecone || vectors.length === 0) return;

    const index = this.pinecone.index(this.indexName);

    // Process in batches
    for (let i = 0; i < vectors.length; i += this.batchSize) {
      const batch = vectors.slice(i, i + this.batchSize);

      // Clean metadata for Pinecone
      const cleanedBatch = batch.map((vector) => ({
        ...vector,
        metadata: this.cleanMetadataForPinecone(vector.metadata),
      }));

      await index.upsert(cleanedBatch);
      console.log(
        `📤 Upserted batch ${Math.ceil(
          (i + this.batchSize) / this.batchSize
        )}/${Math.ceil(vectors.length / this.batchSize)}`
      );
    }
  }

  private cleanMetadataForPinecone(
    metadata: EnhancedVectorMetadata
  ): Record<string, string | number | boolean> {
    // Pinecone has strict requirements for metadata
    const cleaned: Record<string, string | number | boolean> = {
      jobNumber: metadata.jobNumber,
      orderNumber: metadata.orderNumber,
      customerCompany: metadata.customerCompany,
      customerId: metadata.customerId,
      masterStatus: metadata.masterStatus,
      masterStatusId: metadata.masterStatusId,
      stockStatus: metadata.stockStatus,
      stockComplete: metadata.stockComplete,
      dateEntered: metadata.dateEntered,
      dateDue: metadata.dateDue,
      dateDueFactory: metadata.dateDueFactory,
      daysToDueDate: metadata.daysToDueDate,
      timeSensitive: metadata.timeSensitive,
      mustDate: metadata.mustDate,
      isReprint: metadata.isReprint,
      locationCode: metadata.locationCode,
      locationName: metadata.locationName,
      deliveryOption: metadata.deliveryOption,
      hasLineItems: metadata.hasLineItems,
      hasShipments: metadata.hasShipments,
      hasFiles: metadata.hasFiles,
      lineItemCount: metadata.lineItemCount,
      shipmentCount: metadata.shipmentCount,
      fileCount: metadata.fileCount,
      dataSource: metadata.dataSource,
      dataFreshness: metadata.dataFreshness,
      completenessScore: metadata.completenessScore,
      lastAPIUpdate: metadata.lastAPIUpdate,
      descriptionLength: metadata.descriptionLength,
      commentsLength: metadata.commentsLength,
      totalTextLength: metadata.totalTextLength,
    };

    // Add array fields as comma-separated strings (Pinecone limitation)
    if (metadata.processes.length > 0) {
      cleaned.processes = metadata.processes.join(",");
    }
    if (metadata.gangCodes.length > 0) {
      cleaned.gangCodes = metadata.gangCodes.join(",");
    }
    if (metadata.categories.length > 0) {
      cleaned.categories = metadata.categories.join(",");
    }
    if (metadata.materials.length > 0) {
      cleaned.materials = metadata.materials.join(",");
    }
    if (metadata.fileTypes.length > 0) {
      cleaned.fileTypes = metadata.fileTypes.join(",");
    }

    return cleaned;
  }

  private async deleteVectors(vectorIds: string[]): Promise<void> {
    if (!this.pinecone || vectorIds.length === 0) return;

    const index = this.pinecone.index(this.indexName);

    // Process in batches
    for (let i = 0; i < vectorIds.length; i += this.batchSize) {
      const batch = vectorIds.slice(i, i + this.batchSize);
      await index.deleteMany(batch);
    }

    console.log(`🗑️ Deleted ${vectorIds.length} vectors`);
  }

  // Change tracker management
  private loadChangeTracker(): VectorChangeTracker {
    try {
      if (fs.existsSync(this.changeTrackerPath)) {
        const data = JSON.parse(
          fs.readFileSync(this.changeTrackerPath, "utf8")
        );
        return {
          lastUpdate: data.lastUpdate || new Date(0).toISOString(),
          lastFullRebuild: data.lastFullRebuild || new Date(0).toISOString(),
          processedOrders: new Set(data.processedOrders || []),
          orderHashes: new Map(Object.entries(data.orderHashes || {})),
          deletedOrders: new Set(data.deletedOrders || []),
          updateHistory: data.updateHistory || [],
        };
      }
    } catch (error) {
      console.warn("Failed to load enhanced change tracker:", error);
    }

    return {
      lastUpdate: new Date(0).toISOString(),
      lastFullRebuild: new Date(0).toISOString(),
      processedOrders: new Set(),
      orderHashes: new Map(),
      deletedOrders: new Set(),
      updateHistory: [],
    };
  }

  private saveChangeTracker(): void {
    try {
      const data = {
        lastUpdate: this.changeTracker.lastUpdate,
        lastFullRebuild: this.changeTracker.lastFullRebuild,
        processedOrders: Array.from(this.changeTracker.processedOrders),
        orderHashes: Object.fromEntries(this.changeTracker.orderHashes),
        deletedOrders: Array.from(this.changeTracker.deletedOrders),
        updateHistory: this.changeTracker.updateHistory,
      };

      const dir = path.dirname(this.changeTrackerPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.changeTrackerPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save enhanced change tracker:", error);
    }
  }

  // Health and monitoring
  async getIndexStats(): Promise<unknown> {
    await this.initialize();
    if (!this.pinecone) throw new Error("Vector pipeline not initialized");

    const index = this.pinecone.index(this.indexName);
    return await index.describeIndexStats();
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    stats?: unknown;
    changeTracker?: any;
    error?: string;
  }> {
    try {
      await this.initialize();
      const stats = await this.getIndexStats();

      return {
        healthy: true,
        stats,
        changeTracker: {
          lastUpdate: this.changeTracker.lastUpdate,
          processedOrders: this.changeTracker.processedOrders.size,
          updateHistory: this.changeTracker.updateHistory.length,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Full rebuild for initial setup or major changes
  async performFullRebuild(): Promise<VectorUpdateStats> {
    console.log("🔄 Starting full vector rebuild...");

    const startTime = Date.now();

    try {
      await this.initialize();

      // Clear existing vectors
      const index = this.pinecone!.index(this.indexName);
      await index.deleteAll();
      console.log("🗑️ Cleared existing vectors");

      // Fetch all orders
      const ordersData = await apiFirstDataService.getAllOrders({
        includeLineItems: true,
        includeShipments: true,
        includeFiles: true,
        pageSize: 500,
      });

      // Create and upsert all vectors
      const vectors = await this.createEnhancedVectors(ordersData.orders);
      await this.upsertVectors(vectors);

      // Update tracker
      this.changeTracker.lastUpdate = new Date().toISOString();
      this.changeTracker.lastFullRebuild = new Date().toISOString();
      this.changeTracker.processedOrders = new Set(
        ordersData.orders.map((o) => o.jobNumber)
      );
      this.changeTracker.orderHashes = new Map(
        ordersData.orders.map((order) => [
          order.jobNumber,
          this.generateOrderHash(order),
        ])
      );
      this.changeTracker.deletedOrders.clear();

      this.saveChangeTracker();

      const processingTime = Date.now() - startTime;
      const stats: VectorUpdateStats = {
        newVectors: vectors.length,
        updatedVectors: 0,
        deletedVectors: 0,
        unchangedVectors: 0,
        totalProcessed: ordersData.orders.length,
        processingTime,
        apiCalls: 1,
        embeddingTokens: this.estimateTokens(ordersData.orders),
        errors: [],
        performance: {
          averageEmbeddingTime: processingTime / vectors.length,
          averageUpsertTime: processingTime / vectors.length,
          batchSize: this.batchSize,
          throughputPerSecond: vectors.length / (processingTime / 1000),
        },
      };

      console.log(`✅ Full rebuild completed in ${processingTime}ms`);
      console.log(`📊 Created ${vectors.length} enhanced vectors`);

      return stats;
    } catch (error) {
      console.error("❌ Full rebuild failed:", error);
      throw error;
    }
  }

  // Get update history and statistics
  getUpdateHistory() {
    return {
      updateHistory: this.changeTracker.updateHistory,
      summary: {
        lastUpdate: this.changeTracker.lastUpdate,
        lastFullRebuild: this.changeTracker.lastFullRebuild,
        totalProcessedOrders: this.changeTracker.processedOrders.size,
        totalUpdates: this.changeTracker.updateHistory.length,
      },
    };
  }
}

// Export singleton instance
export const enhancedVectorPipeline = new EnhancedVectorPipeline();

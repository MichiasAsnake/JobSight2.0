// API endpoint to populate vector database
// Call this once to load all your order data into Pinecone

import { NextRequest, NextResponse } from "next/server";
import { vectorDBService, type VectorMetadata } from "@/lib/vector-db";
import { embeddingService } from "@/lib/embeddings";
import fs from "fs";
import path from "path";

// Basic interface for order data
interface Order {
  jobNumber: string;
  orderNumber?: string;
  customer?: {
    company?: string;
    customerId?: string;
  };
  description?: string;
  comment?: string;
  lineItems?: Array<{
    description?: string;
    category?: string;
    comment?: string;
  }>;
  production?: {
    productionNotes?: string[];
  };
  workflow?: {
    isRush?: boolean;
  };
  shipments?: Array<{
    shipToAddress?: {
      company?: string;
      city?: string;
      state?: string;
    };
    specialInstructions?: string;
  }>;
  metadata?: {
    tags?: string[];
    department?: string;
    complexity?: string;
  };
  status?: string;
  dateEntered?: string;
  priority?: string;
  pricing?: {
    totalDue?: number;
  };
}

export async function POST(request: NextRequest) {
  console.log("🚀 Starting Vector Database Population...");

  try {
    // Check authorization (simple protection)
    const { authorization } = await request.json().catch(() => ({}));
    if (authorization !== "populate-vectors-2024") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Load order data
    console.log("📥 Loading existing order data...");
    const dataPath = path.join(process.cwd(), "data", "orders.json");

    if (!fs.existsSync(dataPath)) {
      return NextResponse.json(
        { error: "Orders data file not found" },
        { status: 404 }
      );
    }

    const ordersData = fs.readFileSync(dataPath, "utf8");
    const orders: Order[] = JSON.parse(ordersData);
    console.log(`✅ Loaded ${orders.length} orders`);

    if (orders.length === 0) {
      return NextResponse.json(
        { error: "No orders found in data file" },
        { status: 400 }
      );
    }

    // 2. Initialize services
    await vectorDBService.initialize();
    console.log("✅ Vector database initialized");

    // 3. Process in smaller batches
    const batchSize = 25;
    const totalBatches = Math.ceil(orders.length / batchSize);
    let processedCount = 0;
    let errorCount = 0;

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(
        `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} orders)...`
      );

      try {
        // Convert orders to searchable text
        const searchTexts = batch.map((order) => {
          const parts = [
            `Job ${order.jobNumber}`,
            `Order ${order.orderNumber || order.jobNumber}`,
            `Customer ${order.customer?.company || "Unknown"}`,
            order.description || "",
            order.comment || "",
            ...(order.lineItems || []).map((item) =>
              `${item.description || ""} ${item.category || ""} ${
                item.comment || ""
              }`.trim()
            ),
            ...(order.production?.productionNotes || []),
            order.workflow?.isRush ? "rush urgent priority" : "",
            ...(order.shipments || []).map((ship) =>
              `${ship.shipToAddress?.company || ""} ${
                ship.shipToAddress?.city || ""
              } ${ship.shipToAddress?.state || ""} ${
                ship.specialInstructions || ""
              }`.trim()
            ),
            ...(order.metadata?.tags || []),
            order.metadata?.department || "",
            order.metadata?.complexity || "",
          ].filter(Boolean);

          return parts.join(" ").trim();
        });

        // Create embeddings
        console.log(
          `  🧠 Creating embeddings for ${searchTexts.length} orders...`
        );
        const embeddingResponse = await embeddingService.createBatchEmbeddings(
          searchTexts
        );
        console.log(`  ✅ Created ${embeddingResponse.processed} embeddings`);

        // Prepare vectors for upsert
        const vectors = batch.map((order, index) => {
          const metadata: VectorMetadata = {
            jobNumber: order.jobNumber,
            customerCompany: order.customer?.company || "Unknown",
            status: order.status || "Unknown",
            dateEntered: order.dateEntered || new Date().toISOString(),
            description: (order.description || "").substring(0, 500),
            orderNumber: order.orderNumber || order.jobNumber,
            dataSource: "scraped" as const,
            lastUpdated: new Date().toISOString(),
            // Add optional fields
            customerId: order.customer?.customerId
              ? Number(order.customer.customerId)
              : undefined,
            priority: order.priority,
            totalDue: order.pricing?.totalDue,
          };

          return {
            id: `order-${order.jobNumber}`,
            values: embeddingResponse.embeddings[index],
            metadata,
          };
        });

        // Upsert to Pinecone
        console.log(`  📤 Upserting ${vectors.length} vectors to Pinecone...`);
        await vectorDBService.upsertVectors(vectors);
        console.log(`  ✅ Batch ${batchNumber} complete`);

        processedCount += batch.length;
      } catch (error) {
        console.error(`  ❌ Batch ${batchNumber} failed:`, error);
        errorCount += batch.length;
      }

      // Small delay between batches
      if (batchNumber < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 4. Test the population
    console.log("🧪 Testing semantic search...");
    const testEmbedding = await embeddingService.createEmbedding(
      "embroidery patches vinyl"
    );
    const searchResults = await vectorDBService.searchSimilarOrders(
      testEmbedding,
      3
    );

    console.log(`✅ Test search found ${searchResults.length} results`);

    const testResults = searchResults.map((result) => ({
      jobNumber: result.metadata.jobNumber,
      customer: result.metadata.customerCompany,
      score: result.score,
    }));

    return NextResponse.json({
      success: true,
      message: "Vector database populated successfully!",
      stats: {
        totalOrders: orders.length,
        processed: processedCount,
        errors: errorCount,
        batches: totalBatches,
      },
      testResults,
    });
  } catch (error) {
    console.error("❌ Population failed:", error);
    return NextResponse.json(
      {
        error: "Failed to populate vector database",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

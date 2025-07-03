// Populate Vector Database Script
// Converts existing order data to embeddings and stores in Pinecone

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

async function loadOrderData() {
  try {
    // Try to load from the JSON file directly
    const dataPath = path.join(__dirname, "../data/orders.json");
    const alternativePath = path.join(__dirname, "../lib/data/orders.json");

    let filePath;
    if (fs.existsSync(dataPath)) {
      filePath = dataPath;
    } else if (fs.existsSync(alternativePath)) {
      filePath = alternativePath;
    } else {
      throw new Error("Orders JSON file not found");
    }

    const data = fs.readFileSync(filePath, "utf8");
    const orders = JSON.parse(data);
    return Array.isArray(orders) ? orders : orders.orders || [];
  } catch (error) {
    console.error("❌ Failed to load order data:", error);
    return [];
  }
}

// Simple embedding function using OpenAI directly
async function createEmbedding(text) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1024,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Simple Pinecone upsert
async function upsertToPinecone(vectors) {
  const response = await fetch(
    `https://serene-laurel-753c7lv.svc.aped-4627-b74a.pinecone.io/vectors/upsert`,
    {
      method: "POST",
      headers: {
        "Api-Key": process.env.PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vectors: vectors,
        namespace: "",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinecone API error: ${response.statusText} - ${error}`);
  }

  return await response.json();
}

// Convert order to searchable text
function orderToSearchText(order) {
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
      `${ship.shipToAddress?.company || ""} ${ship.shipToAddress?.city || ""} ${
        ship.shipToAddress?.state || ""
      } ${ship.specialInstructions || ""}`.trim()
    ),
    ...(order.metadata?.tags || []),
    order.metadata?.department || "",
    order.metadata?.complexity || "",
  ].filter(Boolean);

  return parts.join(" ").trim();
}

async function populateVectorDatabase() {
  console.log("🚀 Starting Vector Database Population...\n");

  try {
    // Check environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is required");
    }

    // 1. Load existing orders
    console.log("📥 Loading existing order data...");
    const orders = await loadOrderData();
    console.log(`✅ Loaded ${orders.length} orders\n`);

    if (orders.length === 0) {
      console.log(
        "❌ No orders found. Make sure your order data is available."
      );
      return;
    }

    // 2. Process orders in batches
    const batchSize = 25; // Smaller batches for reliability
    const totalBatches = Math.ceil(orders.length / batchSize);

    for (let i = 0; i < orders.length; i += batchSize) {
      const batch = orders.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(
        `📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} orders)...`
      );

      try {
        // Convert orders to searchable text and create embeddings
        const vectors = [];

        for (const order of batch) {
          console.log(`  🔤 Processing Job ${order.jobNumber}...`);

          const searchText = orderToSearchText(order);
          console.log(`  🧠 Creating embedding...`);
          const embedding = await createEmbedding(searchText);

          // Create metadata
          const metadata = {
            jobNumber: order.jobNumber,
            customerCompany: order.customer?.company || "Unknown",
            status: order.status || "Unknown",
            dateEntered: order.dateEntered || new Date().toISOString(),
            description: (order.description || "").substring(0, 500),
            orderNumber: order.orderNumber || order.jobNumber,
            dataSource: "scraped",
            lastUpdated: new Date().toISOString(),
          };

          // Add optional fields only if they exist
          if (order.customer?.customerId)
            metadata.customerId = order.customer.customerId;
          if (order.priority) metadata.priority = order.priority;
          if (order.pricing?.totalDue)
            metadata.totalDue = order.pricing.totalDue;

          vectors.push({
            id: `order-${order.jobNumber}`,
            values: embedding,
            metadata,
          });

          // Small delay between embeddings
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Upsert batch to Pinecone
        console.log(`  📤 Upserting ${vectors.length} vectors to Pinecone...`);
        await upsertToPinecone(vectors);
        console.log(`  ✅ Batch ${batchNumber} complete\n`);

        // Pause between batches
        if (batchNumber < totalBatches) {
          console.log("  ⏱️ Pausing 3 seconds between batches...\n");
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (error) {
        console.error(`  ❌ Batch ${batchNumber} failed:`, error);
        console.log("  🔄 Continuing with next batch...\n");
      }
    }

    // 3. Test the population
    console.log("🧪 Testing semantic search...");
    const testEmbedding = await createEmbedding("embroidery patches vinyl");

    const searchResponse = await fetch(
      `https://serene-laurel-753c7lv.svc.aped-4627-b74a.pinecone.io/query`,
      {
        method: "POST",
        headers: {
          "Api-Key": process.env.PINECONE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector: testEmbedding,
          topK: 3,
          includeMetadata: true,
          namespace: "",
        }),
      }
    );

    const searchResults = await searchResponse.json();
    console.log(
      `✅ Test search found ${searchResults.matches?.length || 0} results:`
    );

    if (searchResults.matches) {
      searchResults.matches.forEach((result, index) => {
        console.log(
          `  ${index + 1}. Job ${result.metadata?.jobNumber} - ${
            result.metadata?.customerCompany
          } (Score: ${result.score?.toFixed(3)})`
        );
      });
    }

    console.log("\n🎉 Vector Database Population Complete!");
    console.log(`📊 Total orders processed: ${orders.length}`);
    console.log("🚀 Your RAG system is now ready for semantic search!");
  } catch (error) {
    console.error("❌ Population failed:", error);
    process.exit(1);
  }
}

// Run the script
populateVectorDatabase()
  .then(() => {
    console.log("\n✅ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });

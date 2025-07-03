// Daily Vector Database Update Script
// 1. Runs fresh scrape to get latest orders
// 2. Updates vector database with new/changed orders only
// 3. Maintains data freshness for RAG system

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

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

  const data = await response.json();
  return data.data[0].embedding;
}

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

  return await response.json();
}

async function getExistingVectorIds() {
  // Query existing vectors to see what we already have
  const response = await fetch(
    `https://serene-laurel-753c7lv.svc.aped-4627-b74a.pinecone.io/describe_index_stats`,
    {
      method: "POST",
      headers: {
        "Api-Key": process.env.PINECONE_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  const stats = await response.json();
  return stats;
}

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

async function dailyVectorUpdate() {
  console.log("🚀 Starting Daily Vector Database Update...\n");

  try {
    // 1. Run fresh scrape to get latest data
    console.log("🕷️ Running fresh scrape to get latest orders...");

    try {
      execSync("npm run scrape", { stdio: "inherit" });
      console.log("✅ Fresh scrape completed\n");
    } catch (error) {
      console.warn("⚠️ Scrape failed, using existing data:", error.message);
    }

    // 2. Load current orders
    console.log("📥 Loading fresh order data...");
    const dataPath = path.join(__dirname, "../data/orders.json");

    if (!fs.existsSync(dataPath)) {
      throw new Error("Orders data file not found");
    }

    const ordersData = fs.readFileSync(dataPath, "utf8");
    const orders = JSON.parse(ordersData);
    console.log(`✅ Loaded ${orders.length} orders`);

    // 3. Load previous vector state (if exists)
    const vectorStatePath = path.join(__dirname, "../data/vector-state.json");
    let previousVectorState = {};

    if (fs.existsSync(vectorStatePath)) {
      const stateData = fs.readFileSync(vectorStatePath, "utf8");
      previousVectorState = JSON.parse(stateData);
      console.log(
        `📝 Found previous vector state with ${
          Object.keys(previousVectorState).length
        } orders`
      );
    }

    // 4. Identify new/changed orders
    const newOrChanged = [];
    const currentVectorState = {};

    for (const order of orders) {
      const orderHash = JSON.stringify({
        jobNumber: order.jobNumber,
        status: order.status,
        description: order.description,
        lastUpdated: order.metadata?.lastUpdated || order.dateEntered,
      });

      currentVectorState[order.jobNumber] = orderHash;

      // Check if this order is new or changed
      if (
        !previousVectorState[order.jobNumber] ||
        previousVectorState[order.jobNumber] !== orderHash
      ) {
        newOrChanged.push(order);
      }
    }

    console.log(
      `🔍 Found ${newOrChanged.length} new or changed orders to update\n`
    );

    if (newOrChanged.length === 0) {
      console.log("✅ No updates needed - vector database is current!");
      return;
    }

    // 5. Process new/changed orders
    const batchSize = 25;
    const totalBatches = Math.ceil(newOrChanged.length / batchSize);

    for (let i = 0; i < newOrChanged.length; i += batchSize) {
      const batch = newOrChanged.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      console.log(
        `📦 Updating batch ${batchNumber}/${totalBatches} (${batch.length} orders)...`
      );

      const vectors = [];

      for (const order of batch) {
        const searchText = orderToSearchText(order);
        const embedding = await createEmbedding(searchText);

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

        if (order.customer?.customerId)
          metadata.customerId = order.customer.customerId;
        if (order.priority) metadata.priority = order.priority;
        if (order.pricing?.totalDue) metadata.totalDue = order.pricing.totalDue;

        vectors.push({
          id: `order-${order.jobNumber}`,
          values: embedding,
          metadata,
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await upsertToPinecone(vectors);
      console.log(`  ✅ Batch ${batchNumber} updated`);

      if (batchNumber < totalBatches) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // 6. Save new vector state
    fs.writeFileSync(
      vectorStatePath,
      JSON.stringify(currentVectorState, null, 2)
    );
    console.log("💾 Updated vector state saved");

    // 7. Test the updates
    console.log("\n🧪 Testing updated semantic search...");
    const testEmbedding = await createEmbedding("rush urgent priority orders");

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
      `✅ Test search found ${searchResults.matches?.length || 0} results`
    );

    console.log("\n🎉 Daily Vector Update Complete!");
    console.log(`📊 Updated ${newOrChanged.length} orders`);
    console.log(
      `🕒 Vector database is now current as of: ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("❌ Daily update failed:", error);
    process.exit(1);
  }
}

// Run the update
dailyVectorUpdate()
  .then(() => {
    console.log("\n✅ Daily update completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Daily update failed:", error);
    process.exit(1);
  });

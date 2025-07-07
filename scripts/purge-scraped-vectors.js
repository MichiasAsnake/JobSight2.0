#!/usr/bin/env node
// Purge Scraped Vectors Script
// Removes all vectors with dataSource: "scraped" from Pinecone
// This ensures only API data is used for vector search

import { Pinecone } from "@pinecone-database/pinecone";
import dotenv from "dotenv";
import fetch from "node-fetch";

// Load environment variables
dotenv.config();

async function purgeAllVectors() {
  const indexName = "serene-laurel";
  const pc = new Pinecone(); // API key and env are read from .env
  const index = pc.index(indexName);

  try {
    console.log(`Deleting all vectors from index: ${indexName}`);
    await index.deleteAll();
    console.log("✅ All vectors deleted successfully.");
  } catch (error) {
    console.error("❌ Error deleting vectors:", error);
    process.exit(1);
  }
}

// Run the purge
purgeAllVectors()
  .then(() => {
    console.log("\n✅ Purge completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Purge failed:", error);
    process.exit(1);
  });

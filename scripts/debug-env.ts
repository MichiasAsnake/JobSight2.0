#!/usr/bin/env tsx
// Debug Environment Variables

// Load environment variables FIRST
import dotenv from "dotenv";
dotenv.config();

console.log("🔍 Environment Variables Debug:");
console.log(
  "PINECONE_API_KEY:",
  process.env.PINECONE_API_KEY ? "✅ Set" : "❌ Missing"
);
console.log(
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"
);
console.log(
  "OMS_API_BASE_URL:",
  process.env.OMS_API_BASE_URL ? "✅ Set" : "❌ Missing"
);
console.log(
  "OMS_AUTH_COOKIES:",
  process.env.OMS_AUTH_COOKIES ? "✅ Set" : "❌ Missing"
);
console.log(
  "OMS_AUTH_COOKIE:",
  process.env.OMS_AUTH_COOKIE ? "✅ Set" : "❌ Missing"
);
console.log(
  "AUTH_COOKIES:",
  process.env.AUTH_COOKIES ? "✅ Set" : "❌ Missing"
);
console.log("AUTH_COOKIE:", process.env.AUTH_COOKIE ? "✅ Set" : "❌ Missing");

// Show first few characters of each value (for security)
console.log("\n📋 Environment Variable Values (first 20 chars):");
console.log(
  "PINECONE_API_KEY:",
  process.env.PINECONE_API_KEY?.substring(0, 20) + "..."
);
console.log(
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY?.substring(0, 20) + "..."
);
console.log("OMS_API_BASE_URL:", process.env.OMS_API_BASE_URL);
console.log(
  "OMS_AUTH_COOKIES:",
  process.env.OMS_AUTH_COOKIES?.substring(0, 50) + "..."
);
console.log(
  "OMS_AUTH_COOKIE:",
  process.env.OMS_AUTH_COOKIE?.substring(0, 50) + "..."
);
console.log(
  "AUTH_COOKIES:",
  process.env.AUTH_COOKIES?.substring(0, 50) + "..."
);
console.log("AUTH_COOKIE:", process.env.AUTH_COOKIE?.substring(0, 50) + "...");

console.log("\n🔧 All Environment Variables:");
Object.keys(process.env).forEach((key) => {
  if (
    key.includes("OMS") ||
    key.includes("PINECONE") ||
    key.includes("OPENAI") ||
    key.includes("AUTH")
  ) {
    console.log(`${key}: ${process.env[key]?.substring(0, 30)}...`);
  }
});

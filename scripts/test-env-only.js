// Simple environment variable test
require("dotenv").config();

console.log("🔍 Environment Variables Test:");
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

console.log("\n📋 Values (first 30 chars):");
console.log(
  "PINECONE_API_KEY:",
  process.env.PINECONE_API_KEY?.substring(0, 30) + "..."
);
console.log(
  "OPENAI_API_KEY:",
  process.env.OPENAI_API_KEY?.substring(0, 30) + "..."
);
console.log("OMS_API_BASE_URL:", process.env.OMS_API_BASE_URL);
console.log(
  "OMS_AUTH_COOKIES:",
  process.env.OMS_AUTH_COOKIES?.substring(0, 50) + "..."
);

require("dotenv").config();
const OpenAI = require("openai");

async function testOpenAI() {
  console.log("🔧 Testing OpenAI Configuration...");

  // Check environment variables
  console.log("📋 API Key present:", !!process.env.OPENAI_API_KEY);
  console.log(
    "📋 API Key starts with:",
    process.env.OPENAI_API_KEY?.substring(0, 7)
  );

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    console.log("🚀 Testing embedding creation...");
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: "test embedding",
      dimensions: 1024,
    });

    console.log("✅ Embedding test successful!");
    console.log("📊 Response length:", response.data[0].embedding.length);
    console.log("📊 Token usage:", response.usage.total_tokens);
  } catch (error) {
    console.error("❌ Embedding test failed:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error type:", error.type);
    console.error("Full error:", error);
  }

  try {
    console.log("🚀 Testing chat completion...");
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello, this is a test." }],
      max_tokens: 50,
    });

    console.log("✅ Chat test successful!");
    console.log("📝 Response:", chatResponse.choices[0].message.content);
  } catch (error) {
    console.error("❌ Chat test failed:");
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error type:", error.type);
  }
}

testOpenAI().catch(console.error);

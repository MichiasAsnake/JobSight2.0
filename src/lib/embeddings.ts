// OpenAI Embeddings Service
// Handles text-to-vector conversion for semantic search

import OpenAI from "openai";

export interface EmbeddingResponse {
  embedding: number[];
  tokens: number;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  totalTokens: number;
  processed: number;
}

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private model: string;
  private maxTokens: number;
  private dimensions: number; // Matching user's Pinecone index
  private maxRetries: number;
  private retryDelay: number;

  constructor() {
    this.model = "text-embedding-3-small";
    this.maxTokens = 8000; // Model limit
    this.dimensions = 1024; // Updated to match user's Pinecone index
    this.maxRetries = 3; // Custom retry logic
    this.retryDelay = 1000; // 1 second base delay
  }

  // Lazy initialization of OpenAI client
  private getOpenAI(): OpenAI {
    if (!this.openai) {
      const apiKey = process.env.OPENAI_API_KEY;
      console.log("🔑 Debug: Checking OpenAI API key...");
      console.log("🔑 Debug: OPENAI_API_KEY exists:", !!apiKey);
      console.log(
        "🔑 Debug: OPENAI_API_KEY length:",
        apiKey ? apiKey.length : 0
      );
      console.log(
        "🔑 Debug: OPENAI_API_KEY starts with:",
        apiKey ? apiKey.substring(0, 7) + "..." : "undefined"
      );

      if (!apiKey) {
        throw new Error("OPENAI_API_KEY environment variable is not set");
      }

      this.openai = new OpenAI({
        apiKey: apiKey,
        timeout: 30000, // 30 second timeout
        maxRetries: 2, // Built-in retries
      });
      console.log("✅ Debug: OpenAI client created successfully");
    }
    return this.openai;
  }

  // Create a single embedding with retry logic
  async createEmbedding(text: string): Promise<number[]> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Truncate text if too long
        const processedText = this.truncateText(text, this.maxTokens);

        console.log(
          `🔧 Attempt ${attempt}/${this.maxRetries} - Creating embedding...`
        );

        const openai = this.getOpenAI();
        const response = await openai.embeddings.create({
          model: this.model,
          input: processedText,
          dimensions: this.dimensions, // Specify dimensions to match Pinecone index
        });

        console.log(`✅ Embedding created successfully on attempt ${attempt}`);
        return response.data[0].embedding;
      } catch (error: any) {
        lastError = error;
        console.error(
          `❌ Attempt ${attempt}/${this.maxRetries} failed:`,
          error.message
        );

        // Check if it's a network/connection error
        const isNetworkError =
          error.message?.includes("Connection error") ||
          error.message?.includes("ENOTFOUND") ||
          error.message?.includes("fetch failed") ||
          error.code === "ENOTFOUND";

        if (!isNetworkError || attempt === this.maxRetries) {
          // If it's not a network error or we've exhausted retries, throw immediately
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.error("❌ All embedding attempts failed:", lastError?.message);
    throw new Error(
      `Embedding creation failed after ${this.maxRetries} attempts: ${
        lastError?.message || "Unknown error"
      }`
    );
  }

  // Create multiple embeddings in batch
  async createBatchEmbeddings(
    texts: string[]
  ): Promise<BatchEmbeddingResponse> {
    try {
      // Process texts and estimate tokens
      const processedTexts = texts.map((text) =>
        this.truncateText(text, this.maxTokens)
      );

      // Split into smaller batches to respect API limits
      const batchSize = 50; // Reduced from 100 to avoid connection issues
      const batches = [];

      for (let i = 0; i < processedTexts.length; i += batchSize) {
        batches.push(processedTexts.slice(i, i + batchSize));
      }

      let allEmbeddings: number[][] = [];
      let totalTokens = 0;

      for (const batch of batches) {
        let batchSuccess = false;
        let batchAttempt = 1;

        while (!batchSuccess && batchAttempt <= this.maxRetries) {
          try {
            console.log(
              `🔧 Processing batch ${batches.indexOf(batch) + 1}/${
                batches.length
              }, attempt ${batchAttempt}`
            );

            const openai = this.getOpenAI();
            const response = await openai.embeddings.create({
              model: this.model,
              input: batch,
              dimensions: this.dimensions, // Specify dimensions
            });

            const batchEmbeddings = response.data.map((item) => item.embedding);
            allEmbeddings = allEmbeddings.concat(batchEmbeddings);
            totalTokens += response.usage.total_tokens;
            batchSuccess = true;

            console.log(
              `✅ Batch ${batches.indexOf(batch) + 1} completed successfully`
            );
          } catch (error: any) {
            console.error(
              `❌ Batch ${
                batches.indexOf(batch) + 1
              } attempt ${batchAttempt} failed:`,
              error.message
            );
            batchAttempt++;

            if (batchAttempt <= this.maxRetries) {
              const delay = this.retryDelay * Math.pow(2, batchAttempt - 1);
              console.log(`⏳ Waiting ${delay}ms before batch retry...`);
              await new Promise((resolve) => setTimeout(resolve, delay));
            }
          }
        }

        if (!batchSuccess) {
          throw new Error(
            `Batch processing failed after ${this.maxRetries} attempts`
          );
        }

        // Rate limiting pause between successful batches
        if (batches.length > 1) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // Increased delay
        }
      }

      return {
        embeddings: allEmbeddings,
        totalTokens,
        processed: allEmbeddings.length,
      };
    } catch (error) {
      console.error("❌ Failed to create batch embeddings:", error);
      throw new Error(
        `Batch embedding creation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Estimate token count for text
  estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  // Truncate text to fit within token limits
  private truncateText(text: string, maxTokens: number): string {
    const estimatedTokens = this.estimateTokens(text);

    if (estimatedTokens <= maxTokens) {
      return text;
    }

    // Truncate to approximately fit within token limit
    const targetLength = Math.floor(maxTokens * 4 * 0.9); // 90% safety margin
    return text.substring(0, targetLength) + "...";
  }

  // Get embedding dimensions
  getDimensions(): number {
    return this.dimensions;
  }

  // Health check with retry
  async healthCheck(): Promise<{
    healthy: boolean;
    model: string;
    dimensions: number;
    error?: string;
  }> {
    try {
      // Test with a simple embedding
      const testEmbedding = await this.createEmbedding("health check test");

      return {
        healthy: testEmbedding.length === this.dimensions,
        model: this.model,
        dimensions: testEmbedding.length,
      };
    } catch (error) {
      return {
        healthy: false,
        model: this.model,
        dimensions: this.dimensions,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Create fresh instance (avoid singleton issues)
  static createFreshInstance(): EmbeddingService {
    return new EmbeddingService();
  }

  // Initialize the service
  async initialize() {
    // Warm up with a test embedding to verify connection
    try {
      await this.createEmbedding("test");
      console.log("✅ Embedding service initialized successfully");
    } catch (error) {
      console.warn("⚠️ Embedding service initialization test failed:", error);
    }
  }
}

// Create singleton instance
export const embeddingService = new EmbeddingService();

// Initialize the service
async function initializeEmbeddings() {
  // Warm up with a test embedding to verify connection
  try {
    await embeddingService.createEmbedding("test");
    console.log("✅ Embedding service initialized successfully");
  } catch (error) {
    console.warn("⚠️ Embedding service initialization test failed:", error);
  }
}

// Add initialize method to the service class
EmbeddingService.prototype.initialize = async function () {
  return initializeEmbeddings();
};

// Export factory function for fresh instances
export const createEmbeddingService = () =>
  EmbeddingService.createFreshInstance();

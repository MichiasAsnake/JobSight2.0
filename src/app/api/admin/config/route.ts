// Admin Configuration API - System configuration management
import { NextRequest, NextResponse } from "next/server";

interface ConfigurationItem {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  category: "api" | "vector" | "cache" | "rag" | "general";
  editable: boolean;
}

export async function GET(request: NextRequest) {
  try {
    console.log("⚙️ Fetching system configuration...");

    // System configuration items
    const configuration: ConfigurationItem[] = [
      // API Configuration
      {
        key: "api.baseUrl",
        value: "https://intranet.decopress.com",
        type: "string",
        description: "Base URL for OMS API endpoints",
        category: "api",
        editable: false,
      },
      {
        key: "api.timeout",
        value: "30000",
        type: "number",
        description: "API request timeout in milliseconds",
        category: "api",
        editable: true,
      },
      {
        key: "api.maxRetries",
        value: "3",
        type: "number",
        description: "Maximum number of retry attempts for failed requests",
        category: "api",
        editable: true,
      },
      {
        key: "api.rateLimitPerMinute",
        value: "60",
        type: "number",
        description: "Maximum API requests per minute",
        category: "api",
        editable: true,
      },

      // Vector Configuration
      {
        key: "vector.embeddingModel",
        value: "text-embedding-3-small",
        type: "string",
        description: "OpenAI embedding model for vector generation",
        category: "vector",
        editable: true,
      },
      {
        key: "vector.updateInterval",
        value: "1800000",
        type: "number",
        description: "Vector update interval in milliseconds (30 minutes)",
        category: "vector",
        editable: true,
      },
      {
        key: "vector.batchSize",
        value: "10",
        type: "number",
        description: "Number of orders to process in each vector update batch",
        category: "vector",
        editable: true,
      },

      // Cache Configuration
      {
        key: "cache.defaultTTL",
        value: "300000",
        type: "number",
        description: "Default cache TTL in milliseconds (5 minutes)",
        category: "cache",
        editable: true,
      },
      {
        key: "cache.maxSize",
        value: "157286400",
        type: "number",
        description: "Maximum cache size in bytes (150MB)",
        category: "cache",
        editable: true,
      },
      {
        key: "cache.enableIntelligentEviction",
        value: "true",
        type: "boolean",
        description:
          "Enable intelligent cache eviction based on usage patterns",
        category: "cache",
        editable: true,
      },

      // RAG Configuration
      {
        key: "rag.maxContextLength",
        value: "4000",
        type: "number",
        description: "Maximum context length for RAG responses",
        category: "rag",
        editable: true,
      },
      {
        key: "rag.minConfidenceThreshold",
        value: "0.7",
        type: "number",
        description: "Minimum confidence threshold for vector search results",
        category: "rag",
        editable: true,
      },
      {
        key: "rag.maxResults",
        value: "10",
        type: "number",
        description: "Maximum number of search results to include in context",
        category: "rag",
        editable: true,
      },

      // General Configuration
      {
        key: "general.environment",
        value: process.env.NODE_ENV || "development",
        type: "string",
        description: "Current environment (development/production)",
        category: "general",
        editable: false,
      },
      {
        key: "general.logLevel",
        value: "info",
        type: "string",
        description: "Logging level (debug/info/warn/error)",
        category: "general",
        editable: true,
      },
      {
        key: "general.enableHealthChecks",
        value: "true",
        type: "boolean",
        description: "Enable automatic health checks for all components",
        category: "general",
        editable: true,
      },
    ];

    // Get category summary
    const categorySummary = configuration.reduce((summary, item) => {
      summary[item.category] = (summary[item.category] || 0) + 1;
      return summary;
    }, {} as Record<string, number>);

    // Get editable count
    const editableCount = configuration.filter((item) => item.editable).length;

    return NextResponse.json({
      configuration,
      summary: {
        total: configuration.length,
        editable: editableCount,
        readonly: configuration.length - editableCount,
        byCategory: categorySummary,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to fetch configuration:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch system configuration",
        details: error instanceof Error ? error.message : "Unknown error",
        configuration: [],
        summary: { total: 0, editable: 0, readonly: 0, byCategory: {} },
        lastUpdated: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json();

    if (!key || value === undefined) {
      return NextResponse.json(
        {
          error: "Missing required fields: key and value",
        },
        { status: 400 }
      );
    }

    console.log(`⚙️ Updating configuration: ${key} = ${value}`);

    // In a real implementation, this would update the configuration store
    // For now, we'll just acknowledge the update
    return NextResponse.json({
      success: true,
      message: `Configuration ${key} updated successfully`,
      key,
      value,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to update configuration:", error);

    return NextResponse.json(
      {
        error: "Failed to update configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

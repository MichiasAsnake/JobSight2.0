// Enhanced RAG Pipeline - Modern RAG with comprehensive API data context
// Integrates with intelligent query router and enhanced vector pipeline

import OpenAI from "openai";
import { intelligentQueryRouter, RoutedQueryResult } from "./query-router";
import {
  enhancedVectorPipeline,
  EnhancedSearchResult,
} from "./enhanced-vector-pipeline";
import { apiFirstDataService, ModernOrder } from "./api-first-data-service";
import { advancedCacheService } from "./advanced-cache-service";
import { embeddingService } from "./embeddings";

export interface EnhancedRAGResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: {
    orders?: ModernOrder[];
    vectorResults?: EnhancedSearchResult[];
    apiCalls?: number;
    strategy: "api" | "vector" | "hybrid";
  };
  processingTime: number;
  dataFreshness: "fresh" | "cached" | "stale";
  contextQuality: number; // 0-1 score
  metadata: {
    totalOrdersAnalyzed: number;
    llmTokensUsed: number;
    cacheHitsUsed: number;
    reasoning: string;
    recommendations?: string[];
  };
}

export interface EnhancedRAGQuery {
  userQuery: string;
  context?: {
    includeLineItems?: boolean;
    includeShipments?: boolean;
    includeFiles?: boolean;
    includeAnalytics?: boolean;
    maxOrders?: number;
    preferFreshData?: boolean;
  };
  filters?: {
    customer?: string;
    status?: string;
    dateRange?: { start: string; end: string };
    processes?: string[];
    materials?: string[];
  };
}

export interface RAGContext {
  orders: ModernOrder[];
  vectorResults: EnhancedSearchResult[];
  routingInfo: RoutedQueryResult;
  enrichmentData: {
    totalLineItems: number;
    totalShipments: number;
    totalFiles: number;
    customerBreakdown: Record<string, number>;
    statusBreakdown: Record<string, number>;
    processBreakdown: Record<string, number>;
    valueAnalysis: {
      totalValue: number;
      averageValue: number;
      rushOrders: number;
      lateOrders: number;
    };
  };
}

export class EnhancedRAGPipeline {
  private openai: OpenAI;
  private systemPrompt: string;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      timeout: 45000, // 45 second timeout for complex queries
      maxRetries: 2,
    });

    this.systemPrompt = this.buildSystemPrompt();
  }

  // Main enhanced RAG query method
  async queryWithContext(query: EnhancedRAGQuery): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      console.log(`🧠 Processing enhanced RAG query: "${query.userQuery}"`);

      // Step 1: Check advanced cache first
      const cacheKey = this.generateCacheKey(query);
      const cachedResult = await advancedCacheService.get<EnhancedRAGResult>(
        cacheKey
      );

      if (
        cachedResult &&
        this.isCacheValid(cachedResult, query.context?.preferFreshData)
      ) {
        console.log("💾 Returning cached RAG result");
        return {
          ...cachedResult,
          processingTime: Date.now() - startTime,
          dataFreshness: "cached",
        };
      }

      // Step 2: Use intelligent query router for smart data retrieval
      const routingResult = await intelligentQueryRouter.routeQuery(
        query.userQuery,
        {
          userPreferences: {
            preferFreshData: query.context?.preferFreshData,
            includeAnalytics: query.context?.includeAnalytics,
            maxResponseTime: 30000,
          },
        }
      );

      // Step 3: Build comprehensive context from routing result
      const ragContext = await this.buildEnhancedContext(routingResult, query);

      // Step 4: Assess context quality and determine confidence
      const contextQuality = this.assessContextQuality(ragContext);

      if (contextQuality < 0.3) {
        console.log("⚠️ Low context quality, attempting context enrichment...");
        await this.enrichContext(ragContext, query);
      }

      // Step 5: Generate enhanced response using rich context
      const response = await this.generateEnhancedResponse(
        query.userQuery,
        ragContext
      );

      // Step 6: Calculate final confidence and prepare result
      const confidence = this.calculateOverallConfidence(
        contextQuality,
        response,
        ragContext
      );

      const result: EnhancedRAGResult = {
        answer: response.answer,
        confidence,
        sources: {
          orders: ragContext.orders,
          vectorResults: ragContext.vectorResults,
          apiCalls: routingResult.performanceMetrics.apiCalls,
          strategy: routingResult.strategy,
        },
        processingTime: Date.now() - startTime,
        dataFreshness: routingResult.dataFreshness,
        contextQuality,
        metadata: {
          totalOrdersAnalyzed: ragContext.orders.length,
          llmTokensUsed: response.tokensUsed || 0,
          cacheHitsUsed: routingResult.performanceMetrics.cacheHits,
          reasoning: this.generateReasoning(ragContext, routingResult),
          recommendations: this.generateRecommendations(ragContext, query),
        },
      };

      // Step 7: Cache result for future use
      await this.cacheResult(cacheKey, result, query);

      console.log(
        `✅ Enhanced RAG completed in ${result.processingTime}ms (confidence: ${confidence})`
      );
      return result;
    } catch (error) {
      console.error("❌ Enhanced RAG pipeline failed:", error);

      // Return fallback result
      return {
        answer: `I encountered an error processing your query: ${error.message}. Please try rephrasing your question or contact support.`,
        confidence: "low",
        sources: { strategy: "vector" },
        processingTime: Date.now() - startTime,
        dataFreshness: "stale",
        contextQuality: 0,
        metadata: {
          totalOrdersAnalyzed: 0,
          llmTokensUsed: 0,
          cacheHitsUsed: 0,
          reasoning: "Error occurred during processing",
        },
      };
    }
  }

  // Build comprehensive context from routing result
  private async buildEnhancedContext(
    routingResult: RoutedQueryResult,
    query: EnhancedRAGQuery
  ): Promise<RAGContext> {
    const orders: ModernOrder[] = routingResult.results.orders || [];
    const vectorResults: EnhancedSearchResult[] =
      routingResult.results.vectorResults || [];

    // Calculate enrichment data
    const enrichmentData = {
      totalLineItems: orders.reduce(
        (sum, order) => sum + order.lineItems.length,
        0
      ),
      totalShipments: orders.reduce(
        (sum, order) => sum + order.shipments.length,
        0
      ),
      totalFiles: orders.reduce((sum, order) => sum + order.files.length, 0),
      customerBreakdown: this.calculateCustomerBreakdown(orders),
      statusBreakdown: this.calculateStatusBreakdown(orders),
      processBreakdown: this.calculateProcessBreakdown(orders),
      valueAnalysis: this.calculateValueAnalysis(orders),
    };

    return {
      orders,
      vectorResults,
      routingInfo: routingResult,
      enrichmentData,
    };
  }

  // Generate enhanced response using comprehensive context
  private async generateEnhancedResponse(
    userQuery: string,
    context: RAGContext
  ): Promise<{ answer: string; tokensUsed?: number }> {
    // Prepare rich context text
    const contextText = this.formatEnhancedContext(context);

    // Create specialized prompt based on query type
    const prompt = this.createSpecializedPrompt(userQuery, context);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: this.systemPrompt },
          { role: "user", content: prompt },
          {
            role: "assistant",
            content:
              "I'll analyze the order data and provide a comprehensive answer based on the available information.",
          },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nQuestion: ${userQuery}`,
          },
        ],
        temperature: 0.2, // Lower temperature for more consistent responses
        max_tokens: 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I couldn't generate a response.";
      const tokensUsed = response.usage?.total_tokens || 0;

      return { answer, tokensUsed };
    } catch (error) {
      console.error("❌ OpenAI API call failed:", error);

      // Fallback to local response generation
      return this.generateLocalResponse(userQuery, context);
    }
  }

  // Format enhanced context with rich API data
  private formatEnhancedContext(context: RAGContext): string {
    const sections: string[] = [];

    // Orders section
    if (context.orders.length > 0) {
      sections.push("## Order Details");
      context.orders.slice(0, 10).forEach((order, index) => {
        sections.push(`\n### Order ${index + 1}: Job #${order.jobNumber}`);
        sections.push(`Customer: ${order.customer.company}`);
        sections.push(`Status: ${order.status.master}`);
        sections.push(`Description: ${order.description}`);
        sections.push(`Due Date: ${order.dates.dateDue}`);
        sections.push(
          `Value: $${order.financial?.totalDue?.toLocaleString() || "N/A"}`
        );

        // Line items
        if (order.lineItems.length > 0) {
          sections.push(`Line Items (${order.lineItems.length}):`);
          order.lineItems.slice(0, 3).forEach((item) => {
            sections.push(`  - ${item.description} (Qty: ${item.quantity})`);
          });
        }

        // Production details
        if (order.production.processes.length > 0) {
          sections.push(
            `Processes: ${order.production.processes
              .map((p) => p.code)
              .join(", ")}`
          );
        }

        // Special flags
        const flags = [];
        if (order.production.timeSensitive) flags.push("Rush");
        if (order.production.mustDate) flags.push("Must Date");
        if (order.production.isReprint) flags.push("Reprint");
        if (flags.length > 0) {
          sections.push(`Flags: ${flags.join(", ")}`);
        }
      });
    }

    // Analytics section
    if (context.enrichmentData) {
      sections.push("\n## Summary Analytics");
      sections.push(`Total Orders Analyzed: ${context.orders.length}`);
      sections.push(
        `Total Line Items: ${context.enrichmentData.totalLineItems}`
      );
      sections.push(`Total Files: ${context.enrichmentData.totalFiles}`);
      sections.push(
        `Total Value: $${context.enrichmentData.valueAnalysis.totalValue.toLocaleString()}`
      );
      sections.push(
        `Rush Orders: ${context.enrichmentData.valueAnalysis.rushOrders}`
      );
      sections.push(
        `Late Orders: ${context.enrichmentData.valueAnalysis.lateOrders}`
      );

      // Customer breakdown
      if (Object.keys(context.enrichmentData.customerBreakdown).length > 0) {
        sections.push("\n### Top Customers:");
        Object.entries(context.enrichmentData.customerBreakdown)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([customer, count]) => {
            sections.push(`  - ${customer}: ${count} orders`);
          });
      }

      // Status breakdown
      if (Object.keys(context.enrichmentData.statusBreakdown).length > 0) {
        sections.push("\n### Status Distribution:");
        Object.entries(context.enrichmentData.statusBreakdown)
          .sort((a, b) => b[1] - a[1])
          .forEach(([status, count]) => {
            sections.push(`  - ${status}: ${count} orders`);
          });
      }
    }

    // Vector similarity section
    if (context.vectorResults.length > 0) {
      sections.push("\n## Similar Orders Found");
      context.vectorResults.slice(0, 5).forEach((result, index) => {
        sections.push(
          `${index + 1}. Job #${result.metadata.jobNumber} (${
            result.metadata.customerCompany
          }) - Similarity: ${(result.score * 100).toFixed(1)}%`
        );
        if (result.highlights) {
          sections.push(`   Highlights: ${result.highlights.join(", ")}`);
        }
      });
    }

    // Data strategy info
    sections.push(
      `\n## Data Source: ${context.routingInfo.strategy.toUpperCase()} strategy used`
    );
    sections.push(`Data Freshness: ${context.routingInfo.dataFreshness}`);
    if (context.routingInfo.fallbacksUsed?.length > 0) {
      sections.push(
        `Fallbacks: ${context.routingInfo.fallbacksUsed.join(", ")}`
      );
    }

    return sections.join("\n");
  }

  // Create specialized prompts based on query type and context
  private createSpecializedPrompt(
    userQuery: string,
    context: RAGContext
  ): string {
    const queryLower = userQuery.toLowerCase();

    if (
      queryLower.includes("how many") ||
      queryLower.includes("count") ||
      queryLower.includes("total")
    ) {
      return `You are analyzing order data to answer a quantitative question. Focus on providing accurate counts, totals, and statistical analysis. Use the enrichment data for quick summaries and dive into individual orders for detailed breakdowns.`;
    }

    if (
      queryLower.includes("similar") ||
      queryLower.includes("like") ||
      queryLower.includes("compare")
    ) {
      return `You are helping find similar orders or make comparisons. Pay special attention to the vector similarity scores and highlights. Focus on identifying patterns, similarities, and differences in the order data.`;
    }

    if (queryLower.includes("customer") || queryLower.includes("client")) {
      return `You are analyzing customer-related information. Focus on customer names, order patterns, and customer-specific details. Use the customer breakdown data for summaries.`;
    }

    if (
      queryLower.includes("status") ||
      queryLower.includes("progress") ||
      queryLower.includes("late") ||
      queryLower.includes("rush")
    ) {
      return `You are analyzing order status and progress information. Focus on order statuses, due dates, rush flags, and delivery timelines. Use the status breakdown and value analysis data.`;
    }

    return `You are a knowledgeable assistant helping analyze printing and manufacturing order data. Provide accurate, helpful information based on the available order details, line items, and analytics.`;
  }

  // Calculate helper methods for enrichment data
  private calculateCustomerBreakdown(
    orders: ModernOrder[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};
    orders.forEach((order) => {
      const customer = order.customer.company;
      breakdown[customer] = (breakdown[customer] || 0) + 1;
    });
    return breakdown;
  }

  private calculateStatusBreakdown(
    orders: ModernOrder[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};
    orders.forEach((order) => {
      const status = order.status.master;
      breakdown[status] = (breakdown[status] || 0) + 1;
    });
    return breakdown;
  }

  private calculateProcessBreakdown(
    orders: ModernOrder[]
  ): Record<string, number> {
    const breakdown: Record<string, number> = {};
    orders.forEach((order) => {
      order.production.processes.forEach((process) => {
        breakdown[process.code] = (breakdown[process.code] || 0) + 1;
      });
    });
    return breakdown;
  }

  private calculateValueAnalysis(orders: ModernOrder[]) {
    const totalValue = orders.reduce(
      (sum, order) => sum + (order.financial?.totalDue || 0),
      0
    );
    const averageValue = orders.length > 0 ? totalValue / orders.length : 0;
    const rushOrders = orders.filter(
      (order) => order.production.timeSensitive
    ).length;
    const lateOrders = orders.filter(
      (order) => order.dates.daysToDueDate < 0
    ).length;

    return { totalValue, averageValue, rushOrders, lateOrders };
  }

  // Assessment and optimization methods
  private assessContextQuality(context: RAGContext): number {
    let score = 0.5; // Base score

    // Order data quality
    if (context.orders.length > 0) {
      score += 0.2;

      // Rich data bonus
      if (context.enrichmentData.totalLineItems > 0) score += 0.1;
      if (context.enrichmentData.totalFiles > 0) score += 0.05;
      if (context.enrichmentData.totalShipments > 0) score += 0.05;
    }

    // Vector results quality
    if (context.vectorResults.length > 0) {
      const avgScore =
        context.vectorResults.reduce((sum, r) => sum + r.score, 0) /
        context.vectorResults.length;
      score += avgScore * 0.2;
    }

    // Strategy bonus
    if (context.routingInfo.strategy === "hybrid") score += 0.1;
    if (context.routingInfo.confidence > 0.8) score += 0.1;

    return Math.min(score, 1.0);
  }

  private calculateOverallConfidence(
    contextQuality: number,
    response: { answer: string },
    context: RAGContext
  ): "high" | "medium" | "low" {
    let score = contextQuality;

    // Response quality indicators
    if (response.answer.length > 100) score += 0.1;
    if (response.answer.includes("$") || response.answer.includes("#"))
      score += 0.05; // Contains specific data
    if (context.orders.length > 0) score += 0.1;
    if (context.routingInfo.confidence > 0.7) score += 0.1;

    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  }

  private async enrichContext(
    context: RAGContext,
    query: EnhancedRAGQuery
  ): Promise<void> {
    // Try to get more data if context is poor
    if (context.orders.length === 0 && query.userQuery.length > 10) {
      console.log("🔍 Attempting context enrichment with broader search...");

      try {
        // Extract key terms and try a broader vector search
        const keyTerms = this.extractKeyTerms(query.userQuery);
        const broadResults = await enhancedVectorPipeline.searchSimilarOrders(
          keyTerms.join(" "),
          {
            topK: 15,
            filters: query.filters,
          }
        );

        context.vectorResults = broadResults;
        console.log(
          `📈 Enriched context with ${broadResults.length} additional vector results`
        );
      } catch (error) {
        console.warn("⚠️ Context enrichment failed:", error);
      }
    }
  }

  private extractKeyTerms(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "what",
            "where",
            "when",
            "how",
            "why",
            "show",
            "find",
            "search",
          ].includes(word)
      )
      .slice(0, 5);
  }

  // Cache management
  private generateCacheKey(query: EnhancedRAGQuery): string {
    const queryHash = JSON.stringify({
      query: query.userQuery.toLowerCase(),
      context: query.context,
      filters: query.filters,
    });
    return `enhanced-rag:${Buffer.from(queryHash)
      .toString("base64")
      .substring(0, 20)}`;
  }

  private isCacheValid(
    cachedResult: EnhancedRAGResult,
    preferFreshData?: boolean
  ): boolean {
    if (preferFreshData && cachedResult.dataFreshness !== "fresh") {
      return false;
    }

    // Consider cache valid if it's recent and high quality
    return (
      cachedResult.contextQuality > 0.6 && cachedResult.confidence !== "low"
    );
  }

  private async cacheResult(
    cacheKey: string,
    result: EnhancedRAGResult,
    query: EnhancedRAGQuery
  ): Promise<void> {
    if (result.confidence !== "low" && result.contextQuality > 0.4) {
      await advancedCacheService.set(cacheKey, result, {
        ttl: query.context?.preferFreshData ? 5 * 60 * 1000 : 20 * 60 * 1000,
        tags: [
          "enhanced-rag",
          `confidence:${result.confidence}`,
          `strategy:${result.sources.strategy}`,
        ],
        metadata: {
          source: "enhanced-rag-pipeline",
          confidence: result.contextQuality,
          freshness: result.dataFreshness,
        },
      });
    }
  }

  // Utility methods
  private buildSystemPrompt(): string {
    return `You are an expert assistant for a printing and manufacturing order management system. You have access to comprehensive order data including:

- Job numbers, customer information, and order details
- Line items with quantities, descriptions, and specifications  
- Production processes, materials, and workflow information
- Shipment and delivery details
- File attachments and documentation
- Financial information and pricing
- Status tracking and due dates

Your responses should be:
- Accurate and based only on the provided data
- Helpful and actionable for business users
- Clear and well-structured
- Include specific job numbers, customers, and details when relevant
- Acknowledge when information is limited or unavailable

Always cite specific orders (by job number) when possible and provide context for your answers.`;
  }

  private async generateLocalResponse(
    userQuery: string,
    context: RAGContext
  ): Promise<{ answer: string; tokensUsed: number }> {
    // Simple local response generation as fallback
    const orderCount = context.orders.length;
    const vectorCount = context.vectorResults.length;

    let answer = `Based on the available data, I found ${orderCount} relevant orders`;
    if (vectorCount > 0) {
      answer += ` and ${vectorCount} similar orders`;
    }
    answer += `. However, I encountered an issue generating a detailed response. Please try rephrasing your question or contact support for assistance.`;

    return { answer, tokensUsed: 0 };
  }

  private generateReasoning(
    context: RAGContext,
    routingResult: RoutedQueryResult
  ): string {
    const parts = [
      `Used ${routingResult.strategy} strategy`,
      `Found ${context.orders.length} orders`,
      `Context quality: ${context.enrichmentData ? "rich" : "basic"}`,
    ];

    if (routingResult.fallbacksUsed?.length > 0) {
      parts.push(`Fallbacks: ${routingResult.fallbacksUsed.join(", ")}`);
    }

    return parts.join(", ");
  }

  private generateRecommendations(
    context: RAGContext,
    query: EnhancedRAGQuery
  ): string[] {
    const recommendations: string[] = [];

    if (context.orders.length === 0) {
      recommendations.push(
        "Try broadening your search terms or checking for typos"
      );
    }

    if (context.orders.length > 20) {
      recommendations.push("Consider adding filters to narrow down results");
    }

    if (
      !query.context?.includeLineItems &&
      context.enrichmentData.totalLineItems > 0
    ) {
      recommendations.push(
        "Include line item details for more comprehensive analysis"
      );
    }

    return recommendations;
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      // Test core components
      await Promise.all([
        intelligentQueryRouter.getPerformanceStats(),
        enhancedVectorPipeline.healthCheck(),
        advancedCacheService.getStats(),
      ]);

      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Export singleton instance
export const enhancedRAGPipeline = new EnhancedRAGPipeline();

// Enhanced RAG Pipeline - Modern RAG with comprehensive API data context
// Integrates with intelligent query router and enhanced vector pipeline

import OpenAI from "openai";
import { vectorDBService, SearchResult } from "./vector-db";
import { embeddingService, createEmbeddingService } from "./embeddings";
import { apiFirstDataService } from "./api-first-data-service";
import { EnhancedOrder } from "./oms-data";
import { intelligentQueryRouter, RoutedQueryResult } from "./query-router";
import {
  enhancedVectorPipeline,
  EnhancedSearchResult,
} from "./enhanced-vector-pipeline";
import { ModernOrder } from "./api-first-data-service";
import {
  temporalUtils,
  TemporalContext,
  ParsedDateRange,
} from "./temporal-utils";

export interface RAGResult {
  answer: string;
  sources: SearchResult[];
  confidence: "high" | "medium" | "low";
  usedVectorSearch: boolean;
  processingTime: number;
  metadata: {
    totalOrdersSearched: number;
    vectorSearchTime?: number;
    llmResponseTime?: number;
  };
}

export interface EnhancedRAGResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  sources: {
    orders?: ModernOrder[];
    vectorResults?: EnhancedSearchResult[];
    strategy: "api" | "vector" | "hybrid";
  };
  processingTime: number;
  dataFreshness: "fresh" | "cached" | "stale";
  contextQuality: number;
  metadata: {
    totalOrdersAnalyzed: number;
    llmTokensUsed: number;
    reasoning: string;
    recommendations?: string[];
  };
}

export interface RAGQuery {
  userQuery: string;
  includeDetails?: boolean;
  maxResults?: number;
  customerFilter?: string;
  statusFilter?: string;
}

export interface EnhancedRAGQuery {
  userQuery: string;
  context?: {
    includeLineItems?: boolean;
    includeShipments?: boolean;
    includeFiles?: boolean;
    maxOrders?: number;
    preferFreshData?: boolean;
  };
  filters?: {
    customer?: string;
    status?: string;
    dateRange?: { start: string; end: string };
  };
}

export class RAGPipeline {
  private openai: OpenAI;
  private vectorDB = vectorDBService;
  private dataService = apiFirstDataService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      timeout: 30000, // 30 second timeout
      maxRetries: 2, // Built-in retries
    });
  }

  // Enhanced RAG method using modern architecture
  async queryWithEnhancedContext(
    query: EnhancedRAGQuery
  ): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      console.log(`🧠 Processing enhanced RAG query: "${query.userQuery}"`);

      // Step 1: Use intelligent query router for smart data retrieval
      const routingResult = await intelligentQueryRouter.routeQuery(
        query.userQuery,
        {
          userPreferences: {
            preferFreshData: query.context?.preferFreshData,
            maxResponseTime: 30000,
          },
        }
      );

      // Step 2: Build comprehensive context from routing result
      const context = await this.buildEnhancedContext(routingResult, query);

      // Step 3: Generate enhanced response using rich context
      const response = await this.generateEnhancedResponse(
        query.userQuery,
        context
      );

      // Step 4: Calculate confidence and prepare result
      const contextQuality = this.assessContextQuality(context);
      const confidence = this.calculateOverallConfidence(
        contextQuality,
        response,
        context
      );

      const result: EnhancedRAGResult = {
        answer: response.answer,
        confidence,
        sources: {
          orders: context.orders,
          vectorResults: context.vectorResults,
          strategy: routingResult.strategy,
        },
        processingTime: Date.now() - startTime,
        dataFreshness: routingResult.dataFreshness,
        contextQuality,
        metadata: {
          totalOrdersAnalyzed: context.orders.length,
          llmTokensUsed: response.tokensUsed || 0,
          reasoning: this.generateReasoning(context, routingResult),
          recommendations: this.generateRecommendations(context, query),
        },
      };

      console.log(
        `✅ Enhanced RAG completed in ${result.processingTime}ms (confidence: ${confidence})`
      );
      return result;
    } catch (error) {
      console.error("❌ Enhanced RAG pipeline failed:", error);

      return {
        answer: `I encountered an error processing your query: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try rephrasing your question.`,
        confidence: "low",
        sources: { strategy: "vector" },
        processingTime: Date.now() - startTime,
        dataFreshness: "stale",
        contextQuality: 0,
        metadata: {
          totalOrdersAnalyzed: 0,
          llmTokensUsed: 0,
          reasoning: "Error occurred during processing",
        },
      };
    }
  }

  // Build comprehensive context from routing result
  private async buildEnhancedContext(
    routingResult: RoutedQueryResult,
    query: EnhancedRAGQuery
  ) {
    const orders: ModernOrder[] = routingResult.results.orders || [];
    const vectorResults: EnhancedSearchResult[] =
      routingResult.results.vectorResults || [];

    // Calculate enrichment analytics
    const analytics = {
      totalLineItems: orders.reduce(
        (sum, order) => sum + order.lineItems.length,
        0
      ),
      totalShipments: orders.reduce(
        (sum, order) => sum + order.shipments.length,
        0
      ),
      totalFiles: orders.reduce((sum, order) => sum + order.files.length, 0),
      totalValue: orders.reduce(
        (sum, order) => sum + ((order as any).financial?.totalDue || 0),
        0
      ),
      rushOrders: orders.filter((order) => order.production.timeSensitive)
        .length,
      lateOrders: orders.filter((order) => order.dates.daysToDueDate < 0)
        .length,
      customerBreakdown: this.getCustomerBreakdown(orders),
      statusBreakdown: this.getStatusBreakdown(orders),
    };

    return { orders, vectorResults, analytics, routingInfo: routingResult };
  }

  // Generate enhanced response using comprehensive context
  private async generateEnhancedResponse(
    userQuery: string,
    context: any
  ): Promise<{ answer: string; tokensUsed?: number }> {
    // Get temporal context for date-aware responses
    const temporalContext = temporalUtils.getCurrentTemporalContext();
    const temporalPrompt = temporalUtils.generateTemporalReasoningPrompt(
      userQuery,
      temporalContext
    );

    // Parse any natural language dates in the query
    const parsedDates = temporalUtils.parseNaturalLanguageDate(userQuery);

    const contextText = this.formatEnhancedContext(context);

    const enhancedSystemPrompt = `You are a date-aware expert assistant for a printing and manufacturing order management system. You analyze comprehensive order data including job details, line items, production processes, shipments, and financials.

${temporalPrompt}

TEMPORAL REASONING INSTRUCTIONS:
1. Always consider current date/time when processing queries about timing
2. When users say "today", "this week", "urgent", "due soon" - calculate exact dates
3. Prioritize time-sensitive orders (mustDate=true, rush orders, overdue items)
4. Consider business hours and deadlines in your recommendations
5. Factor in days-to-due-date when prioritizing orders

RESPONSE GUIDELINES:
- Provide accurate, helpful responses based on the data provided
- Always cite specific job numbers when relevant
- For time-sensitive queries, prioritize orders by urgency and due dates
- Explain your temporal reasoning (e.g., "Based on today being [date]...")
- Consider $10k revenue targets in context of order values and timelines`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: enhancedSystemPrompt },
          {
            role: "user",
            content: `Context:\n${contextText}\n\nQuestion: ${userQuery}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 1500, // Increased for more detailed temporal reasoning
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I couldn't generate a response.";
      const tokensUsed = response.usage?.total_tokens || 0;
      return { answer, tokensUsed };
    } catch (error) {
      console.error("❌ OpenAI API call failed:", error);
      return this.generateLocalEnhancedResponse(userQuery, context);
    }
  }

  // Format enhanced context with rich API data
  private formatEnhancedContext(context: any): string {
    const sections: string[] = [];

    // Orders section with rich details
    if (context.orders.length > 0) {
      sections.push("## Order Details");
      context.orders
        .slice(0, 8)
        .forEach((order: ModernOrder, index: number) => {
          sections.push(`\n### Order ${index + 1}: Job #${order.jobNumber}`);
          sections.push(`Customer: ${order.customer.company}`);
          sections.push(`Status: ${order.status.master}`);
          sections.push(`Description: ${order.description}`);
          sections.push(`Due Date: ${order.dates.dateDue}`);

          if ((order as any).financial?.totalDue) {
            sections.push(
              `Value: $${(order as any).financial.totalDue.toLocaleString()}`
            );
          }

          // Line items with details
          if (order.lineItems.length > 0) {
            sections.push(`Line Items (${order.lineItems.length}):`);
            order.lineItems.slice(0, 2).forEach((item) => {
              sections.push(`  - ${item.description} (Qty: ${item.quantity})`);
            });
          }

          // Production processes
          if (order.production.processes.length > 0) {
            sections.push(
              `Processes: ${order.production.processes
                .map((p) => p.code)
                .join(", ")}`
            );
          }

          // Flags and special attributes
          const flags = [];
          if (order.production.timeSensitive) flags.push("Rush");
          if (order.production.mustDate) flags.push("Must Date");
          if (order.production.isReprint) flags.push("Reprint");
          if (flags.length > 0) sections.push(`Flags: ${flags.join(", ")}`);

          // Shipments if available
          if (order.shipments.length > 0) {
            sections.push(`Shipments: ${order.shipments.length} shipments`);
          }

          // Files if available
          if (order.files.length > 0) {
            sections.push(`Files: ${order.files.length} attached files`);
          }
        });
    }

    // Analytics section with comprehensive data
    if (context.analytics) {
      sections.push("\n## Summary Analytics");
      sections.push(`Total Orders: ${context.orders.length}`);
      sections.push(`Total Line Items: ${context.analytics.totalLineItems}`);
      sections.push(`Total Files: ${context.analytics.totalFiles}`);
      sections.push(`Total Shipments: ${context.analytics.totalShipments}`);
      sections.push(
        `Total Value: $${context.analytics.totalValue.toLocaleString()}`
      );
      sections.push(`Rush Orders: ${context.analytics.rushOrders}`);
      sections.push(`Late Orders: ${context.analytics.lateOrders}`);

      // Customer breakdown
      if (Object.keys(context.analytics.customerBreakdown).length > 0) {
        sections.push("\n### Top Customers:");
        Object.entries(context.analytics.customerBreakdown)
          .sort((a: any, b: any) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([customer, count]) => {
            sections.push(`  - ${customer}: ${count} orders`);
          });
      }

      // Status breakdown
      if (Object.keys(context.analytics.statusBreakdown).length > 0) {
        sections.push("\n### Status Distribution:");
        Object.entries(context.analytics.statusBreakdown).forEach(
          ([status, count]) => {
            sections.push(`  - ${status}: ${count} orders`);
          }
        );
      }
    }

    // Vector similarity section
    if (context.vectorResults.length > 0) {
      sections.push("\n## Similar Orders");
      context.vectorResults
        .slice(0, 3)
        .forEach((result: EnhancedSearchResult, index: number) => {
          sections.push(
            `${index + 1}. Job #${result.metadata.jobNumber} (${
              result.metadata.customerCompany
            }) - ${(result.score * 100).toFixed(1)}% similarity`
          );
          if (result.highlights) {
            sections.push(`   Key highlights: ${result.highlights.join(", ")}`);
          }
        });
    }

    // Data source and strategy information
    sections.push(
      `\n## Data Source: ${context.routingInfo.strategy.toUpperCase()} strategy used`
    );
    sections.push(`Data Freshness: ${context.routingInfo.dataFreshness}`);
    if (
      context.routingInfo.fallbacksUsed &&
      context.routingInfo.fallbacksUsed.length > 0
    ) {
      sections.push(
        `Fallbacks Used: ${context.routingInfo.fallbacksUsed.join(", ")}`
      );
    }

    return sections.join("\n");
  }

  // Helper methods for enhanced RAG
  private getCustomerBreakdown(orders: ModernOrder[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    orders.forEach((order) => {
      breakdown[order.customer.company] =
        (breakdown[order.customer.company] || 0) + 1;
    });
    return breakdown;
  }

  private getStatusBreakdown(orders: ModernOrder[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    orders.forEach((order) => {
      breakdown[order.status.master] =
        (breakdown[order.status.master] || 0) + 1;
    });
    return breakdown;
  }

  private assessContextQuality(context: any): number {
    let score = 0.5; // Base score

    if (context.orders.length > 0) score += 0.2;
    if (context.analytics.totalLineItems > 0) score += 0.1;
    if (context.analytics.totalFiles > 0) score += 0.05;
    if (context.analytics.totalShipments > 0) score += 0.05;

    if (context.vectorResults.length > 0) {
      const avgScore =
        context.vectorResults.reduce(
          (sum: number, r: any) => sum + r.score,
          0
        ) / context.vectorResults.length;
      score += avgScore * 0.2;
    }

    if (context.routingInfo.strategy === "hybrid") score += 0.1;
    if (context.routingInfo.confidence > 0.8) score += 0.1;

    return Math.min(score, 1.0);
  }

  private calculateOverallConfidence(
    contextQuality: number,
    response: any,
    context: any
  ): "high" | "medium" | "low" {
    let score = contextQuality;

    if (response.answer.length > 100) score += 0.1;
    if (response.answer.includes("$") || response.answer.includes("#"))
      score += 0.05;
    if (context.orders.length > 0) score += 0.1;
    if (context.routingInfo.confidence > 0.7) score += 0.1;

    if (score >= 0.8) return "high";
    if (score >= 0.5) return "medium";
    return "low";
  }

  private generateLocalEnhancedResponse(
    userQuery: string,
    context: any
  ): Promise<{ answer: string; tokensUsed: number }> {
    const answer = `Based on ${context.orders.length} orders with comprehensive data including ${context.analytics.totalLineItems} line items, I found relevant information but encountered an issue generating a detailed response. Please try rephrasing your question.`;
    return Promise.resolve({ answer, tokensUsed: 0 });
  }

  private generateReasoning(
    context: any,
    routingResult: RoutedQueryResult
  ): string {
    const parts = [
      `Used ${routingResult.strategy} strategy`,
      `Found ${context.orders.length} orders`,
      `Analyzed ${context.analytics.totalLineItems} line items`,
      `Context quality: ${context.analytics ? "rich" : "basic"}`,
    ];

    if (routingResult.fallbacksUsed && routingResult.fallbacksUsed.length > 0) {
      parts.push(`Fallbacks: ${routingResult.fallbacksUsed.join(", ")}`);
    }

    return parts.join(", ");
  }

  private generateRecommendations(
    context: any,
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
      context.analytics.totalLineItems > 0
    ) {
      recommendations.push(
        "Include line item details for more comprehensive analysis"
      );
    }

    if (
      !query.context?.includeShipments &&
      context.analytics.totalShipments > 0
    ) {
      recommendations.push("Include shipment data for delivery insights");
    }

    return recommendations;
  }

  // Main RAG query method
  async queryOrders(query: RAGQuery): Promise<RAGResult> {
    const startTime = Date.now();

    try {
      // Step 1: Retrieval - Get relevant orders using vector search
      const retrievalStart = Date.now();
      const searchResults = await this.retrieveRelevantOrders(
        query.userQuery,
        query.maxResults || 5,
        {
          customer: query.customerFilter,
          status: query.statusFilter,
        }
      );
      const vectorSearchTime = Date.now() - retrievalStart;

      // Step 2: Augmentation - Prepare context with order details
      const context = await this.augmentWithOrderDetails(
        searchResults,
        query.includeDetails
      );

      // Step 3: Generation - Generate response using ChatGPT
      const generationStart = Date.now();
      const response = await this.generateResponse(
        query.userQuery,
        context,
        searchResults
      );
      const llmResponseTime = Date.now() - generationStart;

      const totalTime = Date.now() - startTime;

      return {
        answer: response.answer,
        sources: searchResults,
        confidence: this.calculateConfidence(searchResults, response.answer),
        usedVectorSearch: searchResults.length > 0,
        processingTime: totalTime,
        metadata: {
          totalOrdersSearched: searchResults.length,
          vectorSearchTime,
          llmResponseTime,
        },
      };
    } catch (error) {
      console.error("❌ RAG pipeline failed:", error);
      throw new Error(
        `RAG query failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  // Step 1: Retrieve relevant orders using vector search
  private async retrieveRelevantOrders(
    query: string,
    maxResults: number,
    filters: { customer?: string; status?: string }
  ): Promise<SearchResult[]> {
    try {
      // Create fresh embedding service instance to avoid connection issues
      const freshEmbeddingService = createEmbeddingService();

      // Create embedding for the user query
      const queryEmbedding = await freshEmbeddingService.createEmbedding(query);

      // Build filter object for Pinecone
      const pineconeFilter: Record<string, string | number | boolean> = {};
      if (filters.customer) {
        pineconeFilter.customerCompany = filters.customer;
      }
      if (filters.status) {
        pineconeFilter.status = filters.status;
      }

      // Search for more results initially (we'll filter down)
      const initialResults = Math.min(maxResults * 4, 50); // Search 4x requested, max 50

      const results = await this.vectorDB.searchSimilarOrders(
        queryEmbedding,
        initialResults,
        Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined
      );

      // Apply intelligent filtering
      const filteredResults = this.filterResultsByQuality(
        results,
        query,
        maxResults
      );

      console.log(
        `🔍 Found ${results.length} potential matches, filtered to ${filteredResults.length} high-quality results`
      );
      return filteredResults;
    } catch (error) {
      console.error("❌ Vector retrieval failed:", error);
      // Fallback to empty results rather than failing
      return [];
    }
  }

  // Smart result filtering based on quality and relevance
  private filterResultsByQuality(
    results: SearchResult[],
    query: string,
    maxResults: number
  ): SearchResult[] {
    if (results.length === 0) return results;

    // Analyze query to determine filtering strategy
    const queryLower = query.toLowerCase();
    const isSpecificComparison =
      queryLower.includes("like job") || queryLower.includes("similar to");
    const isMaterialSearch = this.containsMaterialKeywords(queryLower);
    const isProcessSearch = this.containsProcessKeywords(queryLower);

    // Set dynamic thresholds based on query type
    let minScore: number;
    let optimalCount: number;

    if (isSpecificComparison) {
      // "like job 51188" - want fewer, highly similar results
      minScore = 0.5;
      optimalCount = Math.min(maxResults, 8);
    } else if (isMaterialSearch || isProcessSearch) {
      // "embroidery orders" - can have more results but still quality
      minScore = 0.4;
      optimalCount = Math.min(maxResults, 12);
    } else {
      // General search - moderate filtering
      minScore = 0.35;
      optimalCount = maxResults;
    }

    // Filter by minimum score
    let qualityResults = results.filter((result) => result.score >= minScore);

    // If we have too few results with strict filtering, gradually relax
    if (qualityResults.length < 3 && results.length > 0) {
      // Relax threshold but cap results
      const relaxedThreshold = Math.max(minScore - 0.15, 0.25);
      qualityResults = results.filter(
        (result) => result.score >= relaxedThreshold
      );
      console.log(
        `📉 Relaxed similarity threshold to ${relaxedThreshold} (found ${qualityResults.length} results)`
      );
    }

    // Apply adaptive result limiting
    const finalResults = this.applyAdaptiveLimit(qualityResults, optimalCount);

    // Log filtering details for debugging
    if (results.length > finalResults.length) {
      const avgScore =
        finalResults.reduce((sum, r) => sum + r.score, 0) / finalResults.length;
      console.log(
        `🎯 Filtered ${results.length} → ${
          finalResults.length
        } results (avg score: ${avgScore.toFixed(3)})`
      );
    }

    return finalResults;
  }

  // Check if query contains material keywords
  private containsMaterialKeywords(query: string): boolean {
    const materials = [
      "leatherette",
      "leather",
      "vinyl",
      "fabric",
      "cotton",
      "polyester",
      "canvas",
      "denim",
      "fleece",
      "mesh",
      "nylon",
      "spandex",
    ];
    return materials.some((material) => query.includes(material));
  }

  // Check if query contains process keywords
  private containsProcessKeywords(query: string): boolean {
    const processes = [
      "embroidery",
      "embroidered",
      "heat press",
      "screen print",
      "printed",
      "patches",
      "applique",
      "stitching",
      "sublimation",
      "dtg",
      "vinyl",
    ];
    return processes.some((process) => query.includes(process));
  }

  // Apply adaptive result limiting with score distribution analysis
  private applyAdaptiveLimit(
    results: SearchResult[],
    optimalCount: number
  ): SearchResult[] {
    if (results.length <= optimalCount) return results;

    // Look for natural score breaks to find good cutoff points
    const sortedResults = [...results].sort((a, b) => b.score - a.score);

    // Find the largest score drop (natural break)
    let bestCutoff = optimalCount;
    let largestDrop = 0;

    for (let i = 1; i < Math.min(sortedResults.length, optimalCount + 5); i++) {
      const scoreDrop = sortedResults[i - 1].score - sortedResults[i].score;
      if (scoreDrop > largestDrop && i <= optimalCount * 1.5) {
        largestDrop = scoreDrop;
        bestCutoff = i;
      }
    }

    // Only use the natural break if it's significant
    if (largestDrop > 0.08) {
      console.log(
        `📊 Found natural score break at position ${bestCutoff} (drop: ${largestDrop.toFixed(
          3
        )})`
      );
      return sortedResults.slice(0, bestCutoff);
    }

    // Otherwise, use strict optimal count
    return sortedResults.slice(0, optimalCount);
  }

  // Step 2: Augment search results with detailed order information
  private async augmentWithOrderDetails(
    searchResults: SearchResult[],
    includeDetails: boolean = true
  ): Promise<string> {
    if (searchResults.length === 0) {
      return "No relevant orders found in the database.";
    }

    const contextParts: string[] = [];

    for (const result of searchResults) {
      const metadata = result.metadata;

      // Basic order information
      let orderInfo = `
**Order ${metadata.jobNumber}** (Score: ${result.score.toFixed(3)})
- Customer: ${metadata.customerCompany}
- Status: ${metadata.status}
- Description: ${metadata.description}
- Order Number: ${metadata.orderNumber}
- Date Entered: ${metadata.dateEntered}`;

      if (metadata.priority) {
        orderInfo += `\n- Priority: ${metadata.priority}`;
      }

      if (metadata.totalDue) {
        orderInfo += `\n- Total Due: $${metadata.totalDue.toLocaleString()}`;
      }

      // Get additional details if requested
      if (includeDetails) {
        try {
          const detailedOrder =
            await this.dataService.getEnhancedOrderByJobNumber(
              metadata.jobNumber
            );
          if (detailedOrder) {
            orderInfo += this.formatOrderDetails(detailedOrder);
          }
        } catch {
          console.warn(
            `⚠️ Could not get details for order ${metadata.jobNumber}`
          );
        }
      }

      contextParts.push(orderInfo);
    }

    return contextParts.join("\n\n---\n\n");
  }

  // Format detailed order information
  private formatOrderDetails(order: EnhancedOrder): string {
    let details = "";

    // Line items summary
    if (order.lineItems && order.lineItems.length > 0) {
      details += `\n- Line Items: ${order.lineItems.length} items`;
      const totalItems = order.lineItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
      details += ` (${totalItems} total quantity)`;
    }

    // Workflow status
    if (order.workflow) {
      const workflowFlags = [];
      if (order.workflow.isRush) workflowFlags.push("RUSH");
      if (order.workflow.hasJobFiles) workflowFlags.push("Has Files");
      if (order.workflow.hasProof) workflowFlags.push("Has Proof");
      if (workflowFlags.length > 0) {
        details += `\n- Workflow: ${workflowFlags.join(", ")}`;
      }
    }

    // Shipping information
    if (order.shipments && order.shipments.length > 0) {
      details += `\n- Shipments: ${order.shipments.length} shipment(s)`;
      const mainShipment = order.shipments[0];
      if (mainShipment) {
        details += ` to ${mainShipment.shipToAddress.city}, ${mainShipment.shipToAddress.state}`;
      }
    }

    // Live API data if available
    if (order.liveStatus) {
      details += `\n- Live Status: ${
        order.liveStatus.StatusLineText || order.liveStatus.StatusLineHtml
      }`;
    }

    return details;
  }

  // Step 3: Generate response using ChatGPT with retrieved context
  private async generateResponse(
    userQuery: string,
    context: string,
    sources: SearchResult[]
  ): Promise<{ answer: string }> {
    const systemPrompt = `You are an expert OMS (Order Management System) assistant helping users find and understand order information. 

Use the provided order data to answer user questions accurately and helpfully. 

Guidelines:
- Provide specific, factual information from the order data
- If asked about multiple orders, organize your response clearly
- Include relevant job numbers and order details
- If the data doesn't contain enough information to answer fully, say so
- Be conversational but professional
- Focus on the most relevant orders if many are provided

Order Data:
${context}`;

    const userPrompt = `User Question: "${userQuery}"

Please provide a helpful response based on the order data above. If specific orders are relevant, mention their job numbers and key details.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini", // Using the latest cost-effective model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // Low temperature for consistent, factual responses
        max_tokens: 800,
      });

      const answer =
        completion.choices[0]?.message?.content ||
        "I was unable to generate a response.";

      return { answer };
    } catch (error) {
      console.error("❌ OpenAI response generation failed:", error);

      // ENHANCED: Fallback to local response generation
      console.log("🔄 Falling back to local response generation");
      return this.generateLocalResponse(userQuery, sources);
    }
  }

  // NEW: Local fallback response generation when OpenAI is unavailable
  private async generateLocalResponse(
    userQuery: string,
    sources: SearchResult[]
  ): Promise<{ answer: string }> {
    if (sources.length === 0) {
      return { answer: "No orders found matching your criteria." };
    }

    const queryLower = userQuery.toLowerCase();

    // Handle specific information requests
    if (
      queryLower.includes("price") ||
      queryLower.includes("worth") ||
      queryLower.includes("cost") ||
      queryLower.includes("total")
    ) {
      return this.generatePriceResponse(sources, userQuery);
    }

    if (
      queryLower.includes("due date") ||
      queryLower.includes("ship date") ||
      queryLower.includes("deadline")
    ) {
      return this.generateDateResponse(sources, userQuery);
    }

    if (queryLower.includes("status") || queryLower.includes("progress")) {
      return this.generateStatusResponse(sources, userQuery);
    }

    if (queryLower.includes("customer") || queryLower.includes("client")) {
      return this.generateCustomerResponse(sources, userQuery);
    }

    // Handle "tell me more" or detailed requests
    if (
      queryLower.includes("tell me more") ||
      queryLower.includes("details") ||
      queryLower.includes("information")
    ) {
      return this.generateDetailedResponse(sources, userQuery);
    }

    // Default: comprehensive listing
    return this.generateListingResponse(sources, userQuery);
  }

  // Generate price-focused response
  private async generatePriceResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    if (sources.length === 1) {
      const order = sources[0];
      const price = order.metadata.totalDue || 0;
      return {
        answer: `**Order ${order.metadata.jobNumber}** for ${
          order.metadata.customerCompany
        } is worth **$${price.toLocaleString()}**.\n\nDescription: ${
          order.metadata.description
        }`,
      };
    } else {
      const total = sources.reduce(
        (sum, order) => sum + (order.metadata.totalDue || 0),
        0
      );
      const orderList = sources
        .map(
          (order) =>
            `- Order ${order.metadata.jobNumber}: $${(
              order.metadata.totalDue || 0
            ).toLocaleString()}`
        )
        .join("\n");

      return {
        answer: `Found ${
          sources.length
        } orders with a combined value of **$${total.toLocaleString()}**:\n\n${orderList}`,
      };
    }
  }

  // Generate date-focused response
  private async generateDateResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    const orderDetails = await Promise.all(
      sources.slice(0, 3).map(async (source) => {
        try {
          const order = await this.dataService.getEnhancedOrderByJobNumber(
            source.metadata.jobNumber
          );
          return order;
        } catch {
          return null;
        }
      })
    );

    const validOrders = orderDetails.filter((order) => order !== null);

    if (validOrders.length === 1) {
      const order = validOrders[0]!;
      let dateInfo = `**Order ${order.jobNumber}** for ${order.customer.company}:\n`;

      if (order.requestedShipDate) {
        dateInfo += `- **Requested Ship Date**: ${new Date(
          order.requestedShipDate
        ).toLocaleDateString()}`;
      }
      if (order.production?.estimatedCompletionDate) {
        dateInfo += `\n- **Estimated Completion**: ${new Date(
          order.production.estimatedCompletionDate
        ).toLocaleDateString()}`;
      }
      if (order.dateEntered) {
        dateInfo += `\n- **Date Entered**: ${new Date(
          order.dateEntered
        ).toLocaleDateString()}`;
      }

      return {
        answer:
          dateInfo ||
          `Order ${order.jobNumber} found, but date information is not available.`,
      };
    } else {
      const dateList = validOrders
        .map((order) => {
          const shipDate = order.requestedShipDate
            ? new Date(order.requestedShipDate).toLocaleDateString()
            : "Not set";
          return `- Order ${order.jobNumber}: Ship date ${shipDate}`;
        })
        .join("\n");

      return {
        answer: `Found ${sources.length} orders:\n\n${dateList}`,
      };
    }
  }

  // Generate detailed response
  private async generateDetailedResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    const order = sources[0]; // Focus on the most relevant order

    try {
      const detailedOrder = await this.dataService.getEnhancedOrderByJobNumber(
        order.metadata.jobNumber
      );

      if (!detailedOrder) {
        return {
          answer: `Order ${order.metadata.jobNumber} found but detailed information is not available.`,
        };
      }

      let details = `**Order ${detailedOrder.jobNumber}** - ${detailedOrder.customer.company}\n\n`;
      details += `**Description**: ${detailedOrder.description}\n`;
      details += `**Status**: ${detailedOrder.status}\n`;

      if (detailedOrder.pricing?.totalDue) {
        details += `**Total Due**: $${detailedOrder.pricing.totalDue.toLocaleString()}\n`;
      }

      if (detailedOrder.requestedShipDate) {
        details += `**Requested Ship Date**: ${new Date(
          detailedOrder.requestedShipDate
        ).toLocaleDateString()}\n`;
      }

      if (detailedOrder.priority) {
        details += `**Priority**: ${detailedOrder.priority}\n`;
      }

      if (detailedOrder.lineItems && detailedOrder.lineItems.length > 0) {
        details += `**Line Items**: ${detailedOrder.lineItems.length} items\n`;
      }

      return { answer: details };
    } catch (error) {
      return {
        answer: `Order ${order.metadata.jobNumber} for ${order.metadata.customerCompany} found, but I couldn't retrieve detailed information.`,
      };
    }
  }

  // Generate status response
  private generateStatusResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    const statusList = sources
      .map(
        (order) =>
          `- **Order ${order.metadata.jobNumber}**: ${order.metadata.status} (${order.metadata.customerCompany})`
      )
      .join("\n");

    return Promise.resolve({
      answer: `Order status information:\n\n${statusList}`,
    });
  }

  // Generate customer response
  private generateCustomerResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    const customerList = sources
      .map(
        (order) =>
          `- **Order ${order.metadata.jobNumber}**: ${
            order.metadata.customerCompany
          } - ${order.metadata.description.substring(0, 80)}...`
      )
      .join("\n");

    return Promise.resolve({
      answer: `Found ${sources.length} orders:\n\n${customerList}`,
    });
  }

  // Generate general listing response
  private generateListingResponse(
    sources: SearchResult[],
    userQuery: string
  ): Promise<{ answer: string }> {
    const orderList = sources
      .slice(0, 5)
      .map((order) => {
        let info = `**Order ${order.metadata.jobNumber}**\n`;
        info += `**Customer:** ${order.metadata.customerCompany}\n`;
        info += `**Status:** ${order.metadata.status}\n`;
        info += `**Description:** ${order.metadata.description.substring(
          0,
          100
        )}${order.metadata.description.length > 100 ? "..." : ""}\n`;

        if (order.metadata.totalDue) {
          info += `**Total Due:** $${order.metadata.totalDue.toLocaleString()}\n`;
        }

        return info;
      })
      .join("\n---\n\n");

    const summary =
      sources.length > 5
        ? `\n\n*Showing top 5 of ${sources.length} orders found*`
        : "";

    return Promise.resolve({
      answer: `Here are the orders from the provided data:\n\n${orderList}${summary}`,
    });
  }

  // Calculate confidence based on search results and response quality
  private calculateConfidence(
    sources: SearchResult[],
    answer: string
  ): "high" | "medium" | "low" {
    if (sources.length === 0) return "low";

    const avgScore =
      sources.reduce((sum, source) => sum + source.score, 0) / sources.length;

    // High confidence: good similarity scores and substantial answer
    if (avgScore > 0.8 && answer.length > 100 && sources.length >= 3) {
      return "high";
    }

    // Medium confidence: decent scores or reasonable answer
    if (avgScore > 0.6 && answer.length > 50) {
      return "medium";
    }

    return "low";
  }

  // Health check for the RAG pipeline
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, boolean>;
    error?: string;
  }> {
    try {
      const components = {
        vectorDB: false,
        embeddings: false,
        dataService: false,
        openai: false,
      };

      // Test vector database
      const vectorHealth = await this.vectorDB.healthCheck();
      components.vectorDB = vectorHealth.healthy;

      // Test embeddings
      const embeddingHealth = await this.embeddings.healthCheck();
      components.embeddings = embeddingHealth.healthy;

      // Test data service
      const dataHealth = await this.dataService.getSystemStatus();
      components.dataService = dataHealth.scraped.healthy;

      // Test OpenAI (simple completion)
      try {
        await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5,
        });
        components.openai = true;
      } catch {
        components.openai = false;
      }

      const healthy = Object.values(components).every((status) => status);

      return { healthy, components };
    } catch (error) {
      return {
        healthy: false,
        components: {},
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// Create singleton instance
export const ragPipeline = new RAGPipeline();

// Enhanced RAG Pipeline - Modern RAG with comprehensive API data context
// Integrates with intelligent query router and enhanced vector pipeline

import OpenAI from "openai";
import { intelligentQueryRouter, RoutedQueryResult } from "./query-router";
import {
  enhancedVectorPipeline,
  EnhancedSearchResult,
} from "./enhanced-vector-pipeline";
import {
  apiFirstDataService,
  ModernOrder,
  toModernOrder,
} from "./api-first-data-service";
import { advancedCacheService } from "./advanced-cache-service";
import { embeddingService } from "./embeddings";
import { omsFunctionCaller, AvailableFunction } from "./oms-function-caller";
import {
  ConstraintSatisfactionService,
  Constraint,
  AggregationRequest,
} from "./constraint-satisfaction-service";

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
    functionCallsExecuted?: number;
    planningSteps?: number;
  };
  // New structured response format
  structuredResponse?: {
    introText: string;
    orders: Array<{
      jobNumber: string;
      customer: string;
      description: string;
      dueDate: string;
      daysToDue: number;
      status: string;
      quantity?: number;
      tags?: string[];
      priority: "urgent" | "normal" | "low";
      value?: number;
      // Enhanced fields from consistent data structure
      processes?: Array<{
        code: string;
        displayCode: string;
        quantity: number;
      }>;
      orderNumber?: string;
      stockStatus?: string;
      timeSensitive?: boolean;
      mustDate?: boolean;
      isReprint?: boolean;
      isDupe?: boolean;
      location?: {
        code: string;
        name: string;
      };
    }>;
    summary?: {
      totalOrders: number;
      totalValue?: number;
      urgentCount: number;
      overdueCount: number;
    };
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

// New interfaces for multi-step function calling
export interface FunctionCallPlan {
  steps: FunctionCallStep[];
  reasoning: string;
  expectedOutcome: string;
  confidence: number;
}

export interface FunctionCallStep {
  functionName: string;
  parameters: any;
  purpose: string;
  dependsOn?: string[]; // IDs of previous steps this depends on
  expectedResult?: any;
}

export interface FunctionCallResult {
  stepId: string;
  functionName: string;
  parameters: any;
  result: any;
  success: boolean;
  error?: string;
  executionTime: number;
}

export class EnhancedRAGPipeline {
  private openai: OpenAI;
  private systemPrompt: string;
  private planningPrompt: string;
  private embeddingService: typeof embeddingService;
  private constraintService: ConstraintSatisfactionService;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      timeout: 60000, // 60 second timeout for complex multi-step queries
      maxRetries: 2,
    });

    this.systemPrompt = this.buildSystemPrompt();
    this.planningPrompt = this.buildPlanningPrompt();
    this.embeddingService = embeddingService;
    this.constraintService = new ConstraintSatisfactionService();
  }

  /**
   * Main method to process queries with enhanced RAG capabilities
   */
  public async processQuery(
    query: string,
    context?: any
  ): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      // Check if this is a constraint satisfaction query
      if (this.needsConstraintProcessing(query)) {
        console.log("Processing as constraint satisfaction query");

        // First, get a basic list of orders to filter by constraints
        console.log("📊 Fetching basic order list for constraint filtering...");
        const basicOrdersData = await apiFirstDataService.getAllOrders();
        const basicOrders = basicOrdersData.orders;
        console.log(
          `📊 Found ${basicOrders.length} total orders for filtering`
        );

        // Parse constraints to determine which orders we need
        const { constraints, targetValue } =
          this.constraintService.parseConstraints(query);
        console.log("🔍 [CONSTRAINT] Parsed constraints:", {
          constraints,
          targetValue,
        });

        // Filter orders by basic constraints (date, tags, etc.) before fetching full details
        // Use the constraint service's public method to process constraints
        const constraintResult =
          await this.constraintService.processConstraintQuery(
            basicOrders,
            constraints,
            targetValue
          );
        const filteredBasicOrders = constraintResult.orders;
        console.log(
          `🔍 [CONSTRAINT] Filtered to ${filteredBasicOrders.length} orders before enrichment`
        );

        // Only fetch enriched data for the filtered orders
        if (filteredBasicOrders.length > 0) {
          console.log("📊 Fetching enriched data for filtered orders...");
          const enrichedOrdersData =
            await apiFirstDataService.getAllOrdersWithEnrichment({
              includeLineItems: true, // Include line items for pricing calculation
              includeShipments: false, // Not needed for pricing
              includeFiles: false, // Not needed for pricing
            });
          const allEnrichedOrders = enrichedOrdersData.orders;

          // Filter enriched orders to match our basic filtered list
          const enrichedFilteredOrders = allEnrichedOrders.filter(
            (enrichedOrder) =>
              filteredBasicOrders.some(
                (basicOrder) => basicOrder.jobNumber === enrichedOrder.jobNumber
              )
          );
          console.log(
            `🔍 [CONSTRAINT] Got ${enrichedFilteredOrders.length} enriched orders for constraint processing`
          );

          // Process with constraint satisfaction
          const result = await this.processConstraintQuery(
            query,
            enrichedFilteredOrders
          );

          // Add processing time
          result.processingTime = Date.now() - startTime;

          return result;
        } else {
          // No orders match the basic constraints
          console.log("🔍 [CONSTRAINT] No orders match the basic constraints");
          return {
            answer:
              "I couldn't find any orders that match your criteria. Please try adjusting your search terms.",
            confidence: "low",
            sources: {
              orders: [],
              vectorResults: [],
              apiCalls: 1,
              strategy: "api",
            },
            processingTime: Date.now() - startTime,
            dataFreshness: "fresh",
            contextQuality: 0,
            metadata: {
              totalOrdersAnalyzed: 0,
              llmTokensUsed: 0,
              cacheHitsUsed: 0,
              reasoning: "No orders match basic constraints",
              functionCallsExecuted: 0,
              planningSteps: 0,
            },
          };
        }
      }

      // Continue with existing enhanced RAG processing for non-constraint queries
      console.log("Processing as regular RAG query");

      // Use the queryWithContext method for non-constraint queries
      return await this.queryWithContext({
        userQuery: query,
        context: {
          includeLineItems: true,
          includeShipments: true,
          includeFiles: true,
          maxOrders: 10,
          preferFreshData: true,
        },
      });
    } catch (error) {
      console.error("Error in enhanced RAG processing:", error);
      return {
        answer:
          "I encountered an error while processing your query. Please try again.",
        confidence: "low",
        sources: {
          orders: [],
          vectorResults: [],
          apiCalls: 0,
          strategy: "api",
        },
        processingTime: Date.now() - startTime,
        dataFreshness: "fresh",
        contextQuality: 0,
        metadata: {
          totalOrdersAnalyzed: 0,
          llmTokensUsed: 0,
          cacheHitsUsed: 0,
          reasoning: "Error in processing",
          functionCallsExecuted: 0,
          planningSteps: 0,
        },
      };
    }
  }

  // Main enhanced RAG query method with multi-step function calling
  async queryWithContext(query: EnhancedRAGQuery): Promise<EnhancedRAGResult> {
    const startTime = Date.now();

    try {
      console.log(`🧠 Processing enhanced RAG query: "${query.userQuery}"`);

      // Step 1: Use intelligent query router for smart data retrieval
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

      // Step 2: Build comprehensive context from routing result
      const ragContext = await this.buildEnhancedContext(routingResult, query);

      // Step 3: Check advanced cache with context-aware key
      const cacheKey = this.generateCacheKey(query, ragContext);
      const cachedResult = await advancedCacheService.get<EnhancedRAGResult>(
        cacheKey
      );

      // Temporarily disable cache to fix caching issues
      if (
        false &&
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

      // Step 4: Assess if this query needs multi-step function calling
      const needsMultiStep = this.assessMultiStepNeeds(
        query.userQuery,
        ragContext
      );

      let functionCallResults: FunctionCallResult[] = [];
      let planningSteps = 0;

      if (needsMultiStep) {
        console.log(
          "🔄 Complex query detected - using multi-step function calling"
        );

        // Step 5: Generate dynamic function call plan
        const plan = await this.generateFunctionCallPlan(
          query.userQuery,
          ragContext
        );
        planningSteps = plan.steps.length;

        // Step 6: Execute multi-step function calls
        functionCallResults = await this.executeFunctionCallPlan(plan);

        // Step 7: Enrich context with function call results
        await this.enrichContextWithFunctionResults(
          ragContext,
          functionCallResults
        );
      }

      // Step 8: Assess context quality and determine confidence
      const contextQuality = this.assessContextQuality(ragContext);

      if (contextQuality < 0.3) {
        console.log("⚠️ Low context quality, attempting context enrichment...");
        await this.enrichContext(ragContext, query);
      }

      // Step 9: Generate enhanced response using rich context
      const response = await this.generateEnhancedResponse(
        query.userQuery,
        ragContext,
        functionCallResults
      );

      // Step 10: Calculate final confidence and prepare result
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
          apiCalls:
            routingResult.performanceMetrics.apiCalls +
            functionCallResults.length,
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
          functionCallsExecuted: functionCallResults.length,
          planningSteps,
        },
        structuredResponse: response.structuredResponse,
      };

      // Step 11: Cache result for future use
      await this.cacheResult(cacheKey, result, query);

      console.log(
        `✅ Enhanced RAG completed in ${result.processingTime}ms (confidence: ${confidence}, function calls: ${functionCallResults.length})`
      );
      return result;
    } catch (error) {
      console.error("❌ Enhanced RAG pipeline failed:", error);

      // Return fallback result
      return {
        answer: `I encountered an error processing your query: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try rephrasing your question or contact support.`,
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

  // Assess if query needs multi-step function calling
  private assessMultiStepNeeds(
    userQuery: string,
    context: RAGContext
  ): boolean {
    const queryLower = userQuery.toLowerCase();

    // Complex analytical queries that need multiple data sources
    const complexPatterns = [
      /add up to|total.*value|sum.*value|combined.*value/i,
      /between.*and.*value|range.*value/i,
      /highest.*value|lowest.*value|top.*by.*value/i,
      /customer.*spending|revenue.*by.*customer/i,
      /process.*cost|material.*cost|detailed.*pricing/i,
      /shipment.*status.*and.*cost|tracking.*and.*value/i,
      /urgent.*orders.*value|rush.*orders.*total/i,
      /overdue.*orders.*value|late.*orders.*cost/i,
      /this.*week.*value|next.*week.*total/i,
      /month.*revenue|quarter.*spending/i,
    ];

    // Check for complex patterns
    const hasComplexPattern = complexPatterns.some((pattern) =>
      pattern.test(userQuery)
    );

    // Check for constraint combinations
    const hasMultipleConstraints =
      (queryLower.includes("due") && queryLower.includes("value")) ||
      (queryLower.includes("customer") && queryLower.includes("cost")) ||
      (queryLower.includes("status") && queryLower.includes("total")) ||
      (queryLower.includes("process") && queryLower.includes("pricing"));

    // Check for aggregation needs
    const needsAggregation =
      queryLower.includes("total") ||
      queryLower.includes("sum") ||
      queryLower.includes("add up") ||
      queryLower.includes("combined") ||
      queryLower.includes("all together");

    // Check if we need detailed data that's not in current context
    const needsDetailedData =
      context.orders.length > 0 &&
      (queryLower.includes("cost") ||
        queryLower.includes("pricing") ||
        queryLower.includes("value")) &&
      context.orders.some(
        (order) => !order.lineItems || order.lineItems.length === 0
      );

    return (
      hasComplexPattern ||
      hasMultipleConstraints ||
      needsAggregation ||
      needsDetailedData
    );
  }

  // Generate dynamic function call plan
  private async generateFunctionCallPlan(
    userQuery: string,
    context: RAGContext
  ): Promise<FunctionCallPlan> {
    console.log("🧠 Generating dynamic function call plan...");

    try {
      const availableFunctions = omsFunctionCaller.getAvailableFunctions();

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: this.planningPrompt,
          },
          {
            role: "user",
            content: `Query: "${userQuery}"
            
Available functions:
${availableFunctions.map((f) => `- ${f.name}: ${f.description}`).join("\n")}

Current context has ${context.orders.length} orders and ${
              context.vectorResults.length
            } vector results.

Generate a plan to answer this query using the available functions.`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      });

      const result = response.choices[0]?.message?.content;
      if (!result) {
        throw new Error("No response from GPT for planning");
      }

      const plan = JSON.parse(result) as FunctionCallPlan;

      console.log(
        `📋 Generated plan with ${plan.steps.length} steps:`,
        plan.reasoning
      );
      plan.steps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.functionName}: ${step.purpose}`);
      });

      return plan;
    } catch (error) {
      console.warn("⚠️ Planning failed, using fallback plan:", error);

      // Fallback plan for basic queries
      return {
        steps: [
          {
            functionName: "get_job_list",
            parameters: { text_filter: userQuery },
            purpose: "Get basic job list for query",
          },
        ],
        reasoning: "Fallback plan due to planning failure",
        expectedOutcome: "Basic job data",
        confidence: 0.5,
      };
    }
  }

  // Execute multi-step function call plan
  private async executeFunctionCallPlan(
    plan: FunctionCallPlan
  ): Promise<FunctionCallResult[]> {
    console.log(`🔧 Executing ${plan.steps.length} function calls...`);

    const results: FunctionCallResult[] = [];
    const stepResults = new Map<string, any>();

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepId = `step_${i + 1}`;

      try {
        console.log(`🔧 Step ${i + 1}: ${step.functionName} - ${step.purpose}`);

        // Check dependencies
        if (step.dependsOn) {
          const missingDeps = step.dependsOn.filter(
            (dep) => !stepResults.has(dep)
          );
          if (missingDeps.length > 0) {
            console.warn(
              `⚠️ Missing dependencies for step ${i + 1}: ${missingDeps.join(
                ", "
              )}`
            );
            continue;
          }
        }

        // Execute function
        const startTime = Date.now();
        const result = await omsFunctionCaller.executeFunction(
          step.functionName,
          step.parameters
        );
        const executionTime = Date.now() - startTime;

        const functionResult: FunctionCallResult = {
          stepId,
          functionName: step.functionName,
          parameters: step.parameters,
          result: result.data,
          success: result.success,
          error: result.error,
          executionTime,
        };

        results.push(functionResult);
        stepResults.set(stepId, result.data);

        console.log(`✅ Step ${i + 1} completed in ${executionTime}ms`);

        // Rate limiting - pause between calls
        if (i < plan.steps.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Step ${i + 1} failed:`, error);

        results.push({
          stepId,
          functionName: step.functionName,
          parameters: step.parameters,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          executionTime: 0,
        });
      }
    }

    console.log(
      `✅ Function call plan completed: ${
        results.filter((r) => r.success).length
      }/${results.length} successful`
    );
    return results;
  }

  // Enrich context with function call results
  private async enrichContextWithFunctionResults(
    context: RAGContext,
    functionResults: FunctionCallResult[]
  ): Promise<void> {
    console.log("🔗 Enriching context with function call results...");

    const successfulResults = functionResults.filter((r) => r.success);

    for (const result of successfulResults) {
      try {
        switch (result.functionName) {
          case "get_job_list":
            if (result.result && Array.isArray(result.result)) {
              const newOrders = result.result.map(toModernOrder);
              // Merge with existing orders, avoiding duplicates
              const existingJobNumbers = new Set(
                context.orders.map((o) => o.jobNumber)
              );
              const uniqueNewOrders = newOrders.filter(
                (o) => !existingJobNumbers.has(o.jobNumber)
              );
              context.orders.push(...uniqueNewOrders);
              console.log(
                `📋 Added ${uniqueNewOrders.length} new orders from get_job_list`
              );
            }
            break;

          case "get_job_details":
            if (result.result && result.result.jobNumber) {
              // Update existing order with detailed information
              const existingOrderIndex = context.orders.findIndex(
                (o) => o.jobNumber === result.result.jobNumber
              );
              if (existingOrderIndex >= 0) {
                context.orders[existingOrderIndex] = toModernOrder(
                  result.result
                );
                console.log(
                  `📋 Updated order ${result.result.jobNumber} with detailed info`
                );
              }
            }
            break;

          case "get_job_cost":
            if (result.result && result.result.jobNumber) {
              // Add cost information to existing order
              const existingOrderIndex = context.orders.findIndex(
                (o) => o.jobNumber === result.result.jobNumber
              );
              if (existingOrderIndex >= 0) {
                const order = context.orders[existingOrderIndex];
                (order as any).costDetails = {
                  subtotal: result.result.jobLinesSubTotal,
                  tax: result.result.jobLinesTaxTotal,
                  total: result.result.jobLinesTotalCost,
                };
                console.log(
                  `💰 Added cost details to order ${result.result.jobNumber}`
                );
              }
            }
            break;

          case "get_job_shipments":
            if (result.result && result.result.jobNumber) {
              // Add shipment information to existing order
              const existingOrderIndex = context.orders.findIndex(
                (o) => o.jobNumber === result.result.jobNumber
              );
              if (existingOrderIndex >= 0) {
                const order = context.orders[existingOrderIndex];
                if (result.result.shipments) {
                  order.shipments = result.result.shipments.map((s: any) => ({
                    id: s.Id,
                    index: s.Index,
                    title: s.Title,
                    shipped: s.Shipped,
                    dateShipped: s.DateShipped,
                    canShip: s.CanShip,
                    trackingDetails: s.TrackingDetails,
                    address: s.Address,
                    method: s.ShipmentMethod,
                  }));
                  console.log(
                    `📦 Added shipment details to order ${result.result.jobNumber}`
                  );
                }
              }
            }
            break;

          default:
            // For other functions, try to merge data if possible
            if (result.result && typeof result.result === "object") {
              console.log(`📋 Processed result from ${result.functionName}`);
            }
            break;
        }
      } catch (error) {
        console.warn(
          `⚠️ Failed to process result from ${result.functionName}:`,
          error
        );
      }
    }

    // Recalculate enrichment data with new orders
    if (successfulResults.length > 0) {
      context.enrichmentData = {
        totalLineItems: context.orders.reduce(
          (sum, order) => sum + order.lineItems.length,
          0
        ),
        totalShipments: context.orders.reduce(
          (sum, order) => sum + order.shipments.length,
          0
        ),
        totalFiles: context.orders.reduce(
          (sum, order) => sum + order.files.length,
          0
        ),
        customerBreakdown: this.calculateCustomerBreakdown(context.orders),
        statusBreakdown: this.calculateStatusBreakdown(context.orders),
        processBreakdown: this.calculateProcessBreakdown(context.orders),
        valueAnalysis: this.calculateValueAnalysis(context.orders),
      };
    }
  }

  // Build comprehensive context from routing result
  private async buildEnhancedContext(
    routingResult: RoutedQueryResult,
    query: EnhancedRAGQuery
  ): Promise<RAGContext> {
    let orders: ModernOrder[] = routingResult.results.orders || [];
    const vectorResults: EnhancedSearchResult[] =
      routingResult.results.vectorResults || [];

    // If no direct orders but we have vector results, convert vector results to orders
    console.log(
      `🔍 Building context - Direct orders: ${orders.length}, Vector results: ${vectorResults.length}`
    );
    if (orders.length === 0 && vectorResults.length > 0) {
      console.log("🔄 Converting vector results to orders for RAG processing");
      orders = await this.convertVectorResultsToOrders(vectorResults);
      console.log(`✅ Converted to ${orders.length} orders for RAG processing`);
    } else if (orders.length === 0) {
      console.log(
        "⚠️ No orders or vector results available for RAG processing"
      );
    } else {
      console.log(`✅ Using ${orders.length} direct orders for RAG processing`);
    }

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

  // Build planning prompt for dynamic function call planning
  private buildPlanningPrompt(): string {
    return `You are an expert query planner for an Order Management System. Your job is to analyze complex user queries and create a step-by-step plan to answer them using available API functions.

## Planning Guidelines

1. **Analyze the query complexity**: Determine if the query needs multiple data sources or function calls
2. **Identify required data**: What specific information is needed to answer the query
3. **Plan function sequence**: Which functions to call and in what order
4. **Handle dependencies**: Some function calls may depend on results from others
5. **Consider constraints**: Queries with value constraints, date ranges, or multiple criteria

## Available Functions

**Core Functions (Optimized for minimal API calls):**
- get_job_list: Get filtered list of jobs (1 API call)
- get_job_details: Get job info + line items with pricing (2 API calls)

**Specialized Functions (1 API call each):**
- get_job_cost: Get detailed cost breakdown
- get_job_stock: Get stock status for a specific job
- get_job_shipments: Get shipment information for a specific job
- get_delivery_options: Get delivery options for a customer
- get_job_history: Get activity history for a job
- get_customer_info: Get customer details
- get_price_bands: Get pricing information
- get_category_units: Get product/material types

**Optimization Guidelines:**
- Use get_job_details instead of separate get_job_cost calls when possible
- get_job_details already includes line items with pricing
- Only call specialized functions when you need data not in job details

## Response Format

Return a JSON object with this structure:

{
  "steps": [
    {
      "functionName": "get_job_list",
      "parameters": {
        "text_filter": "search term",
        "job_status": "5,6,7,8"
      },
      "purpose": "Get initial job list matching search criteria",
      "dependsOn": [],
      "expectedResult": "List of job numbers"
    }
  ],
  "reasoning": "Explanation of why this plan was chosen",
  "expectedOutcome": "What the final result should contain",
  "confidence": 0.9
}

## Examples

**Query**: "Show me orders due next week that add up to 10k in value"
**Plan**: 
1. get_job_list with date filter for next week
2. For each job, get_job_cost to calculate total value
3. Filter and sum results to find combinations that add up to 10k

**Query**: "What's the total revenue from SpaceX orders this month?"
**Plan**:
1. get_job_list with customer filter for SpaceX
2. get_job_cost for each job to get pricing
3. Sum all costs for total revenue

Be strategic and efficient - don't make unnecessary function calls.`;
  }

  // Generate enhanced response using comprehensive context and function results
  private async generateEnhancedResponse(
    userQuery: string,
    context: RAGContext,
    functionResults: FunctionCallResult[] = []
  ): Promise<{
    answer: string;
    tokensUsed?: number;
    structuredResponse?: any;
  }> {
    // Prepare rich context text
    const contextText = this.formatEnhancedContext(context, userQuery);

    // Get available functions for the AI to call
    const availableFunctions = omsFunctionCaller.getAvailableFunctions();

    try {
      console.log("🤖 Calling OpenAI with enhanced context...");
      console.log("📝 Context length:", contextText.length);
      console.log("❓ User query:", userQuery);
      console.log("🔧 Available functions:", availableFunctions.length);
      console.log("📊 Function results available:", functionResults.length);

      // Prepare function results context
      const functionResultsContext =
        functionResults.length > 0
          ? `\n\nFunction Call Results:\n${functionResults
              .map(
                (r) => `${r.functionName}: ${r.success ? "Success" : "Failed"}`
              )
              .join("\n")}`
          : "";

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: this.systemPrompt },
          {
            role: "user",
            content: `Context:\n${contextText}${functionResultsContext}\n\nQuestion: ${userQuery}`,
          },
        ],
        tools: availableFunctions.map((func) => ({
          type: "function" as const,
          function: {
            name: func.name,
            description: func.description,
            parameters: func.parameters,
          },
        })),
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 1500,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const answer =
        response.choices[0]?.message?.content ||
        "I couldn't generate a response.";
      const tokensUsed = response.usage?.total_tokens || 0;

      console.log("✅ OpenAI response received:");
      console.log("📊 Tokens used:", tokensUsed);
      console.log("📝 Answer length:", answer.length);
      console.log("🎯 Answer preview:", answer.substring(0, 200) + "...");

      // Handle function calls if any
      const toolCalls = response.choices[0]?.message?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        console.log(
          `🔧 Executing ${toolCalls.length} additional function calls...`
        );

        // Execute all function calls
        const additionalFunctionResults = await Promise.all(
          toolCalls.map(async (toolCall) => {
            const functionName = toolCall.function.name;
            const parameters = JSON.parse(toolCall.function.arguments);

            console.log(`🔧 Calling ${functionName} with:`, parameters);
            const result = await omsFunctionCaller.executeFunction(
              functionName,
              parameters
            );
            console.log(
              `✅ ${functionName} result:`,
              result.success ? "success" : "failed"
            );

            return {
              tool_call_id: toolCall.id,
              role: "tool" as const,
              content: JSON.stringify(result),
            };
          })
        );

        // Only make follow-up call if we have successful function results
        const successfulResults = additionalFunctionResults.filter((result) => {
          try {
            const parsed = JSON.parse(result.content);
            return parsed.success;
          } catch {
            return false;
          }
        });

        if (successfulResults.length > 0) {
          try {
            console.log(
              "🔄 Making follow-up call with additional function results..."
            );
            const followUpResponse = await this.openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: this.systemPrompt },
                {
                  role: "user",
                  content: `Context:\n${contextText}${functionResultsContext}\n\nQuestion: ${userQuery}`,
                },
              ],
              temperature: 0.2,
              max_tokens: 1500,
              presence_penalty: 0.1,
              frequency_penalty: 0.1,
            });

            const finalAnswer =
              followUpResponse.choices[0]?.message?.content || answer;
            const totalTokensUsed =
              tokensUsed + (followUpResponse.usage?.total_tokens || 0);

            console.log("✅ Follow-up response received:");
            console.log("📊 Total tokens used:", totalTokensUsed);
            console.log("📝 Final answer length:", finalAnswer.length);

            // Create structured response from context
            const structuredResponse =
              context.orders.length > 0
                ? this.createStructuredResponseFromContext(context, userQuery)
                : null;

            return {
              answer: finalAnswer,
              tokensUsed: totalTokensUsed,
              structuredResponse,
            };
          } catch (followUpError) {
            console.warn(
              "⚠️ Follow-up call failed, using original response:",
              followUpError
            );
            // Fall back to original response
          }
        }
      }

      // No function calls or follow-up failed, return regular response
      const structuredResponse =
        context.orders.length > 0
          ? this.createStructuredResponseFromContext(context, userQuery)
          : null;

      return { answer, tokensUsed, structuredResponse };
    } catch (error) {
      console.error("❌ OpenAI API call failed:", error);
      console.log("🔄 Falling back to local response generation");

      // Fallback to local response generation
      const fallback = await this.generateLocalResponse(userQuery, context);
      const structuredResponse =
        context.orders.length > 0
          ? this.createStructuredResponseFromContext(context, userQuery)
          : null;

      return {
        answer: fallback.answer,
        tokensUsed: fallback.tokensUsed,
        structuredResponse,
      };
    }
  }

  // Format enhanced context with rich API data
  private formatEnhancedContext(
    context: RAGContext,
    userQuery: string
  ): string {
    const sections: string[] = [];

    // Orders section
    if (context.orders.length > 0) {
      sections.push("## Order Details");

      // Prioritize orders by relevance to the query
      const prioritizedOrders = this.prioritizeOrdersForContext(
        context.orders,
        userQuery
      );

      prioritizedOrders.slice(0, 10).forEach((order, index) => {
        sections.push(`\n### Order ${index + 1}: Job #${order.jobNumber}`);
        sections.push(`Customer: ${order.customer.company}`);
        sections.push(`Status: ${order.status.master}`);
        sections.push(`Description: ${order.description}`);
        sections.push(`Due Date: ${order.dates.dateDue}`);
        sections.push(`Days to Due Date: ${order.dates.daysToDueDate}`);
        sections.push(`Quantity: ${order.jobQuantity}`);

        // Calculate order value from line items
        const orderValue = this.calculateOrderValue(order);
        sections.push(`Order Value: $${orderValue.toFixed(2)}`);

        // Line items with pricing
        if (order.lineItems.length > 0) {
          sections.push(`Line Items (${order.lineItems.length}):`);
          order.lineItems.slice(0, 5).forEach((item) => {
            const itemValue = this.calculateLineItemValue(item);
            sections.push(
              `  - ${item.description} (Qty: ${
                item.quantity || 1
              }) - $${itemValue.toFixed(2)}`
            );
          });
          if (order.lineItems.length > 5) {
            sections.push(
              `  ... and ${order.lineItems.length - 5} more line items`
            );
          }
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

        // Tags
        if (order.tags.length > 0) {
          sections.push(`Tags: ${order.tags.map((t) => t.tag).join(", ")}`);
        }

        // Files
        if (order.files.length > 0) {
          sections.push(`Files: ${order.files.length} files attached`);
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
        `Total Value: $${context.enrichmentData.valueAnalysis.totalValue.toFixed(
          2
        )}`
      );
      sections.push(
        `Average Order Value: $${context.enrichmentData.valueAnalysis.averageValue.toFixed(
          2
        )}`
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
        // Check if vector metadata has totalDue property (from scraped data)
        if ((result.metadata as any).totalDue) {
          sections.push(`   Value: $${(result.metadata as any).totalDue}`);
        }
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
    if (
      context.routingInfo.fallbacksUsed &&
      context.routingInfo.fallbacksUsed.length > 0
    ) {
      sections.push(
        `Fallbacks: ${context.routingInfo.fallbacksUsed.join(", ")}`
      );
    }

    return sections.join("\n");
  }

  // Helper method to calculate order value
  private calculateOrderValue(order: ModernOrder): number {
    // First, try to use the pricing data if available
    if (order.pricing && order.pricing.total !== undefined) {
      return order.pricing.total;
    }

    // Fall back to line items calculation if pricing is not available
    return order.lineItems.reduce((sum, item) => {
      return sum + this.calculateLineItemValue(item);
    }, 0);
  }

  // Helper method to calculate line item value
  private calculateLineItemValue(item: ModernOrder["lineItems"][0]): number {
    // Use totalPrice if available, otherwise calculate from unitPrice * quantity
    if (item.totalPrice) {
      return item.totalPrice;
    } else if (item.unitPrice) {
      return item.unitPrice * (item.quantity || 1);
    }
    return 0;
  }

  // Convert vector search results to ModernOrder format for RAG processing
  private async convertVectorResultsToOrders(
    vectorResults: EnhancedSearchResult[]
  ): Promise<ModernOrder[]> {
    try {
      // Group vector results by job number to aggregate line items
      const jobGroups = new Map<
        string,
        {
          jobData: any;
          lineItems: any[];
          score: number;
        }
      >();

      for (const result of vectorResults) {
        const jobNumber = result.metadata.jobNumber;
        if (!jobNumber) continue;

        if (!jobGroups.has(jobNumber)) {
          // Initialize job data from first result
          jobGroups.set(jobNumber, {
            jobData: {
              jobNumber: result.metadata.jobNumber,
              orderNumber: result.metadata.orderNumber,
              customerId: (result.metadata as any).customerId,
              customerCompany: (result.metadata as any).customerCompany,
              status:
                (result.metadata as any).masterStatus ||
                (result.metadata as any).status,
              dateEntered: result.metadata.dateEntered,
              dateDue: result.metadata.dateDue,
              dateDueFactory: result.metadata.dateDueFactory,
              locationCode: result.metadata.locationCode,
              locationName: result.metadata.locationName,
              deliveryOption: result.metadata.deliveryOption,
              timeSensitive: (result.metadata as any).timeSensitive,
              mustDate: (result.metadata as any).mustDate,
              isReprint: (result.metadata as any).isReprint,
              hasFiles: result.metadata.hasFiles,
              lastUpdated:
                (result.metadata as any).lastAPIUpdate ||
                (result.metadata as any).lastUpdated,
              dataFreshness: (result.metadata as any).dataFreshness || "stale",
            },
            lineItems: [],
            score: result.score,
          });
        }

        const group = jobGroups.get(jobNumber)!;

        // If this is a jobline result, add it as a line item with pricing
        if ((result.metadata as any).type === "jobline") {
          const lineItem = {
            lineId: (result.metadata as any).lineId,
            assetSku: (result.metadata as any).program,
            category: (result.metadata as any).categories?.[0],
            quantity: (result.metadata as any).lineQuantity || 0,
            status: (result.metadata as any).status,
            description: (result.metadata as any).description,
            comment: (result.metadata as any).comment,
            processCodes: (result.metadata as any).processes || [],
            materials: (result.metadata as any).materials || [],
            unitPrice: (result.metadata as any).unitPrice,
            totalPrice: (result.metadata as any).totalPrice,
          };
          group.lineItems.push(lineItem);
        }

        // Update score to highest match
        if (result.score > group.score) {
          group.score = result.score;
        }
      }

      // Convert grouped data to ModernOrder objects
      const orders: ModernOrder[] = [];
      for (const [jobNumber, group] of jobGroups) {
        const order: ModernOrder = {
          jobNumber: group.jobData.jobNumber,
          orderNumber: group.jobData.orderNumber || "",
          description: "", // Will be populated from line items if available
          comments: "",
          jobQuantity: group.lineItems.reduce(
            (sum, item) => sum + (item.quantity || 0),
            0
          ),
          customer: {
            id: group.jobData.customerId || 0,
            company: group.jobData.customerCompany || "",
            contactPerson: "",
            email: "",
            phone: "",
          },
          status: {
            master: group.jobData.status || "",
            masterStatusId: 0,
            stock: "",
            stockComplete: 0,
            statusLine: "",
            statusLineHtml: "",
          },
          dates: {
            dateEntered: group.jobData.dateEntered || new Date().toISOString(),
            dateEnteredUtc:
              group.jobData.dateEntered || new Date().toISOString(),
            dateDue: group.jobData.dateDue || "",
            dateDueUtc: group.jobData.dateDue || "",
            dateDueFactory: group.jobData.dateDueFactory || "",
            daysToDueDate: this.calculateDaysToDueDate(group.jobData.dateDue),
          },
          location: {
            code: group.jobData.locationCode || "",
            name: group.jobData.locationName || "",
            deliveryOption: group.jobData.deliveryOption || "",
          },
          production: {
            processes: group.lineItems.flatMap((item) =>
              (item.processCodes || []).map((code: string) => ({
                code,
                displayCode: code,
                quantity: item.quantity || 0,
                bitVal: 0,
              }))
            ),
            gangCodes: [],
            timeSensitive: group.jobData.timeSensitive || false,
            mustDate: group.jobData.mustDate || false,
            isReprint: group.jobData.isReprint || false,
            isDupe: false,
            canSuggestMachines: false,
            canPrintJobLineLabels: false,
            hasScheduleableJobLines: false,
          },
          lineItems: group.lineItems,
          shipments: [],
          files: [],
          tags: this.extractTagsFromMetadata(group.jobData).map((tag) => ({
            tag,
            enteredBy: "system",
            dateEntered: new Date().toISOString(),
          })),
          workflow: {
            hasScheduleableJobLines: false,
            canPrintJobLineLabels: false,
            hasJobFiles: group.jobData.hasFiles || false,
            hasProof: false,
          },
          metadata: {
            lastAPIUpdate:
              group.jobData.lastUpdated || new Date().toISOString(),
            dataSource: "api",
            dataFreshness: group.jobData.dataFreshness || "stale",
            bitVal: 0,
            sortKey: jobNumber,
          },
        };

        orders.push(order);
      }

      console.log(
        `✅ Converted ${vectorResults.length} vector results to ${
          orders.length
        } orders with ${orders.reduce(
          (sum, order) => sum + order.lineItems.length,
          0
        )} line items`
      );
      return orders;
    } catch (error) {
      console.error("❌ Error converting vector results to orders:", error);
      return [];
    }
  }

  // Calculate days to due date from a date string
  private calculateDaysToDueDate(dateDue: string): number {
    if (!dateDue) return 0;

    try {
      const dueDate = new Date(dateDue);
      const now = new Date();

      // Reset time to start of day for accurate day calculation
      dueDate.setHours(0, 0, 0, 0);
      now.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return diffDays;
    } catch (error) {
      console.warn(
        `⚠️ Failed to calculate days to due date for "${dateDue}":`,
        error
      );
      return 0;
    }
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
    const rushOrders = orders.filter(
      (order) => order.production.timeSensitive || order.production.mustDate
    ).length;
    const lateOrders = orders.filter(
      (order) => order.dates.daysToDueDate < 0
    ).length;

    // Calculate total and average values from line items using the helper method
    const totalValue = orders.reduce((sum, order) => {
      const orderValue = order.lineItems.reduce(
        (orderSum, item) => orderSum + this.calculateLineItemValue(item),
        0
      );
      return sum + orderValue;
    }, 0);

    return {
      totalValue,
      averageValue: orders.length > 0 ? totalValue / orders.length : 0,
      rushOrders,
      lateOrders,
    };
  }

  // Prioritize orders for context based on query relevance
  private prioritizeOrdersForContext(
    orders: ModernOrder[],
    query: string
  ): ModernOrder[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower
      .split(/\s+/)
      .filter((term) => term.length > 2);

    return orders
      .map((order) => {
        let relevanceScore = 0;

        // Score based on description match
        const description = order.description.toLowerCase();
        queryTerms.forEach((term) => {
          if (description.includes(term)) {
            relevanceScore += 10; // High priority for description matches
          }
        });

        // Score based on customer name match
        const customerName = order.customer.company.toLowerCase();
        queryTerms.forEach((term) => {
          if (customerName.includes(term)) {
            relevanceScore += 5;
          }
        });

        // Score based on tags match
        order.tags.forEach((tag) => {
          const tagText = tag.tag.toLowerCase();
          queryTerms.forEach((term) => {
            if (tagText.includes(term)) {
              relevanceScore += 7;
            }
          });
        });

        // Score based on line items match
        order.lineItems.forEach((item) => {
          const itemDescription = (item.description || "").toLowerCase();
          queryTerms.forEach((term) => {
            if (itemDescription.includes(term)) {
              relevanceScore += 8;
            }
          });
        });

        // Score based on comments match
        const comments = order.comments.toLowerCase();
        queryTerms.forEach((term) => {
          if (comments.includes(term)) {
            relevanceScore += 3;
          }
        });

        // Boost recent orders slightly
        const daysSinceEntered = Math.floor(
          (Date.now() - new Date(order.dates.dateEntered).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        if (daysSinceEntered < 30) {
          relevanceScore += 1;
        }

        return { order, relevanceScore };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore) // Sort by relevance descending
      .map((item) => item.order);
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
  private generateCacheKey(
    query: EnhancedRAGQuery,
    context?: RAGContext
  ): string {
    // Create a cache key based primarily on the query content
    // Don't include context results since they're not available during cache check
    const queryHash = JSON.stringify({
      query: query.userQuery.toLowerCase().trim(),
      context: query.context,
      filters: query.filters,
      // Only include context data if it's available (for cache invalidation)
      resultCount: context?.orders?.length || 0,
      strategy: context?.routingInfo?.strategy || "unknown",
    });
    return `enhanced-rag:${Buffer.from(queryHash)
      .toString("base64")
      .substring(0, 32)}`;
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
    return `You are an expert assistant for the Decopress order management system. You help users find, track, and analyze printing and manufacturing orders by interpreting natural language queries and using available functions to retrieve accurate data.

Your role is to:
- Understand what the user is asking
- Identify relevant entities (jobs, customers, assets, shipments)
- Use the appropriate functions to retrieve data when needed
- Return clear, actionable answers based on real system data
- Handle complex multi-step queries that require constraint reasoning and aggregation

## 🔧 Available Functions

You have access to optimized functions that retrieve data from the system with minimal API calls:

**Core Functions (2 API calls max):**
- get_job_list: Get filtered list of jobs (1 API call)
- get_job_details: Get job info + line items with pricing (2 API calls)

**Specialized Functions (1 API call each):**
- get_job_cost: Get detailed cost breakdown
- get_job_shipments: Get shipping status
- get_job_history: Get activity timeline
- get_customer_info: Get customer details
- get_price_bands: Get pricing information
- get_category_units: Get product/material types

**Optimization Strategy:**
1. Start with get_job_list for broad searches
2. Use get_job_details for complete job information (includes pricing)
3. Only call specialized functions when you need specific data not in job details
4. Avoid redundant calls - job details already includes line items with pricing

The functions will be provided to you automatically. Use them strategically to minimize API calls while getting the data you need.

## 🧠 Complex Query Handling

For complex queries involving:
- **Value constraints**: "orders that add up to 10k"
- **Multiple criteria**: "urgent orders from SpaceX due this week"
- **Aggregation**: "total revenue from all orders"
- **Temporal reasoning**: "orders due next week with high value"

Use multiple function calls strategically:
1. First, get a broad list of relevant orders
2. Then, get detailed cost/pricing information for analysis
3. Finally, apply constraints and calculate totals

## 🎯 Response Format Guidelines

**IMPORTANT**: When you find orders/jobs in the data, provide ONLY explanatory text that explains:
- What the user asked for
- What criteria you searched with
- What you found (summary only)
- Any relevant context or insights
- For complex queries, explain your reasoning process

**DO NOT** list individual order details in your response. The system will display orders in an enhanced format below your response.

**Examples of good responses when orders are found:**
- "I found 5 orders due next week (July 8-14, 2025). These orders are currently in production and range from urgent to normal priority."
- "Based on your search for orders tagged 'gamma', I found 3 active jobs with this tag. These are all embroidery orders in various stages of production."
- "Looking for orders from SpaceX, I found 2 active jobs. One is due this week and the other is scheduled for next month."
- "I analyzed orders due next week and found 3 that add up to $9,850 in total value. These include urgent embroidery orders and standard printing jobs."

**Examples of responses when no orders are found:**
- "No orders found matching your criteria. The job number may not exist or may be outside the current active job range."
- "I couldn't find any orders with the tag 'nonexistent'. Please check the spelling or try a different search term."

## 📊 Structured Response Format

When orders are found, return your response in this JSON structure:

\`\`\`json
{
  "introText": "Brief explanation of what was found",
  "orders": [
    {
      "jobNumber": "51132",
      "customer": "SpaceX",
      "description": "Embroidery patches for flight suits",
      "dueDate": "2025-07-10",
      "daysToDue": 3,
      "status": "On Time",
      "quantity": 500,
      "tags": ["gamma", "embroidery"],
      "priority": "urgent",
      "value": 2500.00
    }
  ],
  "summary": {
    "totalOrders": 1,
    "totalValue": 2500.00,
    "urgentCount": 1,
    "overdueCount": 0
  }
}
\`\`\`

**Priority levels:**
- "urgent": Due today, tomorrow, or overdue
- "normal": Due within 7 days
- "low": Due beyond 7 days

## 💡 Guidelines

- Always cite specific job numbers when possible
- Explain why a search returned no results
- Use functions to get fresh data when needed
- Be proactive: suggest follow-up actions ("Would you like to see the total cost?")
- When you need specific data, use the available functions rather than guessing
- For complex queries, explain your multi-step reasoning process
- Handle constraint satisfaction intelligently (e.g., finding combinations that add up to specific values)

You are now ready to answer complex user queries using the full power of the system and available functions.`;
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

  private createStructuredResponseFromContext(
    context: RAGContext,
    userQuery: string
  ): any {
    const orders = context.orders.slice(0, 10).map(toModernOrder);

    // Calculate summary fields using helper methods
    const urgentCount = orders.filter(
      (o) => this.calculatePriority(o.dates.daysToDueDate) === "urgent"
    ).length;
    const overdueCount = orders.filter((o) => o.dates.daysToDueDate < 0).length;
    const totalValue = orders.reduce(
      (sum, o) => sum + (this.calculateOrderValue(o) || 0),
      0
    );

    return {
      introText: `I found ${orders.length} orders matching your query.`,
      orders,
      summary: {
        totalOrders: orders.length,
        totalValue,
        urgentCount,
        overdueCount,
      },
    };
  }

  private calculatePriority(daysToDue: number): "urgent" | "normal" | "low" {
    if (daysToDue < 0 || daysToDue <= 2) return "urgent";
    if (daysToDue <= 7) return "normal";
    return "low";
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

    if (routingResult.fallbacksUsed && routingResult.fallbacksUsed.length > 0) {
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

  /**
   * Process constraint satisfaction queries with aggregation and value calculations
   */
  private async processConstraintQuery(
    query: string,
    orders: ModernOrder[]
  ): Promise<EnhancedRAGResult> {
    try {
      console.log("🔍 [CONSTRAINT] Processing constraint query:", query);
      console.log("🔍 [CONSTRAINT] Input orders count:", orders.length);

      // Parse constraints from the query
      const { constraints, targetValue } =
        this.constraintService.parseConstraints(query);

      console.log("🔍 [CONSTRAINT] Parsed constraints:", {
        constraints,
        targetValue,
      });

      // Process the constraint satisfaction
      const result = await this.constraintService.processConstraintQuery(
        orders,
        constraints,
        targetValue
      );

      console.log("🔍 [CONSTRAINT] Constraint result:", {
        success: result.success,
        orderCount: result.orderCount,
        totalValue: result.totalValue,
        constraintMet: result.constraintMet,
        summary: result.summary,
      });

      // Generate enhanced response with constraint details
      const response = this.generateConstraintResponse(result, query);

      console.log(
        "🔍 [CONSTRAINT] Generated response:",
        response.substring(0, 200) + "..."
      );

      return {
        answer: response,
        confidence: "high",
        sources: {
          orders: result.orders,
          vectorResults: [],
          apiCalls: 1,
          strategy: "api",
        },
        processingTime: Date.now(),
        dataFreshness: "fresh",
        contextQuality: 1.0,
        metadata: {
          totalOrdersAnalyzed: orders.length,
          llmTokensUsed: 0,
          cacheHitsUsed: 0,
          reasoning: "Constraint satisfaction processing",
          functionCallsExecuted: 1,
          planningSteps: 1,
        },
        structuredResponse: {
          introText: result.summary,
          orders: result.orders.map((order) => ({
            jobNumber: order.jobNumber,
            customer: order.customer.company,
            description: order.description,
            dueDate: order.dates.dateDue,
            daysToDue: order.dates.daysToDueDate,
            status: order.status.master,
            quantity: order.jobQuantity,
            tags: order.tags.map((t) => t.tag),
            priority:
              order.dates.daysToDueDate <= 2
                ? "urgent"
                : order.dates.daysToDueDate <= 7
                ? "normal"
                : "low",
            value: order.pricing?.total,
            pricing: order.pricing,
            processes: order.production.processes,
            orderNumber: order.orderNumber,
            stockStatus: order.status.stock,
            timeSensitive: order.production.timeSensitive,
            mustDate: order.production.mustDate,
            isReprint: order.production.isReprint,
            isDupe: order.production.isDupe,
            location: order.location,
          })),
          summary: {
            totalOrders: result.orderCount,
            totalValue: result.totalValue,
            urgentCount: result.orders.filter((o) => o.dates.daysToDueDate <= 2)
              .length,
            overdueCount: result.orders.filter((o) => o.dates.daysToDueDate < 0)
              .length,
          },
        },
      };
    } catch (error) {
      console.error("Error processing constraint query:", error);
      return {
        answer:
          "I encountered an error while processing your constraint query. Please try rephrasing your request.",
        confidence: "low",
        sources: {
          orders: [],
          vectorResults: [],
          apiCalls: 0,
          strategy: "api",
        },
        processingTime: Date.now(),
        dataFreshness: "fresh",
        contextQuality: 0,
        metadata: {
          totalOrdersAnalyzed: 0,
          llmTokensUsed: 0,
          cacheHitsUsed: 0,
          reasoning: "Error in constraint processing",
          functionCallsExecuted: 0,
          planningSteps: 0,
        },
      };
    }
  }

  /**
   * Generate a comprehensive response for constraint satisfaction queries
   */
  private generateConstraintResponse(result: any, query: string): string {
    let response = result.summary + "\n\n";

    if (result.totalValue !== undefined) {
      response += `**Total Value**: $${result.totalValue.toLocaleString(
        "en-US",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}\n\n`;
    }

    if (result.constraintDetails.requestedValue !== undefined) {
      response += `**Requirement**: $${result.constraintDetails.requestedValue.toLocaleString(
        "en-US",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      )}\n`;
      response += `**Status**: ${
        result.constraintMet ? "✅ Met" : "❌ Not Met"
      }\n`;

      if (result.constraintDetails.difference !== undefined) {
        const diff = result.constraintDetails.difference;
        if (diff > 0) {
          response += `**Excess**: $${diff.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}\n`;
        } else if (diff < 0) {
          response += `**Shortfall**: $${Math.abs(diff).toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}\n`;
        }
      }
      response += "\n";
    }

    response += `**Orders Found**: ${result.orderCount}\n\n`;

    if (result.orders.length > 0) {
      response += "**Order Details**:\n";
      result.orders.forEach((order: ModernOrder, index: number) => {
        const orderValue = this.calculateOrderValue(order);
        response += `${index + 1}. **${order.jobNumber}** - ${
          order.description
        }\n`;
        response += `   Customer: ${order.customer.company}\n`;
        response += `   Due: ${order.dates.dateDue}\n`;
        response += `   Status: ${order.status.master}\n`;
        response += `   Value: $${orderValue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}\n\n`;
      });
    }

    return response;
  }

  /**
   * Extract tags from vector metadata for better order enrichment
   */
  private extractTagsFromMetadata(metadata: any): string[] {
    const tags: string[] = [];

    // Add process tags
    if (metadata.processes && Array.isArray(metadata.processes)) {
      metadata.processes.forEach((process: string) => {
        tags.push(`@${process.toLowerCase()}`);
      });
    }

    // Add material tags
    if (metadata.materials && Array.isArray(metadata.materials)) {
      metadata.materials.forEach((material: string) => {
        tags.push(`@${material.toLowerCase()}`);
      });
    }

    // Add category tags
    if (metadata.categories && Array.isArray(metadata.categories)) {
      metadata.categories.forEach((category: string) => {
        tags.push(`@${category.toLowerCase()}`);
      });
    }

    // Add urgency tags
    if (metadata.timeSensitive) {
      tags.push("@rush");
      tags.push("@urgent");
    }

    if (metadata.mustDate) {
      tags.push("@must-date");
    }

    if (metadata.isReprint) {
      tags.push("@reprint");
    }

    // Add status-based tags
    if (metadata.status) {
      const statusLower = metadata.status.toLowerCase();
      if (statusLower.includes("complete")) {
        tags.push("@completed");
      } else if (statusLower.includes("in progress")) {
        tags.push("@in-progress");
      } else if (statusLower.includes("pending")) {
        tags.push("@pending");
      }
    }

    // Add data quality tags
    if (metadata.completenessScore) {
      if (metadata.completenessScore >= 90) {
        tags.push("@high-quality");
      } else if (metadata.completenessScore >= 70) {
        tags.push("@medium-quality");
      } else {
        tags.push("@low-quality");
      }
    }

    return tags;
  }

  /**
   * Check if a query requires constraint satisfaction processing
   */
  private needsConstraintProcessing(query: string): boolean {
    const constraintKeywords = [
      "add up to",
      "total",
      "value",
      "sum",
      "amount",
      "worth",
      "due next week",
      "due this week",
      "due by",
      "due on",
      "that add up",
      "combine to",
      "total value",
      "total amount",
    ];

    const lowerQuery = query.toLowerCase();
    return constraintKeywords.some((keyword) => lowerQuery.includes(keyword));
  }
}

// Export singleton instance
export const enhancedRAGPipeline = new EnhancedRAGPipeline();

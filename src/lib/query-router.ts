// Intelligent Query Router - Smart routing between API calls and vector search
// Analyzes query intent and selects optimal data retrieval strategy

import OpenAI from "openai";
import {
  apiFirstDataService,
  ModernOrder,
  toModernOrder,
} from "./api-first-data-service";
import {
  enhancedVectorPipeline,
  EnhancedSearchResult,
} from "./enhanced-vector-pipeline";
import { keywordDetectionService } from "./keyword-detection-service";
import { standardizedDateParser } from "./standardized-date-parser";
import { enhancedFilteringService } from "./enhanced-filtering-service";
import { contextManagerService } from "./context-manager-service";
import { cacheValidationService } from "./cache-validation-service";
import { noResultsFeedbackService } from "./no-results-feedback-service";
import { EnhancedQueryService } from "./enhanced-query-service";

export interface QueryIntent {
  type: "search" | "filter" | "specific";
  strategy: "api" | "vector" | "hybrid";
  confidence: number;
  explanation: string;
  extractedEntities: {
    jobNumbers?: string[];
    customers?: string[];
    statuses?: string[];
    dateRanges?: Array<{ start: string; end: string; description?: string }>;
    tags?: string[];
    excludeTags?: string[];
    keywords?: string[];
    limit?: number; // Quantity limit from queries like "show me X jobs"
  };
}

export interface QueryContext {
  userPreferences?: {
    preferFreshData?: boolean;
    includeAnalytics?: boolean;
    maxResponseTime?: number;
  };
  systemState?: {
    apiHealth: "healthy" | "degraded" | "offline";
    vectorHealth: "healthy" | "degraded" | "offline";
    cacheHealth: "healthy" | "degraded" | "offline";
  };
  previousQueries?: string[];
}

export interface RoutedQueryResult {
  strategy: "api" | "vector" | "hybrid";
  processingTime: number;
  dataFreshness: "fresh" | "cached" | "stale";
  confidence: number;
  sources: string[];
  results: {
    orders?: ModernOrder[];
    vectorResults?: EnhancedSearchResult[];
    analytics?: any;
    summary?: string;
  };
  fallbacksUsed?: string[];
  performanceMetrics: {
    apiCalls: number;
    vectorQueries: number;
    cacheHits: number;
    cacheMisses: number;
  };
  recommendations?: string[];
  realtimePopulation?: {
    jobsAdded: number;
    jobsFailed: number;
    errors: string[];
  };
  debugLogs?: string[];
}

export class IntelligentQueryRouter {
  private cache: Map<
    string,
    { result: RoutedQueryResult; timestamp: number; ttl: number }
  > = new Map();

  // Cache for GPT intent analysis to avoid re-parsing similar queries
  private intentCache: Map<
    string,
    { intent: QueryIntent; timestamp: number; ttl: number }
  > = new Map();

  // Debug logging capture
  private debugLogs: string[] = [];
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  private queryHistory: Array<{
    query: string;
    intent: QueryIntent;
    timestamp: number;
  }> = [];
  private performanceStats = {
    totalQueries: 0,
    apiQueries: 0,
    vectorQueries: 0,
    hybridQueries: 0,
    averageResponseTime: 0,
    cacheHitRate: 0,
    successfulQueries: 0,
    successRate: 0,
  };
  private enhancedQueryService: EnhancedQueryService;

  constructor() {
    // Clean up old cache entries every 10 minutes
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000);

    // Initialize enhanced query service for real-time population
    this.enhancedQueryService = new EnhancedQueryService();
    this.enhancedQueryService.initialize().catch((error) => {
      console.error("❌ Failed to initialize enhanced query service:", error);
    });

    // Capture original console methods
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  // Main query routing method
  async routeQuery(
    query: string,
    context: QueryContext = {}
  ): Promise<RoutedQueryResult> {
    const startTime = Date.now();
    this.performanceStats.totalQueries++;

    // Start capturing debug logs
    this.startLogCapture();

    try {
      // 1. Check cache first
      const cacheKey = this.generateCacheKey(query, context);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        const result: RoutedQueryResult = {
          ...cached,
          processingTime: Date.now() - startTime,
          dataFreshness: "cached" as const,
          performanceMetrics: {
            ...cached.performanceMetrics,
            cacheHits: cached.performanceMetrics.cacheHits + 1,
          },
          debugLogs: this.getCapturedLogs(),
        };
        this.stopLogCapture();
        return result;
      }

      // 2. Analyze query intent
      const intent = await this.analyzeQueryIntent(query);
      this.addToQueryHistory(query, intent);

      // 3. Get system health
      const systemState = await this.getSystemState();
      const contextWithState = { ...context, systemState };

      // 4. Route based on strategy
      let result: RoutedQueryResult;

      switch (intent.strategy) {
        case "api":
          result = await this.executeAPIStrategy(
            query,
            intent,
            contextWithState
          );
          this.performanceStats.apiQueries++;
          break;
        case "vector":
          result = await this.executeVectorStrategy(
            query,
            intent,
            contextWithState
          );
          this.performanceStats.vectorQueries++;
          break;
        case "hybrid":
          result = await this.executeHybridStrategy(
            query,
            intent,
            contextWithState
          );
          this.performanceStats.hybridQueries++;
          break;
        default:
          // Fallback to vector search
          result = await this.executeVectorStrategy(
            query,
            intent,
            contextWithState
          );
          this.performanceStats.vectorQueries++;
          break;
      }

      // 5. Update performance metrics
      const processingTime = Date.now() - startTime;
      result.processingTime = processingTime;
      this.updatePerformanceStats(processingTime);

      // 6. Cache result if appropriate
      if (this.shouldCacheResult(result, intent)) {
        this.cacheResult(cacheKey, result, this.getTTL(intent));
      }

      // 7. Add recommendations
      result.recommendations = this.generateRecommendations(result, intent);

      // Performance alerts
      if (processingTime > 20000) {
        console.error(
          `🚨 [PERFORMANCE-ERROR] Query took ${processingTime}ms (>20s): "${query}"`
        );
      } else if (processingTime > 5000) {
        console.warn(
          `⚠️ [PERFORMANCE-WARNING] Query took ${processingTime}ms (>5s): "${query}"`
        );
      } else {
        console.log(
          `✅ [PERFORMANCE] Query completed in ${processingTime}ms: "${query}"`
        );
      }

      // 8. Add debug logs to result
      result.debugLogs = this.getCapturedLogs();

      // 9. Add API call summary at the end
      const apiCallSummary = `📊 [API-CALL-SUMMARY] Total API Calls: ${result.performanceMetrics.apiCalls}, Vector Queries: ${result.performanceMetrics.vectorQueries}, Cache Hits: ${result.performanceMetrics.cacheHits}, Cache Misses: ${result.performanceMetrics.cacheMisses}`;
      console.log(apiCallSummary);
      result.debugLogs.push(apiCallSummary);

      this.stopLogCapture();
      return result;
    } catch (error) {
      console.error("❌ Query routing failed:", error);

      // Return error fallback with debug logs
      const result: RoutedQueryResult = {
        strategy: "vector",
        processingTime: Date.now() - startTime,
        dataFreshness: "stale",
        confidence: 0.1,
        sources: ["fallback"],
        results: {
          orders: [],
          summary: `Query failed: ${(error as Error).message}`,
        },
        fallbacksUsed: ["error-fallback"],
        performanceMetrics: {
          apiCalls: 0,
          vectorQueries: 0,
          cacheHits: 0,
          cacheMisses: 1,
        },
        recommendations: ["Please try a simpler query or check system health"],
        debugLogs: this.getCapturedLogs(),
      };

      // Add API call summary for error case too
      const apiCallSummary = `📊 [API-CALL-SUMMARY] Total API Calls: ${result.performanceMetrics.apiCalls}, Vector Queries: ${result.performanceMetrics.vectorQueries}, Cache Hits: ${result.performanceMetrics.cacheHits}, Cache Misses: ${result.performanceMetrics.cacheMisses}`;
      console.log(apiCallSummary);
      if (result.debugLogs) {
        result.debugLogs.push(apiCallSummary);
      }

      this.stopLogCapture();
      return result;
    }
  }

  // Analyze query to determine intent and strategy
  private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    console.log(`🔍 [ROUTER] Analyzing query intent for: \"${query}\"`);

    // Check intent cache first
    const intentCacheKey = `intent:${query.toLowerCase().trim()}`;
    const cachedIntent = this.intentCache.get(intentCacheKey);
    if (
      cachedIntent &&
      Date.now() - cachedIntent.timestamp < cachedIntent.ttl
    ) {
      console.log(`📦 [INTENT-CACHE] Cache hit for query: \"${query}\"`);
      return cachedIntent.intent;
    }

    try {
      // Use GPT to analyze query intent instead of pattern matching
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY || "",
        timeout: 10000,
      });

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert query analyzer for an Order Management System. Analyze the user's query and determine the best strategy for retrieving order data.

Current Date Context: ${
              new Date().toISOString().split("T")[0]
            } (${new Date().toLocaleDateString()})

CRITICAL SPECIFIC ORDER DETECTION:
- When users ask for specific order details, set type to "specific" and strategy to "api"
- Look for patterns like: "show me order 50194", "show me job 12345", "order details for 67890", "more on order 12345"
- These queries should extract job numbers and use API strategy for complete order details including line items

CRITICAL DATE PARSING RULES:
- "this week" = current week (Monday-Sunday of current week)
- "next week" = following week (Monday-Sunday of next week) 
- "last week" = previous week (Monday-Sunday of last week)
- "today" = current date
- "tomorrow" = current date + 1 day
- "yesterday" = current date - 1 day

DATE CALCULATION EXAMPLES:
- If today is July 6, 2025 (Sunday):
  * "this week" = July 7-13, 2025 (Monday-Sunday)
  * "next week" = July 14-20, 2025 (Monday-Sunday)
  * "last week" = June 30-July 6, 2025 (Monday-Sunday)

CRITICAL TAG HANDLING RULES:
- Tags can be prefixed with "@" (e.g., "@laser", "@urgent")
- Tags can be plain text (e.g., "production", "urgent")
- "tagged X" means include orders that have tag containing "X"
- "not tagged X" means exclude orders that have tag containing "X"
- Tag matching is case-insensitive and uses partial matching
- Common tags: "@laser", "production", "urgent", "priority", "gamma", "ps-done"

CRITICAL BUSINESS LOGIC:
- "overdue" = jobs where dateDue < today AND status is not "Completed"
- "high priority" = jobs with tags containing "urgent", "priority", "@urgent", or due within 2 days
- "urgent" = same as "high priority"
- "not tagged X" = exclude jobs that have tags containing "X"

STRATEGY SELECTION:
- "api": Use for specific job numbers, simple filters, or when you have high confidence in exact matches
- "vector": Use for semantic searches, complex descriptions, or when you need to find similar orders
- "hybrid": Use for complex queries with multiple filters, date ranges, or when you want to combine API precision with vector flexibility

QUANTITY LIMIT EXTRACTION:
- Look for phrases like "show me X jobs", "give me N orders", "top 5", "first 10", "a few", "several"
- If a specific number is mentioned, set "limit" to that number
- If "a few" is used, set limit to 3
- If "several" is used, set limit to 5
- If no limit is specified, set limit to null

SPECIFIC ORDER EXAMPLES:
- "show me order 50194" → type: "specific", strategy: "api", jobNumbers: ["50194"]
- "show me job details for 12345" → type: "specific", strategy: "api", jobNumbers: ["12345"]
- "more on order 67890" → type: "specific", strategy: "api", jobNumbers: ["67890"]
- "order details for x" → type: "specific", strategy: "api", jobNumbers: ["x"]

TAG EXTRACTION EXAMPLES:
- "tagged @laser" → tags: ["@laser"]
- "tagged production" → tags: ["production"]
- "tagged in production" → tags: ["production"] (extract "production" from "in production")
- "not tagged gamma" → excludeTags: ["gamma"]
- "tagged urgent" → tags: ["urgent"]

Return a JSON object with this exact structure:
{
  "type": "search|filter|specific",
  "strategy": "api|vector|hybrid",
  "confidence": 0.0-1.0,
  "extractedEntities": {
    "jobNumbers": ["12345", "67890"],
    "customers": ["customer name"],
    "dateRanges": [{"start": "2025-07-01", "end": "2025-07-07", "description": "next week"}],
    "statuses": ["approved", "overdue", "urgent"],
    "tags": ["@laser", "production"],
    "excludeTags": ["gamma", "ps-done"],
    "keywords": ["embroidery", "screen printing"],
    "limit": 5
  },
  "explanation": "Brief explanation of why this strategy was chosen"
}`,
          },
          {
            role: "user",
            content: `Analyze this query: "${query}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from GPT");
      }

      // Parse the JSON response
      const parsedIntent = JSON.parse(content) as QueryIntent;

      // ADD DEBUG LOGGING
      console.log("🔍 [INTENT-DEBUG] Raw query:", query);
      console.log(
        "🔍 [INTENT-DEBUG] GPT parsed intent:",
        JSON.stringify(parsedIntent, null, 2)
      );

      // Cache the intent for future use
      this.intentCache.set(intentCacheKey, {
        intent: parsedIntent,
        timestamp: Date.now(),
        ttl: 5 * 60 * 1000, // 5 minutes
      });

      return parsedIntent;
    } catch (error) {
      console.error("❌ [ROUTER] Error analyzing query intent:", error);

      // Fallback to basic pattern matching
      return this.fallbackPatternAnalysis(query);
    }
  }

  // Simple fallback pattern analysis for when GPT fails
  private fallbackPatternAnalysis(query: string): QueryIntent {
    const queryLower = query.toLowerCase();

    // Enhanced specific order detection patterns
    const specificOrderPatterns = [
      /show\s+me\s+(?:order|job)\s+(\d+)/i,
      /(?:order|job)\s+details?\s+for\s+(\d+)/i,
      /more\s+(?:on|about)\s+(?:order|job)\s+(\d+)/i,
      /get\s+(?:order|job)\s+(\d+)/i,
      /find\s+(?:order|job)\s+(\d+)/i,
    ];

    // Check for specific order requests first
    for (const pattern of specificOrderPatterns) {
      const match = query.match(pattern);
      if (match && match[1]) {
        return {
          type: "specific",
          strategy: "api",
          confidence: 0.9,
          explanation: "Fallback: Specific order detail request detected",
          extractedEntities: {
            jobNumbers: [match[1]],
          },
        };
      }
    }

    // Check for general job numbers
    const hasJobNumber = /\b\d{5,}\b/.test(query);
    const hasKeywords = /gamma|ps done|@laser|embroidery|hardware/i.test(query);

    if (hasJobNumber) {
      return {
        type: "specific",
        strategy: "api",
        confidence: 0.8,
        explanation: "Fallback: Job number detected",
        extractedEntities: {
          jobNumbers: query.match(/\b\d{5,}\b/g) || [],
        },
      };
    }

    if (hasKeywords) {
      return {
        type: "filter",
        strategy: "hybrid",
        confidence: 0.6,
        explanation: "Fallback: Keywords detected",
        extractedEntities: {
          keywords:
            queryLower.match(/gamma|ps done|@laser|embroidery|hardware/gi) ||
            [],
        },
      };
    }

    return {
      type: "search",
      strategy: "vector",
      confidence: 0.5,
      explanation: "Fallback: Default semantic search",
      extractedEntities: {},
    };
  }

  // Execute API-first strategy
  private async executeAPIStrategy(
    query: string,
    intent: QueryIntent,
    context: QueryContext
  ): Promise<RoutedQueryResult> {
    console.log("🎯 Executing API strategy for query:", query);

    const performanceMetrics = {
      apiCalls: 0,
      vectorQueries: 0,
      cacheHits: 0,
      cacheMisses: 1,
    };

    try {
      let orders: ModernOrder[] = [];
      const sources = ["api"];

      // Route based on extracted entities
      if (intent.extractedEntities.jobNumbers?.length) {
        // Get specific orders by job number
        for (const jobNumber of intent.extractedEntities.jobNumbers) {
          const order = await apiFirstDataService.getOrderByJobNumber(
            jobNumber
          );
          if (order) {
            orders.push(order);
          }
        }
        performanceMetrics.apiCalls++;
      } else {
        // Search orders by query - FETCH DATA FIRST, then filter
        console.log("🔍 Searching orders for:", query);

        // Always fetch all orders first WITH enrichment for pricing data, then apply filtering
        const ordersData = await apiFirstDataService.getAllOrdersWithEnrichment(
          {
            pageSize: 500,
            includeLineItems: true, // Include line items for pricing calculation
            includeShipments: false, // Not needed for pricing
            includeFiles: false, // Not needed for pricing
          }
        );
        orders = ordersData.orders || [];
        performanceMetrics.apiCalls++;

        // Apply filtering based on GPT intent analysis AFTER fetching
        const filterResult =
          enhancedFilteringService.parseFilterQueryFromIntent(query, intent);

        if (
          filterResult.isNegationQuery ||
          filterResult.criteria.excludeTags ||
          filterResult.criteria.includeStatuses ||
          filterResult.criteria.dateRange ||
          filterResult.criteria.customers ||
          filterResult.criteria.includeTags ||
          filterResult.criteria.includeKeywords
        ) {
          console.log(
            `🔍 [QUERY-ROUTER] Applying client-side filtering for complex query: ${filterResult.filterDescription}`
          );
          orders = enhancedFilteringService.applyFilters(
            orders,
            filterResult.criteria
          );
        }

        // Apply quantity limit if specified in the query
        if (
          intent.extractedEntities.limit &&
          intent.extractedEntities.limit > 0
        ) {
          const originalCount = orders.length;
          orders = orders.slice(0, intent.extractedEntities.limit);
          console.log(
            `🔢 [LIMIT-APPLIED] Reduced from ${originalCount} to ${orders.length} orders as requested (limit: ${intent.extractedEntities.limit})`
          );
        }
      }

      return {
        strategy: "api",
        processingTime: 0, // Will be set by caller
        dataFreshness: "fresh",
        confidence: intent.confidence,
        sources,
        results: {
          orders: orders, // Orders are already in ModernOrder format from API service
          summary: `Found ${orders.length} orders using API data`,
        },
        performanceMetrics,
      };
    } catch (error) {
      console.error(
        "❌ API strategy failed, falling back to vector search:",
        error
      );

      // Fallback to vector search
      const fallbackResult = await this.executeVectorStrategy(
        query,
        intent,
        context
      );
      fallbackResult.fallbacksUsed = ["api-to-vector"];
      return fallbackResult;
    }
  }

  // Execute vector search strategy
  private async executeVectorStrategy(
    query: string,
    intent: QueryIntent,
    context: QueryContext
  ): Promise<RoutedQueryResult> {
    console.log("🔍 Executing vector strategy for query:", query);

    const performanceMetrics = {
      apiCalls: 0,
      vectorQueries: 1,
      cacheHits: 0,
      cacheMisses: 1,
    };

    try {
      // Build search filters from extracted entities
      const filters: any = {};

      if (
        intent.extractedEntities.customers?.length &&
        intent.extractedEntities.customers.length > 0
      ) {
        filters.customerCompany = intent.extractedEntities.customers[0];
      }

      if (
        intent.extractedEntities.statuses?.length &&
        intent.extractedEntities.statuses.length > 0
      ) {
        filters.status = intent.extractedEntities.statuses[0];
      }

      if (
        intent.extractedEntities.keywords?.length &&
        intent.extractedEntities.keywords.length > 0
      ) {
        filters.keywords = intent.extractedEntities.keywords;
      }

      // Enhanced dynamic result count based on query intent and content
      let topK = this.calculateDynamicTopK(query, intent);

      // Execute vector search with fallback mechanism
      let searchResult = await this.enhancedQueryService.search({
        query,
        topK,
        filters,
        enableRealtimePopulation: true, // Enable real-time job population
        maxRealtimeJobs: 3, // Limit jobs added per search
      });

      let vectorResults = searchResult.results;
      let fallbacksUsed: string[] = [];

      // If no results with strict filters, try with broader criteria
      if (vectorResults.length === 0 && Object.keys(filters).length > 0) {
        console.log(
          "⚠️ No results with strict filters, trying broader search..."
        );

        // Create broader filters by removing restrictive ones
        const broaderFilters = this.createBroaderFilters(filters);

        const fallbackResult = await this.enhancedQueryService.search({
          query,
          topK: Math.min(topK * 2, 50), // Increase topK for broader search
          filters: broaderFilters,
          enableRealtimePopulation: true,
          maxRealtimeJobs: 5, // Allow more real-time jobs for broader search
        });

        if (fallbackResult.results.length > 0) {
          console.log(
            `✅ Found ${fallbackResult.results.length} results with broader filters`
          );
          searchResult = fallbackResult;
          vectorResults = fallbackResult.results;
          fallbacksUsed.push("broader-filters");
        } else {
          console.log(
            "⚠️ Still no results with broader filters, trying unfiltered search..."
          );

          // Try completely unfiltered search
          const unfilteredResult = await this.enhancedQueryService.search({
            query,
            topK: Math.min(topK * 3, 75), // Even more results for unfiltered search
            filters: {},
            enableRealtimePopulation: true,
            maxRealtimeJobs: 8,
          });

          if (unfilteredResult.results.length > 0) {
            console.log(
              `✅ Found ${unfilteredResult.results.length} results with unfiltered search`
            );
            searchResult = unfilteredResult;
            vectorResults = unfilteredResult.results;
            fallbacksUsed.push("unfiltered-search");
          }
        }
      }

      // 🎯 FIXED: Calculate confidence based on actual vector search results
      let resultConfidence = intent.confidence; // Start with intent confidence

      if (vectorResults.length > 0) {
        // Calculate average similarity score of top results
        const topResults = vectorResults.slice(0, 5); // Top 5 results
        const avgSimilarity =
          topResults.reduce((sum, result) => sum + result.score, 0) /
          topResults.length;

        // Map similarity scores to confidence levels
        if (avgSimilarity >= 0.8) {
          resultConfidence = 0.95; // Excellent match
        } else if (avgSimilarity >= 0.6) {
          resultConfidence = 0.85; // Good match
        } else if (avgSimilarity >= 0.4) {
          resultConfidence = 0.65; // Moderate match
        } else if (avgSimilarity >= 0.2) {
          resultConfidence = 0.45; // Weak match
        } else {
          resultConfidence = 0.25; // Poor match
        }

        console.log(
          `🎯 Vector confidence: intent=${
            intent.confidence
          }, avgSimilarity=${avgSimilarity.toFixed(
            3
          )}, final=${resultConfidence}`
        );
      } else {
        resultConfidence = 0.1; // No results found
        console.log("🎯 Vector confidence: no results found, confidence=0.1");
      }

      // Add real-time population info to summary
      let summary = `Found ${vectorResults.length} similar orders using semantic search`;
      if (searchResult.stats.realtimeJobsAdded > 0) {
        summary += ` (added ${searchResult.stats.realtimeJobsAdded} new jobs in real-time)`;
      }

      // Apply quantity limit if specified in the query
      if (
        intent.extractedEntities.limit &&
        intent.extractedEntities.limit > 0
      ) {
        const originalCount = vectorResults.length;
        vectorResults = vectorResults.slice(0, intent.extractedEntities.limit);
        console.log(
          `🔢 [LIMIT-APPLIED] Reduced vector results from ${originalCount} to ${vectorResults.length} as requested (limit: ${intent.extractedEntities.limit})`
        );
      }

      return {
        strategy: "vector",
        processingTime: 0, // Will be set by caller
        dataFreshness: "cached",
        confidence: resultConfidence, // ✅ FIXED: Use result-based confidence
        sources: ["vector-db", "realtime-population"],
        results: {
          vectorResults,
          summary,
        },
        performanceMetrics,
        fallbacksUsed, // Add fallback information
        // Add real-time population metrics
        realtimePopulation: {
          jobsAdded: searchResult.stats.realtimeJobsAdded,
          jobsFailed: searchResult.realtimeJobs.failed.length,
          errors: searchResult.realtimeJobs.errors,
        },
      };
    } catch (error) {
      console.error("❌ Vector strategy failed:", error);
      throw error;
    }
  }

  // Execute hybrid strategy (combine API + vector)
  private async executeHybridStrategy(
    query: string,
    intent: QueryIntent,
    context: QueryContext
  ): Promise<RoutedQueryResult> {
    console.log("🔀 Executing hybrid strategy for query:", query);

    const performanceMetrics = {
      apiCalls: 0,
      vectorQueries: 0,
      cacheHits: 0,
      cacheMisses: 1,
    };

    try {
      // Execute both strategies in parallel
      const [apiResult, vectorResult] = await Promise.allSettled([
        this.executeAPIStrategy(query, intent, context),
        this.executeVectorStrategy(query, intent, context),
      ]);

      const sources = ["hybrid"];
      let orders: ModernOrder[] = [];
      let vectorResults: EnhancedSearchResult[] = [];

      // Combine results
      if (apiResult.status === "fulfilled") {
        orders = apiResult.value.results.orders || [];
        performanceMetrics.apiCalls +=
          apiResult.value.performanceMetrics.apiCalls;
        sources.push("api");
      }

      if (vectorResult.status === "fulfilled") {
        vectorResults = vectorResult.value.results.vectorResults || [];
        performanceMetrics.vectorQueries +=
          vectorResult.value.performanceMetrics.vectorQueries;
        sources.push("vector-db");
      }

      // Enrich vector results to ModernOrder and merge with API orders
      const jobNumbersInOrders = new Set(orders.map((o) => o.jobNumber));
      const enrichedVectorOrders: ModernOrder[] = [];

      // Limit the number of vector results to enrich to avoid too many API calls
      const maxVectorEnrichment = 10;
      const vectorResultsToEnrich = vectorResults.slice(0, maxVectorEnrichment);

      for (const v of vectorResultsToEnrich) {
        if (!jobNumbersInOrders.has(v.metadata.jobNumber)) {
          // Try to fetch full order details from API
          try {
            const fullOrder = await apiFirstDataService.getOrderByJobNumber(
              v.metadata.jobNumber
            );
            if (fullOrder) {
              enrichedVectorOrders.push(fullOrder);
            } else {
              // Fallback: convert vector metadata to ModernOrder (may be partial)
              enrichedVectorOrders.push(toModernOrder(v.metadata));
            }
          } catch (err) {
            // Fallback: convert vector metadata to ModernOrder (may be partial)
            enrichedVectorOrders.push(toModernOrder(v.metadata));
          }
        }
      }

      // Add remaining vector results as metadata-only (no API enrichment)
      const remainingVectorResults = vectorResults.slice(maxVectorEnrichment);
      for (const v of remainingVectorResults) {
        if (!jobNumbersInOrders.has(v.metadata.jobNumber)) {
          enrichedVectorOrders.push(toModernOrder(v.metadata));
        }
      }

      // Merge and deduplicate
      let allOrders = [...orders, ...enrichedVectorOrders];

      // 🔍 Apply EnhancedFilteringService filtering if needed
      const filterResult = enhancedFilteringService.parseFilterQueryFromIntent(
        query,
        intent
      );
      if (
        filterResult.criteria.excludeTags &&
        filterResult.criteria.excludeTags.length > 0
      ) {
        console.log(
          `🚫 [HYBRID-STRATEGY] Applying tag exclusions: ${filterResult.criteria.excludeTags.join(
            ", "
          )}`
        );
        const beforeCount = allOrders.length;
        allOrders = enhancedFilteringService.applyFilters(
          allOrders,
          filterResult.criteria
        );
        console.log(
          `✅ [HYBRID-STRATEGY] After filtering: ${allOrders.length}/${beforeCount} orders remaining`
        );
      }

      // Apply quantity limit if specified in the query
      if (
        intent.extractedEntities.limit &&
        intent.extractedEntities.limit > 0
      ) {
        const originalCount = allOrders.length;
        allOrders = allOrders.slice(0, intent.extractedEntities.limit);
        console.log(
          `🔢 [LIMIT-APPLIED] Reduced hybrid results from ${originalCount} to ${allOrders.length} as requested (limit: ${intent.extractedEntities.limit})`
        );
      }

      // Generate analytics if it's a search query with sufficient data
      let analytics = undefined;
      if (intent.type === "search" && allOrders.length > 0) {
        analytics = await this.generateAnalytics(allOrders, query);
      }

      return {
        strategy: "hybrid",
        processingTime: 0, // Will be set by caller
        dataFreshness: "fresh",
        confidence: Math.max(intent.confidence, 0.8),
        sources,
        results: {
          orders: allOrders, // Don't convert again - orders are already ModernOrder format
          vectorResults,
          analytics,
          summary: `Combined API (${orders.length} orders) and vector search (${vectorResults.length} similar orders)`,
        },
        performanceMetrics,
      };
    } catch (error) {
      console.error("❌ Hybrid strategy failed:", error);
      throw error;
    }
  }

  // Get current system health
  private async getSystemState(): Promise<QueryContext["systemState"]> {
    try {
      const [apiHealth, vectorHealth] = await Promise.allSettled([
        apiFirstDataService.healthCheck(),
        enhancedVectorPipeline.healthCheck(),
      ]);

      return {
        apiHealth:
          apiHealth.status === "fulfilled" && apiHealth.value.healthy
            ? "healthy"
            : "degraded",
        vectorHealth:
          vectorHealth.status === "fulfilled" && vectorHealth.value.healthy
            ? "healthy"
            : "degraded",
        cacheHealth: "healthy", // Could add cache health check
      };
    } catch (error) {
      return {
        apiHealth: "offline",
        vectorHealth: "offline",
        cacheHealth: "offline",
      };
    }
  }

  // Generate analytics for analytical queries
  private async generateAnalytics(orders: ModernOrder[], query: string) {
    const analytics = {
      totalOrders: orders.length,
      totalValue: orders.reduce(
        (sum, order) =>
          sum +
          (order.lineItems?.reduce(
            (lineSum, item) => lineSum + (item.totalPrice || 0),
            0
          ) || 0),
        0
      ),
      statusBreakdown: {} as Record<string, number>,
      customerBreakdown: {} as Record<string, number>,
      averageDaysToCompletion: 0,
      urgentOrders: 0,
      lateOrders: 0,
    };

    // Calculate status breakdown
    orders.forEach((order) => {
      const status = order.status.master;
      analytics.statusBreakdown[status] =
        (analytics.statusBreakdown[status] || 0) + 1;
    });

    // Calculate customer breakdown
    orders.forEach((order) => {
      const customer = order.customer.company;
      analytics.customerBreakdown[customer] =
        (analytics.customerBreakdown[customer] || 0) + 1;
    });

    // Calculate averages and counts
    analytics.urgentOrders = orders.filter(
      (order) => order.production.timeSensitive
    ).length;
    analytics.lateOrders = orders.filter(
      (order) => order.dates.daysToDueDate < 0
    ).length;

    const completedOrders = orders.filter(
      (order) =>
        order.status.master.toLowerCase().includes("complete") ||
        order.status.master.toLowerCase().includes("shipped")
    );

    if (completedOrders.length > 0) {
      analytics.averageDaysToCompletion =
        completedOrders.reduce((sum, order) => {
          const entered = new Date(order.dates.dateEntered);
          const due = new Date(order.dates.dateDue);
          return (
            sum +
            Math.abs(
              (due.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24)
            )
          );
        }, 0) / completedOrders.length;
    }

    return analytics;
  }

  // Cache management methods
  private generateCacheKey(query: string, context: QueryContext): string {
    // Normalize query for better cache hits
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, " ");

    // Include more context for better cache differentiation
    const contextKey = context.userPreferences?.preferFreshData
      ? "fresh"
      : "default";

    // Add query complexity indicator to prevent cross-contamination
    const isComplexQuery = this.isComplexQuery(normalizedQuery);
    const complexityKey = isComplexQuery ? "complex" : "simple";

    // Include system state in cache key
    const systemState = context.systemState
      ? `${context.systemState.apiHealth}-${context.systemState.vectorHealth}`
      : "unknown";

    return `query:${normalizedQuery}:${contextKey}:${complexityKey}:${systemState}`;
  }

  private isComplexQuery(query: string): boolean {
    // Detect complex queries that should not be cached
    const complexPatterns = [
      /\d+\s*(k|thousand|grand)/i, // Value-based queries
      /add\s+up\s+to/i, // Summation queries
      /total.*value/i, // Total value queries
      /combination/i, // Combination queries
      /between.*and/i, // Range queries with values
    ];

    return complexPatterns.some((pattern) => pattern.test(query));
  }

  private getCachedResult(cacheKey: string): RoutedQueryResult | null {
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.result;
    }
    return null;
  }

  private cacheResult(
    cacheKey: string,
    result: RoutedQueryResult,
    ttl: number
  ): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl,
    });
  }

  private shouldCacheResult(
    result: RoutedQueryResult,
    intent: QueryIntent
  ): boolean {
    // Temporarily disable caching for complex queries to prevent cross-contamination
    if (this.isComplexQuery(intent.explanation || "")) {
      console.log(
        "🔒 [CACHE] Skipping cache for complex query to prevent contamination"
      );
      return false;
    }

    // Cache successful results with good confidence
    // Also cache results with no orders to avoid repeated failed searches
    return result.confidence > 0.3 && result.results.orders !== undefined;
  }

  private getTTL(intent: QueryIntent): number {
    // Different TTL based on query type
    switch (intent.type) {
      case "specific":
        return 2 * 60 * 1000; // 2 minutes for specific queries (fresher data)
      case "filter":
        return 5 * 60 * 1000; // 5 minutes for filter queries
      case "search":
        return 10 * 60 * 1000; // 10 minutes for search queries
      default:
        return 5 * 60 * 1000; // 5 minutes default
    }
  }

  // Clean up expired cache entries
  private cleanupCache(): void {
    const now = Date.now();

    // Clean up main cache
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.cache.delete(key);
      }
    }

    // Clean up intent cache
    for (const [key, value] of this.intentCache.entries()) {
      if (now - value.timestamp > value.ttl) {
        this.intentCache.delete(key);
      }
    }
  }

  // Performance tracking
  private updatePerformanceStats(processingTime: number): void {
    this.performanceStats.averageResponseTime =
      (this.performanceStats.averageResponseTime *
        (this.performanceStats.totalQueries - 1) +
        processingTime) /
      this.performanceStats.totalQueries;

    const cacheHits = Array.from(this.cache.values()).reduce(
      (sum, cached) => sum + cached.result.performanceMetrics.cacheHits,
      0
    );
    const totalCacheRequests = cacheHits + this.performanceStats.totalQueries;
    this.performanceStats.cacheHitRate =
      totalCacheRequests > 0 ? cacheHits / totalCacheRequests : 0;
  }

  private addToQueryHistory(query: string, intent: QueryIntent): void {
    this.queryHistory.push({
      query,
      intent,
      timestamp: Date.now(),
    });

    // Keep only last 100 queries
    if (this.queryHistory.length > 100) {
      this.queryHistory = this.queryHistory.slice(-100);
    }
  }

  private generateRecommendations(
    result: RoutedQueryResult,
    intent: QueryIntent
  ): string[] {
    const recommendations: string[] = [];

    if (result.confidence < 0.5) {
      recommendations.push(
        "Try rephrasing your query with more specific terms"
      );
    }

    if (
      result.strategy === "vector" &&
      intent.extractedEntities.jobNumbers?.length &&
      intent.extractedEntities.jobNumbers.length > 0
    ) {
      recommendations.push(
        "For specific job numbers, try searching by exact job number for fresh data"
      );
    }

    if (result.results.orders && result.results.orders.length === 0) {
      recommendations.push(
        "Try broadening your search terms or check for typos"
      );
    }

    if (result.fallbacksUsed?.length && result.fallbacksUsed.length > 0) {
      recommendations.push(
        "Some services were unavailable, results may be incomplete"
      );
    }

    return recommendations;
  }

  // Public methods for monitoring and stats
  getPerformanceStats() {
    return { ...this.performanceStats };
  }

  getQueryHistory(limit = 10) {
    return this.queryHistory.slice(-limit);
  }

  getCacheStats() {
    this.cleanupCache();
    return {
      mainCache: {
        size: this.cache.size,
        entries: Array.from(this.cache.entries()).map(([key, value]) => ({
          key: key.substring(0, 50) + "...",
          age: Date.now() - value.timestamp,
          ttl: value.ttl,
        })),
      },
      intentCache: {
        size: this.intentCache.size,
        entries: Array.from(this.intentCache.entries()).map(([key, value]) => ({
          key: key.substring(0, 50) + "...",
          age: Date.now() - value.timestamp,
          ttl: value.ttl,
        })),
      },
    };
  }

  clearCache(): void {
    this.cache.clear();
    this.intentCache.clear();
  }

  /**
   * Calculate dynamic topK based on query intent and content analysis
   */
  private calculateDynamicTopK(query: string, intent: QueryIntent): number {
    const queryLower = query.toLowerCase();

    // Base topK based on query intent type
    let baseTopK = 10; // default
    switch (intent.type) {
      case "specific":
        baseTopK = 5; // More focused for specific queries
        break;
      case "filter":
        baseTopK = 20; // Moderate for filter queries
        break;
      case "search":
        baseTopK = 15; // Good balance for search queries
        break;
    }

    // Adjust based on quantity indicators in the query
    if (
      queryLower.includes("all") ||
      queryLower.includes("every") ||
      queryLower.includes("complete")
    ) {
      return Math.max(baseTopK, 50); // Show more for "all" requests
    }

    if (
      queryLower.includes("recent") ||
      queryLower.includes("latest") ||
      queryLower.includes("new")
    ) {
      return Math.max(baseTopK, 20); // Good amount for recent items
    }

    if (
      queryLower.includes("top") ||
      queryLower.includes("best") ||
      queryLower.includes("priority")
    ) {
      return Math.max(baseTopK, 15); // Standard for top/best queries
    }

    if (
      queryLower.includes("urgent") ||
      queryLower.includes("overdue") ||
      queryLower.includes("late")
    ) {
      return Math.max(baseTopK, 25); // More results for urgent/overdue queries
    }

    if (
      queryLower.includes("this week") ||
      queryLower.includes("next week") ||
      queryLower.includes("month")
    ) {
      return Math.max(baseTopK, 30); // Time-based queries need more context
    }

    if (queryLower.includes("customer") || queryLower.includes("client")) {
      return Math.max(baseTopK, 25); // Customer-specific queries
    }

    if (queryLower.includes("process") || queryLower.includes("material")) {
      return Math.max(baseTopK, 20); // Process/material queries
    }

    if (queryLower.includes("status") || queryLower.includes("progress")) {
      return Math.max(baseTopK, 25); // Status queries
    }

    // Check for numerical indicators
    const numberMatch = queryLower.match(/(\d+)/);
    if (numberMatch) {
      const requestedNumber = parseInt(numberMatch[1]);
      if (requestedNumber > 0 && requestedNumber <= 100) {
        return Math.max(baseTopK, requestedNumber + 5); // Add buffer for better results
      }
    }

    return baseTopK;
  }

  /**
   * Create broader filters by removing restrictive criteria
   */
  private createBroaderFilters(
    originalFilters: Record<string, any>
  ): Record<string, any> {
    const broaderFilters = { ...originalFilters };

    // Remove the most restrictive filters first
    const restrictiveKeys = [
      "customerCompany", // Very specific
      "status", // Very specific
      "processes", // Very specific
      "materials", // Very specific
      "timeSensitive", // Boolean filter
      "mustDate", // Boolean filter
      "isReprint", // Boolean filter
    ];

    // Remove restrictive filters to broaden the search
    restrictiveKeys.forEach((key) => {
      if (broaderFilters[key] !== undefined) {
        console.log(`🔍 Removing restrictive filter: ${key}`);
        delete broaderFilters[key];
      }
    });

    // Keep less restrictive filters like:
    // - hasLineItems, hasShipments (relationship indicators)
    // - dataSource (data quality)
    // - locationCode (if it's a general location)

    return broaderFilters;
  }

  // Start capturing debug logs
  private startLogCapture(): void {
    this.debugLogs = [];

    // Override console methods to capture logs
    console.log = (...args: any[]) => {
      const logMessage = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");
      this.debugLogs.push(`[LOG] ${logMessage}`);
      this.originalConsoleLog(...args);
    };

    console.error = (...args: any[]) => {
      const logMessage = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");
      this.debugLogs.push(`[ERROR] ${logMessage}`);
      this.originalConsoleError(...args);
    };

    console.warn = (...args: any[]) => {
      const logMessage = args
        .map((arg) =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(" ");
      this.debugLogs.push(`[WARN] ${logMessage}`);
      this.originalConsoleWarn(...args);
    };
  }

  // Stop capturing debug logs and restore original console methods
  private stopLogCapture(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  // Get captured debug logs
  private getCapturedLogs(): string[] {
    return [...this.debugLogs];
  }
}

// Export singleton instance
export const intelligentQueryRouter = new IntelligentQueryRouter();

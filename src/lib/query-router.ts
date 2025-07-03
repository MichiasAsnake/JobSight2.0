// Intelligent Query Router - Smart routing between API calls and vector search
// Analyzes query intent and selects optimal data retrieval strategy

import { apiFirstDataService, ModernOrder } from "./api-first-data-service";
import {
  enhancedVectorPipeline,
  EnhancedSearchResult,
} from "./enhanced-vector-pipeline";
import { embeddingService } from "./embeddings";
import { HybridOMSDataService } from "./hybrid-data-service";
import { enrichedOMSDataService, EnrichedOrder } from "./enhanced-data-service";
import { ModernHybridDataService } from "./modern-hybrid-data-service";

export interface QueryIntent {
  type: "specific" | "semantic" | "analytical" | "hybrid";
  confidence: number;
  reasoning: string;
  suggestedStrategy: "api" | "vector" | "hybrid";
  extractedEntities: {
    jobNumbers?: string[];
    customerNames?: string[];
    statusValues?: string[];
    dateRanges?: Array<{ start: string; end: string }>;
    keywords?: string[];
    processes?: string[];
    materials?: string[];
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
}

// Enhanced query patterns with more sophisticated matching
const QUERY_PATTERNS = {
  // Specific job/order queries
  jobNumber: /(?:job|order|#)\s*(\d+)/i,
  orderNumber: /order\s*(?:number|#)?\s*([a-zA-Z0-9-_]+)/i,

  // Status and workflow queries
  status:
    /(?:status|state|condition).*?(approved|proofed|completed|dispatched|running late|on time|problem)/i,
  urgent: /(?:urgent|rush|asap|priority|critical|must date)/i,
  late: /(?:late|overdue|behind|delayed)/i,
  ready: /(?:ready|completed|finished|done)/i,

  // Customer queries
  customer: /(?:customer|client|company).*?([a-zA-Z\s&]+)/i,

  // Production and process queries
  process:
    /(?:process|machine|production|workflow).*?(HW|AP|TC|MP|PR|NA|CR|DS|ES|PP|PA|EM|SW|SC|DF|Misc|Sewing|Dispatch|Stock|Bagging)/i,
  embroidery: /(?:embroidery|emb|stitching|thread)/i,
  hardware: /(?:hardware|hw|laser|etching|engraving)/i,
  printing: /(?:printing|print|screen|digital)/i,

  // Tags and annotations
  tags: /(?:tag|tagged|marked|labeled).*?(@\w+|ps done|gamma|laser|supacolor)/i,
  notTagged: /(?:not|without|missing|exclude).*?(?:tag|tagged|marked)/i,

  // Inventory and stock
  stock: /(?:stock|inventory|materials|supplies|garments)/i,
  noStock: /(?:no stock|out of stock|waiting.*stock)/i,

  // Shipping and delivery
  shipping: /(?:ship|delivery|tracking|dispatch|collection)/i,
  shipped: /(?:shipped|delivered|dispatched)/i,

  // Time-based queries
  today: /today|this\s+day/i,
  tomorrow: /tomorrow|next\s+day/i,
  thisWeek: /this\s+week|weekly/i,
  overdue: /overdue|past\s+due|late/i,

  // Analytics and reporting
  analytics: /(?:total|count|how many|statistics|stats|breakdown|summary)/i,
  prioritize: /(?:prioritize|priority|focus|important|critical)/i,

  // Output and production targets
  output: /(?:output|production|target|goal|volume)/i,
};

export class IntelligentQueryRouter {
  private cache: Map<
    string,
    { result: RoutedQueryResult; timestamp: number; ttl: number }
  > = new Map();
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
  private hybridService: ModernHybridDataService;

  constructor() {
    this.hybridService = new ModernHybridDataService();
    // Clean up old cache entries every 10 minutes
    setInterval(() => this.cleanupCache(), 10 * 60 * 1000);
  }

  // Main query routing method
  async routeQuery(
    query: string,
    context: QueryContext = {}
  ): Promise<RoutedQueryResult> {
    const startTime = Date.now();
    this.performanceStats.totalQueries++;

    try {
      // 1. Check cache first
      const cacheKey = this.generateCacheKey(query, context);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        return {
          ...cached,
          processingTime: Date.now() - startTime,
          dataFreshness: "cached",
          performanceMetrics: {
            ...cached.performanceMetrics,
            cacheHits: cached.performanceMetrics.cacheHits + 1,
          },
        };
      }

      // 2. Analyze query intent
      const intent = await this.analyzeQueryIntent(query);
      this.addToQueryHistory(query, intent);

      // 3. Get system health
      const systemState = await this.getSystemState();
      const contextWithState = { ...context, systemState };

      // 4. Route based on strategy
      let result: RoutedQueryResult;

      switch (intent.suggestedStrategy) {
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

      return result;
    } catch (error) {
      console.error("❌ Query routing failed:", error);

      // Return error fallback
      return {
        strategy: "vector",
        processingTime: Date.now() - startTime,
        dataFreshness: "stale",
        confidence: 0.1,
        sources: ["fallback"],
        results: { orders: [], summary: `Query failed: ${error.message}` },
        fallbacksUsed: ["error-fallback"],
        performanceMetrics: {
          apiCalls: 0,
          vectorQueries: 0,
          cacheHits: 0,
          cacheMisses: 1,
        },
        recommendations: ["Please try a simpler query or check system health"],
      };
    }
  }

  // Analyze query to determine intent and strategy
  private async analyzeQueryIntent(query: string): Promise<QueryIntent> {
    const queryLower = query.toLowerCase();
    const extractedEntities = this.extractEntities(query);

    // Patterns for different query types
    const specificPatterns = [
      /job\s*(number|#)\s*(\w+)/i,
      /order\s*(number|#)\s*(\w+)/i,
      /\b\d{6,}\b/, // Job numbers are typically 6+ digits
    ];

    const analyticalPatterns = [
      /how many|count|total|sum|average|statistics|stats|summary|report/i,
      /top|bottom|most|least|highest|lowest|best|worst/i,
      /compare|comparison|versus|vs|difference|trend/i,
    ];

    const semanticPatterns = [
      /similar|like|related|find|search|look for|show me/i,
      /what|where|when|why|how/i,
      /contains|includes|has|with/i,
    ];

    let type: QueryIntent["type"] = "semantic";
    let confidence = 0.5;
    let reasoning = "Default semantic search";
    let suggestedStrategy: QueryIntent["suggestedStrategy"] = "vector";

    // Check for specific queries (job numbers, exact matches)
    if (
      specificPatterns.some((pattern) => pattern.test(query)) ||
      extractedEntities.jobNumbers?.length > 0
    ) {
      type = "specific";
      confidence = 0.9;
      reasoning =
        "Query contains specific identifiers (job numbers, order numbers)";
      suggestedStrategy = "api";
    }
    // Check for analytical queries
    else if (analyticalPatterns.some((pattern) => pattern.test(query))) {
      type = "analytical";
      confidence = 0.8;
      reasoning = "Query requests statistical analysis or aggregation";
      suggestedStrategy = "hybrid";
    }
    // Check for semantic queries
    else if (semanticPatterns.some((pattern) => pattern.test(query))) {
      type = "semantic";
      confidence = 0.7;
      reasoning = "Query is best suited for semantic similarity search";
      suggestedStrategy = "vector";
    }

    // Adjust strategy based on extracted entities
    if (
      extractedEntities.customerNames?.length > 0 ||
      extractedEntities.statusValues?.length > 0 ||
      extractedEntities.dateRanges?.length > 0
    ) {
      if (type === "semantic") {
        type = "hybrid";
        suggestedStrategy = "hybrid";
        reasoning += " with structured filters";
        confidence = Math.min(confidence + 0.1, 0.95);
      }
    }

    return {
      type,
      confidence,
      reasoning,
      suggestedStrategy,
      extractedEntities,
    };
  }

  // Extract entities from query (job numbers, customers, etc.)
  private extractEntities(query: string): QueryIntent["extractedEntities"] {
    const entities: QueryIntent["extractedEntities"] = {};

    // Extract job numbers (6+ digit numbers)
    const jobNumberMatches = query.match(/\b\d{6,}\b/g);
    if (jobNumberMatches) {
      entities.jobNumbers = jobNumberMatches;
    }

    // Extract customer patterns
    const customerPatterns = [
      /customer\s+([A-Za-z\s&\.]+?)(?:\s|$|,)/i,
      /for\s+([A-Za-z\s&\.]+?)(?:\s|$|,)/i,
    ];

    for (const pattern of customerPatterns) {
      const match = query.match(pattern);
      if (match && match[1].length > 2) {
        entities.customerNames = entities.customerNames || [];
        entities.customerNames.push(match[1].trim());
      }
    }

    // Extract status values
    const statusKeywords = [
      "pending",
      "active",
      "complete",
      "shipped",
      "delivered",
      "cancelled",
      "rush",
      "late",
      "overdue",
      "on-time",
      "in-progress",
      "proofing",
    ];

    const foundStatuses = statusKeywords.filter((status) =>
      query.toLowerCase().includes(status)
    );

    if (foundStatuses.length > 0) {
      entities.statusValues = foundStatuses;
    }

    // Extract date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
      /(\d{4}-\d{2}-\d{2})/g,
      /(today|yesterday|this week|last week|this month|last month)/gi,
    ];

    for (const pattern of datePatterns) {
      const matches = query.match(pattern);
      if (matches) {
        entities.dateRanges = entities.dateRanges || [];
        matches.forEach((match) => {
          entities.dateRanges!.push({
            start: match, // Would need proper date parsing in production
            end: match,
          });
        });
      }
    }

    // Extract material/process keywords
    const materialKeywords = [
      "paper",
      "cardstock",
      "vinyl",
      "plastic",
      "metal",
      "fabric",
      "canvas",
      "business cards",
      "flyers",
      "brochures",
      "banners",
      "signs",
      "labels",
    ];

    const processKeywords = [
      "printing",
      "cutting",
      "laminating",
      "binding",
      "folding",
      "drilling",
      "digital",
      "offset",
      "large format",
      "screen printing",
      "embossing",
    ];

    const foundMaterials = materialKeywords.filter((material) =>
      query.toLowerCase().includes(material)
    );

    const foundProcesses = processKeywords.filter((process) =>
      query.toLowerCase().includes(process)
    );

    if (foundMaterials.length > 0) {
      entities.materials = foundMaterials;
    }

    if (foundProcesses.length > 0) {
      entities.processes = foundProcesses;
    }

    // Extract general keywords (for vector search enhancement)
    const words = query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
      .filter(
        (word) =>
          ![
            "the",
            "and",
            "for",
            "with",
            "are",
            "was",
            "were",
            "been",
            "have",
            "has",
            "had",
            "can",
            "could",
            "will",
            "would",
            "should",
          ].includes(word)
      );

    if (words.length > 0) {
      entities.keywords = words;
    }

    return entities;
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
      if (intent.extractedEntities.jobNumbers?.length > 0) {
        // Get specific orders by job number
        for (const jobNumber of intent.extractedEntities.jobNumbers) {
          const order = await apiFirstDataService.getOrderByJobNumber(
            jobNumber
          );
          performanceMetrics.apiCalls++;

          if (order) {
            orders.push(order);
          }
        }
      } else {
        // Get filtered orders based on other criteria
        const filters: any = {};

        if (intent.extractedEntities.customerNames?.length > 0) {
          filters.customer = intent.extractedEntities.customerNames[0];
        }

        if (intent.extractedEntities.statusValues?.length > 0) {
          filters.status = intent.extractedEntities.statusValues[0];
        }

        orders = await apiFirstDataService.searchOrdersByQuery(query, filters);
        performanceMetrics.apiCalls++;
      }

      return {
        strategy: "api",
        processingTime: 0, // Will be set by caller
        dataFreshness: "fresh",
        confidence: intent.confidence,
        sources,
        results: {
          orders,
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

      if (intent.extractedEntities.customerNames?.length > 0) {
        filters.customerCompany = intent.extractedEntities.customerNames[0];
      }

      if (intent.extractedEntities.statusValues?.length > 0) {
        filters.status = intent.extractedEntities.statusValues[0];
      }

      if (intent.extractedEntities.materials?.length > 0) {
        filters.materials = intent.extractedEntities.materials;
      }

      if (intent.extractedEntities.processes?.length > 0) {
        filters.processes = intent.extractedEntities.processes;
      }

      // Determine appropriate result count based on query intent and content
      let topK = 10; // default

      // Check for quantity indicators in the query
      const queryLower = query.toLowerCase();
      if (queryLower.includes("all") || queryLower.includes("every")) {
        topK = 50; // Show more for "all" requests
      } else if (
        queryLower.includes("recent") ||
        queryLower.includes("latest")
      ) {
        topK = 15; // Good amount for recent items
      } else if (queryLower.includes("top") || queryLower.includes("best")) {
        topK = 10; // Standard for top/best queries
      } else if (intent.type === "specific") {
        topK = 5; // More focused for specific queries
      } else if (intent.type === "analytical") {
        topK = 25; // More data for analysis
      } else if (intent.type === "semantic") {
        topK = 15; // Good balance for semantic searches
      }

      // Execute vector search
      const vectorResults = await enhancedVectorPipeline.searchSimilarOrders(
        query,
        {
          topK,
          filters,
          includeHighlights: true,
        }
      );

      return {
        strategy: "vector",
        processingTime: 0, // Will be set by caller
        dataFreshness: "cached",
        confidence: intent.confidence,
        sources: ["vector-db"],
        results: {
          vectorResults,
          summary: `Found ${vectorResults.length} similar orders using semantic search`,
        },
        performanceMetrics,
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

      // Generate analytics if it's an analytical query
      let analytics = undefined;
      if (intent.type === "analytical" && orders.length > 0) {
        analytics = await this.generateAnalytics(orders, query);
      }

      return {
        strategy: "hybrid",
        processingTime: 0, // Will be set by caller
        dataFreshness: "fresh",
        confidence: Math.max(intent.confidence, 0.8),
        sources,
        results: {
          orders,
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
        (sum, order) => sum + (order.financial?.totalDue || 0),
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
    return `query:${query.toLowerCase()}:${JSON.stringify(
      context.userPreferences || {}
    )}`;
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
    // Cache successful results with good confidence
    return (
      result.confidence > 0.5 &&
      result.results.orders &&
      result.results.orders.length > 0
    );
  }

  private getTTL(intent: QueryIntent): number {
    // Different TTL based on query type
    switch (intent.type) {
      case "specific":
        return 5 * 60 * 1000; // 5 minutes for specific queries
      case "analytical":
        return 15 * 60 * 1000; // 15 minutes for analytics
      case "semantic":
        return 30 * 60 * 1000; // 30 minutes for semantic search
      default:
        return 10 * 60 * 1000; // 10 minutes default
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
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
      intent.extractedEntities.jobNumbers?.length > 0
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

    if (result.fallbacksUsed?.length > 0) {
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
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.entries()).map(([key, cached]) => ({
        key,
        age: Date.now() - cached.timestamp,
        ttl: cached.ttl,
      })),
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const intelligentQueryRouter = new IntelligentQueryRouter();

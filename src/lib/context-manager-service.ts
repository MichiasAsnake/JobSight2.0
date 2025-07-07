// Context Manager Service - Maintains query context between related requests

import { ModernOrder } from "./api-first-data-service";

export interface QueryContext {
  id: string;
  originalQuery: string;
  timestamp: Date;
  orders: ModernOrder[];
  filters: {
    dateRange?: { start: Date; end: Date };
    statuses?: string[];
    tags?: string[];
    customers?: string[];
  };
  userIntent: {
    type: "search" | "filter" | "analysis" | "cost" | "status" | "details";
    confidence: number;
    keywords: string[];
  };
  followUpQueries: string[];
}

export interface ContextualQuery {
  query: string;
  context?: QueryContext;
  isFollowUp: boolean;
  contextualKeywords: string[];
}

export class ContextManagerService {
  private contexts: Map<string, QueryContext> = new Map();
  private readonly maxContextAge = 30 * 60 * 1000; // 30 minutes
  private readonly maxContexts = 10;

  private readonly contextualKeywords = {
    references: [
      "these",
      "those",
      "them",
      "they",
      "this",
      "that",
      "the above",
      "mentioned",
      "previous",
    ],
    followUp: [
      "also",
      "additionally",
      "furthermore",
      "moreover",
      "what about",
      "how about",
    ],
    cost: [
      "cost",
      "price",
      "value",
      "total",
      "amount",
      "expensive",
      "cheap",
      "budget",
    ],
    analysis: [
      "analyze",
      "breakdown",
      "summary",
      "overview",
      "statistics",
      "stats",
      "report",
    ],
    details: [
      "details",
      "more info",
      "elaborate",
      "explain",
      "show me",
      "tell me about",
    ],
    status: ["status", "progress", "update", "current", "latest", "now"],
  };

  /**
   * Analyze query for contextual references
   */
  analyzeQuery(query: string, sessionId: string = "default"): ContextualQuery {
    console.log(`🔗 [CONTEXT] Analyzing query: "${query}"`);

    const contextualKeywords = this.extractContextualKeywords(query);
    const isFollowUp = this.isFollowUpQuery(query);
    const latestContext = this.getLatestContext(sessionId);

    const result: ContextualQuery = {
      query,
      context: isFollowUp ? latestContext : undefined,
      isFollowUp,
      contextualKeywords,
    };

    console.log(
      `🔗 [CONTEXT] Is follow-up: ${isFollowUp}, Context available: ${!!latestContext}`
    );
    return result;
  }

  /**
   * Store query context for future reference
   */
  storeContext(
    query: string,
    orders: ModernOrder[],
    sessionId: string = "default",
    additionalFilters: any = {}
  ): string {
    const contextId = `${sessionId}_${Date.now()}`;
    const userIntent = this.determineUserIntent(query);

    const context: QueryContext = {
      id: contextId,
      originalQuery: query,
      timestamp: new Date(),
      orders: [...orders],
      filters: {
        dateRange: additionalFilters.dateRange,
        statuses: additionalFilters.statuses,
        tags: additionalFilters.tags,
        customers: additionalFilters.customers,
      },
      userIntent,
      followUpQueries: [],
    };

    this.contexts.set(contextId, context);
    this.cleanupOldContexts();

    console.log(
      `🔗 [CONTEXT] Stored context ${contextId} with ${orders.length} orders`
    );
    return contextId;
  }

  /**
   * Update context with follow-up query
   */
  updateContext(contextId: string, followUpQuery: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.followUpQueries.push(followUpQuery);
      console.log(
        `🔗 [CONTEXT] Updated context ${contextId} with follow-up: "${followUpQuery}"`
      );
    }
  }

  /**
   * Get context by ID
   */
  getContext(contextId: string): QueryContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Get latest context for session
   */
  getLatestContext(sessionId: string): QueryContext | undefined {
    const sessionContexts = Array.from(this.contexts.values())
      .filter((ctx) => ctx.id.startsWith(sessionId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return sessionContexts[0];
  }

  /**
   * Resolve contextual references in query
   */
  resolveContextualQuery(contextualQuery: ContextualQuery): {
    resolvedQuery: string;
    applicableOrders: ModernOrder[];
    contextDescription: string;
  } {
    if (!contextualQuery.context) {
      return {
        resolvedQuery: contextualQuery.query,
        applicableOrders: [],
        contextDescription: "No context available",
      };
    }

    const context = contextualQuery.context;
    let resolvedQuery = contextualQuery.query;

    // Replace contextual references with specific terms
    const referencePatterns = [
      {
        pattern: /\b(these|those|them|they)\s+(orders?|jobs?|items?)\b/gi,
        replacement: `the ${context.orders.length} orders from "${context.originalQuery}"`,
      },
      {
        pattern: /\b(this|that)\s+(order|job|item)\b/gi,
        replacement: `order ${
          context.orders[0]?.jobNumber || "from previous query"
        }`,
      },
      {
        pattern:
          /\b(the above|mentioned|previous)\s+(orders?|jobs?|items?)\b/gi,
        replacement: `the orders from "${context.originalQuery}"`,
      },
      {
        pattern: /\bthese\b/gi,
        replacement: `the ${context.orders.length} orders`,
      },
      {
        pattern: /\bthose\b/gi,
        replacement: `the ${context.orders.length} orders`,
      },
      {
        pattern: /\bthem\b/gi,
        replacement: `the ${context.orders.length} orders`,
      },
      {
        pattern: /\bthey\b/gi,
        replacement: `the ${context.orders.length} orders`,
      },
    ];

    for (const { pattern, replacement } of referencePatterns) {
      if (pattern.test(resolvedQuery)) {
        resolvedQuery = resolvedQuery.replace(pattern, replacement);
        break;
      }
    }

    const contextDescription = `Referring to ${context.orders.length} orders from: "${context.originalQuery}" (${context.userIntent.type} query)`;

    console.log(`🔗 [CONTEXT] Resolved query: "${resolvedQuery}"`);
    console.log(`🔗 [CONTEXT] Context: ${contextDescription}`);

    return {
      resolvedQuery,
      applicableOrders: context.orders,
      contextDescription,
    };
  }

  /**
   * Determine if query is a follow-up
   */
  private isFollowUpQuery(query: string): boolean {
    const queryLower = query.toLowerCase();

    // Check for contextual references
    const hasReferences = this.contextualKeywords.references.some((keyword) =>
      queryLower.includes(keyword)
    );

    // Check for follow-up indicators
    const hasFollowUp = this.contextualKeywords.followUp.some((keyword) =>
      queryLower.includes(keyword)
    );

    // Check for standalone cost/analysis queries (likely follow-ups)
    const isStandaloneCost =
      this.contextualKeywords.cost.some((keyword) =>
        queryLower.includes(keyword)
      ) &&
      !queryLower.includes("order") &&
      !queryLower.includes("job");

    return hasReferences || hasFollowUp || isStandaloneCost;
  }

  /**
   * Extract contextual keywords from query
   */
  private extractContextualKeywords(query: string): string[] {
    const found: string[] = [];
    const queryLower = query.toLowerCase();

    for (const [category, keywords] of Object.entries(
      this.contextualKeywords
    )) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          found.push(keyword);
        }
      }
    }

    return found;
  }

  /**
   * Determine user intent from query
   */
  private determineUserIntent(query: string): {
    type: "search" | "filter" | "analysis" | "cost" | "status" | "details";
    confidence: number;
    keywords: string[];
  } {
    const queryLower = query.toLowerCase();
    const keywords: string[] = [];

    // Cost analysis intent
    if (
      this.contextualKeywords.cost.some((keyword) =>
        queryLower.includes(keyword)
      )
    ) {
      return {
        type: "cost",
        confidence: 0.9,
        keywords: ["cost", "price", "value"],
      };
    }

    // Status inquiry intent
    if (
      this.contextualKeywords.status.some((keyword) =>
        queryLower.includes(keyword)
      )
    ) {
      return {
        type: "status",
        confidence: 0.8,
        keywords: ["status", "progress"],
      };
    }

    // Analysis intent
    if (
      this.contextualKeywords.analysis.some((keyword) =>
        queryLower.includes(keyword)
      )
    ) {
      return {
        type: "analysis",
        confidence: 0.8,
        keywords: ["analyze", "summary"],
      };
    }

    // Details intent
    if (
      this.contextualKeywords.details.some((keyword) =>
        queryLower.includes(keyword)
      )
    ) {
      return {
        type: "details",
        confidence: 0.7,
        keywords: ["details", "info"],
      };
    }

    // Filter intent (contains exclusions, conditions)
    if (
      queryLower.includes("not") ||
      queryLower.includes("without") ||
      queryLower.includes("exclude")
    ) {
      return {
        type: "filter",
        confidence: 0.8,
        keywords: ["filter", "exclude"],
      };
    }

    // Default to search
    return { type: "search", confidence: 0.6, keywords: ["search", "find"] };
  }

  /**
   * Clean up old contexts
   */
  private cleanupOldContexts(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, context] of this.contexts.entries()) {
      if (now - context.timestamp.getTime() > this.maxContextAge) {
        toDelete.push(id);
      }
    }

    // Remove old contexts
    for (const id of toDelete) {
      this.contexts.delete(id);
    }

    // If still too many contexts, remove oldest
    if (this.contexts.size > this.maxContexts) {
      const sorted = Array.from(this.contexts.entries()).sort(
        (a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime()
      );

      const toRemove = sorted.slice(0, this.contexts.size - this.maxContexts);
      for (const [id] of toRemove) {
        this.contexts.delete(id);
      }
    }

    if (toDelete.length > 0) {
      console.log(`🔗 [CONTEXT] Cleaned up ${toDelete.length} old contexts`);
    }
  }

  /**
   * Generate context-aware prompt enhancement
   */
  generateContextualPrompt(contextualQuery: ContextualQuery): string {
    if (!contextualQuery.context) {
      return "";
    }

    const context = contextualQuery.context;
    const prompt = `

CONTEXTUAL INFORMATION:
Previous Query: "${context.originalQuery}"
Orders in Context: ${context.orders.length}
Query Intent: ${context.userIntent.type}
Context Age: ${Math.round(
      (Date.now() - context.timestamp.getTime()) / 60000
    )} minutes ago

When answering, remember:
1. The user is referring to the ${
      context.orders.length
    } orders from the previous query
2. Use specific order details from the context when possible
3. Maintain continuity with the previous conversation
4. If asking about costs, provide specific pricing from the contextual orders
5. If asking about status, focus on the status of the contextual orders

Contextual Orders Summary:
${context.orders
  .slice(0, 5)
  .map(
    (order, i) =>
      `${i + 1}. Job #${order.jobNumber} - ${order.customer.company} - ${
        order.description
      }`
  )
  .join("\n")}
${
  context.orders.length > 5
    ? `... and ${context.orders.length - 5} more orders`
    : ""
}

`;

    return prompt;
  }

  /**
   * Check if cache is appropriate for contextual queries
   */
  shouldUseCachedResponse(contextualQuery: ContextualQuery): boolean {
    // If it's a follow-up query about cost or details, avoid cache
    // as the context might provide more specific information
    if (contextualQuery.isFollowUp && contextualQuery.context) {
      const intentType = contextualQuery.context.userIntent.type;
      return !["cost", "details", "analysis"].includes(intentType);
    }

    return true;
  }
}

// Export singleton instance
export const contextManagerService = new ContextManagerService();

// GPT-Powered Semantic Search for OMS
// Understands natural language queries and converts them to intelligent filters

import OpenAI from "openai";
import { temporalUtils } from "./temporal-utils";

export interface SemanticFilters {
  // Temporal filters
  dateRange?: {
    start: Date;
    end: Date;
    description: string;
  };

  // Priority/urgency filters
  urgencyLevel?: "low" | "medium" | "high" | "critical";
  includeUrgentOrders?: boolean;
  includeOverdueOrders?: boolean;

  // Status filters
  statusIncludes?: string[];
  statusExcludes?: string[];

  // Value/financial filters
  minValue?: number;
  maxValue?: number;
  revenueTarget?: number;

  // Customer filters
  customerIncludes?: string[];

  // Text search terms (fallback)
  searchTerms?: string[];

  // Processing instructions
  sortBy?: "urgency" | "value" | "dueDate" | "customer";
  matchingStrategy?: "any" | "all" | "semantic";

  // Metadata
  confidence: "high" | "medium" | "low";
  explanation: string;
}

class SemanticSearchService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      timeout: 10000,
      maxRetries: 1,
    });
  }

  /**
   * Analyze a natural language query and generate semantic filters
   */
  async generateSemanticFilters(query: string): Promise<SemanticFilters> {
    const temporalContext = temporalUtils.getCurrentTemporalContext();

    try {
      const systemPrompt = `Analyze queries for an order management system. Return JSON filters.

Current: ${temporalContext.currentDateTime}

TEMPORAL MEANINGS:
- "today" = ${temporalContext.currentDateUTC.split("T")[0]}
- "this week" = current week 
- "urgent/rush" = high priority
- "overdue" = past due
- "10k" = $10,000 revenue target

Return JSON with: dateRange, urgencyLevel, includeUrgentOrders, includeOverdueOrders, statusIncludes, minValue, revenueTarget, searchTerms, confidence, explanation`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Query: "${query}"` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 400,
      });

      const result = response.choices[0]?.message?.content;
      if (!result) return this.getFallbackFilters(query);

      const parsed = JSON.parse(result) as SemanticFilters;
      return this.validateFilters(parsed, query);
    } catch (error) {
      console.warn("GPT semantic analysis failed:", error);
      return this.getFallbackFilters(query);
    }
  }

  /**
   * Apply semantic filters to orders
   */
  applySemanticFilters(orders: any[], filters: SemanticFilters): any[] {
    return orders.filter((order) => {
      // Temporal filtering
      if (filters.dateRange) {
        const orderDueDate = new Date(order.dates.dateDue);
        if (
          orderDueDate < filters.dateRange.start ||
          orderDueDate > filters.dateRange.end
        ) {
          return false;
        }
      }

      // Urgency filtering
      if (
        filters.includeUrgentOrders &&
        !(order.production.timeSensitive || order.production.mustDate)
      ) {
        return false;
      }

      // Overdue filtering
      if (filters.includeOverdueOrders && order.dates.daysToDueDate >= 0) {
        return false;
      }

      // Status filtering
      if (filters.statusIncludes?.length) {
        const orderStatus = order.status.master.toLowerCase();
        if (
          !filters.statusIncludes.some((status) =>
            orderStatus.includes(status.toLowerCase())
          )
        ) {
          return false;
        }
      }

      // Value filtering
      const orderValue = order.lineItems.reduce(
        (sum: number, item: any) => sum + (item.totalPrice || 0),
        0
      );
      if (filters.minValue && orderValue < filters.minValue) {
        return false;
      }
      if (filters.maxValue && orderValue > filters.maxValue) {
        return false;
      }

      // Customer filtering
      if (filters.customerIncludes?.length) {
        const customerName = order.customer.company.toLowerCase();
        if (
          !filters.customerIncludes.some((customer) =>
            customerName.includes(customer.toLowerCase())
          )
        ) {
          return false;
        }
      }

      // Text search fallback
      if (filters.searchTerms?.length) {
        const searchableText = [
          order.description,
          order.customer.company,
          order.orderNumber,
          order.jobNumber,
          order.comments,
          order.status.master,
          ...order.tags.map((t: any) => t.tag),
          ...order.lineItems.map((l: any) => l.description),
        ]
          .join(" ")
          .toLowerCase();

        const matchCount = filters.searchTerms.filter((term) =>
          searchableText.includes(term.toLowerCase())
        ).length;

        if (
          filters.matchingStrategy === "all" &&
          matchCount < filters.searchTerms.length
        ) {
          return false;
        }
        if (filters.matchingStrategy === "any" && matchCount === 0) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Validate and enhance GPT-generated filters
   */
  private validateFilters(
    filters: any,
    originalQuery: string
  ): SemanticFilters {
    const enhanced: SemanticFilters = {
      confidence: filters.confidence || "medium",
      explanation: filters.explanation || `Analyzed: "${originalQuery}"`,
      matchingStrategy: filters.matchingStrategy || "semantic",
    };

    // Process date ranges
    if (filters.dateRange) {
      enhanced.dateRange = {
        start: new Date(filters.dateRange.start),
        end: new Date(filters.dateRange.end),
        description: filters.dateRange.description || "Custom date range",
      };
    }

    // Process urgency
    if (filters.urgencyLevel) {
      enhanced.urgencyLevel = filters.urgencyLevel;
      enhanced.includeUrgentOrders =
        filters.urgencyLevel === "high" || filters.urgencyLevel === "critical";
    }

    // Process other filters
    if (filters.includeOverdueOrders) enhanced.includeOverdueOrders = true;
    if (filters.statusIncludes)
      enhanced.statusIncludes = filters.statusIncludes;
    if (filters.minValue) enhanced.minValue = filters.minValue;
    if (filters.maxValue) enhanced.maxValue = filters.maxValue;
    if (filters.revenueTarget) enhanced.revenueTarget = filters.revenueTarget;
    if (filters.customerIncludes)
      enhanced.customerIncludes = filters.customerIncludes;
    if (filters.searchTerms) enhanced.searchTerms = filters.searchTerms;
    if (filters.sortBy) enhanced.sortBy = filters.sortBy;

    return enhanced;
  }

  /**
   * Fallback filters when GPT analysis fails
   */
  private getFallbackFilters(query: string): SemanticFilters {
    const queryLower = query.toLowerCase();
    const filters: SemanticFilters = {
      confidence: "low",
      explanation: "Using fallback text-based analysis",
      matchingStrategy: "any",
      searchTerms: query
        .toLowerCase()
        .split(/\s+/)
        .filter((term) => term.length > 2),
    };

    // Basic temporal patterns
    if (queryLower.includes("urgent") || queryLower.includes("rush")) {
      filters.includeUrgentOrders = true;
      filters.urgencyLevel = "high";
    }

    if (queryLower.includes("overdue") || queryLower.includes("late")) {
      filters.includeOverdueOrders = true;
    }

    // Basic value patterns
    if (queryLower.includes("10k")) {
      filters.revenueTarget = 10000;
      filters.minValue = 100; // Focus on orders that contribute to revenue
    }

    return filters;
  }
}

// Export singleton instance
export const semanticSearchService = new SemanticSearchService();

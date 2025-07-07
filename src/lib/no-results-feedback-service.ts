// No Results Feedback Service - Provides helpful feedback when queries return no results

import { ModernOrder } from "./api-first-data-service";
import { FilterCriteria } from "./enhanced-filtering-service";

export interface NoResultsFeedback {
  reason: string;
  suggestions: string[];
  alternatives: string[];
  debugInfo?: {
    totalOrdersSearched: number;
    filtersApplied: string[];
    commonStatuses: string[];
    commonTags: string[];
    dateRangeIssues?: string[];
  };
}

export class NoResultsFeedbackService {
  /**
   * Generate helpful feedback when no results are found
   */
  generateFeedback(
    originalQuery: string,
    searchParams: {
      totalOrdersSearched: number;
      filtersApplied: FilterCriteria;
      dateRange?: { start: Date; end: Date };
      searchStrategy: "api" | "vector" | "hybrid";
    },
    allOrders: ModernOrder[] = []
  ): NoResultsFeedback {
    console.log(`💭 [NO-RESULTS] Generating feedback for: "${originalQuery}"`);

    const reason = this.identifyReason(originalQuery, searchParams, allOrders);
    const suggestions = this.generateSuggestions(
      originalQuery,
      searchParams,
      allOrders
    );
    const alternatives = this.generateAlternatives(
      originalQuery,
      searchParams,
      allOrders
    );

    const debugInfo = {
      totalOrdersSearched: searchParams.totalOrdersSearched,
      filtersApplied: this.describeFilters(searchParams.filtersApplied),
      commonStatuses: this.getCommonStatuses(allOrders),
      commonTags: this.getCommonTags(allOrders),
      dateRangeIssues: this.identifyDateRangeIssues(
        searchParams.dateRange,
        allOrders
      ),
    };

    return {
      reason,
      suggestions,
      alternatives,
      debugInfo,
    };
  }

  /**
   * Identify the most likely reason for no results
   */
  private identifyReason(
    query: string,
    searchParams: any,
    allOrders: ModernOrder[]
  ): string {
    const queryLower = query.toLowerCase();

    // Check for date range issues
    if (searchParams.dateRange && allOrders.length > 0) {
      const ordersInRange = allOrders.filter((order) => {
        const orderDate = new Date(order.dates.dateDue);
        return (
          orderDate >= searchParams.dateRange.start &&
          orderDate <= searchParams.dateRange.end
        );
      });

      if (ordersInRange.length === 0) {
        return `No orders found in the specified date range (${searchParams.dateRange.start.toLocaleDateString()} to ${searchParams.dateRange.end.toLocaleDateString()})`;
      }
    }

    // Check for exclusion filter issues
    if (
      searchParams.filtersApplied.excludeTags &&
      searchParams.filtersApplied.excludeTags.length > 0
    ) {
      const excludedTags = searchParams.filtersApplied.excludeTags.join(", ");
      return `No orders found after excluding items tagged with: ${excludedTags}`;
    }

    // Check for specific job number searches
    const jobNumberMatch = query.match(/\b(\d{5,6})\b/);
    if (jobNumberMatch) {
      return `Job #${jobNumberMatch[1]} not found in the system`;
    }

    // Check for specific customer searches
    const customerMatch = query.match(
      /\b(customer|client|company)\s+([a-zA-Z\s]+)/i
    );
    if (customerMatch) {
      return `No orders found for customer: ${customerMatch[2]}`;
    }

    // Check for status-specific searches
    const statusKeywords = [
      "approved",
      "closed",
      "running",
      "late",
      "done",
      "complete",
    ];
    const statusMatch = statusKeywords.find((status) =>
      queryLower.includes(status)
    );
    if (statusMatch) {
      return `No orders found with status: ${statusMatch}`;
    }

    // Check for product-specific searches
    const productKeywords = ["jacket", "shirt", "bag", "hat", "cap", "tote"];
    const productMatch = productKeywords.find((product) =>
      queryLower.includes(product)
    );
    if (productMatch) {
      return `No orders found containing: ${productMatch}`;
    }

    // Default reason
    return `No orders match your search criteria`;
  }

  /**
   * Generate helpful suggestions to improve the search
   */
  private generateSuggestions(
    query: string,
    searchParams: any,
    allOrders: ModernOrder[]
  ): string[] {
    const suggestions: string[] = [];
    const queryLower = query.toLowerCase();

    // Date range suggestions
    if (searchParams.dateRange) {
      suggestions.push("Try expanding your date range");
      suggestions.push(
        'Check if you meant "this week" or "this month" instead'
      );
    }

    // Exclusion filter suggestions
    if (searchParams.filtersApplied.excludeTags) {
      suggestions.push("Remove exclusion filters to see more results");
      suggestions.push("Try including orders with those tags instead");
    }

    // Spelling suggestions
    if (query.length > 3) {
      suggestions.push(
        "Check spelling of customer names or product descriptions"
      );
    }

    // Status suggestions
    if (allOrders.length > 0) {
      const commonStatuses = this.getCommonStatuses(allOrders);
      if (commonStatuses.length > 0) {
        suggestions.push(
          `Try searching for orders with status: ${commonStatuses
            .slice(0, 3)
            .join(", ")}`
        );
      }
    }

    // Broaden search suggestions
    suggestions.push('Use broader terms (e.g., "shirt" instead of "t-shirt")');
    suggestions.push("Remove specific filters and search more generally");

    // Recent orders suggestion
    suggestions.push('Try "show me recent orders" or "orders from this week"');

    return suggestions;
  }

  /**
   * Generate alternative search queries
   */
  private generateAlternatives(
    query: string,
    searchParams: any,
    allOrders: ModernOrder[]
  ): string[] {
    const alternatives: string[] = [];
    const queryLower = query.toLowerCase();

    // If searching for specific criteria, suggest broader versions
    if (queryLower.includes("next week")) {
      alternatives.push("show me orders due this week");
      alternatives.push("show me orders due soon");
    }

    if (queryLower.includes("not marked")) {
      alternatives.push("show me orders without tags");
      alternatives.push("show me untagged orders");
    }

    if (queryLower.includes("cost") || queryLower.includes("price")) {
      alternatives.push("show me high-value orders");
      alternatives.push("show me recent orders with pricing");
    }

    // Product alternatives
    if (queryLower.includes("jacket")) {
      alternatives.push("show me apparel orders");
      alternatives.push("show me clothing orders");
    }

    if (queryLower.includes("rush") || queryLower.includes("urgent")) {
      alternatives.push("show me priority orders");
      alternatives.push("show me time-sensitive orders");
    }

    // Status alternatives
    if (queryLower.includes("approved")) {
      alternatives.push("show me active orders");
      alternatives.push("show me orders in progress");
    }

    // Customer alternatives
    const customerMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/);
    if (customerMatch) {
      alternatives.push(`show me orders for ${customerMatch[1].split(" ")[0]}`);
      alternatives.push("show me orders from recent customers");
    }

    // Generic alternatives
    alternatives.push("show me all orders");
    alternatives.push("show me orders due today");
    alternatives.push("show me recent orders");

    return alternatives;
  }

  /**
   * Get common statuses from orders
   */
  private getCommonStatuses(orders: ModernOrder[]): string[] {
    const statusCounts = new Map<string, number>();

    orders.forEach((order) => {
      const status = order.status.master;
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    });

    return Array.from(statusCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([status]) => status);
  }

  /**
   * Get common tags from orders
   */
  private getCommonTags(orders: ModernOrder[]): string[] {
    const tagCounts = new Map<string, number>();

    orders.forEach((order) => {
      if (order.tags) {
        order.tags.forEach((tag) => {
          tagCounts.set(tag.tag, (tagCounts.get(tag.tag) || 0) + 1);
        });
      }
    });

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }

  /**
   * Identify date range issues
   */
  private identifyDateRangeIssues(
    dateRange: { start: Date; end: Date } | undefined,
    allOrders: ModernOrder[]
  ): string[] | undefined {
    if (!dateRange || allOrders.length === 0) return undefined;

    const issues: string[] = [];
    const orderDates = allOrders.map((order) => new Date(order.dates.dateDue));
    const earliestOrder = new Date(
      Math.min(...orderDates.map((d) => d.getTime()))
    );
    const latestOrder = new Date(
      Math.max(...orderDates.map((d) => d.getTime()))
    );

    if (dateRange.start > latestOrder) {
      issues.push(
        `Search range starts after the latest order (${latestOrder.toLocaleDateString()})`
      );
    }

    if (dateRange.end < earliestOrder) {
      issues.push(
        `Search range ends before the earliest order (${earliestOrder.toLocaleDateString()})`
      );
    }

    const daysDiff = Math.ceil(
      (dateRange.end.getTime() - dateRange.start.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysDiff < 1) {
      issues.push("Date range is too narrow (less than 1 day)");
    }

    return issues.length > 0 ? issues : undefined;
  }

  /**
   * Describe applied filters
   */
  private describeFilters(filters: FilterCriteria): string[] {
    const descriptions: string[] = [];

    if (filters.includeTags) {
      descriptions.push(`Including tags: ${filters.includeTags.join(", ")}`);
    }

    if (filters.excludeTags) {
      descriptions.push(`Excluding tags: ${filters.excludeTags.join(", ")}`);
    }

    if (filters.includeStatuses) {
      descriptions.push(
        `Including statuses: ${filters.includeStatuses.join(", ")}`
      );
    }

    if (filters.excludeStatuses) {
      descriptions.push(
        `Excluding statuses: ${filters.excludeStatuses.join(", ")}`
      );
    }

    if (filters.customers) {
      descriptions.push(`Customers: ${filters.customers.join(", ")}`);
    }

    if (filters.dateRange) {
      descriptions.push(
        `Date range: ${filters.dateRange.start.toLocaleDateString()} to ${filters.dateRange.end.toLocaleDateString()}`
      );
    }

    return descriptions;
  }

  /**
   * Generate user-friendly message from feedback
   */
  formatFeedbackMessage(feedback: NoResultsFeedback): string {
    let message = `${feedback.reason}.\n\n`;

    if (feedback.suggestions.length > 0) {
      message += `💡 **Suggestions:**\n`;
      feedback.suggestions.slice(0, 3).forEach((suggestion, i) => {
        message += `${i + 1}. ${suggestion}\n`;
      });
      message += "\n";
    }

    if (feedback.alternatives.length > 0) {
      message += `🔄 **Try these instead:**\n`;
      feedback.alternatives.slice(0, 3).forEach((alternative, i) => {
        message += `• "${alternative}"\n`;
      });
      message += "\n";
    }

    if (feedback.debugInfo) {
      message += `📊 **Search Details:**\n`;
      message += `• Searched ${feedback.debugInfo.totalOrdersSearched} orders\n`;
      if (feedback.debugInfo.filtersApplied.length > 0) {
        message += `• Filters: ${feedback.debugInfo.filtersApplied.join(
          ", "
        )}\n`;
      }
      if (feedback.debugInfo.commonStatuses.length > 0) {
        message += `• Common statuses: ${feedback.debugInfo.commonStatuses.join(
          ", "
        )}\n`;
      }
    }

    return message;
  }
}

// Export singleton instance
export const noResultsFeedbackService = new NoResultsFeedbackService();

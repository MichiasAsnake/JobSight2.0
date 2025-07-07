// Enhanced Filtering Service - Handles filtering based on GPT intent analysis

import { ModernOrder } from "./api-first-data-service";
import { QueryIntent } from "./query-router";

export interface FilterCriteria {
  includeStatuses?: string[];
  excludeStatuses?: string[];
  includeTags?: string[];
  excludeTags?: string[];
  includeKeywords?: string[];
  excludeKeywords?: string[];
  dateRange?: {
    start: Date;
    end: Date;
    field: "dateDue" | "dateEntered";
  };
  customers?: string[];
  excludeCustomers?: string[];
}

export interface FilterParseResult {
  criteria: FilterCriteria;
  isNegationQuery: boolean;
  remainingQuery: string;
  filterDescription: string;
}

export class EnhancedFilteringService {
  /**
   * Parse query intent for filtering criteria using GPT analysis
   */
  parseFilterQueryFromIntent(
    query: string,
    intent: QueryIntent
  ): FilterParseResult {
    console.log(
      `🔍 [ENHANCED-FILTER] Parsing filter from GPT intent: "${query}"`
    );
    console.log(
      `🔍 [ENHANCED-FILTER] Raw GPT intent:`,
      JSON.stringify(intent, null, 2)
    );

    const criteria: FilterCriteria = {};
    const filterDescriptions: string[] = [];
    let isNegationQuery = false;

    // Extract status filters from GPT intent
    if (
      intent.extractedEntities.statuses &&
      intent.extractedEntities.statuses.length > 0
    ) {
      const statuses = intent.extractedEntities.statuses;
      console.log(`🔍 [ENHANCED-FILTER] Parsed statuses from GPT:`, statuses);

      // Map status terms to actual status values
      const statusMappings: Record<string, string[]> = {
        overdue: ["overdue", "late", "past due"],
        urgent: ["urgent", "priority", "high priority"],
        approved: ["approved", "approval"],
        completed: ["completed", "done", "finished"],
        "on time": ["on time", "ontime"],
        unapproved: ["unapproved", "pending"],
      };

      const mappedStatuses: string[] = [];
      for (const status of statuses) {
        const mapped = statusMappings[status.toLowerCase()] || [status];
        mappedStatuses.push(...mapped);
      }

      if (mappedStatuses.length > 0) {
        criteria.includeStatuses = mappedStatuses;
        filterDescriptions.push(`statuses: ${mappedStatuses.join(", ")}`);
        console.log(`🔍 [ENHANCED-FILTER] Mapped statuses:`, mappedStatuses);
      }
    }

    // Extract tag filters from GPT intent
    if (
      intent.extractedEntities.tags &&
      intent.extractedEntities.tags.length > 0
    ) {
      criteria.includeTags = intent.extractedEntities.tags;
      filterDescriptions.push(
        `tags: ${intent.extractedEntities.tags.join(", ")}`
      );
      console.log(
        `🔍 [ENHANCED-FILTER] Include tags:`,
        intent.extractedEntities.tags
      );
    }

    // Extract exclude tag filters from GPT intent
    if (
      intent.extractedEntities.excludeTags &&
      intent.extractedEntities.excludeTags.length > 0
    ) {
      criteria.excludeTags = intent.extractedEntities.excludeTags;
      filterDescriptions.push(
        `excluding tags: ${intent.extractedEntities.excludeTags.join(", ")}`
      );
      isNegationQuery = true;
      console.log(
        `🔍 [ENHANCED-FILTER] Exclude tags:`,
        intent.extractedEntities.excludeTags
      );
    }

    // Extract customer filters from GPT intent
    if (
      intent.extractedEntities.customers &&
      intent.extractedEntities.customers.length > 0
    ) {
      criteria.customers = intent.extractedEntities.customers;
      filterDescriptions.push(
        `customers: ${intent.extractedEntities.customers.join(", ")}`
      );
      console.log(
        `🔍 [ENHANCED-FILTER] Customers:`,
        intent.extractedEntities.customers
      );
    }

    // Extract date ranges from GPT intent
    if (
      intent.extractedEntities.dateRanges &&
      intent.extractedEntities.dateRanges.length > 0
    ) {
      const dateRange = intent.extractedEntities.dateRanges[0];
      criteria.dateRange = {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end),
        field: "dateDue", // Default to due date filtering
      };
      filterDescriptions.push(
        `date range: ${dateRange.start} to ${dateRange.end}`
      );

      // Add debug logging for date parsing
      console.log(
        `🔍 [DATE-PARSING] Query: "${query}" → Calculated range: ${dateRange.start} to ${dateRange.end}`
      );
    }

    // Extract keyword filters from GPT intent
    if (
      intent.extractedEntities.keywords &&
      intent.extractedEntities.keywords.length > 0
    ) {
      criteria.includeKeywords = intent.extractedEntities.keywords;
      filterDescriptions.push(
        `keywords: ${intent.extractedEntities.keywords.join(", ")}`
      );
      console.log(
        `🔍 [ENHANCED-FILTER] Keywords:`,
        intent.extractedEntities.keywords
      );
    }

    const filterDescription =
      filterDescriptions.length > 0
        ? filterDescriptions.join(", ")
        : "no filters";

    console.log(`🔍 [ENHANCED-FILTER] Final parsed filters:`, {
      criteria,
      isNegationQuery,
      filterDescription,
    });

    return {
      criteria,
      isNegationQuery,
      filterDescription,
      remainingQuery: query,
    };
  }

  /**
   * Apply filters to a list of orders
   */
  applyFilters(orders: ModernOrder[], criteria: FilterCriteria): ModernOrder[] {
    console.log(
      `🔍 [ENHANCED-FILTER] Applying filters to ${orders.length} orders`
    );

    let filteredOrders = [...orders];

    // Apply status filters (including overdue detection)
    if (criteria.includeStatuses && criteria.includeStatuses.length > 0) {
      filteredOrders = filteredOrders.filter((order) => {
        // Check if any of the required statuses are "overdue" related
        const hasOverdueStatus = criteria.includeStatuses!.some((status) =>
          ["overdue", "late", "past due"].includes(status.toLowerCase())
        );

        if (hasOverdueStatus) {
          // Use overdue detection logic
          return this.isOverdue(order);
        } else {
          // Use regular status matching
          return criteria.includeStatuses!.some((status) =>
            order.status.master.toLowerCase().includes(status.toLowerCase())
          );
        }
      });
    }

    if (criteria.excludeStatuses && criteria.excludeStatuses.length > 0) {
      filteredOrders = filteredOrders.filter(
        (order) =>
          !criteria.excludeStatuses!.some((status) =>
            order.status.master.toLowerCase().includes(status.toLowerCase())
          )
      );
    }

    // Apply tag filters
    if (criteria.includeTags && criteria.includeTags.length > 0) {
      console.log(
        `🔍 [TAG-DEBUG] Looking for tags: ${criteria.includeTags.join(", ")}`
      );

      // Debug: Log all tags in the dataset for orders in date range
      const ordersInDateRange = filteredOrders.filter((order) => {
        if (!criteria.dateRange) return true;
        const orderDate = new Date(order.dates.dateDue);
        return (
          orderDate >= criteria.dateRange.start &&
          orderDate <= criteria.dateRange.end
        );
      });

      console.log(
        `🔍 [TAG-DEBUG] Found ${ordersInDateRange.length} orders in date range`
      );

      // Log all unique tags in the date range
      const allTags = new Set<string>();
      ordersInDateRange.forEach((order) => {
        if (order.tags) {
          order.tags.forEach((tag) => allTags.add(tag.tag));
        }
      });
      console.log(
        `🔍 [TAG-DEBUG] All tags in date range: ${Array.from(allTags).join(
          ", "
        )}`
      );

      filteredOrders = filteredOrders.filter((order) => {
        const hasTag = criteria.includeTags!.some((tag) =>
          this.orderHasTag(order, tag)
        );

        if (!hasTag && order.tags && order.tags.length > 0) {
          console.log(
            `🔍 [TAG-DEBUG] Order ${order.jobNumber} has tags: ${order.tags
              .map((t) => t.tag)
              .join(", ")} but didn't match criteria`
          );
        }

        return hasTag;
      });
    }

    if (criteria.excludeTags && criteria.excludeTags.length > 0) {
      filteredOrders = filteredOrders.filter(
        (order) =>
          !criteria.excludeTags!.some((tag) => this.orderHasTag(order, tag))
      );
    }

    // Apply keyword filters (search in description, comments, etc.)
    if (criteria.includeKeywords && criteria.includeKeywords.length > 0) {
      filteredOrders = filteredOrders.filter((order) =>
        criteria.includeKeywords!.some((keyword) =>
          this.orderContainsKeyword(order, keyword)
        )
      );
    }

    if (criteria.excludeKeywords && criteria.excludeKeywords.length > 0) {
      filteredOrders = filteredOrders.filter(
        (order) =>
          !criteria.excludeKeywords!.some((keyword) =>
            this.orderContainsKeyword(order, keyword)
          )
      );
    }

    // Apply date range filters
    if (criteria.dateRange) {
      filteredOrders = filteredOrders.filter((order) => {
        const orderDate =
          criteria.dateRange!.field === "dateDue"
            ? new Date(order.dates.dateDue)
            : new Date(order.dates.dateEntered);

        return (
          orderDate >= criteria.dateRange!.start &&
          orderDate <= criteria.dateRange!.end
        );
      });
    }

    // Apply customer filters
    if (criteria.customers && criteria.customers.length > 0) {
      filteredOrders = filteredOrders.filter((order) =>
        criteria.customers!.some((customer) =>
          order.customer.company.toLowerCase().includes(customer.toLowerCase())
        )
      );
    }

    if (criteria.excludeCustomers && criteria.excludeCustomers.length > 0) {
      filteredOrders = filteredOrders.filter(
        (order) =>
          !criteria.excludeCustomers!.some((customer) =>
            order.customer.company
              .toLowerCase()
              .includes(customer.toLowerCase())
          )
      );
    }

    console.log(
      `🔍 [ENHANCED-FILTER] Filtered to ${filteredOrders.length} orders`
    );
    return filteredOrders;
  }

  /**
   * Check if order contains a keyword in any searchable field
   */
  private orderContainsKeyword(order: ModernOrder, keyword: string): boolean {
    const keywordLower = keyword.toLowerCase();

    // Search in description
    if (
      order.description &&
      order.description.toLowerCase().includes(keywordLower)
    ) {
      return true;
    }

    // Search in comments
    if (order.comments && order.comments.toLowerCase().includes(keywordLower)) {
      return true;
    }

    // Search in customer name
    if (order.customer.company.toLowerCase().includes(keywordLower)) {
      return true;
    }

    // Search in tags
    if (
      order.tags &&
      order.tags.some((tag) => tag.tag.toLowerCase().includes(keywordLower))
    ) {
      return true;
    }

    // Search in line items
    if (
      order.lineItems &&
      order.lineItems.some((item) =>
        item.description.toLowerCase().includes(keywordLower)
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Create human-readable filter description
   */
  describeFilters(criteria: FilterCriteria): string {
    const parts: string[] = [];

    if (criteria.includeTags && criteria.includeTags.length > 0) {
      parts.push(`with tags: ${criteria.includeTags.join(", ")}`);
    }

    if (criteria.excludeTags && criteria.excludeTags.length > 0) {
      parts.push(`excluding tags: ${criteria.excludeTags.join(", ")}`);
    }

    if (criteria.includeStatuses && criteria.includeStatuses.length > 0) {
      parts.push(`with status: ${criteria.includeStatuses.join(", ")}`);
    }

    if (criteria.excludeStatuses && criteria.excludeStatuses.length > 0) {
      parts.push(`excluding status: ${criteria.excludeStatuses.join(", ")}`);
    }

    if (criteria.dateRange) {
      parts.push(
        `${
          criteria.dateRange.field
        } between ${criteria.dateRange.start.toLocaleDateString()} and ${criteria.dateRange.end.toLocaleDateString()}`
      );
    }

    return parts.join(", ") || "no filters";
  }

  private isOverdue(job: ModernOrder): boolean {
    // Check if job is overdue based on daysToDueDate
    if (job.dates?.daysToDueDate !== undefined) {
      return job.dates.daysToDueDate < 0;
    }

    // Fallback: check if due date is in the past
    if (job.dates?.dateDue) {
      const dueDate = new Date(job.dates.dateDue);
      const today = new Date();
      return dueDate < today;
    }

    return false;
  }

  /**
   * Check if order has a specific tag (handles different tag formats)
   */
  private orderHasTag(order: ModernOrder, tag: string): boolean {
    if (!order.tags || order.tags.length === 0) {
      return false;
    }

    const tagLower = tag.toLowerCase().trim();

    // Handle different tag formats
    const tagVariations = [
      tagLower,
      tagLower.startsWith("@") ? tagLower.substring(1) : `@${tagLower}`,
      tagLower.replace(/[^a-zA-Z0-9]/g, ""), // Remove special characters
      tagLower.replace(/\s+/g, "-"), // Replace spaces with hyphens
      tagLower.replace(/\s+/g, ""), // Remove spaces
    ];

    console.log(
      `🔍 [TAG-MATCH-DEBUG] Looking for tag: "${tag}" (variations: ${tagVariations.join(
        ", "
      )})`
    );

    return order.tags.some((orderTag) => {
      const orderTagLower = orderTag.tag.toLowerCase().trim();

      console.log(
        `🔍 [TAG-MATCH-DEBUG] Comparing with order tag: "${orderTag.tag}" (normalized: "${orderTagLower}")`
      );

      // Exact match
      if (orderTagLower === tagLower) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Exact match found!`);
        return true;
      }

      // Check variations
      if (tagVariations.some((variation) => orderTagLower === variation)) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Variation match found!`);
        return true;
      }

      // Partial match (for cases like "in production" matching "production")
      if (
        tagLower.includes(" ") &&
        orderTagLower.includes(tagLower.split(" ").pop()!)
      ) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Partial match found!`);
        return true;
      }

      // Handle special cases
      if (tagLower === "production" && orderTagLower.includes("production")) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Production special case match!`);
        return true;
      }

      if (
        tagLower === "urgent" &&
        (orderTagLower.includes("urgent") || orderTagLower.includes("priority"))
      ) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Urgent special case match!`);
        return true;
      }

      // Fallback: substring matching for more flexible tag matching
      if (
        orderTagLower.includes(tagLower) ||
        tagLower.includes(orderTagLower)
      ) {
        console.log(`🔍 [TAG-MATCH-DEBUG] ✅ Substring match found!`);
        return true;
      }

      console.log(`🔍 [TAG-MATCH-DEBUG] ❌ No match`);
      return false;
    });
  }

  /**
   * Public method to test tag matching (for debugging)
   */
  public testTagMatch(order: ModernOrder, searchTag: string): boolean {
    return this.orderHasTag(order, searchTag);
  }

  /**
   * Get all tags from an order (for debugging)
   */
  public getOrderTags(order: ModernOrder): string[] {
    return order.tags ? order.tags.map((t) => t.tag) : [];
  }
}

// Export singleton instance
export const enhancedFilteringService = new EnhancedFilteringService();

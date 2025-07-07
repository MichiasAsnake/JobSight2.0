// Cache Validation Service - Ensures appropriate cache freshness for time-sensitive queries

export interface CacheValidationResult {
  shouldUseCache: boolean;
  reason: string;
  maxAge: number;
  actualAge: number;
  urgencyLevel: "low" | "medium" | "high" | "critical";
}

export interface QueryCharacteristics {
  isTimeSensitive: boolean;
  isDateBased: boolean;
  isFinancial: boolean;
  isStatusBased: boolean;
  urgencyKeywords: string[];
  temporalKeywords: string[];
}

export class CacheValidationService {
  private readonly urgencyKeywords = {
    critical: [
      "rush",
      "urgent",
      "asap",
      "emergency",
      "immediate",
      "now",
      "today",
    ],
    high: [
      "priority",
      "important",
      "soon",
      "tomorrow",
      "this week",
      "overdue",
      "late",
    ],
    medium: ["next week", "upcoming", "pending", "due", "deadline"],
    low: ["eventually", "future", "later", "next month", "long term"],
  };

  private readonly temporalKeywords = [
    "today",
    "yesterday",
    "tomorrow",
    "now",
    "current",
    "latest",
    "recent",
    "this week",
    "last week",
    "next week",
    "this month",
    "overdue",
    "due",
    "real-time",
    "live",
    "up-to-date",
    "fresh",
    "new",
  ];

  private readonly financialKeywords = [
    "cost",
    "price",
    "value",
    "total",
    "amount",
    "budget",
    "expensive",
    "cheap",
    "billing",
    "invoice",
    "payment",
    "revenue",
    "profit",
  ];

  private readonly statusKeywords = [
    "status",
    "progress",
    "state",
    "condition",
    "current",
    "latest",
    "running",
    "approved",
    "closed",
    "complete",
    "pending",
  ];

  /**
   * Analyze query characteristics to determine caching strategy
   */
  analyzeQuery(query: string): QueryCharacteristics {
    const queryLower = query.toLowerCase();

    const urgencyKeywords = this.extractUrgencyKeywords(queryLower);
    const temporalKeywords = this.temporalKeywords.filter((keyword) =>
      queryLower.includes(keyword)
    );

    const isTimeSensitive =
      temporalKeywords.length > 0 ||
      urgencyKeywords.some((k) => ["critical", "high"].includes(k));

    const isDateBased =
      /\b(today|yesterday|tomorrow|this week|last week|next week|due|overdue)\b/.test(
        queryLower
      );

    const isFinancial = this.financialKeywords.some((keyword) =>
      queryLower.includes(keyword)
    );

    const isStatusBased = this.statusKeywords.some((keyword) =>
      queryLower.includes(keyword)
    );

    return {
      isTimeSensitive,
      isDateBased,
      isFinancial,
      isStatusBased,
      urgencyKeywords,
      temporalKeywords,
    };
  }

  /**
   * Validate if cached data is appropriate for the query
   */
  validateCache(
    query: string,
    cacheAge: number,
    cacheMetadata?: {
      timestamp: number;
      source: string;
      strategy: string;
    }
  ): CacheValidationResult {
    console.log(
      `🕐 [CACHE-VALIDATION] Validating cache for: "${query}" (age: ${Math.round(
        cacheAge / 1000
      )}s)`
    );

    const characteristics = this.analyzeQuery(query);
    const urgencyLevel = this.determineUrgencyLevel(characteristics);
    const maxAge = this.getMaxCacheAge(urgencyLevel, characteristics);

    const shouldUseCache =
      cacheAge <= maxAge && this.isContextuallyValid(query, cacheMetadata);

    const reason = this.generateValidationReason(
      shouldUseCache,
      urgencyLevel,
      cacheAge,
      maxAge,
      characteristics
    );

    const result: CacheValidationResult = {
      shouldUseCache,
      reason,
      maxAge,
      actualAge: cacheAge,
      urgencyLevel,
    };

    console.log(
      `🕐 [CACHE-VALIDATION] Result: ${
        shouldUseCache ? "USE" : "SKIP"
      } cache (${urgencyLevel} urgency)`
    );
    return result;
  }

  /**
   * Get maximum acceptable cache age based on urgency and characteristics
   */
  private getMaxCacheAge(
    urgencyLevel: "low" | "medium" | "high" | "critical",
    characteristics: QueryCharacteristics
  ): number {
    // Base cache ages in milliseconds
    const baseCacheAges = {
      critical: 60 * 1000, // 1 minute
      high: 5 * 60 * 1000, // 5 minutes
      medium: 15 * 60 * 1000, // 15 minutes
      low: 60 * 60 * 1000, // 1 hour
    };

    let maxAge = baseCacheAges[urgencyLevel];

    // Adjust based on query characteristics
    if (characteristics.isTimeSensitive) {
      maxAge = Math.min(maxAge, 5 * 60 * 1000); // Max 5 minutes for time-sensitive
    }

    if (characteristics.isDateBased) {
      maxAge = Math.min(maxAge, 10 * 60 * 1000); // Max 10 minutes for date-based
    }

    if (characteristics.isFinancial) {
      maxAge = Math.min(maxAge, 15 * 60 * 1000); // Max 15 minutes for financial
    }

    if (characteristics.isStatusBased) {
      maxAge = Math.min(maxAge, 10 * 60 * 1000); // Max 10 minutes for status
    }

    return maxAge;
  }

  /**
   * Determine urgency level based on query characteristics
   */
  private determineUrgencyLevel(
    characteristics: QueryCharacteristics
  ): "low" | "medium" | "high" | "critical" {
    // Check for critical urgency keywords
    if (
      characteristics.urgencyKeywords.some((k) =>
        this.urgencyKeywords.critical.includes(k)
      )
    ) {
      return "critical";
    }

    // Check for high urgency keywords
    if (
      characteristics.urgencyKeywords.some((k) =>
        this.urgencyKeywords.high.includes(k)
      )
    ) {
      return "high";
    }

    // Check for medium urgency keywords
    if (
      characteristics.urgencyKeywords.some((k) =>
        this.urgencyKeywords.medium.includes(k)
      )
    ) {
      return "medium";
    }

    // Time-sensitive queries default to high urgency
    if (characteristics.isTimeSensitive) {
      return "high";
    }

    // Date-based queries default to medium urgency
    if (characteristics.isDateBased) {
      return "medium";
    }

    // Financial queries default to medium urgency
    if (characteristics.isFinancial) {
      return "medium";
    }

    return "low";
  }

  /**
   * Extract urgency keywords from query
   */
  private extractUrgencyKeywords(queryLower: string): string[] {
    const found: string[] = [];

    for (const [level, keywords] of Object.entries(this.urgencyKeywords)) {
      for (const keyword of keywords) {
        if (queryLower.includes(keyword)) {
          found.push(keyword);
        }
      }
    }

    return found;
  }

  /**
   * Check if cache is contextually valid
   */
  private isContextuallyValid(
    query: string,
    cacheMetadata?: { timestamp: number; source: string; strategy: string }
  ): boolean {
    if (!cacheMetadata) return true;

    const queryLower = query.toLowerCase();

    // For "now" or "current" queries, cache is only valid if very recent
    if (/\b(now|current|latest|real-time)\b/.test(queryLower)) {
      const age = Date.now() - cacheMetadata.timestamp;
      return age < 2 * 60 * 1000; // 2 minutes max for "current" queries
    }

    // For date-specific queries, check if cache is from the same day
    if (/\b(today|yesterday|tomorrow)\b/.test(queryLower)) {
      const cacheDate = new Date(cacheMetadata.timestamp);
      const now = new Date();
      const isSameDay = cacheDate.toDateString() === now.toDateString();

      if (queryLower.includes("today") && !isSameDay) {
        return false; // "Today" queries need same-day cache
      }
    }

    return true;
  }

  /**
   * Generate human-readable validation reason
   */
  private generateValidationReason(
    shouldUseCache: boolean,
    urgencyLevel: string,
    cacheAge: number,
    maxAge: number,
    characteristics: QueryCharacteristics
  ): string {
    const ageInSeconds = Math.round(cacheAge / 1000);
    const maxAgeInSeconds = Math.round(maxAge / 1000);

    if (shouldUseCache) {
      return `Cache is acceptable (${ageInSeconds}s old, max ${maxAgeInSeconds}s for ${urgencyLevel} urgency)`;
    } else {
      const reasons: string[] = [];

      if (cacheAge > maxAge) {
        reasons.push(`cache too old (${ageInSeconds}s > ${maxAgeInSeconds}s)`);
      }

      if (characteristics.isTimeSensitive) {
        reasons.push("time-sensitive query requires fresh data");
      }

      if (
        characteristics.temporalKeywords.some((k) =>
          ["now", "current", "latest"].includes(k)
        )
      ) {
        reasons.push("real-time data required");
      }

      return `Cache invalid: ${reasons.join(", ")}`;
    }
  }

  /**
   * Get cache strategy recommendation
   */
  getCacheStrategy(query: string): {
    strategy: "aggressive" | "standard" | "conservative" | "bypass";
    ttl: number;
    reasoning: string;
  } {
    const characteristics = this.analyzeQuery(query);
    const urgencyLevel = this.determineUrgencyLevel(characteristics);

    let strategy: "aggressive" | "standard" | "conservative" | "bypass";
    let ttl: number;
    let reasoning: string;

    switch (urgencyLevel) {
      case "critical":
        strategy = "bypass";
        ttl = 0;
        reasoning = "Critical urgency - always fetch fresh data";
        break;

      case "high":
        strategy = "conservative";
        ttl = 5 * 60 * 1000; // 5 minutes
        reasoning = "High urgency - short cache TTL";
        break;

      case "medium":
        strategy = "standard";
        ttl = 15 * 60 * 1000; // 15 minutes
        reasoning = "Medium urgency - standard cache TTL";
        break;

      case "low":
        strategy = "aggressive";
        ttl = 60 * 60 * 1000; // 1 hour
        reasoning = "Low urgency - long cache TTL";
        break;
    }

    // Adjust for special characteristics
    if (characteristics.isTimeSensitive && strategy !== "bypass") {
      strategy = "conservative";
      ttl = Math.min(ttl, 10 * 60 * 1000); // Max 10 minutes for time-sensitive
      reasoning += " (reduced for time sensitivity)";
    }

    return { strategy, ttl, reasoning };
  }

  /**
   * Check if cache warming is needed
   */
  shouldWarmCache(query: string, lastUpdate: number): boolean {
    const characteristics = this.analyzeQuery(query);
    const urgencyLevel = this.determineUrgencyLevel(characteristics);

    // For high/critical urgency queries, warm cache more frequently
    const warmThreshold =
      urgencyLevel === "critical"
        ? 30 * 1000 // 30 seconds
        : urgencyLevel === "high"
        ? 2 * 60 * 1000 // 2 minutes
        : urgencyLevel === "medium"
        ? 5 * 60 * 1000 // 5 minutes
        : 15 * 60 * 1000; // 15 minutes

    const age = Date.now() - lastUpdate;
    return age > warmThreshold;
  }
}

// Export singleton instance
export const cacheValidationService = new CacheValidationService();

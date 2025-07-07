// Standardized Date Parser - Single source of truth for date parsing across the application
// Consolidates temporal-utils.ts and date-parser-service.ts to eliminate inconsistencies

export interface StandardizedDateRange {
  start: Date;
  end: Date;
  startISO: string;
  endISO: string;
  description: string;
  confidence: "high" | "medium" | "low";
  original: string;
  businessContext?: {
    isUrgent: boolean;
    isOverdue: boolean;
    workingDaysAffected: number;
  };
}

export interface DateParseResult {
  dateRange?: StandardizedDateRange;
  isDateQuery: boolean;
  remainingQuery: string;
  temporalKeywords: string[];
}

export class StandardizedDateParser {
  private timezone: string;

  constructor(timezone: string = "America/Los_Angeles") {
    this.timezone = timezone;
  }

  /**
   * Main parsing method - consolidates all date parsing logic
   */
  parseQuery(query: string): DateParseResult {
    console.log(`📅 [STANDARDIZED] Parsing date from query: "${query}"`);

    const temporalKeywords = this.extractTemporalKeywords(query);
    let remainingQuery = query;
    let bestMatch: StandardizedDateRange | undefined;
    let highestConfidence = 0;

    // Relative date patterns (prioritized for consistency)
    const patterns = [
      // Today/Yesterday/Tomorrow
      { pattern: /\btoday\b/gi, handler: () => this.getToday() },
      { pattern: /\byesterday\b/gi, handler: () => this.getYesterday() },
      { pattern: /\btomorrow\b/gi, handler: () => this.getTomorrow() },

      // Week patterns (standardized to Monday-Sunday)
      { pattern: /\bthis week\b/gi, handler: () => this.getThisWeek() },
      { pattern: /\blast week\b/gi, handler: () => this.getLastWeek() },
      { pattern: /\bnext week\b/gi, handler: () => this.getNextWeek() },

      // Month patterns
      { pattern: /\bthis month\b/gi, handler: () => this.getThisMonth() },
      { pattern: /\blast month\b/gi, handler: () => this.getLastMonth() },
      { pattern: /\bnext month\b/gi, handler: () => this.getNextMonth() },

      // Due date patterns
      { pattern: /\bdue today\b/gi, handler: () => this.getToday() },
      { pattern: /\bdue tomorrow\b/gi, handler: () => this.getTomorrow() },
      { pattern: /\bdue this week\b/gi, handler: () => this.getThisWeek() },
      { pattern: /\bdue next week\b/gi, handler: () => this.getNextWeek() },
      { pattern: /\bdue soon\b/gi, handler: () => this.getNextXDays(3) },

      // Status patterns
      { pattern: /\boverdue\b/gi, handler: () => this.getOverdue() },
      { pattern: /\burgent\b/gi, handler: () => this.getNextXDays(1) },
      { pattern: /\brush\b/gi, handler: () => this.getToday() },
      { pattern: /\basap\b/gi, handler: () => this.getToday() },

      // Numeric patterns
      {
        pattern: /\blast (\d+) days?\b/gi,
        handler: (match: RegExpMatchArray) =>
          this.getLastXDays(parseInt(match[1])),
      },
      {
        pattern: /\bnext (\d+) days?\b/gi,
        handler: (match: RegExpMatchArray) =>
          this.getNextXDays(parseInt(match[1])),
      },
      {
        pattern: /\blast (\d+) weeks?\b/gi,
        handler: (match: RegExpMatchArray) =>
          this.getLastXWeeks(parseInt(match[1])),
      },
      {
        pattern: /\bnext (\d+) weeks?\b/gi,
        handler: (match: RegExpMatchArray) =>
          this.getNextXWeeks(parseInt(match[1])),
      },

      // ISO date format
      {
        pattern: /\b(\d{4}-\d{2}-\d{2})\b/g,
        handler: (match: RegExpMatchArray) => this.parseISODate(match[1]),
      },

      // US date format
      {
        pattern: /\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/g,
        handler: (match: RegExpMatchArray) => this.parseUSDate(match[0]),
      },
    ];

    // Test all patterns
    for (const { pattern, handler } of patterns) {
      const matches = Array.from(query.matchAll(pattern));
      for (const match of matches) {
        try {
          const dateRange = handler(match);
          if (dateRange) {
            const confidenceNumber = this.confidenceToNumber(
              dateRange.confidence
            );
            if (confidenceNumber > highestConfidence) {
              bestMatch = dateRange;
              highestConfidence = confidenceNumber;
            }
          }

          // Remove matched text from remaining query
          remainingQuery = remainingQuery.replace(match[0], " ").trim();
        } catch (error) {
          console.warn(`📅 Failed to parse date "${match[0]}":`, error);
        }
      }
    }

    // Clean up remaining query
    remainingQuery = remainingQuery.replace(/\s+/g, " ").trim();

    const result: DateParseResult = {
      dateRange: bestMatch,
      isDateQuery: !!bestMatch,
      remainingQuery: remainingQuery || query,
      temporalKeywords,
    };

    if (bestMatch) {
      console.log(
        `📅 [STANDARDIZED] Parsed date: ${bestMatch.startISO} to ${bestMatch.endISO} (${bestMatch.description}, confidence: ${bestMatch.confidence})`
      );
    }

    return result;
  }

  /**
   * Extract temporal keywords from query
   */
  private extractTemporalKeywords(query: string): string[] {
    const keywords = [
      "today",
      "yesterday",
      "tomorrow",
      "this week",
      "last week",
      "next week",
      "this month",
      "last month",
      "next month",
      "urgent",
      "rush",
      "asap",
      "soon",
      "overdue",
      "late",
      "due",
      "deadline",
      "expires",
    ];

    const queryLower = query.toLowerCase();
    return keywords.filter((keyword) => queryLower.includes(keyword));
  }

  /**
   * Create date range with business context
   */
  private createDateRange(
    start: Date,
    end: Date,
    description: string,
    confidence: "high" | "medium" | "low" = "high",
    original: string = description
  ): StandardizedDateRange {
    const now = new Date();
    const isOverdue = end < now;
    const isUrgent = start <= new Date(now.getTime() + 24 * 60 * 60 * 1000); // within 24 hours
    const workingDaysAffected = this.calculateWorkingDays(start, end);

    return {
      start: new Date(start),
      end: new Date(end),
      startISO: start.toISOString(),
      endISO: end.toISOString(),
      description,
      confidence,
      original,
      businessContext: {
        isUrgent,
        isOverdue,
        workingDaysAffected,
      },
    };
  }

  /**
   * Calculate working days between two dates (excludes weekends)
   */
  private calculateWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday or Saturday
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }

  private confidenceToNumber(confidence: "high" | "medium" | "low"): number {
    switch (confidence) {
      case "high":
        return 0.9;
      case "medium":
        return 0.7;
      case "low":
        return 0.5;
    }
  }

  // ================ DATE CALCULATION METHODS ================
  // All methods use Monday as the start of the week for consistency

  private getToday(): StandardizedDateRange {
    const today = new Date();
    const start = new Date(today.setHours(0, 0, 0, 0));
    const end = new Date(today.setHours(23, 59, 59, 999));
    return this.createDateRange(start, end, "Today", "high");
  }

  private getYesterday(): StandardizedDateRange {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const start = new Date(yesterday.setHours(0, 0, 0, 0));
    const end = new Date(yesterday.setHours(23, 59, 59, 999));
    return this.createDateRange(start, end, "Yesterday", "high");
  }

  private getTomorrow(): StandardizedDateRange {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const start = new Date(tomorrow.setHours(0, 0, 0, 0));
    const end = new Date(tomorrow.setHours(23, 59, 59, 999));
    return this.createDateRange(start, end, "Tomorrow", "high");
  }

  private getThisWeek(): StandardizedDateRange {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Calculate days from Monday (Monday = 0, Sunday = 6)
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - daysFromMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return this.createDateRange(startOfWeek, endOfWeek, "This week", "high");
  }

  private getLastWeek(): StandardizedDateRange {
    const thisWeek = this.getThisWeek();
    const startOfLastWeek = new Date(thisWeek.start);
    startOfLastWeek.setDate(thisWeek.start.getDate() - 7);

    const endOfLastWeek = new Date(thisWeek.end);
    endOfLastWeek.setDate(thisWeek.end.getDate() - 7);

    return this.createDateRange(
      startOfLastWeek,
      endOfLastWeek,
      "Last week",
      "high"
    );
  }

  private getNextWeek(): StandardizedDateRange {
    const thisWeek = this.getThisWeek();
    const startOfNextWeek = new Date(thisWeek.start);
    startOfNextWeek.setDate(thisWeek.start.getDate() + 7);

    const endOfNextWeek = new Date(thisWeek.end);
    endOfNextWeek.setDate(thisWeek.end.getDate() + 7);

    return this.createDateRange(
      startOfNextWeek,
      endOfNextWeek,
      "Next week",
      "high"
    );
  }

  private getThisMonth(): StandardizedDateRange {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0
    );
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    return this.createDateRange(startOfMonth, endOfMonth, "This month", "high");
  }

  private getLastMonth(): StandardizedDateRange {
    const now = new Date();
    const startOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
      0,
      0,
      0,
      0
    );
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );
    return this.createDateRange(
      startOfLastMonth,
      endOfLastMonth,
      "Last month",
      "high"
    );
  }

  private getNextMonth(): StandardizedDateRange {
    const now = new Date();
    const startOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      1,
      0,
      0,
      0,
      0
    );
    const endOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      0,
      23,
      59,
      59,
      999
    );
    return this.createDateRange(
      startOfNextMonth,
      endOfNextMonth,
      "Next month",
      "high"
    );
  }

  private getLastXDays(days: number): StandardizedDateRange {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);
    return this.createDateRange(start, end, `Last ${days} days`, "high");
  }

  private getNextXDays(days: number): StandardizedDateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);
    return this.createDateRange(start, end, `Next ${days} days`, "high");
  }

  private getLastXWeeks(weeks: number): StandardizedDateRange {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - weeks * 7);
    start.setHours(0, 0, 0, 0);
    return this.createDateRange(start, end, `Last ${weeks} weeks`, "high");
  }

  private getNextXWeeks(weeks: number): StandardizedDateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + weeks * 7);
    end.setHours(23, 59, 59, 999);
    return this.createDateRange(start, end, `Next ${weeks} weeks`, "high");
  }

  private getOverdue(): StandardizedDateRange {
    const now = new Date();
    const farPast = new Date("2020-01-01");
    return this.createDateRange(farPast, now, "Overdue (past due)", "high");
  }

  private parseISODate(dateStr: string): StandardizedDateRange {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid ISO date: ${dateStr}`);
    }
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    return this.createDateRange(
      start,
      end,
      `Date: ${dateStr}`,
      "high",
      dateStr
    );
  }

  private parseUSDate(dateStr: string): StandardizedDateRange {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid US date: ${dateStr}`);
    }
    const start = new Date(date.setHours(0, 0, 0, 0));
    const end = new Date(date.setHours(23, 59, 59, 999));
    return this.createDateRange(
      start,
      end,
      `Date: ${dateStr}`,
      "medium",
      dateStr
    );
  }

  /**
   * Format date range for API calls
   */
  toAPIFormat(dateRange: StandardizedDateRange): {
    startDate: string;
    endDate: string;
  } {
    return {
      startDate: dateRange.startISO.split("T")[0],
      endDate: dateRange.endISO.split("T")[0],
    };
  }

  /**
   * Check if cache is fresh enough for time-sensitive queries
   */
  isCacheFreshForQuery(
    dateRange: StandardizedDateRange,
    cacheAge: number
  ): boolean {
    const maxCacheAge = dateRange.businessContext?.isUrgent
      ? 300000 // 5 minutes for urgent
      : dateRange.businessContext?.isOverdue
      ? 600000 // 10 minutes for overdue
      : 3600000; // 1 hour for normal queries

    return cacheAge < maxCacheAge;
  }
}

// Export singleton instance
export const standardizedDateParser = new StandardizedDateParser();

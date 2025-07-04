// Temporal Utilities for Date-Aware OMS Assistant
// Handles natural language date parsing, relative date calculations, and temporal context

export interface TemporalContext {
  currentDateTime: string;
  currentDateUTC: string;
  currentTimestamp: number;
  timezone: string;
  businessHours: {
    start: string;
    end: string;
    isCurrentlyBusinessHours: boolean;
  };
}

export interface ParsedDateRange {
  start: Date;
  end: Date;
  description: string;
  confidence: "high" | "medium" | "low";
}

export class TemporalUtilities {
  private timezone: string;

  constructor(timezone: string = "America/Los_Angeles") {
    this.timezone = timezone;
  }

  /**
   * Get comprehensive temporal context for the current moment
   */
  getCurrentTemporalContext(): TemporalContext {
    const now = new Date();
    const currentDateTime = now.toLocaleString("en-US", {
      timeZone: this.timezone,
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      weekday: "long",
    });

    const currentDateUTC = now.toISOString();
    const currentHour = now.getHours();

    return {
      currentDateTime,
      currentDateUTC,
      currentTimestamp: now.getTime(),
      timezone: this.timezone,
      businessHours: {
        start: "8:00 AM",
        end: "6:00 PM",
        isCurrentlyBusinessHours: currentHour >= 8 && currentHour < 18,
      },
    };
  }

  /**
   * Parse natural language date expressions into date ranges
   */
  parseNaturalLanguageDate(expression: string): ParsedDateRange | null {
    const expr = expression.toLowerCase().trim();
    const now = new Date();

    // Define common patterns
    const patterns = [
      // Relative days
      { pattern: /^today$/i, handler: () => this.getToday() },
      { pattern: /^yesterday$/i, handler: () => this.getYesterday() },
      { pattern: /^tomorrow$/i, handler: () => this.getTomorrow() },

      // This/Last/Next week
      { pattern: /^this week$/i, handler: () => this.getThisWeek() },
      { pattern: /^last week$/i, handler: () => this.getLastWeek() },
      { pattern: /^next week$/i, handler: () => this.getNextWeek() },

      // This/Last/Next month
      { pattern: /^this month$/i, handler: () => this.getThisMonth() },
      { pattern: /^last month$/i, handler: () => this.getLastMonth() },
      { pattern: /^next month$/i, handler: () => this.getNextMonth() },

      // Last X days/weeks
      {
        pattern: /^last (\d+) days?$/i,
        handler: (match: RegExpMatchArray) =>
          this.getLastXDays(parseInt(match[1])),
      },
      {
        pattern: /^past (\d+) days?$/i,
        handler: (match: RegExpMatchArray) =>
          this.getLastXDays(parseInt(match[1])),
      },
      {
        pattern: /^last (\d+) weeks?$/i,
        handler: (match: RegExpMatchArray) =>
          this.getLastXWeeks(parseInt(match[1])),
      },

      // Next X days/weeks
      {
        pattern: /^next (\d+) days?$/i,
        handler: (match: RegExpMatchArray) =>
          this.getNextXDays(parseInt(match[1])),
      },
      {
        pattern: /^next (\d+) weeks?$/i,
        handler: (match: RegExpMatchArray) =>
          this.getNextXWeeks(parseInt(match[1])),
      },

      // Due/Overdue patterns
      { pattern: /^due today$/i, handler: () => this.getToday() },
      { pattern: /^overdue$/i, handler: () => this.getOverdue() },
      { pattern: /^due this week$/i, handler: () => this.getThisWeek() },
      { pattern: /^due soon$/i, handler: () => this.getNextXDays(3) },

      // Urgency patterns
      { pattern: /^urgent$/i, handler: () => this.getNextXDays(1) },
      { pattern: /^rush$/i, handler: () => this.getToday() },
      { pattern: /^asap$/i, handler: () => this.getToday() },
    ];

    for (const { pattern, handler } of patterns) {
      const match = expr.match(pattern);
      if (match) {
        return handler(match);
      }
    }

    // Try to parse ISO dates or common formats
    const isoMatch = expr.match(/(\d{4}-\d{2}-\d{2})/);
    if (isoMatch) {
      const date = new Date(isoMatch[1]);
      if (!isNaN(date.getTime())) {
        return {
          start: new Date(date.setHours(0, 0, 0, 0)),
          end: new Date(date.setHours(23, 59, 59, 999)),
          description: `Date: ${date.toLocaleDateString()}`,
          confidence: "high",
        };
      }
    }

    return null;
  }

  /**
   * Extract temporal keywords from user queries
   */
  extractTemporalKeywords(query: string): string[] {
    const temporalKeywords = [
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
      "behind",
      "due",
      "deadline",
      "expires",
      "recent",
      "latest",
      "newest",
      "old",
      "oldest",
      "aged",
    ];

    const query_lower = query.toLowerCase();
    return temporalKeywords.filter((keyword) => query_lower.includes(keyword));
  }

  /**
   * Generate temporal reasoning prompt
   */
  generateTemporalReasoningPrompt(
    query: string,
    context: TemporalContext
  ): string {
    const temporalKeywords = this.extractTemporalKeywords(query);
    const hasTemporalContext = temporalKeywords.length > 0;

    let prompt = `Current Date & Time: ${context.currentDateTime} (${context.timezone})\n`;
    prompt += `Current UTC: ${context.currentDateUTC}\n`;
    prompt += `Business Hours: ${context.businessHours.start} - ${context.businessHours.end} `;
    prompt += `(Currently ${
      context.businessHours.isCurrentlyBusinessHours ? "OPEN" : "CLOSED"
    })\n\n`;

    if (hasTemporalContext) {
      prompt += `🕐 TEMPORAL CONTEXT DETECTED:\n`;
      prompt += `Keywords found: ${temporalKeywords.join(", ")}\n`;
      prompt += `\nWhen processing temporal references:\n`;
      prompt += `1. Calculate exact dates relative to current time\n`;
      prompt += `2. Consider business context (urgency, due dates)\n`;
      prompt += `3. Prioritize time-sensitive orders\n`;
      prompt += `4. Factor in business hours for delivery expectations\n\n`;
    }

    return prompt;
  }

  // Helper methods for date calculations
  private getToday(): ParsedDateRange {
    const today = new Date();
    return {
      start: new Date(today.setHours(0, 0, 0, 0)),
      end: new Date(today.setHours(23, 59, 59, 999)),
      description: "Today",
      confidence: "high",
    };
  }

  private getYesterday(): ParsedDateRange {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return {
      start: new Date(yesterday.setHours(0, 0, 0, 0)),
      end: new Date(yesterday.setHours(23, 59, 59, 999)),
      description: "Yesterday",
      confidence: "high",
    };
  }

  private getTomorrow(): ParsedDateRange {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {
      start: new Date(tomorrow.setHours(0, 0, 0, 0)),
      end: new Date(tomorrow.setHours(23, 59, 59, 999)),
      description: "Tomorrow",
      confidence: "high",
    };
  }

  private getThisWeek(): ParsedDateRange {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    return {
      start: startOfWeek,
      end: endOfWeek,
      description: "This week",
      confidence: "high",
    };
  }

  private getLastWeek(): ParsedDateRange {
    const thisWeek = this.getThisWeek();
    const lastWeekStart = new Date(thisWeek.start);
    lastWeekStart.setDate(thisWeek.start.getDate() - 7);
    const lastWeekEnd = new Date(thisWeek.end);
    lastWeekEnd.setDate(thisWeek.end.getDate() - 7);

    return {
      start: lastWeekStart,
      end: lastWeekEnd,
      description: "Last week",
      confidence: "high",
    };
  }

  private getNextWeek(): ParsedDateRange {
    const thisWeek = this.getThisWeek();
    const nextWeekStart = new Date(thisWeek.start);
    nextWeekStart.setDate(thisWeek.start.getDate() + 7);
    const nextWeekEnd = new Date(thisWeek.end);
    nextWeekEnd.setDate(thisWeek.end.getDate() + 7);

    return {
      start: nextWeekStart,
      end: nextWeekEnd,
      description: "Next week",
      confidence: "high",
    };
  }

  private getThisMonth(): ParsedDateRange {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    return {
      start: startOfMonth,
      end: endOfMonth,
      description: "This month",
      confidence: "high",
    };
  }

  private getLastMonth(): ParsedDateRange {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      0,
      23,
      59,
      59,
      999
    );

    return {
      start: startOfLastMonth,
      end: endOfLastMonth,
      description: "Last month",
      confidence: "high",
    };
  }

  private getNextMonth(): ParsedDateRange {
    const now = new Date();
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endOfNextMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 2,
      0,
      23,
      59,
      59,
      999
    );

    return {
      start: startOfNextMonth,
      end: endOfNextMonth,
      description: "Next month",
      confidence: "high",
    };
  }

  private getLastXDays(days: number): ParsedDateRange {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return {
      start,
      end,
      description: `Last ${days} days`,
      confidence: "high",
    };
  }

  private getLastXWeeks(weeks: number): ParsedDateRange {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - weeks * 7);
    start.setHours(0, 0, 0, 0);

    return {
      start,
      end,
      description: `Last ${weeks} weeks`,
      confidence: "high",
    };
  }

  private getNextXDays(days: number): ParsedDateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + days);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      description: `Next ${days} days`,
      confidence: "high",
    };
  }

  private getNextXWeeks(weeks: number): ParsedDateRange {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() + weeks * 7);
    end.setHours(23, 59, 59, 999);

    return {
      start,
      end,
      description: `Next ${weeks} weeks`,
      confidence: "high",
    };
  }

  private getOverdue(): ParsedDateRange {
    const now = new Date();
    const farPast = new Date("2020-01-01");

    return {
      start: farPast,
      end: now,
      description: "Overdue (past due)",
      confidence: "high",
    };
  }
}

// Export singleton instance
export const temporalUtils = new TemporalUtilities();

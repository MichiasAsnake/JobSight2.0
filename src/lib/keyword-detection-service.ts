// Keyword Detection Service - Recognizes tag-like terms for text-filter API calls
// Handles natural language like "laser jobs", "etching orders", etc.

export interface KeywordMatch {
  keyword: string;
  confidence: number;
  context: string; // surrounding text
  suggestedFilter: string; // what to pass to text-filter
}

export interface KeywordDetectionResult {
  hasKeywords: boolean;
  matches: KeywordMatch[];
  remainingQuery: string; // query with keywords removed for other processing
  suggestedStrategy: "api" | "vector" | "hybrid";
}

export class KeywordDetectionService {
  // 🏷️ Common tag/process keywords that users search for
  private readonly tagKeywords = {
    // Production processes
    laser: {
      variations: ["laser", "laser cutting", "laser engraving"],
      filter: "laser",
    },
    etching: { variations: ["etching", "etch", "etched"], filter: "etching" },
    embroidery: {
      variations: ["embroidery", "emb", "embroidered", "stitching"],
      filter: "embroidery",
    },
    "screen print": {
      variations: ["screen print", "screen printing", "screenprint"],
      filter: "screen print",
    },
    "digital print": {
      variations: ["digital print", "digital printing"],
      filter: "digital print",
    },
    hardware: { variations: ["hardware", "hw"], filter: "hardware" },

    // Status/workflow tags
    gamma: { variations: ["gamma"], filter: "gamma" },
    "ps done": { variations: ["ps done", "proofing done"], filter: "ps done" },
    rush: { variations: ["rush", "urgent", "priority"], filter: "rush" },
    sample: { variations: ["sample", "samples"], filter: "sample" },
    supacolor: { variations: ["supacolor", "supa color"], filter: "supacolor" },

    // Materials/products
    jacket: { variations: ["jacket", "jackets"], filter: "jacket" },
    tshirt: {
      variations: ["tshirt", "t-shirt", "tee", "tees"],
      filter: "tshirt",
    },
    bag: { variations: ["bag", "bags", "tote", "backpack"], filter: "bag" },
    hat: { variations: ["hat", "hats", "cap", "caps"], filter: "hat" },

    // Special markers
    "no stock": {
      variations: ["no stock", "waiting stock", "out of stock"],
      filter: "no stock",
    },
    overdue: { variations: ["overdue", "late", "behind"], filter: "overdue" },
  };

  // 🎯 Main detection method
  detectKeywords(query: string): KeywordDetectionResult {
    console.log(`🔍 Detecting keywords in: "${query}"`);

    const matches: KeywordMatch[] = [];
    let remainingQuery = query.toLowerCase();

    // Check each keyword category
    for (const [keyword, config] of Object.entries(this.tagKeywords)) {
      for (const variation of config.variations) {
        const regex = new RegExp(`\\b${this.escapeRegex(variation)}\\b`, "gi");
        const match = query.match(regex);

        if (match) {
          const confidence = this.calculateConfidence(variation, query);
          const context = this.extractContext(variation, query);

          matches.push({
            keyword,
            confidence,
            context,
            suggestedFilter: config.filter,
          });

          // Remove from remaining query
          remainingQuery = remainingQuery.replace(regex, " ").trim();
          console.log(
            `✅ Found keyword: ${keyword} (${variation}) - confidence: ${confidence}`
          );
        }
      }
    }

    // Clean up remaining query
    remainingQuery = remainingQuery.replace(/\s+/g, " ").trim();

    // Determine strategy
    const suggestedStrategy = this.determineBestStrategy(
      matches,
      remainingQuery
    );

    const result: KeywordDetectionResult = {
      hasKeywords: matches.length > 0,
      matches: this.rankMatches(matches),
      remainingQuery: remainingQuery || query, // fallback to original
      suggestedStrategy,
    };

    if (matches.length > 0) {
      console.log(
        `🎯 Detected ${matches.length} keywords, strategy: ${suggestedStrategy}`
      );
    }

    return result;
  }

  // 🏆 Get the best text-filter value for API call
  getBestTextFilter(matches: KeywordMatch[]): string {
    if (matches.length === 0) return "";

    // Use the highest confidence match
    const bestMatch = matches.reduce((best, current) =>
      current.confidence > best.confidence ? current : best
    );

    return bestMatch.suggestedFilter;
  }

  // 📊 Calculate confidence based on context
  private calculateConfidence(variation: string, query: string): number {
    let confidence = 0.7; // base confidence

    const queryLower = query.toLowerCase();

    // Boost confidence for exact matches
    if (queryLower.includes(variation.toLowerCase())) {
      confidence += 0.2;
    }

    // Boost for job/order context
    if (/\b(job|order|work|request)\b/.test(queryLower)) {
      confidence += 0.1;
    }

    // Boost for action words
    if (/\b(show|find|get|list|search)\b/.test(queryLower)) {
      confidence += 0.05;
    }

    // Penalty for ambiguous context
    if (queryLower.includes("not") || queryLower.includes("without")) {
      confidence -= 0.3;
    }

    return Math.min(confidence, 0.95);
  }

  // 📝 Extract surrounding context
  private extractContext(variation: string, query: string): string {
    const regex = new RegExp(
      `(.{0,20})\\b${this.escapeRegex(variation)}\\b(.{0,20})`,
      "i"
    );
    const match = query.match(regex);
    return match ? match[0].trim() : variation;
  }

  // 🎯 Determine the best strategy based on detected keywords
  private determineBestStrategy(
    matches: KeywordMatch[],
    remainingQuery: string
  ): "api" | "vector" | "hybrid" {
    if (matches.length === 0) {
      return "vector"; // No keywords, use semantic search
    }

    // High confidence keywords should use API with text-filter
    const highConfidenceMatches = matches.filter((m) => m.confidence >= 0.8);
    if (highConfidenceMatches.length > 0) {
      return "api";
    }

    // If there's substantial remaining query, use hybrid
    if (remainingQuery.length > 10) {
      return "hybrid";
    }

    // Default to API for keyword-based searches
    return "api";
  }

  // 🏆 Rank matches by confidence and relevance
  private rankMatches(matches: KeywordMatch[]): KeywordMatch[] {
    return matches.sort((a, b) => {
      // Primary sort: confidence
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }

      // Secondary sort: keyword specificity (longer = more specific)
      return b.keyword.length - a.keyword.length;
    });
  }

  // 🔧 Helper: escape regex special characters
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 📚 Get all available keywords (for debugging/admin)
  getAllKeywords(): string[] {
    return Object.keys(this.tagKeywords);
  }

  // 🔍 Check if a query is likely keyword-based
  isKeywordQuery(query: string): boolean {
    const result = this.detectKeywords(query);
    return (
      result.hasKeywords && result.matches.some((m) => m.confidence >= 0.7)
    );
  }
}

export const keywordDetectionService = new KeywordDetectionService();

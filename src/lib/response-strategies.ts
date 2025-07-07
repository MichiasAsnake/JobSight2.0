// Response Strategies - Reduce OpenAI dependency with smart response generation
// Uses templates for common patterns and caches frequent responses

export interface ResponseStrategy {
  useTemplate: boolean;
  template?: string;
  requiresLLM: boolean;
  cacheKey?: string;
  confidence: number;
}

export interface CachedResponse {
  response: string;
  timestamp: number;
  queryHash: string;
  hitCount: number;
}

export class ResponseStrategiesService {
  private responseCache = new Map<string, CachedResponse>();
  private templateResponses = new Map<string, string>();
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1 hour

  constructor() {
    this.initializeTemplates();
  }

  // 🎯 Determine response strategy for query
  analyzeResponseStrategy(query: string, results: any[]): ResponseStrategy {
    const queryLower = query.toLowerCase();

    // No results - use template
    if (!results || results.length === 0) {
      return {
        useTemplate: true,
        template: "no_results",
        requiresLLM: false,
        cacheKey: this.generateCacheKey("no_results", query),
        confidence: 0.95,
      };
    }

    // Simple list queries - use template
    if (this.isSimpleListQuery(queryLower)) {
      return {
        useTemplate: true,
        template: "simple_list",
        requiresLLM: false,
        cacheKey: this.generateCacheKey("simple_list", query),
        confidence: 0.85,
      };
    }

    // Status queries - use template
    if (this.isStatusQuery(queryLower)) {
      return {
        useTemplate: true,
        template: "status_summary",
        requiresLLM: false,
        cacheKey: this.generateCacheKey("status_summary", query),
        confidence: 0.8,
      };
    }

    // Complex analysis - requires LLM
    if (this.isComplexAnalysisQuery(queryLower)) {
      return {
        useTemplate: false,
        requiresLLM: true,
        cacheKey: this.generateCacheKey("complex_analysis", query),
        confidence: 0.7,
      };
    }

    // Default to LLM for unknown patterns
    return {
      useTemplate: false,
      requiresLLM: true,
      cacheKey: this.generateCacheKey("general", query),
      confidence: 0.6,
    };
  }

  // 🎨 Generate templated response
  generateTemplateResponse(template: string, data: any): string {
    const templateStr = this.templateResponses.get(template);
    if (!templateStr) {
      throw new Error(`Template "${template}" not found`);
    }

    return this.interpolateTemplate(templateStr, data);
  }

  // 💾 Cache management
  getCachedResponse(cacheKey: string): string | null {
    const cached = this.responseCache.get(cacheKey);
    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.responseCache.delete(cacheKey);
      return null;
    }

    // Update hit count
    cached.hitCount++;
    return cached.response;
  }

  setCachedResponse(
    cacheKey: string,
    response: string,
    queryHash: string
  ): void {
    this.responseCache.set(cacheKey, {
      response,
      timestamp: Date.now(),
      queryHash,
      hitCount: 1,
    });

    // Clean up old entries
    this.cleanupCache();
  }

  // 🔧 Helper methods
  private isSimpleListQuery(query: string): boolean {
    return /^(show|list|get|find).*orders?$/i.test(query.trim());
  }

  private isStatusQuery(query: string): boolean {
    return /status|approved|pending|completed|shipped/i.test(query);
  }

  private isComplexAnalysisQuery(query: string): boolean {
    return /why|how|analyze|compare|trend|breakdown|detailed/i.test(query);
  }

  private generateCacheKey(type: string, query: string): string {
    const hash = this.simpleHash(query.toLowerCase().trim());
    return `${type}_${hash}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  private interpolateTemplate(template: string, data: any): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }

  private cleanupCache(): void {
    if (this.responseCache.size > 1000) {
      // Max 1000 entries
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest 200 entries
      for (let i = 0; i < 200; i++) {
        this.responseCache.delete(entries[i][0]);
      }
    }
  }

  // 📝 Initialize response templates
  private initializeTemplates(): void {
    this.templateResponses.set(
      "no_results",
      `
I couldn't find any orders matching "{{query}}". This could mean:
- No orders exist with those criteria
- The search terms might need adjustment
- The data might be in a different format

Try searching with different keywords or check if there are any typos.
    `.trim()
    );

    this.templateResponses.set(
      "simple_list",
      `
Found {{count}} orders:

{{#orders}}
• Job #{{jobNumber}} - {{description}} ({{status}})
  Customer: {{customerCompany}}
  Total: ${{ totalDue }}
{{/orders}}
    `.trim()
    );

    this.templateResponses.set(
      "status_summary",
      `
Status Summary for {{count}} orders:

{{#statusBreakdown}}
• {{status}}: {{count}} orders
{{/statusBreakdown}}

Total value: ${{ totalValue }}
    `.trim()
    );

    this.templateResponses.set(
      "error",
      `
I encountered an issue processing your request: "{{query}}"

Please try rephrasing your question or contact support if the problem persists.
    `.trim()
    );
  }

  // 📊 Get cache statistics
  getCacheStats(): { size: number; hitRate: number; oldestEntry: number } {
    let totalHits = 0;
    let oldestTimestamp = Date.now();

    for (const cached of this.responseCache.values()) {
      totalHits += cached.hitCount;
      if (cached.timestamp < oldestTimestamp) {
        oldestTimestamp = cached.timestamp;
      }
    }

    return {
      size: this.responseCache.size,
      hitRate:
        this.responseCache.size > 0 ? totalHits / this.responseCache.size : 0,
      oldestEntry: Date.now() - oldestTimestamp,
    };
  }
}

export const responseStrategiesService = new ResponseStrategiesService();

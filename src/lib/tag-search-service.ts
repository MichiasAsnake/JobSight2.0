// Tag Search Service - Optimized for exact tag matching
// Handles queries like @laser, @gamma, etc. with literal text filtering

export interface TagSearchOptions {
  tag: string;
  exactMatch?: boolean;
  includeMetadata?: boolean;
  limit?: number;
}

export interface TaggedOrder {
  jobNumber: string;
  orderNumber: string;
  description: string;
  tags: string[];
  customerCompany: string;
  status: string;
  dateEntered: string;
  totalDue: number;
}

export class TagSearchService {
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> job numbers
  private orderIndex: Map<string, TaggedOrder> = new Map(); // job number -> order
  private lastIndexUpdate = 0;
  private readonly INDEX_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.buildTagIndex();
  }

  // 🎯 Main tag search method
  async searchByTag(options: TagSearchOptions): Promise<TaggedOrder[]> {
    console.log(`🏷️ Searching for tag: ${options.tag}`);

    // Refresh index if needed
    if (Date.now() - this.lastIndexUpdate > this.INDEX_TTL) {
      await this.buildTagIndex();
    }

    const normalizedTag = this.normalizeTag(options.tag);
    const matchingJobNumbers = this.tagIndex.get(normalizedTag) || new Set();

    const results: TaggedOrder[] = [];
    for (const jobNumber of matchingJobNumbers) {
      const order = this.orderIndex.get(jobNumber);
      if (order) {
        results.push(order);
      }
    }

    // Sort by date (newest first) and limit
    const sortedResults = results
      .sort(
        (a, b) =>
          new Date(b.dateEntered).getTime() - new Date(a.dateEntered).getTime()
      )
      .slice(0, options.limit || 50);

    console.log(
      `🏷️ Found ${sortedResults.length} orders with tag: ${options.tag}`
    );
    return sortedResults;
  }

  // 🔧 Build tag index from orders
  private async buildTagIndex(): Promise<void> {
    try {
      console.log("🏷️ Building tag index...");

      // Clear existing indexes
      this.tagIndex.clear();
      this.orderIndex.clear();

      // Load orders from data source
      const ordersData = await this.loadOrdersData();

      for (const order of ordersData) {
        // Extract tags from description and other fields
        const tags = this.extractTagsFromOrder(order);

        // Build tagged order object
        const taggedOrder: TaggedOrder = {
          jobNumber: order.jobNumber,
          orderNumber: order.orderNumber,
          description: order.description || "",
          tags,
          customerCompany: order.customerCompany || "",
          status: order.status || "",
          dateEntered: order.dateEntered || "",
          totalDue: order.totalDue || 0,
        };

        // Index the order
        this.orderIndex.set(order.jobNumber, taggedOrder);

        // Index each tag
        for (const tag of tags) {
          const normalizedTag = this.normalizeTag(tag);
          if (!this.tagIndex.has(normalizedTag)) {
            this.tagIndex.set(normalizedTag, new Set());
          }
          this.tagIndex.get(normalizedTag)!.add(order.jobNumber);
        }
      }

      this.lastIndexUpdate = Date.now();
      console.log(
        `🏷️ Tag index built: ${this.tagIndex.size} unique tags, ${this.orderIndex.size} orders`
      );
    } catch (error) {
      console.error("❌ Failed to build tag index:", error);
    }
  }

  // 🏷️ Extract tags from order description and fields
  private extractTagsFromOrder(order: any): string[] {
    const tags: string[] = [];
    const description = order.description || "";

    // Extract @tags (e.g., @laser, @gamma)
    const atTags = description.match(/@\w+/g) || [];
    tags.push(...atTags);

    // Extract common tag patterns
    const tagPatterns = [
      /\b(ps done|gamma|laser|supacolor|rush|urgent|sample)\b/gi,
      /\b(hardware|embroidery|screen print|digital print)\b/gi,
      /\b(no stock|waiting stock|pending)\b/gi,
    ];

    for (const pattern of tagPatterns) {
      const matches = description.match(pattern) || [];
      tags.push(
        ...matches.map((m: string) => `@${m.toLowerCase().replace(/\s+/g, "")}`)
      );
    }

    // Deduplicate and normalize
    return [...new Set(tags.map((tag) => this.normalizeTag(tag)))];
  }

  // 🔧 Normalize tag format
  private normalizeTag(tag: string): string {
    return tag
      .toLowerCase()
      .replace(/^@/, "") // Remove @ prefix
      .replace(/\s+/g, "") // Remove spaces
      .trim();
  }

  // 📊 Load orders data (replace with your actual data source)
  private async loadOrdersData(): Promise<any[]> {
    try {
      // This would connect to your actual data source
      // For now, assuming you have a data service
      const fs = require("fs").promises;
      const data = await fs.readFile("./data/orders.json", "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("❌ Failed to load orders data:", error);
      return [];
    }
  }

  // 🔍 Get all available tags
  async getAllTags(): Promise<string[]> {
    if (Date.now() - this.lastIndexUpdate > this.INDEX_TTL) {
      await this.buildTagIndex();
    }
    return Array.from(this.tagIndex.keys()).sort();
  }

  // 📊 Get tag statistics
  async getTagStats(): Promise<Record<string, number>> {
    if (Date.now() - this.lastIndexUpdate > this.INDEX_TTL) {
      await this.buildTagIndex();
    }

    const stats: Record<string, number> = {};
    for (const [tag, jobNumbers] of this.tagIndex.entries()) {
      stats[tag] = jobNumbers.size;
    }
    return stats;
  }
}

export const tagSearchService = new TagSearchService();

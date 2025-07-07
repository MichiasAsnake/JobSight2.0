// Enhanced Query Service
// Integrates real-time job population with vector search

import { PineconePopulationStrategy } from "./pinecone-population-strategy";
import { RealtimeJobPopulator } from "./realtime-job-populator";
import { embeddingService } from "./embeddings";

export interface EnhancedSearchOptions {
  query: string;
  topK?: number;
  filters?: Record<string, any>;
  enableRealtimePopulation?: boolean;
  maxRealtimeJobs?: number; // Maximum jobs to add in real-time
}

export interface EnhancedSearchResult {
  results: any[];
  stats: {
    totalResults: number;
    realtimeJobsAdded: number;
    cacheHits: number;
    processingTime: number;
  };
  realtimeJobs: {
    added: string[];
    failed: string[];
    errors: string[];
  };
}

export class EnhancedQueryService {
  private populationStrategy: PineconePopulationStrategy;
  private realtimePopulator: RealtimeJobPopulator;
  private initialized = false;

  constructor() {
    this.populationStrategy = new PineconePopulationStrategy();
    this.realtimePopulator = new RealtimeJobPopulator();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.populationStrategy.initialize();
    await this.realtimePopulator.initialize();

    this.initialized = true;
    console.log("✅ Enhanced Query Service initialized");
  }

  /**
   * Enhanced search that can add missing jobs in real-time
   */
  async search(options: EnhancedSearchOptions): Promise<EnhancedSearchResult> {
    const startTime = Date.now();

    if (!this.initialized) {
      await this.initialize();
    }

    const {
      query,
      topK = 10,
      filters = {},
      enableRealtimePopulation = true,
      maxRealtimeJobs = 5,
    } = options;

    const result: EnhancedSearchResult = {
      results: [],
      stats: {
        totalResults: 0,
        realtimeJobsAdded: 0,
        cacheHits: 0,
        processingTime: 0,
      },
      realtimeJobs: {
        added: [],
        failed: [],
        errors: [],
      },
    };

    try {
      // 1. Perform initial search
      const queryEmbedding = await embeddingService.createEmbedding(query);
      const searchResults = await this.populationStrategy.searchSimilarOrders(
        queryEmbedding,
        topK,
        filters
      );

      result.results = searchResults;
      result.stats.totalResults = searchResults.length;

      // 2. Extract job numbers from search results
      const foundJobNumbers = searchResults
        .map((result) => result.metadata.jobNumber?.toString())
        .filter(Boolean);

      // 3. If real-time population is enabled, check for missing jobs
      if (enableRealtimePopulation) {
        const missingJobs = await this.findMissingJobs(
          query,
          foundJobNumbers,
          maxRealtimeJobs
        );

        if (missingJobs.length > 0) {
          console.log(
            `🔍 Found ${missingJobs.length} potentially missing jobs, checking...`
          );

          // Try to add missing jobs
          for (const jobNumber of missingJobs) {
            try {
              const lookupResult = await this.realtimePopulator.lookupJob(
                jobNumber
              );

              if (lookupResult.found) {
                result.realtimeJobs.added.push(jobNumber);
                result.stats.realtimeJobsAdded++;
                console.log(`✅ Added job ${jobNumber} to vector database`);
              } else {
                result.realtimeJobs.failed.push(jobNumber);
                if (lookupResult.error) {
                  result.realtimeJobs.errors.push(
                    `${jobNumber}: ${lookupResult.error}`
                  );
                }
              }
            } catch (error) {
              result.realtimeJobs.failed.push(jobNumber);
              result.realtimeJobs.errors.push(
                `${jobNumber}: ${
                  error instanceof Error ? error.message : String(error)
                }`
              );
            }
          }

          // 4. If we added new jobs, perform another search
          if (result.realtimeJobs.added.length > 0) {
            console.log(
              `🔄 Re-searching after adding ${result.realtimeJobs.added.length} jobs...`
            );
            const updatedSearchResults =
              await this.populationStrategy.searchSimilarOrders(
                queryEmbedding,
                topK,
                filters
              );

            result.results = updatedSearchResults;
            result.stats.totalResults = updatedSearchResults.length;
          }
        }
      }

      result.stats.processingTime = Date.now() - startTime;
      return result;
    } catch (error) {
      console.error("❌ Enhanced search failed:", error);
      result.realtimeJobs.errors.push(
        `Search error: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      result.stats.processingTime = Date.now() - startTime;
      return result;
    }
  }

  /**
   * Find potentially missing jobs by analyzing the query
   */
  private async findMissingJobs(
    query: string,
    foundJobNumbers: string[],
    maxJobs: number
  ): Promise<string[]> {
    // Extract potential job numbers from the query
    const jobNumberMatches = query.match(/\b\d{4,6}\b/g); // Match 4-6 digit numbers

    if (!jobNumberMatches) {
      return [];
    }

    // Filter out job numbers we already found
    const missingJobs = jobNumberMatches.filter(
      (jobNumber) => !foundJobNumbers.includes(jobNumber)
    );

    // Limit to max jobs to avoid overwhelming the system
    return missingJobs.slice(0, maxJobs);
  }

  /**
   * Direct job lookup with real-time population
   */
  async lookupJob(jobNumber: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const result = await this.realtimePopulator.lookupJob(jobNumber);
    return result;
  }

  /**
   * Batch job lookup
   */
  async lookupJobs(jobNumbers: string[]): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results = await this.realtimePopulator.lookupJobs(jobNumbers);
    return results;
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<any> {
    const populationStats = await this.populationStrategy.getStats();
    const cacheStats = this.realtimePopulator.getCacheStats();

    return {
      population: populationStats,
      cache: cacheStats,
      initialized: this.initialized,
    };
  }

  /**
   * Clear caches
   */
  clearCaches(): void {
    this.realtimePopulator.clearCache();
  }
}

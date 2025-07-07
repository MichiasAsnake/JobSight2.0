// Real-time Job Population Service
// Adds individual jobs to vector database when queried but not found

import { PineconePopulationStrategy } from "./pinecone-population-strategy";
import { EnhancedOMSAPIClient } from "./enhanced-api-client";
import { embeddingService } from "./embeddings";

export interface JobNotFoundResult {
  jobNumber: string;
  found: false;
  reason: "not_in_vector_db" | "not_in_api" | "api_error";
  addedToVectorDB?: boolean;
  error?: string;
}

export interface JobFoundResult {
  jobNumber: string;
  found: true;
  vectorId: string;
  metadata: any;
}

export type JobLookupResult = JobFoundResult | JobNotFoundResult;

export class RealtimeJobPopulator {
  private populationStrategy: PineconePopulationStrategy;
  private apiClient: EnhancedOMSAPIClient;
  private cache = new Map<
    string,
    { result: JobLookupResult; timestamp: number }
  >();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.populationStrategy = new PineconePopulationStrategy();
    this.apiClient = new EnhancedOMSAPIClient();
  }

  async initialize(): Promise<void> {
    await this.populationStrategy.initialize();
    await this.apiClient.healthCheck();
  }

  /**
   * Look up a job in the vector database, and if not found, try to add it from the API
   */
  async lookupJob(jobNumber: string): Promise<JobLookupResult> {
    // Check cache first
    const cached = this.cache.get(jobNumber);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.result;
    }

    try {
      // 1. First, try to find the job in the vector database
      const vectorResult = await this.findJobInVectorDB(jobNumber);
      if (vectorResult.found) {
        const result: JobFoundResult = {
          jobNumber,
          found: true,
          vectorId: vectorResult.vectorId,
          metadata: vectorResult.metadata,
        };
        this.cache.set(jobNumber, { result, timestamp: Date.now() });
        return result;
      }

      // 2. Job not in vector DB, try to fetch from API
      console.log(
        `🔍 Job ${jobNumber} not found in vector DB, checking API...`
      );
      const apiJob = await this.fetchJobFromAPI(jobNumber);

      if (!apiJob) {
        const result: JobNotFoundResult = {
          jobNumber,
          found: false,
          reason: "not_in_api",
        };
        this.cache.set(jobNumber, { result, timestamp: Date.now() });
        return result;
      }

      // 3. Job exists in API, add it to vector DB
      console.log(`📤 Adding job ${jobNumber} to vector database...`);
      const added = await this.addJobToVectorDB(apiJob);

      if (added) {
        // 4. Now fetch the newly added vector
        const newVectorResult = await this.findJobInVectorDB(jobNumber);
        if (newVectorResult.found) {
          const result: JobFoundResult = {
            jobNumber,
            found: true,
            vectorId: newVectorResult.vectorId,
            metadata: newVectorResult.metadata,
          };
          this.cache.set(jobNumber, { result, timestamp: Date.now() });
          return result;
        }
      }

      const result: JobNotFoundResult = {
        jobNumber,
        found: false,
        reason: "api_error",
        addedToVectorDB: added,
        error: "Failed to add job to vector database",
      };
      this.cache.set(jobNumber, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.error(`❌ Error looking up job ${jobNumber}:`, error);
      const result: JobNotFoundResult = {
        jobNumber,
        found: false,
        reason: "api_error",
        error: error instanceof Error ? error.message : String(error),
      };
      this.cache.set(jobNumber, { result, timestamp: Date.now() });
      return result;
    }
  }

  /**
   * Search for a job in the vector database
   */
  private async findJobInVectorDB(
    jobNumber: string
  ): Promise<{ found: boolean; vectorId?: string; metadata?: any }> {
    try {
      // Create a query to search for the specific job
      const query = `Job ${jobNumber}`;
      const queryEmbedding = await embeddingService.createEmbedding(query);

      const searchResults = await this.populationStrategy.searchSimilarOrders(
        queryEmbedding,
        5,
        { jobNumber: parseInt(jobNumber) }
      );

      // Look for exact job number match
      const exactMatch = searchResults.find(
        (result) => result.metadata.jobNumber === parseInt(jobNumber)
      );

      if (exactMatch) {
        return {
          found: true,
          vectorId: exactMatch.id,
          metadata: exactMatch.metadata,
        };
      }

      return { found: false };
    } catch (error) {
      console.error(
        `❌ Error searching vector DB for job ${jobNumber}:`,
        error
      );
      return { found: false };
    }
  }

  /**
   * Fetch a job from the OMS API
   */
  private async fetchJobFromAPI(jobNumber: string): Promise<any> {
    try {
      // Get job details from API
      const jobDetails = await this.apiClient.getJobDetails(jobNumber);

      if (!jobDetails.job) {
        return null;
      }

      return jobDetails;
    } catch (error) {
      console.error(`❌ Error fetching job ${jobNumber} from API:`, error);
      return null;
    }
  }

  /**
   * Add a job to the vector database
   */
  private async addJobToVectorDB(jobDetails: any): Promise<boolean> {
    try {
      // Use the existing population strategy to create vectors
      const vectors = await this.populationStrategy.createJobVectors(
        jobDetails.job
      );

      if (vectors.length === 0) {
        console.error(
          `❌ No vectors created for job ${jobDetails.job.JobNumber}`
        );
        return false;
      }

      // Upsert the vectors
      await this.populationStrategy.upsertVectors(vectors);

      console.log(
        `✅ Successfully added job ${jobDetails.job.JobNumber} to vector database`
      );
      return true;
    } catch (error) {
      console.error(`❌ Error adding job to vector database:`, error);
      return false;
    }
  }

  /**
   * Batch lookup multiple jobs
   */
  async lookupJobs(jobNumbers: string[]): Promise<JobLookupResult[]> {
    const results: JobLookupResult[] = [];

    for (const jobNumber of jobNumbers) {
      const result = await this.lookupJob(jobNumber);
      results.push(result);

      // Small delay between lookups to avoid overwhelming the system
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }
}

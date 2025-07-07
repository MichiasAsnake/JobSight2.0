// Real-time Population Example
// Demonstrates how to use the enhanced query service with real-time job population

import { EnhancedQueryService } from "../src/lib/enhanced-query-service";

async function demonstrateRealtimePopulation() {
  console.log("🚀 Real-time Population Example\n");

  const queryService = new EnhancedQueryService();
  await queryService.initialize();

  // Example 1: Search that might find missing jobs
  console.log("📋 Example 1: Search with real-time population enabled");
  console.log("Query: 'Show me job 51094 and any embroidery work'");

  const searchResult = await queryService.search({
    query: "Show me job 51094 and any embroidery work",
    topK: 10,
    enableRealtimePopulation: true,
    maxRealtimeJobs: 3,
  });

  console.log(`\n📊 Search Results:`);
  console.log(`- Total results: ${searchResult.stats.totalResults}`);
  console.log(`- Processing time: ${searchResult.stats.processingTime}ms`);
  console.log(
    `- Jobs added in real-time: ${searchResult.stats.realtimeJobsAdded}`
  );

  if (searchResult.realtimeJobs.added.length > 0) {
    console.log(`- Added jobs: ${searchResult.realtimeJobs.added.join(", ")}`);
  }

  if (searchResult.realtimeJobs.failed.length > 0) {
    console.log(
      `- Failed jobs: ${searchResult.realtimeJobs.failed.join(", ")}`
    );
  }

  // Example 2: Direct job lookup
  console.log("\n📋 Example 2: Direct job lookup");
  console.log("Looking up job 51094...");

  const lookupResult = await queryService.lookupJob("51094");

  if (lookupResult.found) {
    console.log(`✅ Job 51094 found in vector database`);
    console.log(`- Vector ID: ${lookupResult.vectorId}`);
    console.log(`- Status: ${lookupResult.metadata.status}`);
    console.log(`- Customer: ${lookupResult.metadata.customerCompany}`);
  } else {
    console.log(`❌ Job 51094 not found`);
    console.log(`- Reason: ${lookupResult.reason}`);
    if (lookupResult.error) {
      console.log(`- Error: ${lookupResult.error}`);
    }
  }

  // Example 3: Batch lookup
  console.log("\n📋 Example 3: Batch job lookup");
  console.log("Looking up jobs: 51094, 50948, 99999...");

  const batchResults = await queryService.lookupJobs([
    "51094",
    "50948",
    "99999",
  ]);

  for (const result of batchResults) {
    if (result.found) {
      console.log(`✅ Job ${result.jobNumber}: Found`);
    } else {
      console.log(`❌ Job ${result.jobNumber}: ${result.reason}`);
    }
  }

  // Example 4: Search with real-time population disabled
  console.log("\n📋 Example 4: Search without real-time population");
  console.log("Query: 'embroidery jobs for Jackalope'");

  const searchResult2 = await queryService.search({
    query: "embroidery jobs for Jackalope",
    topK: 5,
    enableRealtimePopulation: false, // Disable real-time population
  });

  console.log(`\n📊 Search Results:`);
  console.log(`- Total results: ${searchResult2.stats.totalResults}`);
  console.log(`- Processing time: ${searchResult2.stats.processingTime}ms`);
  console.log(
    `- Jobs added in real-time: ${searchResult2.stats.realtimeJobsAdded}`
  );

  // Example 5: Get service statistics
  console.log("\n📋 Example 5: Service statistics");
  const stats = await queryService.getStats();
  console.log("Service Stats:", JSON.stringify(stats, null, 2));

  console.log("\n🎉 Real-time population example completed!");
}

// Integration with your existing query router
async function integrateWithQueryRouter() {
  console.log("🔗 Integration with Query Router Example\n");

  const queryService = new EnhancedQueryService();
  await queryService.initialize();

  // Simulate a user query that might reference a new job
  const userQuery =
    "What's the status of job 51094 and do we have any embroidery work for Jackalope?";

  console.log(`User Query: "${userQuery}"`);
  console.log("Processing with real-time population...\n");

  const result = await queryService.search({
    query: userQuery,
    topK: 10,
    enableRealtimePopulation: true,
    maxRealtimeJobs: 5,
    filters: {
      customerCompany: "Jackalope",
    },
  });

  // Format response for user
  console.log("📋 Search Results for User:");

  if (result.results.length > 0) {
    console.log(`Found ${result.results.length} relevant results:`);

    result.results.slice(0, 3).forEach((result, index) => {
      console.log(`\n${index + 1}. Job ${result.metadata.jobNumber}`);
      console.log(`   - Status: ${result.metadata.status}`);
      console.log(`   - Customer: ${result.metadata.customerCompany}`);
      console.log(
        `   - Description: ${result.metadata.description?.substring(0, 100)}...`
      );
      console.log(`   - Score: ${result.score.toFixed(3)}`);
    });
  } else {
    console.log("No results found.");
  }

  // Report on real-time additions
  if (result.stats.realtimeJobsAdded > 0) {
    console.log(
      `\n🆕 Added ${result.stats.realtimeJobsAdded} new jobs to the database in real-time:`
    );
    result.realtimeJobs.added.forEach((jobNumber) => {
      console.log(`   - Job ${jobNumber}`);
    });
  }

  if (result.realtimeJobs.failed.length > 0) {
    console.log(
      `\n⚠️  Failed to add ${result.realtimeJobs.failed.length} jobs:`
    );
    result.realtimeJobs.failed.forEach((jobNumber) => {
      console.log(`   - Job ${jobNumber}`);
    });
  }

  console.log(`\n⏱️  Total processing time: ${result.stats.processingTime}ms`);
}

// Run examples
async function main() {
  try {
    await demonstrateRealtimePopulation();
    console.log("\n" + "=".repeat(50) + "\n");
    await integrateWithQueryRouter();
  } catch (error) {
    console.error("❌ Example failed:", error);
  }
}

// Export for use in other files
export { demonstrateRealtimePopulation, integrateWithQueryRouter };

// Run if called directly
if (require.main === module) {
  main();
}

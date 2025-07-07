# Vector Database Population Guide

## Overview

Your vector database stores semantic representations of orders to enable intelligent search and retrieval. This guide explains how to populate and maintain your vector database effectively.

## What Information Goes Into Vectors

### Search Text (What Gets Embedded)

Include **ALL searchable information** that users might query for:

```typescript
// Example of comprehensive search text generation
function orderToSearchText(order: any): string {
  return [
    // Core identifiers
    `Job ${order.jobNumber}`,
    `Order ${order.orderNumber}`,

    // Customer context
    `Customer ${order.customer?.company}`,

    // Main content
    order.description,
    order.comments,

    // Line items (critical for material/process searches)
    ...order.lineItems.map(
      (item) => `${item.description} ${item.category} ${item.comment}`
    ),

    // Production processes
    ...order.production?.processes?.map((p) => p.code),

    // Priority indicators
    order.production?.timeSensitive ? "rush urgent priority" : "",

    // Shipping information
    ...order.shipments?.map(
      (ship) =>
        `${ship.address?.organisation} ${ship.address?.city} ${ship.address?.state}`
    ),

    // Tags and metadata
    ...order.tags?.map((tag) => tag.tag),

    // Workflow indicators
    order.workflow?.hasJobFiles ? "has files" : "",
    order.workflow?.hasProof ? "has proof" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
```

### Metadata (What Gets Stored for Filtering)

Store **filterable fields** separately from search text:

```typescript
interface VectorMetadata {
  jobNumber: string;
  customerCompany: string;
  customerId?: number;
  status: string;
  priority?: string;
  totalDue?: number;
  dateEntered: string;
  description: string;
  orderNumber: string;
  dataSource: "api" | "scraped" | "hybrid";
  lastUpdated: string;
  // Add more filterable fields as needed
  hasFiles?: boolean;
  hasProof?: boolean;
  isRush?: boolean;
}
```

## Population Strategies

### 1. Initial Population (One-time setup)

**Use the new script:**

```bash
npm run tsx scripts/initial-vector-population.ts
```

This script:

- Fetches all orders from your API
- Uses `VectorDBService.forceFullRebuild()` to process everything
- Provides detailed progress and results
- Performs health checks

### 2. Daily/Incremental Updates

**Use the updated script:**

```bash
npm run tsx scripts/daily-vector-update.ts
```

This script:

- Uses `VectorDBService.performIncrementalUpdate()`
- Only processes new/changed orders (efficient)
- Maintains change tracking
- Tests search functionality

### 3. Manual Updates via API

**Use the existing endpoint:**

```bash
curl -X POST http://localhost:3000/api/populate-vectors \
  -H "Content-Type: application/json" \
  -d '{"authorization": "populate-vectors-2024"}'
```

## Key Benefits of Using VectorDBService

### 1. **Incremental Updates**

- Only processes changed orders
- Maintains change tracking state
- Much faster than full rebuilds

### 2. **Consistent Vector Creation**

- Uses the same text generation logic everywhere
- Proper metadata handling
- Error handling and retries

### 3. **Change Tracking**

- Tracks which orders have been processed
- Detects changes using content hashing
- Handles deletions gracefully

### 4. **Batch Processing**

- Processes orders in optimal batch sizes
- Respects API rate limits
- Provides progress feedback

## Best Practices

### 1. **Comprehensive Search Text**

Include everything users might search for:

- Job/order numbers
- Customer information
- Descriptions and comments
- Line item details
- Production processes
- Shipping information
- Tags and metadata
- Priority indicators

### 2. **Rich Metadata**

Store filterable fields separately:

- Use metadata for filtering (status, customer, date ranges)
- Keep search text for semantic matching
- Include both for hybrid search capabilities

### 3. **Regular Updates**

- Run daily updates to keep vectors current
- Monitor change tracker stats
- Test search functionality after updates

### 4. **Error Handling**

- The service handles individual order failures gracefully
- Check error logs for problematic orders
- Retry failed operations as needed

## Monitoring and Maintenance

### Check Vector Database Health

```typescript
const health = await vectorDBService.healthCheck();
console.log(health);
```

### Get Change Tracker Stats

```typescript
const stats = vectorDBService.getChangeTrackerStats();
console.log(stats);
```

### View Index Statistics

```typescript
const indexStats = await vectorDBService.getIndexStats();
console.log(indexStats);
```

## Troubleshooting

### Common Issues

1. **No orders found**

   - Check API connection
   - Verify environment variables
   - Check API response format

2. **Embedding creation fails**

   - Verify OpenAI API key
   - Check API rate limits
   - Review text content for issues

3. **Pinecone errors**

   - Verify Pinecone API key
   - Check index name and region
   - Review vector format

4. **Performance issues**
   - Reduce batch sizes
   - Add delays between batches
   - Monitor API rate limits

### Reset Change Tracker

If you need to force a full rebuild:

```typescript
vectorDBService.resetChangeTracker();
```

## Example Usage

### Search for Similar Orders

```typescript
const query = "rush urgent priority orders";
const embedding = await embeddingService.createEmbedding(query);
const results = await vectorDBService.searchSimilarOrders(embedding, 5);

results.forEach((result) => {
  console.log(`Job ${result.metadata.jobNumber}: ${result.score}`);
});
```

### Filtered Search

```typescript
const results = await vectorDBService.searchSimilarOrders(embedding, 5, {
  status: "In Progress",
  customerCompany: "Acme Corp",
});
```

This approach ensures your vector database is comprehensive, efficient, and maintainable for your order management system.

# Pinecone Vector DB Population Strategy Guide

## Overview

This guide provides a comprehensive strategy for populating your Pinecone vector database with OMS order data while maintaining data freshness and optimal performance.

## Key Features

- **Data Freshness Management**: Automatic detection and handling of data updates
- **Incremental Updates**: Efficient updates of only changed data
- **Batch Processing**: Optimized batch sizes for performance and reliability
- **Change Tracking**: Comprehensive tracking of data changes
- **Error Handling**: Robust error handling and recovery
- **Performance Monitoring**: Real-time performance metrics

## Architecture

### Core Components

1. **PineconePopulationStrategy**: Main service for vector database operations
2. **EnhancedOMSAPIClient**: API client for fetching fresh data
3. **EmbeddingService**: OpenAI-based embedding generation
4. **Change Tracker**: Persistent tracking of data changes

### Data Flow

```
OMS API → EnhancedOMSAPIClient → PineconePopulationStrategy → Pinecone Vector DB
                ↓
        Change Tracker (JSON)
```

## Installation & Setup

### 1. Environment Variables

Create a `.env` file with the following variables:

```bash
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=oms-orders

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key

# OMS API Configuration
OMS_API_BASE_URL=https://intranet.decopress.com
OMS_AUTH_COOKIES=your_auth_cookies
```

### 2. Dependencies

Ensure you have the required dependencies:

```bash
npm install @pinecone-database/pinecone openai
```

### 3. Pinecone Index Setup

Your Pinecone index should be configured with:

- **Dimensions**: 1024 (for text-embedding-3-small)
- **Metric**: cosine
- **Pod Type**: Based on your data volume

## Usage

### Command Line Interface

The population strategy can be run using the provided script:

```bash
# Full population
npm run populate-pinecone full production

# Incremental update
npm run populate-pinecone incremental production

# Health check
npm run populate-pinecone health

# View stats
npm run populate-pinecone stats

# Reset change tracker
npm run populate-pinecone reset
```

### Configuration Presets

Available presets for different use cases:

#### Development

```typescript
{
  batchSize: 10,
  maxConcurrentBatches: 1,
  embeddingDelay: 200,
  upsertDelay: 1000,
  freshnessThreshold: 24,
  completenessThreshold: 50,
  enableIncrementalUpdates: true,
  enableDataValidation: true,
  enablePerformanceMonitoring: true,
}
```

#### Production

```typescript
{
  batchSize: 50,
  maxConcurrentBatches: 3,
  embeddingDelay: 100,
  upsertDelay: 500,
  freshnessThreshold: 24,
  completenessThreshold: 70,
  enableIncrementalUpdates: true,
  enableDataValidation: true,
  enablePerformanceMonitoring: true,
}
```

#### Fast

```typescript
{
  batchSize: 100,
  maxConcurrentBatches: 5,
  embeddingDelay: 50,
  upsertDelay: 200,
  freshnessThreshold: 48,
  completenessThreshold: 60,
  enableIncrementalUpdates: false,
  enableDataValidation: false,
  enablePerformanceMonitoring: false,
}
```

#### Conservative

```typescript
{
  batchSize: 25,
  maxConcurrentBatches: 1,
  embeddingDelay: 300,
  upsertDelay: 1000,
  freshnessThreshold: 12,
  completenessThreshold: 80,
  enableIncrementalUpdates: true,
  enableDataValidation: true,
  enablePerformanceMonitoring: true,
}
```

## Data Freshness Strategy

### 1. Freshness Classification

Data is classified into three freshness categories:

- **Fresh**: Updated within the freshness threshold (default: 24 hours)
- **Stale**: Updated within 7x the freshness threshold
- **Very Stale**: Updated more than 7x the freshness threshold

### 2. Incremental Update Process

1. **Change Detection**: Compare job timestamps with last sync
2. **Selective Processing**: Only process jobs with changes
3. **Vector Updates**: Update only affected vectors
4. **Change Tracking**: Update change tracker with new timestamps

### 3. Full Sync Process

1. **Data Fetching**: Retrieve all active jobs from API
2. **Batch Processing**: Process jobs in configurable batches
3. **Vector Creation**: Generate embeddings for all job data
4. **Bulk Upsert**: Upload vectors to Pinecone
5. **Change Tracking**: Update change tracker with all jobs

## Vector Document Structure

### Job Documents

```typescript
{
  id: "job_51094",
  content: "Job 51094: MICRON / INVENTOR APPAREL - SPLIT for Jackalope, Order 10979-4, 527 units, Approved status, Stock Complete, Due 2025-06-28",
  metadata: {
    type: "job",
    jobNumber: 51094,
    customerId: 798,
    orderNumber: "10979-4",
    status: "Approved",
    stockStatus: "Stock Complete",
    dueDate: "2025-06-28T05:00:00+00:00",
    dataSource: "api",
    dataFreshness: "fresh",
    lastUpdated: "2025-01-27T10:00:00Z",
    completenessScore: 85,
    customerCompany: "Jackalope",
    deliveryOption: "NDA",
    timeSensitive: false,
    mustDate: false,
    processes: ["EM", "HW", "Bagging"],
    hasLineItems: true,
    hasShipments: true,
    hasHistory: true
  },
  relationships: {
    customer: ["customer_798"],
    joblines: ["jobline_168166", "jobline_168167"],
    shipments: ["shipment_9876"],
    history: ["history_51094"]
  }
}
```

### JobLine Documents

```typescript
{
  id: "jobline_168167",
  content: "JobLine 168167: INVENTOR BLACK embroidery on DLX-1 Men's Bergen Sherpa Fleece Jacket - Zinc, 47 units at $6.50 each, LEFT CHEST location, BLACK color, 2.5\" width",
  metadata: {
    type: "jobline",
    jobNumber: 51094,
    customerId: 798,
    orderNumber: "10979-4",
    program: "EM12722",
    description: "INVENTOR BLACK",
    garment: "DLX-1 Men's Bergen Sherpa Fleece Jacket - Zinc",
    quantity: 47,
    unitPrice: 6.5,
    dataSource: "api",
    dataFreshness: "fresh",
    lastUpdated: "2025-01-27T10:00:00Z",
    completenessScore: 90,
    processes: ["E1", "E2", "E3"],
    materials: ["BLACK"],
    categories: ["Embroidery"]
  },
  relationships: {
    job: ["job_51094"],
    customer: ["customer_798"]
  }
}
```

### Shipment Documents

```typescript
{
  id: "shipment_9876",
  content: "Shipment 9876: SH-51094-001 for Job 51094, FedEx carrier, tracking 123456789012, Scheduled status, 47 DLX-1-ZINC jackets",
  metadata: {
    type: "shipment",
    jobNumber: 51094,
    customerId: 798,
    orderNumber: "10979-4",
    shipmentNumber: "SH-51094-001",
    carrier: "FedEx",
    trackingNumber: "123456789012",
    status: "Scheduled",
    dataSource: "api",
    dataFreshness: "fresh",
    lastUpdated: "2025-01-27T10:00:00Z",
    completenessScore: 95
  },
  relationships: {
    job: ["job_51094"],
    customer: ["customer_798"]
  }
}
```

## Content Generation Strategy

### Job Content

Combines key job information for semantic search:

```typescript
const jobContent = [
  `Job ${job.JobNumber}: ${job.Description}`,
  `Customer: ${job.Client}`,
  `Order: ${job.OrderNumber}`,
  `Status: ${job.MasterJobStatus} - ${job.StockCompleteStatus}`,
  `Quantity: ${job.JobQuantity}`,
  `Due Date: ${job.DateDue}`,
  `Delivery: ${job.DeliveryOption}`,
  `Location: ${job.LocationCode}`,
  job.Comments && `Comments: ${job.Comments}`,
  job.JobTags.length > 0 &&
    `Tags: ${job.JobTags.map((tag) => tag.Tag).join(", ")}`,
  job.ProcessQuantities.length > 0 &&
    `Processes: ${job.ProcessQuantities.map(
      (pq) => `${pq.Code}: ${pq.Qty}`
    ).join(", ")}`,
]
  .filter(Boolean)
  .join(". ");
```

### JobLine Content

Focuses on production details:

```typescript
const joblineContent = [
  `JobLine ${jobline.LineId}: ${jobline.Description}`,
  `Job: ${job.JobNumber}`,
  `Category: ${jobline.Category}`,
  `Quantity: ${jobline.Quantity}`,
  `Price: $${jobline.UnitPrice}`,
  `Total: $${jobline.TotalPrice}`,
  jobline.Comment && `Comment: ${jobline.Comment}`,
  jobline.ProcessCodes.length > 0 &&
    `Processes: ${jobline.ProcessCodes.join(", ")}`,
  jobline.Materials.length > 0 && `Materials: ${jobline.Materials.join(", ")}`,
]
  .filter(Boolean)
  .join(". ");
```

## Performance Optimization

### 1. Batch Processing

- **Optimal Batch Size**: 50 vectors per batch
- **Concurrent Batches**: 3 batches in parallel
- **Rate Limiting**: Configurable delays between operations

### 2. Embedding Optimization

- **Model**: text-embedding-3-small (1024 dimensions)
- **Token Limit**: 8000 tokens per request
- **Retry Logic**: Automatic retries with exponential backoff

### 3. Pinecone Optimization

- **Upsert Strategy**: Batch upserts for efficiency
- **Metadata Cleaning**: Automatic metadata validation
- **Error Handling**: Graceful handling of API limits

### 4. Memory Management

- **Streaming Processing**: Process data in chunks
- **Garbage Collection**: Automatic cleanup of processed data
- **Connection Pooling**: Efficient API connection management

## Monitoring & Maintenance

### 1. Health Checks

```bash
npm run populate-pinecone health
```

Checks:

- Pinecone connectivity
- API health status
- Change tracker integrity
- Performance metrics

### 2. Performance Monitoring

Key metrics tracked:

- Processing time per job
- Embedding generation time
- Upsert success rate
- Error rates and types
- Memory usage

### 3. Change Tracker Management

The change tracker maintains:

- Last update timestamps
- Job update history
- Customer update history
- Vector content hashes
- Sync statistics

### 4. Error Handling

Automatic handling of:

- API rate limits
- Network timeouts
- Invalid data formats
- Pinecone API errors
- Embedding generation failures

## Troubleshooting

### Common Issues

#### 1. API Rate Limits

**Symptoms**: Embedding generation fails with rate limit errors

**Solutions**:

- Increase `embeddingDelay` in configuration
- Reduce `batchSize`
- Use `conservative` preset

#### 2. Pinecone API Errors

**Symptoms**: Upsert operations fail

**Solutions**:

- Check Pinecone API key and index name
- Verify index dimensions match embedding model
- Reduce `batchSize` to avoid payload limits

#### 3. Memory Issues

**Symptoms**: Process runs out of memory

**Solutions**:

- Reduce `batchSize`
- Reduce `maxConcurrentBatches`
- Enable garbage collection

#### 4. Data Freshness Issues

**Symptoms**: Stale data in search results

**Solutions**:

- Run incremental update more frequently
- Reduce `freshnessThreshold`
- Check API data timestamps

### Debug Mode

Enable debug logging by setting:

```bash
DEBUG=pinecone-population:*
```

### Reset Procedures

#### Reset Change Tracker

```bash
npm run populate-pinecone reset
```

#### Force Full Sync

```bash
npm run populate-pinecone reset
npm run populate-pinecone full production
```

## Best Practices

### 1. Data Freshness

- Run incremental updates every 4-6 hours
- Monitor data freshness metrics
- Set appropriate freshness thresholds
- Validate API data timestamps

### 2. Performance

- Use appropriate configuration presets
- Monitor processing times
- Adjust batch sizes based on system capacity
- Implement proper error handling

### 3. Reliability

- Implement retry logic for failed operations
- Use change tracking for data consistency
- Validate data before processing
- Monitor error rates and types

### 4. Scalability

- Design for horizontal scaling
- Use efficient data structures
- Implement proper resource management
- Monitor system resource usage

## Integration Examples

### 1. Scheduled Updates

```bash
# Cron job for incremental updates every 4 hours
0 */4 * * * cd /path/to/project && npm run populate-pinecone incremental production
```

### 2. CI/CD Integration

```yaml
# GitHub Actions example
- name: Update Vector Database
  run: |
    npm run populate-pinecone incremental production
  env:
    PINECONE_API_KEY: ${{ secrets.PINECONE_API_KEY }}
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

### 3. Health Monitoring

```typescript
// Health check integration
import { PineconePopulationStrategy } from "./src/lib/pinecone-population-strategy";

const strategy = new PineconePopulationStrategy();
const health = await strategy.healthCheck();

if (!health.healthy) {
  // Send alert
  console.error("Vector database health check failed:", health.error);
}
```

## Conclusion

This Pinecone population strategy provides a robust, scalable solution for maintaining fresh vector data from your OMS API. The combination of incremental updates, change tracking, and performance optimization ensures efficient operation while maintaining data accuracy and freshness.

For additional support or questions, refer to the troubleshooting section or check the error logs for specific guidance.

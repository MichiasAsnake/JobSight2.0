# Direct OMS API Endpoint Testing (CommonJS)

This script (`test-all-oms-endpoints-direct.cjs`) calls OMS APIs directly for vector database population, using CommonJS to avoid TypeScript compilation issues.

## Overview

The script systematically tests all 10 endpoints defined in `api_knowledge.md` by calling the OMS APIs directly:

1. **get-job-list** - Foundation endpoint that returns active jobs
2. **get-joblines** - Line items for specific jobs
3. **get-joblines-cost-details** - Cost calculations for jobs
4. **get-all-inwards-and-stock-items** - Stock/inward materials
5. **get-job-shipments** - Shipment details
6. **get-delivery-options** - Customer delivery options
7. **get-price-quantity-bands** - Pricing rules
8. **get-all-category-units** - Product types (reference data)
9. **get-job-history** - Job activity timeline
10. **get-customer-by-id** - Customer information

## Key Differences from Previous Approach

- **Direct API calls**: Uses `node-fetch` to call OMS APIs directly
- **CommonJS format**: No TypeScript compilation required
- **No query router**: Bypasses the OMS chat endpoint and query router
- **Real data flow**: Uses actual job numbers and customer IDs from API responses
- **Proper parameter mapping**: Extracts real category unit IDs and price codes from job lines

## Dependencies and Relationships

The script handles endpoint dependencies intelligently:

- **Job-based dependencies**: Uses job numbers from `get-job-list` to test job-specific endpoints
- **Customer-based dependencies**: Uses customer IDs from jobs to test customer-specific endpoints
- **Pricing dependencies**: Extracts category unit IDs and price codes from job lines for pricing tests
- **Reference data**: Treats `get-all-category-units` as reference data (limited storage)

## Prerequisites

### Authentication

The script requires authentication cookies for the OMS system. Set the environment variable:

```bash
export OMS_AUTH_COOKIES="your_auth_cookies_here"
```

### Testing Setup

Before running the main script, test that the CommonJS setup works:

```bash
# Test CommonJS imports and basic functionality
node scripts/test-commonjs-import.cjs
```

## Usage

### Running the Script

```bash
node scripts/test-all-oms-endpoints-direct.cjs
```

### Output

The script generates `data/direct-oms-responses.json` containing:

- **Metadata**: Collection timestamp, success/failure counts, tested entities
- **Responses**: All API responses with endpoint details and parameters
- **Relationships**: Dependency mappings between jobs, customers, and endpoints

## Data Structure for Vector Database

The output is structured for optimal vector database population:

```json
{
  "metadata": {
    "collectedAt": "2024-01-01T12:00:00.000Z",
    "baseUrl": "https://intranet.decopress.com",
    "totalEndpoints": 45,
    "successfulCalls": 42,
    "failedCalls": 3,
    "jobsTested": ["51132", "51133", "51134"],
    "customersTested": ["123", "456"],
    "endpointsCovered": ["get-job-list", "get-joblines", ...]
  },
  "responses": [
    {
      "endpoint": "get-job-list",
      "url": "https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx",
      "method": "POST",
      "parameters": {...},
      "timestamp": "2024-01-01T12:00:00.000Z",
      "response": {...}
    }
  ],
  "relationships": {
    "jobDependencies": [...],
    "customerDependencies": [...]
  }
}
```

## Testing Strategy

### Smart Sampling

- Limits to 5 jobs and 3 customers to avoid overwhelming the system
- Tests pricing combinations for up to 3 category units and price codes
- Focuses on realistic data relationships

### Error Handling

- Continues testing even if individual endpoints fail
- Records errors in the response structure
- Provides detailed logging for debugging

### Performance Considerations

- Sequential execution to avoid overwhelming the server
- Reasonable delays between requests
- Structured output for efficient vector database processing

### Real Data Flow

1. **Get job list** → Extract real job numbers and customer IDs
2. **Get job lines** → Extract real category unit IDs and price codes
3. **Use extracted data** → Call dependent endpoints with real parameters
4. **Reference data** → Store relevant subsets of category units

## Integration with Vector Database

The structured output is designed for:

1. **Semantic search**: Rich context from multiple related endpoints
2. **Relationship mapping**: Clear dependencies between entities
3. **Query routing**: Understanding which endpoints to call for different query types
4. **Response generation**: Comprehensive data for generating detailed answers

## Troubleshooting

### Common Issues

1. **Authentication errors**: Ensure `OMS_AUTH_COOKIES` environment variable is set
2. **Import errors**: Run `test-commonjs-import.cjs` first to verify setup
3. **Rate limiting**: The script includes reasonable delays, but adjust if needed
4. **Data availability**: Some endpoints may return empty results if no data exists

### Debugging

- Check the console output for detailed progress and error messages
- Review the generated JSON file for specific endpoint failures
- Verify that authentication cookies are valid and not expired

## Next Steps

After running the script:

1. Review the generated JSON file for data quality
2. Use the structured data to populate your vector database
3. Test the RAG system with real queries
4. Iterate on the data structure based on query performance

## Files

- `test-all-oms-endpoints-direct.cjs` - Main testing script (CommonJS)
- `test-commonjs-import.cjs` - CommonJS import verification
- `README-oms-endpoint-testing.md` - This documentation

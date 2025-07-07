# Edge Case Fixes for Query Router

## Issues Identified from Chat Logs

### 1. **Tag Filtering Problems**

**Issue**: Inconsistent tag handling for queries like "tagged @laser" vs "tagged in production"
**Root Cause**: GPT prompt lacked specific tag handling rules and filtering logic was too simplistic

**Fixes Applied**:

- Enhanced GPT prompt with detailed tag handling rules
- Added tag extraction examples for common patterns
- Improved `orderHasTag()` method with robust tag matching
- Added support for tag variations (@laser vs laser, production vs in production)

### 2. **Date Range Calculation Issues**

**Issue**: Date ranges calculated incorrectly for "this week" vs "next week"
**Root Cause**: GPT prompt had date rules but they weren't specific enough

**Fixes Applied**:

- Enhanced date calculation examples in GPT prompt
- Added specific business week definitions (Monday-Sunday)
- Improved date range extraction logic

### 3. **Performance Issues**

**Issue**: Queries taking 5+ seconds (>5000ms) triggering performance warnings
**Root Cause**: Multiple API calls and inefficient caching

**Fixes Applied**:

- Optimized hybrid strategy to limit vector result enrichment (max 10 API calls)
- Improved cache key generation for better hit rates
- Reduced cache TTL for fresher data while maintaining performance
- Added parallel execution where possible

### 4. **Intent Parsing Inconsistencies**

**Issue**: GPT parsing similar queries differently
**Root Cause**: Prompt lacked specific examples and rules

**Fixes Applied**:

- Added comprehensive tag handling rules to GPT prompt
- Included specific examples for common query patterns
- Enhanced business logic rules for better consistency

### 5. **Cache Inefficiency**

**Issue**: Low cache hit rates (0 cache hits, 1 cache miss in examples)
**Root Cause**: Cache keys too specific, TTL too short

**Fixes Applied**:

- Simplified cache key generation (normalized query + essential context only)
- Adjusted TTL based on query type (2-10 minutes)
- Lowered cache threshold to include more results
- Added caching for failed queries to avoid repeated failures

## Code Changes Made

### 1. Enhanced GPT Prompt (`src/lib/query-router.ts`)

```typescript
// Added comprehensive tag handling rules
CRITICAL TAG HANDLING RULES:
- Tags can be prefixed with "@" (e.g., "@laser", "@urgent")
- Tags can be plain text (e.g., "production", "urgent")
- "tagged X" means include orders that have tag containing "X"
- "not tagged X" means exclude orders that have tag containing "X"
- Tag matching is case-insensitive and uses partial matching

// Added specific examples
TAG EXTRACTION EXAMPLES:
- "tagged @laser" → tags: ["@laser"]
- "tagged production" → tags: ["production"]
- "tagged in production" → tags: ["production"]
- "not tagged gamma" → excludeTags: ["gamma"]
```

### 2. Improved Tag Matching (`src/lib/enhanced-filtering-service.ts`)

```typescript
private orderHasTag(order: ModernOrder, tag: string): boolean {
  // Handle different tag formats
  const tagVariations = [
    tagLower,
    tagLower.startsWith('@') ? tagLower.substring(1) : `@${tagLower}`,
    tagLower.replace(/[^a-zA-Z0-9]/g, ''),
    tagLower.replace(/\s+/g, '-'),
    tagLower.replace(/\s+/g, ''),
  ];

  // Special case handling for "in production" → "production"
  if (tagLower === 'production' && orderTagLower.includes('production')) {
    return true;
  }
}
```

### 3. Performance Optimizations (`src/lib/query-router.ts`)

```typescript
// Limit API calls in hybrid strategy
const maxVectorEnrichment = 10;
const vectorResultsToEnrich = vectorResults.slice(0, maxVectorEnrichment);

// Improved cache strategy
private shouldCacheResult(result: RoutedQueryResult, intent: QueryIntent): boolean {
  return result.confidence > 0.3 && result.results.orders !== undefined;
}

// Better cache keys
private generateCacheKey(query: string, context: QueryContext): string {
  const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const contextKey = context.userPreferences?.preferFreshData ? 'fresh' : 'default';
  return `query:${normalizedQuery}:${contextKey}`;
}
```

## Testing

Created `scripts/test-edge-cases.js` to validate fixes:

- Tests tag filtering with @laser and production
- Tests exclude tag functionality
- Tests date range calculations
- Tests cache performance
- Validates processing times

## Expected Improvements

1. **Tag Filtering**: Should now correctly handle "tagged @laser", "tagged in production", "not tagged gamma"
2. **Performance**: Queries should complete under 5 seconds in most cases
3. **Cache Efficiency**: Higher cache hit rates, especially for repeated queries
4. **Consistency**: Similar queries should be parsed consistently
5. **Date Accuracy**: Date ranges should be calculated correctly for business weeks

## Monitoring

Monitor these metrics after deployment:

- Average query processing time
- Cache hit rate
- Number of queries taking >5 seconds
- Tag filtering accuracy
- Date range calculation accuracy

# Vector DB Schema Analysis for OMS API Data

## Overview

This document analyzes the structure of OMS API responses to inform optimal vector database storage strategy. Based on the `direct-oms-responses.json` sample, we've identified key entities and their relationships.

## Data Structure Summary

### 1. Core Entities

#### Job Entity

- **Primary Key**: `JobNumber` (e.g., 51094)
- **Key Fields**:
  - `CustomerId`: Links to customer
  - `Description`: Job description
  - `OrderNumber`: External order reference
  - `JobQuantity`: Total quantity
  - `DateDue`: Due date
  - `MasterJobStatus`: Current status
  - `StockCompleteStatus`: Stock status
  - `DeliveryOption`: Shipping method

#### Customer Entity

- **Primary Key**: `Id` (e.g., 798)
- **Key Fields**:
  - `Name`: Customer name
  - `PriceTierCode`: Pricing tier
  - `AccountOnCreditHold`: Credit status
  - `Users`: Array of customer users

#### JobLine Entity

- **Primary Key**: `ID` (e.g., 168166)
- **Key Fields**:
  - `JobNumber`: Links to job
  - `Prgram`: Program code
  - `Description`: Line description
  - `Garment`: Product description
  - `Qty`: Quantity
  - `UnitPrice`: Price per unit
  - `AssetId`: Links to asset

### 2. Related Entities

#### Stock/Inventory

- `Inwards`: Received items
- `StockItems`: Current inventory
- `AssetId`: Links to product assets

#### Shipping

- `Shipments`: Shipping information
- `TrackingNumber`: Carrier tracking
- `DeliveryOptions`: Available shipping methods

#### History/Tracking

- `JobHistory`: Timeline of job events
- `JobTags`: User-added tags
- `ProcessQuantities`: Production quantities by process

## Vector DB Storage Strategy

### 1. Document Structure Recommendations

#### Primary Documents

```json
{
  "id": "job_51094",
  "type": "job",
  "content": "Job 51094: MICRON / INVENTOR APPAREL - SPLIT for Jackalope, Order 10979-4, 527 units, Approved status, Stock Complete, Due 2025-06-28",
  "metadata": {
    "jobNumber": 51094,
    "customerId": 798,
    "customerName": "Jackalope",
    "orderNumber": "10979-4",
    "status": "Approved",
    "stockStatus": "Stock Complete",
    "dueDate": "2025-06-28T05:00:00+00:00",
    "quantity": 527,
    "deliveryOption": "NDA"
  },
  "relationships": {
    "customer": "customer_798",
    "joblines": ["jobline_168166", "jobline_168167"],
    "shipments": ["shipment_9876"],
    "history": ["history_54321", "history_54322", "history_54323"]
  }
}
```

#### Customer Documents

```json
{
  "id": "customer_798",
  "type": "customer",
  "content": "Customer Jackalope, Price Tier A, Account not on credit hold, Contact: John Doe (john.doe@jackalope.com)",
  "metadata": {
    "customerId": 798,
    "name": "Jackalope",
    "priceTier": "A",
    "creditHold": false,
    "primaryContact": "John Doe",
    "email": "john.doe@jackalope.com"
  },
  "relationships": {
    "jobs": ["job_51094"],
    "deliveryOptions": ["delivery_NDA", "delivery_2DA", "delivery_GROUND"]
  }
}
```

#### JobLine Documents

```json
{
  "id": "jobline_168167",
  "type": "jobline",
  "content": "JobLine 168167: INVENTOR BLACK embroidery on DLX-1 Men's Bergen Sherpa Fleece Jacket - Zinc, 47 units at $6.50 each, LEFT CHEST location, BLACK color, 2.5\" width",
  "metadata": {
    "jobLineId": 168167,
    "jobNumber": 51094,
    "program": "EM12722",
    "description": "INVENTOR BLACK",
    "garment": "DLX-1 Men's Bergen Sherpa Fleece Jacket - Zinc",
    "quantity": 47,
    "unitPrice": 6.5,
    "totalPrice": 305.5,
    "location": "LEFT CHEST",
    "color": "BLACK",
    "width": "2.5\"",
    "assetId": 209510
  },
  "relationships": {
    "job": "job_51094",
    "parentJobLine": "jobline_168166",
    "asset": "asset_209510"
  }
}
```

### 2. Vector Embedding Strategy

#### Content Generation Rules

1. **Job Documents**: Combine job number, description, customer, order number, status, and key dates
2. **Customer Documents**: Include customer name, contact info, pricing tier, and credit status
3. **JobLine Documents**: Combine program, description, garment, specifications, and pricing
4. **History Documents**: Include action, description, timestamp, and user
5. **Shipment Documents**: Include shipment details, carrier, tracking, and status

#### Metadata Fields for Filtering

- `type`: Document type (job, customer, jobline, shipment, history)
- `jobNumber`: For job-related queries
- `customerId`: For customer-related queries
- `status`: For status-based filtering
- `dateRange`: For temporal queries
- `program`: For program-specific queries

### 3. Query Optimization

#### Common Query Patterns

1. **Job Status Queries**: "Show me all approved jobs"
2. **Customer Queries**: "What jobs does Jackalope have?"
3. **Product Queries**: "Find jobs with DLX-1 jackets"
4. **Date Range Queries**: "Jobs due this week"
5. **Program Queries**: "All embroidery jobs"
6. **Status + Customer**: "Approved jobs for Jackalope"

#### Indexing Strategy

- Primary index on `type` and `jobNumber`
- Secondary index on `customerId`
- Date range index on `dueDate`
- Program index on `program` (for joblines)
- Status index on `status`

### 4. Data Relationships

#### Hierarchical Structure

```
Customer (798)
├── Jobs (51094)
    ├── JobLines (168166, 168167)
    ├── Shipments (9876)
    ├── History (54321, 54322, 54323)
    └── Stock (12345, 67890)
```

#### Cross-References

- Jobs reference customers
- JobLines reference jobs and assets
- Shipments reference jobs
- History references jobs
- Stock references jobs

### 5. Implementation Considerations

#### Document Size Management

- Keep individual documents under 4KB for optimal vector search
- Split large job histories into separate documents
- Use metadata for filtering instead of embedding all data

#### Update Strategy

- Incremental updates for job status changes
- Full re-embedding for major changes (new joblines, customer updates)
- Batch updates for efficiency

#### Search Optimization

- Use hybrid search (vector + keyword)
- Implement semantic similarity for garment descriptions
- Use metadata filters to narrow search scope before vector search

## Sample Implementation

### Vector DB Schema

```typescript
interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    type: "job" | "customer" | "jobline" | "shipment" | "history";
    jobNumber?: number;
    customerId?: number;
    status?: string;
    dueDate?: string;
    program?: string;
    [key: string]: any;
  };
  relationships?: {
    [key: string]: string[];
  };
}
```

### Query Examples

```typescript
// Find jobs by customer
const customerJobs = await vectorDB.search({
  query: "Jackalope jobs",
  filter: { type: "job", customerId: 798 },
});

// Find embroidery jobs
const embroideryJobs = await vectorDB.search({
  query: "embroidery work",
  filter: { type: "jobline", program: { $regex: "EM" } },
});

// Find overdue jobs
const overdueJobs = await vectorDB.search({
  query: "overdue jobs",
  filter: {
    type: "job",
    dueDate: { $lt: new Date().toISOString() },
    status: { $ne: "Completed" },
  },
});
```

This schema analysis provides a foundation for implementing an efficient vector database solution for the OMS API data, balancing search accuracy with performance and maintainability.

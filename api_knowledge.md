Here's a **complete Markdown (`.md`) file** that you can use as your **API knowledge base for Cursor**, GPT-4, or any RAG system. It includes:

✅ Clear endpoint descriptions  
✅ Parameter mappings  
✅ Sample response keys  
✅ Relationship logic  
✅ Query-to-endpoint mapping

---

# 🧠 API Knowledge Base for Decopress Internal Systems

This document helps AI tools like Cursor, GPT-4, and RAG systems understand how to:

- Interpret natural language queries
- Map them to the correct internal endpoints
- Understand relationships between jobs, customers, assets, pricing, and shipping

---

## 📦 1. `get-job-list`

### 🔹 Description

Returns a list of all active jobs/orders with filtering capabilities.

### 🔹 URL

```
POST https://intranet.decopress.com/jobstatuslist/ajax/JobStatusQueryAsync.ashx
```

### 🔹 Parameters

```json
{
  "job-status": "5,6,7,8", // Approved, On Time, Running Late, Problem
  "due-date": "1,2,3", // Today, Tomorrow, Not Yet Due
  "stock-status": "0,1,2", // None, Partial, Complete
  "text-filter": "", // Free-text search (customer name, order name, tags like @juliol)
  "bit": "get-job-list"
}
```

### 🔹 Sample Response Keys

- `JobNumber`: Unique ID of the job
- `OrderNumber`: Customer-facing order number
- `ClientName`: Customer name
- `MasterJobStatus`: e.g., “Approved”
- `StockCompleteStatus`: e.g., “Stock Complete”
- `DateDueUtc`: Due date (UTC)

### 🔹 Use When

- User asks:
  - “Show me today’s orders” → set `due-date=1`
  - “Find jobs for SLANT PROMOTIONS” → set `text-filter=SLANT PROMOTIONS`
  - “Show me all jobs with no stock” → set `stock-status=0`

---

## 📋 2. `get-joblines`

### 🔹 Description

Returns line items (products) for a specific job/order.

### 🔹 URL

```
GET https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-joblines&jobNumber={id}
```

### 🔹 Parameters

- `jobNumber`: The job ID from `get-job-list`
- `bit`: `"get-joblines"`

### 🔹 Sample Response Keys

- `Prgram`: Process code + ID (e.g., `EM13044`)
- `Description`: Item description
- `Qty`: Quantity
- `UnitPrice`: Price per unit
- `Comments`: Additional metadata (colors, thread counts, etc.)

### 🔹 Use When

- User asks:
  - “What’s in order #51132?”
  - “How many SPACEX patches are in this job?”

---

## 💰 3. `get-joblines-cost-details`

### 🔹 Description

Returns subtotal, tax, and total cost for all job lines in a given job.

### 🔹 URL

```
POST https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx
```

### 🔹 Parameters

```json
{
  "bit": "get-joblines-cost-details",
  "jobNumber": "51132"
}
```

### 🔹 Sample Response Keys

- `jobLinesSubTotal`
- `jobLinesTaxTotal`
- `jobLinesTotalCost`

### 🔹 Use When

- User asks:
  - “How much is order #51132?”
  - “What’s the total including tax for this job?”

---

## 📦 4. `get-all-inwards-and-stock-items`

### 🔹 Description

Returns stock/inward materials for a specific job.

### 🔹 URL

```
GET https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-all-inwards-and-stock-items&jobNumber={id}
```

### 🔹 Parameters

- `jobNumber`: From `get-job-list`
- `bit`: `"get-all-inwards-and-stock-items"`

### 🔹 Use When

- User asks:
  - “Do we have enough material for order #51132?”
  - “Has the fabric arrived for this job?”

---

## 🚚 5. `get-job-shipments`

### 🔹 Description

Returns shipment details for a job.

### 🔹 URL

```
GET https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-shipments&jobNumber={id}
```

### 🔹 Parameters

- `jobNumber`: From `get-job-list`
- `bit`: `"get-job-shipments"`

### 🔹 Use When

- User asks:
  - “Has anything shipped for order #51132?”
  - “Which items are left to ship?”

---

## 📬 6. `get-delivery-options`

### 🔹 Description

Returns delivery options for a customer.

### 🔹 URL

```
GET https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-delivery-options&customerId={id}
```

### 🔹 Use When

- User asks:
  - “What delivery options does this customer have?”
  - “Is this job being sent via 2 Day Air?”

---

## 🧾 7. `get-price-quantity-bands`

### 🔹 Description

Returns pricing rules based on quantity bands.

### 🔹 URL

```
POST https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx
```

### 🔹 Parameters

```json
{
  "category-unit-id": "13476", // Found in jobline data
  "price-tier": "F", // Found in jobline data
  "price-code": "EM_DIRECT:...", // Found in jobline data
  "bit": "get-price-quantity-bands"
}
```

### 🔹 Use When

- User asks:
  - “Why is this unit priced at $0.84?”
  - “What’s the setup cost for this item?”

---

## 📂 8. `get-all-category-units`

### 🔹 Description

Returns all available product types.

### 🔹 URL

```
GET https://intranet.decopress.com/assetmanager/ajax/assetbit.ashx?bit=get-all-category-units
```

### 🔹 Use When

- User asks:
  - “What units are available?”
  - “List all product categories”

---

## 📋 9. `get-job-history`

### 🔹 Description

Returns timeline of job activity.

### 🔹 URL

```
GET https://intranet.decopress.com/Jobs/ajax/JobHandler.ashx?bit=get-job-history&jobNumber={id}
```

### 🔹 Use When

- User asks:
  - “When was this job updated?”
  - “Who made changes last week?”

---

## 👤 10. `get-customer-by-id`

### 🔹 Description

Returns customer information.

### 🔹 URL

```
GET https://intranet.decopress.com/customer/ajax/CustomerHandler.ashx?bit=get-customer-by-id&id={id}
```

### 🔹 Use When

- User asks:
  - “Who is this order for?”
  - “Show me contact info for this customer”

---

## 🧩 Mapping Natural Language Queries to Endpoints

| User Query                                       | Relevant Endpoint(s)                                                |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| "Show me today’s jobs"                           | `get-job-list` + `due-date=1`                                       |
| "What’s in order #51132?"                        | `get-joblines` + `jobNumber=51132`                                  |
| "How much is order #51132?"                      | `get-joblines-cost-details` + `jobNumber=51132`                     |
| "Has anything shipped for #51132?"               | `get-job-shipments` + `jobNumber=51132`                             |
| "What materials are in this job?"                | `get-all-inwards-and-stock-items` + `jobNumber=51132`               |
| "What delivery options does this customer have?" | `get-delivery-options` + `customerId`                               |
| "How is pricing calculated for NA10513?"         | `get-price-quantity-bands` + `CategoryUnitId` or `AssetTag=NA10513` |
| "Show me all product types"                      | `get-all-category-units`                                            |
| "When was this job last updated?"                | `get-job-history` + `jobNumber`                                     |
| "Who is this order for?"                         | `get-customer-by-id` + `customerId`                                 |

---

## 🔄 Entity Relationships

```
[Customer] → [Jobs] → [JobLines] ↔ [Pricing]
         ↘          ↘           ↘
          → [Shipments] → [Delivery Options]
          → [History]
          → [Stock/Inwards]
          → [Assets/Images]
```

---

## 🗺️ Example Flow

**User:** "I need to know the total cost and delivery method for order #51132"

**System Steps:**

1. Call `get-joblines-cost-details` with `jobNumber=51132`
2. Call `get-job-shipments` with `jobNumber=51132`
3. Combine results and return final answer

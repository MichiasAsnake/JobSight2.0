# 📋 Comprehensive API Response Schemas for Vector Database Population

This document provides complete schemas for all API response objects used in vector database population, based on both the API knowledge documentation and actual collected responses.

## 🎯 Purpose

- **Vector Population**: Map API responses to searchable text and metadata
- **Data Consistency**: Ensure all fields are properly extracted
- **Search Optimization**: Identify which fields are most important for search
- **Type Safety**: Provide complete TypeScript interfaces

---

## 📊 System Status Responses (Collected)

### 1. Vector Database Stats (`/api/vector-stats`)

```typescript
interface VectorStatsResponse {
  success: boolean;
  data: {
    changeTracker: {
      lastVectorUpdate: string; // ✅ METADATA: Last update timestamp
      processedOrdersCount: number; // ✅ METADATA: Total orders processed
      deletedOrdersCount: number; // ✅ METADATA: Orders removed
      trackedHashesCount: number; // ✅ METADATA: Hash tracking count
    };
    timestamp: string;
    message: string;
  };
}
```

### 2. Admin Health (`/api/admin/health`)

```typescript
interface AdminHealthResponse {
  overall: boolean;
  components: {
    api: {
      healthy: boolean;
      responseTime: number;
      endpoints: Record<string, any>;
    };
    vectors: {
      healthy: boolean;
      stats: {
        namespaces: Record<string, any>;
        dimension: number; // ✅ METADATA: Vector dimensions
        indexFullness: number; // ✅ METADATA: Index utilization
        totalRecordCount: number; // ✅ METADATA: Total vectors
      };
      changeTracker: {
        lastUpdate: string;
        processedOrders: number;
        updateHistory: number;
      };
    };
    cache: {
      healthy: boolean;
      hitRate: number;
      totalEntries: number;
      totalSize: number;
      averageAge: number;
      performanceMetrics: {
        averageRetrievalTime: number;
        averageStorageTime: number;
        evictionRate: number;
      };
    };
    rag: {
      healthy: boolean;
    };
    queryRouter: {
      healthy: boolean;
      successRate: number;
      avgResponseTime: number;
      totalQueries: number;
    };
  };
  timestamp: string;
  responseTime: number;
}
```

### 3. Admin Metrics (`/api/admin/metrics`)

```typescript
interface AdminMetricsResponse {
  totalQueries: number;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  cacheEntries: number;
  cacheSize: number;
  apiCalls: number;
  apiSuccessRate: number;
  apiAverageTime: number;
  vectorHealth: number;
  vectorEntries: number;
  activeConnections: number;
  memoryUsage: number;
  timestamp: string;
  collectionTime: number;
  overallPerformanceScore: number;
  systemLoadIndicator: string;
}
```

### 4. Admin Configuration (`/api/admin/config`)

```typescript
interface AdminConfigResponse {
  configuration: ConfigurationItem[];
  summary: {
    total: number;
    editable: number;
    readonly: number;
    byCategory: Record<string, number>;
  };
  lastUpdated: string;
}

interface ConfigurationItem {
  key: string;
  value: string;
  type: "string" | "number" | "boolean";
  description: string;
  category: "api" | "vector" | "cache" | "rag" | "general";
  editable: boolean;
}
```

---

## 📦 Core Job/Order Data (From API Knowledge)

### `APIJob` (from `get-job-list`)

```typescript
interface APIJob {
  // Core identifiers
  JobNumber: number; // ✅ SEARCHABLE: "Job 51132"
  OrderNumber: string; // ✅ SEARCHABLE: "Order ABC123"
  Client: string; // ✅ SEARCHABLE: Customer name
  CustomerId: number; // ✅ METADATA: Customer ID

  // Descriptions and content
  Description: string; // ✅ SEARCHABLE: Main job description
  Comments: string; // ✅ SEARCHABLE: Additional comments

  // Dates and timing
  DateIn: string; // ✅ METADATA: Job creation date
  DateInUtc: string; // ✅ METADATA: UTC creation date
  DateDue: string; // ✅ SEARCHABLE: Due date info
  DateDueUtc: string; // ✅ METADATA: UTC due date
  DateDueFactory: string; // ✅ METADATA: Factory due date
  DaysToDueDate: number; // ✅ SEARCHABLE: "urgent" if < 3 days

  // Status information
  MasterJobStatus: string; // ✅ SEARCHABLE: "Approved", "Running Late"
  MasterJobStatusId: number; // ✅ METADATA: Status ID
  StockComplete: number; // ✅ METADATA: Stock completion percentage
  StockCompleteStatus: string; // ✅ SEARCHABLE: "Stock Complete", "Partial"
  StatusLineHtml: string; // ✅ SEARCHABLE: Formatted status
  StatusLine: string; // ✅ SEARCHABLE: Plain text status

  // Delivery and shipping
  DeliveryOption: string; // ✅ SEARCHABLE: Shipping method
  JobQuantity: number; // ✅ METADATA: Total quantity
  LocationCode: string; // ✅ SEARCHABLE: Production location
  JobLocationCode: string; // ✅ SEARCHABLE: Job location
  JobLocationName: string; // ✅ SEARCHABLE: Location name

  // Flags and indicators
  MustDate: boolean; // ✅ SEARCHABLE: "must date" if true
  TimeSensitive: boolean; // ✅ SEARCHABLE: "time sensitive" if true
  IsReprint: boolean; // ✅ SEARCHABLE: "reprint" if true
  IsDupe: boolean; // ✅ SEARCHABLE: "duplicate" if true

  // Tags and metadata
  JobTags: APIJobTag[]; // ✅ SEARCHABLE: All tag content
  ProcessQuantities: APIProcessQuantity[]; // ✅ SEARCHABLE: Process info
  GangCodes: string[]; // ✅ SEARCHABLE: Gang codes

  // System fields
  BitVal: number; // ✅ METADATA: System bit value
  SortKey: string; // ✅ METADATA: Sort key
  CanSuggestMachines: boolean; // ✅ METADATA: Machine suggestion flag
  CanPrintJobLineLabels: boolean; // ✅ METADATA: Label printing flag
  HasScheduleableJobLines: boolean; // ✅ METADATA: Scheduling flag
}

interface APIJobTag {
  Tag: string; // ✅ SEARCHABLE: Tag content
  WhoEnteredUsername: string; // ✅ SEARCHABLE: "@username" format
  WhenEntered: string; // ✅ METADATA: Tag creation date
  WhenEnteredUtc: string; // ✅ METADATA: UTC tag date
  Code: string; // ✅ SEARCHABLE: Tag code
  Meta: unknown; // ✅ SEARCHABLE: Additional metadata
}

interface APIProcessQuantity {
  BitVal: number; // ✅ METADATA: Process bit value
  Code: string; // ✅ SEARCHABLE: Process code
  DisplayCode: string; // ✅ SEARCHABLE: Display code
  Qty: number; // ✅ SEARCHABLE: Process quantity
  SuggestedMachineId: number; // ✅ METADATA: Suggested machine
  SuggestedMachineLabel: string; // ✅ SEARCHABLE: Machine label
  HasSuggestedMachine: boolean; // ✅ METADATA: Has suggestion flag
}
```

### `APIJobLine` (from `get-joblines`)

```typescript
interface APIJobLine {
  LineId: number; // ✅ METADATA: Line item ID
  JobNumber: number; // ✅ METADATA: Associated job
  AssetSKU: string; // ✅ SEARCHABLE: Product SKU
  Description: string; // ✅ SEARCHABLE: Line item description
  Category: string; // ✅ SEARCHABLE: Product category
  Quantity: number; // ✅ SEARCHABLE: Quantity info
  UnitPrice: number; // ✅ METADATA: Price per unit
  TotalPrice: number; // ✅ METADATA: Total line price
  Comment: string; // ✅ SEARCHABLE: Line comments
  Status: string; // ✅ SEARCHABLE: Line status
  ProcessCodes: string[]; // ✅ SEARCHABLE: Production processes
  Materials: string[]; // ✅ SEARCHABLE: Materials used
  HasImage: boolean; // ✅ METADATA: Has image flag
  HasPDF: boolean; // ✅ METADATA: Has PDF flag
}
```

### `APIJobShipment` (from `get-job-shipments`)

```typescript
interface APIJobShipment {
  Id: number; // ✅ METADATA: Shipment ID
  Guid: string; // ✅ METADATA: Unique GUID
  Index: number; // ✅ METADATA: Shipment index
  Title: string; // ✅ SEARCHABLE: Shipment title
  MailingLabel: string; // ✅ SEARCHABLE: Mailing address
  AddressSummaryOneLine: string; // ✅ SEARCHABLE: Address summary
  ContactDetailsOneLine: string; // ✅ SEARCHABLE: Contact info
  ShipmentNotes: string; // ✅ SEARCHABLE: Shipping notes
  IsShipmentIntl: boolean; // ✅ SEARCHABLE: "international" if true
  CanShip: boolean; // ✅ METADATA: Can ship flag
  Shipped: boolean; // ✅ SEARCHABLE: "shipped" if true
  DateShipped: string | null; // ✅ SEARCHABLE: Ship date
  CanCollect: boolean; // ✅ METADATA: Can collect flag
  Collected: boolean; // ✅ SEARCHABLE: "collected" if true
  CollectionDate: string | null; // ✅ SEARCHABLE: Collection date
  Validated: boolean; // ✅ METADATA: Address validated
  TrackingDetails: APITrackingDetails | null; // ✅ SEARCHABLE: Tracking info
  ShipmentMethod: {
    // ✅ SEARCHABLE: Shipping method
    label: string;
    value: string;
    iscollection: boolean;
    rank: number;
    deliveryLabelEnabled: boolean;
  };
  Address: APIAddress; // ✅ SEARCHABLE: Full address
  ShipmentPackages: APIPackage[]; // ✅ SEARCHABLE: Package details
}

interface APITrackingDetails {
  Logo: string; // ✅ METADATA: Carrier logo
  LogoPath: string; // ✅ METADATA: Logo path
  TrackingLink: string; // ✅ SEARCHABLE: Tracking URL
  TrackingLinkText: string; // ✅ SEARCHABLE: Tracking text
  DeliveryStatus: string; // ✅ SEARCHABLE: Delivery status
  InfoLine: string | null; // ✅ SEARCHABLE: Status info
  ShippedVia: string; // ✅ SEARCHABLE: Shipping carrier
  Status: string; // ✅ SEARCHABLE: Current status
  LastUpdate: string; // ✅ METADATA: Last update time
}

interface APIAddress {
  Id: number; // ✅ METADATA: Address ID
  Guid: string; // ✅ METADATA: Address GUID
  ContactName: string; // ✅ SEARCHABLE: Contact name
  Organisation: string; // ✅ SEARCHABLE: Organization
  Phone: string; // ✅ SEARCHABLE: Phone number
  Mobile: string; // ✅ SEARCHABLE: Mobile number
  EmailAddress: string; // ✅ SEARCHABLE: Email address
  CountryCodeISO2: string; // ✅ SEARCHABLE: Country code
  CountryName: string; // ✅ SEARCHABLE: Country name
  StreetAddress: string; // ✅ SEARCHABLE: Street address
  AddressLine2: string; // ✅ SEARCHABLE: Address line 2
  City: string; // ✅ SEARCHABLE: City
  District: string; // ✅ SEARCHABLE: District
  AdministrativeArea: string; // ✅ SEARCHABLE: State/province
  AdministrativeAreaAbbreviation: string; // ✅ SEARCHABLE: State abbreviation
  ZipCode: string; // ✅ SEARCHABLE: Postal code
  Validated: boolean; // ✅ METADATA: Address validated
  AddressSummaryOneLine: string; // ✅ SEARCHABLE: Address summary
  MailingLabel: string; // ✅ SEARCHABLE: Mailing label
}

interface APIPackage {
  Name: string; // ✅ SEARCHABLE: Package name
  Length: number; // ✅ METADATA: Package length
  Width: number; // ✅ METADATA: Package width
  Height: number; // ✅ METADATA: Package height
  DimensionUnit: string; // ✅ METADATA: Dimension unit
  Weight: number; // ✅ METADATA: Package weight
  WeightUnit: string; // ✅ METADATA: Weight unit
  IsCustom: boolean; // ✅ METADATA: Custom package flag
}
```

---

## 💰 Pricing and Cost Data

### `APIJobLinesCostDetails` (from `get-joblines-cost-details`)

```typescript
interface APIJobLinesCostDetails {
  jobLinesSubTotal: number; // ✅ METADATA: Subtotal amount
  jobLinesTaxTotal: number; // ✅ METADATA: Tax amount
  jobLinesTotalCost: number; // ✅ METADATA: Total cost
}
```

---

## 📂 Product and Category Data

### `APICategoryUnit` (from `get-all-category-units`)

```typescript
interface APICategoryUnit {
  CategoryId: number; // ✅ METADATA: Category ID
  CategoryName: string; // ✅ SEARCHABLE: Category name
  Units: string[]; // ✅ SEARCHABLE: Available units
  Materials: string[]; // ✅ SEARCHABLE: Available materials
  Processes: string[]; // ✅ SEARCHABLE: Available processes
}
```

---

## 📋 History and Timeline Data

### `APIJobHistory` (from `get-job-history`)

```typescript
interface APIJobHistory {
  data: {
    MasterStatus: {
      // ✅ SEARCHABLE: Job status
      Id: number;
      Status: string;
    };
    StockStatus: {
      // ✅ SEARCHABLE: Stock status
      Id: number;
      Status: string;
    };
    Location: {
      // ✅ SEARCHABLE: Job location
      Id: number;
      Code: string;
      Name: string;
    };
    StatusFormat: string; // ✅ SEARCHABLE: Formatted status
    StatusLineHtml: string; // ✅ SEARCHABLE: HTML status
    StatusLineText: string; // ✅ SEARCHABLE: Text status
  };
}
```

---

## 🧾 Pricing Rules Data

### `APIPriceQuantityBands` (from `get-price-quantity-bands`)

```typescript
interface APIPriceQuantityBands {
  // Response structure varies based on category-unit-id, price-tier, and price-code
  // Typically includes pricing bands, setup costs, and quantity discounts
  bands?: Array<{
    minQuantity: number; // ✅ METADATA: Minimum quantity
    maxQuantity: number; // ✅ METADATA: Maximum quantity
    unitPrice: number; // ✅ METADATA: Price per unit
    setupCost: number; // ✅ METADATA: Setup cost
  }>;
  setupCost?: number; // ✅ METADATA: Base setup cost
  priceCode?: string; // ✅ METADATA: Price code
  categoryUnitId?: string; // ✅ METADATA: Category unit ID
}
```

---

## 🔄 Vector Database Population Strategy

### Search Text Generation Priority

**HIGH PRIORITY (Always include):**

- Job/Order numbers and customer names
- Descriptions and comments
- Line item details (materials, processes, quantities)
- Status information (urgent, running late, etc.)
- Shipping and delivery information
- Tags and metadata

**MEDIUM PRIORITY (Include when relevant):**

- Location and production details
- Process codes and materials
- Contact information
- Tracking and shipping details

**LOW PRIORITY (Metadata only):**

- System IDs and GUIDs
- Timestamps and dates (unless urgent)
- Price information (unless pricing-related query)
- Technical flags and indicators

### Example Search Text Generation

```typescript
function generateSearchText(
  job: APIJob,
  lines: APIJobLine[],
  shipments: APIJobShipment[]
): string {
  const parts = [];

  // Core identifiers
  parts.push(`Job ${job.JobNumber}`);
  if (job.OrderNumber !== job.JobNumber.toString()) {
    parts.push(`Order ${job.OrderNumber}`);
  }

  // Customer context
  parts.push(`Customer ${job.Client}`);

  // Main content
  if (job.Description) parts.push(job.Description);
  if (job.Comments) parts.push(job.Comments);

  // Line items (critical for material/process searches)
  lines.forEach((line) => {
    parts.push(line.Description);
    if (line.Comment) parts.push(line.Comment);
    if (line.Category) parts.push(line.Category);
    if (line.ProcessCodes?.length) parts.push(line.ProcessCodes.join(" "));
    if (line.Materials?.length) parts.push(line.Materials.join(" "));
  });

  // Status and urgency
  if (job.DaysToDueDate <= 3) parts.push("urgent rush priority");
  if (job.TimeSensitive) parts.push("time sensitive");
  if (job.MustDate) parts.push("must date");
  if (job.IsReprint) parts.push("reprint");

  // Tags
  job.JobTags?.forEach((tag) => {
    parts.push(tag.Tag);
    if (tag.WhoEnteredUsername) parts.push(`@${tag.WhoEnteredUsername}`);
  });

  // Shipping information
  shipments.forEach((shipment) => {
    if (shipment.Title) parts.push(shipment.Title);
    if (shipment.ShipmentNotes) parts.push(shipment.ShipmentNotes);
    if (shipment.ShipmentMethod?.label)
      parts.push(shipment.ShipmentMethod.label);
    if (shipment.Address?.Organisation)
      parts.push(shipment.Address.Organisation);
  });

  return parts.filter(Boolean).join(" ");
}
```

---

## 📊 Metadata Structure

```typescript
interface VectorMetadata {
  // Core identifiers
  jobNumber: number;
  orderNumber: string;
  customerCompany: string;
  customerId: number;

  // Status and timing
  status: string;
  dateEntered: string;
  dateDue: string;
  daysToDueDate: number;
  isUrgent: boolean;
  isTimeSensitive: boolean;

  // Content summary
  description: string;
  hasComments: boolean;
  hasLineItems: boolean;
  hasShipments: boolean;

  // System information
  dataSource: string;
  lastUpdated: string;
  vectorId: string;

  // Optional fields
  priority?: string;
  location?: string;
  deliveryMethod?: string;
  totalQuantity?: number;
  totalValue?: number;
}
```

---

## 🎯 Implementation Guidelines

1. **Comprehensive Coverage**: Include ALL searchable fields in the search text
2. **Priority-Based**: Focus on high-priority fields first
3. **Context Preservation**: Maintain relationships between related data
4. **Metadata Efficiency**: Store only essential metadata for filtering
5. **Incremental Updates**: Use change tracking for efficient updates
6. **Error Handling**: Gracefully handle missing or malformed data
7. **Performance**: Optimize for search speed and relevance

This comprehensive schema ensures your vector database will capture all the information users might search for while maintaining efficient storage and retrieval performance.

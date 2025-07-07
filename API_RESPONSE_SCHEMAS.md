# 📋 API Response Schemas for Vector Database Population

This document contains the complete schemas for all API response objects used in vector database population. This ensures consistent data mapping and helps identify all searchable fields.

## 🎯 Purpose

- **Vector Population**: Map API responses to searchable text and metadata
- **Data Consistency**: Ensure all fields are properly extracted
- **Search Optimization**: Identify which fields are most important for search
- **Type Safety**: Provide complete TypeScript interfaces

---

## 📦 Core Job/Order Data

### `APIJob` (from `get-job-list`)

```typescript
interface APIJob {
  // Core identifiers
  JobNumber: number; // ✅ SEARCHABLE: "Job 51132"
  OrderNumber: string; // ✅ SEARCHABLE: "Order ABC123"
  Client: string; // ✅ SEARCHABLE: "Customer Acme Corp"
  CustomerId: number; // ✅ METADATA: For filtering

  // Descriptions
  Description: string; // ✅ SEARCHABLE: Main job description
  Comments: string; // ✅ SEARCHABLE: Additional notes

  // Dates
  DateIn: string; // ✅ METADATA: When job was created
  DateInUtc: string; // ✅ METADATA: UTC creation date
  DateDue: string; // ✅ METADATA: Due date
  DateDueUtc: string; // ✅ METADATA: UTC due date
  DateDueFactory: string; // ✅ METADATA: Factory due date
  DaysToDueDate: number; // ✅ METADATA: Days until due

  // Status information
  MasterJobStatus: string; // ✅ SEARCHABLE: "Approved", "On Time"
  MasterJobStatusId: number; // ✅ METADATA: Status ID
  StockComplete: number; // ✅ METADATA: Stock completion level
  StockCompleteStatus: string; // ✅ SEARCHABLE: "Stock Complete"
  StatusLineHtml: string; // ✅ SEARCHABLE: Formatted status
  StatusLine: string; // ✅ SEARCHABLE: Plain status text

  // Delivery and location
  DeliveryOption: string; // ✅ SEARCHABLE: "2 Day Air"
  JobQuantity: number; // ✅ METADATA: Total quantity
  LocationCode: string; // ✅ SEARCHABLE: "FACTORY1"
  JobLocationCode: string; // ✅ SEARCHABLE: Job location
  JobLocationName: string; // ✅ SEARCHABLE: Location name

  // Priority flags
  MustDate: boolean; // ✅ SEARCHABLE: "must date required"
  TimeSensitive: boolean; // ✅ SEARCHABLE: "rush urgent priority"
  IsReprint: boolean; // ✅ SEARCHABLE: "reprint job"
  IsDupe: boolean; // ✅ SEARCHABLE: "duplicate job"

  // Process information
  ProcessQuantities: APIProcessQuantity[]; // ✅ SEARCHABLE: Process codes
  GangCodes: string[]; // ✅ SEARCHABLE: Gang printing codes

  // Workflow capabilities
  CanSuggestMachines: boolean; // ✅ METADATA: Machine suggestions
  CanPrintJobLineLabels: boolean; // ✅ METADATA: Label printing
  HasScheduleableJobLines: boolean; // ✅ METADATA: Scheduling

  // Tags and metadata
  JobTags: APIJobTag[]; // ✅ SEARCHABLE: User tags
  BitVal: number; // ✅ METADATA: Bit flags
  SortKey: string; // ✅ METADATA: Sort order
}
```

### `APIJobTag`

```typescript
interface APIJobTag {
  Tag: string; // ✅ SEARCHABLE: "@rush", "@urgent"
  // Additional tag metadata if available
}
```

### `APIProcessQuantity`

```typescript
interface APIProcessQuantity {
  Code: string; // ✅ SEARCHABLE: "EM13044"
  DisplayCode: string; // ✅ SEARCHABLE: "Embroidery"
  Qty: number; // ✅ METADATA: Process quantity
  SuggestedMachineId: number; // ✅ METADATA: Machine ID
  SuggestedMachineLabel: string; // ✅ SEARCHABLE: "Machine ABC"
  HasSuggestedMachine: boolean; // ✅ METADATA: Has machine suggestion
}
```

---

## 📋 Line Items Data

### `APIJobLine` (from `get-joblines`)

```typescript
interface APIJobLine {
  // Core identifiers
  LineId: number; // ✅ METADATA: Line item ID
  JobNumber: number; // ✅ METADATA: Associated job
  AssetSKU: string; // ✅ SEARCHABLE: "NA10513"

  // Product information
  Description: string; // ✅ SEARCHABLE: "SPACEX patches"
  Category: string; // ✅ SEARCHABLE: "Patches"
  Quantity: number; // ✅ METADATA: Order quantity
  UnitPrice: number; // ✅ METADATA: Price per unit
  TotalPrice: number; // ✅ METADATA: Line total

  // Additional details
  Comment: string; // ✅ SEARCHABLE: "Red thread, 2 inch"
  Status: string; // ✅ SEARCHABLE: "In Progress"
  ProcessCodes: string[]; // ✅ SEARCHABLE: ["EM", "ST"]
  Materials: string[]; // ✅ SEARCHABLE: ["Cotton", "Polyester"]

  // File attachments
  HasImage: boolean; // ✅ SEARCHABLE: "has image"
  HasPDF: boolean; // ✅ SEARCHABLE: "has pdf"
}
```

---

## 🚚 Shipment Data

### `APIJobShipment` (from `get-job-shipments`)

```typescript
interface APIJobShipment {
  // Core identifiers
  Id: number; // ✅ METADATA: Shipment ID
  Index: number; // ✅ METADATA: Shipment order
  Title: string; // ✅ SEARCHABLE: "Main shipment"

  // Shipping status
  Shipped: boolean; // ✅ SEARCHABLE: "shipped" / "not shipped"
  DateShipped: string | null; // ✅ METADATA: Ship date
  CanShip: boolean; // ✅ METADATA: Can be shipped
  Collected: boolean; // ✅ SEARCHABLE: "collected"
  CollectionDate: string | null; // ✅ METADATA: Collection date
  CanCollect: boolean; // ✅ METADATA: Can be collected

  // Address information
  Address: APIAddress; // ✅ SEARCHABLE: Full address details
  MailingLabel: string; // ✅ SEARCHABLE: Formatted address
  AddressSummaryOneLine: string; // ✅ SEARCHABLE: One-line address

  // Contact details
  ContactDetailsOneLine: string; // ✅ SEARCHABLE: Contact info

  // Shipping method
  ShipmentMethod: {
    label: string; // ✅ SEARCHABLE: "2 Day Air"
    value: string; // ✅ METADATA: Method code
    iscollection: boolean; // ✅ METADATA: Is collection
    rank: number; // ✅ METADATA: Priority rank
    deliveryLabelEnabled: boolean; // ✅ METADATA: Label enabled
  };

  // Tracking information
  TrackingDetails: APITrackingDetails | null; // ✅ SEARCHABLE: Tracking info
  ShipmentNotes: string; // ✅ SEARCHABLE: Special instructions

  // Package details
  ShipmentPackages: APIPackage[]; // ✅ METADATA: Package dimensions
}
```

### `APIAddress`

```typescript
interface APIAddress {
  // Contact information
  ContactName: string; // ✅ SEARCHABLE: "John Smith"
  Organisation: string; // ✅ SEARCHABLE: "Acme Corporation"
  Phone: string; // ✅ METADATA: Phone number
  Mobile: string; // ✅ METADATA: Mobile number
  EmailAddress: string; // ✅ METADATA: Email address

  // Address details
  StreetAddress: string; // ✅ SEARCHABLE: "123 Main St"
  AddressLine2: string; // ✅ SEARCHABLE: "Suite 100"
  City: string; // ✅ SEARCHABLE: "New York"
  District: string; // ✅ SEARCHABLE: "Manhattan"
  AdministrativeArea: string; // ✅ SEARCHABLE: "New York"
  AdministrativeAreaAbbreviation: string; // ✅ SEARCHABLE: "NY"
  ZipCode: string; // ✅ SEARCHABLE: "10001"

  // Country information
  CountryCodeISO2: string; // ✅ SEARCHABLE: "US"
  CountryName: string; // ✅ SEARCHABLE: "United States"

  // Validation
  Validated: boolean; // ✅ METADATA: Address validated
  AddressSummaryOneLine: string; // ✅ SEARCHABLE: Formatted address
  MailingLabel: string; // ✅ SEARCHABLE: Mailing label
}
```

### `APITrackingDetails`

```typescript
interface APITrackingDetails {
  Logo: string; // ✅ METADATA: Carrier logo
  LogoPath: string; // ✅ METADATA: Logo file path
  TrackingLink: string; // ✅ METADATA: Tracking URL
  TrackingLinkText: string; // ✅ SEARCHABLE: "Track Package"
  DeliveryStatus: string; // ✅ SEARCHABLE: "In Transit"
  InfoLine: string | null; // ✅ SEARCHABLE: Status details
  ShippedVia: string; // ✅ SEARCHABLE: "FedEx"
  Status: string; // ✅ SEARCHABLE: "Delivered"
  LastUpdate: string; // ✅ METADATA: Last status update
}
```

---

## 📁 File Attachments

### `APIJobFile` (from `get-job-files`)

```typescript
interface APIJobFile {
  // File information
  FileName: string; // ✅ SEARCHABLE: "design.ai"
  ContentType: string; // ✅ METADATA: "application/pdf"
  FileSizeBytes: number; // ✅ METADATA: File size
  FormattedFileSize: string; // ✅ METADATA: "2.5 MB"

  // File categorization
  FileType: string; // ✅ SEARCHABLE: "AI", "PDF"
  Category: string; // ✅ SEARCHABLE: "Design"
  Subcategory: string; // ✅ SEARCHABLE: "Vector"

  // File status
  FileStatus: string; // ✅ SEARCHABLE: "Approved"
  Uri: string; // ✅ METADATA: File URL

  // Metadata
  CreatedBy: APIUser; // ✅ SEARCHABLE: "John Smith"
  CreatedDate: string; // ✅ METADATA: Creation date
  LastUpdatedBy: APIUser; // ✅ SEARCHABLE: "Jane Doe"
  LastUpdate: string; // ✅ METADATA: Last update
}
```

### `APIUser`

```typescript
interface APIUser {
  FirstName: string; // ✅ SEARCHABLE: "John"
  LastName: string; // ✅ SEARCHABLE: "Smith"
  FullName: string; // ✅ SEARCHABLE: "John Smith"
  Initials: string; // ✅ SEARCHABLE: "JS"
}
```

---

## 🏷️ Product Categories

### `APICategoryUnit` (from `get-all-category-units`)

```typescript
interface APICategoryUnit {
  CategoryId: number; // ✅ METADATA: Category ID
  CategoryName: string; // ✅ SEARCHABLE: "Patches"
  Units: string[]; // ✅ SEARCHABLE: ["Pieces", "Dozen"]
  Materials: string[]; // ✅ SEARCHABLE: ["Cotton", "Polyester"]
  Processes: string[]; // ✅ SEARCHABLE: ["Embroidery", "Screen Print"]
}
```

---

## 💰 Cost Information

### Cost Details (from `get-joblines-cost-details`)

```typescript
interface JobCostDetails {
  jobLinesSubTotal: number; // ✅ METADATA: Subtotal
  jobLinesTaxTotal: number; // ✅ METADATA: Tax amount
  jobLinesTotalCost: number; // ✅ METADATA: Total cost
}
```

---

## 📦 Package Information

### `APIPackage`

```typescript
interface APIPackage {
  Name: string; // ✅ SEARCHABLE: "Package 1"
  Length: number; // ✅ METADATA: Length in cm
  Width: number; // ✅ METADATA: Width in cm
  Height: number; // ✅ METADATA: Height in cm
  DimensionUnit: string; // ✅ METADATA: "cm"
  Weight: number; // ✅ METADATA: Weight
  WeightUnit: string; // ✅ METADATA: "kg"
  IsCustom: boolean; // ✅ METADATA: Custom package
}
```

---

## 🎯 Vector Database Mapping Strategy

### Search Text Generation Priority

1. **High Priority** (Always include):

   - Job/Order numbers
   - Customer names
   - Descriptions and comments
   - Process codes and materials
   - Status information
   - Priority indicators

2. **Medium Priority** (Include when available):

   - Line item details
   - Shipping addresses
   - File names and types
   - Tags and labels

3. **Low Priority** (Include for completeness):
   - Technical metadata
   - System-generated fields
   - Internal codes

### Metadata Fields for Filtering

```typescript
interface VectorMetadata {
  // Core identifiers
  jobNumber: string;
  orderNumber: string;
  customerCompany: string;
  customerId?: number;

  // Status and priority
  status: string;
  priority?: string;
  timeSensitive?: boolean;

  // Financial
  totalDue?: number;

  // Dates
  dateEntered: string;
  dateDue?: string;

  // Content
  description: string;

  // Source tracking
  dataSource: "api" | "scraped" | "hybrid";
  lastUpdated: string;

  // Workflow flags
  hasFiles?: boolean;
  hasProof?: boolean;
  isRush?: boolean;
  isReprint?: boolean;

  // Location
  locationCode?: string;
  deliveryOption?: string;
}
```

---

## 🔍 Search Optimization Notes

### Keywords to Emphasize

- **Priority terms**: "rush", "urgent", "priority", "must date"
- **Status terms**: "approved", "on time", "running late", "problem"
- **Process terms**: "embroidery", "screen print", "heat transfer"
- **Material terms**: "cotton", "polyester", "thread", "fabric"
- **File terms**: "has files", "has proof", "design", "artwork"

### Field Combinations

- **Customer + Job**: "Acme Corp Job 51132"
- **Process + Material**: "Embroidery on cotton patches"
- **Status + Priority**: "Approved rush order"
- **Location + Delivery**: "Factory 1 2 Day Air"

This comprehensive schema ensures all searchable information is captured in your vector database while maintaining proper metadata for filtering and display.

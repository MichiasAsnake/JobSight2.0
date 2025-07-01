# Tier 1: Data Foundation & Enhanced Scraping

## Overview

This tier establishes the foundation for the OMS AI Query Site by creating a streamlined scraping pipeline that extracts order data and stores it in a structured format ready for AI consumption.

## What's Implemented

### 1. Streamlined Scraper (`scrape.js`)

- **Login System**: Handles authentication with credential storage
- **Job List Extraction**: Scrapes order summaries from the job list page
- **Data Transformation**: Converts scraped data to our target structure
- **Pagination Support**: Handles multiple pages of orders
- **Error Handling**: Robust error handling and recovery

### 2. Data Persistence (`lib/utils/dataPersistence.js`)

- **Save/Load Functions**: JSON-based data storage
- **Data Validation**: Validates order structure and data integrity
- **Summary Statistics**: Generates business intelligence summaries
- **Error Handling**: Comprehensive error handling for data operations

### 3. Management Scripts

- **`scripts/run-scraper.js`**: Main scraper runner with validation
- **`scripts/test-data-pipeline.js`**: Test script for data pipeline
- **NPM Scripts**: Easy-to-use commands for different operations

## Target Data Structure

The scraper outputs data in this comprehensive structure:

```javascript
{
  "jobNumber": "51182",
  "orderNumber": "A281298",
  "status": "Approved - Stock Complete",
  "priority": "MUST",

  "customer": {
    "company": "Logomark",
    "contactPerson": "", // PLACEHOLDER
    "phone": "", // PLACEHOLDER
    "email": "" // PLACEHOLDER
  },

  "description": "LOGO: (WA) - WESTERN ALLIANCE BANK...",
  "comment": "", // PLACEHOLDER

  "dateEntered": "2025-06-26T07:32:00-07:00",
  "requestedShipDate": "2025-06-30T00:00:00-07:00",

  "approvedBy": "", // PLACEHOLDER
  "approvedDate": "", // PLACEHOLDER

  "pricing": {
    "subtotal": 0.00, // PLACEHOLDER
    "salesTax": 0.00, // PLACEHOLDER
    "totalDue": 0.00, // PLACEHOLDER
    "currency": "USD"
  },

  "shipments": [...], // PLACEHOLDER
  "lineItems": [...], // PLACEHOLDER
  "workflow": {...}, // PLACEHOLDER
  "production": {...}, // PLACEHOLDER
  "metadata": {...}
}
```

## Current Status: PLACEHOLDER FIELDS

Many fields are currently placeholders that will be filled in during iteration:

### ✅ **Working Fields:**

- `jobNumber` - Extracted from job list
- `orderNumber` - Extracted from job list
- `status` - Extracted from job list
- `priority` - Determined from tags/status
- `customer.company` - Basic extraction (needs refinement)
- `description` - Cleaned and formatted
- `dateEntered` - Extracted and validated
- `requestedShipDate` - Extracted and validated
- `workflow.needsPanels` - Basic logic from tags
- `workflow.isRush` - Basic logic from priority
- `metadata.tags` - Extracted from process codes
- `metadata.lastUpdated` - Current timestamp

### 🔄 **Placeholder Fields (Next Iteration):**

- `customer.contactPerson` - Need to extract from job details
- `customer.phone` - Need to extract from job details
- `customer.email` - Need to extract from job details
- `approvedBy` - Need to extract from approval info
- `approvedDate` - Need to extract from approval info
- `pricing.*` - Need to extract from pricing section
- `shipments.*` - Need to extract from shipping info
- `lineItems.*` - Need to extract from job lines
- `workflow.hasJobFiles` - Need to check file attachments
- `workflow.hasProof` - Need to check proof status
- `production.*` - Need to extract from production info

## Usage

### Install Dependencies

```bash
npm install
```

### Run the Scraper

```bash
npm run scrape
```

### Validate Existing Data

```bash
npm run scrape:validate
```

### Show Data Summary

```bash
npm run scrape:summary
```

### Test Data Pipeline

```bash
npm run test:data
```

## File Structure

```
├── scrape.js                    # Main scraper (streamlined)
├── lib/
│   ├── data/
│   │   └── orders.json         # Data storage
│   └── utils/
│       └── dataPersistence.js  # Data management utilities
├── scripts/
│   ├── run-scraper.js          # Scraper runner
│   └── test-data-pipeline.js   # Data pipeline tests
└── data/                       # Generated data directory
    └── orders.json             # Scraped orders (generated)
```

## Next Steps (Tier 2)

1. **AI Integration**: Connect OpenAI API to the data
2. **Chat Interface**: Create OMS-specific chat UI
3. **Query Processing**: Handle natural language queries
4. **Enhanced Prompts**: Create domain-specific AI prompts

## Troubleshooting

### Common Issues

1. **Login Problems**: Check credentials in `.config/credentials.json`
2. **No Data**: Run `npm run scrape` to populate data
3. **Validation Errors**: Check the scraper output for field extraction issues
4. **Browser Issues**: Ensure Playwright is installed (`npm install playwright`)

### Debug Files

The scraper generates debug files:

- `debug_jobs_page.png` - Screenshot of job list
- `debug_jobs_page.html` - HTML of job list page

## Data Quality

The current implementation focuses on:

- **Reliability**: Robust error handling and recovery
- **Structure**: Consistent data format for AI consumption
- **Validation**: Data integrity checks
- **Extensibility**: Easy to add new fields in future iterations

---

**Status**: ✅ **Tier 1 Complete** - Ready for Tier 2 (AI Integration)

// Test script to verify pricing data is being used correctly
import { ConstraintSatisfactionService } from "./src/lib/constraint-satisfaction-service.ts";

// Mock order with pricing data
const mockOrder = {
  jobNumber: "51121",
  orderNumber: "TEST123",
  customer: {
    id: 123,
    company: "Test Company",
  },
  description: "Test Order",
  comments: "",
  jobQuantity: 100,
  status: {
    master: "Approved",
    masterStatusId: 5,
    stock: "Stock Complete",
    stockComplete: 2,
    statusLine: "Approved - Stock Complete",
    statusLineHtml: "<span>Approved</span>",
  },
  dates: {
    dateEntered: "2025-01-01T00:00:00Z",
    dateEnteredUtc: "2025-01-01T00:00:00Z",
    dateDue: "2025-01-07T00:00:00Z",
    dateDueUtc: "2025-01-07T00:00:00Z",
    dateDueFactory: "2025-01-07T00:00:00Z",
    daysToDueDate: 0,
  },
  location: {
    code: "DP",
    name: "Decopress",
    deliveryOption: "GND",
  },
  production: {
    processes: [],
    gangCodes: [],
    timeSensitive: false,
    mustDate: false,
    isReprint: false,
    isDupe: false,
    canSuggestMachines: false,
    canPrintJobLineLabels: false,
    hasScheduleableJobLines: false,
  },
  lineItems: [], // Empty line items
  shipments: [],
  files: [],
  tags: [],
  workflow: {
    hasScheduleableJobLines: false,
    canPrintJobLineLabels: false,
    hasJobFiles: false,
    hasProof: false,
  },
  pricing: {
    total: 5224.1,
    totalFormatted: "$5,224.10",
    subtotal: 5224.1,
    subtotalFormatted: "$5,224.10",
  },
  metadata: {
    lastAPIUpdate: "2025-01-06T00:00:00Z",
    dataSource: "api",
    dataFreshness: "fresh",
    bitVal: 0,
    sortKey: "51121",
  },
};

// Test the constraint satisfaction service
async function testPricingFix() {
  console.log("🧪 Testing pricing data fix...");

  const constraintService = new ConstraintSatisfactionService();

  // Test with a query that should use pricing data
  const query = "show me orders due this week that add up to 10k in value";

  try {
    const result = await constraintService.processConstraintQuery(
      [mockOrder],
      [],
      10000
    );

    console.log("✅ Constraint satisfaction result:");
    console.log(`- Total value: $${result.totalValue}`);
    console.log(`- Orders found: ${result.orderCount}`);
    console.log(`- Constraint met: ${result.constraintMet}`);
    console.log(`- Summary: ${result.summary}`);

    if (result.totalValue === 5224.1) {
      console.log("✅ SUCCESS: Pricing data is being used correctly!");
    } else {
      console.log("❌ FAILURE: Pricing data is not being used correctly");
      console.log(`Expected: $5224.10, Got: $${result.totalValue}`);
    }
  } catch (error) {
    console.error("❌ Error testing constraint satisfaction:", error);
  }
}

testPricingFix();

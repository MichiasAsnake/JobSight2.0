#!/usr/bin/env node

/**
 * Debug script to test tag matching with sample data
 * This will help identify why tags aren't matching
 */

import { EnhancedFilteringService } from "../src/lib/enhanced-filtering-service.js";

// Sample order data structure
const sampleOrder = {
  jobNumber: "51162",
  customer: {
    company: "Canary LLC",
  },
  description: "Test Order",
  dates: {
    dateDue: "2025-07-09T00:00:00+00:00",
  },
  tags: [
    { tag: "@zairap" },
    { tag: "urgent" },
    { tag: "production" },
    { tag: "shay" },
  ],
};

// Test different tag matching scenarios
function testTagMatching() {
  console.log("🧪 Testing Tag Matching Logic\n");

  const filteringService = new EnhancedFilteringService();

  const testCases = [
    { searchTag: "@zairap", expectedMatch: true },
    { searchTag: "zairap", expectedMatch: true },
    { searchTag: "shay", expectedMatch: true },
    { searchTag: "urgent", expectedMatch: true },
    { searchTag: "production", expectedMatch: true },
    { searchTag: "nonexistent", expectedMatch: false },
    { searchTag: "@shay", expectedMatch: true },
    { searchTag: "zaira", expectedMatch: true }, // Should match @zairap
  ];

  console.log(
    `📋 Sample order tags: ${sampleOrder.tags.map((t) => t.tag).join(", ")}\n`
  );

  testCases.forEach((testCase, index) => {
    console.log(`\n${index + 1}. Testing tag: "${testCase.searchTag}"`);

    // Use the private method through reflection or create a public test method
    // For now, let's simulate the logic
    const tagLower = testCase.searchTag.toLowerCase().trim();
    const tagVariations = [
      tagLower,
      tagLower.startsWith("@") ? tagLower.substring(1) : `@${tagLower}`,
      tagLower.replace(/[^a-zA-Z0-9]/g, ""),
      tagLower.replace(/\s+/g, "-"),
      tagLower.replace(/\s+/g, ""),
    ];

    console.log(`   Variations: ${tagVariations.join(", ")}`);

    let matched = false;
    sampleOrder.tags.forEach((orderTag) => {
      const orderTagLower = orderTag.tag.toLowerCase().trim();

      // Exact match
      if (orderTagLower === tagLower) {
        console.log(`   ✅ Exact match with "${orderTag.tag}"`);
        matched = true;
      }

      // Variation match
      if (tagVariations.some((variation) => orderTagLower === variation)) {
        console.log(`   ✅ Variation match with "${orderTag.tag}"`);
        matched = true;
      }

      // Substring match
      if (
        orderTagLower.includes(tagLower) ||
        tagLower.includes(orderTagLower)
      ) {
        console.log(`   ✅ Substring match with "${orderTag.tag}"`);
        matched = true;
      }
    });

    if (!matched) {
      console.log(`   ❌ No match found`);
    }

    const result = matched ? "PASS" : "FAIL";
    const expected = testCase.expectedMatch ? "PASS" : "FAIL";
    console.log(`   Result: ${result} (Expected: ${expected})`);
  });
}

// Test with real data structure
function testWithRealData() {
  console.log("\n\n🔍 Testing with Real Data Structure\n");

  // This would be the actual order structure from your API
  const realOrder = {
    jobNumber: "51162",
    customer: {
      id: 270,
      company: "Canary LLC",
    },
    description: "PINTEREST ACT AS ONE NOPODS",
    comments: "",
    jobQuantity: 49,
    status: {
      master: "Approved",
      masterStatusId: 5,
      stock: "Stock Complete",
      stockComplete: 2,
      statusLine: "Approved - Stock Complete",
    },
    dates: {
      dateEntered: "2025-06-10T04:45:06.7384436+00:00",
      dateDue: "2025-07-09T00:00:00+00:00",
      daysToDueDate: 3,
    },
    tags: [
      {
        tag: "@zairap pls schedule",
        enteredBy: "tammy",
        dateEntered: "2025-07-02T17:53:50.347+00:00",
      },
      {
        tag: "urgent",
        enteredBy: "system",
        dateEntered: "2025-07-01T10:00:00+00:00",
      },
    ],
  };

  console.log(
    `📋 Real order tags: ${realOrder.tags.map((t) => t.tag).join(", ")}\n`
  );

  const testTags = ["@zairap", "zairap", "urgent", "shay"];

  testTags.forEach((searchTag) => {
    console.log(`\n🔍 Testing: "${searchTag}"`);

    const tagLower = searchTag.toLowerCase().trim();
    let matched = false;

    realOrder.tags.forEach((orderTag) => {
      const orderTagLower = orderTag.tag.toLowerCase().trim();

      if (
        orderTagLower.includes(tagLower) ||
        tagLower.includes(orderTagLower)
      ) {
        console.log(`   ✅ Matches "${orderTag.tag}"`);
        matched = true;
      }
    });

    if (!matched) {
      console.log(`   ❌ No match found`);
    }
  });
}

// Test using the actual EnhancedFilteringService
async function testWithActualService() {
  console.log("\n\n🔧 Testing with Actual EnhancedFilteringService\n");

  try {
    const filteringService = new EnhancedFilteringService();

    // Test with the real order structure
    const realOrder = {
      jobNumber: "51162",
      customer: {
        id: 270,
        company: "Canary LLC",
      },
      description: "PINTEREST ACT AS ONE NOPODS",
      comments: "",
      jobQuantity: 49,
      status: {
        master: "Approved",
        masterStatusId: 5,
        stock: "Stock Complete",
        stockComplete: 2,
        statusLine: "Approved - Stock Complete",
      },
      dates: {
        dateEntered: "2025-06-10T04:45:06.7384436+00:00",
        dateDue: "2025-07-09T00:00:00+00:00",
        daysToDueDate: 3,
      },
      tags: [
        {
          tag: "@zairap pls schedule",
          enteredBy: "tammy",
          dateEntered: "2025-07-02T17:53:50.347+00:00",
        },
        {
          tag: "urgent",
          enteredBy: "system",
          dateEntered: "2025-07-01T10:00:00+00:00",
        },
      ],
    };

    console.log(
      `📋 Order tags: ${filteringService.getOrderTags(realOrder).join(", ")}\n`
    );

    const testTags = ["@zairap", "zairap", "urgent", "shay"];

    testTags.forEach((searchTag) => {
      const matches = filteringService.testTagMatch(realOrder, searchTag);
      console.log(`🔍 "${searchTag}" matches: ${matches ? "✅ YES" : "❌ NO"}`);
    });
  } catch (error) {
    console.error("❌ Error testing with actual service:", error.message);
    console.log(
      "💡 This might be due to TypeScript compilation. Try running with tsx:"
    );
    console.log("   npm install -D tsx");
    console.log("   npx tsx scripts/debug-tag-matching.js");
  }
}

// Run the tests
testTagMatching();
testWithRealData();
testWithActualService();

console.log("\n\n💡 Debugging Tips:");
console.log(
  "1. Check if the tags in your data match exactly what you're searching for"
);
console.log("2. Look for case sensitivity issues");
console.log("3. Check for extra spaces or special characters");
console.log("4. Verify the tag structure in your order data");
console.log(
  "5. Run this script with your actual order data to see what tags exist"
);
console.log("\n🔧 If you get import errors, try:");
console.log("   npx tsx scripts/debug-tag-matching.js");

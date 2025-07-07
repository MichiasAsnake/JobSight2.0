const {
  transformAPILineItemToLineItem,
  transformLineItemsArray,
} = require("./src/components/order-display.tsx");

// Test data from the logs
const testOrder = {
  jobNumber: "51143",
  jobQuantity: 40,
  production: {
    processes: [
      {
        code: "AP",
        displayCode: "AP",
        quantity: 40,
      },
    ],
  },
  tags: [{ tag: "gamma - emb patch" }, { tag: "emb patches ordered" }],
};

const testLineItems = [
  {
    description: "Pebble Pricks - Black/White",
    quantity: 0,
    unitPrice: 6.36,
    hasImage: true,
  },
  {
    description: "Setup for AP12626",
    quantity: 0,
    unitPrice: 0,
    hasImage: false,
  },
];

console.log("Testing enhanced line item transformation...");

// Test individual line item transformation
testLineItems.forEach((lineItem, index) => {
  const transformed = transformAPILineItemToLineItem(lineItem, testOrder);
  console.log(`\nLine Item ${index + 1}:`);
  console.log(`  Description: ${transformed.description}`);
  console.log(`  Quantity: ${transformed.quantity}`);
  console.log(`  Unit Price: ${transformed.unitPrice}`);
  console.log(`  Materials: ${transformed.materials.join(", ")}`);
});

// Test array transformation
console.log("\n\nTesting array transformation...");
const transformedArray = transformLineItemsArray(testLineItems, testOrder);
console.log(`Transformed ${transformedArray.length} line items`);
transformedArray.forEach((item, index) => {
  console.log(
    `  ${index + 1}. ${item.description} - Qty: ${
      item.quantity
    }, Materials: ${item.materials.join(", ")}`
  );
});

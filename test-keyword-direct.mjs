// Test keyword detection service directly
import { keywordDetectionService } from "./src/lib/keyword-detection-service.ts";

console.log("🔧 Testing Keyword Detection Service");
console.log("====================================\n");

const testQueries = [
  "show me laser jobs",
  "laser",
  "etching work",
  "embroidery orders",
];

for (const query of testQueries) {
  console.log(`📝 Query: "${query}"`);

  try {
    const result = keywordDetectionService.detectKeywords(query);

    if (result.hasKeywords) {
      const bestMatch = result.matches[0];
      const textFilter = keywordDetectionService.getBestTextFilter(
        result.matches
      );
      console.log(
        `✅ Keyword: ${
          bestMatch.keyword
        } (confidence: ${bestMatch.confidence.toFixed(2)})`
      );
      console.log(`🏷️ Text-filter: "${textFilter}"`);
      console.log(`🎯 Strategy: ${result.suggestedStrategy}`);
    } else {
      console.log("❌ No keywords detected");
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }

  console.log("");
}

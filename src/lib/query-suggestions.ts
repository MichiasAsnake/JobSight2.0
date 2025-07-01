// Simplified Smart Query Suggestions - Only for queries we can actually fulfill
export const QUERY_SUGGESTIONS = {
  // Only show when user types 4+ characters
  searchPatterns: [
    // Job number patterns
    {
      pattern: /job\s*(\d*)/i,
      suggestions: ["Job 51094 status", "Job 51081 details"],
    },

    // Customer patterns
    {
      pattern: /customer|client/i,
      suggestions: ["Orders for Jackalope", "Top customers by revenue"],
    },

    // Date patterns
    {
      pattern: /due|today|tomorrow/i,
      suggestions: ["Due today", "Overdue orders"],
    },

    // Financial patterns
    {
      pattern: /revenue|total|money/i,
      suggestions: ["Total revenue", "Top customers by revenue"],
    },

    // Status patterns
    {
      pattern: /rush|urgent|late/i,
      suggestions: ["Rush orders", "Overdue orders"],
    },
  ],
};

export const QUICK_ACTIONS = [
  "Due today",
  "Top customers",
  "Rush orders",
  "Recent orders",
];

export const CATEGORY_CONFIG = {
  financial: { color: "text-green-600", icon: "💰" },
  operational: { color: "text-blue-600", icon: "⚙️" },
  customer: { color: "text-purple-600", icon: "👥" },
  date: { color: "text-orange-600", icon: "📅" },
};

// Filter suggestions based on user input
export function filterSuggestions(input: string): string[] {
  if (!input || input.length < 4) return []; // Only show for 4+ characters

  const normalizedInput = input.toLowerCase();
  const suggestions: string[] = [];

  // Check each pattern and add relevant suggestions
  QUERY_SUGGESTIONS.searchPatterns.forEach(
    ({ pattern, suggestions: patternSuggestions }) => {
      if (pattern.test(normalizedInput)) {
        suggestions.push(...patternSuggestions);
      }
    }
  );

  // Remove duplicates and limit to 3 suggestions
  const uniqueSuggestions = [...new Set(suggestions)];
  return uniqueSuggestions.slice(0, 3);
}

// Only suggest patterns we can actually search for in our data
export const PATTERN_SUGGESTIONS = [
  { pattern: /job\s*(\d+)/i, example: "job 51094" },
  { pattern: /customer\s+(\w+)/i, example: "customer Jackalope" },
  { pattern: /due\s+(today|tomorrow|this week)/i, example: "due today" },
  { pattern: /orders\s+for\s+(\w+)/i, example: "orders for Jackalope" },
];

// Popular/example queries for different contexts
export const POPULAR_QUERIES = [
  "What orders are due today?",
  "Show me rush orders",
  "Revenue this month",
  "Customer ABC Company orders",
  "Job 12345 status",
  "Overdue orders",
];

// Help text suggestions
export const HELP_EXAMPLES = [
  'Try: "orders due today", "revenue this month", or "job 12345"',
  "Ask about: orders, customers, revenue, deadlines, or job status",
  'Examples: "rush orders", "customer payments", "production status"',
];

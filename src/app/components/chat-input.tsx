"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Lightbulb,
  Search,
  TrendingUp,
  Users,
  Calendar,
} from "lucide-react";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

// Smart Query Suggestions Database
const QUERY_SUGGESTIONS = {
  common: [
    "What orders are due today?",
    "Show me rush orders",
    "What's our revenue this month?",
    "List recent orders",
    "Show orders for [customer name]",
    "What's the status of job [number]?",
    "Which orders are overdue?",
    "Show me orders due tomorrow",
  ],
  financial: [
    "What's our total revenue this month?",
    "Show high-value orders over $1000",
    "Revenue breakdown by customer",
    "Compare this month vs last month",
    "Which customers have the highest orders?",
    "Show unpaid orders",
    "What's our average order value?",
  ],
  operational: [
    "Show rush/priority orders",
    "What orders are overdue?",
    "Orders due in the next 3 days",
    "Show orders in production",
    "Which orders need approval?",
    "Orders waiting for proofs",
    "Show shipping status",
  ],
  customer: [
    "Show orders for [customer name]",
    "List all customers",
    "Customer order history",
    "New customer orders this month",
    "Which customers have rush orders?",
    "Customer contact information",
  ],
  date: [
    "Orders due today",
    "Orders due tomorrow",
    "Orders due this week",
    "Overdue orders",
    "Orders entered today",
    "Orders from last week",
  ],
};

// Dynamic pattern suggestions based on input
const PATTERN_SUGGESTIONS = [
  { pattern: /job\s*(\d*)/i, suggestion: "job [number]", example: "job 12345" },
  {
    pattern: /order\s*(\d*)/i,
    suggestion: "order [number]",
    example: "order 12345",
  },
  {
    pattern: /customer\s*/i,
    suggestion: "customer [name]",
    example: "customer ABC Company",
  },
  {
    pattern: /revenue\s*/i,
    suggestion: "revenue [period]",
    example: "revenue this month",
  },
  { pattern: /due\s*/i, suggestion: "due [timeframe]", example: "due today" },
  {
    pattern: /orders\s*for\s*/i,
    suggestion: "orders for [customer]",
    example: "orders for ABC Company",
  },
];

export function ChatInput({
  onSendMessage,
  isLoading = false,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [suggestionCategory, setSuggestionCategory] = useState("common");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [message]);

  // Filter suggestions based on input
  useEffect(() => {
    if (message.trim().length === 0) {
      setFilteredSuggestions(QUERY_SUGGESTIONS.common);
      setSuggestionCategory("common");
      setShowSuggestions(false);
      return;
    }

    if (message.trim().length < 2) {
      setShowSuggestions(false);
      return;
    }

    const input = message.toLowerCase().trim();
    let suggestions: string[] = [];
    let category = "common";

    // Determine category based on keywords
    if (
      input.includes("revenue") ||
      input.includes("money") ||
      input.includes("total") ||
      input.includes("financial")
    ) {
      suggestions = QUERY_SUGGESTIONS.financial;
      category = "financial";
    } else if (
      input.includes("rush") ||
      input.includes("urgent") ||
      input.includes("overdue") ||
      input.includes("production")
    ) {
      suggestions = QUERY_SUGGESTIONS.operational;
      category = "operational";
    } else if (
      input.includes("customer") ||
      input.includes("client") ||
      input.includes("company")
    ) {
      suggestions = QUERY_SUGGESTIONS.customer;
      category = "customer";
    } else if (
      input.includes("due") ||
      input.includes("today") ||
      input.includes("tomorrow") ||
      input.includes("week")
    ) {
      suggestions = QUERY_SUGGESTIONS.date;
      category = "date";
    } else {
      // Get all suggestions and filter by relevance
      suggestions = [
        ...QUERY_SUGGESTIONS.common,
        ...QUERY_SUGGESTIONS.financial,
        ...QUERY_SUGGESTIONS.operational,
        ...QUERY_SUGGESTIONS.customer,
        ...QUERY_SUGGESTIONS.date,
      ];
    }

    // Filter suggestions that match the input
    const filtered = suggestions.filter(
      (suggestion) =>
        suggestion.toLowerCase().includes(input) ||
        input
          .split(" ")
          .some(
            (word) => word.length > 2 && suggestion.toLowerCase().includes(word)
          )
    );

    // Add pattern-based suggestions
    PATTERN_SUGGESTIONS.forEach(({ pattern, suggestion, example }) => {
      if (pattern.test(input)) {
        filtered.unshift(example);
      }
    });

    // Remove duplicates and limit results
    const uniqueSuggestions = Array.from(new Set(filtered)).slice(0, 6);

    setFilteredSuggestions(uniqueSuggestions);
    setSuggestionCategory(category);
    setShowSuggestions(uniqueSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  }, [message]);

  const handleSend = () => {
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && selectedSuggestionIndex >= 0) {
        selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
      } else {
        handleSend();
      }
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : -1));
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
        }
      }
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    textareaRef.current?.focus();
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "financial":
        return <TrendingUp className="w-4 h-4" />;
      case "operational":
        return <Search className="w-4 h-4" />;
      case "customer":
        return <Users className="w-4 h-4" />;
      case "date":
        return <Calendar className="w-4 h-4" />;
      default:
        return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "financial":
        return "text-green-600 bg-green-50 border-green-200";
      case "operational":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "customer":
        return "text-purple-600 bg-purple-50 border-purple-200";
      case "date":
        return "text-orange-600 bg-orange-50 border-orange-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getQuickActions = () => {
    return [
      { text: "Due today", icon: "📅" },
      { text: "Rush orders", icon: "⚡" },
      { text: "Revenue", icon: "💰" },
      { text: "Recent orders", icon: "📋" },
    ];
  };

  return (
    <div className="relative">
      {/* Quick Actions */}
      {!message && !showSuggestions && (
        <div className="mb-2 flex flex-wrap gap-2">
          {getQuickActions().map((action, index) => (
            <button
              key={index}
              onClick={() => setMessage(action.text)}
              className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              <span>{action.icon}</span>
              <span>{action.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Suggestions Dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          <div
            className={`px-3 py-2 border-b text-xs font-medium flex items-center gap-2 ${getCategoryColor(
              suggestionCategory
            )}`}
          >
            {getCategoryIcon(suggestionCategory)}
            <span className="capitalize">{suggestionCategory} Suggestions</span>
          </div>
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => selectSuggestion(suggestion)}
              className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                selectedSuggestionIndex === index
                  ? "bg-blue-50 border-l-4 border-l-blue-500"
                  : ""
              }`}
            >
              <div className="text-sm text-gray-900">{suggestion}</div>
            </button>
          ))}
          <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50">
            Use ↑↓ arrows to navigate, Enter to select, Esc to close
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex items-end gap-2 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (message.trim().length >= 2) {
                setShowSuggestions(true);
              }
            }}
            placeholder="Ask about orders, customers, revenue, or any OMS data..."
            className="min-h-[44px] max-h-32 resize-none border-0 focus:ring-0 p-0 placeholder:text-gray-400"
            disabled={disabled || isLoading}
            rows={1}
          />

          {/* Input Helper Text */}
          {message.length === 0 && (
            <div className="absolute top-full left-0 mt-1 text-xs text-gray-400">
              Try: "orders due today", "revenue this month", or "job 12345"
            </div>
          )}
        </div>

        <Button
          onClick={handleSend}
          disabled={disabled || isLoading || !message.trim()}
          size="sm"
          className="shrink-0"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Suggestion Examples */}
      {message.length === 0 && (
        <div className="mt-2 text-xs text-gray-500">
          <strong>Popular queries:</strong> "What orders are due today?" • "Show
          me rush orders" • "Revenue this month"
        </div>
      )}
    </div>
  );
}

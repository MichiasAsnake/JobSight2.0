"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import {
  filterSuggestions,
  QUICK_ACTIONS,
  CATEGORY_CONFIG,
} from "@/lib/query-suggestions";

interface OMSChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
}

export default function OMSChatInput({
  onSendMessage,
  disabled,
}: OMSChatInputProps) {
  const [message, setMessage] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionCategory, setSuggestionCategory] =
    useState<string>("common");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Update suggestions based on input - only show for meaningful input
  useEffect(() => {
    // Only show suggestions if user has typed 4+ characters
    if (message.trim().length >= 4) {
      const newSuggestions = filterSuggestions(message);
      setSuggestions(newSuggestions || []);
      setSuggestionCategory("common");
      setShowSuggestions(newSuggestions && newSuggestions.length > 0);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
      setSuggestions([]);
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        } else {
          handleSend();
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      case "Tab":
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex]);
        }
        break;
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setMessage(suggestion);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage("");
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        120
      )}px`;
    }
  }, [message]);

  return (
    <div className="relative w-6/12 mx-auto mb-5">
      <div className="flex gap-3 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about orders, jobs, or shipments... e.g., 'Show overdue jobs' or 'What's due this week?'"
            disabled={disabled}
            className="w-full min-h-[120px] max-h-[120px] rounded-lg resize-none pr-12 text-base leading-relaxed"
            autoComplete="off"
            aria-label="Order management system chat input"
            aria-describedby="chat-input-help"
            role="textbox"
            aria-multiline="true"
            aria-expanded={showSuggestions}
            aria-haspopup="listbox"
            aria-controls="chat-suggestions"
            aria-activedescendant={
              selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined
            }
          />

          <div id="chat-input-help" className="sr-only">
            Type your question about orders, jobs, or shipments. Press Enter to
            send, Shift+Enter for new line.
          </div>

          {/* Quick Actions - only show when input is empty */}
          {message.trim().length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-w-md">
              <div className="p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Quick Actions
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_ACTIONS.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setMessage(action);
                        inputRef.current?.focus();
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
                      aria-label={`Use quick action: ${action}`}
                    >
                      <span>💬</span>
                      <span>{action}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Smart Suggestions Dropdown - only for 4+ character input */}
          {showSuggestions &&
            suggestions.length > 0 &&
            message.trim().length >= 4 && (
              <div
                ref={suggestionsRef}
                id="chat-suggestions"
                role="listbox"
                aria-label="Query suggestions"
                className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-60 overflow-y-auto"
                style={{ zIndex: 9999 }}
              >
                {/* Category header */}
                <div
                  className={`px-3 py-2 text-xs font-medium border-b ${
                    CATEGORY_CONFIG[
                      suggestionCategory as keyof typeof CATEGORY_CONFIG
                    ]?.color || "text-gray-600 bg-gray-50"
                  }`}
                >
                  {suggestionCategory.charAt(0).toUpperCase() +
                    suggestionCategory.slice(1)}{" "}
                  Queries
                </div>

                {/* Suggestions */}
                {suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    id={`suggestion-${index}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => selectSuggestion(suggestion)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                      index === selectedIndex
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}

                {/* Footer hint */}
                <div className="px-3 py-2 text-xs text-gray-400 border-t bg-gray-50">
                  Use ↑↓ to navigate, Enter to select, Esc to close
                </div>
              </div>
            )}
        </div>

        <Button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          size="icon"
          className="h-12 w-12 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

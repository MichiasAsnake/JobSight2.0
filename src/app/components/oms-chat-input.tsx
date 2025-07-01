"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send,
  Search,
  TrendingUp,
  Clock,
  AlertTriangle,
  Users,
  FileText,
} from "lucide-react";

interface OMSChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

const quickActions = [
  {
    label: "Order Status",
    icon: Search,
    prompt: "Show me recent orders and their status",
    description: "Get overview of order statuses",
  },
  {
    label: "Rush Orders",
    icon: AlertTriangle,
    prompt: "Show me all rush and priority orders",
    description: "Find urgent orders",
  },
  {
    label: "Customer Info",
    icon: Users,
    prompt: "Show me customer information and order history",
    description: "Get customer details",
  },
  {
    label: "Statistics",
    icon: TrendingUp,
    prompt: "Give me an overview of order statistics",
    description: "View order analytics",
  },
  {
    label: "Late Orders",
    icon: Clock,
    prompt: "Show me orders that are past their ship date",
    description: "Find overdue orders",
  },
  {
    label: "Order Details",
    icon: FileText,
    prompt: "Tell me about job 51094",
    description: "Get specific order info",
  },
];

export function OMSChatInput({
  onSendMessage,
  isLoading = false,
}: OMSChatInputProps) {
  const [message, setMessage] = useState("");
  const [showQuickActions, setShowQuickActions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleQuickAction = (prompt: string) => {
    onSendMessage(prompt);
    setShowQuickActions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  return (
    <div className="border-t bg-background p-4">
      {/* Quick Actions */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowQuickActions(!showQuickActions)}
          className="mb-2"
        >
          Quick Actions
        </Button>

        {showQuickActions && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.prompt)}
                className="h-auto p-3 flex flex-col items-start gap-1 text-left"
                disabled={isLoading}
              >
                <div className="flex items-center gap-2 w-full">
                  <action.icon className="h-4 w-4" />
                  <span className="font-medium">{action.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {action.description}
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about orders, customers, or get OMS insights..."
            className="min-h-[60px] max-h-[120px] resize-none pr-12"
            disabled={isLoading}
          />
          <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">
            {message.length}/1000
          </div>
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || isLoading}
          className="h-[60px] w-[60px]"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {/* Help Text */}
      <div className="mt-2 text-xs text-muted-foreground">
        💡 Try: "Show me job 51094", "Find rush orders", "Customer Jackalope",
        or "Order statistics"
      </div>
    </div>
  );
}

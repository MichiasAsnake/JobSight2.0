"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChevronDown,
  ChevronRight,
  User,
  DollarSign,
  Package,
  FileText,
  AlertTriangle,
  TrendingUp,
  Phone,
  Mail,
  Calendar,
  Building,
  ExternalLink,
} from "lucide-react";

interface MessageContext {
  lastQuery?: string;
  shownOrders?: string[];
  focusedCustomer?: string;
  focusedJob?: string;
}

interface MessageProps {
  content: string;
  isUser: boolean;
  timestamp: string;
  context?: MessageContext;
}

interface ParsedItem {
  type: string;
  content?: string;
  key?: string;
  value?: string;
}

interface ParsedSection {
  type: string;
  title: string;
  items: ParsedItem[];
}

export function OMSMessage({
  content,
  isUser,
  timestamp,
  context,
}: MessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRawContent, setShowRawContent] = useState(false);

  const safeContent = content || "";

  const formatTimestamp = (timestamp: string) => {
    try {
      if (!timestamp)
        return new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
      }
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  };

  // Enhanced markdown parsing
  const parseContent = (content: string): ParsedSection[] => {
    const lines = content.split("\n");
    const parsed: ParsedSection[] = [];
    let currentSection = null;
    let currentItems: ParsedItem[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("## ")) {
        // New section
        if (currentSection) {
          parsed.push({
            type: "section",
            title: currentSection,
            items: currentItems,
          });
          currentItems = [];
        }
        currentSection = line
          .replace("## ", "")
          .replace(/^[📊📋⚠️🚨💡✅🔍🏢🏆💰]+\s*/, "");
      } else if (line.startsWith("### ")) {
        // Subsection
        const subsection = line.replace("### ", "");
        currentItems.push({ type: "subsection", content: subsection });
      } else if (line.startsWith("**") && line.endsWith("**")) {
        // Bold headers
        const header = line.replace(/\*\*/g, "");
        currentItems.push({ type: "header", content: header });
      } else if (line.startsWith("• ") || line.startsWith("- ")) {
        // List items
        currentItems.push({ type: "list", content: line.substring(2) });
      } else if (line.match(/^\d+\.\s/)) {
        // Numbered items
        currentItems.push({ type: "numbered", content: line });
      } else if (
        line.includes(":") &&
        !line.includes("//") &&
        !line.includes("http")
      ) {
        // Key-value pairs
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();
        currentItems.push({ type: "keyvalue", key: key.trim(), value });
      } else if (line.includes("💡")) {
        // Tip/suggestion
        currentItems.push({
          type: "tip",
          content: line.replace("💡", "").trim(),
        });
      } else if (line.trim()) {
        // Regular text
        currentItems.push({ type: "text", content: line });
      }
    }

    if (currentSection) {
      parsed.push({
        type: "section",
        title: currentSection,
        items: currentItems,
      });
    } else if (currentItems.length > 0) {
      parsed.push({ type: "section", title: "Details", items: currentItems });
    }

    return parsed;
  };

  const renderParsedContent = (sections: ParsedSection[]) => {
    return sections.map((section, sectionIndex) => (
      <div key={sectionIndex} className="mb-4">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          {section.title.includes("Due Today") && (
            <Calendar className="h-4 w-4 text-blue-500" />
          )}
          {section.title.includes("Overdue") && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          {section.title.includes("Customer") && (
            <Building className="h-4 w-4 text-green-500" />
          )}
          {section.title.includes("Overview") && (
            <TrendingUp className="h-4 w-4 text-purple-500" />
          )}
          {section.title.includes("Revenue") && (
            <DollarSign className="h-4 w-4 text-green-600" />
          )}
          {section.title.includes("Job") && (
            <FileText className="h-4 w-4 text-blue-600" />
          )}
          {section.title.includes("Contact") && (
            <Phone className="h-4 w-4 text-blue-500" />
          )}
          {section.title.includes("Top Customers") && (
            <TrendingUp className="h-4 w-4 text-purple-500" />
          )}
          {section.title}
        </h3>

        <div className="space-y-2">
          {section.items.map((item: ParsedItem, itemIndex: number) => {
            switch (item.type) {
              case "subsection":
                return (
                  <h4
                    key={itemIndex}
                    className="font-medium text-md mt-4 mb-2 text-blue-700"
                  >
                    {item.content}
                  </h4>
                );
              case "header":
                return (
                  <h4 key={itemIndex} className="font-medium text-md mt-3 mb-1">
                    {item.content}
                  </h4>
                );
              case "list":
                return (
                  <div key={itemIndex} className="flex items-start gap-2 ml-4">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm">{item.content}</span>
                  </div>
                );
              case "numbered":
                return (
                  <div key={itemIndex} className="ml-4 text-sm">
                    {item.content}
                  </div>
                );
              case "keyvalue":
                return (
                  <div
                    key={itemIndex}
                    className="flex justify-between items-center py-1 border-b border-gray-100"
                  >
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      {item.key?.includes("Customer") && (
                        <User className="h-3 w-3" />
                      )}
                      {item.key?.includes("Company") && (
                        <Building className="h-3 w-3" />
                      )}
                      {item.key?.includes("Value") && (
                        <DollarSign className="h-3 w-3" />
                      )}
                      {item.key?.includes("Revenue") && (
                        <DollarSign className="h-3 w-3" />
                      )}
                      {item.key?.includes("Due") && (
                        <Calendar className="h-3 w-3" />
                      )}
                      {item.key?.includes("Phone") && (
                        <Phone className="h-3 w-3" />
                      )}
                      {item.key?.includes("Email") && (
                        <Mail className="h-3 w-3" />
                      )}
                      {item.key?.includes("Contact") && (
                        <User className="h-3 w-3" />
                      )}
                      {item.key?.includes("Summary") && (
                        <TrendingUp className="h-3 w-3" />
                      )}
                      {item.key}
                    </span>
                    <span className="text-sm font-medium">{item.value}</span>
                  </div>
                );
              case "tip":
                return (
                  <div
                    key={itemIndex}
                    className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r"
                  >
                    <div className="flex items-start gap-2">
                      <div className="text-blue-600 text-lg">💡</div>
                      <p className="text-sm text-blue-800">{item.content}</p>
                    </div>
                  </div>
                );
              case "text":
                return (
                  <p key={itemIndex} className="text-sm text-muted-foreground">
                    {item.content}
                  </p>
                );
              default:
                return null;
            }
          })}
        </div>
      </div>
    ));
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
          <p className="text-sm">{safeContent}</p>
          <p className="text-xs opacity-70 mt-1">
            {formatTimestamp(timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Enhanced AI response rendering
  const parsedContent = parseContent(safeContent);
  const hasStructuredData =
    parsedContent.length > 0 && parsedContent[0].items.length > 0;

  return (
    <div className="flex justify-start mb-4">
      <div className="bg-muted rounded-lg px-4 py-3 max-w-[95%] w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              {context?.lastQuery === "due_today" && (
                <Calendar className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "overdue" && (
                <AlertTriangle className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "customer" && (
                <Building className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "job_detail" && (
                <FileText className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "revenue" && (
                <DollarSign className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "top_customers" && (
                <TrendingUp className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "status" && (
                <Package className="h-4 w-4 text-primary" />
              )}
              {context?.lastQuery === "rush" && (
                <AlertTriangle className="h-4 w-4 text-primary" />
              )}
              {!context?.lastQuery && (
                <FileText className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm">
                {context?.lastQuery === "due_today" && "Due Today"}
                {context?.lastQuery === "overdue" && "Overdue Orders"}
                {context?.lastQuery === "customer" && "Customer Information"}
                {context?.lastQuery === "job_detail" && "Job Details"}
                {context?.lastQuery === "revenue" && "Revenue Summary"}
                {context?.lastQuery === "top_customers" && "Top Customers"}
                {context?.lastQuery === "status" && "Status Overview"}
                {context?.lastQuery === "rush" && "Rush Orders"}
                {!context?.lastQuery && "Order Management"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(timestamp)}
              </p>
            </div>
          </div>

          {hasStructuredData && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs h-8 px-2"
              >
                {isExpanded ? (
                  <>
                    <ChevronDown className="h-3 w-3 mr-1" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Expand
                  </>
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRawContent(!showRawContent)}
                className="text-xs h-8 px-2"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Raw
              </Button>
            </div>
          )}
        </div>

        {hasStructuredData ? (
          <Card className="mb-3">
            <CardContent className="pt-4">
              {renderParsedContent(parsedContent)}
            </CardContent>
          </Card>
        ) : (
          <div className="text-sm whitespace-pre-wrap">{safeContent}</div>
        )}

        {isExpanded && hasStructuredData && (
          <div className="mt-3">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Additional Context:
            </div>
            {context && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {context.lastQuery && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Query Type:</span>
                    <span className="font-medium">{context.lastQuery}</span>
                  </div>
                )}
                {context.shownOrders && context.shownOrders.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orders Shown:</span>
                    <span className="font-medium">
                      {context.shownOrders.length}
                    </span>
                  </div>
                )}
                {context.focusedCustomer && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Customer:</span>
                    <span className="font-medium">
                      {context.focusedCustomer}
                    </span>
                  </div>
                )}
                {context.focusedJob && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Job:</span>
                    <span className="font-medium">{context.focusedJob}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showRawContent && (
          <div className="mt-3 p-3 bg-background rounded border">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Raw Response:
            </div>
            <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
              {safeContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

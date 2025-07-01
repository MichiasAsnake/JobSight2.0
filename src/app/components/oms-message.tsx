"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  User,
  Phone,
  Mail,
  DollarSign,
  Package,
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Truck,
  TrendingUp,
} from "lucide-react";

interface MessageProps {
  content: string;
  isUser: boolean;
  timestamp: string;
}

export function OMSMessage({ content, isUser, timestamp }: MessageProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Check if content contains order data patterns
  const hasOrderData = content.includes("Job") && content.includes("Customer:");
  const hasMultipleOrders =
    content.includes("orders for") || content.includes("rush/priority orders");
  const hasStats =
    content.includes("Statistics:") || content.includes("overview");

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("approved") || statusLower.includes("complete")) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (statusLower.includes("rush") || statusLower.includes("urgent")) {
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    } else if (
      statusLower.includes("pending") ||
      statusLower.includes("waiting")
    ) {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    } else if (
      statusLower.includes("shipped") ||
      statusLower.includes("delivered")
    ) {
      return <Truck className="h-4 w-4 text-blue-500" />;
    }
    return <FileText className="h-4 w-4 text-gray-500" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case "must":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "normal":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
          <p className="text-sm">{content}</p>
          <p className="text-xs opacity-70 mt-1">
            {formatTimestamp(timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Enhanced AI response with structured data display
  if (hasOrderData && !hasMultipleOrders) {
    // Single order display
    const lines = content.split("\n");
    const orderInfo: any = {};

    lines.forEach((line) => {
      if (line.includes("Job Number:")) {
        orderInfo.jobNumber = line.split(":")[1]?.trim();
      } else if (line.includes("Order Number:")) {
        orderInfo.orderNumber = line.split(":")[1]?.trim();
      } else if (line.includes("Status:")) {
        orderInfo.status = line.split(":")[1]?.trim();
      } else if (line.includes("Priority:")) {
        orderInfo.priority = line.split(":")[1]?.trim();
      } else if (line.includes("Description:")) {
        orderInfo.description = line.split(":")[1]?.trim();
      } else if (line.includes("Company:")) {
        orderInfo.company = line.split(":")[1]?.trim();
      } else if (line.includes("Contact:")) {
        orderInfo.contact = line.split(":")[1]?.trim();
      } else if (line.includes("Total Due:")) {
        orderInfo.totalDue = line.split(":")[1]?.trim();
      }
    });

    return (
      <div className="flex justify-start mb-4">
        <div className="bg-muted rounded-lg px-4 py-3 max-w-[90%]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="font-semibold text-sm">Order Information</h4>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(timestamp)}
              </p>
            </div>
          </div>

          <Card className="mb-3">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Job {orderInfo.jobNumber}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {orderInfo.status && getStatusIcon(orderInfo.status)}
                  {orderInfo.priority && (
                    <Badge
                      className={`text-xs ${getPriorityColor(
                        orderInfo.priority
                      )}`}
                    >
                      {orderInfo.priority}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                {orderInfo.orderNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order:</span>
                    <span className="font-medium">{orderInfo.orderNumber}</span>
                  </div>
                )}
                {orderInfo.description && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Description:</span>
                    <span className="font-medium max-w-[200px] truncate">
                      {orderInfo.description}
                    </span>
                  </div>
                )}
                {orderInfo.company && (
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{orderInfo.company}</span>
                  </div>
                )}
                {orderInfo.contact && (
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm">{orderInfo.contact}</span>
                  </div>
                )}
                {orderInfo.totalDue && (
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {orderInfo.totalDue}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show Less
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 mr-1" />
                Show Full Response
              </>
            )}
          </Button>

          {isExpanded && (
            <div className="mt-3 p-3 bg-background rounded border">
              <pre className="text-xs whitespace-pre-wrap">{content}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Multiple orders or stats display
  if (hasMultipleOrders || hasStats) {
    return (
      <div className="flex justify-start mb-4">
        <div className="bg-muted rounded-lg px-4 py-3 max-w-[90%]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              {hasStats ? (
                <TrendingUp className="h-4 w-4 text-primary" />
              ) : (
                <Package className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm">
                {hasStats ? "Order Statistics" : "Multiple Orders"}
              </h4>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(timestamp)}
              </p>
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm space-y-2">
                {content.split("\n").map((line, index) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return (
                      <h5
                        key={index}
                        className="font-semibold text-sm mt-3 mb-1"
                      >
                        {line.replace(/\*\*/g, "")}
                      </h5>
                    );
                  } else if (line.startsWith("- ")) {
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm"
                      >
                        <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                        <span>{line.substring(2)}</span>
                      </div>
                    );
                  } else if (line.trim()) {
                    return (
                      <p key={index} className="text-sm">
                        {line}
                      </p>
                    );
                  }
                  return null;
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Default message display
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-muted rounded-lg px-4 py-3 max-w-[90%]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(timestamp)}
          </span>
        </div>
        <div className="text-sm whitespace-pre-wrap">{content}</div>
      </div>
    </div>
  );
}

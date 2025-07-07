"use client";

import React from "react";
import {
  User,
  Bot,
  AlertCircle,
  Clock,
  CheckCircle,
  Package,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  DetailedOrderDisplay,
  transformAPIOrderToOrderSummary,
  transformLineItemsArray,
} from "@/components/order-display";

interface ExtendedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  context?: {
    strategy?: string;
    confidence?: string;
    sources?: {
      orders?: any[];
      vectorResults?: any[];
      strategy: string;
    };
    orders?: any[];
  };
  structuredResponse?: {
    introText: string;
    orders: Array<{
      jobNumber: string;
      customer: string;
      description: string;
      dueDate: string;
      daysToDue: number;
      status: string;
      quantity?: number;
      tags?: string[];
      priority: "urgent" | "normal" | "low";
      value?: number;
      // Pricing information
      pricing?: {
        total?: number;
        totalFormatted?: string;
        subtotal?: number;
        subtotalFormatted?: string;
        tax?: number;
        taxFormatted?: string;
      };
      // Enhanced fields from consistent data structure
      processes?: Array<{
        code: string;
        displayCode: string;
        quantity: number;
      }>;
      orderNumber?: string;
      stockStatus?: string;
      timeSensitive?: boolean;
      mustDate?: boolean;
      isReprint?: boolean;
      isDupe?: boolean;
      location?: {
        code: string;
        name: string;
      };
    }>;
    summary?: {
      totalOrders: number;
      totalValue?: number;
      urgentCount: number;
      overdueCount: number;
    };
  };
}

interface ParsedOrder {
  jobNumber: string;
  title?: string;
  customer: string;
  dueDate: string;
  daysToDue: number;
  status: string;
  quantity?: number;
  tags?: string[];
  description?: string;
  priority?: "urgent" | "normal" | "low";
  value?: number;
  // Pricing information
  pricing?: {
    total?: number;
    totalFormatted?: string;
    subtotal?: number;
    subtotalFormatted?: string;
    tax?: number;
    taxFormatted?: string;
  };
  // Enhanced fields from consistent data structure
  processes?: Array<{
    code: string;
    displayCode: string;
    quantity: number;
  }>;
  orderNumber?: string;
  stockStatus?: string;
  timeSensitive?: boolean;
  mustDate?: boolean;
  isReprint?: boolean;
  isDupe?: boolean;
  location?: {
    code: string;
    name: string;
  };
  // Line items for detailed view
  lineItems?: Array<{
    // Core identification
    id: string | number;
    jobNumber?: number;
    program?: string; // Program/SKU/Asset code

    // Basic information
    description: string;
    garment?: string; // Garment type/name
    comments?: string; // Detailed comments
    progComment?: string; // Program-specific comments

    // Quantities and pricing
    quantity: number;
    actualQuantity?: number;
    unitPrice?: number;
    totalPrice?: number;

    // Status and progress
    progress?: number;
    machineNumber?: string;
    machineNum?: number;

    // File and asset information
    pdfInstructions?: string | null;
    pdfId?: number;
    assetImage?: string | null;
    assetImagePreviewUrl?: string | null;
    assetId?: number;
    hasImage?: boolean;
    assetHasPDF?: boolean;

    // Relationships
    parentJobLineId?: number;
    isParentJobline?: boolean;
    isChildJobline?: boolean;
    isJoblineAlone?: boolean;
    order?: number;

    // Capabilities and permissions
    isScheduleable?: boolean;
    isEditable?: boolean;
    canUploadPDF?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canUploadImage?: boolean;
    canDuplicate?: boolean;
    canPrintLabel?: boolean;
    canReprintSeps?: boolean;
    canQCComplete?: boolean;
    canCheckSeps?: boolean;

    // Type classification
    isStock?: boolean;
    isAsset?: boolean;
    isOther?: boolean;
    assetIsNew?: boolean;

    // Additional information
    gang?: string;
    gangMondayLink?: string;
    supplier?: string;
    worksheetId?: number;
    worksheetType?: string;
    externalArtworkUrl?: string | null;
    externalSupplier?: string | null;

    // Machine types available for this job line
    joblineTypes?: Array<{
      id: number;
      machine: string;
      isAutoAdd: boolean;
    }>;

    // Legacy fields for backward compatibility
    status?: string;
    category?: string;
    processCodes?: string[];
    materials?: string[];
    hasPDF?: boolean;
    assetSKU?: string;
  }>;
}

// Transform API response data to component format
function transformOrderData(apiOrder: any): ParsedOrder {
  return {
    jobNumber: apiOrder.jobNumber || apiOrder.JobNumber || "Unknown",
    orderNumber: apiOrder.orderNumber || apiOrder.OrderNumber,
    customer:
      apiOrder.customer?.company ||
      apiOrder.customer?.name ||
      apiOrder.Client ||
      "Unknown Customer",
    description:
      apiOrder.description ||
      apiOrder.Description ||
      apiOrder.title ||
      "No Description",
    dueDate:
      apiOrder.dates?.dateDue || apiOrder.dateDue || apiOrder.DateDue || "",
    daysToDue:
      apiOrder.dates?.daysToDueDate ||
      apiOrder.daysToDueDate ||
      apiOrder.DaysToDueDate ||
      0,
    status:
      apiOrder.status?.master ||
      apiOrder.status?.status ||
      apiOrder.Status ||
      "Unknown",
    quantity: apiOrder.jobQuantity || apiOrder.quantity || apiOrder.JobQuantity,
    stockStatus:
      apiOrder.status?.stock || apiOrder.stockStatus || apiOrder.StockStatus,
    timeSensitive:
      apiOrder.production?.timeSensitive || apiOrder.timeSensitive || false,
    mustDate: apiOrder.production?.mustDate || apiOrder.mustDate || false,
    isReprint: apiOrder.production?.isReprint || apiOrder.isReprint || false,
    isDupe: apiOrder.production?.isDupe || apiOrder.isDupe || false,
    location: apiOrder.location
      ? {
          code: apiOrder.location.code || "",
          name: apiOrder.location.name || "",
        }
      : undefined,
    processes: apiOrder.production?.processes || apiOrder.processes || [],
    // Pricing information
    pricing: apiOrder.pricing
      ? {
          total: apiOrder.pricing.total,
          totalFormatted: apiOrder.pricing.totalFormatted,
          subtotal: apiOrder.pricing.subtotal,
          subtotalFormatted: apiOrder.pricing.subtotalFormatted,
          tax: apiOrder.pricing.tax,
          taxFormatted: apiOrder.pricing.taxFormatted,
        }
      : undefined,
    // Transform tags from API format (objects with 'tag' property) to strings
    tags: apiOrder.tags
      ? apiOrder.tags
          .map((tag: any) =>
            typeof tag === "string" ? tag : tag.tag || tag.name || ""
          )
          .filter(Boolean)
      : [],
    // Line items for detailed view - transform using enhanced function
    lineItems: transformLineItemsArray(
      apiOrder.lineItems || apiOrder.jobLines || [],
      apiOrder
    ),
    // Calculate priority based on days to due
    priority: (() => {
      const daysToDue =
        apiOrder.dates?.daysToDueDate ||
        apiOrder.daysToDueDate ||
        apiOrder.DaysToDueDate ||
        0;
      if (daysToDue < 0 || daysToDue <= 2) return "urgent";
      if (daysToDue <= 7) return "normal";
      return "low";
    })(),
  };
}

function getDaysToDueColor(daysToDue: number): string {
  if (daysToDue < 0) return "text-red-600 bg-red-50";
  if (daysToDue <= 2) return "text-orange-600 bg-orange-50";
  if (daysToDue <= 7) return "text-yellow-600 bg-yellow-50";
  return "text-green-600 bg-green-50";
}

function getDaysToDueIcon(daysToDue: number) {
  if (daysToDue < 0) return <AlertCircle className="w-4 h-4" />;
  if (daysToDue <= 2) return <Clock className="w-4 h-4" />;
  if (daysToDue <= 7) return <Package className="w-4 h-4" />;
  return <CheckCircle className="w-4 h-4" />;
}

function formatDaysToDue(daysToDue: number): string {
  if (daysToDue < 0) return `${Math.abs(daysToDue)} days overdue`;
  if (daysToDue === 0) return "Due today";
  if (daysToDue === 1) return "Due tomorrow";
  return `Due in ${daysToDue} days`;
}

function OrderCard({ order }: { order: ParsedOrder }) {
  const colorClass = getDaysToDueColor(order.daysToDue);
  const icon = getDaysToDueIcon(order.daysToDue);

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-blue-600">
            #{order.jobNumber}
          </span>
          {order.orderNumber && (
            <span className="text-xs text-gray-500">{order.orderNumber}</span>
          )}
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}
          >
            {icon}
            {formatDaysToDue(order.daysToDue)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {order.timeSensitive && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full font-medium">
              RUSH
            </span>
          )}
          {order.mustDate && (
            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">
              MUST DATE
            </span>
          )}
          {order.isReprint && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
              REPRINT
            </span>
          )}
          {order.isDupe && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">
              DUPE
            </span>
          )}
        </div>
      </div>

      <h3 className="font-medium text-gray-900 mb-1">
        {order.title || order.description}
      </h3>
      <p className="text-sm text-gray-600 mb-2">{order.customer}</p>

      {/* Process Information */}
      {order.processes && order.processes.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {order.processes.map((process, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium"
            >
              {process.displayCode}
              <span className="text-blue-600">×{process.quantity}</span>
            </span>
          ))}
        </div>
      )}

      {/* Status and Details */}
      <div className="text-xs text-gray-500 mb-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">Status:</span>
          <span>{order.status}</span>
          {order.stockStatus && (
            <>
              <span>•</span>
              <span>Stock: {order.stockStatus}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {order.quantity && (
            <>
              <span>Qty: {order.quantity}</span>
              <span>•</span>
            </>
          )}
          {order.pricing?.totalFormatted && (
            <>
              <span className="font-semibold text-green-600">
                {order.pricing.totalFormatted}
              </span>
              <span>•</span>
            </>
          )}
          {order.value && !order.pricing?.totalFormatted && (
            <>
              <span>Value: ${order.value.toFixed(2)}</span>
              <span>•</span>
            </>
          )}
          {order.location && <span>Location: {order.location.name}</span>}
        </div>
      </div>

      {/* Tags */}
      {order.tags && order.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {order.tags?.slice(0, 5).map((tag, index) => (
            <span
              key={index}
              className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                tag.startsWith("@")
                  ? "bg-green-100 text-green-700"
                  : tag.includes("rush") || tag.includes("urgent")
                  ? "bg-red-100 text-red-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {tag}
            </span>
          ))}
          {order.tags.length > 5 && (
            <span className="text-xs text-gray-500">
              +{order.tags.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function groupOrdersByDaysToDue(orders: ParsedOrder[]) {
  const groups = {
    overdue: orders.filter((o) => o.daysToDue < 0),
    urgent: orders.filter((o) => o.daysToDue >= 0 && o.daysToDue <= 2),
    thisWeek: orders.filter((o) => o.daysToDue > 2 && o.daysToDue <= 7),
    later: orders.filter((o) => o.daysToDue > 7),
  };

  return groups;
}

// Enhanced function to detect specific order detail requests
function isSpecificOrderDetailRequest(message: string): boolean {
  const specificOrderPatterns = [
    /show\s+me\s+order\s+(\d+)/i,
    /show\s+me\s+job\s+(\d+)/i,
    /order\s+(\d+)/i,
    /job\s+(\d+)/i,
    /details?\s+for\s+(?:order|job)\s+(\d+)/i,
    /more\s+(?:on|about)\s+(?:order|job)\s+(\d+)/i,
    /get\s+(?:order|job)\s+(\d+)/i,
    /find\s+(?:order|job)\s+(\d+)/i,
  ];

  return specificOrderPatterns.some((pattern) => pattern.test(message));
}

// Enhanced function to extract job numbers from specific order requests
function extractJobNumbersFromRequest(message: string): string[] {
  const patterns = [
    /show\s+me\s+order\s+(\d+)/gi,
    /show\s+me\s+job\s+(\d+)/gi,
    /order\s+(\d+)/gi,
    /job\s+(\d+)/gi,
    /details?\s+for\s+(?:order|job)\s+(\d+)/gi,
    /more\s+(?:on|about)\s+(?:order|job)\s+(\d+)/gi,
    /get\s+(?:order|job)\s+(\d+)/gi,
    /find\s+(?:order|job)\s+(\d+)/gi,
  ];

  const jobNumbers = new Set<string>();

  patterns.forEach((pattern) => {
    const matches = Array.from(message.matchAll(pattern));
    matches.forEach((match) => {
      if (match[1]) {
        jobNumbers.add(match[1]);
      }
    });
  });

  return Array.from(jobNumbers);
}

export default function OMSMessage({ message }: { message: ExtendedMessage }) {
  const isUser = message.role === "user";
  const context = message.context;

  // Transform API data to component format - check both data sources
  const structuredOrders = message.structuredResponse?.orders || [];
  const contextOrders =
    message.context?.orders || message.context?.sources?.orders || [];

  // Use structured orders if available (for constraint satisfaction), otherwise use context orders
  const rawOrders =
    structuredOrders.length > 0 ? structuredOrders : contextOrders;

  console.log(
    "🔍 [OMSMessage] Raw orders:",
    rawOrders.map((o) => ({
      jobNumber: o.jobNumber,
      hasPricing: !!o.pricing,
      pricing: o.pricing,
    }))
  );
  const transformedOrders = rawOrders.map(transformOrderData);
  console.log(
    "🔍 [OMSMessage] Transformed orders:",
    transformedOrders.map((o) => ({
      jobNumber: o.jobNumber,
      hasPricing: !!o.pricing,
      pricing: o.pricing,
      lineItemsCount: o.lineItems?.length || 0,
      lineItems: o.lineItems?.slice(0, 2).map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        materials: li.materials,
      })),
    }))
  );
  const hasOrderData = transformedOrders.length > 0;

  // Check if this is a specific order detail request
  const isSpecificOrderRequest = isSpecificOrderDetailRequest(message.content);
  const requestedJobNumbers = extractJobNumbersFromRequest(message.content);

  // If this is a specific order request and we have exactly one order that matches
  const shouldShowDetailedView =
    isSpecificOrderRequest &&
    transformedOrders.length === 1 &&
    requestedJobNumbers.length > 0 &&
    requestedJobNumbers.some(
      (jobNum) => transformedOrders[0].jobNumber === jobNum
    );

  // Force detailed view for testing when we have line items
  const forceDetailedView =
    transformedOrders.length === 1 &&
    (transformedOrders[0]?.lineItems?.length || 0) > 0;

  const orderGroups =
    hasOrderData && !shouldShowDetailedView
      ? groupOrdersByDaysToDue(transformedOrders)
      : null;

  return (
    <div
      className={`w-full flex ${isUser ? "justify-end" : "justify-start"} mb-4`}
      style={{ maxWidth: "100vw" }}
    >
      <div
        className="flex items-end w-full"
        style={{ maxWidth: 700, margin: "0 auto" }}
      >
        {!isUser && (
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mr-2">
            <Bot className="w-4 h-4 text-blue-600" />
          </div>
        )}

        <div
          className={`flex-1 max-w-2xl ${isUser ? "order-1" : "order-2"}`}
          style={{
            marginLeft: isUser ? "auto" : undefined,
            marginRight: !isUser ? "auto" : undefined,
          }}
        >
          <div
            className={`rounded-lg px-4 py-3 ${
              isUser
                ? "bg-blue-600 text-white ml-auto"
                : "bg-gray-50 text-gray-900"
            }`}
            aria-live="polite"
            aria-label={isUser ? "Your message" : "Assistant response"}
          >
            <div
              className={`prose prose-sm max-w-none ${
                isUser ? "prose-invert" : ""
              }`}
            >
              <ReactMarkdown>
                {hasOrderData &&
                !isUser &&
                message.structuredResponse?.introText
                  ? message.structuredResponse.introText
                  : message.content}
              </ReactMarkdown>
            </div>

            {context && !isUser && (
              <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-500">
                Strategy: {context.strategy} • Confidence: {context.confidence}
              </div>
            )}
          </div>

          {/* Detailed Order Display for specific order requests */}
          {(shouldShowDetailedView || forceDetailedView) &&
            !isUser &&
            transformedOrders.length === 1 && (
              <div className="mt-4">
                <DetailedOrderDisplay
                  order={transformAPIOrderToOrderSummary(transformedOrders[0])}
                  lineItems={
                    transformedOrders[0].lineItems
                      ? transformLineItemsArray(
                          transformedOrders[0].lineItems,
                          rawOrders[0]
                        )
                      : []
                  }
                />
              </div>
            )}

          {/* Enhanced Order Display organized by DaysToDueDate for general queries */}
          {hasOrderData &&
            !isUser &&
            !shouldShowDetailedView &&
            !forceDetailedView && (
              <div className="mt-4 space-y-4">
                {orderGroups?.overdue && orderGroups.overdue.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Overdue ({orderGroups.overdue.length})
                    </h4>
                    <div className="grid gap-2">
                      {orderGroups.overdue.map((order) => (
                        <OrderCard key={order.jobNumber} order={order} />
                      ))}
                    </div>
                  </div>
                )}

                {orderGroups?.urgent && orderGroups.urgent.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Urgent - Due Soon ({orderGroups.urgent.length})
                    </h4>
                    <div className="grid gap-2">
                      {orderGroups.urgent.map((order) => (
                        <OrderCard key={order.jobNumber} order={order} />
                      ))}
                    </div>
                  </div>
                )}

                {orderGroups?.thisWeek && orderGroups.thisWeek.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-yellow-600 mb-2 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      This Week ({orderGroups.thisWeek.length})
                    </h4>
                    <div className="grid gap-2">
                      {orderGroups.thisWeek.map((order) => (
                        <OrderCard key={order.jobNumber} order={order} />
                      ))}
                    </div>
                  </div>
                )}

                {orderGroups?.later && orderGroups.later.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Later ({orderGroups.later.length})
                    </h4>
                    <div className="grid gap-2">
                      {orderGroups.later.map((order) => (
                        <OrderCard key={order.jobNumber} order={order} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 ml-2">
            <User className="w-4 h-4 text-gray-600" />
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Types for our order display components
interface OrderSummary {
  jobNumber: string | number;
  description: string;
  customer: {
    company: string;
    id?: string | number;
  };
  status: {
    master: string;
    id?: number;
  };
  dates: {
    dateDue: string;
    daysToDueDate: number;
  };
  pricing?: {
    total?: number;
    totalFormatted?: string;
  };
  priority?: {
    mustDate?: boolean;
    timeSensitive?: boolean;
  };
}

interface LineItem {
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

  // Price band information (will be populated when needed)
  priceBand?: {
    categoryCode?: string;
    unitType?: string;
    priceCode?: string;
    humanName?: string;
    filterName?: string;
    processCode?: string;
    categorySetupMultiplier?: number;
    priceFormulaType?: string;
    active?: boolean;
  };

  // Legacy fields for backward compatibility
  status?: string;
  category?: string;
  processCodes?: string[];
  materials?: string[];
  hasPDF?: boolean;
  assetSKU?: string;
}

interface OrderDisplayProps {
  order: OrderSummary;
  showDetails?: boolean;
  lineItems?: LineItem[];
}

interface OrderListProps {
  orders: OrderSummary[];
  title?: string;
  showSummary?: boolean;
}

// Utility functions for displaying due dates
const formatDueDate = (
  daysToDue: number
): { text: string; urgency: "urgent" | "warning" | "normal" | "overdue" } => {
  if (daysToDue < 0) {
    return {
      text: `${Math.abs(daysToDue)} days overdue`,
      urgency: "overdue",
    };
  } else if (daysToDue === 0) {
    return { text: "Due today", urgency: "urgent" };
  } else if (daysToDue === 1) {
    return { text: "Due tomorrow", urgency: "urgent" };
  } else if (daysToDue <= 3) {
    return {
      text: `Due in ${daysToDue} days`,
      urgency: "warning",
    };
  } else {
    return {
      text: `Due in ${daysToDue} days`,
      urgency: "normal",
    };
  }
};

const getUrgencyColor = (
  urgency: "urgent" | "warning" | "normal" | "overdue"
) => {
  switch (urgency) {
    case "urgent":
      return "bg-red-100 text-red-800 border-red-200";
    case "warning":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "overdue":
      return "bg-red-200 text-red-900 border-red-300 font-semibold";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

const getPriorityIcon = (order: OrderSummary) => {
  if (order.priority?.timeSensitive) return "🔴";
  if (order.priority?.mustDate) return "🟡";
  if (order.dates.daysToDueDate <= 1) return "⚡";
  return "📋";
};

// Single Order Display Component
export function OrderDisplay({
  order,
  showDetails = false,
  lineItems = [],
}: OrderDisplayProps) {
  const dueDateInfo = formatDueDate(order.dates.daysToDueDate);
  const priorityIcon = getPriorityIcon(order);

  return (
    <Card className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="text-2xl">{priorityIcon}</div>
            <div>
              <CardTitle className="text-lg font-semibold">
                Job #{order.jobNumber}
              </CardTitle>
              <p className="text-sm text-gray-600 mt-1">{order.description}</p>
              <p className="text-sm font-medium text-gray-800 mt-1">
                {order.customer.company}
              </p>
              {order.pricing?.totalFormatted && (
                <p className="text-sm font-semibold text-green-600 mt-1">
                  {order.pricing.totalFormatted}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant="outline"
              className={`px-2 py-1 ${getUrgencyColor(dueDateInfo.urgency)}`}
            >
              {dueDateInfo.text}
            </Badge>
            <Badge variant="secondary">{order.status.master}</Badge>
          </div>
        </div>
      </CardHeader>

      {(showDetails || lineItems.length > 0) && (
        <CardContent className="px-6 pb-4">
          <div className="space-y-3">
            {/* Order Details */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-600">Due Date:</span>
                <p className="mt-1">
                  {new Date(order.dates.dateDue).toLocaleDateString()} (
                  {dueDateInfo.text})
                </p>
              </div>
              {order.pricing?.totalFormatted && (
                <div>
                  <span className="font-medium text-gray-600">
                    Total Value:
                  </span>
                  <p className="mt-1 font-semibold">
                    {order.pricing.totalFormatted}
                  </p>
                </div>
              )}
            </div>

            {/* Line Items */}
            {lineItems.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-800 mb-3">Line Items</h4>
                <LineItemList items={lineItems} />
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Line Items Component
export function LineItemList({ items }: { items: LineItem[] }) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div
          key={item.id || index}
          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
        >
          <div className="flex-1">
            <p className="font-medium text-sm">{item.description}</p>

            {/* Show program and garment if available */}
            <div className="flex flex-wrap gap-1 text-xs text-gray-500 mt-1">
              {item.program && (
                <span className="font-mono">{item.program}</span>
              )}
              {item.garment && <span>👕 {item.garment}</span>}
            </div>

            {item.comments && (
              <p className="text-xs text-gray-600 mt-1">{item.comments}</p>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">Qty: {item.quantity}</span>
            {item.unitPrice && (
              <span className="text-gray-600">
                ${item.unitPrice.toFixed(2)}
              </span>
            )}
            {item.totalPrice && (
              <span className="font-semibold">
                ${item.totalPrice.toFixed(2)}
              </span>
            )}
            {item.status && (
              <Badge variant="outline" className="text-xs">
                {item.status}
              </Badge>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Order List Component
export function OrderList({
  orders,
  title = "Orders",
  showSummary = true,
}: OrderListProps) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No orders found</p>
      </div>
    );
  }

  // Calculate summary statistics
  const summary = showSummary
    ? {
        total: orders.length,
        overdue: orders.filter((o) => o.dates.daysToDueDate < 0).length,
        dueToday: orders.filter((o) => o.dates.daysToDueDate === 0).length,
        dueSoon: orders.filter(
          (o) => o.dates.daysToDueDate > 0 && o.dates.daysToDueDate <= 3
        ).length,
        totalValue: orders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0),
      }
    : null;

  return (
    <div className="space-y-4">
      {/* Header with summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        {summary && (
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="outline">{summary.total} total</Badge>
            {summary.overdue > 0 && (
              <Badge variant="destructive">{summary.overdue} overdue</Badge>
            )}
            {summary.dueToday > 0 && (
              <Badge variant="default" className="bg-red-500">
                {summary.dueToday} due today
              </Badge>
            )}
            {summary.dueSoon > 0 && (
              <Badge variant="secondary">{summary.dueSoon} due soon</Badge>
            )}
          </div>
        )}
      </div>

      {/* Summary stats */}
      {summary && summary.totalValue > 0 && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Total Value:</span> $
            {summary.totalValue.toLocaleString()}
          </p>
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {orders.map((order, index) => (
          <OrderDisplay key={order.jobNumber || index} order={order} />
        ))}
      </div>
    </div>
  );
}

// Compact Order List for quick summaries
export function CompactOrderList({
  orders,
  limit = 5,
}: {
  orders: OrderSummary[];
  limit?: number;
}) {
  const displayOrders = orders.slice(0, limit);
  const hasMore = orders.length > limit;

  return (
    <div className="space-y-2">
      {displayOrders.map((order, index) => {
        const dueDateInfo = formatDueDate(order.dates.daysToDueDate);
        const priorityIcon = getPriorityIcon(order);

        return (
          <div
            key={order.jobNumber || index}
            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{priorityIcon}</span>
              <div>
                <p className="font-medium text-sm">#{order.jobNumber}</p>
                <p className="text-xs text-gray-600 truncate max-w-48">
                  {order.description}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs px-1 py-0.5 ${getUrgencyColor(
                  dueDateInfo.urgency
                )}`}
              >
                {dueDateInfo.text}
              </Badge>
              {order.pricing?.total && (
                <span className="text-xs font-medium text-gray-700">
                  ${order.pricing.total.toLocaleString()}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {hasMore && (
        <div className="text-center py-2">
          <p className="text-sm text-gray-500">
            ...and {orders.length - limit} more orders
          </p>
        </div>
      )}
    </div>
  );
}

// Utility functions to transform API data to our component format
export function transformAPIOrderToOrderSummary(apiOrder: any): OrderSummary {
  return {
    jobNumber:
      apiOrder.jobNumber ||
      apiOrder.JobNumber ||
      apiOrder.metadata?.jobNumber ||
      "Unknown",
    description:
      apiOrder.description ||
      apiOrder.Description ||
      apiOrder.metadata?.description ||
      "No description",
    customer: {
      company:
        apiOrder.customer?.company ||
        apiOrder.Client ||
        apiOrder.metadata?.customerCompany ||
        "Unknown Customer",
      id:
        apiOrder.customer?.id ||
        apiOrder.CustomerId ||
        apiOrder.metadata?.customerId,
    },
    status: {
      master:
        apiOrder.status?.master ||
        apiOrder.MasterJobStatus ||
        apiOrder.metadata?.status ||
        apiOrder.status ||
        "Unknown",
      id: apiOrder.status?.id || apiOrder.MasterJobStatusId,
    },
    dates: {
      dateDue:
        apiOrder.dates?.dateDue ||
        apiOrder.DateDue ||
        apiOrder.DateDueUtc ||
        apiOrder.metadata?.dateDue ||
        new Date().toISOString(),
      daysToDueDate:
        apiOrder.dates?.daysToDueDate ??
        apiOrder.DaysToDueDate ??
        apiOrder.metadata?.daysToDueDate ??
        0,
    },
    pricing: {
      total:
        apiOrder.pricing?.total || apiOrder.metadata?.totalDue || undefined,
      totalFormatted:
        apiOrder.pricing?.totalFormatted ||
        (apiOrder.pricing?.total
          ? `$${apiOrder.pricing.total.toLocaleString()}`
          : undefined),
    },
    priority: {
      mustDate:
        apiOrder.priority?.mustDate ||
        apiOrder.MustDate ||
        apiOrder.metadata?.mustDate ||
        false,
      timeSensitive:
        apiOrder.priority?.timeSensitive ||
        apiOrder.TimeSensitive ||
        apiOrder.metadata?.timeSensitive ||
        false,
    },
  };
}

export function transformAPILineItemToLineItem(
  apiLineItem: any,
  orderContext?: any
): LineItem {
  // Calculate quantity - if line item quantity is 0, try to get it from order context
  let quantity = apiLineItem.Quantity || apiLineItem.quantity || 0;

  if (quantity === 0 && orderContext) {
    // For setup items or items without specific quantities, use job quantity
    if (
      apiLineItem.Description?.toLowerCase().includes("setup") ||
      apiLineItem.description?.toLowerCase().includes("setup") ||
      (apiLineItem.UnitPrice === 0 && apiLineItem.unitPrice === 0)
    ) {
      quantity = orderContext.jobQuantity || orderContext.jobLinesQuantity || 0;
    } else {
      // For regular items, try to get quantity from production processes
      const processes =
        orderContext.production?.processes || orderContext.processes || [];
      if (processes.length > 0) {
        // Use the first process quantity as default
        quantity = processes[0].quantity || 0;
      } else {
        // Fallback to job quantity
        quantity =
          orderContext.jobQuantity || orderContext.jobLinesQuantity || 0;
      }
    }
  }

  // Extract materials from tags if not available in line item
  let materials = apiLineItem.Materials || apiLineItem.materials || [];
  if (materials.length === 0 && orderContext?.tags) {
    const materialTags = orderContext.tags
      .filter((tag: any) => {
        const tagText = typeof tag === "string" ? tag : tag.tag || "";
        return (
          tagText.toLowerCase().includes("gamma") ||
          tagText.toLowerCase().includes("emb") ||
          tagText.toLowerCase().includes("patch") ||
          tagText.toLowerCase().includes("material")
        );
      })
      .map((tag: any) => (typeof tag === "string" ? tag : tag.tag || ""));

    if (materialTags.length > 0) {
      materials = materialTags;
    }
  }

  return {
    // Core identification
    id:
      apiLineItem.ID ||
      apiLineItem.LineId ||
      apiLineItem.id ||
      Math.random().toString(),
    jobNumber: apiLineItem.JobNumber || apiLineItem.jobNumber,
    program:
      apiLineItem.Prgram ||
      apiLineItem.program ||
      apiLineItem.AssetSKU ||
      apiLineItem.assetSKU,

    // Basic information
    description:
      apiLineItem.Description || apiLineItem.description || "Unknown item",
    garment: apiLineItem.Garment || apiLineItem.garment,
    comments:
      apiLineItem.Comments || apiLineItem.Comment || apiLineItem.comments,
    progComment: apiLineItem.ProgComment || apiLineItem.progComment,

    // Quantities and pricing
    quantity: quantity,
    actualQuantity: apiLineItem.ActQty || apiLineItem.actQty,
    unitPrice: apiLineItem.UnitPrice || apiLineItem.unitPrice,
    totalPrice: apiLineItem.TotalPrice || apiLineItem.totalPrice,

    // Status and progress
    progress: apiLineItem.Progress || apiLineItem.progress,
    machineNumber: apiLineItem.MachineNumber || apiLineItem.machineNumber,
    machineNum: apiLineItem.MachNum || apiLineItem.machNum,

    // File and asset information
    pdfInstructions: apiLineItem.PDFInstructions || apiLineItem.pdfInstructions,
    pdfId: apiLineItem.PDFId || apiLineItem.pdfId,
    assetImage: apiLineItem.AssetImage || apiLineItem.assetImage,
    assetImagePreviewUrl:
      apiLineItem.AssetImagePreviewUrl || apiLineItem.assetImagePreviewUrl,
    assetId: apiLineItem.AssetId || apiLineItem.assetId,
    hasImage: apiLineItem.HasImage || apiLineItem.hasImage,
    assetHasPDF: apiLineItem.AssetHasPDF || apiLineItem.assetHasPDF,

    // Relationships
    parentJobLineId: apiLineItem.ParentJobLineID || apiLineItem.parentJobLineId,
    isParentJobline: apiLineItem.IsParentJobline || apiLineItem.isParentJobline,
    isChildJobline: apiLineItem.IsChildJobline || apiLineItem.isChildJobline,
    isJoblineAlone: apiLineItem.IsJoblineAlone || apiLineItem.isJoblineAlone,
    order: apiLineItem.Order || apiLineItem.order,

    // Capabilities and permissions
    isScheduleable: apiLineItem.IsScheduleable || apiLineItem.isScheduleable,
    isEditable: apiLineItem.IsEditable || apiLineItem.isEditable,
    canUploadPDF: apiLineItem.CanUploadPDF || apiLineItem.canUploadPDF,
    canEdit: apiLineItem.CanEdit || apiLineItem.canEdit,
    canDelete: apiLineItem.CanDelete || apiLineItem.canDelete,
    canUploadImage: apiLineItem.CanUploadImage || apiLineItem.canUploadImage,
    canDuplicate: apiLineItem.CanDuplicate || apiLineItem.canDuplicate,
    canPrintLabel: apiLineItem.CanPrintLabel || apiLineItem.canPrintLabel,
    canReprintSeps: apiLineItem.CanReprintSeps || apiLineItem.canReprintSeps,
    canQCComplete: apiLineItem.CanQCComplete || apiLineItem.canQCComplete,
    canCheckSeps: apiLineItem.CanCheckSeps || apiLineItem.canCheckSeps,

    // Type classification
    isStock: apiLineItem.IsStock || apiLineItem.isStock,
    isAsset: apiLineItem.IsAsset || apiLineItem.isAsset,
    isOther: apiLineItem.IsOther || apiLineItem.isOther,
    assetIsNew: apiLineItem.AssetIsNew || apiLineItem.assetIsNew,

    // Additional information
    gang: apiLineItem.Gang || apiLineItem.gang,
    gangMondayLink: apiLineItem.GangMondayLink || apiLineItem.gangMondayLink,
    supplier: apiLineItem.Supplier || apiLineItem.supplier,
    worksheetId: apiLineItem.WorksheetId || apiLineItem.worksheetId,
    worksheetType: apiLineItem.WorksheetType || apiLineItem.worksheetType,
    externalArtworkUrl:
      apiLineItem.ExternalArtworkUrl || apiLineItem.externalArtworkUrl,
    externalSupplier:
      apiLineItem.ExternalSupplier || apiLineItem.externalSupplier,

    // Machine types available for this job line
    joblineTypes: apiLineItem.JoblineTypes || apiLineItem.joblineTypes,

    // Price band information (will be populated when needed)
    priceBand: apiLineItem.priceBand || apiLineItem.PriceBand,

    // Legacy fields for backward compatibility
    status: apiLineItem.Status || apiLineItem.status,
    category: apiLineItem.Category || apiLineItem.category,
    processCodes: apiLineItem.ProcessCodes || apiLineItem.processCodes,
    materials: materials,
    hasPDF: apiLineItem.HasPDF || apiLineItem.hasPDF,
    assetSKU: apiLineItem.AssetSKU || apiLineItem.assetSKU,
  };
}

// Helper to transform arrays
export function transformOrdersArray(apiOrders: any[]): OrderSummary[] {
  return apiOrders.map(transformAPIOrderToOrderSummary);
}

export function transformLineItemsArray(
  apiLineItems: any[],
  orderContext?: any
): LineItem[] {
  return apiLineItems.map((lineItem) =>
    transformAPILineItemToLineItem(lineItem, orderContext)
  );
}

// Enhanced Line Items Component with comprehensive information
export function DetailedLineItemList({ items }: { items: LineItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.id || index}
          className="border rounded-lg p-4 bg-gray-50 shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Header with basic info */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h4 className="font-medium text-gray-900 mb-1">
                {item.description}
              </h4>

              {/* Program/SKU and Garment info */}
              <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-1">
                {item.program && (
                  <span className="font-mono bg-blue-50 px-2 py-1 rounded">
                    {item.program}
                  </span>
                )}
                {item.garment && (
                  <span className="bg-purple-50 px-2 py-1 rounded">
                    👕 {item.garment}
                  </span>
                )}
              </div>

              {/* Comments */}
              {item.comments && (
                <p className="text-sm text-gray-700 mt-1 bg-yellow-50 p-2 rounded">
                  💬 {item.comments}
                </p>
              )}
              {item.progComment && (
                <p className="text-xs text-gray-500 mt-1 italic">
                  {item.progComment}
                </p>
              )}
            </div>

            {/* Pricing and quantities */}
            <div className="flex items-center gap-3 text-sm">
              <div className="text-right">
                <span className="text-gray-600">
                  Qty: {item.quantity}
                  {item.actualQuantity &&
                    item.actualQuantity !== item.quantity && (
                      <span className="text-gray-400">
                        {" "}
                        (Act: {item.actualQuantity})
                      </span>
                    )}
                </span>
                {item.unitPrice && (
                  <div className="text-gray-500">
                    @ ${item.unitPrice.toFixed(2)}
                  </div>
                )}
              </div>
              {item.totalPrice && (
                <div className="font-semibold text-green-600">
                  ${item.totalPrice.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Status and progress */}
          <div className="flex flex-wrap gap-2 mb-3">
            {item.progress !== undefined && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                Progress: {item.progress}%
              </span>
            )}
            {item.machineNumber && (
              <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                Machine: {item.machineNumber}
              </span>
            )}
            {item.isParentJobline && (
              <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                Parent Line
              </span>
            )}
            {item.isChildJobline && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                Child Line
              </span>
            )}
            {item.isScheduleable && (
              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                Scheduleable
              </span>
            )}
          </div>

          {/* Machine types */}
          {item.joblineTypes && item.joblineTypes.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">
                Available Machines:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.joblineTypes.map((type, typeIndex) => (
                  <span
                    key={typeIndex}
                    className={`inline-block px-2 py-1 text-xs rounded font-medium ${
                      type.isAutoAdd
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {type.machine}
                    {type.isAutoAdd && " (Auto)"}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Process Codes */}
          {item.processCodes && item.processCodes.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">
                Processes:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.processCodes.map((code, codeIndex) => (
                  <span
                    key={codeIndex}
                    className="inline-block px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Materials */}
          {item.materials && item.materials.length > 0 && (
            <div className="mb-2">
              <span className="text-xs font-medium text-gray-600">
                Materials:
              </span>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.materials.map((material, materialIndex) => (
                  <span
                    key={materialIndex}
                    className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* File and asset indicators */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            {item.hasImage && (
              <span className="flex items-center gap-1">🖼️ Image</span>
            )}
            {item.assetHasPDF && (
              <span className="flex items-center gap-1">📄 PDF</span>
            )}
            {item.canUploadPDF && (
              <span className="flex items-center gap-1">📤 Can Upload PDF</span>
            )}
            {item.canUploadImage && (
              <span className="flex items-center gap-1">
                📷 Can Upload Image
              </span>
            )}
            {item.canPrintLabel && (
              <span className="flex items-center gap-1">
                🏷️ Can Print Label
              </span>
            )}
            {item.category && (
              <span className="flex items-center gap-1">
                📁 {item.category}
              </span>
            )}
          </div>

          {/* Additional info */}
          {(item.supplier || item.gang || item.assetId) && (
            <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
              <div className="flex flex-wrap gap-4">
                {item.supplier && <span>🏭 Supplier: {item.supplier}</span>}
                {item.gang && <span>👥 Gang: {item.gang}</span>}
                {item.assetId && <span>🆔 Asset ID: {item.assetId}</span>}
              </div>
            </div>
          )}

          {/* Price Band Information - Collapsible */}
          {item.program && (
            <PriceBandInfo
              program={item.program}
              priceBand={item.priceBand}
              assetId={item.assetId}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Detailed Order Display Component for specific order requests
export function DetailedOrderDisplay({
  order,
  lineItems = [],
}: {
  order: OrderSummary & {
    // Enhanced fields for detailed display
    orderNumber?: string;
    jobQuantity?: number;
    comments?: string;
    location?: {
      code: string;
      name: string;
    };
    production?: {
      timeSensitive: boolean;
      mustDate: boolean;
      isReprint: boolean;
      isDupe: boolean;
      processes?: Array<{
        code: string;
        displayCode: string;
        quantity: number;
      }>;
    };
    shipments?: Array<{
      id: number;
      title: string;
      shipped: boolean;
      dateShipped?: string;
      address?: {
        contactName: string;
        organisation: string;
        city: string;
        state: string;
      };
    }>;
    files?: Array<{
      fileName: string;
      fileType: string;
      category: string;
    }>;
  };
  lineItems?: LineItem[];
}) {
  const dueDateInfo = formatDueDate(order.dates.daysToDueDate);
  const priorityIcon = getPriorityIcon(order);

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow border-l-gray-300">
      {/* Header Section */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="text-2xl">{priorityIcon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-lg font-semibold text-blue-600">
                #{order.jobNumber}
              </span>
              {order.orderNumber && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Order: {order.orderNumber}
                </span>
              )}
            </div>
            <h3 className="font-medium text-gray-900 mb-1">
              {order.description}
            </h3>
            <p className="text-sm font-medium text-gray-800 mb-1">
              {order.customer.company}
            </p>
            {order.comments && (
              <p className="text-sm text-gray-600 italic mb-2">
                "{order.comments}"
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(
              dueDateInfo.urgency
            )}`}
          >
            {dueDateInfo.text}
          </div>
          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">
            {order.status.master}
          </span>
        </div>
      </div>

      {/* Order Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
        <div>
          <span className="font-medium text-gray-600">Due Date:</span>
          <p className="mt-1">
            {new Date(order.dates.dateDue).toLocaleDateString()} (
            {dueDateInfo.text})
          </p>
        </div>
        {order.jobQuantity && (
          <div>
            <span className="font-medium text-gray-600">Job Quantity:</span>
            <p className="mt-1 font-semibold">{order.jobQuantity}</p>
          </div>
        )}
        {order.pricing?.totalFormatted && (
          <div>
            <span className="font-medium text-gray-600">Total Value:</span>
            <p className="mt-1 font-semibold text-green-600">
              {order.pricing.totalFormatted}
            </p>
          </div>
        )}
        {order.location && order.location.name && (
          <div>
            <span className="font-medium text-gray-600">Location:</span>
            <p className="mt-1">{order.location.name}</p>
          </div>
        )}
      </div>

      {/* Production Processes */}
      {order.production?.processes && order.production.processes.length > 0 && (
        <div className="mb-4">
          <span className="font-medium text-gray-600 text-sm">
            Production Processes:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {order.production.processes.map((process, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded font-medium"
              >
                {process.displayCode}
                <span className="text-blue-600">×{process.quantity}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Production Flags */}
      {order.production && (
        <div className="flex flex-wrap gap-1 mb-4">
          {order.production.timeSensitive && (
            <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full font-medium">
              🔴 Time Sensitive
            </span>
          )}
          {order.production.mustDate && (
            <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full font-medium">
              🟡 Must Date
            </span>
          )}
          {order.production.isReprint && (
            <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
              🔄 Reprint
            </span>
          )}
          {order.production.isDupe && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full font-medium">
              📋 Duplicate
            </span>
          )}
        </div>
      )}

      {/* Shipments */}
      {order.shipments && order.shipments.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-800 mb-3 text-sm">Shipments</h4>
          <div className="space-y-2">
            {order.shipments.map((shipment, index) => (
              <div
                key={shipment.id || index}
                className="p-3 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{shipment.title}</span>
                  <span
                    className={`px-2 py-1 text-xs rounded-full font-medium ${
                      shipment.shipped
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {shipment.shipped ? "Shipped" : "Pending"}
                  </span>
                </div>
                {shipment.dateShipped && (
                  <p className="text-xs text-gray-600">
                    Shipped:{" "}
                    {new Date(shipment.dateShipped).toLocaleDateString()}
                  </p>
                )}
                {shipment.address && (
                  <p className="text-xs text-gray-600">
                    {shipment.address.contactName} -{" "}
                    {shipment.address.organisation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {order.files && order.files.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-800 mb-3 text-sm">Files</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {order.files.map((file, index) => (
              <div
                key={index}
                className="p-2 bg-gray-50 rounded border text-xs"
              >
                <div className="font-medium truncate">{file.fileName}</div>
                <div className="text-gray-600">{file.fileType}</div>
                {file.category && (
                  <div className="text-gray-500">{file.category}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Line Items */}
      {lineItems.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-800 mb-3 text-sm">
            Line Items ({lineItems.length})
          </h4>
          <DetailedLineItemList items={lineItems} />
        </div>
      )}
    </div>
  );
}

// Price Band Information Component
function PriceBandInfo({
  program,
  priceBand,
  assetId,
}: {
  program: string;
  priceBand?: {
    categoryCode?: string;
    unitType?: string;
    priceCode?: string;
    humanName?: string;
    filterName?: string;
    processCode?: string;
    categorySetupMultiplier?: number;
    priceFormulaType?: string;
    active?: boolean;
  };
  assetId?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [priceBandData, setPriceBandData] = useState(priceBand);

  const handleExpand = () => {
    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    console.log(`🔍 [PRICE-BAND] Expanding for program: ${program}`, {
      priceBand,
      assetId,
    });

    // If we have pre-fetched price band data, use it immediately
    if (priceBand && Object.keys(priceBand).length > 0) {
      console.log(
        `✅ [PRICE-BAND] Using pre-fetched data for ${program}:`,
        priceBand
      );
      setPriceBandData(priceBand);
    }
    // If we don't have price band data, try to fetch it
    else if (!priceBandData) {
      setIsLoading(true);
      try {
        // Let the API handle all the mapping dynamically
        const requestBody = {
          program,
        };

        console.log(
          `🌐 [PRICE-BAND] Fetching data for ${program}:`,
          requestBody
        );

        // Direct API call instead of going through chat
        fetch("/api/price-bands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
          .then((response) => response.json())
          .then((result) => {
            console.log(`📡 [PRICE-BAND] API response for ${program}:`, result);
            if (result.success && result.data) {
              console.log(
                `✅ [PRICE-BAND] Setting data for ${program}:`,
                result.data
              );
              setPriceBandData(result.data);
            } else {
              console.warn(
                `⚠️ [PRICE-BAND] No data returned for ${program}:`,
                result
              );

              // Check if it's a temporary service unavailable error
              if (
                result.error &&
                result.error.includes("temporarily unavailable")
              ) {
                console.log(
                  `🔄 [PRICE-BAND] Service temporarily unavailable, will retry automatically`
                );
                // Retry after a short delay
                setTimeout(() => {
                  handleExpand();
                }, 2000);
                return;
              }
            }
          })
          .catch((error) => {
            console.error("Failed to fetch price band data:", error);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } catch (error) {
        console.error("Failed to fetch price band data:", error);
        setIsLoading(false);
      }
    }

    setIsExpanded(true);
  };

  return (
    <div className="mt-2 pt-2 border-t border-gray-200">
      <button
        onClick={handleExpand}
        className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
      >
        <span className="font-medium">💰 Pricing Information</span>
        {isLoading ? (
          <span className="animate-spin">⏳</span>
        ) : (
          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
        )}
      </button>

      {isExpanded && priceBandData && (
        <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {priceBandData.categoryCode && (
              <div>
                <span className="font-medium text-gray-700">Category:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.categoryCode}
                </span>
              </div>
            )}
            {priceBandData.unitType && (
              <div>
                <span className="font-medium text-gray-700">Unit Type:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.unitType}
                </span>
              </div>
            )}
            {priceBandData.humanName && (
              <div>
                <span className="font-medium text-gray-700">Product:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.humanName}
                </span>
              </div>
            )}
            {priceBandData.processCode && (
              <div>
                <span className="font-medium text-gray-700">Process:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.processCode}
                </span>
              </div>
            )}
            {priceBandData.categorySetupMultiplier && (
              <div>
                <span className="font-medium text-gray-700">
                  Setup Multiplier:
                </span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.categorySetupMultiplier}x
                </span>
              </div>
            )}
            {priceBandData.priceFormulaType && (
              <div>
                <span className="font-medium text-gray-700">Formula:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.priceFormulaType}
                </span>
              </div>
            )}
            {priceBandData.active !== undefined && (
              <div>
                <span className="font-medium text-gray-700">Status:</span>
                <span
                  className={`ml-1 ${
                    priceBandData.active ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {priceBandData.active ? "Active" : "Inactive"}
                </span>
              </div>
            )}
          </div>

          {priceBandData.filterName && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <div className="text-xs">
                <span className="font-medium text-gray-700">Full Name:</span>
                <span className="ml-1 text-gray-600">
                  {priceBandData.filterName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {isExpanded && !priceBandData && !isLoading && (
        <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-500">
            No pricing information available for this program.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            This may be because the program is not configured for pricing, or
            the pricing service is temporarily unavailable.
          </p>
        </div>
      )}
    </div>
  );
}

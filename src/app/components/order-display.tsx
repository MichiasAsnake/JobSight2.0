"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Command,
  CommandItem,
  CommandList,
  Combobox,
  ComboboxItem,
  ComboboxItemValue,
  ComboboxList,
  ComboboxProvider,
  Disclosure,
  DisclosureContent,
  DisclosureProvider,
  useDisclosureStore,
} from "@ariakit/react";

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
  id: string | number;
  description: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  status?: string;
  comments?: string;
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
    <DisclosureProvider defaultOpen={showDetails}>
      <Card className="border-l-4 border-l-blue-500 hover:shadow-sm transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="text-2xl">{priorityIcon}</div>
              <div>
                <CardTitle className="text-lg font-semibold">
                  Job #{order.jobNumber}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {order.description}
                </p>
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
          <DisclosureContent className="px-6 pb-4">
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
          </DisclosureContent>
        )}
      </Card>
    </DisclosureProvider>
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

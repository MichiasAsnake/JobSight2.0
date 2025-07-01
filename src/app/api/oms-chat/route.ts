import { NextRequest, NextResponse } from "next/server";
import { omsDataService, Order } from "@/lib/oms-data";

interface ConversationMessage {
  role: string;
  content: string;
  timestamp: number;
  context?: {
    queryType?: string;
    ordersShown?: string[];
    customerFocus?: string;
    lastAction?: string;
  };
}

const conversations: Record<
  string,
  {
    messages: ConversationMessage[];
    lastActivity: number;
    context: {
      lastQuery?: string;
      focusedCustomer?: string;
      shownOrders?: string[];
      currentFilter?: string;
      focusedJob?: string;
    };
  }
> = {};

function cleanupOldConversations() {
  const oneHour = 60 * 60 * 1000;
  const now = Date.now();
  Object.keys(conversations).forEach((sessionId) => {
    if (now - conversations[sessionId].lastActivity > oneHour) {
      delete conversations[sessionId];
    }
  });
}

function getConversationSession(sessionId: string) {
  if (!conversations[sessionId]) {
    conversations[sessionId] = {
      messages: [],
      lastActivity: Date.now(),
      context: {
        lastQuery: undefined,
        focusedCustomer: undefined,
        shownOrders: [],
        currentFilter: undefined,
        focusedJob: undefined,
      },
    };
  }
  return conversations[sessionId];
}

function getPacificDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Enhanced context-aware response generation
function generateContextualResponse(
  orders: Order[],
  query: string,
  conversationHistory: ConversationMessage[],
  sessionContext: any
): { response: string; context: any } {
  const searchTerm = query.toLowerCase().trim();

  // Enhanced context tracking
  const newContext = { ...sessionContext };

  // Handle follow-up questions
  if (isFollowUpQuery(searchTerm)) {
    return handleFollowUp(searchTerm, orders, sessionContext);
  }

  // Handle "due today" queries with context
  if (
    searchTerm.includes("due today") ||
    searchTerm.includes("what's due") ||
    searchTerm.includes("whats due")
  ) {
    const result = handleDueTodayQuery(orders, sessionContext);
    newContext.lastQuery = "due_today";
    newContext.shownOrders = result.orderIds;
    return { response: result.response, context: newContext };
  }

  // Handle overdue queries
  if (searchTerm.includes("overdue") || searchTerm.includes("late")) {
    const result = handleOverdueQuery(orders, sessionContext);
    newContext.lastQuery = "overdue";
    newContext.shownOrders = result.orderIds;
    return { response: result.response, context: newContext };
  }

  // Handle customer queries with better context
  const customerMatch = searchTerm.match(
    /(?:orders?\s+for|customer|company)\s+(.+)/i
  );
  if (customerMatch) {
    const customerName = customerMatch[1].trim();
    const result = handleCustomerQuery(orders, customerName, sessionContext);
    newContext.lastQuery = "customer";
    newContext.focusedCustomer = customerName;
    newContext.shownOrders = result.orderIds;
    return { response: result.response, context: newContext };
  }

  // Handle job number queries
  const jobMatch = searchTerm.match(/(?:job|order)\s*#?(\d+)/i);
  if (jobMatch) {
    const jobNumber = jobMatch[1];
    const result = handleJobQuery(orders, jobNumber, sessionContext);
    newContext.lastQuery = "job_detail";
    newContext.focusedJob = jobNumber;
    return { response: result.response, context: newContext };
  }

  // Handle status queries
  if (searchTerm.includes("status") || searchTerm.includes("progress")) {
    const result = handleStatusQuery(orders, searchTerm, sessionContext);
    newContext.lastQuery = "status";
    return { response: result.response, context: newContext };
  }

  // Handle top customers queries
  if (
    searchTerm.includes("top customer") ||
    searchTerm.includes("best customer")
  ) {
    const result = handleTopCustomersQuery(orders, sessionContext);
    newContext.lastQuery = "top_customers";
    return { response: result.response, context: newContext };
  }

  // Handle revenue queries
  if (searchTerm.includes("revenue") || searchTerm.includes("total")) {
    const result = handleRevenueQuery(orders, sessionContext);
    newContext.lastQuery = "revenue";
    return { response: result.response, context: newContext };
  }

  // Handle rush orders
  if (searchTerm.includes("rush") || searchTerm.includes("urgent")) {
    const result = handleRushQuery(orders, sessionContext);
    newContext.lastQuery = "rush";
    newContext.shownOrders = result.orderIds;
    return { response: result.response, context: newContext };
  }

  // Default with context consideration
  const result = handleDefaultQuery(orders, searchTerm, sessionContext);
  newContext.lastQuery = "general";
  return { response: result.response, context: newContext };
}

function isFollowUpQuery(query: string): boolean {
  const followUpPatterns = [
    "more details",
    "tell me more",
    "show more",
    "expand",
    "details",
    "what about",
    "and",
    "also",
    "anything else",
    "continue",
    "more info",
    "full details",
    "complete info",
    "contact info",
    "contact details",
    "phone",
    "email",
    "address",
  ];

  return followUpPatterns.some((pattern) => query.includes(pattern));
}

function handleFollowUp(
  query: string,
  orders: Order[],
  context: any
): { response: string; context: any } {
  // Handle different types of follow-ups based on context
  if (context.lastQuery === "due_today" && context.shownOrders?.length > 0) {
    return expandDueTodayDetails(orders, context);
  }

  if (context.focusedCustomer) {
    return expandCustomerDetails(orders, context.focusedCustomer, context);
  }

  if (context.focusedJob) {
    return expandJobDetails(orders, context.focusedJob, context);
  }

  if (context.lastQuery === "overdue" && context.shownOrders?.length > 0) {
    return expandOverdueDetails(orders, context);
  }

  return {
    response:
      "I'd be happy to provide more details! What specific information would you like to know more about?",
    context,
  };
}

function handleDueTodayQuery(
  orders: Order[],
  context: any
): { response: string; orderIds: string[] } {
  const today = getPacificDateString();
  const dueToday = orders.filter((order) => {
    if (!order.requestedShipDate) return false;
    try {
      const shipDateStr = order.requestedShipDate.split("T")[0];
      return shipDateStr === today;
    } catch {
      return false;
    }
  });

  if (dueToday.length === 0) {
    const upcoming = orders
      .filter(
        (o) => o.requestedShipDate && new Date(o.requestedShipDate) > new Date()
      )
      .sort((a, b) => {
        const dateA = a.requestedShipDate
          ? new Date(a.requestedShipDate).getTime()
          : 0;
        const dateB = b.requestedShipDate
          ? new Date(b.requestedShipDate).getTime()
          : 0;
        return dateA - dateB;
      })
      .slice(0, 3);

    let response = `## Orders Due Today\n\nNo orders are due today (${today}). `;
    if (upcoming.length > 0) {
      response += `However, you have ${upcoming.length} orders coming up:\n\n`;
      upcoming.forEach((order, i) => {
        const dueDate = order.requestedShipDate
          ? new Date(order.requestedShipDate).toLocaleDateString()
          : "Not set";
        response += `**${i + 1}.** Job ${order.jobNumber} for ${
          order.customer?.company
        } due ${dueDate}\n`;
      });
      response += `\n💡 Ask "show more details" for expanded information, or "contact info" for customer details.`;
    }

    return { response, orderIds: upcoming.map((o) => o.jobNumber) };
  }

  let response = `## 📅 Orders Due Today (${today})\n\n`;
  response += `Found ${dueToday.length} order${
    dueToday.length === 1 ? "" : "s"
  } due today:\n\n`;

  dueToday.forEach((order, index) => {
    response += `**${index + 1}. Job ${order.jobNumber}** - ${
      order.customer?.company
    }\n`;
    response += `   Description: ${order.description}\n`;
    response += `   Status: ${order.status} | Priority: ${
      order.priority || "Normal"
    }\n`;
    response += `   Value: $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}\n\n`;
  });

  response += `💡 Ask "show more details" for expanded information, or "contact info" for customer details.`;

  return { response, orderIds: dueToday.map((o) => o.jobNumber) };
}

function handleOverdueQuery(
  orders: Order[],
  context: any
): { response: string; orderIds: string[] } {
  const today = new Date();
  const overdue = orders
    .filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        return (
          shipDate < today &&
          !["closed", "completed", "shipped"].includes(
            order.status.toLowerCase()
          )
        );
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      const dateA = a.requestedShipDate
        ? new Date(a.requestedShipDate).getTime()
        : 0;
      const dateB = b.requestedShipDate
        ? new Date(b.requestedShipDate).getTime()
        : 0;
      return dateA - dateB;
    });

  if (overdue.length === 0) {
    return {
      response:
        "## ✅ Overdue Orders\n\nGreat news! No orders are currently overdue. All active orders are on track or ahead of schedule. 🎉",
      orderIds: [],
    };
  }

  let response = `## ⚠️ Overdue Orders (${overdue.length})\n\n`;

  overdue.slice(0, 8).forEach((order, index) => {
    const daysOverdue = Math.floor(
      (today.getTime() -
        (order.requestedShipDate
          ? new Date(order.requestedShipDate).getTime()
          : today.getTime())) /
        (1000 * 60 * 60 * 24)
    );
    response += `**${index + 1}. Job ${order.jobNumber}** - ${
      order.customer?.company
    }\n`;
    response += `   Due: ${
      order.requestedShipDate?.split("T")[0]
    } (${daysOverdue} days overdue)\n`;
    response += `   Status: ${order.status} | Value: $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}\n\n`;
  });

  if (overdue.length > 8) {
    response += `... and ${overdue.length - 8} more overdue orders.\n\n`;
  }

  response += `💡 Ask "prioritize by value", "contact info", or "show more details" for additional information.`;

  return { response, orderIds: overdue.map((o) => o.jobNumber) };
}

function handleCustomerQuery(
  orders: Order[],
  customerName: string,
  context: any
): { response: string; orderIds: string[] } {
  const customerOrders = orders.filter((order) =>
    order.customer?.company?.toLowerCase().includes(customerName.toLowerCase())
  );

  if (customerOrders.length === 0) {
    return {
      response: `## 🔍 Customer Search\n\nI couldn't find any orders for "${customerName}". Could you check the spelling or try a partial company name?`,
      orderIds: [],
    };
  }

  const actualCustomerName = customerOrders[0].customer?.company;
  const totalValue = customerOrders.reduce(
    (sum, order) => sum + (order.pricing?.totalDue || 0),
    0
  );
  const recentOrders = customerOrders
    .sort(
      (a, b) =>
        (b.requestedShipDate ? new Date(b.requestedShipDate).getTime() : 0) -
        (a.requestedShipDate ? new Date(a.requestedShipDate).getTime() : 0)
    )
    .slice(0, 5);

  let response = `## 🏢 Orders for ${actualCustomerName}\n\n`;
  response += `**Summary:** ${
    customerOrders.length
  } orders totaling $${totalValue.toLocaleString()}\n\n`;
  response += `**Recent Orders:**\n`;

  recentOrders.forEach((order, index) => {
    response += `**${index + 1}. Job ${order.jobNumber}** - ${order.status}\n`;
    response += `   Description: ${order.description}\n`;
    response += `   Due: ${
      order.requestedShipDate?.split("T")[0] || "Not set"
    } | Value: $${(order.pricing?.totalDue || 0).toLocaleString()}\n\n`;
  });

  if (customerOrders.length > 5) {
    response += `... and ${customerOrders.length - 5} more orders.\n\n`;
  }

  response += `💡 Ask for "contact details", "payment history", or "rush orders" for this customer.`;

  return { response, orderIds: customerOrders.map((o) => o.jobNumber) };
}

function handleJobQuery(
  orders: Order[],
  jobNumber: string,
  context: any
): { response: string; context: any } {
  const order = orders.find((o) => o.jobNumber === jobNumber);

  if (!order) {
    return {
      response: `## 🔍 Job Search\n\nJob ${jobNumber} not found. Please check the job number and try again.`,
      context,
    };
  }

  let response = `## 📋 Job ${order.jobNumber} Details\n\n`;
  response += `**Customer:** ${order.customer?.company || "Unknown"}\n`;
  response += `**Description:** ${order.description || "No description"}\n`;
  response += `**Status:** ${order.status}\n`;
  response += `**Due Date:** ${
    order.requestedShipDate?.split("T")[0] || "Not set"
  }\n`;
  response += `**Priority:** ${order.priority || "Normal"}\n`;
  response += `**Value:** $${(
    order.pricing?.totalDue || 0
  ).toLocaleString()}\n`;

  if (order.workflow?.isRush) {
    response += `**Rush Order:** 🚨 Yes\n`;
  }

  response += `\n💡 Ask for "customer contact", "production status", or "payment details" for more info.`;

  return { response, context };
}

function handleStatusQuery(
  orders: Order[],
  query: string,
  context: any
): { response: string; context: any } {
  const statusCounts = orders.reduce((acc, order) => {
    const status = order.status || "Unknown";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  let response = `## 📊 Order Status Overview\n\n`;
  Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([status, count]) => {
      response += `**${status}:** ${count} orders\n`;
    });

  response += `\n💡 Ask about specific statuses like "pending orders" or "completed orders" for details.`;

  return { response, context };
}

function handleTopCustomersQuery(
  orders: Order[],
  context: any
): { response: string; context: any } {
  const customerRevenue = new Map<
    string,
    { revenue: number; orderCount: number }
  >();

  orders.forEach((order) => {
    const customerName = order.customer?.company || "Unknown Customer";
    const revenue = order.pricing?.totalDue || 0;

    if (customerRevenue.has(customerName)) {
      const existing = customerRevenue.get(customerName)!;
      customerRevenue.set(customerName, {
        revenue: existing.revenue + revenue,
        orderCount: existing.orderCount + 1,
      });
    } else {
      customerRevenue.set(customerName, { revenue, orderCount: 1 });
    }
  });

  const topCustomers = Array.from(customerRevenue.entries())
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      orderCount: data.orderCount,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  let response = "## 🏆 Top Customers by Revenue\n\n";
  topCustomers.forEach((customer, index) => {
    response += `**${index + 1}. ${customer.name}**\n`;
    response += `   Revenue: $${customer.revenue.toLocaleString()} (${
      customer.orderCount
    } orders)\n`;
    response += `   Average Order: $${Math.round(
      customer.revenue / customer.orderCount
    ).toLocaleString()}\n\n`;
  });

  response += `💡 Ask for "orders for [customer name]" to see details for any customer.`;

  return { response, context };
}

function handleRevenueQuery(
  orders: Order[],
  context: any
): { response: string; context: any } {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.pricing?.totalDue || 0),
    0
  );
  const avgOrder = totalRevenue / orders.length;

  let response = `## 💰 Revenue Summary\n\n`;
  response += `**Total Revenue:** $${totalRevenue.toLocaleString()}\n`;
  response += `**Total Orders:** ${orders.length}\n`;
  response += `**Average Order Value:** $${Math.round(
    avgOrder
  ).toLocaleString()}\n\n`;

  const monthlyRevenue = orders.reduce((acc, order) => {
    if (order.requestedShipDate) {
      const month = order.requestedShipDate.substring(0, 7);
      acc[month] = (acc[month] || 0) + (order.pricing?.totalDue || 0);
    }
    return acc;
  }, {} as Record<string, number>);

  const recentMonths = Object.entries(monthlyRevenue)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);

  if (recentMonths.length > 0) {
    response += `**Recent Monthly Revenue:**\n`;
    recentMonths.forEach(([month, revenue]) => {
      response += `${month}: $${revenue.toLocaleString()}\n`;
    });
  }

  response += `\n💡 Ask for "top customers" or "orders by month" for more details.`;

  return { response, context };
}

function handleRushQuery(
  orders: Order[],
  context: any
): { response: string; orderIds: string[] } {
  const rushOrders = orders.filter(
    (order) =>
      order.priority === "MUST" ||
      order.priority === "HIGH" ||
      order.status.toLowerCase().includes("rush") ||
      order.workflow?.isRush
  );

  if (rushOrders.length === 0) {
    return {
      response:
        "## 🚨 Rush Orders\n\nNo rush or urgent orders found. All orders are running at normal priority.",
      orderIds: [],
    };
  }

  let response = `## 🚨 Rush/Priority Orders (${rushOrders.length})\n\n`;
  rushOrders.slice(0, 10).forEach((order, index) => {
    response += `**${index + 1}. Job ${order.jobNumber}** - ${
      order.customer?.company
    }\n`;
    response += `   Description: ${order.description}\n`;
    response += `   Priority: ${order.priority || "Rush"} | Due: ${
      order.requestedShipDate?.split("T")[0] || "Not set"
    }\n`;
    response += `   Value: $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}\n\n`;
  });

  if (rushOrders.length > 10) {
    response += `... and ${rushOrders.length - 10} more rush orders.\n\n`;
  }

  response += `💡 Ask for "contact info" or "production status" for these priority orders.`;

  return { response, orderIds: rushOrders.map((o) => o.jobNumber) };
}

function handleDefaultQuery(
  orders: Order[],
  query: string,
  context: any
): { response: string; context: any } {
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.pricing?.totalDue || 0),
    0
  );
  const recentOrders = orders
    .sort(
      (a, b) =>
        (b.requestedShipDate ? new Date(b.requestedShipDate).getTime() : 0) -
        (a.requestedShipDate ? new Date(a.requestedShipDate).getTime() : 0)
    )
    .slice(0, 5);

  let response = `## 📊 Order Management Overview\n\n`;
  response += `**Total Orders:** ${orders.length}\n`;
  response += `**Total Value:** $${totalRevenue.toLocaleString()}\n`;
  response += `**Average Order:** $${Math.round(
    totalRevenue / orders.length
  ).toLocaleString()}\n\n`;

  response += `**Recent Orders:**\n`;
  recentOrders.forEach((order, index) => {
    response += `**${index + 1}.** Job ${order.jobNumber}: ${
      order.customer?.company
    } - ${order.status}\n`;
  });

  response += `\n💡 Try asking: "orders due today", "overdue orders", "top customers", or search for a specific job number.`;

  return { response, context };
}

// Expansion functions for follow-ups
function expandDueTodayDetails(
  orders: Order[],
  context: any
): { response: string; context: any } {
  const orderIds = context.shownOrders || [];
  const relevantOrders = orders.filter((o) => orderIds.includes(o.jobNumber));

  if (relevantOrders.length === 0) {
    return {
      response:
        "I don't have additional details for the previously shown orders.",
      context,
    };
  }

  let response = `## 📋 Detailed Information for Today's Orders\n\n`;

  relevantOrders.forEach((order, index) => {
    response += `### Order ${index + 1}: Job ${order.jobNumber}\n`;
    response += `**Company:** ${order.customer?.company}\n`;
    response += `**Contact:** ${
      order.customer?.contactPerson || "Not available"
    }\n`;
    response += `**Phone:** ${order.customer?.phone || "Not available"}\n`;
    response += `**Email:** ${order.customer?.email || "Not available"}\n`;
    response += `**Description:** ${order.description}\n`;
    response += `**Production Status:** ${
      order.workflow?.isRush ? "Rush Order" : "Standard"
    }\n`;
    response += `**Priority:** ${order.priority || "Normal"}\n`;
    response += `**Value:** $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}\n\n`;
  });

  return { response, context };
}

function expandCustomerDetails(
  orders: Order[],
  customerName: string,
  context: any
): { response: string; context: any } {
  const customerOrders = orders.filter((order) =>
    order.customer?.company?.toLowerCase().includes(customerName.toLowerCase())
  );

  if (customerOrders.length === 0) {
    return {
      response: `No additional details found for "${customerName}".`,
      context,
    };
  }

  const customer = customerOrders[0].customer;
  let response = `## 📞 Contact Details for ${customer?.company}\n\n`;
  response += `**Contact Person:** ${
    customer?.contactPerson || "Not available"
  }\n`;
  response += `**Phone:** ${customer?.phone || "Not available"}\n`;
  response += `**Email:** ${customer?.email || "Not available"}\n\n`;

  const totalValue = customerOrders.reduce(
    (sum, order) => sum + (order.pricing?.totalDue || 0),
    0
  );
  response += `**Order History:** ${
    customerOrders.length
  } orders totaling $${totalValue.toLocaleString()}\n`;

  return { response, context };
}

function expandJobDetails(
  orders: Order[],
  jobNumber: string,
  context: any
): { response: string; context: any } {
  const order = orders.find((o) => o.jobNumber === jobNumber);

  if (!order) {
    return {
      response: `No additional details found for Job ${jobNumber}.`,
      context,
    };
  }

  let response = `## 📋 Extended Details for Job ${order.jobNumber}\n\n`;
  response += `**Customer Contact Information:**\n`;
  response += `- Company: ${order.customer?.company}\n`;
  response += `- Contact: ${
    order.customer?.contactPerson || "Not available"
  }\n`;
  response += `- Phone: ${order.customer?.phone || "Not available"}\n`;
  response += `- Email: ${order.customer?.email || "Not available"}\n\n`;

  response += `**Order Details:**\n`;
  response += `- Description: ${order.description}\n`;
  response += `- Status: ${order.status}\n`;
  response += `- Priority: ${order.priority || "Normal"}\n`;
  response += `- Due Date: ${
    order.requestedShipDate?.split("T")[0] || "Not set"
  }\n`;
  response += `- Value: $${(order.pricing?.totalDue || 0).toLocaleString()}\n`;

  if (order.workflow) {
    response += `\n**Production Information:**\n`;
    response += `- Rush Order: ${order.workflow.isRush ? "Yes" : "No"}\n`;
  }

  return { response, context };
}

function expandOverdueDetails(
  orders: Order[],
  context: any
): { response: string; context: any } {
  const orderIds = context.shownOrders || [];
  const relevantOrders = orders.filter((o) => orderIds.includes(o.jobNumber));

  if (relevantOrders.length === 0) {
    return {
      response:
        "I don't have additional details for the previously shown overdue orders.",
      context,
    };
  }

  let response = `## 📞 Contact Information for Overdue Orders\n\n`;

  relevantOrders.forEach((order, index) => {
    const daysOverdue = Math.floor(
      (new Date().getTime() -
        (order.requestedShipDate
          ? new Date(order.requestedShipDate).getTime()
          : 0)) /
        (1000 * 60 * 60 * 24)
    );
    response += `### ${index + 1}. Job ${
      order.jobNumber
    } (${daysOverdue} days overdue)\n`;
    response += `**Company:** ${order.customer?.company}\n`;
    response += `**Contact:** ${
      order.customer?.contactPerson || "Not available"
    }\n`;
    response += `**Phone:** ${order.customer?.phone || "Not available"}\n`;
    response += `**Email:** ${order.customer?.email || "Not available"}\n`;
    response += `**Value:** $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}\n\n`;
  });

  return { response, context };
}

function generateContextualSuggestions(
  context: any,
  orders: Order[]
): string[] {
  const baseSuggestions = [
    "Orders due today",
    "Show overdue orders",
    "Top customers",
  ];

  if (context.lastQuery === "due_today") {
    return ["Show more details", "Contact information", "Production status"];
  }

  if (context.focusedCustomer) {
    return [
      "Contact details",
      "Payment history",
      "All orders for this customer",
    ];
  }

  if (context.lastQuery === "overdue") {
    return ["Show contact info", "Prioritize by value", "Sort by days overdue"];
  }

  if (context.lastQuery === "job_detail") {
    return ["Customer contact", "Production status", "Similar orders"];
  }

  if (context.lastQuery === "customer") {
    return ["Contact details", "Order history", "Recent orders"];
  }

  return baseSuggestions;
}

export async function POST(request: NextRequest) {
  let sessionId = "default";

  try {
    const body = await request.json();
    const { message } = body;
    sessionId = body.sessionId || "default";

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Please provide a valid message",
          suggestions: [
            "Orders due today",
            "Show me overdue orders",
            "Search for job 12345",
          ],
        },
        { status: 400 }
      );
    }

    cleanupOldConversations();
    const session = getConversationSession(sessionId);
    session.lastActivity = Date.now();

    // Load OMS data
    let orders;
    try {
      orders = await omsDataService.getOrders();
    } catch (error) {
      console.error("Error loading OMS data:", error);
      return NextResponse.json(
        {
          error: "Unable to access order data",
          message:
            "I'm having trouble accessing the order data right now. Please try again in a moment.",
        },
        { status: 500 }
      );
    }

    // Generate contextual response
    const result = generateContextualResponse(
      orders,
      message,
      session.messages,
      session.context
    );

    // Update conversation history with context
    session.messages.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    session.messages.push({
      role: "assistant",
      content: result.response,
      timestamp: Date.now(),
      context: result.context,
    });

    // Update session context
    session.context = result.context;

    // Keep conversation manageable
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    // Generate contextual suggestions
    const suggestions = generateContextualSuggestions(result.context, orders);

    return NextResponse.json({
      message: result.response,
      data: {
        orderCount: orders.length,
        queryType: result.context.lastQuery || "general",
        context: result.context,
      },
      suggestions,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId,
        conversationLength: session.messages.length,
      },
    });
  } catch (error) {
    console.error("Error in OMS chat:", error);
    return NextResponse.json(
      {
        error: "Unable to process request",
        message:
          "I'm experiencing technical difficulties. Please try a simpler query.",
      },
      { status: 500 }
    );
  }
}

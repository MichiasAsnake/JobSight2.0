import { NextRequest, NextResponse } from "next/server";
import { omsDataService, Order } from "@/lib/oms-data";

// Store conversations in memory (in production, use Redis or database)
interface ConversationMessage {
  role: string;
  content: string;
  timestamp: number;
}

const conversations: Record<
  string,
  { messages: ConversationMessage[]; lastActivity: number }
> = {};

// Clean up old conversations (older than 1 hour)
function cleanupOldConversations() {
  const oneHour = 60 * 60 * 1000;
  const now = Date.now();
  Object.keys(conversations).forEach((sessionId) => {
    if (now - conversations[sessionId].lastActivity > oneHour) {
      delete conversations[sessionId];
    }
  });
}

// Function to get or create conversation session
function getConversationSession(sessionId: string) {
  if (!conversations[sessionId]) {
    conversations[sessionId] = { messages: [], lastActivity: Date.now() };
  }
  return conversations[sessionId];
}

// Function to get Pacific Time date string
function getPacificDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Function to get Pacific Time date object
function getPacificDate(date: Date = new Date()): Date {
  try {
    if (isNaN(date.getTime())) {
      console.warn("Invalid date passed to getPacificDate, using current date");
      date = new Date();
    }

    const pacificTime = new Date(
      date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
    );

    if (isNaN(pacificTime.getTime())) {
      console.warn(
        "Failed to convert to Pacific time, returning original date"
      );
      return date;
    }

    return pacificTime;
  } catch (error) {
    console.error("Error in getPacificDate:", error);
    return new Date();
  }
}

// Simple, direct response function - no complex classification
function generateSimpleResponse(orders: Order[], query: string): string {
  const searchTerm = query.toLowerCase().trim();

  // Handle "due today" queries
  if (
    searchTerm.includes("due today") ||
    searchTerm.includes("whats due") ||
    searchTerm.includes("what's due")
  ) {
    const today = getPacificDateString();
    console.log(`Looking for orders due today: ${today}`);

    const dueToday = orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDateStr = order.requestedShipDate.split("T")[0]; // Handle both "2025-06-28" and ISO formats
        return shipDateStr === today;
      } catch (error) {
        return false;
      }
    });

    console.log(`Found ${dueToday.length} orders due today`);

    if (dueToday.length === 0) {
      return `## Orders Due Today\n\nNo orders are due today (${today}).\n\n**Recent upcoming orders:**\n${orders
        .slice(0, 5)
        .map(
          (o) =>
            `- Job ${o.jobNumber}: ${o.customer?.company} - Due ${o.requestedShipDate}`
        )
        .join("\n")}`;
    }

    let response = `## Orders Due Today (${today})\n\n`;
    dueToday.forEach((order, index) => {
      response += `${index + 1}. **Job ${order.jobNumber}** - ${
        order.customer?.company
      }\n`;
      response += `   ${order.description} | Status: ${order.status} | $${(
        order.pricing?.totalDue || 0
      ).toLocaleString()}\n\n`;
    });

    return response;
  }

  // Handle "overdue" queries
  if (searchTerm.includes("overdue") || searchTerm.includes("late")) {
    const today = new Date();
    const overdue = orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        return shipDate < today && order.status.toLowerCase() !== "closed";
      } catch (error) {
        return false;
      }
    });

    if (overdue.length === 0) {
      return `## Overdue Orders\n\nNo orders are currently overdue.\n\n**Recent orders:**\n${orders
        .slice(0, 5)
        .map(
          (o) => `- Job ${o.jobNumber}: ${o.customer?.company} - ${o.status}`
        )
        .join("\n")}`;
    }

    let response = `## Overdue Orders\n\n`;
    overdue.slice(0, 10).forEach((order, index) => {
      response += `${index + 1}. **Job ${order.jobNumber}** - ${
        order.customer?.company
      }\n`;
      response += `   Due: ${order.requestedShipDate} | Status: ${
        order.status
      } | $${(order.pricing?.totalDue || 0).toLocaleString()}\n\n`;
    });

    return response;
  }

  // Handle "top customers" queries
  if (
    searchTerm.includes("top customer") ||
    searchTerm.includes("best customer")
  ) {
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

    let response = "## Top Customers by Revenue\n\n";
    topCustomers.forEach((customer, index) => {
      response += `${index + 1}. **${
        customer.name
      }** - $${customer.revenue.toLocaleString()} (${
        customer.orderCount
      } orders)\n`;
    });

    return response;
  }

  // Handle "revenue" queries
  if (searchTerm.includes("revenue") || searchTerm.includes("total")) {
    const totalRevenue = orders.reduce(
      (sum, order) => sum + (order.pricing?.totalDue || 0),
      0
    );
    return `## Revenue Summary\n\n**Total Revenue:** $${totalRevenue.toLocaleString()}\n**Total Orders:** ${
      orders.length
    }\n**Average Order:** $${Math.round(
      totalRevenue / orders.length
    ).toLocaleString()}`;
  }

  // Handle "rush" queries
  if (searchTerm.includes("rush") || searchTerm.includes("urgent")) {
    const rushOrders = orders.filter(
      (order) =>
        order.priority === "MUST" ||
        order.status.toLowerCase().includes("rush") ||
        order.workflow?.isRush
    );

    if (rushOrders.length === 0) {
      return "## Rush Orders\n\nNo rush orders found.";
    }

    let response = `## Rush Orders\n\n`;
    rushOrders.slice(0, 10).forEach((order, index) => {
      response += `${index + 1}. **Job ${order.jobNumber}** - ${
        order.customer?.company
      }\n`;
      response += `   ${order.description} | Due: ${
        order.requestedShipDate
      } | $${(order.pricing?.totalDue || 0).toLocaleString()}\n\n`;
    });

    return response;
  }

  // Handle job number queries
  const jobMatch = searchTerm.match(/job\s*(\d+)/i);
  if (jobMatch) {
    const jobNumber = jobMatch[1];
    const order = orders.find((o) => o.jobNumber === jobNumber);

    if (!order) {
      return `## Job Search\n\nJob ${jobNumber} not found.`;
    }

    return `## Job ${order.jobNumber} Details\n\n**Customer:** ${
      order.customer?.company
    }\n**Description:** ${order.description}\n**Status:** ${
      order.status
    }\n**Due Date:** ${order.requestedShipDate}\n**Value:** $${(
      order.pricing?.totalDue || 0
    ).toLocaleString()}`;
  }

  // Handle customer queries
  const customerMatch = searchTerm.match(/(?:orders?\s+for|customer)\s+(.+)/i);
  if (customerMatch) {
    const customerName = customerMatch[1].trim();
    const customerOrders = orders.filter((order) =>
      order.customer.company.toLowerCase().includes(customerName.toLowerCase())
    );

    if (customerOrders.length === 0) {
      return `## Customer Search\n\nNo orders found for "${customerName}".`;
    }

    const totalValue = customerOrders.reduce(
      (sum, order) => sum + (order.pricing?.totalDue || 0),
      0
    );

    let response = `## Orders for ${customerOrders[0].customer?.company}\n\n`;
    response += `**Total Orders:** ${customerOrders.length}\n`;
    response += `**Total Value:** $${totalValue.toLocaleString()}\n\n`;

    customerOrders.slice(0, 10).forEach((order, index) => {
      response += `${index + 1}. Job ${order.jobNumber}: ${
        order.description
      } - ${order.status} ($${(
        order.pricing?.totalDue || 0
      ).toLocaleString()})\n`;
    });

    return response;
  }

  // Default: show recent orders
  const totalRevenue = orders.reduce(
    (sum, order) => sum + (order.pricing?.totalDue || 0),
    0
  );
  let response = `## Recent Orders\n\n`;
  response += `**Total Orders:** ${orders.length}\n`;
  response += `**Total Value:** $${totalRevenue.toLocaleString()}\n\n`;

  orders.slice(0, 10).forEach((order, index) => {
    response += `${index + 1}. Job ${order.jobNumber}: ${
      order.customer?.company
    } - ${order.status} ($${(
      order.pricing?.totalDue || 0
    ).toLocaleString()})\n`;
  });

  return response;
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
          suggestions: ["Try asking about orders", "Search for a job number"],
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

    // Generate simple, direct response
    const response = generateSimpleResponse(orders, message);

    // Update conversation history
    session.messages.push({
      role: "user",
      content: message.substring(0, 200),
      timestamp: Date.now(),
    });
    session.messages.push({
      role: "assistant",
      content: response.substring(0, 200),
      timestamp: Date.now(),
    });

    // Keep only last 4 messages
    if (session.messages.length > 4) {
      session.messages = session.messages.slice(-4);
    }

    return NextResponse.json({
      message: response,
      data: {
        orderCount: orders.length,
        queryType: "direct",
      },
      suggestions: ["Due today", "Top customers", "Rush orders"],
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

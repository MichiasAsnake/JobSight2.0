import { NextRequest, NextResponse } from "next/server";
import { omsDataService } from "@/lib/oms-data";
import OpenAI from "openai";

const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

// Function to search and filter orders based on user query
function searchOrders(orders: any[], query: string) {
  const searchTerm = query.toLowerCase();
  const today = new Date();

  // Check for specific query patterns
  if (
    searchTerm.includes("overdue") ||
    searchTerm.includes("late") ||
    searchTerm.includes("past due")
  ) {
    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      const shipDate = new Date(order.requestedShipDate);
      return shipDate < today && order.status !== "Closed";
    });
  }

  if (searchTerm.includes("due today") || searchTerm.includes("due now")) {
    const todayStr = today.toISOString().split("T")[0];
    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      const shipDate = new Date(order.requestedShipDate);
      const shipDateStr = shipDate.toISOString().split("T")[0];
      return shipDateStr === todayStr;
    });
  }

  if (
    searchTerm.includes("rush") ||
    searchTerm.includes("priority") ||
    searchTerm.includes("urgent")
  ) {
    return orders.filter(
      (order) =>
        order.priority === "MUST" ||
        order.workflow?.isRush ||
        order.status.toLowerCase().includes("rush")
    );
  }

  if (searchTerm.includes("job") || searchTerm.includes("order")) {
    const jobMatch = query.match(/(?:job|order)\s*(?:number\s*)?(\d+)/i);
    if (jobMatch) {
      const jobNumber = jobMatch[1];
      return orders.filter((order) => order.jobNumber === jobNumber);
    }
  }

  if (searchTerm.includes("customer") || searchTerm.includes("company")) {
    const customerMatch = query.match(/(?:customer|company)\s+(.+)/i);
    if (customerMatch) {
      const customerName = customerMatch[1].trim();
      return orders.filter((order) =>
        order.customer.company
          .toLowerCase()
          .includes(customerName.toLowerCase())
      );
    }
  }

  if (searchTerm.includes("status") || searchTerm.includes("recent")) {
    // Return recent orders (last 10)
    return orders
      .sort(
        (a, b) =>
          new Date(b.dateEntered).getTime() - new Date(a.dateEntered).getTime()
      )
      .slice(0, 10);
  }

  // Default: return all orders if no specific pattern matches
  return orders;
}

// Function to format order data for inclusion in prompt
function formatOrdersForPrompt(orders: any[]) {
  if (orders.length === 0) return "No orders found matching your query.";

  return orders
    .map(
      (order) => `
Job ${order.jobNumber}:
- Order: ${order.orderNumber}
- Status: ${order.status}
- Priority: ${order.priority}
- Customer: ${order.customer.company}
- Contact: ${order.customer.contactPerson}
- Description: ${order.description}
- Requested Ship Date: ${order.requestedShipDate || "Not set"}
- Total Due: $${order.pricing.totalDue.toLocaleString()}
- Line Items: ${order.lineItems.length} items
- Shipments: ${order.shipments.length} shipments
`
    )
    .join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json();

    // Load OMS data
    const orders = await omsDataService.getOrders();
    const stats = await omsDataService.getSummaryStats();

    // Search for relevant orders based on the query
    const relevantOrders = searchOrders(orders, message);
    const orderDetails = formatOrdersForPrompt(relevantOrders);

    // Create context-rich prompt for ChatGPT
    const systemPrompt = `You are an intelligent OMS (Order Management System) assistant for DecoPress, a custom apparel and promotional products company. 

You have access to the following order data:
- Total Orders: ${stats.totalOrders}
- Total Value: $${stats.totalValue.toLocaleString()}
- Average Order Value: $${stats.averageOrderValue.toLocaleString()}
- Last Updated: ${stats.lastUpdated}

RELEVANT ORDER DETAILS:
${orderDetails}

Key Order Information Available:
- Job Numbers, Order Numbers, Status, Priority
- Customer details (company, contact person, phone, email)
- Order descriptions, comments, pricing
- Shipment information and addresses
- Line items with SKUs, quantities, prices
- Workflow status (files, proofs, packing slips)
- Production information and tags

Your capabilities:
1. Answer questions about specific orders by job number or order number
2. Provide customer information and order history
3. Analyze order patterns and trends
4. Help with order status and workflow questions
5. Provide pricing and financial insights
6. Help with shipping and logistics questions
7. Identify rush orders, late orders, and priority items

Always be helpful, professional, and provide specific information when available. Use the order details provided above to give accurate, specific answers.`;

    // Create user message with context
    const userMessage = `User Query: ${message}

Available Context: ${context || "No specific context provided"}

Please provide a helpful response based on the OMS data available.`;

    // If OpenAI API key is set, use real API
    if (openai) {
      const chatCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.2,
        max_tokens: 800,
      });
      const response =
        chatCompletion.choices[0]?.message?.content ||
        "No response from OpenAI.";
      return NextResponse.json({
        response,
        timestamp: new Date().toISOString(),
      });
    }

    // Fallback: Simulated response
    const response = await simulateChatGPTResponse(
      systemPrompt,
      userMessage,
      orders,
      stats
    );
    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error in OMS chat API:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function simulateChatGPTResponse(
  systemPrompt: string,
  userMessage: string,
  orders: any[],
  stats: any
): Promise<string> {
  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const message = userMessage.toLowerCase();

  // Handle different types of queries
  if (message.includes("job") || message.includes("order")) {
    const jobMatch = message.match(/(?:job|order)\s*(?:number\s*)?(\d+)/i);
    if (jobMatch) {
      const jobNumber = jobMatch[1];
      const order = orders.find((o) => o.jobNumber === jobNumber);
      if (order) {
        return `Here's information about Job ${jobNumber}:

**Order Details:**
- Order Number: ${order.orderNumber}
- Status: ${order.status}
- Priority: ${order.priority}
- Description: ${order.description}

**Customer:**
- Company: ${order.customer.company}
- Contact: ${order.customer.contactPerson}
- Phone: ${order.customer.phone}
- Email: ${order.customer.email}

**Financial:**
- Total Due: $${order.pricing.totalDue.toLocaleString()}
- Subtotal: $${order.pricing.subtotal.toLocaleString()}
- Tax: $${order.pricing.salesTax.toLocaleString()}

**Line Items:** ${order.lineItems.length} items
**Shipments:** ${order.shipments.length} shipments

Would you like more specific details about any aspect of this order?`;
      } else {
        return `I couldn't find Job ${jobNumber} in the current order data. The system contains ${orders.length} orders. Would you like me to search for similar job numbers or help you with something else?`;
      }
    }
  }

  if (message.includes("customer") || message.includes("company")) {
    const customerMatch = message.match(/(?:customer|company)\s+(.+)/i);
    if (customerMatch) {
      const customerName = customerMatch[1].trim();
      const customerOrders = orders.filter((o) =>
        o.customer.company.toLowerCase().includes(customerName.toLowerCase())
      );

      if (customerOrders.length > 0) {
        const totalValue = customerOrders.reduce(
          (sum, o) => sum + o.pricing.totalDue,
          0
        );
        return `I found ${customerOrders.length} orders for ${
          customerOrders[0].customer.company
        }:

**Summary:**
- Total Orders: ${customerOrders.length}
- Total Value: $${totalValue.toLocaleString()}
- Average Order Value: $${(totalValue / customerOrders.length).toLocaleString()}

**Recent Orders:**
${customerOrders
  .slice(0, 3)
  .map(
    (o) =>
      `- Job ${o.jobNumber}: ${o.description} (${
        o.status
      }) - $${o.pricing.totalDue.toLocaleString()}`
  )
  .join("\n")}

Would you like details about a specific order or more information about this customer?`;
      }
    }
  }

  if (message.includes("rush") || message.includes("priority")) {
    const rushOrders = orders.filter(
      (o) =>
        o.priority === "MUST" ||
        o.workflow.isRush ||
        o.status.toLowerCase().includes("rush")
    );

    if (rushOrders.length > 0) {
      return `I found ${rushOrders.length} rush/priority orders:

${rushOrders
  .slice(0, 5)
  .map(
    (o) =>
      `- Job ${o.jobNumber}: ${o.customer.company} - ${o.description} (${o.status})`
  )
  .join("\n")}

${
  rushOrders.length > 5
    ? `... and ${rushOrders.length - 5} more rush orders.`
    : ""
}

Would you like details about any specific rush order?`;
    } else {
      return "Currently there are no rush or priority orders in the system.";
    }
  }

  if (
    message.includes("overdue") ||
    message.includes("late") ||
    message.includes("past due")
  ) {
    const today = new Date();
    const lateOrders = orders.filter((o) => {
      if (!o.requestedShipDate) return false;
      const shipDate = new Date(o.requestedShipDate);
      return shipDate < today && o.status !== "Closed";
    });

    if (lateOrders.length > 0) {
      return `I found ${lateOrders.length} overdue orders:

${lateOrders
  .slice(0, 5)
  .map((o) => {
    const shipDate = new Date(o.requestedShipDate);
    const daysLate = Math.floor(
      (today.getTime() - shipDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `- Job ${o.jobNumber}: ${o.customer.company} - ${o.description} (${daysLate} days late)`;
  })
  .join("\n")}

${
  lateOrders.length > 5
    ? `... and ${lateOrders.length - 5} more overdue orders.`
    : ""
}

Would you like details about any specific overdue order?`;
    } else {
      return "Currently there are no overdue orders in the system.";
    }
  }

  if (message.includes("due today")) {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dueTodayOrders = orders.filter((o) => {
      if (!o.requestedShipDate) return false;
      const shipDate = new Date(o.requestedShipDate);
      const shipDateStr = shipDate.toISOString().split("T")[0];
      return shipDateStr === todayStr;
    });

    if (dueTodayOrders.length > 0) {
      return `I found ${dueTodayOrders.length} orders due today:

${dueTodayOrders
  .map(
    (o) =>
      `- Job ${o.jobNumber}: ${o.customer.company} - ${o.description} (${o.status})`
  )
  .join("\n")}

Would you like details about any specific order due today?`;
    } else {
      return "No orders are due today.";
    }
  }

  if (
    message.includes("stats") ||
    message.includes("summary") ||
    message.includes("overview")
  ) {
    return `Here's an overview of the OMS data:

**General Statistics:**
- Total Orders: ${stats.totalOrders}
- Total Value: $${stats.totalValue.toLocaleString()}
- Average Order Value: $${stats.averageOrderValue.toLocaleString()}

**Status Breakdown:**
${Object.entries(stats.statusBreakdown)
  .map(([status, count]) => `- ${status}: ${count} orders`)
  .join("\n")}

**Top Customers:**
${stats.topCustomers
  .map((c: any) => `- ${c.customer}: ${c.count} orders`)
  .join("\n")}

**Last Updated:** ${new Date(stats.lastUpdated).toLocaleDateString()}

Is there anything specific you'd like to know about the orders?`;
  }

  // Default response
  return `I'm your OMS assistant! I can help you with:

• **Order Information**: Ask about specific jobs by number (e.g., "Tell me about job 51094")
• **Customer Data**: Get customer details and order history
• **Rush Orders**: Find priority and rush orders
• **Overdue Orders**: Find orders past their ship date
• **Due Today**: Find orders due today
• **Statistics**: Get overview and summary data
• **Search**: Find orders by customer, status, or description

What would you like to know about the orders?`;
}

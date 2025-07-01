import { NextRequest, NextResponse } from "next/server";
import { omsDataService } from "@/lib/oms-data";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface SessionContext {
  lastQuery?: string;
  focusedCustomer?: string;
  shownOrders?: string[];
  currentFilter?: string;
  focusedJob?: string;
}

interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  context?: {
    queryType?: string;
    ordersShown?: string[];
    customerFocus?: string;
    lastAction?: string;
  };
}

interface ConversationSession {
  messages: ConversationMessage[];
  lastActivity: number;
  context: SessionContext;
}

const conversations: Record<string, ConversationSession> = {};

function cleanupOldConversations() {
  const oneHour = 60 * 60 * 1000;
  const now = Date.now();
  Object.keys(conversations).forEach((sessionId) => {
    if (now - conversations[sessionId].lastActivity > oneHour) {
      delete conversations[sessionId];
    }
  });
}

function getConversationSession(sessionId: string): ConversationSession {
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

// Function calling tools for ChatGPT
const tools = [
  {
    type: "function" as const,
    function: {
      name: "get_orders_by_status",
      description:
        "Get orders filtered by status (e.g., 'In Production', 'Shipped', 'Complete')",
      parameters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            description: "The order status to filter by",
          },
        },
        required: ["status"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_orders_due_today",
      description: "Get all orders that are due today",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_overdue_orders",
      description:
        "Get all orders that are overdue (past their requested ship date)",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_orders_by_customer",
      description: "Get orders for a specific customer or company",
      parameters: {
        type: "object",
        properties: {
          customerName: {
            type: "string",
            description: "The customer or company name to search for",
          },
        },
        required: ["customerName"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_order_by_job_number",
      description: "Get a specific order by its job number",
      parameters: {
        type: "object",
        properties: {
          jobNumber: {
            type: "string",
            description: "The job number to search for",
          },
        },
        required: ["jobNumber"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_rush_orders",
      description: "Get all rush/urgent orders",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_orders",
      description:
        "Search orders by any text (job number, customer, description, etc.)",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search term to look for",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_orders_summary",
      description: "Get summary statistics about all orders",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
];

// Function implementations
async function executeFunction(
  name: string,
  args: Record<string, string>
): Promise<string> {
  try {
    switch (name) {
      case "get_orders_by_status": {
        const orders = await omsDataService.getOrdersByStatus(args.status);
        return JSON.stringify({
          count: orders.length,
          orders: orders.slice(0, 20), // Limit to prevent token overflow
        });
      }

      case "get_orders_due_today": {
        const orders = await omsDataService.getOrders();
        const today = new Date().toISOString().split("T")[0];
        const dueToday = orders.filter(
          (order) => order.requestedShipDate?.split("T")[0] === today
        );
        return JSON.stringify({
          count: dueToday.length,
          orders: dueToday,
        });
      }

      case "get_overdue_orders": {
        const orders = await omsDataService.getLateOrders();
        return JSON.stringify({
          count: orders.length,
          orders: orders.slice(0, 20),
        });
      }

      case "get_orders_by_customer": {
        const orders = await omsDataService.getOrdersByCustomer(
          args.customerName
        );
        return JSON.stringify({
          count: orders.length,
          orders: orders.slice(0, 20),
        });
      }

      case "get_order_by_job_number": {
        const order = await omsDataService.getOrderByJobNumber(args.jobNumber);
        return JSON.stringify({
          order,
          found: !!order,
        });
      }

      case "get_rush_orders": {
        const orders = await omsDataService.getRushOrders();
        return JSON.stringify({
          count: orders.length,
          orders: orders.slice(0, 20),
        });
      }

      case "search_orders": {
        const orders = await omsDataService.searchOrdersByQuery(args.query);
        return JSON.stringify({
          count: orders.length,
          orders: orders.slice(0, 20),
        });
      }

      case "get_orders_summary": {
        const summary = await omsDataService.getSummaryStats();
        return JSON.stringify(summary);
      }

      default:
        return JSON.stringify({ error: `Unknown function: ${name}` });
    }
  } catch (error) {
    console.error(`Error executing function ${name}:`, error);
    return JSON.stringify({ error: `Failed to execute ${name}: ${error}` });
  }
}

export async function POST(request: NextRequest) {
  let sessionId = "default";

  try {
    const body = await request.json();
    const { message } = body;
    sessionId = body.sessionId || "default";

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: "OpenAI API key not configured",
          message:
            "Please add your OPENAI_API_KEY to your environment variables.",
        },
        { status: 500 }
      );
    }

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return NextResponse.json(
        {
          error: "Please provide a valid message",
          suggestions: [
            "What orders are due today?",
            "Show me overdue orders",
            "Tell me about our top customers",
            "What's the status of job 12345?",
          ],
        },
        { status: 400 }
      );
    }

    cleanupOldConversations();
    const session = getConversationSession(sessionId);
    session.lastActivity = Date.now();

    // Build conversation history for OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a friendly and knowledgeable business assistant who helps with order management. You have access to comprehensive order data and love helping people understand their business better.

You're conversational and natural in your responses - think of yourself as a helpful colleague who knows the business inside and out. When someone asks about orders, customers, or business performance, you dive into the data and explain things in a way that feels like you're having a real conversation.

Instead of using bullet points or formal lists, you speak naturally and weave important details like job numbers, customer names, dates, and dollar amounts into your conversation. You're enthusiastic about sharing insights and always ready to dig deeper when someone has follow-up questions.

You care about the business and want to help people make informed decisions, so you often provide context and suggestions based on what you see in the data.

Today's date: ${new Date().toLocaleDateString()}`,
      },
    ];

    // Add conversation history (last 10 messages to manage context)
    const recentMessages = session.messages.slice(-10);
    for (const msg of recentMessages) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: "user",
      content: message,
    });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseMessage = completion.choices[0].message;
    let finalResponse = responseMessage.content || "";

    // Handle function calls
    if (responseMessage.tool_calls) {
      const functionResults = [];

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);
        const functionResult = await executeFunction(
          functionName,
          functionArgs
        );

        functionResults.push({
          tool_call_id: toolCall.id,
          role: "tool" as const,
          content: functionResult,
        });
      }

      // Continue conversation with function results
      const followUpMessages = [
        ...messages,
        responseMessage,
        ...functionResults,
      ];

      const followUpCompletion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: followUpMessages,
        temperature: 0.3,
        max_tokens: 2000,
      });

      finalResponse = followUpCompletion.choices[0].message.content || "";
    }

    // Update conversation history
    session.messages.push({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    session.messages.push({
      role: "assistant",
      content: finalResponse,
      timestamp: Date.now(),
    });

    // Keep conversation manageable
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    return NextResponse.json({
      message: finalResponse,
      metadata: {
        timestamp: new Date().toISOString(),
        sessionId,
        conversationLength: session.messages.length,
      },
    });
  } catch (error) {
    console.error("Error in OMS chat:", error);

    if (error instanceof Error && error.message.includes("API key")) {
      return NextResponse.json(
        {
          error: "OpenAI API configuration error",
          message: "Please check your OpenAI API key configuration.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Unable to process request",
        message: "I'm experiencing technical difficulties. Please try again.",
      },
      { status: 500 }
    );
  }
}

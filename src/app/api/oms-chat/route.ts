import { NextRequest, NextResponse } from "next/server";
import { intelligentQueryRouter } from "../../../lib/query-router";
// Cleaned up - now uses only GPT-powered semantic search via intelligentQueryRouter
import { EnhancedRAGPipeline } from "../../../lib/enhanced-rag-pipeline";

// Initialize enhanced RAG pipeline for intelligent responses
const ragPipeline = new EnhancedRAGPipeline();

export async function POST(request: NextRequest) {
  try {
    // Add logging to see what's being received
    const rawBody = await request.text();
    console.log("[OMS-CHAT] Raw request body:", rawBody);

    let message: string;
    let sessionId: string;
    let conversationContext: string;
    try {
      const parsedBody = JSON.parse(rawBody);
      message = parsedBody.message;
      sessionId = parsedBody.sessionId;
      conversationContext = parsedBody.context;
    } catch (parseError) {
      console.error("[OMS-CHAT] JSON parse error:", parseError);
      console.error("[OMS-CHAT] Raw body that failed to parse:", rawBody);
      return NextResponse.json(
        {
          error: "Invalid JSON in request body",
          details:
            parseError instanceof Error
              ? parseError.message
              : "Unknown parse error",
          receivedBody: rawBody.substring(0, 200), // First 200 chars for debugging
        },
        { status: 400 }
      );
    }

    if (!message) {
      console.warn("[OMS-CHAT] No message provided in request body");
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log(`[OMS-CHAT] Incoming message: '${message}'`);
    console.log(`[OMS-CHAT] Session ID: '${sessionId}'`);
    console.log(`[OMS-CHAT] Conversation context: '${conversationContext}'`);

    // Check if this is a follow-up calculation query
    const isFollowUpCalculation = isFollowUpCalculationQuery(
      message,
      conversationContext
    );

    if (isFollowUpCalculation) {
      console.log(
        "🧮 Detected follow-up calculation query, processing with context..."
      );
      return await handleFollowUpCalculation(message, conversationContext);
    }

    // Step 1: Use intelligent query router to get data
    const routerResult = await intelligentQueryRouter.routeQuery(message);
    console.log("[OMS-CHAT] Router strategy:", routerResult.strategy);
    console.log(
      "[OMS-CHAT] Direct orders:",
      routerResult.results?.orders?.length || 0
    );
    console.log(
      "[OMS-CHAT] Vector results:",
      routerResult.results?.vectorResults?.length || 0
    );
    console.log(
      "[OMS-CHAT] Router result:",
      JSON.stringify(routerResult, null, 2)
    );

    // Step 2: Process based on router strategy
    let finalOrders: any[] = [];
    let responseMessage: string = "";
    let confidence: "high" | "medium" | "low" = "medium";
    let dataFreshness = routerResult.dataFreshness;
    let totalProcessingTime = routerResult.processingTime;
    let ragResult: any = null; // Declare at higher scope

    // For API strategy (specific job lookups), check if it's pricing-related
    if (routerResult.strategy === "api") {
      console.log("🎯 Using API strategy - direct router results");
      finalOrders = routerResult.results?.orders || [];

      // Check if the query is pricing-related
      const isPricingQuery =
        message.toLowerCase().includes("cost") ||
        message.toLowerCase().includes("price") ||
        message.toLowerCase().includes("pricing") ||
        message.toLowerCase().includes("value") ||
        message.toLowerCase().includes("total") ||
        message.toLowerCase().includes("amount") ||
        message.toLowerCase().includes("$") ||
        message.toLowerCase().includes("expensive") ||
        message.toLowerCase().includes("cheap") ||
        message.toLowerCase().includes("how much");

      if (isPricingQuery && finalOrders.length > 0) {
        // Use RAG pipeline for pricing-related queries to get detailed pricing info
        console.log(
          "💰 Pricing-related query detected, using RAG pipeline for detailed response"
        );

        ragResult = await ragPipeline.queryWithContext({
          userQuery: message,
          context: {
            includeLineItems: true,
            includeShipments: true,
            includeFiles: true,
            maxOrders: 10,
            preferFreshData: true,
          },
        });

        // Use the RAG result for pricing queries
        responseMessage = ragResult.answer;
        confidence = ragResult.confidence;
        dataFreshness = ragResult.dataFreshness;
        totalProcessingTime += ragResult.processingTime;
      } else {
        // Use RAG pipeline for all non-pricing API queries to generate proper structured responses
        console.log(
          "🧠 Using RAG pipeline for API strategy response generation..."
        );

        ragResult = await ragPipeline.queryWithContext({
          userQuery: message,
          context: {
            includeLineItems: true,
            includeShipments: true,
            includeFiles: true,
            maxOrders: 10,
            preferFreshData: true,
          },
        });

        // Use the RAG result for all queries
        responseMessage = ragResult.answer;
        confidence = ragResult.confidence;
        dataFreshness = ragResult.dataFreshness;
        totalProcessingTime += ragResult.processingTime;
      }
    } else {
      // For other strategies (vector, hybrid), use RAG pipeline
      console.log("🧠 Using RAG pipeline for enhanced response generation...");

      // Check if this is a constraint query that needs special processing
      const isConstraintQuery =
        message.toLowerCase().includes("add up to") ||
        message.toLowerCase().includes("total") ||
        message.toLowerCase().includes("sum") ||
        message.toLowerCase().includes("value");

      if (isConstraintQuery) {
        console.log(
          "🔍 Detected constraint query, using processQuery method..."
        );
        ragResult = await ragPipeline.processQuery(message);

        // For constraint queries, use the orders from the RAG result
        finalOrders = ragResult.sources?.orders || [];
        responseMessage = ragResult.answer || "No response generated";
        confidence = ragResult.confidence;
        dataFreshness = ragResult.dataFreshness;
        totalProcessingTime += ragResult.processingTime;
      } else {
        // For regular queries, use queryWithContext
        ragResult = await ragPipeline.queryWithContext({
          userQuery: message,
          context: {
            includeLineItems: true,
            includeShipments: true,
            includeFiles: true,
            maxOrders: 10,
            preferFreshData: true,
          },
        });

        // Combine RAG orders with router orders
        finalOrders = [
          ...(ragResult.sources?.orders || []),
          ...(routerResult.results?.orders || []),
        ];
        responseMessage = ragResult.answer;
        confidence = ragResult.confidence;
        dataFreshness = ragResult.dataFreshness;
        totalProcessingTime += ragResult.processingTime;
      }
    }

    console.log("[OMS-CHAT] Final orders for response:", finalOrders.length);

    // Sort orders by DaysToDueDate (ascending - most urgent first)
    finalOrders.sort((a, b) => {
      const aDays = a.dates?.daysToDueDate ?? a.DaysToDueDate ?? Infinity;
      const bDays = b.dates?.daysToDueDate ?? b.DaysToDueDate ?? Infinity;
      return aDays - bDays;
    });

    console.log(
      `[OMS-CHAT] Orders sorted by due date. First order due in ${
        finalOrders[0]?.dates?.daysToDueDate ??
        finalOrders[0]?.DaysToDueDate ??
        "unknown"
      } days`
    );

    // Step 3: Store orders in session cache for follow-up queries
    // Store the orders that match the user's query (not just the first 10 shown)
    if (finalOrders.length > 0 && sessionId) {
      sessionCache.set(sessionId, finalOrders);
      console.log(
        `💾 Stored ${finalOrders.length} orders in session cache for session: ${sessionId}`
      );
      console.log(
        `💾 Session cache now contains: ${Array.from(sessionCache.keys()).join(
          ", "
        )}`
      );
    } else {
      console.log(
        `⚠️ Not storing orders in cache: finalOrders=${finalOrders.length}, sessionId=${sessionId}`
      );
    }

    // Step 3: Prepare response
    try {
      const response = {
        success: true,
        message: responseMessage,
        orders: finalOrders.slice(0, 10),
        analytics: {
          totalResults: finalOrders.length,
          dataSource: routerResult.strategy,
          processingTime: totalProcessingTime,
          confidence: confidence,
          searchStrategy: routerResult.strategy,
        },
        metadata: {
          queryProcessed: message,
          timestamp: new Date().toISOString(),
          strategy: routerResult.strategy, // Use actual router strategy
          dataFreshness: dataFreshness,
          totalOrdersAnalyzed: finalOrders.length,
        },
        context: {
          lastQuery: routerResult.strategy,
          shownOrders: finalOrders
            .slice(0, 10)
            .map((order) => order.jobNumber || order.JobNumber || "unknown"),
          orders: finalOrders.slice(0, 10), // Add the actual order data for our components
          focusedCustomer:
            finalOrders.length === 1
              ? finalOrders[0].customer?.company || finalOrders[0].Client
              : undefined,
          focusedJob:
            finalOrders.length === 1
              ? finalOrders[0].jobNumber || finalOrders[0].JobNumber
              : undefined,
        },
        // Add structured response if available from RAG pipeline
        structuredResponse: ragResult?.structuredResponse || null,
      };

      console.log(
        `[OMS-CHAT] Response prepared. Strategy: ${routerResult.strategy}, Orders: ${finalOrders.length}, Confidence: ${confidence}`
      );

      // Log the actual response sent to the user
      console.log(
        "[OMS-CHAT] Final response to user:",
        JSON.stringify(response, null, 2)
      );

      return NextResponse.json(response);
    } catch (ragError) {
      console.warn(
        "⚠️ RAG pipeline failed, falling back to basic response:",
        ragError
      );

      // Fallback to basic response if RAG fails - prioritize router results
      const finalOrders = routerResult.results?.orders || [];
      const basicSummary = generateBasicSummary(finalOrders, message);

      const fallbackResponse = {
        success: true,
        message: basicSummary,
        orders: finalOrders,
        analytics: {
          totalResults: finalOrders.length,
          dataSource: routerResult.strategy, // Use router strategy (includes GPT)
          processingTime: routerResult.processingTime,
          confidence: routerResult.confidence,
          searchStrategy: routerResult.strategy, // Router includes GPT semantic search
        },
        metadata: {
          queryProcessed: message,
          timestamp: new Date().toISOString(),
          strategy: "basic_fallback",
          fallbackReason: "RAG pipeline unavailable",
        },
      };

      console.log(
        `[OMS-CHAT] Basic fallback response. Orders found: ${finalOrders.length}, Strategy: ${routerResult.strategy}, Processing time: ${routerResult.processingTime}ms`
      );

      // Log the fallback response sent to the user
      console.log(
        "[OMS-CHAT] Fallback response to user:",
        JSON.stringify(fallbackResponse, null, 2)
      );

      return NextResponse.json(fallbackResponse);
    }
  } catch (error) {
    console.error("❌ OMS chat API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to process query",
        message:
          "I'm having trouble processing your request. Please try again or rephrase your question.",
        analytics: {
          totalResults: 0,
          dataSource: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

// Basic fallback summary generation when RAG is unavailable
function generateBasicSummary(orders: any[], query: string): string {
  if (orders.length === 0) {
    return `No jobs/orders found for your query "${query}". Please check your job number, spelling, or try a different search.`;
  }

  if (orders.length === 1) {
    const order = orders[0];
    return `Found job ${order.jobNumber || order.metadata?.jobNumber} - ${
      order.description || order.metadata?.description
    }. Status: ${order.status || order.metadata?.status}. Due: ${
      order.dateDue ? new Date(order.dateDue).toLocaleDateString() : "TBD"
    }.`;
  }

  const statusCounts: Record<string, number> = {};
  let totalValue = 0;

  orders.forEach((order) => {
    const status = order.status || order.metadata?.status || "Unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const value = order.pricing?.total || order.metadata?.totalDue || 0;
    totalValue += value;
  });

  const statusSummary = Object.entries(statusCounts)
    .map(([status, count]) => `${count} ${status}`)
    .join(", ");

  return `Found ${
    orders.length
  } orders matching "${query}". Status breakdown: ${statusSummary}. ${
    totalValue > 0 ? `Total value: $${totalValue.toLocaleString()}.` : ""
  }`;
}

// Generate detailed summary for a single enriched order
function generateDetailedOrderSummary(order: any): string {
  const sections = [];

  // Basic info with rich details
  sections.push(`**Job ${order.jobNumber}** (Order: ${order.orderNumber})`);
  sections.push(
    `• **Customer:** ${order.customer.company} (ID: ${order.customer.id})`
  );
  sections.push(
    `• **Contact:** ${order.customer.contactPerson} - ${order.customer.phone} - ${order.customer.email}`
  );
  sections.push(
    `• **Status:** ${order.status} | **Due:** ${new Date(
      order.dateDue
    ).toLocaleDateString()} (${order.daysToDue} days)`
  );
  sections.push(`• **Description:** ${order.description}`);

  // Priority and special flags
  const priorityFlags = [];
  if (order.mustDate) priorityFlags.push("🟡 Must Date");
  if (order.timeSensitive) priorityFlags.push("🔴 Time Sensitive");
  if (priorityFlags.length > 0) {
    sections.push(`• **Priority:** ${priorityFlags.join(" | ")}`);
  }

  // Stock and location info
  sections.push(
    `• **Stock:** ${order.stockStatus.description} | **Location:** ${
      order.location.code || "N/A"
    }`
  );
  if (order.jobQuantity) {
    sections.push(`• **Quantity:** ${order.jobQuantity} units`);
  }

  // Production tasks (job lines) with rich details
  if (order.jobLines && order.jobLines.length > 0) {
    sections.push(`\n**Production Tasks:**`);
    order.jobLines.forEach((line: any, index: number) => {
      sections.push(
        `  ${index + 1}. **${line.program}** - ${line.description}`
      );
      sections.push(
        `     Qty: ${line.quantity} | Price: $${line.unitPrice} | Progress: ${line.progress}%`
      );
      if (line.garment) sections.push(`     Garment: ${line.garment}`);
      if (line.comments) sections.push(`     Notes: ${line.comments}`);
      if (line.progComment) sections.push(`     Status: *${line.progComment}*`);
      if (line.machineNumber)
        sections.push(`     Machine: ${line.machineNumber}`);
      sections.push("");
    });
  }

  // Stock items with inventory details
  if (order.stockItems && order.stockItems.length > 0) {
    sections.push(`**Inventory Items:**`);
    order.stockItems.forEach((stock: any) => {
      sections.push(`• **${stock.description}**`);
      sections.push(
        `  Supplier: ${stock.supplier} | Qty: ${stock.quantity} | Location: ${stock.locationCode}`
      );
      if (stock.items && stock.items.length > 0) {
        stock.items.forEach((item: any) => {
          sections.push(
            `  - ${item.garment} (${item.colour}) - ${item.totalQuantity} ${item.sizeDescription}`
          );
        });
      }
    });
    sections.push("");
  }

  // Pricing breakdown
  if (order.pricing && order.pricing.total > 0) {
    sections.push(`**Pricing:**`);
    sections.push(`• Subtotal: ${order.pricing.subtotalFormatted}`);
    sections.push(`• Tax: ${order.pricing.taxFormatted}`);
    sections.push(`• **Total: ${order.pricing.totalFormatted}**`);
    sections.push("");
  }

  // Shipping information
  if (order.shipments && order.shipments.length > 0) {
    sections.push(`**Shipping:**`);
    order.shipments.forEach((shipment: any) => {
      sections.push(`• **${shipment.title}** - ${shipment.method.value}`);
      sections.push(
        `  To: ${shipment.address.contactName} (${shipment.address.organization})`
      );
      sections.push(
        `  Address: ${shipment.address.street}, ${shipment.address.city}, ${shipment.address.state} ${shipment.address.zipCode}`
      );
      if (shipment.shipped) {
        sections.push(
          `  ✅ **Shipped** on ${new Date(
            shipment.dateShipped
          ).toLocaleDateString()}`
        );
      } else {
        sections.push(`  📦 Ready to ship`);
      }
      if (shipment.notes) sections.push(`  Notes: ${shipment.notes}`);
    });
    sections.push("");
  }

  // Tags and workflow annotations
  if (order.tags && order.tags.length > 0) {
    sections.push(
      `**Tags:** ${order.tags
        .map((tag: any) => `\`${tag.tag}\` (by ${tag.enteredBy})`)
        .join(", ")}`
    );
    sections.push("");
  }

  // Process quantities (work breakdown)
  if (order.processQuantities && order.processQuantities.length > 0) {
    sections.push(`**Work Breakdown:**`);
    order.processQuantities.forEach((pq: any) => {
      const machine = pq.hasSuggestedMachine
        ? ` (${pq.suggestedMachineLabel})`
        : "";
      sections.push(`• ${pq.displayCode}: ${pq.quantity} units${machine}`);
    });
    sections.push("");
  }

  // Production history (recent entries)
  if (order.history && order.history.length > 0) {
    sections.push(`**Recent Activity:**`);
    order.history.slice(0, 3).forEach((entry: any) => {
      sections.push(`• ${entry.entry.replace(/<[^>]*>/g, "")}`); // Strip HTML
      if (entry.detail) sections.push(`  ${entry.detail}`);
    });
  }

  return sections.join("\n");
}

// Generate summary for multiple enriched orders
function generateEnrichedSummary(orders: any[], query: string): string {
  if (orders.length === 0) {
    return `No orders found matching "${query}".`;
  }

  const sections = [];

  sections.push(`**Found ${orders.length} orders matching "${query}":**\n`);

  // Quick overview with key metrics
  const statusCounts: Record<string, number> = {};
  const customerCounts: Record<string, number> = {};
  let totalValue = 0;
  let urgentCount = 0;

  orders.forEach((order) => {
    statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    customerCounts[order.customer.company] =
      (customerCounts[order.customer.company] || 0) + 1;
    if (order.pricing?.total) totalValue += order.pricing.total;
    if (order.mustDate || order.timeSensitive) urgentCount++;
  });

  // Show summary stats
  if (urgentCount > 0) {
    sections.push(`⚠️ **${urgentCount} urgent orders** require attention\n`);
  }

  if (totalValue > 0) {
    sections.push(`💰 **Total Value:** $${totalValue.toLocaleString()}\n`);
  }

  // Status breakdown
  sections.push(`**Status Breakdown:**`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    sections.push(`• ${status}: ${count}`);
  });
  sections.push("");

  // Individual order details
  sections.push(`**Order Details:**`);
  orders.slice(0, 8).forEach((order) => {
    const priority = order.mustDate ? "🟡" : order.timeSensitive ? "🔴" : "⚪";
    const stockIcon = order.stockStatus.isComplete ? "✅" : "⏳";
    const shipped = order.shipments?.some((s: any) => s.shipped) ? "📦" : "";

    sections.push(
      `${priority} **Job ${order.jobNumber}** - ${order.customer.company} ${stockIcon}${shipped}`
    );
    sections.push(`   ${order.description}`);
    sections.push(
      `   Status: ${order.status} | Due: ${new Date(
        order.dateDue
      ).toLocaleDateString()} | Value: ${
        order.pricing?.totalFormatted || "N/A"
      }`
    );

    // Show key production tasks
    if (order.jobLines && order.jobLines.length > 0) {
      const keyTasks = order.jobLines
        .slice(0, 2)
        .map((line: any) => line.description)
        .join(", ");
      sections.push(
        `   Tasks: ${keyTasks}${
          order.jobLines.length > 2
            ? ` (+${order.jobLines.length - 2} more)`
            : ""
        }`
      );
    }

    // Show important tags
    if (order.tags && order.tags.length > 0) {
      const importantTags = order.tags.slice(0, 3).map((tag: any) => tag.tag);
      sections.push(`   Tags: ${importantTags.join(", ")}`);
    }

    sections.push("");
  });

  if (orders.length > 8) {
    sections.push(`*... and ${orders.length - 8} more orders*`);
  }

  return sections.join("\n");
}

// Helper function to detect follow-up calculation queries
function isFollowUpCalculationQuery(
  message: string,
  conversationContext: string
): boolean {
  if (!conversationContext) return false;

  const calculationKeywords = [
    "sum",
    "total",
    "add up",
    "calculate",
    "how much",
    "value",
    "amount",
    "what is the total",
    "what is the sum",
    "what do these add up to",
    "total value",
    "total amount",
    "total cost",
    "total price",
  ];

  const hasCalculationKeyword = calculationKeywords.some((keyword) =>
    message.toLowerCase().includes(keyword.toLowerCase())
  );

  const hasPreviousOrders =
    conversationContext.toLowerCase().includes("order") ||
    conversationContext.toLowerCase().includes("job") ||
    conversationContext.toLowerCase().includes("found");

  return hasCalculationKeyword && hasPreviousOrders;
}

// Simple in-memory session storage for demonstration
// In production, use Redis, database, or proper session management
const sessionCache = new Map<string, any>();

// Handle follow-up calculation queries using conversation context
async function handleFollowUpCalculation(
  message: string,
  conversationContext: string
): Promise<NextResponse> {
  try {
    console.log("🧮 Processing follow-up calculation query...");

    // Extract session ID from context to get previous orders
    // Try multiple patterns to extract session ID
    let sessionId = "default";

    // Pattern 1: sessionId: value
    const sessionMatch1 = conversationContext.match(/sessionId[:\s]+([^\s|]+)/);
    if (sessionMatch1) {
      sessionId = sessionMatch1[1];
    } else {
      // Pattern 2: Look for session ID in the context string
      const sessionMatch2 = conversationContext.match(/(\d{10,})/);
      if (sessionMatch2) {
        sessionId = sessionMatch2[1];
      }
    }

    console.log(`🔍 [FOLLOW-UP] Extracted session ID: ${sessionId}`);
    console.log(
      `🔍 [FOLLOW-UP] Available sessions: ${Array.from(
        sessionCache.keys()
      ).join(", ")}`
    );

    // Get previous orders from session cache
    const previousOrders = sessionCache.get(sessionId) || [];

    console.log(
      `🔍 [FOLLOW-UP] Found ${previousOrders.length} orders for session ${sessionId}`
    );

    if (previousOrders.length === 0) {
      console.log(`❌ [FOLLOW-UP] No orders found for session ${sessionId}`);
      console.log(`❌ [FOLLOW-UP] Session cache contents:`, sessionCache);

      return NextResponse.json(
        {
          success: false,
          message:
            "I don't have the previous orders in memory. Please ask about the orders again first.",
          error: "No previous orders found",
          debug: {
            sessionId: sessionId,
            availableSessions: Array.from(sessionCache.keys()),
            conversationContext: conversationContext.substring(0, 200) + "...",
          },
        },
        { status: 400 }
      );
    }

    // Calculate sum of the actual previous orders
    const totalValue = previousOrders.reduce((sum: number, order: any) => {
      return sum + (order.pricing?.total || 0);
    }, 0);

    const responseMessage = `The total value of the ${
      previousOrders.length
    } orders from the previous query is **$${totalValue.toLocaleString(
      "en-US",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )}**.`;

    // Return ONLY the calculation response - no order cards
    return NextResponse.json({
      success: true,
      message: responseMessage,
      response: responseMessage,
      // Don't include orders array - just the calculation
      context: {
        lastQuery: message,
        calculationType: "sum",
        totalValue: totalValue,
        orderCount: previousOrders.length,
      },
      // Minimal structured response - just the summary
      structuredResponse: {
        introText: responseMessage,
        summary: {
          totalOrders: previousOrders.length,
          totalValue: totalValue,
          calculationType: "sum",
        },
      },
      analytics: {
        totalResults: previousOrders.length,
        dataSource: "session-cache",
        processingTime: 0,
        confidence: "high",
        searchStrategy: "follow-up-calculation",
      },
      metadata: {
        timestamp: new Date().toISOString(),
        queryType: "follow-up-calculation",
        sessionId: sessionId,
      },
    });
  } catch (error) {
    console.error("Error handling follow-up calculation:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          "I'm sorry, I couldn't calculate the sum of the previous orders. Please try asking about the orders again.",
        error: "Follow-up calculation failed",
      },
      { status: 500 }
    );
  }
}

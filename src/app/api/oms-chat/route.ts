import { NextRequest, NextResponse } from "next/server";
import { intelligentQueryRouter } from "../../../lib/query-router";
// Cleaned up - now uses only GPT-powered semantic search via intelligentQueryRouter
import { RAGPipeline } from "../../../lib/rag-pipeline";

// Initialize RAG pipeline for intelligent responses
const ragPipeline = new RAGPipeline();

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      console.warn("[OMS-CHAT] No message provided in request body");
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    console.log(`[OMS-CHAT] Incoming message: '${message}'`);

    // Step 1: Use intelligent query router to get data
    const routerResult = await intelligentQueryRouter.routeQuery(message);
    console.log(
      "[OMS-CHAT] Router result:",
      JSON.stringify(routerResult, null, 2)
    );

    // Step 2: Use router results directly (skip old enriched service)
    let enrichedOrders: any[] = [];

    // Only use enriched service for specific job number lookups
    if (message.toLowerCase().includes("job") && /\d+/.test(message)) {
      // Job number lookup now handled by GPT semantic search in router
      // No need for separate enriched service lookup
    }

    // For all other queries, use the intelligent router results which include GPT semantic search

    // Step 3: Use RAG pipeline for intelligent response generation
    try {
      console.log("🧠 Generating intelligent response using RAG pipeline...");

      // Prioritize router results (GPT semantic search) over enriched data
      const allOrders = [
        ...(routerResult.results?.orders || []),
        ...(enrichedOrders || []),
      ];

      // Use RAG pipeline for intelligent analysis
      const ragResult = await ragPipeline.queryWithEnhancedContext({
        userQuery: message,
        context: {
          includeLineItems: true,
          includeShipments: true,
          includeFiles: true,
          maxOrders: 10,
          preferFreshData: true,
        },
      });

      // Step 4: Prepare enhanced response
      const response = {
        success: true,
        message: ragResult.answer,
        orders: allOrders.slice(0, 10), // Include relevant orders for context
        analytics: {
          totalResults: allOrders.length,
          dataSource: routerResult.strategy, // Always use router strategy (includes GPT semantic search)
          processingTime:
            routerResult.processingTime + ragResult.processingTime,
          confidence: ragResult.confidence,
          searchStrategy: routerResult.strategy, // Router includes GPT semantic search
          ragAnalysis: {
            contextQuality: ragResult.contextQuality,
            llmTokensUsed: ragResult.metadata?.llmTokensUsed || 0,
            reasoning: ragResult.metadata?.reasoning,
          },
        },
        metadata: {
          queryProcessed: message,
          timestamp: new Date().toISOString(),
          strategy: "rag_enhanced",
          dataFreshness: ragResult.dataFreshness,
          recommendations: ragResult.metadata?.recommendations,
        },
      };

      console.log(
        `[OMS-CHAT] RAG response generated. Orders: ${allOrders.length}, Confidence: ${ragResult.confidence}, Processing time: ${ragResult.processingTime}ms`
      );

      return NextResponse.json(response);
    } catch (ragError) {
      console.warn(
        "⚠️ RAG pipeline failed, falling back to basic response:",
        ragError
      );

      // Fallback to basic response if RAG fails - prioritize router results
      const finalOrders = [
        ...(routerResult.results?.orders || []),
        ...(enrichedOrders || []),
      ];
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

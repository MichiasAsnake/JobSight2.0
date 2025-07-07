// Intelligent Endpoint Mapper - Maps user queries to relevant API endpoints
// Based on comprehensive API knowledge base relationships

import OpenAI from "openai";
import { enhancedAPIClient } from "./enhanced-api-client";

export interface QueryEndpointAnalysis {
  confidence: "high" | "medium" | "low";
  requiredEndpoints: EndpointCall[];
  reasoning: string;
  estimatedResponseTime: number;
}

export interface EndpointCall {
  endpoint: string;
  method: string;
  params: Record<string, string>;
  priority: "essential" | "helpful" | "optional";
  description: string;
}

export interface EnrichedOrderData {
  baseOrder: any;
  jobLines?: any[];
  costDetails?: any;
  shipments?: any[];
  stockItems?: any[];
  history?: any[];
  customer?: any;
  deliveryOptions?: any[];
  files?: any[];
}

class IntelligentEndpointMapper {
  private openai: OpenAI;
  private apiClient = enhancedAPIClient;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "",
      timeout: 15000,
    });
  }

  // Analyze query and determine which endpoints to call
  async analyzeQueryForEndpoints(
    query: string,
    orders: any[] = []
  ): Promise<QueryEndpointAnalysis> {
    console.log(`🧠 Analyzing query for endpoint selection: "${query}"`);

    try {
      const analysis = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert API endpoint selector for an Order Management System.

Based on a user's query, determine which API endpoints should be called:

Available Endpoints:
1. get-joblines - Returns line items/products (What's in this order?)
2. get-joblines-cost-details - Returns pricing breakdown (How much?)
3. get-job-shipments - Returns shipping status (Has this shipped?)
4. get-all-inwards-and-stock-items - Returns materials/inventory (Stock status?)
5. get-job-history - Returns activity timeline (When updated?)
6. get-customer-by-id - Returns customer details (Who is customer?)
7. get-delivery-options - Returns shipping options (How to ship?)
8. get-job-files - Returns attachments (What files?)

Return JSON:
{
  "confidence": "high|medium|low",
  "requiredEndpoints": [
    {
      "endpoint": "get-joblines",
      "method": "getJobLines",
      "params": {},
      "priority": "essential",
      "description": "why needed"
    }
  ],
  "reasoning": "explanation",
  "estimatedResponseTime": 1500
}`,
          },
          {
            role: "user",
            content: `Query: "${query}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 800,
      });

      const responseText = analysis.choices[0]?.message?.content;
      if (!responseText) throw new Error("No response from GPT");

      // Extract JSON from markdown code blocks if present
      let jsonText = responseText;
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonText);
      console.log(
        `✅ Endpoint analysis complete: ${parsed.requiredEndpoints.length} endpoints identified`
      );
      return parsed;
    } catch (error) {
      console.warn(
        "⚠️ Failed to analyze endpoints with GPT, using fallback:",
        error
      );
      return this.getFallbackEndpointAnalysis(query);
    }
  }

  // Fallback analysis using pattern matching
  private getFallbackEndpointAnalysis(query: string): QueryEndpointAnalysis {
    const queryLower = query.toLowerCase();
    const endpoints: EndpointCall[] = [];

    // Pattern-based endpoint detection
    if (/\b(what|show|list|in|item|product|line)\b/i.test(query)) {
      endpoints.push({
        endpoint: "get-joblines",
        method: "getJobLines",
        params: {},
        priority: "essential",
        description: "Query asks about order contents",
      });
    }

    if (/\b(cost|price|total|money|dollar)\b/i.test(query)) {
      endpoints.push({
        endpoint: "get-joblines-cost-details",
        method: "getJobLinesCostDetails",
        params: {},
        priority: "essential",
        description: "Query asks about pricing",
      });
    }

    if (/\b(ship|deliver|track|sent|dispatch)\b/i.test(query)) {
      endpoints.push({
        endpoint: "get-job-shipments",
        method: "getJobShipments",
        params: {},
        priority: "essential",
        description: "Query asks about shipping",
      });
    }

    return {
      confidence: endpoints.length > 0 ? "medium" : "low",
      requiredEndpoints: endpoints,
      reasoning: `Pattern-based analysis detected ${endpoints.length} relevant endpoints`,
      estimatedResponseTime: endpoints.length * 500 + 200,
    };
  }

  // Execute endpoint calls for specific orders
  async enrichOrdersWithEndpoints(
    orders: any[],
    endpointAnalysis: QueryEndpointAnalysis
  ): Promise<EnrichedOrderData[]> {
    console.log(
      `🔧 Enriching ${orders.length} orders with ${endpointAnalysis.requiredEndpoints.length} endpoints`
    );

    const enrichedOrders: EnrichedOrderData[] = [];

    for (const order of orders) {
      const jobNumber = order.jobNumber || order.metadata?.jobNumber;
      const customerId = order.customer?.id || order.metadata?.customerId;

      if (!jobNumber) {
        enrichedOrders.push({ baseOrder: order });
        continue;
      }

      const enrichedData: EnrichedOrderData = { baseOrder: order };

      // Execute endpoint calls in parallel
      const endpointPromises = endpointAnalysis.requiredEndpoints.map(
        async (endpoint) => {
          try {
            switch (endpoint.endpoint) {
              case "get-joblines":
                const jobLinesResponse = await this.apiClient.getJobLines(
                  jobNumber,
                  customerId?.toString()
                );
                enrichedData.jobLines = jobLinesResponse.data || [];
                break;
              case "get-joblines-cost-details":
                enrichedData.costDetails =
                  await this.apiClient.getJobLinesCostDetails(jobNumber);
                break;
              case "get-job-shipments":
                const shipmentsResponse = await this.apiClient.getJobShipments(
                  jobNumber,
                  customerId?.toString()
                );
                enrichedData.shipments =
                  shipmentsResponse.data?.JobShipments || [];
                break;
              case "get-all-inwards-and-stock-items":
                enrichedData.stockItems =
                  (await this.apiClient.getAllInwardsAndStockItems(
                    jobNumber
                  )) as any[];
                break;
              case "get-job-history":
                const historyResponse = await this.apiClient.getJobHistory(
                  jobNumber
                );
                enrichedData.history = historyResponse.data
                  ? [historyResponse.data]
                  : [];
                break;
              case "get-customer-by-id":
                if (customerId) {
                  enrichedData.customer = await this.apiClient.getCustomerById(
                    customerId.toString()
                  );
                }
                break;
              case "get-delivery-options":
                if (customerId) {
                  enrichedData.deliveryOptions =
                    (await this.apiClient.getDeliveryOptions(
                      customerId.toString()
                    )) as any[];
                }
                break;
              case "get-job-files":
                const filesResponse = await this.apiClient.getJobFiles(
                  jobNumber
                );
                enrichedData.files = filesResponse.Aux4?.Entities || [];
                break;
            }
          } catch (error) {
            console.warn(
              `⚠️ Failed to call ${endpoint.endpoint} for job ${jobNumber}:`,
              error
            );
          }
        }
      );

      await Promise.allSettled(endpointPromises);
      enrichedOrders.push(enrichedData);
    }

    console.log(
      `✅ Enrichment complete: ${enrichedOrders.length} orders enhanced`
    );
    return enrichedOrders;
  }

  // Generate comprehensive context for GPT responses
  formatEnrichedContextForGPT(
    enrichedOrders: EnrichedOrderData[],
    query: string
  ): string {
    const contextSections = [];

    contextSections.push(`=== ENRICHED ORDER DATA FOR QUERY: "${query}" ===\n`);

    enrichedOrders.forEach((enriched, index) => {
      const order = enriched.baseOrder;
      const jobNumber = order.jobNumber || order.metadata?.jobNumber;

      contextSections.push(`--- ORDER ${index + 1}: Job #${jobNumber} ---`);
      contextSections.push(
        `Basic: ${order.customer?.company || "Unknown"} - ${
          order.description || "No description"
        }`
      );
      contextSections.push(
        `Status: ${order.status || "Unknown"} | Due: ${
          order.dates?.dueDate || "No due date"
        }`
      );

      if (enriched.jobLines) {
        contextSections.push(`\nLine Items (${enriched.jobLines.length}):`);
        enriched.jobLines.slice(0, 3).forEach((line: any) => {
          contextSections.push(
            `- ${line.Description}: Qty ${line.Quantity} @ $${line.UnitPrice} = $${line.TotalPrice}`
          );
        });
      }

      if (enriched.costDetails) {
        contextSections.push(`\nCost Details:`);
        contextSections.push(
          `- Subtotal: $${enriched.costDetails.jobLinesSubTotal || "N/A"}`
        );
        contextSections.push(
          `- Total: $${enriched.costDetails.jobLinesTotalCost || "N/A"}`
        );
      }

      if (enriched.shipments && enriched.shipments.length > 0) {
        contextSections.push(`\nShipments (${enriched.shipments.length}):`);
        enriched.shipments.slice(0, 2).forEach((shipment: any) => {
          const status = shipment.Shipped
            ? "Shipped"
            : shipment.CanShip
            ? "Ready to Ship"
            : "Not Ready";
          contextSections.push(`- ${shipment.Title}: ${status}`);
        });
      }

      if (enriched.customer) {
        contextSections.push(
          `\nCustomer: ${enriched.customer.Company || "Unknown"}`
        );
      }

      contextSections.push(""); // Blank line between orders
    });

    return contextSections.join("\n");
  }
}

// Export singleton instance
export const intelligentEndpointMapper = new IntelligentEndpointMapper();

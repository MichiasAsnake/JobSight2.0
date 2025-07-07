import { NextRequest, NextResponse } from "next/server";
import { vectorDBService } from "@/lib/vector-db";
import { apiFirstDataService } from "@/lib/api-first-data-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "change-tracker":
        // Get change tracker statistics
        const trackerStats = vectorDBService.getChangeTrackerStats();
        return NextResponse.json({
          success: true,
          data: trackerStats,
        });

      case "data-health":
        // Simplified data health check using API service
        try {
          const apiHealth = await apiFirstDataService.healthCheck();
          const vectorHealth = await vectorDBService.healthCheck();

          return NextResponse.json({
            success: true,
            data: {
              api: apiHealth,
              vector: vectorHealth,
              status:
                apiHealth.healthy && vectorHealth.healthy
                  ? "healthy"
                  : "degraded",
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Health check failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      case "detect-changes":
        // Detect what changes would happen in an incremental update
        try {
          const ordersData = await apiFirstDataService.getAllOrders();
          const changes = await vectorDBService.detectOrderChanges(
            ordersData.orders
          );

          return NextResponse.json({
            success: true,
            data: {
              totalOrders: ordersData.orders.length,
              changes: {
                newOrders: changes.newOrders.length,
                updatedOrders: changes.updatedOrders.length,
                unchangedOrders: changes.unchangedOrders.length,
                deletedOrders: changes.deletedOrderIds.length,
              },
              sampleNewOrders: changes.newOrders.slice(0, 3).map((o) => ({
                jobNumber: o.jobNumber,
                customer: o.customer?.company,
                description: o.description?.substring(0, 100),
              })),
              sampleUpdatedOrders: changes.updatedOrders
                .slice(0, 3)
                .map((o) => ({
                  jobNumber: o.jobNumber,
                  customer: o.customer?.company,
                  description: o.description?.substring(0, 100),
                })),
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Change detection failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      case "test-incremental":
        // Test incremental update with current data
        try {
          const ordersData = await apiFirstDataService.getAllOrders();
          const updateResult = await vectorDBService.performIncrementalUpdate(
            ordersData.orders
          );

          return NextResponse.json({
            success: true,
            data: updateResult,
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Incremental update test failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      case "system-overview":
        // Simplified system overview
        try {
          const [apiHealth, vectorHealth, tracker] = await Promise.all([
            apiFirstDataService.healthCheck(),
            vectorDBService.healthCheck(),
            vectorDBService.getChangeTrackerStats(),
          ]);

          return NextResponse.json({
            success: true,
            data: {
              api: apiHealth,
              vector: vectorHealth,
              changeTracker: tracker,
              overallHealth:
                apiHealth.healthy && vectorHealth.healthy
                  ? "healthy"
                  : "degraded",
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "System overview failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      case "test-search":
        // Test raw vector search with debug info
        const testQuery = searchParams.get("query") || "recent orders";
        const { embeddingService } = await import("@/lib/embeddings");

        try {
          // Create embedding for test query
          const queryEmbedding = await embeddingService.createEmbedding(
            testQuery
          );

          // Raw vector search without filtering
          const rawResults = await vectorDBService.searchSimilarOrders(
            queryEmbedding,
            10 // Get top 10 results
          );

          return NextResponse.json({
            success: true,
            data: {
              query: testQuery,
              totalResults: rawResults.length,
              results: rawResults.map((r) => ({
                jobNumber: r.metadata.jobNumber,
                score: r.score,
                customer: r.metadata.customerCompany,
                description: r.metadata.description.substring(0, 100),
              })),
              scores: rawResults.map((r) => r.score),
              avgScore:
                rawResults.length > 0
                  ? rawResults.reduce((sum, r) => sum + r.score, 0) /
                    rawResults.length
                  : 0,
              maxScore: Math.max(...rawResults.map((r) => r.score)),
              minScore: Math.min(...rawResults.map((r) => r.score)),
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Vector search test failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      case "index-stats":
        // Get Pinecone index statistics
        try {
          const indexStats = await vectorDBService.getIndexStats();
          const healthCheck = await vectorDBService.healthCheck();

          return NextResponse.json({
            success: true,
            data: {
              indexStats,
              healthCheck,
              changeTracker: vectorDBService.getChangeTrackerStats(),
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Failed to get index stats: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      default:
        // Default: return basic stats
        const basicStats = {
          changeTracker: vectorDBService.getChangeTrackerStats(),
          timestamp: new Date().toISOString(),
          message:
            "Vector database statistics (simplified after data-updater removal)",
        };

        return NextResponse.json({
          success: true,
          data: basicStats,
        });
    }
  } catch (error) {
    console.error("Vector stats API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "force-update":
        // Force a vector database update
        try {
          const ordersData = await apiFirstDataService.getAllOrders();
          const updateResult = await vectorDBService.performIncrementalUpdate(
            ordersData.orders
          );

          return NextResponse.json({
            success: true,
            data: updateResult,
            message: "Vector database update completed",
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error:
              "Force update failed: " +
              (error instanceof Error ? error.message : String(error)),
          });
        }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Vector stats POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

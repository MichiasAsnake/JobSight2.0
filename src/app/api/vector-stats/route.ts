import { NextRequest, NextResponse } from "next/server";
import { vectorDBService } from "@/lib/vector-db";
import { dataUpdater } from "@/lib/data-updater";
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
        // Get comprehensive data health
        const dataHealth = await dataUpdater.assessDataHealth();
        return NextResponse.json({
          success: true,
          data: dataHealth,
        });

      case "detect-changes":
        // Detect what changes would happen in an incremental update
        const ordersData = await apiFirstDataService.getAllOrders();
        const regularOrders = ordersData.orders.map((order) => ({
          ...order,
          // Remove enhanced fields for change detection
          dataSource: undefined,
          lastAPIUpdate: undefined,
          needsRefresh: undefined,
          staleness: undefined,
          liveStatus: undefined,
          liveShipping: undefined,
          liveFiles: undefined,
          apiJobData: undefined,
          apiErrors: undefined,
          dataAge: undefined,
        }));

        const changes = await vectorDBService.detectOrderChanges(regularOrders);

        return NextResponse.json({
          success: true,
          data: {
            totalOrders: regularOrders.length,
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
            sampleUpdatedOrders: changes.updatedOrders.slice(0, 3).map((o) => ({
              jobNumber: o.jobNumber,
              customer: o.customer?.company,
              description: o.description?.substring(0, 100),
            })),
          },
        });

      case "test-incremental":
        // Test incremental update with current data
        const testOrdersData = await apiFirstDataService.getAllOrders();
        const testRegularOrders = testOrdersData.orders.map((order) => ({
          ...order,
          dataSource: undefined,
          lastAPIUpdate: undefined,
          needsRefresh: undefined,
          staleness: undefined,
          liveStatus: undefined,
          liveShipping: undefined,
          liveFiles: undefined,
          apiJobData: undefined,
          apiErrors: undefined,
          dataAge: undefined,
        }));

        const updateResult = await vectorDBService.performIncrementalUpdate(
          testRegularOrders
        );

        return NextResponse.json({
          success: true,
          data: updateResult,
        });

      case "system-overview":
        // Comprehensive system overview
        const [health, tracker, systemHealth] = await Promise.all([
          dataUpdater.assessDataHealth(),
          vectorDBService.getChangeTrackerStats(),
          apiFirstDataService.healthCheck(),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            dataHealth: health,
            changeTracker: tracker,
            hybridSystem: systemStatus,
            vectorDBStats: {
              lastUpdate: tracker.lastVectorUpdate,
              trackedOrders: tracker.processedOrdersCount,
              isHealthy: health.vectorSyncHealth.isInSync,
            },
          },
        });

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
          apiStats: hybridOMSDataService.getAPIStats(),
          timestamp: new Date().toISOString(),
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
      case "force-rebuild":
        // Force a full vector database rebuild
        const orders = await hybridOMSDataService.getEnhancedOrders();
        const regularOrders = orders.map((order) => ({
          ...order,
          dataSource: undefined,
          lastAPIUpdate: undefined,
          needsRefresh: undefined,
          staleness: undefined,
          liveStatus: undefined,
          liveShipping: undefined,
          liveFiles: undefined,
          apiJobData: undefined,
          apiErrors: undefined,
          dataAge: undefined,
        }));

        const rebuildResult = await vectorDBService.forceFullRebuild(
          regularOrders
        );

        return NextResponse.json({
          success: true,
          data: rebuildResult,
          message: "Full vector database rebuild completed",
        });

      case "reset-tracker":
        // Reset the change tracker
        vectorDBService.resetChangeTracker();

        return NextResponse.json({
          success: true,
          message: "Change tracker reset successfully",
        });

      case "trigger-update":
        // Trigger a data update cycle
        const updateStats = await dataUpdater.performUpdate();

        return NextResponse.json({
          success: true,
          data: updateStats,
          message: "Data update cycle completed",
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Unknown action",
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Vector stats API POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

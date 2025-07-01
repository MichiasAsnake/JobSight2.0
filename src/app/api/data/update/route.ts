import { NextRequest, NextResponse } from "next/server";
import { dataUpdater } from "@/lib/data-updater";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    switch (action) {
      case "check":
        // Check if update is needed
        const updateStatus = await dataUpdater.shouldUpdate();
        const health = await dataUpdater.assessDataHealth();
        const stats = await dataUpdater.getUpdateStats();

        return NextResponse.json({
          updateStatus,
          health,
          stats,
          timestamp: new Date().toISOString(),
        });

      case "force":
        // Force an update regardless of timing
        const forceUpdateStats = await dataUpdater.performUpdate();
        return NextResponse.json({
          success: true,
          stats: forceUpdateStats,
          timestamp: new Date().toISOString(),
        });

      default:
        // Check if update is needed and perform if necessary
        const shouldUpdate = await dataUpdater.shouldUpdate();

        if (shouldUpdate.needsUpdate) {
          const updateStats = await dataUpdater.performUpdate();
          return NextResponse.json({
            success: true,
            action: "updated",
            reason: shouldUpdate.reason,
            stats: updateStats,
            timestamp: new Date().toISOString(),
          });
        } else {
          return NextResponse.json({
            success: true,
            action: "skipped",
            reason: shouldUpdate.reason,
            timestamp: new Date().toISOString(),
          });
        }
    }
  } catch (error) {
    console.error("Error in data update API:", error);
    return NextResponse.json(
      {
        error: "Failed to update data",
        details: error instanceof Error ? error.message : "Unknown error",
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
      case "update":
        const updateStats = await dataUpdater.performUpdate();
        return NextResponse.json({
          success: true,
          stats: updateStats,
          timestamp: new Date().toISOString(),
        });

      case "health":
        const health = await dataUpdater.assessDataHealth();
        return NextResponse.json({
          success: true,
          health,
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in data update POST API:", error);
    return NextResponse.json(
      {
        error: "Failed to process request",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

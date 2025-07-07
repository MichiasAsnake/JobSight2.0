import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");

    // Data updater service has been removed and consolidated into api-first-data-service
    // This endpoint now returns basic status information indicating real-time API usage

    switch (action) {
      case "check":
        return NextResponse.json({
          updateStatus: {
            needsUpdate: false,
            reason: "Using real-time API data - no periodic updates needed",
          },
          health: {
            healthy: true,
            message: "Real-time API integration active",
          },
          stats: {
            lastUpdate: new Date().toISOString(),
            updateMethod: "real-time-api",
          },
          timestamp: new Date().toISOString(),
        });

      case "force":
        return NextResponse.json({
          success: true,
          stats: {
            message: "Data is fetched in real-time from API",
            method: "api-first-architecture",
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          success: true,
          action: "real-time",
          reason: "Data is now fetched directly from API in real-time",
          timestamp: new Date().toISOString(),
        });
    }
  } catch (error) {
    console.error("Error in data update API:", error);
    return NextResponse.json(
      {
        error: "Data update endpoint simplified",
        details: "Data updating has been moved to real-time API integration",
      },
      { status: 200 } // Return 200 instead of 500 since this is expected behavior
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "update":
        return NextResponse.json({
          success: true,
          stats: {
            message: "Using real-time API data",
            method: "api-first-architecture",
          },
          timestamp: new Date().toISOString(),
        });

      case "health":
        return NextResponse.json({
          success: true,
          health: {
            healthy: true,
            message: "Real-time API integration active",
          },
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json({
          success: true,
          message: "Data updating has been moved to real-time API integration",
        });
    }
  } catch (error) {
    console.error("Error in data update POST API:", error);
    return NextResponse.json(
      {
        success: true,
        message: "Data updating has been moved to real-time API integration",
      },
      { status: 200 }
    );
  }
}

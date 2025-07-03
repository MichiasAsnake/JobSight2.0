// Admin Logs API - System logs aggregation and management
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface LogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  component: string;
  details?: any;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const level = searchParams.get("level") as
    | "info"
    | "warn"
    | "error"
    | "debug"
    | null;
  const component = searchParams.get("component");
  const since = searchParams.get("since"); // ISO date string

  try {
    console.log("📋 Collecting system logs...");

    // Collect logs from various sources
    const logs = await collectSystemLogs();

    // Filter logs based on parameters
    let filteredLogs = logs;

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level);
    }

    if (component) {
      filteredLogs = filteredLogs.filter((log) =>
        log.component.toLowerCase().includes(component.toLowerCase())
      );
    }

    if (since) {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(
        (log) => new Date(log.timestamp) >= sinceDate
      );
    }

    // Sort by timestamp (newest first) and limit
    const sortedLogs = filteredLogs
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, limit);

    // Get summary statistics
    const summary = {
      total: filteredLogs.length,
      byLevel: {
        error: filteredLogs.filter((log) => log.level === "error").length,
        warn: filteredLogs.filter((log) => log.level === "warn").length,
        info: filteredLogs.filter((log) => log.level === "info").length,
        debug: filteredLogs.filter((log) => log.level === "debug").length,
      },
      byComponent: getComponentSummary(filteredLogs),
      timeRange: {
        oldest:
          filteredLogs.length > 0
            ? filteredLogs[filteredLogs.length - 1]?.timestamp
            : null,
        newest: filteredLogs.length > 0 ? filteredLogs[0]?.timestamp : null,
      },
    };

    return NextResponse.json({
      logs: sortedLogs,
      summary,
      filters: { limit, level, component, since },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Failed to collect logs:", error);

    return NextResponse.json(
      {
        error: "Failed to collect system logs",
        details: error instanceof Error ? error.message : "Unknown error",
        logs: [],
        summary: { total: 0, byLevel: {}, byComponent: {}, timeRange: {} },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Collect logs from various system sources
async function collectSystemLogs(): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];

  // Add recent application logs
  logs.push(...getRecentApplicationLogs());

  // Add vector updater logs
  logs.push(...(await getVectorUpdaterLogs()));

  // Add API client logs
  logs.push(...getAPIClientLogs());

  // Add cache operation logs
  logs.push(...getCacheOperationLogs());

  // Add system health logs
  logs.push(...getSystemHealthLogs());

  return logs;
}

// Get recent application logs (simulated for demo)
function getRecentApplicationLogs(): LogEntry[] {
  const now = new Date();
  const logs: LogEntry[] = [];

  // Generate some sample application logs
  const events = [
    {
      level: "info" as const,
      message: "Application started successfully",
      component: "application",
    },
    {
      level: "info" as const,
      message: "Database connection established",
      component: "database",
    },
    {
      level: "warn" as const,
      message: "High memory usage detected",
      component: "system",
    },
    {
      level: "info" as const,
      message: "Cache warmed up with initial data",
      component: "cache",
    },
    {
      level: "error" as const,
      message: "Failed to connect to external API",
      component: "api-client",
    },
    {
      level: "info" as const,
      message: "Vector pipeline initialized",
      component: "vectors",
    },
    {
      level: "warn" as const,
      message: "Query timeout exceeded for complex search",
      component: "query-router",
    },
    {
      level: "info" as const,
      message: "RAG pipeline processing completed",
      component: "rag",
    },
  ];

  events.forEach((event, index) => {
    logs.push({
      ...event,
      timestamp: new Date(now.getTime() - index * 300000).toISOString(), // 5 min intervals
    });
  });

  return logs;
}

// Get vector updater logs
async function getVectorUpdaterLogs(): Promise<LogEntry[]> {
  const logs: LogEntry[] = [];
  const logFile = path.join(
    process.cwd(),
    "logs",
    "realtime-vector-updates.log"
  );

  try {
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, "utf8");
      const lines = logContent.split("\n").filter((line) => line.trim());

      // Parse recent log lines (last 20)
      const recentLines = lines.slice(-20);

      recentLines.forEach((line) => {
        const parsed = parseLogLine(line);
        if (parsed) {
          logs.push({
            level: parsed.level,
            message: parsed.message,
            timestamp: parsed.timestamp,
            component: "vector-updater",
          });
        }
      });
    }
  } catch (error) {
    console.warn("Failed to read vector updater logs:", error);
  }

  return logs;
}

// Get API client logs (simulated)
function getAPIClientLogs(): LogEntry[] {
  const now = new Date();
  return [
    {
      level: "info",
      message: "API connection pool initialized with 10 connections",
      timestamp: new Date(now.getTime() - 600000).toISOString(),
      component: "api-client",
    },
    {
      level: "warn",
      message: "API rate limit approaching threshold",
      timestamp: new Date(now.getTime() - 300000).toISOString(),
      component: "api-client",
    },
    {
      level: "info",
      message: "Successfully fetched order data batch",
      timestamp: new Date(now.getTime() - 120000).toISOString(),
      component: "api-client",
    },
  ];
}

// Get cache operation logs (simulated)
function getCacheOperationLogs(): LogEntry[] {
  const now = new Date();
  return [
    {
      level: "info",
      message: "Cache optimization completed",
      timestamp: new Date(now.getTime() - 900000).toISOString(),
      component: "cache",
    },
    {
      level: "warn",
      message: "Cache eviction triggered due to memory pressure",
      timestamp: new Date(now.getTime() - 450000).toISOString(),
      component: "cache",
    },
    {
      level: "info",
      message: "Cache hit rate improved to 87%",
      timestamp: new Date(now.getTime() - 180000).toISOString(),
      component: "cache",
    },
  ];
}

// Get system health logs (simulated)
function getSystemHealthLogs(): LogEntry[] {
  const now = new Date();
  return [
    {
      level: "info",
      message: "System health check completed - all components healthy",
      timestamp: new Date(now.getTime() - 60000).toISOString(),
      component: "health-monitor",
    },
    {
      level: "warn",
      message: "Query router response time elevated",
      timestamp: new Date(now.getTime() - 240000).toISOString(),
      component: "health-monitor",
    },
  ];
}

// Parse log line format: "2024-01-01T00:00:00.000Z [LEVEL] message"
function parseLogLine(
  line: string
): { level: LogEntry["level"]; message: string; timestamp: string } | null {
  const regex =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z)\s+\[(\w+)\]\s+(.+)$/;
  const match = line.match(regex);

  if (match) {
    const [, timestamp, level, message] = match;
    return {
      timestamp,
      level: level.toLowerCase() as LogEntry["level"],
      message: message.trim(),
    };
  }

  return null;
}

// Get component summary
function getComponentSummary(logs: LogEntry[]): Record<string, number> {
  const summary: Record<string, number> = {};

  logs.forEach((log) => {
    summary[log.component] = (summary[log.component] || 0) + 1;
  });

  return summary;
}

// Admin Dashboard - Comprehensive system monitoring and management
"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SystemHealth {
  overall: boolean;
  components: {
    api: { healthy: boolean; responseTime: number; error?: string };
    vectors: { healthy: boolean; stats?: any; error?: string };
    cache: { healthy: boolean; hitRate: number; totalEntries: number };
    rag: { healthy: boolean; error?: string };
    queryRouter: {
      healthy: boolean;
      successRate: number;
      avgResponseTime: number;
    };
  };
  timestamp: string;
}

interface PerformanceMetrics {
  totalQueries: number;
  averageResponseTime: number;
  successRate: number;
  cacheHitRate: number;
  vectorHealth: number;
  apiCalls: number;
  activeConnections: number;
  memoryUsage: number;
  timestamp: string;
}

interface SystemLogs {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  component: string;
}

interface ConfigurationItem {
  key: string;
  value: string;
  type: "string" | "number" | "boolean" | "json";
  description: string;
  category: "api" | "vector" | "cache" | "rag" | "general";
  editable: boolean;
}

export default function AdminDashboard() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [performanceMetrics, setPerformanceMetrics] =
    useState<PerformanceMetrics | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogs[]>([]);
  const [configuration, setConfiguration] = useState<ConfigurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch system health
  const fetchSystemHealth = async () => {
    try {
      const response = await fetch("/api/admin/health");
      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error("Failed to fetch system health:", error);
    }
  };

  // Fetch performance metrics
  const fetchPerformanceMetrics = async () => {
    try {
      const response = await fetch("/api/admin/metrics");
      const data = await response.json();
      setPerformanceMetrics(data);
    } catch (error) {
      console.error("Failed to fetch performance metrics:", error);
    }
  };

  // Fetch system logs
  const fetchSystemLogs = async () => {
    try {
      const response = await fetch("/api/admin/logs?limit=50");
      const data = await response.json();
      setSystemLogs(data.logs || []);
    } catch (error) {
      console.error("Failed to fetch system logs:", error);
    }
  };

  // Fetch configuration
  const fetchConfiguration = async () => {
    try {
      const response = await fetch("/api/admin/config");
      const data = await response.json();
      setConfiguration(data.configuration || []);
    } catch (error) {
      console.error("Failed to fetch configuration:", error);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSystemHealth(),
        fetchPerformanceMetrics(),
        fetchSystemLogs(),
        fetchConfiguration(),
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(async () => {
      await Promise.all([
        fetchSystemHealth(),
        fetchPerformanceMetrics(),
        fetchSystemLogs(),
      ]);
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const getHealthBadge = (healthy: boolean) => (
    <Badge variant={healthy ? "default" : "destructive"}>
      {healthy ? "✅ Healthy" : "❌ Unhealthy"}
    </Badge>
  );

  const getPerformanceBadge = (
    value: number,
    thresholds: { good: number; ok: number }
  ) => {
    if (value >= thresholds.good)
      return <Badge variant="default">Excellent</Badge>;
    if (value >= thresholds.ok) return <Badge variant="secondary">Good</Badge>;
    return <Badge variant="destructive">Poor</Badge>;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = ms / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = seconds / 60;
    return `${minutes.toFixed(1)}m`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-lg font-medium">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              System Administration
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive monitoring and management for your OMS application
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Auto-refresh:</label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="px-3 py-1 border rounded text-sm"
                disabled={!autoRefresh}
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            </div>
            <Button
              onClick={() =>
                Promise.all([
                  fetchSystemHealth(),
                  fetchPerformanceMetrics(),
                  fetchSystemLogs(),
                ])
              }
              variant="outline"
              size="sm"
            >
              🔄 Refresh
            </Button>
          </div>
        </div>

        {/* System Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {systemHealth?.overall ? "🟢" : "🔴"} System
              </div>
              {getHealthBadge(systemHealth?.overall || false)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Response Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {performanceMetrics?.averageResponseTime
                  ? formatDuration(performanceMetrics.averageResponseTime)
                  : "N/A"}
              </div>
              {performanceMetrics &&
                getPerformanceBadge(performanceMetrics.averageResponseTime, {
                  good: 500,
                  ok: 1000,
                })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Success Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {performanceMetrics?.successRate
                  ? `${(performanceMetrics.successRate * 100).toFixed(1)}%`
                  : "N/A"}
              </div>
              {performanceMetrics &&
                getPerformanceBadge(performanceMetrics.successRate * 100, {
                  good: 95,
                  ok: 85,
                })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Cache Hit Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold mb-2">
                {performanceMetrics?.cacheHitRate
                  ? `${(performanceMetrics.cacheHitRate * 100).toFixed(1)}%`
                  : "N/A"}
              </div>
              {performanceMetrics &&
                getPerformanceBadge(performanceMetrics.cacheHitRate * 100, {
                  good: 80,
                  ok: 60,
                })}
            </CardContent>
          </Card>
        </div>

        {/* Component Health Status */}
        <Card>
          <CardHeader>
            <CardTitle>Component Health Status</CardTitle>
            <CardDescription>
              Real-time health monitoring of all system components
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemHealth?.components &&
                Object.entries(systemHealth.components).map(
                  ([component, status]) => (
                    <div key={component} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium capitalize">{component}</h3>
                        {getHealthBadge(status.healthy)}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        {component === "api" && status.responseTime && (
                          <p>Response: {formatDuration(status.responseTime)}</p>
                        )}
                        {component === "cache" && (
                          <>
                            <p>
                              Hit Rate:{" "}
                              {((status as any).hitRate * 100).toFixed(1)}%
                            </p>
                            <p>
                              Entries:{" "}
                              {(status as any).totalEntries.toLocaleString()}
                            </p>
                          </>
                        )}
                        {component === "queryRouter" && (
                          <>
                            <p>
                              Success:{" "}
                              {((status as any).successRate * 100).toFixed(1)}%
                            </p>
                            <p>
                              Avg Time:{" "}
                              {formatDuration((status as any).avgResponseTime)}
                            </p>
                          </>
                        )}
                        {status.error && (
                          <p className="text-red-600">Error: {status.error}</p>
                        )}
                      </div>
                    </div>
                  )
                )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Metrics</CardTitle>
            <CardDescription>
              Real-time performance monitoring and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {performanceMetrics?.totalQueries?.toLocaleString() || "0"}
                </div>
                <div className="text-sm text-gray-600">Total Queries</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {performanceMetrics?.apiCalls?.toLocaleString() || "0"}
                </div>
                <div className="text-sm text-gray-600">API Calls</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {performanceMetrics?.activeConnections?.toLocaleString() ||
                    "0"}
                </div>
                <div className="text-sm text-gray-600">Active Connections</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {performanceMetrics?.memoryUsage
                    ? formatBytes(performanceMetrics.memoryUsage)
                    : "N/A"}
                </div>
                <div className="text-sm text-gray-600">Memory Usage</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Recent System Logs</CardTitle>
            <CardDescription>Latest system events and messages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {systemLogs.map((log, index) => (
                <div
                  key={index}
                  className="flex items-start space-x-3 p-2 rounded border-l-4 border-l-gray-200"
                >
                  <Badge
                    variant={
                      log.level === "error"
                        ? "destructive"
                        : log.level === "warn"
                        ? "secondary"
                        : "default"
                    }
                    className="mt-0.5"
                  >
                    {log.level.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {log.component}
                    </p>
                    <p className="text-sm text-gray-600">{log.message}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
              {systemLogs.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  No recent logs available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common administrative tasks and system operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button variant="outline" className="h-16 flex-col space-y-1">
                <span className="text-lg">🔄</span>
                <span className="text-sm">Rebuild Vectors</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col space-y-1">
                <span className="text-lg">🧹</span>
                <span className="text-sm">Clear Cache</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col space-y-1">
                <span className="text-lg">📊</span>
                <span className="text-sm">Export Metrics</span>
              </Button>
              <Button variant="outline" className="h-16 flex-col space-y-1">
                <span className="text-lg">⚙️</span>
                <span className="text-sm">System Config</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

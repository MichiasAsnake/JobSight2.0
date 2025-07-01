"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Database,
  Activity,
  Shield,
  Package,
  FileText,
} from "lucide-react";

interface DataHealth {
  totalOrders: number;
  dataAge: number;
  completeness: number;
  dataQuality: {
    missingCustomerInfo: number;
    missingPricing: number;
    missingShipDates: number;
    incompleteLineItems: number;
  };
  recommendations: string[];
}

interface UpdateStats {
  totalOrders: number;
  newOrders: number;
  updatedOrders: number;
  deletedOrders: number;
  unchangedOrders: number;
  lastUpdate: string;
  updateDuration: number;
}

interface UpdateStatus {
  needsUpdate: boolean;
  reason: string;
}

export function DataDashboard() {
  const [health, setHealth] = useState<DataHealth | null>(null);
  const [stats, setStats] = useState<UpdateStats | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = async () => {
    try {
      const response = await fetch("/api/data/update?action=check");
      const data = await response.json();

      setHealth(data.health);
      setStats(data.stats);
      setUpdateStatus(data.updateStatus);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading data dashboard:", error);
    }
  };

  const triggerUpdate = async (force = false) => {
    setIsLoading(true);
    try {
      const url = force ? "/api/data/update?action=force" : "/api/data/update";
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        // Reload dashboard data
        await loadData();
      }
    } catch (error) {
      console.error("Error triggering update:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getDataAgeColor = (hours: number) => {
    if (hours < 2) return "text-green-600";
    if (hours < 6) return "text-yellow-600";
    return "text-red-600";
  };

  const getCompletenessColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (!health || !updateStatus) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Data Management Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor data health and manage updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerUpdate(false)}
            disabled={isLoading}
          >
            <Activity className="h-4 w-4 mr-2" />
            Smart Update
          </Button>
          <Button onClick={() => triggerUpdate(true)} disabled={isLoading}>
            <Database className="h-4 w-4 mr-2" />
            Force Update
          </Button>
        </div>
      </div>

      {/* Update Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Update Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {updateStatus.needsUpdate ? (
                <AlertTriangle className="h-5 w-5 text-orange-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              <div>
                <p className="font-medium">
                  {updateStatus.needsUpdate ? "Update Needed" : "Data Current"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {updateStatus.reason}
                </p>
              </div>
            </div>
            <Badge
              variant={updateStatus.needsUpdate ? "destructive" : "default"}
            >
              {updateStatus.needsUpdate ? "Needs Update" : "Current"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Data Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Orders in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Data Age
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getDataAgeColor(
                health.dataAge
              )}`}
            >
              {Math.round(health.dataAge)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Hours since last update
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getCompletenessColor(
                health.completeness
              )}`}
            >
              {Math.round(health.completeness)}%
            </div>
            <p className="text-xs text-muted-foreground">Complete orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last Update
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {stats?.lastUpdate
                ? new Date(stats.lastUpdate).toLocaleDateString()
                : "Never"}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.lastUpdate
                ? new Date(stats.lastUpdate).toLocaleTimeString()
                : ""}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Data Quality Issues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {health.dataQuality.missingCustomerInfo}
              </div>
              <p className="text-sm text-muted-foreground">
                Missing Customer Info
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {health.dataQuality.missingPricing}
              </div>
              <p className="text-sm text-muted-foreground">Missing Pricing</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {health.dataQuality.missingShipDates}
              </div>
              <p className="text-sm text-muted-foreground">
                Missing Ship Dates
              </p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {health.dataQuality.incompleteLineItems}
              </div>
              <p className="text-sm text-muted-foreground">
                Incomplete Line Items
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Update Statistics */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Last Update Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {stats.newOrders}
                </div>
                <p className="text-sm text-muted-foreground">New Orders</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {stats.updatedOrders}
                </div>
                <p className="text-sm text-muted-foreground">Updated</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">
                  {stats.unchangedOrders}
                </div>
                <p className="text-sm text-muted-foreground">Unchanged</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {stats.deletedOrders}
                </div>
                <p className="text-sm text-muted-foreground">Deleted</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {formatDuration(stats.updateDuration)}
                </div>
                <p className="text-sm text-muted-foreground">Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {health.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {health.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0"></div>
                  <span className="text-sm">{recommendation}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Last Refresh */}
      {lastRefresh && (
        <div className="text-xs text-muted-foreground text-center">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

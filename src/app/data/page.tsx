"use client";

import { DataDashboard } from "../components/data-dashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

export default function DataPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Data Management</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage your OMS data
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <DataDashboard />
      </main>
    </div>
  );
}

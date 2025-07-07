#!/usr/bin/env node

// Simple authentication test script
// This will help diagnose if the auth cookies are working

import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, "..", ".env") });

async function testAuth() {
  console.log("🔍 Testing OMS API Authentication...\n");

  // Check environment variables
  console.log("📋 Environment Variables:");
  console.log(
    "OMS_API_BASE_URL:",
    process.env.OMS_API_BASE_URL ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OMS_AUTH_COOKIES:",
    process.env.OMS_AUTH_COOKIES ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "OMS_AUTH_COOKIE:",
    process.env.OMS_AUTH_COOKIE ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "AUTH_COOKIES:",
    process.env.AUTH_COOKIES ? "✅ Set" : "❌ Missing"
  );
  console.log(
    "AUTH_COOKIE:",
    process.env.AUTH_COOKIE ? "✅ Set" : "❌ Missing"
  );
  console.log("");

  // Load auth cookies
  const cookieString =
    process.env.OMS_AUTH_COOKIES ||
    process.env.OMS_AUTH_COOKIE ||
    process.env.AUTH_COOKIES ||
    process.env.AUTH_COOKIE ||
    "";

  if (!cookieString) {
    console.error("❌ No authentication cookies found!");
    console.error("💡 Please set one of these environment variables:");
    console.error("   - OMS_AUTH_COOKIES");
    console.error("   - OMS_AUTH_COOKIE");
    console.error("   - AUTH_COOKIES");
    console.error("   - AUTH_COOKIE");
    process.exit(1);
  }

  console.log(
    "🔐 Cookie string found (first 50 chars):",
    cookieString.substring(0, 50) + "..."
  );
  console.log("");

  // Test a simple API endpoint
  try {
    console.log("🌐 Testing API endpoint...");

    const response = await fetch(
      `${process.env.OMS_API_BASE_URL}/jobstatuslist/ajax/JobStatusQueryAsync.ashx`,
      {
        method: "POST",
        headers: {
          Accept: "application/json, text/javascript, */*; q=0.01",
          "Accept-Language": "en-US,en;q=0.9",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookieString,
        },
        body: new URLSearchParams({
          "machine-filter":
            "US,1,2,4,8,16,32,64,128,256,512,1024,2048,4096,8192,16384",
          "status-line-format": "[MASTERJOBSTATUS] - [STOCKSTATUS]",
          "no-loc-token": "[NOLOC]",
          "show-due-date-filter": "true",
          "tagged-user": "@laser",
          "app-timezone": "America/Los_Angeles",
          location: "-1",
          "job-status-codes":
            "awaitingproof,changerequested,proofed,approved,ontime,runninglate,problem,completed,dispatched",
          "sort-by": "dateduefactory",
          "sort-direction": "asc",
          "job-status": "2,18,3,4,11,5,6,7,8,9,10",
          "due-date": "1,2,3",
          "stock-status": "0,1,2",
          "process-filter":
            "HW,AP,TC,MP,PR,NA,CR,DS,ES,PP,PA,EM,SW,SC,DF,Misc,Sewing,Dispatch,Stock,Bagging",
          bit: "get-job-list",
          "page-size": "1",
          "requested-page": "",
          "get-job-counts": "true",
        }),
      }
    );

    console.log("📊 Response status:", response.status);
    console.log(
      "📊 Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("📊 Response length:", responseText.length);
    console.log(
      "📊 Response preview (first 200 chars):",
      responseText.substring(0, 200)
    );

    if (responseText.includes("<!DOCTYPE")) {
      console.error("❌ Authentication failed! Received HTML instead of JSON");
      console.error("💡 This usually means:");
      console.error("   1. Session has expired");
      console.error("   2. Cookies are invalid");
      console.error("   3. Need to re-authenticate with the OMS system");
      console.error("");
      console.error("🔧 To fix this:");
      console.error("   1. Log into the OMS system in your browser");
      console.error("   2. Copy the session cookies from browser dev tools");
      console.error("   3. Update your .env file with fresh cookies");
    } else {
      try {
        const jsonData = JSON.parse(responseText);
        console.log("✅ Authentication successful!");
        console.log("📊 Response is valid JSON");
        if (jsonData.isSuccess) {
          console.log("✅ API call successful");
        } else {
          console.log("⚠️ API call returned error:", jsonData.error);
        }
      } catch (parseError) {
        console.error("❌ Response is not valid JSON:", parseError.message);
      }
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }
}

testAuth().catch(console.error);

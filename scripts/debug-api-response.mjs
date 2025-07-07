import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

async function debugAPIResponse() {
  console.log("🔍 Debugging API Response Issue...");

  const baseUrl = process.env.OMS_API_BASE_URL;
  const cookies = process.env.OMS_AUTH_COOKIES;

  console.log("📋 Base URL:", baseUrl);
  console.log("🍪 Cookies set:", !!cookies);
  console.log("🍪 Cookie length:", cookies?.length || 0);

  try {
    // Test the exact endpoint that's failing
    const url = `${baseUrl}/jobstatuslist/ajax/JobStatusQueryAsync.ashx`;

    const body = new URLSearchParams({
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
      "page-size": "5",
      "requested-page": "1",
      "get-job-counts": "true",
    });

    console.log("🌐 Making request to:", url);
    console.log("📝 Request body length:", body.toString().length);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies || "",
      },
      body: body,
    });

    console.log("📊 Response status:", response.status);
    console.log(
      "📊 Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    const responseText = await response.text();
    console.log("📊 Response length:", responseText.length);
    console.log(
      "📊 Response preview (first 500 chars):",
      responseText.substring(0, 500)
    );

    if (responseText.includes("<!DOCTYPE") || responseText.includes("<html")) {
      console.error("❌ Received HTML instead of JSON!");
      console.error("💡 This indicates an authentication or session issue.");
      return;
    }

    try {
      const jsonData = JSON.parse(responseText);
      console.log("✅ Successfully parsed JSON response");
      console.log("📊 Response keys:", Object.keys(jsonData));
      if (jsonData.data) {
        console.log("📊 Jobs found:", jsonData.data.TotalResults || 0);
      }
    } catch (parseError) {
      console.error("❌ Failed to parse JSON:", parseError.message);
    }
  } catch (error) {
    console.error("❌ Request failed:", error.message);
  }
}

debugAPIResponse();

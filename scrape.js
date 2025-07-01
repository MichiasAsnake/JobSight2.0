// import "./loadEnv.js"; // Removed as no longer needed
import path from "path";
import { chromium } from "playwright";
import fs from "fs";
import readline from "readline";

// Debug environment variables and paths
console.log("Current working directory:", process.cwd());
console.log("Resolved .env path:", path.resolve(process.cwd(), ".env"));

// Config for storing user credentials
const CONFIG_DIR = process.cwd() + "/.config";
const CREDENTIALS_FILE = CONFIG_DIR + "/credentials.json";
const DATA_DIR = process.cwd() + "/data";

// Ensure config and data directories exist
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Function to read user input
async function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Function to load saved credentials
async function loadCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading credentials:", error);
  }
  return { accounts: [] };
}

// Function to save credentials
async function saveCredentials(credentials) {
  try {
    fs.writeFileSync(
      CREDENTIALS_FILE,
      JSON.stringify(credentials, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Error saving credentials:", error);
  }
}

// Function to extract data from the job list row - ENHANCED VERSION
async function extractListData(row, page) {
  try {
    // Get job number first as it's the most critical
    const jobNumber = await row.getAttribute("data-jobnumber");
    if (!jobNumber) {
      console.error("No job number found in row");
      return null;
    }

    // Use a more resilient approach to get cell data
    const getCellText = async (selector) => {
      try {
        return await row.$eval(selector, (el) => el.textContent?.trim() || "");
      } catch (error) {
        console.warn(`Failed to get cell text for ${selector}:`, error);
        return "";
      }
    };

    const getCellAttribute = async (selector, attribute) => {
      try {
        return await row.$eval(
          selector,
          (el, attr) => el.getAttribute(attr) || "",
          attribute
        );
      } catch (error) {
        console.warn(
          `Failed to get cell attribute ${attribute} for ${selector}:`,
          error
        );
        return "";
      }
    };

    // Extract customer name properly - get only the text before the job tag container
    const customerName = await row
      .$eval("td:nth-child(2)", (td) => {
        // Get all text nodes that are direct children of the td
        const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            // Only accept text nodes that are direct children of td
            // and not inside the jobtag-container
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            // Reject if inside jobtag-container
            if (parent.closest(".jobtag-container, .js-jobtag-container")) {
              return NodeFilter.FILTER_REJECT;
            }
            // Accept if parent is the td itself or a direct child
            if (parent === td || parent.parentElement === td) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          },
        });
        let customerName = "";
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent?.trim();
          if (text && text.length > 0) {
            customerName += text + " ";
          }
        }
        return customerName.trim();
      })
      .catch(() => "");

    console.log(`🏢 Extracted customer name: "${customerName}"`);

    // Get other cell data with error handling and proper date validation
    const [description, status, orderNumber, dateInRaw, shipDateRaw] =
      await Promise.all([
        getCellText("td:nth-child(3)"),
        getCellText("td:nth-child(4) .cw--master-status-pill"),
        getCellText("td:nth-child(5)"),
        getCellAttribute("td:nth-child(6) .js-tz-aware", "data-tz-utc"),
        getCellAttribute("td:nth-child(7) .js-tz-aware", "data-tz-utc"),
      ]);

    // Try fallback selectors for dates if primary ones fail
    let dateInFallback = "";
    let shipDateFallback = "";
    if (!dateInRaw) {
      dateInFallback = await getCellText("td:nth-child(6)").catch(() => "");
      console.log(`🔄 Date In fallback text: "${dateInFallback}"`);
    }
    if (!shipDateRaw) {
      shipDateFallback = await getCellText("td:nth-child(7)").catch(() => "");
      console.log(`🔄 Ship Date fallback text: "${shipDateFallback}"`);
    }

    // Clean the title by removing tag information and formatting properly
    const cleanTitle = (rawTitle) => {
      if (!rawTitle) return "";
      console.log(`🧹 Starting title cleanup for: "${rawTitle}"`);
      // First, normalize whitespace and remove newlines
      let cleanedTitle = rawTitle
        .replace(/\n/g, " ") // Replace newlines with spaces
        .replace(/\r/g, " ") // Replace carriage returns with spaces
        .replace(/\s+/g, " ") // Normalize multiple spaces to single space
        .trim();
      console.log(`🧹 After whitespace normalization: "${cleanedTitle}"`);
      // Remove various tag formats:
      // 1. Tag codes with numbers (like EM50, HW50, CR53, Bagging106)
      cleanedTitle = cleanedTitle.replace(/\b[A-Z]{2,8}\d+\b/g, "");
      // 2. Common tag words followed by numbers (like "Bagging106", "Misc53")
      cleanedTitle = cleanedTitle.replace(
        /\b(Bagging|Misc|Miscellaneous)\d+\b/gi,
        ""
      );
      // 3. Remove standalone numbers that might be quantities
      cleanedTitle = cleanedTitle.replace(/\b\d{1,4}\b/g, "");
      // 4. Clean up any leftover patterns
      cleanedTitle = cleanedTitle
        .replace(/\s+/g, " ") // Normalize spaces again
        .trim();
      console.log(`🧹 After tag removal: "${cleanedTitle}"`);
      // Convert to proper case (Title Case) but preserve known acronyms
      const knownAcronyms = [
        "LLC",
        "INC",
        "USA",
        "US",
        "UK",
        "API",
        "GPS",
        "USB",
        "LED",
        "USB",
      ];
      cleanedTitle = cleanedTitle
        .toLowerCase()
        .split(" ")
        .map((word) => {
          if (word.length === 0) return word;
          // Check if it's a known acronym
          const upperWord = word.toUpperCase();
          if (knownAcronyms.includes(upperWord)) {
            return upperWord;
          }
          // Regular title case
          return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(" ")
        .trim();
      console.log(`🧹 Final title result: "${cleanedTitle}"`);
      return cleanedTitle;
    };

    const cleanedTitle = cleanTitle(description);

    // Validate and format dates properly
    const validateShipDate = (dateStr) => {
      if (!dateStr || dateStr.trim() === "") {
        console.log(`📅 Empty ship_date field, setting to null`);
        return null;
      }
      // Clean the date string - remove extra text and whitespace
      let cleanDateStr = dateStr.trim();
      // Extract date pattern (MM/DD/YYYY) from string that might contain extra text
      const dateMatch = cleanDateStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        cleanDateStr = dateMatch[1];
        console.log(
          `📅 Extracted clean date: "${cleanDateStr}" from "${dateStr}"`
        );
      }
      try {
        const date = new Date(cleanDateStr);
        if (isNaN(date.getTime())) {
          console.warn(
            `📅 Invalid ship_date format: "${dateStr}", setting to null`
          );
          return null;
        }
        return date.toISOString().split("T")[0]; // Return date only (YYYY-MM-DD)
      } catch (error) {
        console.warn(`📅 Ship date parsing error for "${dateStr}":`, error);
        return null;
      }
    };

    const validateCreatedAt = (dateStr) => {
      if (!dateStr || dateStr.trim() === "") {
        console.log(`📅 Empty created_at field, will use database default`);
        return undefined; // Omit field so database uses defaultNow()
      }
      // Clean the date string - remove extra text and whitespace
      let cleanDateStr = dateStr.trim();
      // Extract date pattern (MM/DD/YYYY) from string that might contain extra text
      const dateMatch = cleanDateStr.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      if (dateMatch) {
        cleanDateStr = dateMatch[1];
        console.log(
          `📅 Extracted clean created date: "${cleanDateStr}" from "${dateStr}"`
        );
      }
      try {
        const date = new Date(cleanDateStr);
        if (isNaN(date.getTime())) {
          console.warn(
            `📅 Invalid created_at format: "${dateStr}", will use database default`
          );
          return undefined;
        }
        return date.toISOString();
      } catch (error) {
        console.warn(`📅 Created_at parsing error for "${dateStr}":`, error);
        return undefined;
      }
    };

    const shipDate = validateShipDate(shipDateRaw || shipDateFallback);
    const createdAt = validateCreatedAt(dateInRaw || dateInFallback);

    // Get tags with error handling
    let processCodes = [];
    try {
      await row.waitForSelector(".ew-badge.static", { timeout: 5000 });
      processCodes = await row.$$eval(".ew-badge.static", (badges) => {
        return badges.map((badge) => {
          const code = badge.getAttribute("data-code")?.toUpperCase() || "";
          const quantity = parseInt(
            badge.querySelector(".process-qty")?.textContent || "0"
          );
          return { code, quantity };
        });
      });
    } catch (e) {
      console.warn(
        `Timeout waiting for tags in job row ${jobNumber}. Proceeding without tags.`
      );
    }

    // Normalize tag codes
    const normalizedTags = processCodes.map((tag) => ({
      code: tag.code === "MISC" ? "MISC" : tag.code,
      quantity: tag.quantity,
    }));

    // Determine priority from tags or status
    const determinePriority = () => {
      // Check for MUST priority in tags or status
      if (
        normalizedTags.some((tag) => tag.code === "MUST") ||
        status.toLowerCase().includes("must")
      ) {
        return "MUST";
      }
      // Check for other priority indicators
      if (
        status.toLowerCase().includes("rush") ||
        status.toLowerCase().includes("urgent")
      ) {
        return "high";
      }
      return "normal";
    };

    // ENHANCED DATA EXTRACTION: Navigate to job detail page to get additional data
    let enhancedData = {
      customer: {
        company: customerName,
        contactPerson: "",
        phone: "",
        email: "",
      },
      comment: "",
      approvedBy: "",
      approvedDate: "",
      pricing: { subtotal: 0.0, salesTax: 0.0, totalDue: 0.0, currency: "USD" },
      shipments: [],
      lineItems: [],
      workflow: {
        hasJobFiles: false,
        hasProof: false,
        hasPackingSlip: false,
        needsPanels: normalizedTags.some((tag) => tag.code.includes("PANEL")),
        isRush: determinePriority() === "MUST",
      },
      production: {
        daysInProduction: 0,
        estimatedCompletionDate: shipDate,
        productionNotes: [],
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        department: "",
        tags: normalizedTags.map((tag) => tag.code.toLowerCase()),
        complexity: "standard",
      },
    };

    // Try to get enhanced data from job detail page
    try {
      console.log(`🔍 Navigating to job detail page for ${jobNumber}...`);
      const jobDetailUrl = `https://intranet.decopress.com/Jobs/job.aspx?ID=${jobNumber}`;

      // Create a new page for job details to avoid interfering with list page
      const detailPage = await page.context().newPage();
      await detailPage.goto(jobDetailUrl, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      // Wait for the job form to load
      await detailPage.waitForSelector("#aspnetForm", { timeout: 10000 });

      // Extract customer information
      try {
        const customerNameDetail = await detailPage
          .$eval("#customer", (el) => el.value)
          .catch(() => "");
        const customerId = await detailPage
          .$eval("#customerId", (el) => el.value)
          .catch(() => "");

        // Get customer contact person from dropdown
        const selectedContactId = await detailPage
          .$eval("#customerUserId", (el) => el.value)
          .catch(() => "");
        let contactPerson = "";
        if (selectedContactId && selectedContactId !== "-1") {
          contactPerson = await detailPage
            .$eval(`#customerUser option[value="${selectedContactId}"]`, (el) =>
              el.textContent?.trim()
            )
            .catch(() => "");
        }

        // Get phone and email
        const phone = await detailPage
          .$eval("#phone", (el) => el.textContent?.trim())
          .catch(() => "");
        const email = await detailPage
          .$eval("#email", (el) => el.textContent?.trim())
          .catch(() => "");

        enhancedData.customer = {
          company: customerNameDetail || customerName,
          contactPerson: contactPerson,
          phone: phone,
          email: email,
        };

        console.log(
          `✅ Extracted customer: ${enhancedData.customer.company} - ${contactPerson}`
        );
      } catch (error) {
        console.warn(`⚠️ Error extracting customer data:`, error);
      }

      // Extract order details
      try {
        const orderComment = await detailPage
          .$eval("#orderComment", (el) => el.value)
          .catch(() => "");
        enhancedData.comment = orderComment;

        // Get approval information from history
        const historyRecords = await detailPage
          .$$eval(".job-history-record", (records) => {
            return records
              .map((record) => record.textContent?.trim())
              .filter((text) => text);
          })
          .catch(() => []);

        // Look for approval patterns in history
        const approvalRecord = historyRecords.find(
          (record) =>
            record.toLowerCase().includes("approved") ||
            record.toLowerCase().includes("approval")
        );

        if (approvalRecord) {
          const match = approvalRecord.match(/(.+) - (.+) by (.+) On/);
          if (match) {
            enhancedData.approvedBy = match[3] || "";
            enhancedData.approvedDate = match[2] || "";
          }
        }

        console.log(`✅ Extracted order comment and approval info`);
      } catch (error) {
        console.warn(`⚠️ Error extracting order details:`, error);
      }

      // Extract pricing information
      try {
        const subtotal = await detailPage
          .$eval("#job-joblines-subtotal-content", (el) => {
            const text = el.textContent?.trim() || "";
            return parseFloat(text.replace(/[$,]/g, "")) || 0.0;
          })
          .catch(() => 0.0);

        const tax = await detailPage
          .$eval("#job-joblines-tax-content", (el) => {
            const text = el.textContent?.trim() || "";
            return parseFloat(text.replace(/[$,]/g, "")) || 0.0;
          })
          .catch(() => 0.0);

        const total = await detailPage
          .$eval("#job-joblines-costtotal-content", (el) => {
            const text = el.textContent?.trim() || "";
            return parseFloat(text.replace(/[$,]/g, "")) || 0.0;
          })
          .catch(() => 0.0);

        enhancedData.pricing = {
          subtotal: subtotal,
          salesTax: tax,
          totalDue: total,
          currency: "USD",
        };

        console.log(`✅ Extracted pricing: $${total}`);
      } catch (error) {
        console.warn(`⚠️ Error extracting pricing:`, error);
      }

      // Extract shipment information
      try {
        const shipments = await detailPage
          .$$eval(".saved-address", (addresses) => {
            return addresses.map((address, index) => {
              const contactName =
                address.querySelector(".media-body")?.textContent?.trim() || "";
              const addressText =
                address.querySelector("address")?.textContent?.trim() || "";

              // Parse address components
              const addressParts = addressText
                .split(",")
                .map((part) => part.trim());
              const street = addressParts[0] || "";
              const cityStateZip = addressParts[1] || "";

              const cityStateZipParts = cityStateZip.split(" ");
              const state =
                cityStateZipParts[cityStateZipParts.length - 2] || "";
              const zipCode =
                cityStateZipParts[cityStateZipParts.length - 1] || "";
              const city = cityStateZipParts.slice(0, -2).join(" ") || "";

              return {
                shipmentNumber: index + 1,
                status: "NDA", // Default - would need to extract from shipping options
                shippingMethod: "Standard", // Default
                trackingNumber: null,
                shipToAddress: {
                  company: contactName.split("/")[0]?.trim() || "",
                  street: street,
                  city: city,
                  state: state,
                  zipCode: zipCode,
                  country: "US",
                },
                contactInfo: {
                  name: contactName.split("/")[1]?.trim() || contactName,
                  phone: "", // Not visible in this view
                  email: "", // Not visible in this view
                },
                specialInstructions: "",
              };
            });
          })
          .catch(() => []);

        enhancedData.shipments = shipments;
        console.log(`✅ Extracted ${shipments.length} shipments`);
      } catch (error) {
        console.warn(`⚠️ Error extracting shipments:`, error);
      }

      // Extract line items
      try {
        const lineItems = await detailPage
          .$$eval(".js-jobline-row", (rows) => {
            return rows.map((row) => {
              const assetSKU =
                row.querySelector("td:first-child")?.textContent?.trim() || "";
              const description =
                row.querySelector("td:nth-child(2)")?.textContent?.trim() || "";
              const quantity =
                parseInt(
                  row.querySelector("td:nth-child(4)")?.textContent?.trim()
                ) || 0;
              const unitPrice =
                parseFloat(
                  row.querySelector("td:nth-child(7)")?.textContent?.trim()
                ) || 0.0;
              const garment =
                row.querySelector("td:nth-child(8)")?.textContent?.trim() || "";
              const comment =
                row.querySelector("td:nth-child(9)")?.textContent?.trim() || "";

              // Check for image
              const hasImage =
                row.querySelector(".js-jobline-asset-image-container img") !==
                null;

              // Check for PDF
              const hasPDF =
                row.querySelector(".jobline-file-icon .fal.fa-file-pdf") !==
                null;

              return {
                assetSKU: assetSKU,
                description: description,
                category: garment, // Use garment as category
                quantity: quantity,
                unitPrice: unitPrice,
                totalPrice: quantity * unitPrice,
                comment: comment,
                status: "Active", // Default status
                hasImage: hasImage,
                hasPDF: hasPDF,
              };
            });
          })
          .catch(() => []);

        enhancedData.lineItems = lineItems;
        console.log(`✅ Extracted ${lineItems.length} line items`);
      } catch (error) {
        console.warn(`⚠️ Error extracting line items:`, error);
      }

      // Extract workflow status
      try {
        const hasJobFiles = await detailPage
          .$eval(
            '.job-file-upload-option[data-option="job-files"] .fal.fa-copy',
            (el) => el.style.display !== "none"
          )
          .catch(() => false);

        const hasProof = await detailPage
          .$eval(
            '.job-file-upload-option[data-option="job-proof"] .fal.fa-file-pdf',
            (el) => el.style.display !== "none"
          )
          .catch(() => false);

        const hasPackingSlip = await detailPage
          .$eval(
            '.job-file-upload-option[data-option="job-packing-slip"] .fal.fa-copy',
            (el) => el.style.display !== "none"
          )
          .catch(() => false);

        enhancedData.workflow = {
          hasJobFiles: hasJobFiles,
          hasProof: hasProof,
          hasPackingSlip: hasPackingSlip,
          needsPanels: normalizedTags.some((tag) => tag.code.includes("PANEL")),
          isRush: determinePriority() === "MUST",
        };

        console.log(`✅ Extracted workflow status`);
      } catch (error) {
        console.warn(`⚠️ Error extracting workflow status:`, error);
      }

      // Close the detail page
      await detailPage.close();
    } catch (error) {
      console.warn(
        `⚠️ Error accessing job detail page for ${jobNumber}:`,
        error
      );
    }

    // Build the order object in our target structure
    const orderData = {
      jobNumber,
      orderNumber,
      status,
      priority: determinePriority(),

      // Customer Information - ENHANCED
      customer: enhancedData.customer,

      // Order Details
      description: cleanedTitle,
      comment: enhancedData.comment,

      // Dates
      dateEntered: createdAt,
      requestedShipDate: shipDate,

      // Approval Information - ENHANCED
      approvedBy: enhancedData.approvedBy,
      approvedDate: enhancedData.approvedDate,

      // Financial Summary - ENHANCED
      pricing: enhancedData.pricing,

      // Shipment Information - ENHANCED
      shipments:
        enhancedData.shipments.length > 0
          ? enhancedData.shipments
          : [
              {
                shipmentNumber: 1,
                status: "NDA",
                shippingMethod: "Standard",
                trackingNumber: null,
                shipToAddress: {
                  company: customerName,
                  street: "",
                  city: "",
                  state: "",
                  zipCode: "",
                  country: "US",
                },
                contactInfo: {
                  name: "",
                  phone: "",
                  email: "",
                },
                specialInstructions: "",
              },
            ],

      // Line Items - ENHANCED
      lineItems:
        enhancedData.lineItems.length > 0
          ? enhancedData.lineItems
          : [
              {
                assetSKU: "",
                description: cleanedTitle,
                category: "",
                quantity: 0,
                unitPrice: 0.0,
                totalPrice: 0.0,
                comment: "",
                status: status,
                hasImage: false,
                hasPDF: false,
              },
            ],

      // Workflow Status - ENHANCED
      workflow: enhancedData.workflow,

      // Production Information
      production: enhancedData.production,

      // Metadata
      metadata: enhancedData.metadata,
    };

    return orderData;
  } catch (error) {
    console.error("Error extracting list data:", error);
    return null;
  }
}

// Function to scrape all jobs from the list - SIMPLIFIED VERSION
async function scrapeJobs(page, currentPageNumber = 1) {
  console.log(`Scraping jobs on page ${currentPageNumber}...`);
  try {
    // Wait for the jobs table to be visible
    await page.waitForSelector("#jobStatusListResults");
    const jobs = [];
    const failedJobs = [];
    let processedCount = 0;

    while (true) {
      // Get currently available job rows on this page (dynamic approach)
      const currentJobRows = await page.$$eval(
        "#jobStatusListResults tr.js-jobstatus-row",
        (rows) => {
          return rows
            .map((row, index) => {
              const jobNumber = row.getAttribute("data-jobnumber");
              const orderNumber =
                row.querySelector("td:nth-child(5)")?.textContent?.trim() || "";
              const link = row
                .querySelector(`a[href*="job.aspx?ID=${jobNumber}"]`)
                ?.getAttribute("href");
              return {
                jobNumber,
                orderNumber,
                link,
                index,
              };
            })
            .filter((item) => item.jobNumber !== null && item.link !== null);
        }
      );

      if (currentJobRows.length === 0) {
        console.log("No more job rows found on current page");
        break;
      }

      // Find the next unprocessed job (we process them in order)
      const nextJob = currentJobRows[processedCount];
      if (!nextJob) {
        console.log("All jobs on current page have been processed");
        break;
      }

      const { jobNumber, orderNumber, link } = nextJob;
      processedCount++;

      try {
        console.log(
          `🔄 Processing job ${jobNumber} (${processedCount}/${currentJobRows.length})...`
        );

        // Extract list data with row-based approach for better reliability
        const row = await page.$(`tr[data-jobnumber="${jobNumber}"]`);
        if (!row) {
          console.error(`❌ Could not find row for job ${jobNumber}`);
          failedJobs.push(jobNumber);
          continue;
        }

        // Use extractListData to get the order data in our target structure
        const orderData = await extractListData(row, page);
        if (!orderData) {
          console.error(`❌ Failed to extract order data for job ${jobNumber}`);
          failedJobs.push(jobNumber);
          continue;
        }

        jobs.push(orderData);
        console.log(`✅ Successfully processed job ${jobNumber}`);
      } catch (error) {
        console.error(`❌ Error processing job ${jobNumber}:`, error);
        failedJobs.push(jobNumber);
        continue;
      }
    }

    console.log(`\n📊 Page ${currentPageNumber} Scraping Summary:`);
    console.log(`✅ Successfully processed: ${jobs.length} jobs`);
    console.log(`❌ Failed to process: ${failedJobs.length} jobs`);
    if (failedJobs.length > 0) {
      console.log(`Failed jobs: ${failedJobs.join(", ")}`);
    }

    return jobs;
  } catch (error) {
    console.error(
      `❌ Critical error in scrapeJobs for page ${currentPageNumber}:`,
      error
    );
    throw error;
  }
}

// Helper function to wait for job list page synchronization
async function waitForJobListSync(page) {
  try {
    // Wait for multiple conditions to ensure the page is fully loaded
    await Promise.all([
      // Wait for network to be idle
      page.waitForLoadState("networkidle"),
      // Wait for the table to be populated
      page.waitForSelector("#jobStatusListResults tr.js-jobstatus-row", {
        timeout: 15000,
        state: "attached",
      }),
      // Wait for any loading indicators to disappear
      page
        .waitForSelector(".loading-indicator", {
          state: "hidden",
          timeout: 5000,
        })
        .catch(() => {}), // Don't fail if loading indicator doesn't exist
    ]);

    // Additional wait to ensure JavaScript has finished processing and rows are interactive
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(
          "#jobStatusListResults tr.js-jobstatus-row"
        );
        return (
          rows.length > 0 &&
          Array.from(rows).every((row) => row.offsetHeight > 0)
        );
      },
      { timeout: 10000 }
    );

    // Additional small delay to ensure DOM is stable
    await page.waitForTimeout(1000);
    console.log("✅ Job list page synchronized");
  } catch (error) {
    console.warn("⚠️ Job list synchronization had issues:", error);
  }
}

// Scrape all jobs across paginated pages using "next" button - SIMPLIFIED VERSION
async function scrapeAllJobs(page) {
  let allJobs = [];
  let currentPage = 1;

  try {
    console.log("🔍 Starting pagination with 'next' button approach...");

    while (true) {
      try {
        console.log(`\n📖 Processing page ${currentPage}...`);

        // Scrape jobs on the current page
        console.log(`🚀 Starting to scrape jobs on page ${currentPage}...`);
        const jobs = await scrapeJobs(page, currentPage);
        console.log(
          `✅ Page ${currentPage} complete: ${jobs.length} jobs scraped`
        );
        allJobs = allJobs.concat(jobs);

        // Log cumulative progress
        console.log(
          `📊 Total progress: ${allJobs.length} jobs from ${currentPage} pages`
        );

        // Check if "next" button is available and not disabled
        const nextButton = await page.$(
          ".pagination li.page-item.next:not(.disabled) a"
        );
        if (!nextButton) {
          console.log(
            "📄 No more pages available - 'next' button is disabled or not found"
          );
          break;
        }

        // Click the "next" button
        console.log(
          `🔄 Clicking 'next' button to go to page ${currentPage + 1}...`
        );
        try {
          await nextButton.click();
          console.log(`✅ Clicked 'next' button`);

          // Use our robust synchronization function
          console.log(
            `⏳ Waiting for page ${currentPage + 1} to load and synchronize...`
          );
          await waitForJobListSync(page);

          // Extra delay to ensure page is fully stable after pagination
          await page.waitForTimeout(2000);
          console.log(`✅ Page ${currentPage + 1} is ready for scraping`);

          currentPage++;
        } catch (clickError) {
          console.error(`❌ Failed to click 'next' button:`, clickError);
          break;
        }
      } catch (error) {
        console.error(`❌ Error processing page ${currentPage}:`, error);
        // Try to recover by navigating back to the job list
        try {
          console.log(`🔄 Attempting to recover page state...`);
          await page.goto(
            "https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu",
            {
              waitUntil: "networkidle",
              timeout: 30000,
            }
          );
          await waitForJobListSync(page);
          console.log(`✅ Recovered page state, continuing with next page`);
        } catch (recoveryError) {
          console.error(
            `❌ Failed to recover from page ${currentPage} error:`,
            recoveryError
          );
        }
        // Continue with next page instead of failing completely
        currentPage++;
        continue;
      }
    }

    console.log(
      `\n🎉 Pagination complete! Total jobs scraped: ${allJobs.length} from ${currentPage} pages`
    );
  } catch (error) {
    console.error("❌ Critical error in scrapeAllJobs:", error);
  }

  return allJobs;
}

// Function to save orders to JSON file
async function saveOrdersToFile(orders) {
  const ordersData = {
    orders: orders,
    summary: {
      totalOrders: orders.length,
      lastUpdated: new Date().toISOString(),
      scrapedAt: new Date().toISOString(),
    },
  };

  const filePath = path.join(DATA_DIR, "orders.json");
  fs.writeFileSync(filePath, JSON.stringify(ordersData, null, 2), "utf8");
  console.log(`💾 Saved ${orders.length} orders to ${filePath}`);
}

// Main function to run the scraper
async function run() {
  let browser = null;
  try {
    // Load saved credentials
    const credentials = await loadCredentials();

    // Handle user authentication
    let username,
      password,
      useStoredAuth = false;
    if (credentials.accounts && credentials.accounts.length > 0) {
      console.log("Saved accounts:");
      credentials.accounts.forEach((account, index) => {
        console.log(`${index + 1}. ${account.username}`);
      });
      console.log(`${credentials.accounts.length + 1}. Use a new account`);

      const choice = await promptUser(
        "Select an account (number) or press Enter for last used: "
      );
      if (choice === "") {
        // Use last used account
        const lastUsed =
          credentials.accounts.find((a) => a.isLastUsed) ||
          credentials.accounts[0];
        username = lastUsed.username;
        password = lastUsed.password;
        useStoredAuth = true;
        console.log(`Using account: ${username}`);
      } else {
        const choiceNum = parseInt(choice);
        if (choiceNum > 0 && choiceNum <= credentials.accounts.length) {
          username = credentials.accounts[choiceNum - 1].username;
          password = credentials.accounts[choiceNum - 1].password;
          useStoredAuth = true;
          console.log(`Using account: ${username}`);
        } else {
          // New account flow
          username = await promptUser("Enter username: ");
          password = await promptUser("Enter password: ");
          const saveAccount = await promptUser(
            "Save this account for future use? (y/n): "
          );
          if (saveAccount.toLowerCase() === "y") {
            // Update all accounts to not be last used
            credentials.accounts.forEach(
              (account) => (account.isLastUsed = false)
            );
            // Add new account
            credentials.accounts.push({
              username,
              password,
              isLastUsed: true,
            });
            await saveCredentials(credentials);
            console.log("Account saved!");
          }
        }
      }

      // Update last used account
      if (useStoredAuth) {
        credentials.accounts.forEach((account) => {
          account.isLastUsed = account.username === username;
        });
        await saveCredentials(credentials);
      }
    } else {
      // No saved accounts
      username = await promptUser("Enter username: ");
      password = await promptUser("Enter password: ");
      const saveAccount = await promptUser(
        "Save this account for future use? (y/n): "
      );
      if (saveAccount.toLowerCase() === "y") {
        credentials.accounts = [
          {
            username,
            password,
            isLastUsed: true,
          },
        ];
        await saveCredentials(credentials);
        console.log("Account saved!");
      }
    }

    // Launch browser with increased timeouts
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
      timeout: 60000, // 60 second timeout
    });

    // Use a persistent context to maintain cookies between runs
    const context = await browser.newContext({
      storageState: fs.existsSync(CONFIG_DIR + "/storage.json")
        ? CONFIG_DIR + "/storage.json"
        : undefined,
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    });

    const page = await context.newPage();

    // Set longer timeouts for navigation and waiting
    page.setDefaultTimeout(60000); // 60 seconds timeout
    page.setDefaultNavigationTimeout(60000);

    // 🔐 1. LOGIN TO OMS
    console.log("Navigating to login page...");
    await page.goto("https://intranet.decopress.com/", {
      waitUntil: "networkidle",
    });

    // Check if login form exists (if not, we're already logged in)
    const loginFormExists = await page.evaluate(() => {
      return !!document.querySelector("#txt_Username");
    });

    if (loginFormExists) {
      console.log("Logging in...");
      await page.fill("#txt_Username", username);
      await page.fill("#txt_Password", password);

      // Find and click the login button
      const loginButtonSelector = [
        'input[type="button"]',
        'input[type="submit"]',
        'button[type="submit"]',
        "#login-button",
      ];

      for (const selector of loginButtonSelector) {
        const button = await page.$(selector);
        if (button) {
          await button.click();
          console.log(`Clicked login button using selector: ${selector}`);
          break;
        }
      }
      console.log("Login successful");
    } else {
      console.log("Already logged in");
    }

    // Save storage state for future runs
    await context.storageState({ path: CONFIG_DIR + "/storage.json" });

    // 📄 2. NAVIGATE TO JOB LIST
    console.log("Navigating to job list...");
    await page.goto(
      "https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu",
      {
        waitUntil: "networkidle",
        timeout: 30000,
      }
    );

    // Wait for both the table and its contents to be fully loaded
    await Promise.all([
      // Wait for network to be idle
      page.waitForLoadState("networkidle"),
      // Wait for the table to be populated
      page.waitForSelector("#jobStatusListResults tr.js-jobstatus-row", {
        timeout: 20000,
        state: "attached",
      }),
      // Wait for any loading indicators to disappear
      page
        .waitForSelector(".loading-indicator", {
          state: "hidden",
          timeout: 5000,
        })
        .catch(() => {}),
    ]);

    // 🔧 CRITICAL FIX: Disable "Closed" filter and use "next" pagination
    console.log("🔍 Checking and disabling 'Closed' filter...");
    try {
      // Look for the "Closed" filter checkbox and uncheck it if it's checked
      const closedFilterCheckbox = await page.$(
        'input[data-code="closed"][name="job-status"]'
      );
      if (closedFilterCheckbox) {
        const isChecked = await closedFilterCheckbox.isChecked();
        if (isChecked) {
          console.log("❌ Found 'Closed' filter is enabled - disabling it...");
          await closedFilterCheckbox.uncheck();
          console.log("✅ Disabled 'Closed' filter");

          // Wait for the page to update after unchecking the filter
          await page.waitForLoadState("networkidle");
          await page.waitForTimeout(2000);

          // Verify the filter is now unchecked
          const isStillChecked = await closedFilterCheckbox.isChecked();
          if (!isStillChecked) {
            console.log("✅ Confirmed 'Closed' filter is now disabled");
          } else {
            console.warn("⚠️ 'Closed' filter may still be enabled");
          }
        } else {
          console.log("✅ 'Closed' filter is already disabled");
        }
      } else {
        console.log("ℹ️ No 'Closed' filter checkbox found - proceeding");
      }
    } catch (error) {
      console.error("❌ Error while handling 'Closed' filter:", error);
      console.log("📋 Proceeding with current view...");
    }

    // Additional wait to ensure JavaScript has finished processing
    await page.waitForFunction(
      () => {
        const rows = document.querySelectorAll(
          "#jobStatusListResults tr.js-jobstatus-row"
        );
        return (
          rows.length > 0 &&
          Array.from(rows).every((row) => row.offsetHeight > 0)
        );
      },
      { timeout: 10000 }
    );

    console.log("Job rows are visible and fully loaded");

    // Debug: Save screenshot and HTML
    await page.screenshot({ path: "debug_jobs_page.png" });
    const html = await page.content();
    fs.writeFileSync("debug_jobs_page.html", html);
    console.log("Saved debug_jobs_page.png and debug_jobs_page.html");

    // Scrape all jobs and save to JSON file
    const orders = await scrapeAllJobs(page);
    console.log(`Scraped ${orders.length} orders (all pages)`);

    // Save to JSON file instead of database
    await saveOrdersToFile(orders);

    console.log("✅ Scraping complete! Orders saved to data/orders.json");
  } catch (error) {
    console.error("Error during scraping:", error);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (error) {
        console.error("Error closing browser:", error);
      }
    }
  }
}

// Export for use in other modules
export { run as scrapeOrders };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run();
}

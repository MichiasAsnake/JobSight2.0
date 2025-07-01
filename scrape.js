import "./loadEnv.js";
import path from "path";
// Debug environment variables and paths
console.log("Current working directory:", process.cwd());
console.log("Resolved .env path:", path.resolve(process.cwd(), ".env"));
console.log("Environment variables loaded:");
console.log("DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "Not set");
console.log("ORGANIZATION_NAME:", process.env.ORGANIZATION_NAME ? "Set" : "Not set");
import { chromium } from "playwright";
import fs from "fs";
import readline from "readline";
import { saveScrapedJobs } from "./lib/db.js";
import { transformToEnhanced, createLineItemsFromImages, transformImagesToFiles, } from "./lib/utils/jobDataTransform.js";
import { extractEnhancedJobDetails, } from "./lib/utils/enhancedExtraction.js";
// Config for storing user credentials
const CONFIG_DIR = process.cwd() + "/.config";
const CREDENTIALS_FILE = CONFIG_DIR + "/credentials.json";
// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
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
// Function to clean customer names by removing extra content
function cleanCustomerName(rawName) {
    if (!rawName)
        return "";
    console.log(`🧹 Cleaning customer name: "${rawName}"`);
    // With the new extraction method, customer names should be much cleaner
    // So we'll do minimal cleanup
    let cleaned = rawName
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
    // Remove any remaining problematic characters that might have slipped through
    cleaned = cleaned
        .replace(/[^\w\s&.,'-]/g, " ") // Remove special chars except common business ones
        .replace(/\s+/g, " ") // Normalize whitespace again
        .trim();
    // Database length constraint
    const MAX_CUSTOMER_NAME_LENGTH = 100;
    if (cleaned.length > MAX_CUSTOMER_NAME_LENGTH) {
        console.warn(`Customer name too long (${cleaned.length} chars), truncating: "${cleaned}"`);
        cleaned = cleaned.substring(0, MAX_CUSTOMER_NAME_LENGTH).trim();
    }
    // Validate result
    if (cleaned.length < 2) {
        console.warn(`Customer name too short after cleaning: "${rawName}" -> "${cleaned}"`);
        // Emergency fallback
        if (cleaned.length === 0) {
            cleaned = "Unknown Customer";
        }
    }
    console.log(`✅ Customer name result: "${cleaned}"`);
    return cleaned;
}
// Function to load saved credentials
async function loadCredentials() {
    try {
        if (fs.existsSync(CREDENTIALS_FILE)) {
            const data = fs.readFileSync(CREDENTIALS_FILE, "utf8");
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error("Error loading credentials:", error);
    }
    return { accounts: [] };
}
// Function to save credentials
async function saveCredentials(credentials) {
    try {
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), "utf8");
    }
    catch (error) {
        console.error("Error saving credentials:", error);
    }
}
// Function to extract data from the job list row
async function extractListData(row) {
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
            }
            catch (error) {
                console.warn(`Failed to get cell text for ${selector}:`, error);
                return "";
            }
        };
        const getCellAttribute = async (selector, attribute) => {
            try {
                return await row.$eval(selector, (el, attr) => el.getAttribute(attr) || "", attribute);
            }
            catch (error) {
                console.warn(`Failed to get cell attribute ${attribute} for ${selector}:`, error);
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
                    if (!parent)
                        return NodeFilter.FILTER_REJECT;
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
        // Extract job descriptions from job tag container
        const jobDescriptions = await row
            .$$eval(".jobtag-container .tag-text", (tagElements) => {
            return tagElements
                .map((tagEl) => {
                const text = tagEl.textContent?.trim() || "";
                // Find the parent span with data attributes
                const parentSpan = tagEl.closest("span[data-when-entered-utc]");
                const timestamp = parentSpan?.getAttribute("data-when-entered-utc") || "";
                // Extract author from tooltip if available
                const tooltip = parentSpan?.getAttribute("data-tooltip") || "";
                const authorMatch = tooltip.match(/from @(\w+)/);
                const author = authorMatch ? authorMatch[1] : undefined;
                return {
                    text,
                    timestamp,
                    author,
                };
            })
                .filter((desc) => desc.text.length > 0); // Filter out empty descriptions
        })
            .catch(() => []);
        console.log(`📝 Extracted ${jobDescriptions.length} job descriptions for job ${jobNumber}`);
        // Get other cell data with error handling and proper date validation
        const [description, status, orderNumber, dateInRaw, shipDateRaw] = await Promise.all([
            getCellText("td:nth-child(3)"),
            getCellText("td:nth-child(4) .cw--master-status-pill"),
            getCellText("td:nth-child(5)"),
            getCellAttribute("td:nth-child(6) .js-tz-aware", "data-tz-utc"),
            getCellAttribute("td:nth-child(7) .js-tz-aware", "data-tz-utc"),
        ]);
        // Additional debugging - get all cell contents to understand the structure
        const allCells = await row
            .$$eval("td", (cells) => {
            return cells.map((cell, index) => ({
                index: index + 1,
                textContent: cell.textContent?.trim() || "",
                innerHTML: cell.innerHTML?.substring(0, 100) + "..." || "",
            }));
        })
            .catch(() => []);
        console.log(`🔍 All cells for job ${jobNumber}:`, JSON.stringify(allCells, null, 2));
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
        // Debug extracted data
        console.log(`🔍 Raw extracted data for job ${jobNumber}:`);
        console.log(`   Description: "${description}"`);
        console.log(`   Status: "${status}"`);
        console.log(`   Order Number: "${orderNumber}"`);
        console.log(`   Date In Raw: "${dateInRaw}"`);
        console.log(`   Ship Date Raw: "${shipDateRaw}"`);
        console.log(`   Date In Fallback: "${dateInFallback}"`);
        console.log(`   Ship Date Fallback: "${shipDateFallback}"`);
        // Clean the title by removing tag information and formatting properly
        const cleanTitle = (rawTitle) => {
            if (!rawTitle)
                return "";
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
            cleanedTitle = cleanedTitle.replace(/\b(Bagging|Misc|Miscellaneous)\d+\b/gi, "");
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
                if (word.length === 0)
                    return word;
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
        // Validate and format dates properly based on database schema
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
                console.log(`📅 Extracted clean date: "${cleanDateStr}" from "${dateStr}"`);
            }
            try {
                const date = new Date(cleanDateStr);
                if (isNaN(date.getTime())) {
                    console.warn(`📅 Invalid ship_date format: "${dateStr}", setting to null`);
                    return null;
                }
                return date.toISOString().split("T")[0]; // Return date only (YYYY-MM-DD)
            }
            catch (error) {
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
                console.log(`📅 Extracted clean created date: "${cleanDateStr}" from "${dateStr}"`);
            }
            try {
                const date = new Date(cleanDateStr);
                if (isNaN(date.getTime())) {
                    console.warn(`📅 Invalid created_at format: "${dateStr}", will use database default`);
                    return undefined;
                }
                return date.toISOString();
            }
            catch (error) {
                console.warn(`📅 Created_at parsing error for "${dateStr}":`, error);
                return undefined;
            }
        };
        const shipDate = validateShipDate(shipDateRaw || shipDateFallback);
        const createdAt = validateCreatedAt(dateInRaw || dateInFallback);
        console.log(`📅 Processed dates - Created: ${createdAt || "database default"}, Ship: ${shipDate || "null"}`);
        // Clean the customer name to ensure it's properly formatted
        const cleanedCustomerName = cleanCustomerName(customerName);
        // Get tags with error handling
        let processCodes = [];
        try {
            await row.waitForSelector(".ew-badge.static", { timeout: 5000 });
            processCodes = await row.$$eval(".ew-badge.static", (badges) => {
                return badges.map((badge) => {
                    const code = badge.getAttribute("data-code")?.toUpperCase() || "";
                    const quantity = parseInt(badge.querySelector(".process-qty")?.textContent || "0");
                    return { code, quantity };
                });
            });
        }
        catch (e) {
            console.warn(`Timeout waiting for tags in job row ${jobNumber}. Proceeding without tags.`);
        }
        // Normalize tag codes
        const normalizedTags = processCodes.map((tag) => ({
            code: tag.code === "MISC" ? "MISC" : tag.code,
            quantity: tag.quantity,
        }));
        // Build the order object conditionally including created_at only if we have a valid value
        const orderData = {
            order_number: orderNumber,
            title: cleanedTitle,
            status: status,
            ship_date: shipDate,
        };
        // Only include created_at if we have a valid value
        if (createdAt !== undefined) {
            orderData.created_at = createdAt;
        }
        return {
            jobNumber,
            customer: { name: cleanedCustomerName },
            order: orderData,
            tags: normalizedTags,
            jobDescriptions: jobDescriptions,
        };
    }
    catch (error) {
        console.error("Error extracting list data:", error);
        return null;
    }
}
// Function to extract image data from job details page
async function extractImageData(page, jobNumber) {
    // Helper function to extract base path from URL
    const extractBasePath = (url) => {
        try {
            if (!url)
                return "";
            if (url.startsWith("/"))
                return url;
            const urlObj = new URL(url);
            return urlObj.pathname;
        }
        catch (error) {
            console.error("Error extracting base path:", error);
            return "";
        }
    };
    try {
        console.log(`🖼️  Extracting images for job ${jobNumber}...`);
        // Wait for the page to be fully loaded
        await page.waitForLoadState("networkidle");
        // Find all image containers
        const imageContainers = await page.$$(".js-jobline-asset-image-container");
        console.log(`🔍 Found ${imageContainers.length} image containers for job ${jobNumber}`);
        if (imageContainers.length === 0) {
            console.log(`❌ No image containers found for job ${jobNumber}`);
            return [];
        }
        const processedImages = [];
        // Process each container
        for (let i = 0; i < imageContainers.length; i++) {
            const container = imageContainers[i];
            console.log(`🔍 Processing container ${i + 1}/${imageContainers.length}...`);
            try {
                // Get asset tag from container
                const assetTag = await container.getAttribute("data-asset-tag");
                console.log(`   📝 Asset tag: ${assetTag}`);
                if (!assetTag) {
                    console.log(`   ⚠️ No asset tag found for container ${i + 1}, skipping`);
                    continue;
                }
                // Check if container has images (many containers are empty)
                const img = await container.$("img[src]");
                const link = await container.$("a[href]");
                if (!img || !link) {
                    console.log(`   📭 Container ${assetTag} is empty (no images), skipping`);
                    continue;
                }
                // Extract URLs directly from DOM (no clicking needed!)
                const thumbnailUrl = await img.getAttribute("src");
                const highResUrl = await link.getAttribute("href");
                console.log(`   🖼️  Thumbnail URL: ${thumbnailUrl?.substring(0, 80)}...`);
                console.log(`   📸 High-res URL: ${highResUrl?.substring(0, 80)}...`);
                // Validate that we have both URLs
                if (!thumbnailUrl || !highResUrl) {
                    console.log(`   ⚠️ Missing URLs for ${assetTag} - thumbnail: ${!!thumbnailUrl}, high-res: ${!!highResUrl}`);
                    continue;
                }
                // Validate URLs are proper blob storage URLs
                const isThumbnailValid = thumbnailUrl.includes("blob.core.windows.net") &&
                    (thumbnailUrl.includes("/thumbnails/") ||
                        thumbnailUrl.includes("_50."));
                const isHighResValid = highResUrl.includes("blob.core.windows.net") &&
                    !highResUrl.includes("/thumbnails/") &&
                    !highResUrl.includes("_50.");
                if (!isThumbnailValid) {
                    console.log(`   ⚠️ Invalid thumbnail URL for ${assetTag}: ${thumbnailUrl.substring(0, 80)}...`);
                }
                if (!isHighResValid) {
                    console.log(`   ⚠️ Invalid high-res URL for ${assetTag}: ${highResUrl.substring(0, 80)}...`);
                }
                // Store the image data (even if validation warnings occurred)
                processedImages.push({
                    asset_tag: assetTag,
                    thumbnail_url: thumbnailUrl,
                    high_res_url: highResUrl,
                    thumbnail_base_path: extractBasePath(thumbnailUrl),
                    high_res_base_path: extractBasePath(highResUrl),
                });
                console.log(`   ✅ Successfully processed image for ${assetTag}`);
            }
            catch (error) {
                console.error(`   ❌ Error processing container ${i + 1}:`, error);
                continue;
            }
        }
        console.log(`✅ Successfully processed ${processedImages.length} images for job ${jobNumber}`);
        // Summary of results
        const validThumbnails = processedImages.filter((img) => img.thumbnail_url.includes("blob.core.windows.net") &&
            (img.thumbnail_url.includes("/thumbnails/") ||
                img.thumbnail_url.includes("_50.")));
        const validHighRes = processedImages.filter((img) => img.high_res_url.includes("blob.core.windows.net") &&
            !img.high_res_url.includes("/thumbnails/") &&
            !img.high_res_url.includes("_50."));
        console.log(`📊 Image Quality Summary:`);
        console.log(`   ✅ Valid thumbnails: ${validThumbnails.length}/${processedImages.length}`);
        console.log(`   ✅ Valid high-res: ${validHighRes.length}/${processedImages.length}`);
        return processedImages;
    }
    catch (error) {
        console.error(`❌ Failed to extract images for job ${jobNumber}:`, error);
        return [];
    }
}
// Main function to extract job data
async function extractJobData(row, page, currentPageNumber) {
    try {
        // First get all the data from the list view BEFORE any navigation
        const listData = await extractListData(row);
        if (!listData) {
            console.error("Failed to extract list data");
            return null;
        }
        // Store the list data we need
        const { jobNumber } = listData;
        // Now that we have all list data, we can safely navigate
        const jobLink = await row.$(`a[href*="job.aspx?ID=${jobNumber}"]`);
        if (!jobLink) {
            console.error(`Could not find job link for job ${jobNumber}`);
            return {
                ...listData,
                order: {
                    ...listData.order,
                    images: [],
                },
            };
        }
        // Get the href before clicking
        const href = await jobLink.getAttribute("href");
        console.log(`📄 Navigating to job ${jobNumber} details via ${href}...`);
        // Navigate to job details page
        try {
            await page.goto(href, { waitUntil: "networkidle", timeout: 30000 });
            console.log("✅ Job details page loaded successfully");
        }
        catch (navigationError) {
            console.error(`❌ Navigation failed for job ${jobNumber}:`, navigationError);
            return {
                ...listData,
                order: {
                    ...listData.order,
                    images: [],
                },
            };
        }
        // Extract image data
        let images;
        try {
            images = await extractImageData(page, jobNumber);
        }
        catch (imageError) {
            console.error(`❌ Image extraction failed for job ${jobNumber}:`, imageError);
            images = [];
        }
        // 🔥 NEW: Extract enhanced job details
        let enhancedDetails = null;
        try {
            console.log(`🔍 Attempting enhanced extraction for job ${jobNumber}...`);
            enhancedDetails = await extractEnhancedJobDetails(page, jobNumber);
            console.log(`✅ Enhanced extraction completed for job ${jobNumber}`);
        }
        catch (enhancedError) {
            console.warn(`⚠️ Enhanced extraction failed for job ${jobNumber}:`, enhancedError);
            console.log("📄 Continuing with basic extraction...");
        }
        // Navigate back to the correct page using pagination (not URL-based navigation)
        try {
            console.log(`🔙 Returning to job list page ${currentPageNumber}...`);
            // First go back to the main job list
            await page.goto("https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu", { waitUntil: "networkidle", timeout: 30000 });
            console.log(`📍 Back to main job list, now navigating to page ${currentPageNumber}`);
            // If we need to go to a page other than 1, click the pagination
            if (currentPageNumber > 1) {
                // Wait for initial page to load
                await waitForJobListSync(page);
                // Click the pagination button for our target page
                console.log(`🔘 Clicking pagination for page ${currentPageNumber}...`);
                await page.click(`.pagination li.page-item[data-lp="${currentPageNumber}"] a`);
                // Wait for the page to load and sync
                await waitForJobListSync(page);
                // Verify we're on the correct page
                try {
                    const activePageElement = await page.$(".pagination li.page-item.active[data-lp]");
                    if (activePageElement) {
                        const activePage = await activePageElement.getAttribute("data-lp");
                        console.log(`✅ Confirmed back on page ${activePage}`);
                    }
                }
                catch (verifyError) {
                    console.warn("⚠️ Could not verify current page:", verifyError);
                }
            }
            else {
                // We're already on page 1, just sync
                await waitForJobListSync(page);
                console.log("✅ Back on page 1");
            }
            console.log("✅ Successfully returned to job list");
        }
        catch (backError) {
            console.error(`❌ Failed to return to job list page ${currentPageNumber} after job ${jobNumber}:`, backError);
            console.log("⚠️ Will continue without proper navigation back");
        }
        // 🔥 NEW: Combine basic and enhanced data
        const baseJobData = {
            ...listData,
            order: {
                ...listData.order,
                images,
            },
        };
        // If enhanced extraction succeeded, create enriched data for storage
        if (enhancedDetails) {
            try {
                // Create transition data combining basic and enhanced information
                const transitionData = {
                    ...baseJobData,
                    customer_emails: enhancedDetails.customerContact.emails,
                    customer_phones: enhancedDetails.customerContact.phones,
                    customer_address: enhancedDetails.customerContact.address,
                    line_items: enhancedDetails.lineItems.length > 0
                        ? enhancedDetails.lineItems
                        : createLineItemsFromImages(images),
                    files: enhancedDetails.files.length > 0
                        ? enhancedDetails.files
                        : transformImagesToFiles(images),
                    timeline: enhancedDetails.timeline,
                };
                // Transform to enhanced format
                const enhancedJobData = transformToEnhanced(baseJobData, transitionData);
                console.log(`✨ Created enhanced job data for ${jobNumber}:`);
                console.log(`   - Customer emails: ${enhancedJobData.customer.emails.length}`);
                console.log(`   - Customer phones: ${enhancedJobData.customer.phones.length}`);
                console.log(`   - Line items: ${enhancedJobData.order.line_items.length}`);
                console.log(`   - Files: ${enhancedJobData.order.files.length}`);
                console.log(`   - Timeline entries: ${enhancedJobData.timeline.length}`);
                // Store enhanced data as metadata on the base job data for the database
                // This allows us to save enhanced data while maintaining compatibility
                baseJobData.enhancedData = enhancedJobData;
            }
            catch (transformError) {
                console.error(`❌ Failed to transform enhanced data for job ${jobNumber}:`, transformError);
                console.log("📄 Returning basic job data only");
            }
        }
        // Return the base job data (with optional enhanced data attached)
        return baseJobData;
    }
    catch (error) {
        console.error("Error extracting job data:", error);
        return null;
    }
}
// Function to scrape all jobs from the list
async function scrapeJobs(page, currentPageNumber = 1) {
    console.log(`Scraping jobs on page ${currentPageNumber}...`);
    try {
        // Wait for the jobs table to be visible
        await page.waitForSelector("#jobStatusListResults");
        const jobs = [];
        const failedJobs = [];
        let processedCount = 0;
        // Get organization name for database operations
        const envOrgName = process.env.ORGANIZATION_NAME || "DecoPress";
        // Add space programmatically if needed: "DecoPress" -> "Deco Press"
        const orgName = envOrgName === "DecoPress" ? "Deco Press" : envOrgName;
        while (true) {
            // Get currently available job rows on this page (dynamic approach)
            const currentJobRows = await page.$$eval("#jobStatusListResults tr.js-jobstatus-row", (rows) => {
                return rows
                    .map((row, index) => {
                    const jobNumber = row.getAttribute("data-jobnumber");
                    const orderNumber = row.querySelector("td:nth-child(5)")?.textContent?.trim() || "";
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
            });
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
                console.log(`🔄 Processing job ${jobNumber} (${processedCount}/${currentJobRows.length})...`);
                // Extract list data with row-based approach for better reliability
                const row = await page.$(`tr[data-jobnumber="${jobNumber}"]`);
                if (!row) {
                    console.error(`❌ Could not find row for job ${jobNumber}`);
                    failedJobs.push(jobNumber);
                    continue;
                }
                // Use extractJobData to handle navigation and image extraction
                const jobData = await extractJobData(row, page, currentPageNumber);
                if (!jobData) {
                    console.error(`❌ Failed to extract job data for job ${jobNumber}`);
                    failedJobs.push(jobNumber);
                    continue;
                }
                jobs.push(jobData);
                console.log(`✅ Successfully processed job ${jobNumber}`);
            }
            catch (error) {
                console.error(`❌ Error processing job ${jobNumber}:`, error);
                failedJobs.push(jobNumber);
                // Try to recover page state for next job
                try {
                    console.log(`🔄 Attempting to recover to page ${currentPageNumber}...`);
                    await navigateToPage(page, currentPageNumber);
                    await waitForJobListSync(page);
                    console.log(`✅ Recovered page state for page ${currentPageNumber}`);
                    // Continue with next job instead of restarting
                }
                catch (recoveryError) {
                    console.error(`❌ Failed to recover page state:`, recoveryError);
                    // Continue anyway - might still work
                }
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
    }
    catch (error) {
        console.error(`❌ Critical error in scrapeJobs for page ${currentPageNumber}:`, error);
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
                .catch(() => { }), // Don't fail if loading indicator doesn't exist
        ]);
        // Additional wait to ensure JavaScript has finished processing and rows are interactive
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll("#jobStatusListResults tr.js-jobstatus-row");
            return (rows.length > 0 &&
                Array.from(rows).every((row) => row.offsetHeight > 0));
        }, { timeout: 10000 });
        // Additional small delay to ensure DOM is stable
        await page.waitForTimeout(1000);
        console.log("✅ Job list page synchronized");
    }
    catch (error) {
        console.warn("⚠️ Job list synchronization had issues:", error);
    }
}
// Helper function to navigate to a specific page
async function navigateToPage(page, pageNumber) {
    try {
        if (pageNumber === 1) {
            // Navigate to the main job list page
            await page.goto("https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu", { waitUntil: "networkidle", timeout: 30000 });
        }
        else {
            // First go to page 1, then navigate to the desired page
            await page.goto("https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu", { waitUntil: "networkidle", timeout: 30000 });
            await waitForJobListSync(page);
            // Click the pagination link for the desired page
            await page.click(`.pagination li.page-item[data-lp="${pageNumber}"] a`);
        }
        // Ensure the page is fully synchronized
        await waitForJobListSync(page);
    }
    catch (error) {
        console.error(`Failed to navigate to page ${pageNumber}:`, error);
        throw error;
    }
}
// Scrape all jobs across paginated pages
async function scrapeAllJobs(page) {
    let allJobs = [];
    try {
        console.log("🔍 Checking pagination...");
        // Get total number of pages from pagination
        const totalPages = await page
            .$$eval(".pagination li.page-item:not(.prev):not(.next)", (items) => items.length)
            .catch(() => {
            console.log("No pagination found, assuming single page");
            return 1;
        });
        console.log(`📄 Found ${totalPages} pages to scrape`);
        for (let i = 1; i <= totalPages; i++) {
            try {
                console.log(`\n📖 Processing page ${i}/${totalPages}...`);
                if (i > 1) {
                    console.log(`🔄 Navigating to page ${i}...`);
                    // Click the pagination link for page i
                    try {
                        await page.click(`.pagination li.page-item[data-lp="${i}"] a`);
                        console.log(`✅ Clicked pagination link for page ${i}`);
                    }
                    catch (clickError) {
                        console.error(`❌ Failed to click pagination for page ${i}:`, clickError);
                        continue;
                    }
                    // Use our robust synchronization function
                    console.log(`⏳ Waiting for page ${i} to load and synchronize...`);
                    await waitForJobListSync(page);
                    // Additional verification that we're on the correct page
                    try {
                        const currentPageElement = await page.$(".pagination li.page-item.active[data-lp]");
                        if (currentPageElement) {
                            const currentPageNum = await currentPageElement.getAttribute("data-lp");
                            console.log(`✅ Confirmed on page ${currentPageNum}`);
                            if (currentPageNum !== i.toString()) {
                                console.warn(`⚠️ Expected page ${i} but on page ${currentPageNum}`);
                            }
                        }
                    }
                    catch (pageCheckError) {
                        console.warn("⚠️ Could not verify current page:", pageCheckError);
                    }
                    // Extra delay to ensure page is fully stable after pagination
                    await page.waitForTimeout(2000);
                    console.log(`✅ Page ${i} is ready for scraping`);
                }
                // Scrape jobs on the current page
                console.log(`🚀 Starting to scrape jobs on page ${i}...`);
                const jobs = await scrapeJobs(page, i);
                console.log(`✅ Page ${i} complete: ${jobs.length} jobs scraped`);
                allJobs = allJobs.concat(jobs);
                // Log cumulative progress
                console.log(`📊 Total progress: ${allJobs.length} jobs from ${i}/${totalPages} pages`);
            }
            catch (error) {
                console.error(`❌ Error processing page ${i}:`, error);
                // Try to recover by navigating back to the job list
                try {
                    console.log(`🔄 Attempting to recover page state...`);
                    await page.goto("https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu", { waitUntil: "networkidle", timeout: 30000 });
                    await waitForJobListSync(page);
                    console.log(`✅ Recovered page state, continuing with next page`);
                }
                catch (recoveryError) {
                    console.error(`❌ Failed to recover from page ${i} error:`, recoveryError);
                }
                // Continue with next page instead of failing completely
                continue;
            }
        }
        console.log(`\n🎉 Pagination complete! Total jobs scraped: ${allJobs.length}`);
    }
    catch (error) {
        console.error("❌ Critical error in scrapeAllJobs:", error);
    }
    return allJobs;
}
// Main function to run the scraper
async function run() {
    let browser = null;
    try {
        // Load saved credentials
        const credentials = await loadCredentials();
        // Handle user authentication
        let username, password, useStoredAuth = false;
        if (credentials.accounts && credentials.accounts.length > 0) {
            console.log("Saved accounts:");
            credentials.accounts.forEach((account, index) => {
                console.log(`${index + 1}. ${account.username}`);
            });
            console.log(`${credentials.accounts.length + 1}. Use a new account`);
            const choice = await promptUser("Select an account (number) or press Enter for last used: ");
            if (choice === "") {
                // Use last used account
                const lastUsed = credentials.accounts.find((a) => a.isLastUsed) ||
                    credentials.accounts[0];
                username = lastUsed.username;
                password = lastUsed.password;
                useStoredAuth = true;
                console.log(`Using account: ${username}`);
            }
            else {
                const choiceNum = parseInt(choice);
                if (choiceNum > 0 && choiceNum <= credentials.accounts.length) {
                    username = credentials.accounts[choiceNum - 1].username;
                    password = credentials.accounts[choiceNum - 1].password;
                    useStoredAuth = true;
                    console.log(`Using account: ${username}`);
                }
                else {
                    // New account flow
                    username = await promptUser("Enter username: ");
                    password = await promptUser("Enter password: ");
                    const saveAccount = await promptUser("Save this account for future use? (y/n): ");
                    if (saveAccount.toLowerCase() === "y") {
                        // Update all accounts to not be last used
                        credentials.accounts.forEach((account) => (account.isLastUsed = false));
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
        }
        else {
            // No saved accounts
            username = await promptUser("Enter username: ");
            password = await promptUser("Enter password: ");
            const saveAccount = await promptUser("Save this account for future use? (y/n): ");
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
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
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
        }
        else {
            console.log("Already logged in");
        }
        // Save storage state for future runs
        await context.storageState({ path: CONFIG_DIR + "/storage.json" });
        // 📄 2. NAVIGATE TO JOB LIST
        console.log("Navigating to job list...");
        await page.goto("https://intranet.decopress.com/JobStatusList/JobStatusList.aspx?from=menu", {
            waitUntil: "networkidle",
            timeout: 30000,
        });
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
                .catch(() => { }),
        ]);
        // 🔧 CRITICAL FIX: Click "All" filter to show all jobs and enable pagination
        console.log("🔍 Looking for process filters to enable 'All' view...");
        try {
            // Look for common filter selectors that might contain an "All" option
            const filterSelectors = [
                '.filter-container .filter-option[data-filter="all"]',
                ".process-filter .filter-all",
                ".filters .all-filter",
                'button:has-text("All")',
                'a:has-text("All")',
                ".filter-buttons .all",
                '[data-filter-value="all"]',
                ".process-filters .all",
            ];
            let allFilterClicked = false;
            for (const selector of filterSelectors) {
                try {
                    const allFilter = await page.$(selector);
                    if (allFilter) {
                        console.log(`✅ Found "All" filter with selector: ${selector}`);
                        await allFilter.click();
                        console.log("🔄 Clicked 'All' filter, waiting for page to update...");
                        // Wait for the page to update after clicking the filter
                        await page.waitForLoadState("networkidle");
                        await page.waitForTimeout(2000); // Additional wait for any AJAX requests
                        allFilterClicked = true;
                        break;
                    }
                }
                catch (error) {
                    // Continue to next selector if this one doesn't work
                    continue;
                }
            }
            if (!allFilterClicked) {
                // Try a more generic approach - look for any element with "All" text that looks like a filter
                console.log("🔍 Trying generic approach to find 'All' filter...");
                try {
                    const allElements = await page.$$("*");
                    for (const element of allElements) {
                        const text = await element.textContent();
                        const tagName = await element.evaluate((el) => el.tagName);
                        if (text?.trim().toLowerCase() === "all" &&
                            (tagName === "BUTTON" ||
                                tagName === "A" ||
                                tagName === "SPAN" ||
                                tagName === "DIV")) {
                            // Check if it looks like a filter (has filter-related classes or parent)
                            const className = (await element.getAttribute("class")) || "";
                            const parentHTML = await element.evaluate((el) => el.parentElement?.outerHTML.substring(0, 200) || "");
                            if (className.includes("filter") ||
                                className.includes("btn") ||
                                parentHTML.includes("filter") ||
                                parentHTML.includes("process")) {
                                console.log(`✅ Found potential "All" filter: ${tagName} with class "${className}"`);
                                await element.click();
                                console.log("🔄 Clicked potential 'All' filter, waiting for page to update...");
                                await page.waitForLoadState("networkidle");
                                await page.waitForTimeout(2000);
                                allFilterClicked = true;
                                break;
                            }
                        }
                    }
                }
                catch (error) {
                    console.warn("⚠️ Error in generic 'All' filter search:", error);
                }
            }
            if (allFilterClicked) {
                console.log("✅ Successfully clicked 'All' filter - should now show all jobs with pagination");
                // Extended wait for the page to fully update after filter change
                console.log("⏳ Waiting for page to fully update after 'All' filter...");
                await page.waitForLoadState("networkidle");
                await page.waitForTimeout(3000); // Longer wait for AJAX updates
                // Re-verify the job count after clicking the filter
                const jobRowsAfterFilter = await page.$$("#jobStatusListResults tr.js-jobstatus-row");
                console.log(`📊 Job count after 'All' filter: ${jobRowsAfterFilter.length} jobs`);
                // Check if pagination is now available
                const paginationExists = await page.$(".pagination");
                if (paginationExists) {
                    const paginationItems = await page.$$(".pagination li.page-item");
                    console.log(`📄 Pagination now available with ${paginationItems.length} items`);
                    // Log the actual pagination structure for debugging
                    const paginationText = await page
                        .$eval(".pagination", (el) => el.textContent?.trim() || "")
                        .catch(() => "N/A");
                    console.log(`📄 Pagination content: "${paginationText}"`);
                }
                else {
                    console.log("📄 No pagination detected (may be single page with all jobs)");
                }
                // Additional verification: wait for more jobs to load
                console.log("⏳ Waiting for job table to stabilize...");
                await page
                    .waitForFunction(() => {
                    const rows = document.querySelectorAll("#jobStatusListResults tr.js-jobstatus-row");
                    return rows.length > 3; // Should have more than 3 jobs after clicking "All"
                }, { timeout: 10000 })
                    .catch(() => {
                    console.warn("⚠️ Timeout waiting for more jobs to load - proceeding with current job count");
                });
                // Final job count check
                const finalJobRows = await page.$$("#jobStatusListResults tr.js-jobstatus-row");
                console.log(`📊 Final job count after stabilization: ${finalJobRows.length} jobs`);
            }
            else {
                console.warn("⚠️ Could not find 'All' filter - proceeding with current view");
                console.warn("⚠️ This may result in limited job visibility and missing pagination");
            }
        }
        catch (error) {
            console.error("❌ Error while trying to click 'All' filter:", error);
            console.log("📋 Proceeding with current view...");
        }
        // Additional wait to ensure JavaScript has finished processing
        await page.waitForFunction(() => {
            const rows = document.querySelectorAll("#jobStatusListResults tr.js-jobstatus-row");
            return (rows.length > 0 &&
                Array.from(rows).every((row) => row.offsetHeight > 0));
        }, { timeout: 10000 });
        console.log("Job rows are visible and fully loaded");
        // Debug: Save screenshot and HTML
        await page.screenshot({ path: "debug_jobs_page.png" });
        const html = await page.content();
        fs.writeFileSync("debug_jobs_page.html", html);
        console.log("Saved debug_jobs_page.png and debug_jobs_page.html");
        // Instead of scraping just one page, scrape all pages
        const jobs = await scrapeAllJobs(page);
        console.log(`Scraped ${jobs.length} jobs (all pages)`);
        // Save to database
        const envOrgName = process.env.ORGANIZATION_NAME || "DecoPress";
        // Add space programmatically if needed: "DecoPress" -> "Deco Press"
        const orgName = envOrgName === "DecoPress" ? "Deco Press" : envOrgName;
        const result = await saveScrapedJobs(orgName, jobs);
        console.log("Database save results:");
        console.log(`Successfully saved: ${result.success.length} jobs`);
        if (result.errors.length > 0) {
            console.log(`Failed to save: ${result.errors.length} jobs`);
            // Save errors to a file for review
            fs.writeFileSync("scrape_errors.json", JSON.stringify(result.errors, null, 2));
        }
    }
    catch (error) {
        console.error("Error during scraping:", error);
    }
    finally {
        if (browser) {
            try {
                await browser.close();
            }
            catch (error) {
                console.error("Error closing browser:", error);
            }
        }
    }
}
run();
export async function scrapeOrders() {
    const browser = await chromium.launch({
        headless: true,
    });
    try {
        const page = await browser.newPage();
        await page.goto("https://app.decopress.com/orders");
        // Wait for the orders table to load
        await page.waitForSelector(".orders-table");
        // Get all job rows
        const jobRows = await page.$$(".orders-table tr[data-jobnumber]");
        const jobs = [];
        for (const row of jobRows) {
            const jobData = await extractJobData(row, page, 1);
            if (jobData) {
                jobs.push(jobData);
            }
        }
        return jobs;
    }
    catch (error) {
        console.error("Error scraping orders:", error);
        throw error;
    }
    finally {
        await browser.close();
    }
}

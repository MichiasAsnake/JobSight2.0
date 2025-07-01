import fs from "fs";
import path from "path";

const DATA_DIR = process.cwd() + "/data";
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Save orders data to JSON file
 * @param {Array} orders - Array of order objects
 * @param {Object} options - Additional options
 * @returns {Object} - Result with success status and file path
 */
export async function saveOrders(orders, options = {}) {
  try {
    const ordersData = {
      orders: orders,
      summary: {
        totalOrders: orders.length,
        lastUpdated: new Date().toISOString(),
        scrapedAt: options.scrapedAt || new Date().toISOString(),
        version: "1.0.0",
      },
    };

    fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersData, null, 2), "utf8");

    console.log(`💾 Saved ${orders.length} orders to ${ORDERS_FILE}`);

    return {
      success: true,
      filePath: ORDERS_FILE,
      ordersCount: orders.length,
      timestamp: ordersData.summary.lastUpdated,
    };
  } catch (error) {
    console.error("❌ Error saving orders:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Load orders data from JSON file
 * @returns {Object} - Orders data or null if error
 */
export async function loadOrders() {
  try {
    if (!fs.existsSync(ORDERS_FILE)) {
      console.log("📁 No orders file found, returning empty data");
      return {
        orders: [],
        summary: {
          totalOrders: 0,
          lastUpdated: null,
          scrapedAt: null,
          version: "1.0.0",
        },
      };
    }

    const data = fs.readFileSync(ORDERS_FILE, "utf8");
    const ordersData = JSON.parse(data);

    console.log(
      `📂 Loaded ${ordersData.orders.length} orders from ${ORDERS_FILE}`
    );

    return ordersData;
  } catch (error) {
    console.error("❌ Error loading orders:", error);
    return null;
  }
}

/**
 * Get orders summary statistics
 * @returns {Object} - Summary statistics
 */
export async function getOrdersSummary() {
  try {
    const ordersData = await loadOrders();
    if (!ordersData) {
      return {
        totalOrders: 0,
        lastUpdated: null,
        hasData: false,
      };
    }

    // Calculate additional statistics
    const statusBreakdown = {};
    const priorityBreakdown = {};
    const customerBreakdown = {};

    ordersData.orders.forEach((order) => {
      // Status breakdown
      const status = order.status || "Unknown";
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;

      // Priority breakdown
      const priority = order.priority || "normal";
      priorityBreakdown[priority] = (priorityBreakdown[priority] || 0) + 1;

      // Customer breakdown
      const customer = order.customer?.company || "Unknown";
      customerBreakdown[customer] = (customerBreakdown[customer] || 0) + 1;
    });

    return {
      totalOrders: ordersData.orders.length,
      lastUpdated: ordersData.summary.lastUpdated,
      scrapedAt: ordersData.summary.scrapedAt,
      hasData: ordersData.orders.length > 0,
      statusBreakdown,
      priorityBreakdown,
      topCustomers: Object.entries(customerBreakdown)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([customer, count]) => ({ customer, count })),
    };
  } catch (error) {
    console.error("❌ Error getting orders summary:", error);
    return {
      totalOrders: 0,
      lastUpdated: null,
      hasData: false,
      error: error.message,
    };
  }
}

/**
 * Validate order data structure
 * @param {Object} order - Order object to validate
 * @returns {Object} - Validation result
 */
export function validateOrder(order) {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!order.jobNumber) {
    errors.push("Missing jobNumber");
  }
  if (!order.orderNumber) {
    errors.push("Missing orderNumber");
  }
  if (!order.status) {
    errors.push("Missing status");
  }

  // Customer validation
  if (!order.customer) {
    errors.push("Missing customer object");
  } else {
    if (!order.customer.company) {
      warnings.push("Missing customer company name");
    }
  }

  // Date validation
  if (order.dateEntered) {
    try {
      new Date(order.dateEntered);
    } catch {
      warnings.push("Invalid dateEntered format");
    }
  }

  if (order.requestedShipDate) {
    try {
      new Date(order.requestedShipDate);
    } catch {
      warnings.push("Invalid requestedShipDate format");
    }
  }

  // Line items validation
  if (!order.lineItems || !Array.isArray(order.lineItems)) {
    warnings.push("Missing or invalid lineItems array");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all orders in the data
 * @returns {Object} - Validation results
 */
export async function validateAllOrders() {
  try {
    const ordersData = await loadOrders();
    if (!ordersData) {
      return {
        success: false,
        error: "Could not load orders data",
      };
    }

    const results = {
      totalOrders: ordersData.orders.length,
      validOrders: 0,
      invalidOrders: 0,
      totalErrors: 0,
      totalWarnings: 0,
      orderResults: [],
    };

    ordersData.orders.forEach((order, index) => {
      const validation = validateOrder(order);
      const result = {
        index,
        jobNumber: order.jobNumber,
        isValid: validation.isValid,
        errors: validation.errors,
        warnings: validation.warnings,
      };

      results.orderResults.push(result);

      if (validation.isValid) {
        results.validOrders++;
      } else {
        results.invalidOrders++;
      }

      results.totalErrors += validation.errors.length;
      results.totalWarnings += validation.warnings.length;
    });

    console.log(
      `📊 Validation complete: ${results.validOrders}/${results.totalOrders} orders valid`
    );
    console.log(
      `⚠️ ${results.totalWarnings} warnings, ❌ ${results.totalErrors} errors`
    );

    return {
      success: true,
      ...results,
    };
  } catch (error) {
    console.error("❌ Error validating orders:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

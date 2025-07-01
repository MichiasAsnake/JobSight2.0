import fs from "fs";
import path from "path";

export interface Order {
  jobNumber: string;
  orderNumber: string;
  status: string;
  priority: string;
  customer: {
    company: string;
    contactPerson: string;
    phone: string;
    email: string;
  };
  description: string;
  comment: string;
  dateEntered: string;
  requestedShipDate: string | null;
  approvedBy: string;
  approvedDate: string;
  pricing: {
    subtotal: number;
    salesTax: number;
    totalDue: number;
    currency: string;
  };
  shipments: Array<{
    shipmentNumber: number;
    status: string;
    shippingMethod: string;
    trackingNumber: string | null;
    shipToAddress: {
      company: string;
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    contactInfo: {
      name: string;
      phone: string;
      email: string;
    };
    specialInstructions: string;
  }>;
  lineItems: Array<{
    assetSKU: string;
    description: string;
    category: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    comment: string;
    status: string;
    hasImage: boolean;
    hasPDF: boolean;
  }>;
  workflow: {
    hasJobFiles: boolean;
    hasProof: boolean;
    hasPackingSlip: boolean;
    needsPanels: boolean;
    isRush: boolean;
  };
  production: {
    daysInProduction: number;
    estimatedCompletionDate: string | null;
    productionNotes: string[];
  };
  metadata: {
    lastUpdated: string;
    department: string;
    tags: string[];
    complexity: string;
  };
}

export interface OrdersData {
  orders: Order[];
  summary: {
    totalOrders: number;
    lastUpdated: string;
    scrapedAt: string;
  };
}

class OMSDataService {
  private ordersData: OrdersData | null = null;
  private dataPath: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private fileStats: fs.Stats | null = null;

  constructor() {
    this.dataPath = path.join(process.cwd(), "data", "orders.json");
  }

  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    try {
      const currentStats = fs.statSync(this.dataPath);
      if (!this.fileStats || currentStats.mtime > this.fileStats.mtime) {
        this.fileStats = currentStats;
        this.cache.clear(); // Clear all cache if file changed
        return false;
      }
    } catch {
      return false;
    }

    return Date.now() < cached.expiry;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_DURATION,
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getCache(key: string): any | null {
    if (this.isCacheValid(key)) {
      return this.cache.get(key)!.data;
    }
    return null;
  }

  async loadOrders(): Promise<OrdersData> {
    const cacheKey = "orders_data";
    const cached = this.getCache(cacheKey);

    if (cached) {
      this.ordersData = cached;
      return cached;
    }

    try {
      const data = fs.readFileSync(this.dataPath, "utf8");
      this.ordersData = JSON.parse(data);

      this.fileStats = fs.statSync(this.dataPath);

      this.setCache(cacheKey, this.ordersData);

      return this.ordersData!;
    } catch (loadError) {
      console.error("Error loading orders data:", loadError);
      throw new Error("Failed to load orders data");
    }
  }

  async getOrders(): Promise<Order[]> {
    const data = await this.loadOrders();
    return data.orders;
  }

  async getOrderByJobNumber(jobNumber: string): Promise<Order | null> {
    const orders = await this.getOrders();
    return orders.find((order) => order.jobNumber === jobNumber) || null;
  }

  async searchOrdersByQuery(query: string): Promise<Order[]> {
    const cacheKey = `search_${query.toLowerCase()}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const orders = await this.getOrders();
    const searchTerm = query.toLowerCase();

    const results = orders.filter(
      (order) =>
        order.jobNumber.toLowerCase().includes(searchTerm) ||
        order.orderNumber.toLowerCase().includes(searchTerm) ||
        order.customer.company.toLowerCase().includes(searchTerm) ||
        order.customer.contactPerson.toLowerCase().includes(searchTerm) ||
        order.description.toLowerCase().includes(searchTerm) ||
        order.status.toLowerCase().includes(searchTerm)
    );

    this.setCache(cacheKey, results);
    return results;
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders.filter(
      (order) => order.status.toLowerCase() === status.toLowerCase()
    );
  }

  async getOrdersByCustomer(customerName: string): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders.filter((order) =>
      order.customer.company.toLowerCase().includes(customerName.toLowerCase())
    );
  }

  async getOrdersByPriority(priority: string): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders.filter(
      (order) => order.priority.toLowerCase() === priority.toLowerCase()
    );
  }

  async getOrdersByDateRange(
    startDate: string,
    endDate: string
  ): Promise<Order[]> {
    const orders = await this.getOrders();
    const start = new Date(startDate);
    const end = new Date(endDate);

    return orders.filter((order) => {
      if (!order.dateEntered) return false;
      try {
        const orderDate = new Date(order.dateEntered);
        if (isNaN(orderDate.getTime())) {
          console.warn(
            `Invalid dateEntered for order ${order.jobNumber}:`,
            order.dateEntered
          );
          return false;
        }
        return orderDate >= start && orderDate <= end;
      } catch (parseError) {
        console.warn(
          `Error parsing dateEntered for order ${order.jobNumber}:`,
          parseError
        );
        return false;
      }
    });
  }

  async getOrdersByMonth(year: number, month: number): Promise<Order[]> {
    const cacheKey = `month_${year}_${month}`;
    const cached = this.getCache(cacheKey);

    if (cached) {
      return cached;
    }

    const orders = await this.getOrders();
    const results = orders.filter((order) => {
      if (!order.dateEntered) return false;
      try {
        const orderDate = new Date(order.dateEntered);
        if (isNaN(orderDate.getTime())) {
          console.warn(
            `Invalid dateEntered for order ${order.jobNumber}:`,
            order.dateEntered
          );
          return false;
        }
        return (
          orderDate.getFullYear() === year && orderDate.getMonth() === month
        );
      } catch (parseError) {
        console.warn(
          `Error parsing dateEntered for order ${order.jobNumber}:`,
          parseError
        );
        return false;
      }
    });

    this.setCache(cacheKey, results);
    return results;
  }

  async getSummaryStats() {
    const orders = await this.getOrders();

    const statusBreakdown = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priorityBreakdown = orders.reduce((acc, order) => {
      acc[order.priority] = (acc[order.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const customerBreakdown = orders.reduce((acc, order) => {
      acc[order.customer.company] = (acc[order.customer.company] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCustomers = Object.entries(customerBreakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([customer, count]) => ({ customer, count }));

    const totalValue = orders.reduce(
      (sum, order) => sum + order.pricing.totalDue,
      0
    );
    const averageOrderValue = totalValue / orders.length;

    return {
      totalOrders: orders.length,
      statusBreakdown,
      priorityBreakdown,
      topCustomers,
      totalValue,
      averageOrderValue,
      lastUpdated:
        this.ordersData?.summary.lastUpdated || new Date().toISOString(),
    };
  }

  async getRecentOrders(limit: number = 10): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders
      .filter((order) => {
        if (!order.dateEntered) return false;
        try {
          const date = new Date(order.dateEntered);
          return !isNaN(date.getTime());
        } catch {
          console.warn(
            `Invalid dateEntered for order ${order.jobNumber}:`,
            order.dateEntered
          );
          return false;
        }
      })
      .sort((a, b) => {
        try {
          const dateA = new Date(a.dateEntered).getTime();
          const dateB = new Date(b.dateEntered).getTime();
          return dateB - dateA;
        } catch (sortError) {
          console.warn("Error sorting orders by date:", sortError);
          return 0;
        }
      })
      .slice(0, limit);
  }

  async getRushOrders(): Promise<Order[]> {
    const orders = await this.getOrders();
    return orders.filter(
      (order) =>
        order.priority === "MUST" ||
        order.workflow.isRush ||
        order.status.toLowerCase().includes("rush")
    );
  }

  async getLateOrders(): Promise<Order[]> {
    const orders = await this.getOrders();
    const today = new Date();

    return orders.filter((order) => {
      if (!order.requestedShipDate) return false;
      try {
        const shipDate = new Date(order.requestedShipDate);
        if (isNaN(shipDate.getTime())) {
          console.warn(
            `Invalid requestedShipDate for order ${order.jobNumber}:`,
            order.requestedShipDate
          );
          return false;
        }
        return shipDate < today && order.status !== "Closed";
      } catch (parseError) {
        console.warn(
          `Error parsing requestedShipDate for order ${order.jobNumber}:`,
          parseError
        );
        return false;
      }
    });
  }

  clearCache(): void {
    this.cache.clear();
    this.ordersData = null;
    this.fileStats = null;
  }
}

export const omsDataService = new OMSDataService();

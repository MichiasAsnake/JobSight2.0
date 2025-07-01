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

  constructor() {
    this.dataPath = path.join(process.cwd(), "data", "orders.json");
  }

  async loadOrders(): Promise<OrdersData> {
    if (this.ordersData) {
      return this.ordersData;
    }

    try {
      const data = fs.readFileSync(this.dataPath, "utf8");
      this.ordersData = JSON.parse(data);
      return this.ordersData!;
    } catch (error) {
      console.error("Error loading orders data:", error);
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

  async searchOrders(query: string): Promise<Order[]> {
    const orders = await this.getOrders();
    const searchTerm = query.toLowerCase();

    return orders.filter(
      (order) =>
        order.jobNumber.toLowerCase().includes(searchTerm) ||
        order.orderNumber.toLowerCase().includes(searchTerm) ||
        order.customer.company.toLowerCase().includes(searchTerm) ||
        order.customer.contactPerson.toLowerCase().includes(searchTerm) ||
        order.description.toLowerCase().includes(searchTerm) ||
        order.status.toLowerCase().includes(searchTerm)
    );
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
      const orderDate = new Date(order.dateEntered);
      return orderDate >= start && orderDate <= end;
    });
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
      .sort(
        (a, b) =>
          new Date(b.dateEntered).getTime() - new Date(a.dateEntered).getTime()
      )
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
      const shipDate = new Date(order.requestedShipDate);
      return shipDate < today && order.status !== "Closed";
    });
  }
}

export const omsDataService = new OMSDataService();

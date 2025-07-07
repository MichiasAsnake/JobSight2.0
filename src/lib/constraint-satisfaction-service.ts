import { ModernOrder } from "./api-first-data-service";

export interface Constraint {
  type: "value" | "date" | "status" | "customer" | "quantity";
  operator:
    | "equals"
    | "greater_than"
    | "less_than"
    | "greater_equal"
    | "less_equal"
    | "between"
    | "in"
    | "not_in";
  field: string;
  value: any;
  secondaryValue?: any; // For 'between' operations
}

export interface AggregationRequest {
  type: "sum" | "count" | "average" | "min" | "max";
  field: string;
  filter?: Constraint[];
}

export interface ConstraintSatisfactionResult {
  success: boolean;
  totalValue?: number;
  orderCount: number;
  orders: ModernOrder[];
  constraintMet: boolean;
  constraintDetails: {
    requestedValue?: number;
    actualValue?: number;
    difference?: number;
    percentage?: number;
  };
  summary: string;
}

export class ConstraintSatisfactionService {
  /**
   * Calculate the total value of orders based on pricing data or line items
   */
  private calculateOrderValue(order: ModernOrder): number {
    // First, try to use the pricing data if available
    if (order.pricing && order.pricing.total !== undefined) {
      return order.pricing.total;
    }

    // Fall back to line items calculation if pricing is not available
    if (!order.lineItems || order.lineItems.length === 0) {
      return 0;
    }

    return order.lineItems.reduce((total, item) => {
      const quantity = item.quantity || 0;
      const unitPrice = item.unitPrice || 0;
      return total + quantity * unitPrice;
    }, 0);
  }

  /**
   * Check if an order meets a given constraint
   */
  private orderMeetsConstraint(
    order: ModernOrder,
    constraint: Constraint
  ): boolean {
    switch (constraint.type) {
      case "value":
        const orderValue = this.calculateOrderValue(order);
        return this.evaluateConstraint(orderValue, constraint);

      case "date":
        const orderDate = new Date(order.dates.dateDue);
        return this.evaluateConstraint(orderDate, constraint);

      case "status":
        return this.evaluateConstraint(order.status.master, constraint);

      case "customer":
        return this.evaluateConstraint(order.customer.company, constraint);

      case "quantity":
        return this.evaluateConstraint(order.jobQuantity || 0, constraint);

      default:
        return false;
    }
  }

  /**
   * Evaluate a constraint using the specified operator
   */
  private evaluateConstraint(value: any, constraint: Constraint): boolean {
    switch (constraint.operator) {
      case "equals":
        return value === constraint.value;

      case "greater_than":
        return value > constraint.value;

      case "less_than":
        return value < constraint.value;

      case "greater_equal":
        return value >= constraint.value;

      case "less_equal":
        return value <= constraint.value;

      case "between":
        return (
          value >= constraint.value &&
          value <= (constraint.secondaryValue || constraint.value)
        );

      case "in":
        return Array.isArray(constraint.value)
          ? constraint.value.includes(value)
          : value === constraint.value;

      case "not_in":
        return Array.isArray(constraint.value)
          ? !constraint.value.includes(value)
          : value !== constraint.value;

      default:
        return false;
    }
  }

  /**
   * Filter orders based on multiple constraints
   */
  private filterOrdersByConstraints(
    orders: ModernOrder[],
    constraints: Constraint[]
  ): ModernOrder[] {
    return orders.filter((order) =>
      constraints.every((constraint) =>
        this.orderMeetsConstraint(order, constraint)
      )
    );
  }

  /**
   * Perform aggregation on filtered orders
   */
  private performAggregation(
    orders: ModernOrder[],
    aggregation: AggregationRequest
  ): number {
    const filteredOrders = aggregation.filter
      ? this.filterOrdersByConstraints(orders, aggregation.filter)
      : orders;

    switch (aggregation.type) {
      case "sum":
        return filteredOrders.reduce((total, order) => {
          if (aggregation.field === "value") {
            return total + this.calculateOrderValue(order);
          }
          return (
            total +
            ((order[aggregation.field as keyof ModernOrder] as number) || 0)
          );
        }, 0);

      case "count":
        return filteredOrders.length;

      case "average":
        const sum = this.performAggregation(filteredOrders, {
          ...aggregation,
          type: "sum",
        });
        return filteredOrders.length > 0 ? sum / filteredOrders.length : 0;

      case "min":
        return Math.min(
          ...filteredOrders.map((order) =>
            aggregation.field === "value"
              ? this.calculateOrderValue(order)
              : (order[aggregation.field as keyof ModernOrder] as number) || 0
          )
        );

      case "max":
        return Math.max(
          ...filteredOrders.map((order) =>
            aggregation.field === "value"
              ? this.calculateOrderValue(order)
              : (order[aggregation.field as keyof ModernOrder] as number) || 0
          )
        );

      default:
        return 0;
    }
  }

  /**
   * Find combinations of orders that add up to a target value
   */
  private findOrderCombinations(
    orders: ModernOrder[],
    targetValue: number,
    maxCombinations: number = 5
  ): ModernOrder[][] {
    const validOrders = orders.filter((order) => {
      const value = this.calculateOrderValue(order);
      return value > 0 && value <= targetValue;
    });

    if (validOrders.length === 0) {
      return [];
    }

    const combinations: ModernOrder[][] = [];

    // Try single orders first
    for (const order of validOrders) {
      const value = this.calculateOrderValue(order);
      if (Math.abs(value - targetValue) <= targetValue * 0.1) {
        // Within 10% of target
        combinations.push([order]);
        if (combinations.length >= maxCombinations) break;
      }
    }

    // Try pairs of orders
    if (combinations.length < maxCombinations) {
      for (let i = 0; i < validOrders.length; i++) {
        for (let j = i + 1; j < validOrders.length; j++) {
          const value1 = this.calculateOrderValue(validOrders[i]);
          const value2 = this.calculateOrderValue(validOrders[j]);
          const total = value1 + value2;

          if (Math.abs(total - targetValue) <= targetValue * 0.1) {
            // Within 10% of target
            combinations.push([validOrders[i], validOrders[j]]);
            if (combinations.length >= maxCombinations) break;
          }
        }
        if (combinations.length >= maxCombinations) break;
      }
    }

    // Try triplets if still need more combinations
    if (combinations.length < maxCombinations) {
      for (let i = 0; i < validOrders.length; i++) {
        for (let j = i + 1; j < validOrders.length; j++) {
          for (let k = j + 1; k < validOrders.length; k++) {
            const value1 = this.calculateOrderValue(validOrders[i]);
            const value2 = this.calculateOrderValue(validOrders[j]);
            const value3 = this.calculateOrderValue(validOrders[k]);
            const total = value1 + value2 + value3;

            if (Math.abs(total - targetValue) <= targetValue * 0.1) {
              // Within 10% of target
              combinations.push([
                validOrders[i],
                validOrders[j],
                validOrders[k],
              ]);
              if (combinations.length >= maxCombinations) break;
            }
          }
          if (combinations.length >= maxCombinations) break;
        }
        if (combinations.length >= maxCombinations) break;
      }
    }

    // Sort combinations by how close they are to the target value
    combinations.sort((a, b) => {
      const totalA = a.reduce(
        (sum, order) => sum + this.calculateOrderValue(order),
        0
      );
      const totalB = b.reduce(
        (sum, order) => sum + this.calculateOrderValue(order),
        0
      );
      const diffA = Math.abs(totalA - targetValue);
      const diffB = Math.abs(totalB - targetValue);
      return diffA - diffB;
    });

    return combinations.slice(0, maxCombinations);
  }

  /**
   * Main method to handle constraint satisfaction queries
   */
  public async processConstraintQuery(
    orders: ModernOrder[],
    constraints: Constraint[],
    targetValue?: number,
    aggregation?: AggregationRequest
  ): Promise<ConstraintSatisfactionResult> {
    // Filter orders by constraints
    const filteredOrders = this.filterOrdersByConstraints(orders, constraints);

    // If we have a target value, find combinations that add up to it
    if (targetValue !== undefined) {
      const combinations = this.findOrderCombinations(
        filteredOrders,
        targetValue
      );

      if (combinations.length > 0) {
        // Use the best combination (closest to target)
        const bestCombination = combinations[0];
        const combinationTotal = bestCombination.reduce(
          (sum, order) => sum + this.calculateOrderValue(order),
          0
        );

        const constraintMet = combinationTotal >= targetValue * 0.9; // Within 10% of target
        const constraintDetails = {
          requestedValue: targetValue,
          actualValue: combinationTotal,
          difference: combinationTotal - targetValue,
          percentage: (combinationTotal / targetValue) * 100,
          combinationsFound: combinations.length,
        };

        const summary = this.generateCombinationSummary(
          bestCombination,
          combinationTotal,
          targetValue,
          constraintMet,
          constraints,
          combinations.length
        );

        return {
          success: true,
          totalValue: combinationTotal,
          orderCount: bestCombination.length,
          orders: bestCombination,
          constraintMet,
          constraintDetails,
          summary,
        };
      } else {
        // No combinations found, fall back to total of all filtered orders
        const totalValue = this.performAggregation(filteredOrders, {
          type: "sum",
          field: "value",
        });

        const constraintMet = false;
        const constraintDetails = {
          requestedValue: targetValue,
          actualValue: totalValue,
          difference: totalValue - targetValue,
          percentage: totalValue ? (totalValue / targetValue) * 100 : 0,
          combinationsFound: 0,
        };

        const summary = this.generateSummary(
          filteredOrders,
          totalValue,
          targetValue,
          constraintMet,
          constraints
        );

        return {
          success: true,
          totalValue,
          orderCount: filteredOrders.length,
          orders: filteredOrders,
          constraintMet,
          constraintDetails,
          summary,
        };
      }
    }

    // No target value, use original logic
    let totalValue: number | undefined;
    if (aggregation?.field === "value") {
      totalValue = this.performAggregation(filteredOrders, {
        type: "sum",
        field: "value",
      });
    }

    const constraintMet = true;
    const constraintDetails = {};

    const summary = this.generateSummary(
      filteredOrders,
      totalValue,
      targetValue,
      constraintMet,
      constraints
    );

    return {
      success: true,
      totalValue,
      orderCount: filteredOrders.length,
      orders: filteredOrders,
      constraintMet,
      constraintDetails,
      summary,
    };
  }

  /**
   * Generate a human-readable summary for combination results
   */
  private generateCombinationSummary(
    orders: ModernOrder[],
    totalValue: number,
    targetValue: number,
    constraintMet: boolean,
    constraints?: Constraint[],
    combinationsFound?: number
  ): string {
    let summary = `Found ${orders.length} order${
      orders.length !== 1 ? "s" : ""
    } that add up to $${totalValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // Add constraint context
    if (constraints && constraints.length > 0) {
      const dateConstraint = constraints.find((c) => c.type === "date");
      if (dateConstraint) {
        summary += ` due ${this.formatDateConstraint(dateConstraint)}`;
      }
    }

    // Add target comparison
    if (targetValue !== undefined) {
      if (constraintMet) {
        summary += `, which meets your requirement of $${targetValue.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}`;
      } else {
        const shortfall = targetValue - totalValue;
        summary += `. This is $${shortfall.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} short of your $${targetValue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} requirement`;
      }
    }

    // Add combination info
    if (combinationsFound && combinationsFound > 1) {
      summary += `. Found ${combinationsFound} different combinations, showing the best match`;
    }

    summary += ".";
    return summary;
  }

  /**
   * Generate a human-readable summary of the results
   */
  private generateSummary(
    orders: ModernOrder[],
    totalValue?: number,
    targetValue?: number,
    constraintMet?: boolean,
    constraints?: Constraint[]
  ): string {
    let summary = `Found ${orders.length} order${
      orders.length !== 1 ? "s" : ""
    }`;

    // Add constraint context
    if (constraints && constraints.length > 0) {
      const dateConstraint = constraints.find((c) => c.type === "date");
      if (dateConstraint) {
        summary += ` due ${this.formatDateConstraint(dateConstraint)}`;
      }
    }

    // Add value information
    if (totalValue !== undefined) {
      summary += ` with a total value of $${totalValue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

      if (targetValue !== undefined) {
        if (constraintMet) {
          summary += `, which meets your requirement of $${targetValue.toLocaleString(
            "en-US",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }
          )}`;
        } else {
          const shortfall = targetValue - totalValue;
          summary += `. This is $${shortfall.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} short of your $${targetValue.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} requirement`;
        }
      }
    }

    summary += ".";
    return summary;
  }

  /**
   * Format date constraints for human-readable output
   */
  private formatDateConstraint(constraint: Constraint): string {
    if (constraint.operator === "between") {
      const startDate = new Date(constraint.value).toLocaleDateString();
      const endDate = new Date(
        constraint.secondaryValue || constraint.value
      ).toLocaleDateString();
      return `between ${startDate} and ${endDate}`;
    }

    const date = new Date(constraint.value).toLocaleDateString();
    switch (constraint.operator) {
      case "greater_than":
        return `after ${date}`;
      case "less_than":
        return `before ${date}`;
      case "greater_equal":
        return `on or after ${date}`;
      case "less_equal":
        return `on or before ${date}`;
      default:
        return `on ${date}`;
    }
  }

  /**
   * Parse natural language constraints into structured format
   */
  public parseConstraints(query: string): {
    constraints: Constraint[];
    targetValue?: number;
  } {
    const constraints: Constraint[] = [];
    let targetValue: number | undefined;

    // Extract date constraints
    const dateMatches = query.match(
      /(?:due|by|on)\s+(next\s+week|this\s+week|next\s+month|today|tomorrow|(\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}))/i
    );
    if (dateMatches) {
      const dateRange = this.parseDateRange(dateMatches[1]);
      if (dateRange) {
        constraints.push({
          type: "date",
          operator: "between",
          field: "dueDate",
          value: dateRange.start,
          secondaryValue: dateRange.end,
        });
      }
    }

    // Extract value constraints
    const valueMatches = query.match(
      /(?:add\s+up\s+to|total|value\s+of)\s+(\$?[\d,]+(?:\.\d{2})?)\s*(?:k|thousand)?/i
    );
    if (valueMatches) {
      let value = parseFloat(valueMatches[1].replace(/[$,]/g, ""));
      if (
        query.toLowerCase().includes("k") ||
        query.toLowerCase().includes("thousand")
      ) {
        value *= 1000;
      }
      targetValue = value;
    }

    // Extract status constraints
    if (query.toLowerCase().includes("approved")) {
      constraints.push({
        type: "status",
        operator: "equals",
        field: "status",
        value: "Approved",
      });
    }

    return { constraints, targetValue };
  }

  /**
   * Parse date ranges from natural language
   */
  private parseDateRange(dateText: string): { start: Date; end: Date } | null {
    const now = new Date();

    switch (dateText.toLowerCase()) {
      case "next week":
        const nextWeekStart = new Date(now);
        nextWeekStart.setDate(now.getDate() + ((7 - now.getDay() + 1) % 7));
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
        return { start: nextWeekStart, end: nextWeekEnd };

      case "this week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return { start: weekStart, end: weekEnd };

      default:
        // Try to parse specific dates
        const date = new Date(dateText);
        if (!isNaN(date.getTime())) {
          return { start: date, end: date };
        }
        return null;
    }
  }
}

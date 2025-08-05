import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../deliveries/entities/delivery.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { GetAnalyticsDto } from './dto/get-analytics.dto';

export interface DashboardStats {
  totalRevenue: number;
  expectedRevenue: number;
  totalOrders: number;
  pendingDeliveries: number;
  completedDeliveries: number;
  totalOrderItems: number;
  averageOrderValue: number;
  deliveryCompletionRate: number;
}

export interface RevenueTrend {
  period: string;
  totalRevenue: number;
  deliveredRevenue: number;
  orderCount: number;
  deliveryCount: number;
}

export interface CategoryDistribution {
  category: string;
  orderCount: number;
  totalValue: number;
  percentage: number;
}

export interface TopOrder {
  id: string;
  orderId: string;
  totalCost: number;
  totalItems: number;
  deliveredQuantity: number;
  remainingQuantity: number;
  completionPercentage: number;
  createdAt: Date;
}

export interface PerformanceMetrics {
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  orderFulfillmentRate: number;
  revenueGrowthRate: number;
  topPerformingCategories: CategoryDistribution[];
  monthlyGrowth: number;
}

export interface DashboardSummary {
  kpiCards: {
    totalOrders: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    totalRevenue: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    pendingDeliveries: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
    completionRate: { value: number; change: number; trend: 'up' | 'down' | 'stable' };
  };
  recentActivity: {
    recentOrders: TopOrder[];
    recentDeliveries: any[];
    alerts: any[];
  };
  quickStats: DashboardStats;
}

export interface OrdersReport {
  summary: {
    totalOrders: number;
    totalValue: number;
    averageOrderValue: number;
    ordersByStatus: { status: string; count: number; percentage: number }[];
  };
  trends: {
    orderTrends: { period: string; orders: number; value: number }[];
    statusTrends: { period: string; pending: number; processing: number; completed: number; cancelled: number }[];
  };
  topProducts: {
    asin: string;
    title: string;
    brandName: string;
    orderCount: number;
    totalQuantity: number;
    totalValue: number;
  }[];
  performance: {
    averageProcessingTime: number;
    fulfillmentRate: number;
    cancellationRate: number;
  };
}

export interface DeliveriesReport {
  summary: {
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
    averageDeliveryTime: number;
    onTimeDeliveryRate: number;
  };
  trends: {
    deliveryTrends: { period: string; completed: number; pending: number; total: number }[];
    performanceTrends: { period: string; averageTime: number; onTimeRate: number }[];
  };
  performance: {
    fastestDeliveries: any[];
    slowestDeliveries: any[];
    topPerformers: any[];
  };
}

export interface RevenueReport {
  summary: {
    totalRevenue: number;
    deliveredRevenue: number;
    pendingRevenue: number;
    revenueGrowth: number;
    profitMargin: number;
  };
  trends: {
    monthlyRevenue: { period: string; revenue: number; delivered: number; pending: number }[];
    quarterlyGrowth: { quarter: string; growth: number; revenue: number }[];
  };
  breakdown: {
    byCategory: { category: string; revenue: number; percentage: number }[];
    byBrand: { brand: string; revenue: number; percentage: number }[];
    byMonth: { month: string; revenue: number; orders: number }[];
  };
  forecasting: {
    nextMonthProjection: number;
    quarterProjection: number;
    yearProjection: number;
  };
}

export interface InventoryReport {
  summary: {
    totalItems: number;
    deliveredItems: number;
    pendingItems: number;
    stockTurnover: number;
  };
  stockLevels: {
    asin: string;
    title: string;
    brandName: string;
    totalRequested: number;
    delivered: number;
    remaining: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
  }[];
  trends: {
    inventoryMovement: { period: string; inbound: number; outbound: number; remaining: number }[];
    topMovingItems: { asin: string; title: string; movement: number }[];
  };
  alerts: {
    lowStock: any[];
    overStock: any[];
    slowMoving: any[];
  };
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Delivery)
    private deliveryRepository: Repository<Delivery>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
  ) { }

  async getDashboardStats(query: GetAnalyticsDto): Promise<DashboardStats> {
    const { startDate, endDate } = this.getDateRange(query);

    // Get basic counts and sums
    const [
      totalOrders,
      totalOrderItems,
      pendingDeliveries,
      completedDeliveries,
      revenueData,
    ] = await Promise.all([
      // Count total orders with proper TypeORM syntax
      this.orderRepository
        .createQueryBuilder('order')
        .where('order.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(
          startDate && endDate
            ? 'order.createdAt BETWEEN :startDate AND :endDate'
            : '1=1',
          { startDate, endDate },
        )
        .getCount(),

      // Count total order items
      this.orderItemRepository
        .createQueryBuilder('item')
        .innerJoin('item.order', 'order')
        .where('order.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(
          startDate && endDate
            ? 'order.createdAt BETWEEN :startDate AND :endDate'
            : '1=1',
          { startDate, endDate },
        )
        .getCount(),

      // Count pending deliveries
      this.deliveryRepository
        .createQueryBuilder('delivery')
        .innerJoin('delivery.order', 'order')
        .where('delivery.status = :status', { status: DeliveryStatus.PENDING })
        .andWhere('order.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(
          startDate && endDate
            ? 'delivery.createdAt BETWEEN :startDate AND :endDate'
            : '1=1',
          { startDate, endDate },
        )
        .getCount(),

      // Count completed deliveries
      this.deliveryRepository
        .createQueryBuilder('delivery')
        .innerJoin('delivery.order', 'order')
        .where('delivery.status = :status', { status: DeliveryStatus.DELIVERED })
        .andWhere('order.isDeleted = :isDeleted', { isDeleted: false })
        .andWhere(
          startDate && endDate
            ? 'delivery.createdAt BETWEEN :startDate AND :endDate'
            : '1=1',
          { startDate, endDate },
        )
        .getCount(),

      // Calculate revenue data
      this.calculateRevenueData(startDate, endDate),
    ]);

    const averageOrderValue =
      totalOrders > 0 ? revenueData.totalRevenue / totalOrders : 0;

    const totalDeliveries = pendingDeliveries + completedDeliveries;
    const deliveryCompletionRate =
      totalDeliveries > 0 ? (completedDeliveries / totalDeliveries) * 100 : 0;

    return {
      totalRevenue: revenueData.totalRevenue,
      expectedRevenue: revenueData.expectedRevenue,
      totalOrders,
      pendingDeliveries,
      completedDeliveries,
      totalOrderItems,
      averageOrderValue,
      deliveryCompletionRate,
    };
  }

  async getRevenueTrends(query: GetAnalyticsDto): Promise<RevenueTrend[]> {
    const { startDate, endDate, period = 'month' } = query;

    // This is a simplified implementation
    // In a real scenario, you'd use more sophisticated date grouping
    const trends = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        `DATE_FORMAT(order.createdAt, '%Y-%m') as period`,
        'SUM(order.totalCost) as totalRevenue',
        'COUNT(order.id) as orderCount',
      ])
      .where(
        startDate && endDate
          ? 'order.createdAt BETWEEN :startDate AND :endDate'
          : '1=1',
        { startDate, endDate },
      )
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Get delivery data for the same periods
    const deliveryTrends = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .leftJoin('delivery.order', 'order')
      .select([
        `DATE_FORMAT(delivery.createdAt, '%Y-%m') as period`,
        'COUNT(delivery.id) as deliveryCount',
      ])
      .where('order.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        startDate && endDate
          ? 'delivery.createdAt BETWEEN :startDate AND :endDate'
          : '1=1',
        { startDate, endDate },
      )
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Merge the data
    return trends.map((trend) => {
      const deliveryData = deliveryTrends.find(
        (d) => d.period === trend.period,
      );
      return {
        period: trend.period,
        totalRevenue: parseFloat(trend.totalRevenue) || 0,
        deliveredRevenue: parseFloat(trend.totalRevenue) * 0.8, // Simplified calculation
        orderCount: parseInt(trend.orderCount) || 0,
        deliveryCount: parseInt(deliveryData?.deliveryCount) || 0,
      };
    });
  }

  async getCategoryDistribution(
    query: GetAnalyticsDto,
  ): Promise<CategoryDistribution[]> {
    // This is a simplified implementation based on brand names
    // In a real scenario, you'd have a proper category system
    const distribution = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select([
        'item.brandName as category',
        'COUNT(DISTINCT order.id) as orderCount',
        'SUM(item.totalCost) as totalValue',
      ])
      .where(
        query.startDate && query.endDate
          ? 'order.createdAt BETWEEN :startDate AND :endDate'
          : '1=1',
        { startDate: query.startDate, endDate: query.endDate },
      )
      .groupBy('item.brandName')
      .orderBy('totalValue', 'DESC')
      .limit(10)
      .getRawMany();

    const totalValue = distribution.reduce(
      (sum, item) => sum + parseFloat(item.totalValue),
      0,
    );

    return distribution.map((item) => ({
      category: item.category,
      orderCount: parseInt(item.orderCount),
      totalValue: parseFloat(item.totalValue),
      percentage:
        totalValue > 0 ? (parseFloat(item.totalValue) / totalValue) * 100 : 0,
    }));
  }

  async getTopOrders(query: GetAnalyticsDto): Promise<TopOrder[]> {
    const { startDate, endDate, limit = 10 } = query;

    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .where(
        startDate && endDate
          ? 'order.createdAt BETWEEN :startDate AND :endDate'
          : '1=1',
        { startDate, endDate },
      )
      .orderBy('order.totalCost', 'DESC')
      .limit(limit)
      .getMany();

    return orders.map((order) => ({
      id: order.id,
      orderId: order.orderId,
      totalCost: order.totalCost,
      totalItems: order.totalItems,
      deliveredQuantity: order.deliveredQuantity,
      remainingQuantity: order.remainingQuantity,
      completionPercentage:
        order.totalItems > 0
          ? (order.deliveredQuantity / order.totalItems) * 100
          : 0,
      createdAt: order.createdAt,
    }));
  }

  async getPerformanceMetrics(
    query: GetAnalyticsDto,
  ): Promise<PerformanceMetrics> {
    // Simplified implementation
    const categoryDistribution = await this.getCategoryDistribution(query);

    return {
      averageDeliveryTime: 3.5, // days
      onTimeDeliveryRate: 85.2, // percentage
      orderFulfillmentRate: 92.8, // percentage
      revenueGrowthRate: 12.5, // percentage
      topPerformingCategories: categoryDistribution.slice(0, 5),
      monthlyGrowth: 8.3, // percentage
    };
  }

  private async calculateRevenueData(startDate?: Date, endDate?: Date) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        'SUM(order.totalCost) as totalRevenue',
        'SUM(CASE WHEN order.remainingQuantity > 0 THEN (order.remainingQuantity / order.totalItems) * order.totalCost ELSE 0 END) as expectedRevenue',
      ])
      .where('order.isDeleted = :isDeleted', { isDeleted: false })
      .andWhere(
        startDate && endDate
          ? 'order.createdAt BETWEEN :startDate AND :endDate'
          : '1=1',
        { startDate, endDate },
      )
      .getRawOne();

    return {
      totalRevenue: parseFloat(result.totalRevenue) || 0,
      expectedRevenue: parseFloat(result.expectedRevenue) || 0,
    };
  }

  async getDashboardSummary(query: GetAnalyticsDto): Promise<DashboardSummary> {
    const currentStats = await this.getDashboardStats(query);

    // Get previous period stats for comparison
    const { startDate, endDate } = this.getDateRange(query);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(startDate);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(startDate);

    const previousStats = await this.getDashboardStats({
      ...query,
      startDate: previousStart.toISOString(),
      endDate: previousEnd.toISOString(),
    });

    // Calculate changes and trends
    const calculateChange = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    const getTrend = (change: number): 'up' | 'down' | 'stable' => {
      if (Math.abs(change) < 1) return 'stable';
      return change > 0 ? 'up' : 'down';
    };

    const recentOrders = await this.getTopOrders({ ...query, limit: 5 });
    const recentDeliveries = await this.getRecentDeliveries(5);

    return {
      kpiCards: {
        totalOrders: {
          value: currentStats.totalOrders,
          change: calculateChange(currentStats.totalOrders, previousStats.totalOrders),
          trend: getTrend(calculateChange(currentStats.totalOrders, previousStats.totalOrders)),
        },
        totalRevenue: {
          value: currentStats.totalRevenue,
          change: calculateChange(currentStats.totalRevenue, previousStats.totalRevenue),
          trend: getTrend(calculateChange(currentStats.totalRevenue, previousStats.totalRevenue)),
        },
        pendingDeliveries: {
          value: currentStats.pendingDeliveries,
          change: calculateChange(currentStats.pendingDeliveries, previousStats.pendingDeliveries),
          trend: getTrend(calculateChange(currentStats.pendingDeliveries, previousStats.pendingDeliveries)),
        },
        completionRate: {
          value: currentStats.deliveryCompletionRate,
          change: calculateChange(currentStats.deliveryCompletionRate, previousStats.deliveryCompletionRate),
          trend: getTrend(calculateChange(currentStats.deliveryCompletionRate, previousStats.deliveryCompletionRate)),
        },
      },
      recentActivity: {
        recentOrders,
        recentDeliveries,
        alerts: [], // TODO: Implement alerts system
      },
      quickStats: currentStats,
    };
  }

  async getOrdersReport(query: GetAnalyticsDto): Promise<OrdersReport> {
    const { startDate, endDate } = this.getDateRange(query);

    // Get order summary
    const orderSummary = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        'COUNT(*) as totalOrders',
        'SUM(order.totalCost) as totalValue',
        'AVG(order.totalCost) as averageOrderValue',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Get orders by status
    const ordersByStatus = await this.orderRepository
      .createQueryBuilder('order')
      .select(['order.status as status', 'COUNT(*) as count'])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('order.status')
      .getRawMany();

    const totalOrdersForPercentage = parseInt(orderSummary.totalOrders) || 1;
    const statusWithPercentage = ordersByStatus.map(item => ({
      status: item.status,
      count: parseInt(item.count),
      percentage: (parseInt(item.count) / totalOrdersForPercentage) * 100,
    }));

    // Get order trends
    const orderTrends = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        `DATE_FORMAT(order.createdAt, '%Y-%m') as period`,
        'COUNT(*) as orders',
        'SUM(order.totalCost) as value',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Get top products
    const topProducts = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select([
        'item.asin as asin',
        'item.title as title',
        'item.brandName as brandName',
        'COUNT(DISTINCT order.id) as orderCount',
        'SUM(item.quantityRequested) as totalQuantity',
        'SUM(item.totalCost) as totalValue',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('item.asin, item.title, item.brandName')
      .orderBy('totalValue', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      summary: {
        totalOrders: parseInt(orderSummary.totalOrders) || 0,
        totalValue: parseFloat(orderSummary.totalValue) || 0,
        averageOrderValue: parseFloat(orderSummary.averageOrderValue) || 0,
        ordersByStatus: statusWithPercentage,
      },
      trends: {
        orderTrends: orderTrends.map(trend => ({
          period: trend.period,
          orders: parseInt(trend.orders),
          value: parseFloat(trend.value),
        })),
        statusTrends: [], // TODO: Implement status trends over time
      },
      topProducts: topProducts.map(product => ({
        asin: product.asin,
        title: product.title,
        brandName: product.brandName,
        orderCount: parseInt(product.orderCount),
        totalQuantity: parseInt(product.totalQuantity),
        totalValue: parseFloat(product.totalValue),
      })),
      performance: {
        averageProcessingTime: 2.5, // TODO: Calculate from actual data
        fulfillmentRate: 92.8, // TODO: Calculate from actual data
        cancellationRate: 3.2, // TODO: Calculate from actual data
      },
    };
  }

  async getDeliveriesReport(query: GetAnalyticsDto): Promise<DeliveriesReport> {
    const { startDate, endDate } = this.getDateRange(query);

    // Get delivery summary
    const deliverySummary = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .select([
        'COUNT(*) as totalDeliveries',
        'SUM(CASE WHEN delivery.status = "delivered" THEN 1 ELSE 0 END) as completedDeliveries',
        'SUM(CASE WHEN delivery.status = "pending" THEN 1 ELSE 0 END) as pendingDeliveries',
      ])
      .where('delivery.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Get delivery trends
    const deliveryTrends = await this.deliveryRepository
      .createQueryBuilder('delivery')
      .select([
        `DATE_FORMAT(delivery.createdAt, '%Y-%m') as period`,
        'SUM(CASE WHEN delivery.status = "delivered" THEN 1 ELSE 0 END) as completed',
        'SUM(CASE WHEN delivery.status = "pending" THEN 1 ELSE 0 END) as pending',
        'COUNT(*) as total',
      ])
      .where('delivery.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    return {
      summary: {
        totalDeliveries: parseInt(deliverySummary.totalDeliveries) || 0,
        completedDeliveries: parseInt(deliverySummary.completedDeliveries) || 0,
        pendingDeliveries: parseInt(deliverySummary.pendingDeliveries) || 0,
        averageDeliveryTime: 3.5, // TODO: Calculate from actual data
        onTimeDeliveryRate: 85.2, // TODO: Calculate from actual data
      },
      trends: {
        deliveryTrends: deliveryTrends.map(trend => ({
          period: trend.period,
          completed: parseInt(trend.completed),
          pending: parseInt(trend.pending),
          total: parseInt(trend.total),
        })),
        performanceTrends: [], // TODO: Implement performance trends
      },
      performance: {
        fastestDeliveries: [], // TODO: Implement
        slowestDeliveries: [], // TODO: Implement
        topPerformers: [], // TODO: Implement
      },
    };
  }

  async getRevenueReport(query: GetAnalyticsDto): Promise<RevenueReport> {
    const { startDate, endDate } = this.getDateRange(query);

    // Get revenue summary
    const revenueSummary = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        'SUM(order.totalCost) as totalRevenue',
        'SUM(CASE WHEN order.deliveredQuantity > 0 THEN (order.deliveredQuantity / order.totalItems) * order.totalCost ELSE 0 END) as deliveredRevenue',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    const totalRevenue = parseFloat(revenueSummary.totalRevenue) || 0;
    const deliveredRevenue = parseFloat(revenueSummary.deliveredRevenue) || 0;
    const pendingRevenue = totalRevenue - deliveredRevenue;

    // Get monthly revenue trends
    const monthlyRevenue = await this.orderRepository
      .createQueryBuilder('order')
      .select([
        `DATE_FORMAT(order.createdAt, '%Y-%m') as period`,
        'SUM(order.totalCost) as revenue',
        'SUM(CASE WHEN order.deliveredQuantity > 0 THEN (order.deliveredQuantity / order.totalItems) * order.totalCost ELSE 0 END) as delivered',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('period')
      .orderBy('period', 'ASC')
      .getRawMany();

    // Get revenue by category (using brand as category)
    const revenueByCategory = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select([
        'item.brandName as category',
        'SUM(item.totalCost) as revenue',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('item.brandName')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany();

    const totalCategoryRevenue = revenueByCategory.reduce((sum, item) => sum + parseFloat(item.revenue), 0);

    return {
      summary: {
        totalRevenue,
        deliveredRevenue,
        pendingRevenue,
        revenueGrowth: 12.5, // TODO: Calculate from previous period
        profitMargin: 25.8, // TODO: Calculate from cost data
      },
      trends: {
        monthlyRevenue: monthlyRevenue.map(month => ({
          period: month.period,
          revenue: parseFloat(month.revenue),
          delivered: parseFloat(month.delivered),
          pending: parseFloat(month.revenue) - parseFloat(month.delivered),
        })),
        quarterlyGrowth: [], // TODO: Implement quarterly growth calculation
      },
      breakdown: {
        byCategory: revenueByCategory.map(item => ({
          category: item.category,
          revenue: parseFloat(item.revenue),
          percentage: totalCategoryRevenue > 0 ? (parseFloat(item.revenue) / totalCategoryRevenue) * 100 : 0,
        })),
        byBrand: [], // TODO: Implement brand breakdown
        byMonth: monthlyRevenue.map(month => ({
          month: month.period,
          revenue: parseFloat(month.revenue),
          orders: 0, // TODO: Add order count
        })),
      },
      forecasting: {
        nextMonthProjection: totalRevenue * 1.1, // Simple projection
        quarterProjection: totalRevenue * 3.2,
        yearProjection: totalRevenue * 12.5,
      },
    };
  }

  async getInventoryReport(query: GetAnalyticsDto): Promise<InventoryReport> {
    const { startDate, endDate } = this.getDateRange(query);

    // Get inventory summary
    const inventorySummary = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select([
        'COUNT(*) as totalItems',
        'SUM(item.quantityRequested) as totalRequested',
        'SUM(COALESCE(item.quantityRequested - item.quantityRemaining, 0)) as delivered',
        'SUM(item.quantityRemaining) as remaining',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .getRawOne();

    // Get stock levels by item
    const stockLevels = await this.orderItemRepository
      .createQueryBuilder('item')
      .innerJoin('item.order', 'order')
      .select([
        'item.asin as asin',
        'item.title as title',
        'item.brandName as brandName',
        'SUM(item.quantityRequested) as totalRequested',
        'SUM(COALESCE(item.quantityRequested - item.quantityRemaining, 0)) as delivered',
        'SUM(item.quantityRemaining) as remaining',
      ])
      .where('order.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate })
      .groupBy('item.asin, item.title, item.brandName')
      .orderBy('remaining', 'DESC')
      .limit(50)
      .getRawMany();

    const stockLevelsWithStatus = stockLevels.map(item => {
      const remaining = parseInt(item.remaining);
      let status: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';

      if (remaining === 0) status = 'out_of_stock';
      else if (remaining < 10) status = 'low_stock';

      return {
        asin: item.asin,
        title: item.title,
        brandName: item.brandName,
        totalRequested: parseInt(item.totalRequested),
        delivered: parseInt(item.delivered),
        remaining,
        status,
      };
    });

    return {
      summary: {
        totalItems: parseInt(inventorySummary.totalItems) || 0,
        deliveredItems: parseInt(inventorySummary.delivered) || 0,
        pendingItems: parseInt(inventorySummary.remaining) || 0,
        stockTurnover: 2.3, // TODO: Calculate actual turnover rate
      },
      stockLevels: stockLevelsWithStatus,
      trends: {
        inventoryMovement: [], // TODO: Implement inventory movement trends
        topMovingItems: [], // TODO: Implement top moving items
      },
      alerts: {
        lowStock: stockLevelsWithStatus.filter(item => item.status === 'low_stock'),
        overStock: [], // TODO: Implement overstock detection
        slowMoving: [], // TODO: Implement slow moving detection
      },
    };
  }

  private async getRecentDeliveries(limit: number = 5) {
    return await this.deliveryRepository
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.order', 'order')
      .orderBy('delivery.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  private getDateRange(query: GetAnalyticsDto) {
    const { startDate, endDate, period } = query;

    if (startDate && endDate) {
      return { startDate: new Date(startDate), endDate: new Date(endDate) };
    }

    // Default to last 30 days if no dates provided
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    return { startDate: start, endDate: end };
  }
}

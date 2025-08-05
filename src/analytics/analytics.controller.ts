import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { GetAnalyticsDto } from './dto/get-analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) { }

  @Get('dashboard')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get dashboard statistics and analytics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard analytics retrieved successfully',
  })
  async getDashboardStats(@Query() query: GetAnalyticsDto) {
    const stats = await this.analyticsService.getDashboardStats(query);
    return {
      success: true,
      data: stats,
    };
  }

  @Get('revenue-trends')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get revenue trends over time' })
  @ApiResponse({
    status: 200,
    description: 'Revenue trends retrieved successfully',
  })
  async getRevenueTrends(@Query() query: GetAnalyticsDto) {
    const trends = await this.analyticsService.getRevenueTrends(query);
    return {
      success: true,
      data: trends,
    };
  }

  @Get('category-distribution')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get order distribution by category' })
  @ApiResponse({
    status: 200,
    description: 'Category distribution retrieved successfully',
  })
  async getCategoryDistribution(@Query() query: GetAnalyticsDto) {
    const distribution =
      await this.analyticsService.getCategoryDistribution(query);
    return {
      success: true,
      data: distribution,
    };
  }

  @Get('top-orders')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get top orders by value' })
  @ApiResponse({
    status: 200,
    description: 'Top orders retrieved successfully',
  })
  async getTopOrders(@Query() query: GetAnalyticsDto) {
    const topOrders = await this.analyticsService.getTopOrders(query);
    return {
      success: true,
      data: topOrders,
    };
  }

  @Get('performance-metrics')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get performance metrics and KPIs' })
  @ApiResponse({
    status: 200,
    description: 'Performance metrics retrieved successfully',
  })
  async getPerformanceMetrics(@Query() query: GetAnalyticsDto) {
    const metrics = await this.analyticsService.getPerformanceMetrics(query);
    return {
      success: true,
      data: metrics,
    };
  }

  @Get('dashboard-summary')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get comprehensive dashboard summary with all key metrics' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary retrieved successfully',
  })
  async getDashboardSummary(@Query() query: GetAnalyticsDto) {
    const summary = await this.analyticsService.getDashboardSummary(query);
    return {
      success: true,
      data: summary,
    };
  }

  @Get('orders-report')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get detailed orders report with statistics and trends' })
  @ApiResponse({
    status: 200,
    description: 'Orders report retrieved successfully',
  })
  async getOrdersReport(@Query() query: GetAnalyticsDto) {
    const report = await this.analyticsService.getOrdersReport(query);
    return {
      success: true,
      data: report,
    };
  }

  @Get('deliveries-report')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get delivery performance metrics and analytics' })
  @ApiResponse({
    status: 200,
    description: 'Deliveries report retrieved successfully',
  })
  async getDeliveriesReport(@Query() query: GetAnalyticsDto) {
    const report = await this.analyticsService.getDeliveriesReport(query);
    return {
      success: true,
      data: report,
    };
  }

  @Get('revenue-report')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get comprehensive revenue analytics and financial reports' })
  @ApiResponse({
    status: 200,
    description: 'Revenue report retrieved successfully',
  })
  async getRevenueReport(@Query() query: GetAnalyticsDto) {
    const report = await this.analyticsService.getRevenueReport(query);
    return {
      success: true,
      data: report,
    };
  }

  @Get('inventory-report')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get inventory levels and item tracking analytics' })
  @ApiResponse({
    status: 200,
    description: 'Inventory report retrieved successfully',
  })
  async getInventoryReport(@Query() query: GetAnalyticsDto) {
    const report = await this.analyticsService.getInventoryReport(query);
    return {
      success: true,
      data: report,
    };
  }
}

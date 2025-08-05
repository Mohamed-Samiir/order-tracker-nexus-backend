import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { GetDeliveriesDto } from './dto/get-deliveries.dto';
import {
  ExcelImportDeliveryDto,
  ExcelImportDeliveryResponseDto,
} from './dto/excel-import-delivery.dto';
import { DeliveryResponseDto, PaginatedDeliveryResponseDto } from './dto/delivery-response.dto';
import { plainToInstance } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Deliveries')
@Controller('deliveries')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DeliveriesController {
  constructor(private readonly deliveriesService: DeliveriesService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @ApiOperation({
    summary: 'Create new delivery with automatic quantity tracking',
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery created successfully',
    type: DeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid delivery data, quantity exceeds remaining, or invalid status transition',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async create(
    @Body() createDeliveryDto: CreateDeliveryDto,
    @CurrentUser() user: User,
  ) {
    const delivery = await this.deliveriesService.create(
      createDeliveryDto,
      user,
    );

    const responseData = plainToInstance(DeliveryResponseDto, delivery, {
      excludeExtraneousValues: true,
    });

    return {
      success: true,
      message: `Delivery ${delivery.deliveryId} created successfully`,
      data: responseData,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all deliveries with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Deliveries retrieved successfully',
    type: PaginatedDeliveryResponseDto,
  })
  async findAll(@Query() query: GetDeliveriesDto) {
    const result = await this.deliveriesService.findAll(query);

    const responseData = plainToInstance(DeliveryResponseDto, result.data, {
      excludeExtraneousValues: true,
    });

    return {
      success: true,
      data: {
        data: responseData,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get delivery by ID with items and order details' })
  @ApiResponse({
    status: 200,
    description: 'Delivery retrieved successfully',
    type: DeliveryResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  async findOne(@Param('id') id: string) {
    const delivery = await this.deliveriesService.findOne(id);

    const responseData = plainToInstance(DeliveryResponseDto, delivery, {
      excludeExtraneousValues: true,
    });

    return {
      success: true,
      data: responseData,
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @ApiOperation({
    summary: 'Update delivery with automatic quantity recalculation',
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery updated successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid delivery data, quantity exceeds remaining, or invalid status transition',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  async update(
    @Param('id') id: string,
    @Body() updateDeliveryDto: UpdateDeliveryDto,
  ) {
    const delivery = await this.deliveriesService.update(id, updateDeliveryDto);

    const responseData = plainToInstance(DeliveryResponseDto, delivery, {
      excludeExtraneousValues: true,
    });

    return {
      success: true,
      message: `Delivery ${delivery.deliveryId} updated successfully`,
      data: responseData,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete delivery with automatic quantity restoration (Admin only)',
  })
  @ApiResponse({
    status: 204,
    description: 'Delivery deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  async remove(@Param('id') id: string) {
    await this.deliveriesService.remove(id);
  }

  @Post('recalculate-quantities/:orderId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Recalculate and fix quantity inconsistencies for an order (Admin only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Quantities recalculated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async recalculateQuantities(@Param('orderId') orderId: string) {
    const result = await this.deliveriesService.recalculateOrderQuantities(orderId);
    return {
      success: true,
      message: 'Quantities recalculated successfully',
      data: result,
    };
  }

  @Get('audit-log')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get quantity audit log for debugging',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved successfully',
  })
  async getAuditLog(
    @Query('orderItemId') orderItemId?: string,
    @Query('limit') limit: number = 100,
  ) {
    const auditLog = await this.deliveriesService.getQuantityAuditLog(orderItemId, limit);
    return {
      success: true,
      data: auditLog,
    };
  }

  @Get('audit-log/:orderItemId')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get quantity audit log for specific order item',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit log retrieved successfully',
  })
  async getAuditLogForOrderItem(
    @Param('orderItemId') orderItemId: string,
    @Query('limit') limit: number = 100,
  ) {
    const auditLog = await this.deliveriesService.getQuantityAuditLog(orderItemId, limit);
    return {
      success: true,
      data: auditLog,
    };
  }

  @Post('preview')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Preview delivery items from Excel file without saving',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx)',
        },
        orderId: {
          type: 'string',
          description: 'Order ID to preview delivery for',
          example: 'uuid-order-id',
        },
      },
      required: ['file', 'orderId'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery items preview generated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid file or data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async previewDeliveryFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body('orderId') orderId: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.deliveriesService.previewDeliveryFromExcel(
      file,
      orderId,
    );
    return {
      success: true,
      message: 'Delivery items preview generated successfully',
      data: result,
    };
  }

  @Post('save')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @ApiOperation({ summary: 'Save delivery from reviewed items' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        orderId: {
          type: 'string',
          description: 'Order ID',
          example: 'uuid-order-id',
        },
        deliveryDate: {
          type: 'string',
          format: 'date',
          description: 'Delivery date (YYYY-MM-DD)',
          example: '2024-01-25',
        },
        deliveryItems: {
          type: 'array',
          description: 'Array of complete delivery items to save',
          items: {
            type: 'object',
            properties: {
              asin: {
                type: 'string',
                description: 'Product ASIN',
                example: 'B08N5WRWNW',
              },
              brandName: {
                type: 'string',
                description: 'Brand name',
                example: 'Apple',
              },
              modelNumber: {
                type: 'string',
                description: 'Model number (13 digits)',
                example: '1234567890123',
              },
              title: {
                type: 'string',
                description: 'Product title',
                example: 'iPhone 12 Pro',
              },
              deliveredQuantity: {
                type: 'number',
                description: 'Quantity delivered',
                example: 5,
              },
              unitPrice: {
                type: 'number',
                description: 'Unit price',
                example: 299.99,
              },
              remainingQuantity: {
                type: 'number',
                description: 'Remaining quantity in order',
                example: 10,
              },
              orderItemId: {
                type: 'string',
                description: 'Order item ID for direct reference',
                example: 'uuid-string',
              },
            },
            required: ['asin', 'deliveredQuantity', 'unitPrice'],
          },
        },
      },
      required: ['orderId', 'deliveryDate', 'deliveryItems'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery saved successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid data or quantity validation errors',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async saveDeliveryFromItems(
    @Body('orderId') orderId: string,
    @Body('deliveryDate') deliveryDate: string,
    @Body('deliveryItems') deliveryItems: any[],
    @CurrentUser() user: User,
  ) {
    const result = await this.deliveriesService.saveDeliveryFromItems(
      deliveryItems,
      orderId,
      new Date(deliveryDate),
      user,
    );
    return {
      success: true,
      message: 'Delivery saved successfully',
      data: result,
    };
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import delivery from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Excel file (.xlsx)',
        },
        orderId: {
          type: 'string',
          description: 'Order ID to create delivery for',
          example: 'uuid-order-id',
        },
        deliveryDate: {
          type: 'string',
          format: 'date',
          description: 'Delivery date (YYYY-MM-DD)',
          example: '2024-01-25',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in-transit', 'delivered', 'cancelled'],
          description: 'Delivery status (optional)',
          example: 'delivered',
        },
      },
      required: ['file', 'orderId', 'deliveryDate'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Delivery imported successfully',
    type: ExcelImportDeliveryResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file, data, or insufficient order quantities',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() excelImportDto: ExcelImportDeliveryDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.deliveriesService.importFromExcel(
      file,
      excelImportDto,
      user,
    );
    return {
      success: true,
      message: 'Delivery imported successfully',
      data: result,
    };
  }

  @Get(':id/revenue')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get delivery revenue and statistics' })
  @ApiResponse({
    status: 200,
    description: 'Delivery revenue calculated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Delivery not found',
  })
  async getDeliveryRevenue(@Param('id') id: string) {
    const revenue = await this.deliveriesService.getDeliveryRevenue(id);
    return {
      success: true,
      data: revenue,
    };
  }

  @Get('order/:orderId/stats')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get delivery statistics for an order' })
  @ApiResponse({
    status: 200,
    description: 'Order delivery statistics retrieved successfully',
  })
  async getOrderDeliveryStats(@Param('orderId') orderId: string) {
    const stats = await this.deliveriesService.getOrderDeliveryStats(orderId);
    return {
      success: true,
      data: stats,
    };
  }
}

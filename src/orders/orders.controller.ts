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
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import {
  ExcelImportDto,
  ExcelImportResponseDto,
  ExcelPreviewResponseDto,
} from './dto/excel-import.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('Orders')
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @ApiOperation({ summary: 'Create new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 409,
    description: 'Order with this ID already exists',
  })
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.create(createOrderDto, user);
    return {
      success: true,
      message: 'Order created successfully',
      data: order,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get all orders with filtering and pagination' })
  @ApiResponse({
    status: 200,
    description: 'Orders retrieved successfully',
  })
  async findAll(@Query() query: GetOrdersDto) {
    const result = await this.ordersService.findAll(query);
    return {
      success: true,
      data: result,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Get order by ID with items and deliveries' })
  @ApiResponse({
    status: 200,
    description: 'Order retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async findOne(@Param('id') id: string) {
    const order = await this.ordersService.findOne(id);
    return {
      success: true,
      data: order,
    };
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update order (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Order updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Order ID already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateOrderDto: UpdateOrderDto,
  ) {
    const order = await this.ordersService.update(id, updateOrderDto);
    return {
      success: true,
      message: 'Order updated successfully',
      data: order,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete order (Admin only)',
    description: 'Soft delete an order. Cannot delete orders that have associated deliveries.'
  })
  @ApiResponse({
    status: 204,
    description: 'Order deleted successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Bad Request - Order has associated deliveries',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'string',
          example: 'Cannot delete order that has associated deliveries. Please delete all deliveries first.'
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'Order not found',
  })
  async remove(@Param('id') id: string) {
    await this.ordersService.remove(id);
  }

  @Post('import/preview')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Preview Excel file import without saving to database',
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
          nullable: true,
          description:
            'Order ID for the imported items (optional - auto-generated if not provided)',
          example: 'ORD-2024-001',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Excel file processed successfully for preview',
    type: ExcelPreviewResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 409,
    description: 'Order with this ID already exists',
  })
  async previewExcelImport(
    @UploadedFile() file: Express.Multer.File,
    @Body() excelImportDto: ExcelImportDto,
  ) {
    const result = await this.ordersService.previewExcelImport(
      file,
      excelImportDto,
    );
    return {
      success: true,
      message: 'Excel file processed successfully for preview',
      data: result,
    };
  }

  @Post('import')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import orders from Excel file' })
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
          nullable: true,
          description:
            'Order ID for the imported items (optional - auto-generated if not provided)',
          example: 'ORD-2024-001',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Order imported successfully',
    type: ExcelImportResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file or data',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin or Uploader access required',
  })
  @ApiResponse({
    status: 409,
    description: 'Order with this ID already exists',
  })
  async importFromExcel(
    @UploadedFile() file: Express.Multer.File,
    @Body() excelImportDto: ExcelImportDto,
    @CurrentUser() user: User,
  ) {
    const result = await this.ordersService.importFromExcel(
      file,
      excelImportDto,
      user,
    );
    return {
      success: true,
      message: 'Order imported successfully',
      data: result,
    };
  }

  @Get(':id/download')
  @Roles(UserRole.ADMIN, UserRole.UPLOADER, UserRole.VIEWER)
  @ApiOperation({ summary: 'Download Excel file for an order' })
  @ApiResponse({
    status: 200,
    description: 'Excel file downloaded successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Order or file not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Authentication required',
  })
  async downloadOrderFile(@Param('id') id: string, @Res() res: Response) {
    const order = await this.ordersService.findOne(id);

    if (!order.fileName) {
      throw new NotFoundException('No file associated with this order');
    }

    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'src',
      'orders',
      order.fileName,
    );

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on server');
    }

    res.download(filePath, order.fileName, (err) => {
      if (err) {
        throw new NotFoundException('Error downloading file');
      }
    });
  }
}

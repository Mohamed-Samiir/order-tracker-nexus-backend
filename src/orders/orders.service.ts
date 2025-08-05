import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { User } from '../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { GetOrdersDto } from './dto/get-orders.dto';
import { ExcelImportDto } from './dto/excel-import.dto';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    @InjectRepository(Delivery)
    private deliveryRepository: Repository<Delivery>,
  ) { }

  async create(createOrderDto: CreateOrderDto, user: User): Promise<Order> {
    // Generate order ID if not provided
    let orderId = createOrderDto.orderId;
    if (!orderId) {
      orderId = await this.generateUniqueOrderId();
    } else {
      // Validate provided order ID for uniqueness (including soft-deleted orders)
      const isUnique = await this.validateOrderIdUniqueness(orderId);
      if (!isUnique) {
        throw new ConflictException('Order with this ID already exists');
      }
    }

    // Calculate totals
    const totalItems = createOrderDto.items.reduce(
      (sum, item) => sum + item.quantityRequested,
      0,
    );
    const totalCost = createOrderDto.items.reduce(
      (sum, item) => sum + item.quantityRequested * item.unitCost,
      0,
    );

    // Create order
    const order = this.orderRepository.create({
      orderId,
      status: createOrderDto.status || OrderStatus.PENDING,
      totalItems,
      totalCost,
      remainingQuantity: totalItems,
      fileName: createOrderDto.fileName,
      createdBy: user,
    });

    // Save order with retry mechanism for potential constraint violations
    const savedOrder = await this.saveOrderWithRetry(order);

    // Create order items
    const orderItems = createOrderDto.items.map((itemDto) => {
      const totalItemCost = itemDto.quantityRequested * itemDto.unitCost;
      return this.orderItemRepository.create({
        ...itemDto,
        totalCost: totalItemCost,
        quantityRemaining: itemDto.quantityRequested, // Will be managed by triggers
        order: savedOrder,
      });
    });

    await this.orderItemRepository.save(orderItems);

    return this.findOne(savedOrder.id);
  }

  async findAll(query: GetOrdersDto): Promise<PaginatedResponse<Order>> {
    const queryBuilder = this.createQueryBuilder();

    // Apply filters
    this.applyFilters(queryBuilder, query);

    // Apply sorting
    queryBuilder.orderBy(`order.${query.sortBy}`, query.sortOrder);

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const total = await queryBuilder.getCount();
    queryBuilder.skip((page - 1) * limit).take(limit);

    const orders = await queryBuilder.getMany();

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id, isDeleted: false },
      relations: ['items', 'deliveries', 'createdBy'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(id: string, updateOrderDto: UpdateOrderDto): Promise<Order> {
    const order = await this.findOne(id);

    // If orderId is being updated, validate uniqueness (including soft-deleted orders)
    if (updateOrderDto.orderId && updateOrderDto.orderId !== order.orderId) {
      const isUnique = await this.validateOrderIdUniqueness(updateOrderDto.orderId);
      if (!isUnique) {
        throw new ConflictException('Order with this ID already exists');
      }
    }

    // Update order
    await this.orderRepository.update(id, updateOrderDto);

    // If items are being updated, handle them
    if (updateOrderDto.items) {
      // Remove existing items
      await this.orderItemRepository.delete({ order: { id } });

      // Add new items
      const orderItems = updateOrderDto.items.map((itemDto) => {
        const totalItemCost = itemDto.quantityRequested * itemDto.unitCost;
        return this.orderItemRepository.create({
          ...itemDto,
          totalCost: totalItemCost,
          quantityRemaining: itemDto.quantityRequested,
          order,
        });
      });

      await this.orderItemRepository.save(orderItems);

      // Recalculate order totals
      const totalItems = updateOrderDto.items.reduce(
        (sum, item) => sum + item.quantityRequested,
        0,
      );
      const totalCost = updateOrderDto.items.reduce(
        (sum, item) => sum + item.quantityRequested * item.unitCost,
        0,
      );

      await this.orderRepository.update(id, {
        totalItems,
        totalCost,
        remainingQuantity: totalItems,
      });
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const order = await this.findOne(id);

    // Check if order has any associated deliveries
    const deliveryCount = await this.deliveryRepository.count({
      where: { order: { id } },
    });

    if (deliveryCount > 0) {
      throw new BadRequestException(
        'Cannot delete order that has associated deliveries. Please delete all deliveries first.'
      );
    }

    // Soft delete: set isDeleted to true instead of removing the record
    await this.orderRepository.update(id, { isDeleted: true });
  }

  private createQueryBuilder(): SelectQueryBuilder<Order> {
    return this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.createdBy', 'createdBy')
      .where('order.isDeleted = :isDeleted', { isDeleted: false })
      .select([
        'order.id',
        'order.orderId',
        'order.status',
        'order.totalItems',
        'order.totalCost',
        'order.deliveredQuantity',
        'order.remainingQuantity',
        'order.fileName',
        'order.isDeleted',
        'order.createdAt',
        'order.updatedAt',
        'createdBy.id',
        'createdBy.name',
        'createdBy.email',
      ]);
  }

  async previewExcelImport(
    file: Express.Multer.File,
    excelImportDto: ExcelImportDto,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Generate order ID if not provided
    let orderId = excelImportDto.orderId;
    if (!orderId) {
      orderId = await this.generateUniqueOrderId();
    } else {
      // Validate provided order ID for uniqueness (including soft-deleted orders)
      const isUnique = await this.validateOrderIdUniqueness(orderId);
      if (!isUnique) {
        throw new ConflictException('Order with this ID already exists');
      }
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const errors: string[] = [];
      const validItems: any[] = [];

      // Process each row
      data.forEach((row: any, index: number) => {
        try {
          const item = this.validateExcelRow(row, index + 2); // +2 for header and 0-based index
          validItems.push(item);
        } catch (error) {
          const rowNumber = index + 2; // +2 for header and 0-based index
          errors.push(`Row ${rowNumber}: ${error.message}`);
          console.error(
            `Excel validation error at row ${rowNumber}:`,
            error.message,
            'Row data:',
            row,
          );
        }
      });

      if (validItems.length === 0) {
        throw new BadRequestException('No valid items found in Excel file');
      }

      return {
        orderId,
        totalItems: data.length,
        itemsProcessed: validItems.length,
        itemsSkipped: data.length - validItems.length,
        errors,
        items: validItems,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException('Failed to process Excel file');
    }
  }

  async importFromExcel(
    file: Express.Multer.File,
    excelImportDto: ExcelImportDto,
    user: User,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Generate order ID if not provided
    let orderId = excelImportDto.orderId;
    if (!orderId) {
      orderId = await this.generateUniqueOrderId();
    } else {
      // Validate provided order ID for uniqueness (including soft-deleted orders)
      const isUnique = await this.validateOrderIdUniqueness(orderId);
      if (!isUnique) {
        throw new ConflictException('Order with this ID already exists');
      }
    }

    try {
      // Parse Excel file
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (data.length === 0) {
        throw new BadRequestException('Excel file is empty');
      }

      const errors: string[] = [];
      const validItems: any[] = [];

      // Process each row
      data.forEach((row: any, index: number) => {
        try {
          const item = this.validateExcelRow(row, index + 2); // +2 for header and 0-based index
          validItems.push(item);
        } catch (error) {
          const rowNumber = index + 2; // +2 for header and 0-based index
          errors.push(`Row ${rowNumber}: ${error.message}`);
          console.error(
            `Excel validation error at row ${rowNumber}:`,
            error.message,
            'Row data:',
            row,
          );
        }
      });

      if (validItems.length === 0) {
        throw new BadRequestException('No valid items found in Excel file');
      }

      // Save Excel file
      const fileName = await this.saveExcelFile(file, orderId);

      // Create order with valid items and file name
      const createOrderDto: CreateOrderDto = {
        orderId,
        status: OrderStatus.PENDING,
        fileName,
        items: validItems,
      };

      const order = await this.create(createOrderDto, user);

      return {
        orderId: order.orderId,
        totalItems: data.length,
        itemsProcessed: validItems.length,
        itemsSkipped: data.length - validItems.length,
        errors,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to process Excel file: ' + error.message,
      );
    }
  }

  private validateExcelRow(row: any, rowNumber: number): any {
    const requiredFields = [
      'ASIN',
      'Brand Name',
      'Model Number',
      'Title',
      'Requesting Date',
      'Quantity Requested',
      'Unit Cost',
    ];

    // Check required fields
    for (const field of requiredFields) {
      if (!row[field]) {
        console.log(`Missing required field: ${field}`);
      }
      if (!row[field] && row[field] !== 0) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate model number (13 digits)
    const modelNumber = String(row['Model Number']).trim();
    if (!/^\d{13}$/.test(modelNumber)) {
      console.log(`Invalid model number: ${modelNumber}`);
      throw new Error(
        `Model number "${modelNumber}" must be exactly 13 digits (numbers only)`,
      );
    }

    // Validate quantity
    const quantity = Number(row['Quantity Requested']);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      console.log(`Invalid quantity: ${quantity}`);
      throw new Error('Quantity requested must be a positive integer');
    }

    // Validate unit cost
    const unitCost = Number(row['Unit Cost']);
    if (isNaN(unitCost) || unitCost < 0) {
      console.log(`Invalid unit cost: ${unitCost}`);
      throw new Error('Unit cost must be a valid positive number');
    }

    // Validate and parse date
    let requestingDate: Date;
    const rawDate = row['Requesting Date'];

    try {
      // Handle Excel date formats
      if (typeof rawDate === 'number') {
        // Excel serial date number
        requestingDate = new Date((rawDate - 25569) * 86400 * 1000);
      } else if (typeof rawDate === 'string') {
        // String date - try parsing
        const trimmedDate = rawDate.trim();
        if (!trimmedDate || trimmedDate === '0000-00-00' || trimmedDate === '00/00/0000') {
          throw new Error('Empty or invalid date format');
        }
        requestingDate = new Date(trimmedDate);
      } else if (rawDate instanceof Date) {
        requestingDate = rawDate;
      } else {
        throw new Error('Unsupported date format');
      }

      // Validate the parsed date
      if (isNaN(requestingDate.getTime()) || requestingDate.getFullYear() < 1900 || requestingDate.getFullYear() > 2100) {
        throw new Error('Date is out of valid range');
      }

    } catch (error) {
      console.log(`Invalid date: ${rawDate}, Error: ${error.message}`);
      throw new Error(`Invalid requesting date format: ${rawDate}`);
    }

    return {
      asin: String(row['ASIN']).trim(),
      brandName: String(row['Brand Name']).trim(),
      modelNumber: String(row['Model Number']).trim(),
      title: String(row['Title']).trim().substring(0, 255), // Limit to 255 chars
      requestingDate: requestingDate.toISOString().split('T')[0], // YYYY-MM-DD format
      quantityRequested: quantity,
      unitCost,
    };
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Order>,
    query: GetOrdersDto,
  ): void {
    if (query.search) {
      queryBuilder.andWhere('order.orderId LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('order.status = :status', { status: query.status });
    }

    if (query.startDate) {
      queryBuilder.andWhere('order.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('order.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    }
  }

  /**
   * Generate a unique order ID in the format ORD-YYYY-NNNNNN
   * where YYYY is the current year and NNNNNN is a sequential number
   * Includes retry mechanism and comprehensive uniqueness validation
   */
  private async generateUniqueOrderId(): Promise<string> {
    const maxRetries = 10;
    const currentYear = new Date().getFullYear();
    const prefix = `ORD-${currentYear}-`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Find the highest existing order ID for the current year (including soft-deleted orders for safety)
        const lastOrder = await this.orderRepository
          .createQueryBuilder('order')
          .where('order.orderId LIKE :prefix', { prefix: `${prefix}%` })
          .orderBy('order.orderId', 'DESC')
          .getOne();

        let nextNumber = 1;
        if (lastOrder) {
          // Extract the number part from the last order ID
          const lastOrderNumber = lastOrder.orderId.split('-')[2];
          if (lastOrderNumber && !isNaN(parseInt(lastOrderNumber))) {
            nextNumber = parseInt(lastOrderNumber) + 1;
          }
        }

        // Add some randomness to reduce collision probability in high-concurrency scenarios
        if (attempt > 1) {
          nextNumber += Math.floor(Math.random() * 100) + attempt;
        }

        // Format the number with leading zeros (6 digits)
        const formattedNumber = nextNumber.toString().padStart(6, '0');
        const candidateOrderId = `${prefix}${formattedNumber}`;

        // Comprehensive uniqueness check using database query
        const isUnique = await this.validateOrderIdUniqueness(candidateOrderId);

        if (isUnique) {
          return candidateOrderId;
        }

        // Log collision for monitoring (this helps track if we need to adjust the algorithm)
        console.warn(`Order ID collision detected: ${candidateOrderId} (attempt ${attempt}/${maxRetries})`);

      } catch (error) {
        console.error(`Error generating order ID on attempt ${attempt}:`, error);

        // If it's the last attempt, throw the error
        if (attempt === maxRetries) {
          throw new ConflictException(`Failed to generate unique order ID after ${maxRetries} attempts: ${error.message}`);
        }
      }

      // Wait a small random amount before retrying to reduce collision probability
      await this.sleep(Math.random() * 100 + 50); // 50-150ms
    }

    throw new Error(`Failed to generate unique order ID after ${maxRetries} attempts`);
  }

  /**
   * Validates that an order ID is unique in the database
   * Checks both active and soft-deleted orders for maximum safety
   */
  private async validateOrderIdUniqueness(orderId: string): Promise<boolean> {
    try {
      // Check if order ID exists (including soft-deleted orders)
      const existingOrder = await this.orderRepository.findOne({
        where: { orderId },
        withDeleted: true, // Include soft-deleted records
      });

      return !existingOrder;
    } catch (error) {
      // If there's a database error, assume not unique for safety
      console.error('Error validating order ID uniqueness:', error);
      return false;
    }
  }

  /**
   * Save order with retry mechanism for constraint violations
   * This provides a final safety net against race conditions
   */
  private async saveOrderWithRetry(order: Partial<Order>, maxRetries: number = 3): Promise<Order> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.orderRepository.save(order);
      } catch (error) {
        // Check if it's a unique constraint violation on orderId
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('orderId')) {
          console.warn(`Unique constraint violation on orderId: ${order.orderId} (attempt ${attempt}/${maxRetries})`);

          if (attempt === maxRetries) {
            // Generate a new order ID and try one more time
            console.log('Generating new order ID due to constraint violation...');
            order.orderId = await this.generateUniqueOrderId();
            return await this.orderRepository.save(order);
          }

          // Wait before retrying
          await this.sleep(Math.random() * 200 + 100); // 100-300ms
        } else {
          // For other errors, throw immediately
          throw error;
        }
      }
    }

    throw new ConflictException('Failed to save order due to repeated constraint violations');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async saveExcelFile(
    file: Express.Multer.File,
    orderId: string,
  ): Promise<string> {
    // Create orders directory if it doesn't exist
    const ordersDir = path.join(__dirname, '..', '..', 'src', 'orders');
    if (!fs.existsSync(ordersDir)) {
      fs.mkdirSync(ordersDir, { recursive: true });
    }

    // Generate unique filename with order ID and timestamp
    const timestamp = Date.now();
    const fileExtension = path.extname(file.originalname);
    const fileName = `order_${orderId}_${timestamp}${fileExtension}`;
    const filePath = path.join(ordersDir, fileName);

    // Save file
    fs.writeFileSync(filePath, file.buffer);

    return fileName;
  }
}

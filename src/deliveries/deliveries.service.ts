import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder, DataSource } from 'typeorm';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { User } from '../users/entities/user.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { GetDeliveriesDto } from './dto/get-deliveries.dto';
import { ExcelImportDeliveryDto } from './dto/excel-import-delivery.dto';
import { DeliveryItemData, ExcelRowData, DeliveryPreviewResult } from './interfaces/delivery-item.interface';
import * as XLSX from 'xlsx';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(Delivery)
    private deliveryRepository: Repository<Delivery>,
    @InjectRepository(DeliveryItem)
    private deliveryItemRepository: Repository<DeliveryItem>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private orderItemRepository: Repository<OrderItem>,
    private dataSource: DataSource,
  ) { }

  async create(
    createDeliveryDto: CreateDeliveryDto,
    user: User,
  ): Promise<Delivery> {
    // Verify order exists and is not soft-deleted
    const order = await this.orderRepository.findOne({
      where: {
        id: createDeliveryDto.orderId,
        isDeleted: false
      },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate delivery items and check quantities
    await this.validateDeliveryItems(createDeliveryDto.items, order.items);

    // Generate the next delivery ID with retry logic for concurrency
    const deliveryId = await this.generateNextDeliveryIdWithRetry();

    // Use transaction to ensure data consistency
    return await this.dataSource.transaction(async (manager) => {
      // Create delivery
      const delivery = manager.create(Delivery, {
        deliveryId,
        deliveryDate: new Date(createDeliveryDto.deliveryDate),
        status: createDeliveryDto.status || DeliveryStatus.DELIVERED,
        order,
        createdBy: user,
      });

      const savedDelivery = await manager.save(delivery);

      // Create delivery items
      const deliveryItems = createDeliveryDto.items.map((itemDto) => {
        const totalAmount = itemDto.deliveredQuantity * itemDto.unitPrice;

        return manager.create(DeliveryItem, {
          deliveredQuantity: itemDto.deliveredQuantity,
          unitPrice: itemDto.unitPrice,
          totalAmount,
          deliveryDate: savedDelivery.deliveryDate, // Set delivery date from parent delivery
          delivery: savedDelivery,
          orderItem: { id: itemDto.orderItemId } as OrderItem,
        });
      });

      await manager.save(DeliveryItem, deliveryItems);

      // Note: Quantity updates are handled automatically by database triggers
      // when delivery items are saved. No manual quantity updates needed.

      // Update order totals (but not individual item quantities - triggers handle that)
      await this.updateOrderTotalRemaining(manager, order.id);

      // Return the delivery with its relations using the transaction manager
      const deliveryWithRelations = await manager.findOne(Delivery, {
        where: { id: savedDelivery.id },
        relations: ['deliveryItems', 'deliveryItems.orderItem', 'order', 'createdBy'],
      });

      if (!deliveryWithRelations) {
        throw new Error('Failed to retrieve created delivery');
      }

      return deliveryWithRelations;
    });
  }

  async findAll(query: GetDeliveriesDto): Promise<PaginatedResponse<Delivery>> {
    const queryBuilder = this.createQueryBuilder();

    // Apply filters
    this.applyFilters(queryBuilder, query);

    // Apply sorting
    queryBuilder.orderBy(`delivery.${query.sortBy}`, query.sortOrder);

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const total = await queryBuilder.getCount();
    queryBuilder.skip((page - 1) * limit).take(limit);

    const deliveries = await queryBuilder.getMany();

    // Add calculated fields for frontend compatibility
    const deliveriesWithCalculatedFields = deliveries.map(delivery => ({
      ...delivery,
      deliveredQuantity: delivery.deliveryItems?.reduce(
        (sum, item) => sum + item.deliveredQuantity,
        0
      ) || 0,
      revenue: delivery.deliveryItems?.reduce(
        (sum, item) => sum + Number(item.totalAmount),
        0
      ) || 0,
    }));

    return {
      data: deliveriesWithCalculatedFields,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Delivery> {
    const delivery = await this.deliveryRepository.findOne({
      where: {
        id,
        order: { isDeleted: false }
      },
      relations: ['deliveryItems', 'deliveryItems.orderItem', 'order', 'createdBy'],
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    return delivery;
  }

  async update(
    id: string,
    updateDeliveryDto: UpdateDeliveryDto,
  ): Promise<Delivery> {
    const delivery = await this.findOne(id);

    // Validate status transition if status is being updated
    if (
      updateDeliveryDto.status &&
      updateDeliveryDto.status !== delivery.status
    ) {
      this.validateStatusTransition(delivery.status, updateDeliveryDto.status);
    }

    // If items are being updated, validate them
    if (updateDeliveryDto.items) {
      const order = await this.orderRepository.findOne({
        where: {
          id: delivery.order.id,
          isDeleted: false
        },
        relations: ['items'],
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      await this.validateDeliveryItems(updateDeliveryDto.items, order.items);
    }

    // Use transaction for consistency
    return await this.dataSource.transaction(async (manager) => {
      // Update delivery
      await manager.update(Delivery, id, {
        deliveryDate: updateDeliveryDto.deliveryDate
          ? new Date(updateDeliveryDto.deliveryDate)
          : undefined,
        status: updateDeliveryDto.status,
      });

      // If items are being updated, replace them
      if (updateDeliveryDto.items) {
        // Note: Database triggers will automatically handle quantity restoration
        // when delivery items are deleted and quantity updates when new items are saved

        // Remove existing items (triggers will restore quantities automatically)
        await manager.delete(DeliveryItem, { delivery: { id } });

        // Add new items (triggers will update quantities automatically)
        const deliveryItems = updateDeliveryDto.items.map((itemDto) => {
          const totalAmount = itemDto.deliveredQuantity * itemDto.unitPrice;

          return manager.create(DeliveryItem, {
            deliveredQuantity: itemDto.deliveredQuantity,
            unitPrice: itemDto.unitPrice,
            totalAmount,
            deliveryDate: updateDeliveryDto.deliveryDate
              ? new Date(updateDeliveryDto.deliveryDate)
              : delivery.deliveryDate, // Use updated or existing delivery date
            delivery,
            orderItem: { id: itemDto.orderItemId } as OrderItem,
          });
        });

        await manager.save(DeliveryItem, deliveryItems);

        // Update order totals (individual item quantities handled by triggers)
        await this.updateOrderTotalRemaining(manager, delivery.order.id);
      }

      // Return the delivery with its relations using the transaction manager
      const deliveryWithRelations = await manager.findOne(Delivery, {
        where: { id },
        relations: ['deliveryItems', 'deliveryItems.orderItem', 'order', 'createdBy'],
      });

      if (!deliveryWithRelations) {
        throw new NotFoundException('Delivery not found after update');
      }

      return deliveryWithRelations;
    });
  }

  async remove(id: string): Promise<void> {
    const delivery = await this.findOne(id);

    // Use transaction to ensure deletion is atomic
    await this.dataSource.transaction(async (manager) => {
      // Note: Database triggers will automatically restore quantities
      // when delivery items are deleted (cascade delete)

      // Remove the delivery (cascade will remove delivery items and restore quantities)
      await manager.remove(delivery);

      // Update order totals after deletion
      await this.updateOrderTotalRemaining(manager, delivery.order.id);
    });
  }

  async getDeliveryRevenue(deliveryId: string): Promise<{
    totalRevenue: number;
    itemCount: number;
    totalQuantity: number;
  }> {
    const delivery = await this.deliveryRepository.findOne({
      where: {
        id: deliveryId,
        order: { isDeleted: false }
      },
      relations: ['deliveryItems', 'deliveryItems.orderItem', 'order'],
    });

    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }

    const totalRevenue = delivery.deliveryItems.reduce(
      (sum, item) => sum + Number(item.totalAmount),
      0,
    );

    const totalQuantity = delivery.deliveryItems.reduce(
      (sum, item) => sum + item.deliveredQuantity,
      0,
    );

    return {
      totalRevenue,
      itemCount: delivery.deliveryItems.length,
      totalQuantity,
    };
  }

  async getOrderDeliveryStats(orderId: string): Promise<{
    totalDeliveries: number;
    totalRevenue: number;
    totalQuantityDelivered: number;
    deliveriesByStatus: Record<DeliveryStatus, number>;
  }> {
    const deliveries = await this.deliveryRepository.find({
      where: {
        order: {
          id: orderId,
          isDeleted: false
        }
      },
      relations: ['deliveryItems', 'deliveryItems.orderItem', 'order'],
    });

    const totalRevenue = deliveries.reduce((sum, delivery) => {
      return (
        sum +
        delivery.deliveryItems.reduce(
          (itemSum, item) => itemSum + Number(item.totalAmount),
          0,
        )
      );
    }, 0);

    const totalQuantityDelivered = deliveries.reduce((sum, delivery) => {
      return (
        sum +
        delivery.deliveryItems.reduce(
          (itemSum, item) => itemSum + item.deliveredQuantity,
          0,
        )
      );
    }, 0);

    const deliveriesByStatus = deliveries.reduce(
      (stats, delivery) => {
        stats[delivery.status] = (stats[delivery.status] || 0) + 1;
        return stats;
      },
      {} as Record<DeliveryStatus, number>,
    );

    // Ensure all statuses are represented
    Object.values(DeliveryStatus).forEach((status) => {
      if (!deliveriesByStatus[status]) {
        deliveriesByStatus[status] = 0;
      }
    });

    return {
      totalDeliveries: deliveries.length,
      totalRevenue,
      totalQuantityDelivered,
      deliveriesByStatus,
    };
  }

  async previewDeliveryFromExcel(
    file: Express.Multer.File,
    orderId: string,
  ): Promise<DeliveryPreviewResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify order exists and get its items
    const order = await this.orderRepository.findOne({
      where: { id: orderId, isDeleted: false },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
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
      const invalidItems: any[] = [];

      // Process each row and match with order items
      data.forEach((row: ExcelRowData, index: number) => {
        try {
          // Extract raw data from Excel row for display
          const asin = String(row['ASIN'] || '').trim();
          const brandName = String(row['Brand Name'] || '').trim();
          const modelNumber = String(row['Model Number'] || '').trim();
          const title = String(row['Title'] || '').trim();
          const deliveredQuantity = Number(row['Delivered Quantity'] || 0);
          const unitPrice = Number(row['Unit Price'] || 0);

          // Validate required fields
          const missingFields: string[] = [];
          if (!asin) missingFields.push('ASIN');
          if (!brandName) missingFields.push('Brand Name');
          if (!modelNumber) missingFields.push('Model Number');
          if (!title) missingFields.push('Title');
          if (!deliveredQuantity || deliveredQuantity <= 0)
            missingFields.push('Delivered Quantity');
          if (isNaN(unitPrice) || unitPrice < 0)
            missingFields.push('Unit Price');

          if (missingFields.length > 0) {
            const invalidItem = {
              asin: asin || 'N/A',
              brandName: brandName || 'N/A',
              modelNumber: modelNumber || 'N/A',
              title: title || 'N/A',
              deliveredQuantity,
              unitPrice,
              remainingQuantity: 0,
              isQuantityExceeded: false,
              hasValidationError: true,
              validationError: `Missing required fields: ${missingFields.join(', ')}`,
              rowNumber: index + 2,
            };
            invalidItems.push(invalidItem);
            errors.push(
              `Row ${index + 2}: Missing required fields: ${missingFields.join(', ')}`,
            );
            return;
          }

          // Validate model number format (13 digits)
          if (!/^\d{13}$/.test(modelNumber)) {
            const invalidItem = {
              asin,
              brandName,
              modelNumber,
              title,
              deliveredQuantity,
              unitPrice,
              remainingQuantity: 0,
              isQuantityExceeded: false,
              hasValidationError: true,
              validationError: `Model number "${modelNumber}" must be exactly 13 digits`,
              rowNumber: index + 2,
            };
            invalidItems.push(invalidItem);
            errors.push(
              `Row ${index + 2}: Model number "${modelNumber}" must be exactly 13 digits`,
            );
            return;
          }

          // Find matching order item by ASIN and model number

          const orderItem = order.items.find(
            (item) => item.asin === asin && item.modelNumber === modelNumber,
          );

          if (!orderItem) {
            const invalidItem = {
              asin,
              brandName,
              modelNumber,
              title,
              deliveredQuantity,
              unitPrice,
              remainingQuantity: 0,
              isQuantityExceeded: false,
              hasValidationError: true,
              validationError: `No matching order item found for ASIN: ${asin}, Model: ${modelNumber}`,
              rowNumber: index + 2,
            };
            invalidItems.push(invalidItem);
            errors.push(
              `Row ${index + 2}: No matching order item found for ASIN: ${asin}, Model: ${modelNumber}`,
            );
            return;
          }

          const remainingQuantity = orderItem.quantityRemaining;

          const itemWithValidation = {
            asin,
            brandName,
            modelNumber,
            title,
            deliveredQuantity,
            unitPrice,
            remainingQuantity,
            isQuantityExceeded: deliveredQuantity > remainingQuantity,
            hasValidationError: false,
            validationError: null,
            rowNumber: index + 2,
            orderItemId: orderItem.id,
          };

          if (itemWithValidation.isQuantityExceeded) {
            invalidItems.push(itemWithValidation);
            errors.push(
              `Row ${index + 2}: Delivery quantity (${deliveredQuantity}) exceeds remaining quantity (${remainingQuantity}) for ASIN ${asin}`,
            );
          } else {
            validItems.push(itemWithValidation);
          }
        } catch (error) {
          const rowNumber = index + 2;
          const invalidItem = {
            ...row,
            rowNumber,
            isQuantityExceeded: false,
            hasValidationError: true,
            validationError: error.message,
          };
          invalidItems.push(invalidItem);
          errors.push(`Row ${rowNumber}: ${error.message}`);
          // console.error(
          //   `Excel validation error at row ${rowNumber}:`,
          //   error.message,
          //   'Row data:',
          //   row,
          // );
        }
      });

      // Calculate summary statistics
      const totalDeliveryQuantity = validItems.reduce(
        (sum, item) => sum + item.deliveredQuantity,
        0,
      );
      const totalDeliveryValue = validItems.reduce(
        (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
        0,
      );

      return {
        orderId: order.orderId,
        orderInfo: {
          id: order.id,
          orderId: order.orderId,
          totalItems: order.totalItems,
          totalValue: order.totalCost, // Using totalCost as totalValue
          totalCost: order.totalCost,
          remainingQuantity: order.remainingQuantity,
        },
        orderItems: order.items.map((item) => ({
          ...item,
          deliveredQuantity: item.quantityRequested - item.quantityRemaining,
        })),
        deliveryItems: [...validItems, ...invalidItems],
        validItems,
        invalidItems,
        totalItems: data.length,
        validItemsCount: validItems.length,
        invalidItemsCount: invalidItems.length,
        hasErrors: errors.length > 0,
        hasQuantityErrors: invalidItems.some((item) => item.isQuantityExceeded),
        totalDeliveryQuantity,
        totalDeliveryValue,
        errors,
        summary: {
          canProceed:
            invalidItems.filter((item) => item.isQuantityExceeded).length === 0,
          quantityErrorsCount: invalidItems.filter(
            (item) => item.isQuantityExceeded,
          ).length,
          validationErrorsCount: invalidItems.filter(
            (item) => item.hasValidationError,
          ).length,
        },
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to process Excel file: ' + error.message,
      );
    }
  }

  async importFromExcel(
    file: Express.Multer.File,
    excelImportDto: ExcelImportDeliveryDto,
    user: User,
  ): Promise<any> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Verify order exists and get its items
    const order = await this.orderRepository.findOne({
      where: {
        id: excelImportDto.orderId,
        isDeleted: false
      },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
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

      // Process each row and match with order items
      data.forEach((row: any, index: number) => {
        try {
          const deliveryItem = this.validateAndMatchExcelRow(
            row,
            index + 2,
            order.items,
          );
          validItems.push(deliveryItem);
        } catch (error) {
          const rowNumber = index + 2;
          errors.push(`Row ${rowNumber}: ${error.message}`);
          // console.error(
          //   `Excel validation error at row ${rowNumber}:`,
          //   error.message,
          //   'Row data:',
          //   row,
          // );
        }
      });

      if (validItems.length === 0) {
        throw new BadRequestException(
          'No valid delivery items found in Excel file',
        );
      }

      // Create delivery with valid items
      const createDeliveryDto: CreateDeliveryDto = {
        orderId: excelImportDto.orderId,
        deliveryDate: excelImportDto.deliveryDate,
        status: excelImportDto.status || DeliveryStatus.DELIVERED,
        items: validItems,
      };

      const delivery = await this.create(createDeliveryDto, user);

      // Calculate total revenue
      const totalRevenue = validItems.reduce(
        (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
        0,
      );

      return {
        deliveryId: delivery.id,
        orderId: order.orderId,
        totalItems: data.length,
        itemsProcessed: validItems.length,
        itemsSkipped: data.length - validItems.length,
        totalRevenue,
        errors,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to process Excel file: ' + error.message,
      );
    }
  }

  async saveDeliveryFromItems(
    deliveryItems: DeliveryItemData[],
    orderId: string,
    deliveryDate: Date,
    user: User,
  ): Promise<Delivery> {
    // Verify order exists and get its items
    const order = await this.orderRepository.findOne({
      where: { id: orderId, isDeleted: false },
      relations: ['items'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Validate all delivery items against current order state
    const errors: string[] = [];
    const validItems: any[] = [];

    for (const deliveryItem of deliveryItems) {
      // Check if deliveryItem has required fields
      if (!deliveryItem.asin) {
        errors.push(
          `Delivery item missing ASIN field: ${JSON.stringify(deliveryItem)}`,
        );
        continue;
      }

      // Enhanced matching: try by ASIN first, then by ASIN + model number if available
      let orderItem = order.items.find(
        (item) => item.asin === deliveryItem.asin,
      );

      // If we have model number, do more precise matching
      if (!orderItem && deliveryItem.modelNumber) {
        orderItem = order.items.find(
          (item) =>
            item.asin === deliveryItem.asin &&
            item.modelNumber === deliveryItem.modelNumber,
        );
      }

      // If we have orderItemId, use that for direct matching
      if (!orderItem && deliveryItem.orderItemId) {
        orderItem = order.items.find(
          (item) => item.id === deliveryItem.orderItemId,
        );
      }

      if (!orderItem) {
        errors.push(`ASIN ${deliveryItem.asin} not found in order`);
        continue;
      }

      const remainingQuantity = orderItem.quantityRemaining;

      if (deliveryItem.deliveredQuantity > remainingQuantity) {
        errors.push(
          `Delivery quantity (${deliveryItem.deliveredQuantity}) exceeds remaining quantity (${remainingQuantity}) for ASIN ${deliveryItem.asin}`,
        );
        continue;
      }

      // Store the complete delivery item with order item reference
      validItems.push({
        asin: deliveryItem.asin,
        brandName: deliveryItem.brandName || orderItem.brandName,
        modelNumber: deliveryItem.modelNumber || orderItem.modelNumber,
        title: deliveryItem.title || orderItem.title,
        deliveredQuantity: deliveryItem.deliveredQuantity,
        unitPrice: deliveryItem.unitPrice,
        orderItemId: orderItem.id,
        remainingQuantity: remainingQuantity,
      });
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Validation errors: ${errors.join(', ')}`);
    }

    if (validItems.length === 0) {
      throw new BadRequestException('No valid delivery items to save');
    }

    // Create delivery with valid items
    const createDeliveryDto: CreateDeliveryDto = {
      orderId,
      deliveryDate: deliveryDate.toISOString().split('T')[0], // Convert Date to string
      status: DeliveryStatus.DELIVERED,
      items: validItems,
    };

    // console.log('createDeliveryDto', createDeliveryDto);
    const delivery = await this.create(createDeliveryDto, user);

    // Calculate total revenue
    const totalRevenue = validItems.reduce(
      (sum, item) => sum + item.deliveredQuantity * item.unitPrice,
      0,
    );

    return delivery;
  }

  private validateStatusTransition(
    currentStatus: DeliveryStatus,
    newStatus: DeliveryStatus,
  ): void {
    const validTransitions: Record<DeliveryStatus, DeliveryStatus[]> = {
      [DeliveryStatus.PENDING]: [
        DeliveryStatus.IN_TRANSIT,
        DeliveryStatus.DELIVERED,
        DeliveryStatus.CANCELLED,
      ],
      [DeliveryStatus.IN_TRANSIT]: [
        DeliveryStatus.DELIVERED,
        DeliveryStatus.CANCELLED,
      ],
      [DeliveryStatus.DELIVERED]: [], // Final state - no transitions allowed
      [DeliveryStatus.CANCELLED]: [], // Final state - no transitions allowed
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }

  private validateAndMatchExcelRow(
    row: any,
    rowNumber: number,
    orderItems: OrderItem[],
  ): any {
    const requiredFields = [
      'ASIN',
      'Brand Name',
      'Model Number',
      'Title',
      'Delivered Quantity',
      'Unit Price',
    ];

    // Check required fields
    for (const field of requiredFields) {
      if (!row[field] && row[field] !== 0) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Extract and validate data
    const asin = String(row['ASIN']).trim();
    const brandName = String(row['Brand Name']).trim();
    const modelNumber = String(row['Model Number']).trim();
    const title = String(row['Title']).trim();
    const deliveredQuantity = Number(row['Delivered Quantity']);
    const unitPrice = Number(row['Unit Price']);

    // Validate model number (13 digits)
    if (!/^\d{13}$/.test(modelNumber)) {
      throw new Error(
        `Model number "${modelNumber}" must be exactly 13 digits (numbers only)`,
      );
    }

    // Validate delivered quantity
    if (!Number.isInteger(deliveredQuantity) || deliveredQuantity <= 0) {
      throw new Error('Delivered quantity must be a positive integer');
    }

    // Validate unit price
    if (isNaN(unitPrice) || unitPrice < 0) {
      throw new Error('Unit price must be a valid positive number');
    }

    // Find matching order item by ASIN and model number
    const matchingOrderItem = orderItems.find(
      (item) => item.asin === asin && item.modelNumber === modelNumber,
    );

    if (!matchingOrderItem) {
      throw new Error(
        `No matching order item found for ASIN: ${asin}, Model: ${modelNumber}`,
      );
    }

    // Validate that delivered quantity doesn't exceed remaining quantity
    if (deliveredQuantity > matchingOrderItem.quantityRemaining) {
      throw new Error(
        `Delivered quantity (${deliveredQuantity}) exceeds remaining quantity (${matchingOrderItem.quantityRemaining}) for item ${asin}`,
      );
    }

    // Validate that brand name and title match (optional warning, but allow)
    if (matchingOrderItem.brandName !== brandName) {
      // console.warn(
      //   `Brand name mismatch for ${asin}: Excel="${brandName}", Order="${matchingOrderItem.brandName}"`,
      // );
    }

    return {
      orderItemId: matchingOrderItem.id,
      deliveredQuantity,
      unitPrice,
    };
  }

  private async validateDeliveryItems(
    deliveryItems: any[],
    orderItems: OrderItem[],
  ): Promise<void> {
    for (const deliveryItem of deliveryItems) {
      const orderItem = orderItems.find(
        (item) => item.id === deliveryItem.orderItemId,
      );

      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${deliveryItem.orderItemId} not found`,
        );
      }

      // Get fresh order item data to ensure we have current quantityRemaining
      const freshOrderItem = await this.orderItemRepository.findOne({
        where: { id: deliveryItem.orderItemId },
      });

      if (!freshOrderItem) {
        throw new BadRequestException(
          `Order item ${deliveryItem.orderItemId} not found`,
        );
      }

      // Check if delivery quantity exceeds remaining quantity
      if (deliveryItem.deliveredQuantity > freshOrderItem.quantityRemaining) {
        throw new BadRequestException(
          `Delivery quantity (${deliveryItem.deliveredQuantity}) exceeds remaining quantity (${freshOrderItem.quantityRemaining}) for item ${freshOrderItem.asin}`,
        );
      }

      if (deliveryItem.deliveredQuantity <= 0) {
        throw new BadRequestException('Delivery quantity must be positive');
      }
    }
  }

  /**
   * Recalculate and verify quantity consistency for an order
   * This method can be used to fix any inconsistencies in quantity_remaining
   */
  async recalculateOrderQuantities(orderId: string): Promise<{
    success: boolean;
    message: string;
    corrections: Array<{
      orderItemId: string;
      asin: string;
      oldQuantityRemaining: number;
      newQuantityRemaining: number;
      totalDelivered: number;
    }>;
  }> {
    const corrections: Array<{
      orderItemId: string;
      asin: string;
      oldQuantityRemaining: number;
      newQuantityRemaining: number;
      totalDelivered: number;
    }> = [];

    // Use transaction to ensure consistency
    await this.dataSource.transaction(async (manager) => {
      // Get all order items for this order (only if order is not deleted)
      const orderItems = await manager.find(OrderItem, {
        where: {
          order: {
            id: orderId,
            isDeleted: false
          }
        },
        relations: ['deliveryItems', 'deliveryItems.delivery', 'order'],
      });

      for (const orderItem of orderItems) {
        // Calculate total delivered quantity from all delivery items
        const totalDelivered = orderItem.deliveryItems.reduce(
          (sum, deliveryItem) => sum + deliveryItem.deliveredQuantity,
          0,
        );

        // Calculate what the remaining quantity should be
        const correctQuantityRemaining = orderItem.quantityRequested - totalDelivered;

        // Check if there's a discrepancy
        if (orderItem.quantityRemaining !== correctQuantityRemaining) {
          corrections.push({
            orderItemId: orderItem.id,
            asin: orderItem.asin,
            oldQuantityRemaining: orderItem.quantityRemaining,
            newQuantityRemaining: correctQuantityRemaining,
            totalDelivered,
          });

          // Set trigger context to allow direct update
          await manager.query('SET @TRIGGER_CONTEXT = ?', ['RECALCULATION']);

          // Update the quantity_remaining
          await manager.update(OrderItem, orderItem.id, {
            quantityRemaining: correctQuantityRemaining,
          });

          // Clear trigger context
          await manager.query('SET @TRIGGER_CONTEXT = NULL');
        }
      }
    });

    return {
      success: true,
      message: corrections.length > 0
        ? `Fixed ${corrections.length} quantity discrepancies`
        : 'All quantities are consistent',
      corrections,
    };
  }

  /**
   * Get quantity audit log for debugging
   */
  async getQuantityAuditLog(orderItemId?: string, limit: number = 100): Promise<any[]> {
    let query = `
      SELECT * FROM quantity_audit_log
      ${orderItemId ? 'WHERE order_item_id = ?' : ''}
      ORDER BY created_at DESC
      LIMIT ?
    `;

    const params = orderItemId ? [orderItemId, limit] : [limit];

    return await this.dataSource.query(query, params);
  }

  /**
   * Generate the next sequential delivery ID with concurrency handling
   * Format: DEL-XXXXXX where XXXXXX is a 6-digit zero-padded number
   */
  private async generateNextDeliveryId(): Promise<string> {
    // Use a transaction to ensure atomicity and handle concurrency
    return await this.dataSource.transaction(async (manager) => {
      // Get the highest existing delivery ID number
      const result = await manager.query(`
        SELECT delivery_id
        FROM deliveries
        WHERE delivery_id REGEXP '^DEL-[0-9]{6}$'
        ORDER BY CAST(SUBSTRING(delivery_id, 5) AS UNSIGNED) DESC
        LIMIT 1
      `);

      let nextNumber = 1;

      if (result.length > 0) {
        const lastDeliveryId = result[0].delivery_id;
        const lastNumber = parseInt(lastDeliveryId.substring(4), 10);
        nextNumber = lastNumber + 1;
      }

      // Format as DEL-XXXXXX with 6-digit zero padding
      const deliveryId = `DEL-${nextNumber.toString().padStart(6, '0')}`;

      // Verify uniqueness (additional safety check)
      const existingCount = await manager.count(Delivery, {
        where: { deliveryId },
      });

      if (existingCount > 0) {
        // If somehow the ID already exists, recursively try the next one
        // This handles edge cases in high-concurrency scenarios
        throw new Error(`Delivery ID ${deliveryId} already exists. Retrying...`);
      }

      return deliveryId;
    });
  }

  /**
   * Generate delivery ID with retry logic to handle high concurrency scenarios
   */
  private async generateNextDeliveryIdWithRetry(maxRetries: number = 5): Promise<string> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateNextDeliveryId();
      } catch (error) {
        if (attempt === maxRetries) {
          throw new Error(`Failed to generate unique delivery ID after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait a small random amount before retrying to reduce collision probability
        const delay = Math.random() * 100 + 50; // 50-150ms
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Unexpected error in delivery ID generation');
  }

  /**
   * Note: This method has been removed because database triggers now automatically
   * handle quantity updates when delivery items are created, updated, or deleted.
   * Manual quantity updates are no longer needed and would conflict with the
   * trigger-based system.
   */

  /**
   * Note: This method has been removed because database triggers now automatically
   * handle quantity restoration when delivery items are deleted. The DELETE trigger
   * automatically adds back the delivered quantity to the remaining quantity.
   * Manual quantity restoration is no longer needed.
   */

  /**
   * Recalculate and update the order's total remaining and delivered quantities
   */
  private async updateOrderTotalRemaining(
    manager: any,
    orderId: string,
  ): Promise<void> {
    // Get all order items for this order with fresh data
    const orderItems = await manager.find(OrderItem, {
      where: { order: { id: orderId } },
    });

    // Calculate total remaining quantity
    const totalRemaining = orderItems.reduce(
      (sum: number, item: OrderItem) => sum + item.quantityRemaining,
      0
    );

    // Calculate total delivered quantity by getting all delivery items for this order
    // Use a simpler approach: get all delivery items that belong to order items of this order
    const deliveryItemsResult = await manager.query(`
      SELECT COALESCE(SUM(di.delivered_quantity), 0) as totalDelivered
      FROM delivery_items di
      INNER JOIN order_items oi ON di.order_item_id = oi.id
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.id = ? AND o.is_deleted = 0
    `, [orderId]);

    const totalDelivered = parseInt(deliveryItemsResult[0]?.totalDelivered || '0', 10);

    // Update the order's total remaining and delivered quantities
    await manager.update(Order,
      { id: orderId },
      {
        remainingQuantity: totalRemaining,
        deliveredQuantity: totalDelivered
      }
    );
  }

  private createQueryBuilder(): SelectQueryBuilder<Delivery> {
    return this.deliveryRepository
      .createQueryBuilder('delivery')
      .leftJoinAndSelect('delivery.order', 'order')
      .leftJoinAndSelect('delivery.createdBy', 'createdBy')
      .leftJoinAndSelect('delivery.deliveryItems', 'deliveryItems')
      .leftJoinAndSelect('deliveryItems.orderItem', 'orderItem')
      .where('order.is_deleted = :isDeleted', { isDeleted: false })
      .select([
        'delivery.id',
        'delivery.deliveryId',
        'delivery.deliveryDate',
        'delivery.status',
        'delivery.createdAt',
        'delivery.updatedAt',
        'order.id',
        'order.orderId',
        'createdBy.id',
        'createdBy.name',
        'createdBy.email',
        'deliveryItems.id',
        'deliveryItems.deliveredQuantity',
        'deliveryItems.unitPrice',
        'deliveryItems.totalAmount',
        'deliveryItems.deliveryDate',
        'orderItem.id',
        'orderItem.asin',
        'orderItem.brandName',
        'orderItem.modelNumber',
        'orderItem.title',
      ]);
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Delivery>,
    query: GetDeliveriesDto,
  ): void {
    if (query.search) {
      queryBuilder.andWhere('order.orderId LIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('delivery.status = :status', {
        status: query.status,
      });
    }

    if (query.startDate) {
      queryBuilder.andWhere('delivery.deliveryDate >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('delivery.deliveryDate <= :endDate', {
        endDate: query.endDate,
      });
    }
  }
}

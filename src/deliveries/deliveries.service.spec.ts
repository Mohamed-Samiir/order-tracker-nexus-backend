import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { DeliveryItem } from './entities/delivery-item.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

describe('DeliveriesService', () => {
  let service: DeliveriesService;
  let deliveryRepository: Repository<Delivery>;
  let deliveryItemRepository: Repository<DeliveryItem>;
  let orderRepository: Repository<Order>;
  let orderItemRepository: Repository<OrderItem>;
  let dataSource: DataSource;

  const mockUser: User = {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    password: 'hashed-password',
    isDeleted: false,
    orders: [],
    deliveries: [],
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrder: Order = {
    id: 'order-1',
    orderId: 'ORD-2024-000001',
    status: OrderStatus.PENDING,
    totalItems: 2,
    totalCost: 599.98,
    deliveredQuantity: 0,
    remainingQuantity: 80,
    fileName: null,
    isDeleted: false,
    createdBy: mockUser,
    items: [],
    deliveries: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockOrderItem: OrderItem = {
    id: 'order-item-1',
    asin: 'B08N5WRWNW',
    brandName: 'Sony',
    modelNumber: '1234567890123',
    title: 'Sony WH-1000XM4 Headphones',
    requestingDate: new Date('2024-01-20'),
    quantityRequested: 50,
    quantityRemaining: 50,
    unitCost: 299.99,
    totalCost: 14999.5,
    order: mockOrder,
    deliveryItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    setInitialQuantityRemaining: jest.fn(),
  };

  const mockDelivery: Delivery = {
    id: 'delivery-1',
    deliveryId: 'DEL-000001',
    deliveryDate: new Date('2024-01-25'),
    status: DeliveryStatus.DELIVERED,
    order: mockOrder,
    createdBy: mockUser,
    deliveryItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDeliveryItem: DeliveryItem = {
    id: 'delivery-item-1',
    deliveredQuantity: 25,
    unitPrice: 299.99,
    totalAmount: 7499.75,
    deliveryDate: new Date('2024-01-25'),
    delivery: mockDelivery,
    orderItem: mockOrderItem,
    createdAt: new Date(),
    updatedAt: new Date(),
    calculateTotalAmount: jest.fn(),
    setDeliveryDate: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveriesService,
        {
          provide: getRepositoryToken(Delivery),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(DeliveryItem),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DeliveriesService>(DeliveriesService);
    deliveryRepository = module.get<Repository<Delivery>>(
      getRepositoryToken(Delivery),
    );
    deliveryItemRepository = module.get<Repository<DeliveryItem>>(
      getRepositoryToken(DeliveryItem),
    );
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    orderItemRepository = module.get<Repository<OrderItem>>(
      getRepositoryToken(OrderItem),
    );
    dataSource = module.get<DataSource>(DataSource);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDeliveryDto: CreateDeliveryDto = {
      orderId: 'order-1',
      deliveryDate: '2024-01-25',
      status: DeliveryStatus.DELIVERED,
      items: [
        {
          orderItemId: 'order-item-1',
          deliveredQuantity: 25,
          unitPrice: 299.99,
        },
      ],
    };

    it('should create a delivery successfully', async () => {
      const mockManager = {
        create: jest.fn().mockReturnValue(mockDelivery),
        save: jest.fn().mockResolvedValue(mockDelivery),
        findOne: jest.fn().mockResolvedValue(mockDelivery),
      };

      jest.spyOn(orderRepository, 'findOne').mockResolvedValue({
        ...mockOrder,
        items: [mockOrderItem],
      });
      jest
        .spyOn(orderItemRepository, 'findOne')
        .mockResolvedValue(mockOrderItem);
      jest
        .spyOn(dataSource, 'transaction')
        .mockImplementation(async (callback: any) => {
          return callback(mockManager);
        });

      const result = await service.create(createDeliveryDto, mockUser);

      expect(result).toEqual(mockDelivery);
      expect(orderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        relations: ['items'],
      });
    });

    it('should throw NotFoundException when order not found', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      await expect(service.create(createDeliveryDto, mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException when delivery quantity exceeds remaining', async () => {
      const invalidDto = {
        ...createDeliveryDto,
        items: [
          {
            orderItemId: 'order-item-1',
            deliveredQuantity: 100, // Exceeds remaining quantity of 50
            unitPrice: 299.99,
          },
        ],
      };

      jest.spyOn(orderRepository, 'findOne').mockResolvedValue({
        ...mockOrder,
        items: [mockOrderItem],
      });
      jest
        .spyOn(orderItemRepository, 'findOne')
        .mockResolvedValue(mockOrderItem);

      await expect(service.create(invalidDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateStatusTransition', () => {
    it('should allow valid status transitions', () => {
      expect(() => {
        service['validateStatusTransition'](
          DeliveryStatus.PENDING,
          DeliveryStatus.IN_TRANSIT,
        );
      }).not.toThrow();

      expect(() => {
        service['validateStatusTransition'](
          DeliveryStatus.IN_TRANSIT,
          DeliveryStatus.DELIVERED,
        );
      }).not.toThrow();
    });

    it('should throw BadRequestException for invalid status transitions', () => {
      expect(() => {
        service['validateStatusTransition'](
          DeliveryStatus.DELIVERED,
          DeliveryStatus.PENDING,
        );
      }).toThrow(BadRequestException);

      expect(() => {
        service['validateStatusTransition'](
          DeliveryStatus.CANCELLED,
          DeliveryStatus.DELIVERED,
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('getDeliveryRevenue', () => {
    it('should calculate delivery revenue correctly', async () => {
      const deliveryWithItems = {
        ...mockDelivery,
        deliveryItems: [mockDeliveryItem],
      };

      jest
        .spyOn(deliveryRepository, 'findOne')
        .mockResolvedValue(deliveryWithItems);

      const result = await service.getDeliveryRevenue('delivery-1');

      expect(result).toEqual({
        totalRevenue: 7499.75,
        itemCount: 1,
        totalQuantity: 25,
      });
    });

    it('should throw NotFoundException when delivery not found', async () => {
      jest.spyOn(deliveryRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getDeliveryRevenue('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('importFromExcel', () => {
    const mockFile = {
      buffer: Buffer.from('mock excel data'),
      originalname: 'test.xlsx',
      mimetype:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    } as Express.Multer.File;

    const excelImportDto = {
      orderId: 'order-1',
      deliveryDate: '2024-01-25',
      status: 'delivered' as any,
    };

    it('should throw BadRequestException when no file uploaded', async () => {
      await expect(
        service.importFromExcel(null as any, excelImportDto, mockUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when order not found', async () => {
      jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

      await expect(
        service.importFromExcel(mockFile, excelImportDto, mockUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should process Excel file successfully', async () => {
      // Mock XLSX.read and sheet_to_json
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        {
          ASIN: 'B08N5WRWNW',
          'Brand Name': 'Sony',
          'Model Number': '1234567890123',
          Title: 'Sony WH-1000XM4 Headphones',
          'Delivered Quantity': 25,
          'Unit Price': 299.99,
        },
      ];

      // Mock XLSX functions
      const XLSX = require('xlsx');
      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData);

      jest.spyOn(orderRepository, 'findOne').mockResolvedValue({
        ...mockOrder,
        items: [mockOrderItem],
      });

      jest.spyOn(service, 'create').mockResolvedValue(mockDelivery);

      const result = await service.importFromExcel(
        mockFile,
        excelImportDto,
        mockUser,
      );

      expect(result).toEqual({
        deliveryId: mockDelivery.id,
        orderId: mockOrder.orderId,
        totalItems: 1,
        itemsProcessed: 1,
        itemsSkipped: 0,
        totalRevenue: 7499.75,
        errors: [],
      });
    });
  });

  describe('Quantity Calculation and Validation', () => {
    describe('validateDeliveryItems', () => {
      it('should reject delivery when quantity exceeds remaining quantity', async () => {
        // Arrange
        const orderWithItems = {
          ...mockOrder,
          items: [{ ...mockOrderItem, quantityRemaining: 30 }],
        };

        const createDeliveryDto: CreateDeliveryDto = {
          orderId: 'order-1',
          deliveryDate: '2024-01-25',
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: 'order-item-1',
              deliveredQuantity: 50, // Exceeds remaining quantity of 30
              unitPrice: 10.00,
            },
          ],
        };

        jest.spyOn(orderRepository, 'findOne').mockResolvedValue(orderWithItems as any);
        jest.spyOn(orderItemRepository, 'findOne').mockResolvedValue({
          ...mockOrderItem,
          quantityRemaining: 30,
        } as any);

        // Act & Assert
        await expect(service.create(createDeliveryDto, mockUser)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should reject delivery with zero or negative quantity', async () => {
        // Arrange
        const orderWithItems = {
          ...mockOrder,
          items: [mockOrderItem],
        };

        const createDeliveryDto: CreateDeliveryDto = {
          orderId: 'order-1',
          deliveryDate: '2024-01-25',
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: 'order-item-1',
              deliveredQuantity: 0, // Invalid quantity
              unitPrice: 10.00,
            },
          ],
        };

        jest.spyOn(orderRepository, 'findOne').mockResolvedValue(orderWithItems as any);
        jest.spyOn(orderItemRepository, 'findOne').mockResolvedValue(mockOrderItem as any);

        // Act & Assert
        await expect(service.create(createDeliveryDto, mockUser)).rejects.toThrow(
          BadRequestException
        );
      });

      it('should allow delivery when quantity is within remaining limits', async () => {
        // Arrange
        const orderWithItems = {
          ...mockOrder,
          items: [{ ...mockOrderItem, quantityRemaining: 100 }],
        };

        const createDeliveryDto: CreateDeliveryDto = {
          orderId: 'order-1',
          deliveryDate: '2024-01-25',
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: 'order-item-1',
              deliveredQuantity: 50, // Within remaining quantity of 100
              unitPrice: 10.00,
            },
          ],
        };

        const mockDelivery = {
          id: 'delivery-1',
          deliveryDate: new Date('2024-01-25'),
          status: DeliveryStatus.DELIVERED,
          order: mockOrder,
          createdBy: mockUser,
          deliveryItems: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const mockDeliveryItem = {
          id: 'delivery-item-1',
          deliveredQuantity: 50,
          unitPrice: 10.00,
          totalAmount: 500.00,
          deliveryDate: new Date('2024-01-25'),
          delivery: mockDelivery,
          orderItem: mockOrderItem,
          createdAt: new Date(),
          updatedAt: new Date(),
          calculateTotalAmount: jest.fn(),
          setDeliveryDate: jest.fn(),
        };

        jest.spyOn(orderRepository, 'findOne').mockResolvedValue(orderWithItems as any);
        jest.spyOn(orderItemRepository, 'findOne').mockResolvedValue({
          ...mockOrderItem,
          quantityRemaining: 100,
        } as any);

        // Mock transaction
        const mockManager = {
          create: jest.fn()
            .mockReturnValueOnce(mockDelivery)
            .mockReturnValueOnce(mockDeliveryItem),
          save: jest.fn()
            .mockResolvedValueOnce(mockDelivery)
            .mockResolvedValueOnce([mockDeliveryItem]),
        };

        jest.spyOn(dataSource, 'transaction').mockImplementation(async (callback: any) => {
          return await callback(mockManager as any);
        });

        // Act
        const result = await service.create(createDeliveryDto, mockUser);

        // Assert
        expect(result).toBeDefined();
        expect(mockManager.create).toHaveBeenCalledTimes(2); // Delivery + DeliveryItem
        expect(mockManager.save).toHaveBeenCalledTimes(2);
      });
    });

    describe('recalculateOrderQuantities', () => {
      it('should recalculate quantities correctly when there are discrepancies', async () => {
        // Arrange
        const orderItemWithDiscrepancy = {
          ...mockOrderItem,
          quantityRequested: 100,
          quantityRemaining: 80, // Incorrect - should be 50 based on deliveries
          deliveryItems: [
            { deliveredQuantity: 30 },
            { deliveredQuantity: 20 },
          ], // Total delivered: 50
        };

        const mockManager = {
          find: jest.fn().mockResolvedValue([orderItemWithDiscrepancy]),
          update: jest.fn(),
          query: jest.fn(),
        };

        jest.spyOn(dataSource, 'transaction').mockImplementation(async (callback: any) => {
          return await callback(mockManager as any);
        });

        // Act
        const result = await service.recalculateOrderQuantities('order-1');

        // Assert
        expect(result.success).toBe(true);
        expect(result.corrections).toHaveLength(1);
        expect(result.corrections[0]).toEqual({
          orderItemId: 'order-item-1',
          asin: 'B123456789',
          oldQuantityRemaining: 80,
          newQuantityRemaining: 50, // 100 - 50 delivered
          totalDelivered: 50,
        });
        expect(mockManager.update).toHaveBeenCalledWith(
          OrderItem,
          'order-item-1',
          { quantityRemaining: 50 }
        );
      });

      it('should report no corrections when quantities are consistent', async () => {
        // Arrange
        const orderItemConsistent = {
          ...mockOrderItem,
          quantityRequested: 100,
          quantityRemaining: 50, // Correct based on deliveries
          deliveryItems: [
            { deliveredQuantity: 30 },
            { deliveredQuantity: 20 },
          ], // Total delivered: 50
        };

        const mockManager = {
          find: jest.fn().mockResolvedValue([orderItemConsistent]),
          update: jest.fn(),
          query: jest.fn(),
        };

        jest.spyOn(dataSource, 'transaction').mockImplementation(async (callback: any) => {
          return await callback(mockManager as any);
        });

        // Act
        const result = await service.recalculateOrderQuantities('order-1');

        // Assert
        expect(result.success).toBe(true);
        expect(result.corrections).toHaveLength(0);
        expect(result.message).toBe('All quantities are consistent');
        expect(mockManager.update).not.toHaveBeenCalled();
      });
    });

    describe('getQuantityAuditLog', () => {
      it('should retrieve quantity audit log for specific order item', async () => {
        // Arrange
        const mockAuditLog = [
          {
            id: 1,
            operation_type: 'INSERT',
            order_item_id: 'order-item-1',
            delivery_item_id: 'delivery-item-1',
            old_quantity: 100,
            new_quantity: 75,
            delivered_quantity: 25,
            created_at: new Date(),
          },
        ];

        jest.spyOn(dataSource, 'query').mockResolvedValue(mockAuditLog);

        // Act
        const result = await service.getQuantityAuditLog('order-item-1', 50);

        // Assert
        expect(result).toEqual(mockAuditLog);
        expect(dataSource.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM quantity_audit_log'),
          ['order-item-1', 50]
        );
      });

      it('should retrieve general audit log when no order item specified', async () => {
        // Arrange
        const mockAuditLog = [
          {
            id: 1,
            operation_type: 'INSERT',
            order_item_id: 'order-item-1',
            delivery_item_id: 'delivery-item-1',
            old_quantity: 100,
            new_quantity: 75,
            delivered_quantity: 25,
            created_at: new Date(),
          },
          {
            id: 2,
            operation_type: 'UPDATE',
            order_item_id: 'order-item-2',
            delivery_item_id: 'delivery-item-2',
            old_quantity: 50,
            new_quantity: 30,
            delivered_quantity: 20,
            created_at: new Date(),
          },
        ];

        jest.spyOn(dataSource, 'query').mockResolvedValue(mockAuditLog);

        // Act
        const result = await service.getQuantityAuditLog(undefined, 100);

        // Assert
        expect(result).toEqual(mockAuditLog);
        expect(dataSource.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM quantity_audit_log'),
          [100]
        );
      });
    });
  });

  describe('Soft-Deleted Order Filtering', () => {
    const mockOrderDeleted: Order = {
      ...mockOrder,
      id: 'deleted-order-1',
      orderId: 'DEL-001',
      isDeleted: true,
    };

    const mockDeliveryFromDeletedOrder: Delivery = {
      id: 'delivery-from-deleted-order',
      deliveryId: 'DEL-000999',
      deliveryDate: new Date('2024-01-25'),
      status: DeliveryStatus.DELIVERED,
      order: mockOrderDeleted,
      createdBy: mockUser,
      deliveryItems: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    describe('findAll', () => {
      it('should exclude deliveries from soft-deleted orders', async () => {
        // Arrange
        const mockQueryBuilder = {
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          skip: jest.fn().mockReturnThis(),
          take: jest.fn().mockReturnThis(),
          getManyAndCount: jest.fn().mockResolvedValue([[mockDelivery], 1]),
        };

        jest.spyOn(deliveryRepository, 'createQueryBuilder').mockReturnValue(mockQueryBuilder as any);

        // Act
        const result = await service.findAll({});

        // Assert
        expect(mockQueryBuilder.where).toHaveBeenCalledWith('order.isDeleted = :isDeleted', { isDeleted: false });
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe('delivery-1');
      });
    });

    describe('findOne', () => {
      it('should return 404 for delivery from soft-deleted order', async () => {
        // Arrange
        jest.spyOn(deliveryRepository, 'findOne').mockResolvedValue(null);

        // Act & Assert
        await expect(service.findOne('delivery-from-deleted-order')).rejects.toThrow(NotFoundException);

        expect(deliveryRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'delivery-from-deleted-order',
            order: { isDeleted: false }
          },
          relations: ['deliveryItems', 'deliveryItems.orderItem', 'order', 'createdBy'],
        });
      });

      it('should return delivery for non-deleted order', async () => {
        // Arrange
        jest.spyOn(deliveryRepository, 'findOne').mockResolvedValue(mockDelivery);

        // Act
        const result = await service.findOne('delivery-1');

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe('delivery-1');
        expect(deliveryRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'delivery-1',
            order: { isDeleted: false }
          },
          relations: ['deliveryItems', 'deliveryItems.orderItem', 'order', 'createdBy'],
        });
      });
    });

    describe('create', () => {
      it('should throw NotFoundException when trying to create delivery for soft-deleted order', async () => {
        // Arrange
        const createDeliveryDto: CreateDeliveryDto = {
          orderId: 'deleted-order-1',
          deliveryDate: '2024-01-25',
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: 'order-item-1',
              deliveredQuantity: 25,
              unitPrice: 10.00,
            },
          ],
        };

        jest.spyOn(orderRepository, 'findOne').mockResolvedValue(null);

        // Act & Assert
        await expect(service.create(createDeliveryDto, mockUser)).rejects.toThrow(NotFoundException);

        expect(orderRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'deleted-order-1',
            isDeleted: false
          },
          relations: ['items'],
        });
      });
    });

    describe('getDeliveryRevenue', () => {
      it('should throw NotFoundException for delivery from soft-deleted order', async () => {
        // Arrange
        jest.spyOn(deliveryRepository, 'findOne').mockResolvedValue(null);

        // Act & Assert
        await expect(service.getDeliveryRevenue('delivery-from-deleted-order')).rejects.toThrow(NotFoundException);

        expect(deliveryRepository.findOne).toHaveBeenCalledWith({
          where: {
            id: 'delivery-from-deleted-order',
            order: { isDeleted: false }
          },
          relations: ['deliveryItems', 'order'],
        });
      });
    });

    describe('getOrderDeliveryStats', () => {
      it('should return empty stats for soft-deleted order', async () => {
        // Arrange
        jest.spyOn(deliveryRepository, 'find').mockResolvedValue([]);

        // Act
        const result = await service.getOrderDeliveryStats('deleted-order-1');

        // Assert
        expect(result.totalDeliveries).toBe(0);
        expect(result.totalRevenue).toBe(0);
        expect(deliveryRepository.find).toHaveBeenCalledWith({
          where: {
            order: {
              id: 'deleted-order-1',
              isDeleted: false
            }
          },
          relations: ['deliveryItems', 'order'],
        });
      });
    });

    describe('recalculateOrderQuantities', () => {
      it('should not process soft-deleted orders', async () => {
        // Arrange
        const mockManager = {
          find: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
          query: jest.fn(),
        };

        jest.spyOn(dataSource, 'transaction').mockImplementation(async (callback: any) => {
          return await callback(mockManager as any);
        });

        // Act
        const result = await service.recalculateOrderQuantities('deleted-order-1');

        // Assert
        expect(result.corrections).toHaveLength(0);
        expect(result.message).toBe('All quantities are consistent');
        expect(mockManager.find).toHaveBeenCalledWith(OrderItem, {
          where: {
            order: {
              id: 'deleted-order-1',
              isDeleted: false
            }
          },
          relations: ['deliveryItems', 'order'],
        });
      });
    });
  });
});

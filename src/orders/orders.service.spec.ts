import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';

describe('OrdersService - Order ID Generation', () => {
  let service: OrdersService;
  let orderRepository: Repository<Order>;
  let orderItemRepository: Repository<OrderItem>;
  let deliveryRepository: Repository<Delivery>;

  const mockOrderRepository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockOrderItemRepository = {
    save: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const mockDeliveryRepository = {
    count: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    isDeleted: false,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    orders: [],
    deliveries: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: mockOrderItemRepository,
        },
        {
          provide: getRepositoryToken(Delivery),
          useValue: mockDeliveryRepository,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    orderRepository = module.get<Repository<Order>>(getRepositoryToken(Order));
    orderItemRepository = module.get<Repository<OrderItem>>(getRepositoryToken(OrderItem));
    deliveryRepository = module.get<Repository<Delivery>>(getRepositoryToken(Delivery));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateUniqueOrderId', () => {
    it('should generate a unique order ID when no existing orders', async () => {
      // Mock no existing orders
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockOrderRepository.findOne.mockResolvedValue(null);

      const orderId = await service['generateUniqueOrderId']();
      const currentYear = new Date().getFullYear();

      expect(orderId).toMatch(new RegExp(`^ORD-${currentYear}-\\d{6}$`));
      expect(orderId).toBe(`ORD-${currentYear}-000001`);
    });

    it('should generate next sequential order ID when existing orders found', async () => {
      const currentYear = new Date().getFullYear();
      const lastOrder = { orderId: `ORD-${currentYear}-000005` };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lastOrder),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockOrderRepository.findOne.mockResolvedValue(null);

      const orderId = await service['generateUniqueOrderId']();

      expect(orderId).toBe(`ORD-${currentYear}-000006`);
    });

    it('should retry when collision detected', async () => {
      const currentYear = new Date().getFullYear();
      const lastOrder = { orderId: `ORD-${currentYear}-000005` };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lastOrder),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // First call returns existing order (collision), second call returns null (unique)
      mockOrderRepository.findOne
        .mockResolvedValueOnce({ orderId: `ORD-${currentYear}-000006` })
        .mockResolvedValueOnce(null);

      const orderId = await service['generateUniqueOrderId']();

      // Should have generated a different ID due to collision
      expect(orderId).toMatch(new RegExp(`^ORD-${currentYear}-\\d{6}$`));
      expect(mockOrderRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const currentYear = new Date().getFullYear();
      const lastOrder = { orderId: `ORD-${currentYear}-000005` };

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(lastOrder),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Always return existing order (simulate persistent collision)
      mockOrderRepository.findOne.mockResolvedValue({ orderId: 'existing' });

      await expect(service['generateUniqueOrderId']()).rejects.toThrow(
        'Failed to generate unique order ID after 10 attempts'
      );
    });
  });

  describe('validateOrderIdUniqueness', () => {
    it('should return true for unique order ID', async () => {
      mockOrderRepository.findOne.mockResolvedValue(null);

      const isUnique = await service['validateOrderIdUniqueness']('ORD-2025-000001');

      expect(isUnique).toBe(true);
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { orderId: 'ORD-2025-000001' },
        withDeleted: true,
      });
    });

    it('should return false for existing order ID', async () => {
      mockOrderRepository.findOne.mockResolvedValue({ orderId: 'ORD-2025-000001' });

      const isUnique = await service['validateOrderIdUniqueness']('ORD-2025-000001');

      expect(isUnique).toBe(false);
    });

    it('should return false on database error for safety', async () => {
      mockOrderRepository.findOne.mockRejectedValue(new Error('Database error'));

      const isUnique = await service['validateOrderIdUniqueness']('ORD-2025-000001');

      expect(isUnique).toBe(false);
    });
  });

  describe('create with order ID validation', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashed',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      isDeleted: false,
      lastLogin: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      orders: [],
      deliveries: [],
    };

    it('should create order with generated unique ID', async () => {
      const createOrderDto = {
        items: [{
          asin: 'B123456789',
          brandName: 'Test Brand',
          modelNumber: '1234567890123',
          title: 'Test Product',
          requestingDate: '2025-01-01',
          quantityRequested: 5,
          unitCost: 10.00,
        }],
      };

      // Mock unique ID generation
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockOrderRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
      mockOrderRepository.findOne.mockResolvedValue(null);
      mockOrderRepository.create.mockReturnValue({ id: 'order-1', orderId: 'ORD-2025-000001' });
      mockOrderRepository.save.mockResolvedValue({ id: 'order-1', orderId: 'ORD-2025-000001' });
      mockOrderItemRepository.create.mockReturnValue({});
      mockOrderItemRepository.save.mockResolvedValue([]);

      // Mock findOne for returning the created order
      mockOrderRepository.findOne.mockResolvedValueOnce(null) // for uniqueness check
        .mockResolvedValueOnce({ // for final return
          id: 'order-1',
          orderId: 'ORD-2025-000001',
          items: [],
          deliveries: [],
          createdBy: mockUser,
        });

      const result = await service.create(createOrderDto, mockUser);

      expect(result.orderId).toMatch(/^ORD-\d{4}-\d{6}$/);
    });

    it('should throw ConflictException for duplicate provided order ID', async () => {
      const createOrderDto = {
        orderId: 'ORD-2025-000001',
        items: [{
          asin: 'B123456789',
          brandName: 'Test Brand',
          modelNumber: '1234567890123',
          title: 'Test Product',
          requestingDate: '2025-01-01',
          quantityRequested: 5,
          unitCost: 10.00,
        }],
      };

      // Mock existing order
      mockOrderRepository.findOne.mockResolvedValue({ orderId: 'ORD-2025-000001' });

      await expect(service.create(createOrderDto, mockUser)).rejects.toThrow(ConflictException);
    });
  });

  describe('Order Deletion with Delivery Validation', () => {
    const mockOrder: Order = {
      id: 'order-1',
      orderId: 'ORD-2025-000001',
      status: OrderStatus.PENDING,
      totalItems: 100,
      totalCost: 1000.00,
      deliveredQuantity: 0,
      remainingQuantity: 100,
      fileName: 'test.xlsx',
      isDeleted: false,
      createdBy: mockUser,
      items: [],
      deliveries: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // Reset all mocks before each test
      jest.clearAllMocks();
    });

    it('should successfully delete order when no deliveries exist', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDeliveryRepository.count.mockResolvedValue(0); // No deliveries
      mockOrderRepository.update.mockResolvedValue({ affected: 1 });

      // Act
      await service.remove('order-1');

      // Assert
      expect(mockOrderRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'order-1', isDeleted: false },
        relations: ['items', 'deliveries', 'createdBy'],
      });
      expect(mockDeliveryRepository.count).toHaveBeenCalledWith({
        where: { order: { id: 'order-1' } },
      });
      expect(mockOrderRepository.update).toHaveBeenCalledWith('order-1', { isDeleted: true });
    });

    it('should throw BadRequestException when order has deliveries', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDeliveryRepository.count.mockResolvedValue(2); // Has deliveries

      // Act & Assert
      await expect(service.remove('order-1')).rejects.toThrow(BadRequestException);
      await expect(service.remove('order-1')).rejects.toThrow(
        'Cannot delete order that has associated deliveries. Please delete all deliveries first.'
      );

      // Verify that update was not called
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order does not exist', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.remove('non-existent-order')).rejects.toThrow(NotFoundException);

      // Verify that delivery count check was not performed
      expect(mockDeliveryRepository.count).not.toHaveBeenCalled();
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });

    it('should check deliveries for the correct order ID', async () => {
      // Arrange
      const orderId = 'specific-order-123';
      const orderWithSpecificId = { ...mockOrder, id: orderId };

      mockOrderRepository.findOne.mockResolvedValue(orderWithSpecificId);
      mockDeliveryRepository.count.mockResolvedValue(1); // Has deliveries

      // Act & Assert
      await expect(service.remove(orderId)).rejects.toThrow(BadRequestException);

      // Verify that the delivery count was checked for the correct order
      expect(mockDeliveryRepository.count).toHaveBeenCalledWith({
        where: { order: { id: orderId } },
      });
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      mockOrderRepository.findOne.mockResolvedValue(mockOrder);
      mockDeliveryRepository.count.mockRejectedValue(new Error('Database connection error'));

      // Act & Assert
      await expect(service.remove('order-1')).rejects.toThrow('Database connection error');

      // Verify that update was not called due to the error
      expect(mockOrderRepository.update).not.toHaveBeenCalled();
    });
  });
});

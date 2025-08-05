import { Test, TestingModule } from '@nestjs/testing';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { Delivery, DeliveryStatus } from './entities/delivery.entity';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { GetDeliveriesDto } from './dto/get-deliveries.dto';

describe('DeliveriesController', () => {
  let controller: DeliveriesController;
  let service: DeliveriesService;

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

  const mockDelivery: Delivery = {
    id: 'delivery-1',
    deliveryId: 'DEL-000001',
    deliveryDate: new Date('2024-01-25'),
    status: DeliveryStatus.DELIVERED,
    order: {
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
    },
    createdBy: mockUser,
    deliveryItems: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaginatedResponse = {
    data: [mockDelivery],
    total: 1,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  const mockDeliveriesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getDeliveryRevenue: jest.fn(),
    getOrderDeliveryStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeliveriesController],
      providers: [
        {
          provide: DeliveriesService,
          useValue: mockDeliveriesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<DeliveriesController>(DeliveriesController);
    service = module.get<DeliveriesService>(DeliveriesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

    it('should create a delivery', async () => {
      mockDeliveriesService.create.mockResolvedValue(mockDelivery);

      const result = await controller.create(createDeliveryDto, mockUser);

      expect(result).toEqual({
        success: true,
        message: 'Delivery created successfully',
        data: mockDelivery,
      });
      expect(service.create).toHaveBeenCalledWith(createDeliveryDto, mockUser);
    });
  });

  describe('findAll', () => {
    it('should return paginated deliveries', async () => {
      const query: GetDeliveriesDto = {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      };

      mockDeliveriesService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(query);

      expect(result).toEqual({
        success: true,
        data: mockPaginatedResponse,
      });
      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return a delivery by id', async () => {
      mockDeliveriesService.findOne.mockResolvedValue(mockDelivery);

      const result = await controller.findOne('delivery-1');

      expect(result).toEqual({
        success: true,
        data: mockDelivery,
      });
      expect(service.findOne).toHaveBeenCalledWith('delivery-1');
    });
  });

  describe('update', () => {
    const updateDeliveryDto: UpdateDeliveryDto = {
      status: DeliveryStatus.IN_TRANSIT,
    };

    it('should update a delivery', async () => {
      const updatedDelivery = {
        ...mockDelivery,
        status: DeliveryStatus.IN_TRANSIT,
      };
      mockDeliveriesService.update.mockResolvedValue(updatedDelivery);

      const result = await controller.update('delivery-1', updateDeliveryDto);

      expect(result).toEqual({
        success: true,
        message: 'Delivery updated successfully',
        data: updatedDelivery,
      });
      expect(service.update).toHaveBeenCalledWith(
        'delivery-1',
        updateDeliveryDto,
      );
    });
  });

  describe('remove', () => {
    it('should delete a delivery', async () => {
      mockDeliveriesService.remove.mockResolvedValue(undefined);

      await controller.remove('delivery-1');

      expect(service.remove).toHaveBeenCalledWith('delivery-1');
    });
  });

  describe('getDeliveryRevenue', () => {
    it('should return delivery revenue statistics', async () => {
      const mockRevenue = {
        totalRevenue: 7499.75,
        itemCount: 1,
        totalQuantity: 25,
      };

      mockDeliveriesService.getDeliveryRevenue.mockResolvedValue(mockRevenue);

      const result = await controller.getDeliveryRevenue('delivery-1');

      expect(result).toEqual({
        success: true,
        data: mockRevenue,
      });
      expect(service.getDeliveryRevenue).toHaveBeenCalledWith('delivery-1');
    });
  });

  describe('getOrderDeliveryStats', () => {
    it('should return order delivery statistics', async () => {
      const mockStats = {
        totalDeliveries: 2,
        totalRevenue: 14999.5,
        totalQuantityDelivered: 50,
        deliveriesByStatus: {
          [DeliveryStatus.PENDING]: 0,
          [DeliveryStatus.IN_TRANSIT]: 1,
          [DeliveryStatus.DELIVERED]: 1,
          [DeliveryStatus.CANCELLED]: 0,
        },
      };

      mockDeliveriesService.getOrderDeliveryStats.mockResolvedValue(mockStats);

      const result = await controller.getOrderDeliveryStats('order-1');

      expect(result).toEqual({
        success: true,
        data: mockStats,
      });
      expect(service.getOrderDeliveryStats).toHaveBeenCalledWith('order-1');
    });
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import {
  Delivery,
  DeliveryStatus,
} from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';

describe('DeliveriesController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;
  let testUser: User;
  let testOrder: Order;
  let testOrderItem: OrderItem;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create test user
    testUser = await dataSource.getRepository(User).save({
      email: 'admin@test.com',
      password: '$2b$10$hashedpassword', // bcrypt hash for 'password123'
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Login to get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'password123',
      });

    authToken = loginResponse.body.data.accessToken;

    // Create test order
    testOrder = await dataSource.getRepository(Order).save({
      orderId: 'ORD-2024-TEST-001',
      status: OrderStatus.PENDING,
      totalItems: 1,
      totalCost: 299.99,
      deliveredQuantity: 0,
      remainingQuantity: 50,
      createdBy: testUser,
    });

    // Create test order item
    testOrderItem = await dataSource.getRepository(OrderItem).save({
      asin: 'B08N5WRWNW',
      brandName: 'Sony',
      modelNumber: '1234567890123',
      title: 'Sony WH-1000XM4 Headphones',
      requestingDate: new Date('2024-01-20'),
      quantityRequested: 50,
      quantityRemaining: 50,
      unitCost: 299.99,
      totalCost: 14999.5,
      order: testOrder,
    });
  });

  afterAll(async () => {
    // Clean up test data
    await dataSource.getRepository(DeliveryItem).delete({});
    await dataSource.getRepository(Delivery).delete({});
    await dataSource.getRepository(OrderItem).delete({});
    await dataSource.getRepository(Order).delete({});
    await dataSource.getRepository(User).delete({});

    await app.close();
  });

  describe('/deliveries (POST)', () => {
    it('should create a new delivery', async () => {
      const createDeliveryDto = {
        orderId: testOrder.id,
        deliveryDate: '2024-01-25',
        status: DeliveryStatus.DELIVERED,
        items: [
          {
            orderItemId: testOrderItem.id,
            deliveredQuantity: 25,
            unitPrice: 299.99,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createDeliveryDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Delivery created successfully');
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe(DeliveryStatus.DELIVERED);
    });

    it('should return 400 for invalid delivery data', async () => {
      const invalidDto = {
        orderId: testOrder.id,
        deliveryDate: '2024-01-25',
        items: [
          {
            orderItemId: testOrderItem.id,
            deliveredQuantity: 100, // Exceeds remaining quantity
            unitPrice: 299.99,
          },
        ],
      };

      await request(app.getHttpServer())
        .post('/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidDto)
        .expect(400);
    });

    it('should return 401 without authentication', async () => {
      const createDeliveryDto = {
        orderId: testOrder.id,
        deliveryDate: '2024-01-25',
        items: [],
      };

      await request(app.getHttpServer())
        .post('/deliveries')
        .send(createDeliveryDto)
        .expect(401);
    });
  });

  describe('/deliveries (GET)', () => {
    it('should return paginated deliveries', async () => {
      const response = await request(app.getHttpServer())
        .get('/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('page');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('totalPages');
      expect(Array.isArray(response.body.data.data)).toBe(true);
    });

    it('should filter deliveries by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/deliveries')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: DeliveryStatus.DELIVERED })
        .expect(200);

      expect(response.body.success).toBe(true);
      response.body.data.data.forEach((delivery: any) => {
        expect(delivery.status).toBe(DeliveryStatus.DELIVERED);
      });
    });
  });

  describe('/deliveries/:id (GET)', () => {
    let deliveryId: string;

    beforeAll(async () => {
      // Create a delivery for testing
      const delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date('2024-01-25'),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });
      deliveryId = delivery.id;
    });

    it('should return a delivery by id', async () => {
      const response = await request(app.getHttpServer())
        .get(`/deliveries/${deliveryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(deliveryId);
      expect(response.body.data).toHaveProperty('order');
      expect(response.body.data).toHaveProperty('createdBy');
    });

    it('should return 404 for non-existent delivery', async () => {
      await request(app.getHttpServer())
        .get('/deliveries/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/deliveries/:id/revenue (GET)', () => {
    let deliveryId: string;

    beforeAll(async () => {
      // Create a delivery with items for testing
      const delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date('2024-01-25'),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      await dataSource.getRepository(DeliveryItem).save({
        deliveredQuantity: 10,
        unitPrice: 299.99,
        totalAmount: 2999.9,
        delivery: delivery,
        orderItem: testOrderItem,
      });

      deliveryId = delivery.id;
    });

    it('should return delivery revenue statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/deliveries/${deliveryId}/revenue`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('itemCount');
      expect(response.body.data).toHaveProperty('totalQuantity');
      expect(response.body.data.totalRevenue).toBe(2999.9);
      expect(response.body.data.itemCount).toBe(1);
      expect(response.body.data.totalQuantity).toBe(10);
    });
  });

  describe('/deliveries/order/:orderId/stats (GET)', () => {
    it('should return order delivery statistics', async () => {
      const response = await request(app.getHttpServer())
        .get(`/deliveries/order/${testOrder.id}/stats`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalDeliveries');
      expect(response.body.data).toHaveProperty('totalRevenue');
      expect(response.body.data).toHaveProperty('totalQuantityDelivered');
      expect(response.body.data).toHaveProperty('deliveriesByStatus');
      expect(typeof response.body.data.totalDeliveries).toBe('number');
      expect(typeof response.body.data.totalRevenue).toBe('number');
      expect(typeof response.body.data.totalQuantityDelivered).toBe('number');
    });
  });
});

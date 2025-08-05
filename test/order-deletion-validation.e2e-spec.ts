import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { Delivery } from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';
import { DeliveryStatus } from '../src/deliveries/entities/delivery.entity';
import { JwtService } from '@nestjs/jwt';

describe('Order Deletion Validation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let testUser: User;
  let testOrderWithoutDeliveries: Order;
  let testOrderWithDeliveries: Order;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(DataSource);
    jwtService = app.get<JwtService>(JwtService);

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create test user (admin)
    testUser = await dataSource.getRepository(User).save({
      email: 'test-order-deletion@example.com',
      name: 'Test Admin User',
      password: 'hashedpassword',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Generate JWT token for authentication
    authToken = jwtService.sign({
      sub: testUser.id,
      email: testUser.email,
      role: testUser.role,
    });

    // Create test order without deliveries
    testOrderWithoutDeliveries = await dataSource.getRepository(Order).save({
      orderId: 'TEST-ORDER-NO-DELIVERIES',
      status: 'pending',
      totalItems: 50,
      totalCost: 500.00,
      remainingQuantity: 50,
      fileName: 'test-no-deliveries.xlsx',
      createdBy: testUser,
    });

    // Create order item for the order without deliveries
    await dataSource.getRepository(OrderItem).save({
      asin: 'B111111111',
      brandName: 'Test Brand',
      modelNumber: '1111111111111',
      title: 'Test Product No Deliveries',
      requestingDate: new Date(),
      quantityRequested: 50,
      quantityRemaining: 50,
      unitCost: 10.00,
      totalCost: 500.00,
      order: testOrderWithoutDeliveries,
    });

    // Create test order with deliveries
    testOrderWithDeliveries = await dataSource.getRepository(Order).save({
      orderId: 'TEST-ORDER-WITH-DELIVERIES',
      status: 'pending',
      totalItems: 100,
      totalCost: 1000.00,
      remainingQuantity: 75,
      fileName: 'test-with-deliveries.xlsx',
      createdBy: testUser,
    });

    // Create order item for the order with deliveries
    const orderItemWithDeliveries = await dataSource.getRepository(OrderItem).save({
      asin: 'B222222222',
      brandName: 'Test Brand',
      modelNumber: '2222222222222',
      title: 'Test Product With Deliveries',
      requestingDate: new Date(),
      quantityRequested: 100,
      quantityRemaining: 75,
      unitCost: 10.00,
      totalCost: 1000.00,
      order: testOrderWithDeliveries,
    });

    // Create delivery for the order
    const delivery = await dataSource.getRepository(Delivery).save({
      deliveryDate: new Date(),
      status: DeliveryStatus.DELIVERED,
      order: testOrderWithDeliveries,
      createdBy: testUser,
    });

    // Create delivery item
    await dataSource.getRepository(DeliveryItem).save({
      deliveredQuantity: 25,
      unitPrice: 10.00,
      totalAmount: 250.00,
      deliveryDate: new Date(),
      delivery: delivery,
      orderItem: orderItemWithDeliveries,
    });
  }

  async function cleanupTestData() {
    if (testOrderWithDeliveries) {
      // Clean up in correct order due to foreign key constraints
      await dataSource.query('DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM deliveries WHERE order_id = ?)', [testOrderWithDeliveries.id]);
      await dataSource.query('DELETE FROM deliveries WHERE order_id = ?', [testOrderWithDeliveries.id]);
      await dataSource.query('DELETE FROM order_items WHERE order_id = ?', [testOrderWithDeliveries.id]);
      await dataSource.query('DELETE FROM orders WHERE id = ?', [testOrderWithDeliveries.id]);
    }

    if (testOrderWithoutDeliveries) {
      await dataSource.query('DELETE FROM order_items WHERE order_id = ?', [testOrderWithoutDeliveries.id]);
      await dataSource.query('DELETE FROM orders WHERE id = ?', [testOrderWithoutDeliveries.id]);
    }

    if (testUser) {
      await dataSource.query('DELETE FROM users WHERE id = ?', [testUser.id]);
    }
  }

  describe('DELETE /orders/:id', () => {
    it('should successfully delete order without deliveries', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/orders/${testOrderWithoutDeliveries.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Verify the order was soft deleted
      const deletedOrder = await dataSource.getRepository(Order).findOne({
        where: { id: testOrderWithoutDeliveries.id },
        withDeleted: true,
      });

      expect(deletedOrder).toBeDefined();
      expect(deletedOrder.isDeleted).toBe(true);
    });

    it('should return 400 when trying to delete order with deliveries', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/orders/${testOrderWithDeliveries.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        message: 'Cannot delete order that has associated deliveries. Please delete all deliveries first.',
        error: 'Bad Request',
      });

      // Verify the order was NOT deleted
      const order = await dataSource.getRepository(Order).findOne({
        where: { id: testOrderWithDeliveries.id },
      });

      expect(order).toBeDefined();
      expect(order.isDeleted).toBe(false);
    });

    it('should return 404 when trying to delete non-existent order', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await request(app.getHttpServer())
        .delete(`/orders/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should return 403 when non-admin user tries to delete order', async () => {
      // Create a non-admin user
      const viewerUser = await dataSource.getRepository(User).save({
        email: 'viewer@example.com',
        name: 'Viewer User',
        password: 'hashedpassword',
        role: UserRole.VIEWER,
        status: UserStatus.ACTIVE,
      });

      const viewerToken = jwtService.sign({
        sub: viewerUser.id,
        email: viewerUser.email,
        role: viewerUser.role,
      });

      await request(app.getHttpServer())
        .delete(`/orders/${testOrderWithDeliveries.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      // Clean up viewer user
      await dataSource.query('DELETE FROM users WHERE id = ?', [viewerUser.id]);
    });

    it('should return 401 when no authentication token is provided', async () => {
      await request(app.getHttpServer())
        .delete(`/orders/${testOrderWithDeliveries.id}`)
        .expect(401);
    });
  });

  describe('Database Constraint Verification', () => {
    it('should prevent direct database deletion of order with deliveries', async () => {
      // Try to delete the order directly from database
      // This should fail due to foreign key constraint
      await expect(
        dataSource.query('DELETE FROM orders WHERE id = ?', [testOrderWithDeliveries.id])
      ).rejects.toThrow();

      // Verify the order still exists
      const order = await dataSource.getRepository(Order).findOne({
        where: { id: testOrderWithDeliveries.id },
      });
      expect(order).toBeDefined();
    });

    it('should allow deletion after removing deliveries', async () => {
      // Create a temporary order with delivery for this test
      const tempOrder = await dataSource.getRepository(Order).save({
        orderId: 'TEMP-ORDER-FOR-DELETION',
        status: 'pending',
        totalItems: 10,
        totalCost: 100.00,
        remainingQuantity: 10,
        fileName: 'temp.xlsx',
        createdBy: testUser,
      });

      const tempOrderItem = await dataSource.getRepository(OrderItem).save({
        asin: 'B333333333',
        brandName: 'Temp Brand',
        modelNumber: '3333333333333',
        title: 'Temp Product',
        requestingDate: new Date(),
        quantityRequested: 10,
        quantityRemaining: 10,
        unitCost: 10.00,
        totalCost: 100.00,
        order: tempOrder,
      });

      const tempDelivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: tempOrder,
        createdBy: testUser,
      });

      // First, deletion should fail
      await request(app.getHttpServer())
        .delete(`/orders/${tempOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      // Remove the delivery
      await dataSource.getRepository(Delivery).remove(tempDelivery);

      // Now deletion should succeed
      await request(app.getHttpServer())
        .delete(`/orders/${tempOrder.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(204);

      // Clean up remaining data
      await dataSource.query('DELETE FROM order_items WHERE id = ?', [tempOrderItem.id]);
      await dataSource.query('DELETE FROM orders WHERE id = ?', [tempOrder.id]);
    });
  });
});

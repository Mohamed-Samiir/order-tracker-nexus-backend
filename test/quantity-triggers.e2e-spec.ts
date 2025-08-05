import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { Delivery } from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';
import { DeliveryStatus } from '../src/deliveries/entities/delivery.entity';

describe('Quantity Calculation Triggers (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testUser: User;
  let testOrder: Order;
  let testOrderItem: OrderItem;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(DataSource);

    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await app.close();
  });

  beforeEach(async () => {
    // Reset order item quantity before each test
    await dataSource.query(
      'UPDATE order_items SET quantity_remaining = quantity_requested WHERE id = ?',
      [testOrderItem.id]
    );
  });

  async function setupTestData() {
    // Create test user
    testUser = await dataSource.getRepository(User).save({
      email: 'test-triggers@example.com',
      name: 'Test User',
      password: 'hashedpassword',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });

    // Create test order
    testOrder = await dataSource.getRepository(Order).save({
      orderId: 'TEST-TRIGGERS-001',
      status: 'pending',
      fileName: 'test-triggers.xlsx',
      createdBy: testUser,
    });

    // Create test order item
    testOrderItem = await dataSource.getRepository(OrderItem).save({
      asin: 'B123456789',
      brandName: 'Test Brand',
      modelNumber: '1234567890123',
      title: 'Test Product for Triggers',
      requestingDate: new Date(),
      quantityRequested: 100,
      quantityRemaining: 100,
      unitCost: 10.00,
      totalCost: 1000.00,
      order: testOrder,
    });
  }

  async function cleanupTestData() {
    if (testOrderItem) {
      await dataSource.query('DELETE FROM delivery_items WHERE order_item_id = ?', [testOrderItem.id]);
      await dataSource.query('DELETE FROM deliveries WHERE order_id = ?', [testOrder.id]);
      await dataSource.query('DELETE FROM order_items WHERE id = ?', [testOrderItem.id]);
    }
    if (testOrder) {
      await dataSource.query('DELETE FROM orders WHERE id = ?', [testOrder.id]);
    }
    if (testUser) {
      await dataSource.query('DELETE FROM users WHERE id = ?', [testUser.id]);
    }
    // Clean up audit log
    await dataSource.query('DELETE FROM quantity_audit_log WHERE order_item_id = ?', [testOrderItem.id]);
  }

  describe('INSERT Trigger Tests', () => {
    it('should automatically decrease quantity_remaining when delivery item is inserted', async () => {
      // Create delivery
      const delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      // Insert delivery item - trigger should fire
      await dataSource.getRepository(DeliveryItem).save({
        deliveredQuantity: 25,
        unitPrice: 10.00,
        totalAmount: 250.00,
        deliveryDate: new Date(),
        delivery: delivery,
        orderItem: testOrderItem,
      });

      // Check that quantity_remaining was updated
      const updatedOrderItem = await dataSource.getRepository(OrderItem).findOne({
        where: { id: testOrderItem.id },
      });

      expect(updatedOrderItem.quantityRemaining).toBe(75); // 100 - 25
    });

    it('should prevent insertion when delivery quantity exceeds remaining quantity', async () => {
      // Set remaining quantity to 20
      await dataSource.query(
        'SET @TRIGGER_CONTEXT = ?; UPDATE order_items SET quantity_remaining = ? WHERE id = ?; SET @TRIGGER_CONTEXT = NULL;',
        ['TEST_SETUP', 20, testOrderItem.id]
      );

      const delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      // Try to insert delivery item with quantity > remaining
      await expect(
        dataSource.getRepository(DeliveryItem).save({
          deliveredQuantity: 30, // Exceeds remaining quantity of 20
          unitPrice: 10.00,
          totalAmount: 300.00,
          deliveryDate: new Date(),
          delivery: delivery,
          orderItem: testOrderItem,
        })
      ).rejects.toThrow();
    });
  });

  describe('UPDATE Trigger Tests', () => {
    let delivery: Delivery;
    let deliveryItem: DeliveryItem;

    beforeEach(async () => {
      // Create delivery and delivery item for update tests
      delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      deliveryItem = await dataSource.getRepository(DeliveryItem).save({
        deliveredQuantity: 30,
        unitPrice: 10.00,
        totalAmount: 300.00,
        deliveryDate: new Date(),
        delivery: delivery,
        orderItem: testOrderItem,
      });
    });

    it('should adjust quantity_remaining when delivery quantity is updated', async () => {
      // Update delivery quantity from 30 to 40
      await dataSource.getRepository(DeliveryItem).update(deliveryItem.id, {
        deliveredQuantity: 40,
        totalAmount: 400.00,
      });

      // Check that quantity_remaining was adjusted
      const updatedOrderItem = await dataSource.getRepository(OrderItem).findOne({
        where: { id: testOrderItem.id },
      });

      expect(updatedOrderItem.quantityRemaining).toBe(60); // 100 - 40
    });

    it('should prevent update that would result in negative remaining quantity', async () => {
      // Try to update delivery quantity to exceed available quantity
      await expect(
        dataSource.getRepository(DeliveryItem).update(deliveryItem.id, {
          deliveredQuantity: 150, // Would result in negative remaining
          totalAmount: 1500.00,
        })
      ).rejects.toThrow();
    });
  });

  describe('DELETE Trigger Tests', () => {
    let delivery: Delivery;
    let deliveryItem: DeliveryItem;

    beforeEach(async () => {
      // Create delivery and delivery item for delete tests
      delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      deliveryItem = await dataSource.getRepository(DeliveryItem).save({
        deliveredQuantity: 40,
        unitPrice: 10.00,
        totalAmount: 400.00,
        deliveryDate: new Date(),
        delivery: delivery,
        orderItem: testOrderItem,
      });
    });

    it('should restore quantity_remaining when delivery item is deleted', async () => {
      // Verify initial state
      let orderItem = await dataSource.getRepository(OrderItem).findOne({
        where: { id: testOrderItem.id },
      });
      expect(orderItem.quantityRemaining).toBe(60); // 100 - 40

      // Delete delivery item - trigger should restore quantity
      await dataSource.getRepository(DeliveryItem).delete(deliveryItem.id);

      // Check that quantity_remaining was restored
      orderItem = await dataSource.getRepository(OrderItem).findOne({
        where: { id: testOrderItem.id },
      });
      expect(orderItem.quantityRemaining).toBe(100); // 60 + 40
    });
  });

  describe('Protection Trigger Tests', () => {
    it('should prevent direct updates to quantity_remaining', async () => {
      // Try to directly update quantity_remaining
      await expect(
        dataSource.query(
          'UPDATE order_items SET quantity_remaining = ? WHERE id = ?',
          [50, testOrderItem.id]
        )
      ).rejects.toThrow();
    });

    it('should allow updates during trigger context', async () => {
      // This should work because we set the trigger context
      await dataSource.query(
        'SET @TRIGGER_CONTEXT = ?; UPDATE order_items SET quantity_remaining = ? WHERE id = ?; SET @TRIGGER_CONTEXT = NULL;',
        ['TEST_UPDATE', 80, testOrderItem.id]
      );

      const updatedOrderItem = await dataSource.getRepository(OrderItem).findOne({
        where: { id: testOrderItem.id },
      });
      expect(updatedOrderItem.quantityRemaining).toBe(80);
    });
  });

  describe('Audit Log Tests', () => {
    it('should create audit log entries for quantity changes', async () => {
      // Create delivery and delivery item
      const delivery = await dataSource.getRepository(Delivery).save({
        deliveryDate: new Date(),
        status: DeliveryStatus.DELIVERED,
        order: testOrder,
        createdBy: testUser,
      });

      const deliveryItem = await dataSource.getRepository(DeliveryItem).save({
        deliveredQuantity: 35,
        unitPrice: 10.00,
        totalAmount: 350.00,
        deliveryDate: new Date(),
        delivery: delivery,
        orderItem: testOrderItem,
      });

      // Check audit log
      const auditEntries = await dataSource.query(
        'SELECT * FROM quantity_audit_log WHERE order_item_id = ? ORDER BY created_at DESC',
        [testOrderItem.id]
      );

      expect(auditEntries.length).toBeGreaterThan(0);
      expect(auditEntries[0].operation_type).toBe('INSERT');
      expect(auditEntries[0].old_quantity).toBe(100);
      expect(auditEntries[0].new_quantity).toBe(65);
      expect(auditEntries[0].delivered_quantity).toBe(35);
    });
  });
});

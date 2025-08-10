import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { Delivery, DeliveryStatus } from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class DeliveryTriggerTester {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '12345678',
      database: process.env.DB_NAME || 'order_tracker',
      entities: [join(__dirname, '..', 'src', '**', '*.entity{.ts,.js}')],
      synchronize: false,
      logging: true,
    });
  }

  async testDeliveryTriggerIntegration() {
    try {
      console.log('🔧 Testing delivery operations with database triggers...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Use transaction for all tests
      await this.dataSource.transaction(async (manager) => {
        // Test 1: Create test data
        console.log('🔍 Test 1: Creating test data...');

        // Create test user
        const testUser = manager.create(User, {
          email: 'test-delivery@example.com',
          name: 'Test Delivery User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);

        // Create test order
        const testOrder = manager.create(Order, {
          orderId: 'TEST-DELIVERY-001',
          status: OrderStatus.PROCESSING,
          totalItems: 2,
          totalCost: 200.00,
          createdBy: testUser,
        });
        await manager.save(testOrder);

        // Create test order items
        const orderItem1 = manager.create(OrderItem, {
          asin: 'TEST123456789',
          brandName: 'Test Brand',
          modelNumber: '1234567890123',
          title: 'Test Product 1',
          requestingDate: new Date(),
          quantityRequested: 10,
          quantityRemaining: 10, // Initial quantity
          unitCost: 50.00,
          totalCost: 500.00,
          order: testOrder,
        });

        const orderItem2 = manager.create(OrderItem, {
          asin: 'TEST987654321',
          brandName: 'Test Brand 2',
          modelNumber: '9876543210987',
          title: 'Test Product 2',
          requestingDate: new Date(),
          quantityRequested: 5,
          quantityRemaining: 5, // Initial quantity
          unitCost: 30.00,
          totalCost: 150.00,
          order: testOrder,
        });

        await manager.save([orderItem1, orderItem2]);
        console.log('✅ Test data created successfully');

        // Test 2: Create delivery with delivery items (should trigger automatic quantity updates)
        console.log('🔍 Test 2: Creating delivery with items...');

        const testDelivery = manager.create(Delivery, {
          deliveryId: 'DEL-TEST-001',
          deliveryDate: new Date(),
          status: DeliveryStatus.DELIVERED,
          order: testOrder,
          createdBy: testUser,
        });
        await manager.save(testDelivery);

        // Create delivery items (this should trigger automatic quantity updates)
        const deliveryItem1 = manager.create(DeliveryItem, {
          deliveredQuantity: 3,
          unitPrice: 50.00,
          totalAmount: 150.00,
          delivery: testDelivery,
          orderItem: orderItem1,
        });

        const deliveryItem2 = manager.create(DeliveryItem, {
          deliveredQuantity: 2,
          unitPrice: 30.00,
          totalAmount: 60.00,
          delivery: testDelivery,
          orderItem: orderItem2,
        });

        await manager.save([deliveryItem1, deliveryItem2]);
        console.log('✅ Delivery items created successfully');

        // Test 3: Verify automatic quantity updates
        console.log('🔍 Test 3: Verifying automatic quantity updates...');

        const updatedOrderItem1 = await manager.findOne(OrderItem, {
          where: { id: orderItem1.id }
        });
        const updatedOrderItem2 = await manager.findOne(OrderItem, {
          where: { id: orderItem2.id }
        });

        console.log('Order Item 1 - Original: 10, Delivered: 3, Remaining:', updatedOrderItem1?.quantityRemaining);
        console.log('Order Item 2 - Original: 5, Delivered: 2, Remaining:', updatedOrderItem2?.quantityRemaining);

        if (updatedOrderItem1?.quantityRemaining === 7 && updatedOrderItem2?.quantityRemaining === 3) {
          console.log('✅ Automatic quantity updates working correctly');
        } else {
          throw new Error('❌ Automatic quantity updates failed');
        }

        // Test 4: Update delivery item (should trigger automatic quantity adjustment)
        console.log('🔍 Test 4: Testing delivery item update...');

        // Update delivery item 1 to deliver 5 instead of 3 (difference: +2)
        await manager.update(DeliveryItem, deliveryItem1.id, {
          deliveredQuantity: 5,
          totalAmount: 250.00,
        });

        const reUpdatedOrderItem1 = await manager.findOne(OrderItem, {
          where: { id: orderItem1.id }
        });

        console.log('Order Item 1 - After update - Delivered: 5, Remaining:', reUpdatedOrderItem1?.quantityRemaining);

        if (reUpdatedOrderItem1?.quantityRemaining === 5) { // 10 - 5 = 5
          console.log('✅ Automatic quantity update on delivery item change working correctly');
        } else {
          throw new Error('❌ Automatic quantity update on delivery item change failed');
        }

        // Test 5: Delete delivery item (should restore quantity)
        console.log('🔍 Test 5: Testing delivery item deletion...');

        await manager.delete(DeliveryItem, deliveryItem2.id);

        const restoredOrderItem2 = await manager.findOne(OrderItem, {
          where: { id: orderItem2.id }
        });

        console.log('Order Item 2 - After deletion - Remaining:', restoredOrderItem2?.quantityRemaining);

        if (restoredOrderItem2?.quantityRemaining === 5) { // Restored to original 5
          console.log('✅ Automatic quantity restoration on delivery item deletion working correctly');
        } else {
          throw new Error('❌ Automatic quantity restoration on delivery item deletion failed');
        }

        // Test 6: Try direct quantity update (should be blocked by trigger)
        console.log('🔍 Test 6: Testing trigger protection against direct updates...');

        try {
          await manager.update(OrderItem, orderItem1.id, {
            quantityRemaining: 999, // This should be blocked
          });
          throw new Error('❌ Direct quantity update was not blocked by trigger');
        } catch (error: any) {
          if (error.message.includes('Direct updates to quantity_remaining are not allowed')) {
            console.log('✅ Trigger protection working correctly - direct updates blocked');
          } else {
            throw error;
          }
        }

        console.log('🎉 All delivery trigger integration tests passed!');

        // Cleanup test data
        console.log('🧹 Cleaning up test data...');
        await manager.delete(DeliveryItem, { delivery: { id: testDelivery.id } });
        await manager.delete(Delivery, testDelivery.id);
        await manager.delete(OrderItem, [orderItem1.id, orderItem2.id]);
        await manager.delete(Order, testOrder.id);
        await manager.delete(User, testUser.id);
        console.log('✅ Test data cleaned up');
      });

    } catch (error) {
      console.error('❌ Error during delivery trigger integration test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new DeliveryTriggerTester();
tester.testDeliveryTriggerIntegration()
  .then(() => {
    console.log('✅ Delivery trigger integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Delivery trigger integration test failed:', error);
    process.exit(1);
  });

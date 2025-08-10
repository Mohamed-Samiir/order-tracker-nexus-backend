import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { DeliveryStatus } from '../src/deliveries/entities/delivery.entity';
import { DeliveriesService } from '../src/deliveries/deliveries.service';
import { Repository } from 'typeorm';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class DeliveryServiceIntegrationTester {
  private dataSource: DataSource;
  private deliveriesService: DeliveriesService;

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

  async testDeliveryServiceIntegration() {
    try {
      console.log('🔧 Testing DeliveriesService with trigger integration...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Initialize service with repositories
      const deliveryRepository = this.dataSource.getRepository('Delivery');
      const orderRepository = this.dataSource.getRepository('Order');
      const orderItemRepository = this.dataSource.getRepository('OrderItem');
      const userRepository = this.dataSource.getRepository('User');

      this.deliveriesService = new DeliveriesService(
        deliveryRepository as any,
        orderRepository as any,
        orderItemRepository as any,
        userRepository as any,
        this.dataSource
      );

      // Create test data
      console.log('🔍 Test 1: Creating test data...');

      let testUser: User = {} as User;
      let testOrder: Order = {} as Order;
      let orderItem1: OrderItem = {} as OrderItem;
      let orderItem2: OrderItem = {} as OrderItem;

      await this.dataSource.transaction(async (manager) => {
        // Create test user
        testUser = manager.create(User, {
          email: 'test-service@example.com',
          name: 'Test Service User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);

        // Create test order
        testOrder = manager.create(Order, {
          orderId: 'TEST-SERVICE-001',
          status: OrderStatus.PROCESSING,
          totalItems: 2,
          totalCost: 300.00,
          createdBy: testUser,
        });
        await manager.save(testOrder);

        // Create test order items
        orderItem1 = manager.create(OrderItem, {
          asin: 'SVC123456789',
          brandName: 'Service Test Brand',
          modelNumber: '1111111111111',
          title: 'Service Test Product 1',
          requestingDate: new Date(),
          quantityRequested: 15,
          quantityRemaining: 15,
          unitCost: 60.00,
          totalCost: 900.00,
          order: testOrder,
        });

        orderItem2 = manager.create(OrderItem, {
          asin: 'SVC987654321',
          brandName: 'Service Test Brand 2',
          modelNumber: '2222222222222',
          title: 'Service Test Product 2',
          requestingDate: new Date(),
          quantityRequested: 8,
          quantityRemaining: 8,
          unitCost: 40.00,
          totalCost: 320.00,
          order: testOrder,
        });

        await manager.save([orderItem1, orderItem2]);
      });

      console.log('✅ Test data created successfully');

      // Test 2: Create delivery using service
      console.log('🔍 Test 2: Creating delivery using DeliveriesService...');

      const createDeliveryDto = {
        orderId: testOrder.id,
        deliveryDate: new Date().toISOString().split('T')[0],
        status: DeliveryStatus.DELIVERED,
        items: [
          {
            orderItemId: orderItem1.id,
            deliveredQuantity: 5,
            unitPrice: 60.00,
          },
          {
            orderItemId: orderItem2.id,
            deliveredQuantity: 3,
            unitPrice: 40.00,
          }
        ]
      };

      const createdDelivery = await this.deliveriesService.create(createDeliveryDto, testUser);
      console.log('✅ Delivery created successfully via service:', createdDelivery.id);

      // Test 3: Verify quantities were updated correctly
      console.log('🔍 Test 3: Verifying quantity updates...');

      const updatedOrderItem1 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem1.id }
      });
      const updatedOrderItem2 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem2.id }
      });

      console.log('Order Item 1 - Original: 15, Delivered: 5, Remaining:', updatedOrderItem1?.quantityRemaining);
      console.log('Order Item 2 - Original: 8, Delivered: 3, Remaining:', updatedOrderItem2?.quantityRemaining);

      if (updatedOrderItem1?.quantityRemaining === 10 && updatedOrderItem2?.quantityRemaining === 5) {
        console.log('✅ Service-based delivery creation working correctly');
      } else {
        throw new Error('❌ Service-based delivery creation failed');
      }

      // Test 4: Update delivery using service
      console.log('🔍 Test 4: Updating delivery using DeliveriesService...');

      const updateDeliveryDto = {
        deliveryDate: new Date().toISOString().split('T')[0],
        status: DeliveryStatus.DELIVERED,
        items: [
          {
            orderItemId: orderItem1.id,
            deliveredQuantity: 7, // Changed from 5 to 7 (+2)
            unitPrice: 60.00,
          },
          {
            orderItemId: orderItem2.id,
            deliveredQuantity: 2, // Changed from 3 to 2 (-1)
            unitPrice: 40.00,
          }
        ]
      };

      const updatedDelivery = await this.deliveriesService.update(createdDelivery.id, updateDeliveryDto);
      console.log('✅ Delivery updated successfully via service');

      // Test 5: Verify quantities after update
      console.log('🔍 Test 5: Verifying quantity updates after delivery update...');

      const reUpdatedOrderItem1 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem1.id }
      });
      const reUpdatedOrderItem2 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem2.id }
      });

      console.log('Order Item 1 - After update - Delivered: 7, Remaining:', reUpdatedOrderItem1?.quantityRemaining);
      console.log('Order Item 2 - After update - Delivered: 2, Remaining:', reUpdatedOrderItem2?.quantityRemaining);

      if (reUpdatedOrderItem1?.quantityRemaining === 8 && reUpdatedOrderItem2?.quantityRemaining === 6) {
        console.log('✅ Service-based delivery update working correctly');
      } else {
        throw new Error('❌ Service-based delivery update failed');
      }

      // Test 6: Delete delivery using service
      console.log('🔍 Test 6: Deleting delivery using DeliveriesService...');

      await this.deliveriesService.remove(createdDelivery.id);
      console.log('✅ Delivery deleted successfully via service');

      // Test 7: Verify quantities after deletion
      console.log('🔍 Test 7: Verifying quantity restoration after delivery deletion...');

      const restoredOrderItem1 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem1.id }
      });
      const restoredOrderItem2 = await this.dataSource.getRepository(OrderItem).findOne({
        where: { id: orderItem2.id }
      });

      console.log('Order Item 1 - After deletion - Remaining:', restoredOrderItem1?.quantityRemaining);
      console.log('Order Item 2 - After deletion - Remaining:', restoredOrderItem2?.quantityRemaining);

      if (restoredOrderItem1?.quantityRemaining === 15 && restoredOrderItem2?.quantityRemaining === 8) {
        console.log('✅ Service-based delivery deletion working correctly');
      } else {
        throw new Error('❌ Service-based delivery deletion failed');
      }

      console.log('🎉 All DeliveriesService integration tests passed!');

      // Cleanup
      console.log('🧹 Cleaning up test data...');
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(OrderItem, [orderItem1.id, orderItem2.id]);
        await manager.delete(Order, testOrder.id);
        await manager.delete(User, testUser.id);
      });
      console.log('✅ Test data cleaned up');

    } catch (error) {
      console.error('❌ Error during DeliveriesService integration test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new DeliveryServiceIntegrationTester();
tester.testDeliveryServiceIntegration()
  .then(() => {
    console.log('✅ DeliveriesService integration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ DeliveriesService integration test failed:', error);
    process.exit(1);
  });

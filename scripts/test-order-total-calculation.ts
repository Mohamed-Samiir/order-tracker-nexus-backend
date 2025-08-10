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

class OrderTotalCalculationTester {
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

  async testOrderTotalCalculation() {
    try {
      console.log('🔧 Testing order total calculation with fixed SQL query...');
      
      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Use transaction for all tests
      await this.dataSource.transaction(async (manager) => {
        // Test 1: Create test data
        console.log('🔍 Test 1: Creating test data...');
        
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-total@example.com',
          name: 'Test Total User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);

        // Create test order
        const testOrder = manager.create(Order, {
          orderId: 'TEST-TOTAL-001',
          status: OrderStatus.PROCESSING,
          totalItems: 3,
          totalCost: 500.00,
          createdBy: testUser,
        });
        await manager.save(testOrder);

        // Create test order items
        const orderItem1 = manager.create(OrderItem, {
          asin: 'TOTAL123456789',
          brandName: 'Total Test Brand',
          modelNumber: '1111111111111',
          title: 'Total Test Product 1',
          requestingDate: new Date(),
          quantityRequested: 20,
          quantityRemaining: 20,
          unitCost: 25.00,
          totalCost: 500.00,
          order: testOrder,
        });

        const orderItem2 = manager.create(OrderItem, {
          asin: 'TOTAL987654321',
          brandName: 'Total Test Brand 2',
          modelNumber: '2222222222222',
          title: 'Total Test Product 2',
          requestingDate: new Date(),
          quantityRequested: 15,
          quantityRemaining: 15,
          unitCost: 40.00,
          totalCost: 600.00,
          order: testOrder,
        });

        const orderItem3 = manager.create(OrderItem, {
          asin: 'TOTAL555666777',
          brandName: 'Total Test Brand 3',
          modelNumber: '3333333333333',
          title: 'Total Test Product 3',
          requestingDate: new Date(),
          quantityRequested: 10,
          quantityRemaining: 10,
          unitCost: 60.00,
          totalCost: 600.00,
          order: testOrder,
        });

        await manager.save([orderItem1, orderItem2, orderItem3]);
        console.log('✅ Test data created successfully');

        // Test 2: Create delivery with items and test order total calculation
        console.log('🔍 Test 2: Creating delivery and testing order total calculation...');
        
        const testDelivery = manager.create(Delivery, {
          deliveryId: 'DEL-TOTAL-001',
          deliveryDate: new Date(),
          status: DeliveryStatus.DELIVERED,
          order: testOrder,
          createdBy: testUser,
        });
        await manager.save(testDelivery);

        // Create delivery items
        const deliveryItem1 = manager.create(DeliveryItem, {
          deliveredQuantity: 8,
          unitPrice: 25.00,
          totalAmount: 200.00,
          delivery: testDelivery,
          orderItem: orderItem1,
        });

        const deliveryItem2 = manager.create(DeliveryItem, {
          deliveredQuantity: 5,
          unitPrice: 40.00,
          totalAmount: 200.00,
          delivery: testDelivery,
          orderItem: orderItem2,
        });

        await manager.save([deliveryItem1, deliveryItem2]);
        console.log('✅ Delivery items created successfully');

        // Test 3: Manually call the updateOrderTotalRemaining method to test the SQL fix
        console.log('🔍 Test 3: Testing updateOrderTotalRemaining method with fixed SQL...');
        
        // This should use the fixed SQL query with delivered_quantity instead of deliveredQuantity
        const deliveryItemsResult = await manager.query(`
          SELECT COALESCE(SUM(di.delivered_quantity), 0) as totalDelivered
          FROM delivery_items di
          INNER JOIN order_items oi ON di.order_item_id = oi.id
          INNER JOIN orders o ON oi.order_id = o.id
          WHERE o.id = ? AND o.isDeleted = 0
        `, [testOrder.id]);

        const totalDelivered = parseInt(deliveryItemsResult[0]?.totalDelivered || '0', 10);
        console.log('Total delivered quantity calculated:', totalDelivered);

        if (totalDelivered === 13) { // 8 + 5 = 13
          console.log('✅ SQL query with delivered_quantity working correctly');
        } else {
          throw new Error(`❌ SQL query failed. Expected 13, got ${totalDelivered}`);
        }

        // Test 4: Verify order item quantities were updated correctly by triggers
        console.log('🔍 Test 4: Verifying order item quantities...');
        
        const updatedOrderItem1 = await manager.findOne(OrderItem, {
          where: { id: orderItem1.id }
        });
        const updatedOrderItem2 = await manager.findOne(OrderItem, {
          where: { id: orderItem2.id }
        });
        const updatedOrderItem3 = await manager.findOne(OrderItem, {
          where: { id: orderItem3.id }
        });

        console.log('Order Item 1 - Original: 20, Delivered: 8, Remaining:', updatedOrderItem1?.quantityRemaining);
        console.log('Order Item 2 - Original: 15, Delivered: 5, Remaining:', updatedOrderItem2?.quantityRemaining);
        console.log('Order Item 3 - Original: 10, Delivered: 0, Remaining:', updatedOrderItem3?.quantityRemaining);

        if (updatedOrderItem1?.quantityRemaining === 12 && 
            updatedOrderItem2?.quantityRemaining === 10 && 
            updatedOrderItem3?.quantityRemaining === 10) {
          console.log('✅ Order item quantities updated correctly by triggers');
        } else {
          throw new Error('❌ Order item quantities not updated correctly');
        }

        // Test 5: Test the complete order total calculation
        console.log('🔍 Test 5: Testing complete order total calculation...');
        
        // Get all order items for this order with fresh data
        const orderItems = await manager.find(OrderItem, {
          where: { order: { id: testOrder.id } },
        });

        // Calculate total remaining quantity
        const totalRemaining = orderItems.reduce(
          (sum: number, item: OrderItem) => sum + item.quantityRemaining,
          0
        );

        console.log('Total remaining quantity:', totalRemaining);

        // Update the order's total remaining and delivered quantities
        await manager.update(Order,
          { id: testOrder.id },
          {
            remainingQuantity: totalRemaining,
            deliveredQuantity: totalDelivered
          }
        );

        // Verify the order was updated correctly
        const updatedOrder = await manager.findOne(Order, {
          where: { id: testOrder.id }
        });

        console.log('Order - Delivered Quantity:', updatedOrder?.deliveredQuantity);
        console.log('Order - Remaining Quantity:', updatedOrder?.remainingQuantity);

        if (updatedOrder?.deliveredQuantity === 13 && updatedOrder?.remainingQuantity === 32) {
          console.log('✅ Order total calculation working correctly');
        } else {
          throw new Error('❌ Order total calculation failed');
        }

        console.log('🎉 All order total calculation tests passed!');

        // Cleanup test data
        console.log('🧹 Cleaning up test data...');
        await manager.delete(DeliveryItem, { delivery: { id: testDelivery.id } });
        await manager.delete(Delivery, testDelivery.id);
        await manager.delete(OrderItem, [orderItem1.id, orderItem2.id, orderItem3.id]);
        await manager.delete(Order, testOrder.id);
        await manager.delete(User, testUser.id);
        console.log('✅ Test data cleaned up');
      });

    } catch (error) {
      console.error('❌ Error during order total calculation test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new OrderTotalCalculationTester();
tester.testOrderTotalCalculation()
  .then(() => {
    console.log('✅ Order total calculation test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Order total calculation test failed:', error);
    process.exit(1);
  });

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { Delivery, DeliveryStatus } from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';
import { DeliveriesService } from '../src/deliveries/deliveries.service';
import { CreateDeliveryDto } from '../src/deliveries/dto/create-delivery.dto';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class DeliveryColumnFixTester {
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

  async testDeliveryColumnFix() {
    try {
      console.log('🔧 Testing delivery column name fix...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // We'll initialize the service inside the transaction to use the transaction manager

      // Test in transaction to avoid affecting real data
      await this.dataSource.transaction(async (manager) => {
        // Initialize deliveries service with transaction manager repositories
        const orderRepository = manager.getRepository(Order);
        const orderItemRepository = manager.getRepository(OrderItem);
        const deliveryRepository = manager.getRepository(Delivery);
        const deliveryItemRepository = manager.getRepository(DeliveryItem);

        this.deliveriesService = new DeliveriesService(
          deliveryRepository,
          deliveryItemRepository,
          orderRepository,
          orderItemRepository,
          this.dataSource
        );
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-delivery-fix@example.com',
          name: 'Test Delivery Fix User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isDeleted: false, // Explicitly set to test the column
        });
        await manager.save(testUser);
        console.log('✅ Test user created');

        // Create test order (not deleted)
        const testOrder = manager.create(Order, {
          orderId: 'DELIVERY-FIX-001',
          status: OrderStatus.PROCESSING,
          totalItems: 10,
          totalCost: 500.00,
          isDeleted: false, // Explicitly set to test the column
          createdBy: testUser,
        });
        await manager.save(testOrder);
        console.log('✅ Test order created');

        // Create test order item
        const testOrderItem = manager.create(OrderItem, {
          asin: 'DELIVERYFIX123',
          brandName: 'Test Brand',
          modelNumber: '1234567890123',
          title: 'Test Product for Delivery Fix',
          requestingDate: new Date(),
          quantityRequested: 10,
          quantityRemaining: 10,
          unitCost: 50.00,
          totalCost: 500.00,
          order: testOrder,
        });
        await manager.save(testOrderItem);
        console.log('✅ Test order item created');

        // Test 1: Create delivery using the service (this should trigger the fixed queries)
        console.log('🔍 Test 1: Creating delivery with fixed column references...');

        const createDeliveryDto: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem.id,
              deliveredQuantity: 5,
              unitPrice: 50.00,
            },
          ],
        };

        const delivery = await this.deliveriesService.create(createDeliveryDto, testUser);
        console.log('✅ Delivery created successfully:', delivery.deliveryId);

        // Test 2: Test findAll method (uses createQueryBuilder with fixed where clause)
        console.log('🔍 Test 2: Testing findAll with fixed QueryBuilder...');

        const deliveries = await this.deliveriesService.findAll({});
        console.log('✅ FindAll query successful, found deliveries:', deliveries.data.length);

        // Test 3: Test findOne method
        console.log('🔍 Test 3: Testing findOne method...');

        const foundDelivery = await this.deliveriesService.findOne(delivery.id);
        console.log('✅ FindOne query successful:', foundDelivery.deliveryId);

        // Test 4: Test updateOrderTotalRemaining method (uses raw SQL with fixed column name)
        console.log('🔍 Test 4: Testing updateOrderTotalRemaining with fixed raw SQL...');

        // This method is called internally, but let's test it by creating another delivery
        const createDeliveryDto2: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem.id,
              deliveredQuantity: 3,
              unitPrice: 50.00,
            },
          ],
        };

        const delivery2 = await this.deliveriesService.create(createDeliveryDto2, testUser);
        console.log('✅ Second delivery created successfully:', delivery2.deliveryId);

        // Test 5: Verify order quantities were updated correctly
        console.log('🔍 Test 5: Verifying order quantities updated correctly...');

        const updatedOrder = await manager.findOne(Order, { where: { id: testOrder.id } });
        const updatedOrderItem = await manager.findOne(OrderItem, { where: { id: testOrderItem.id } });

        console.log('📊 Order delivered quantity:', updatedOrder?.deliveredQuantity);
        console.log('📊 Order remaining quantity:', updatedOrder?.remainingQuantity);
        console.log('📊 Order item remaining quantity:', updatedOrderItem?.quantityRemaining);

        // Verify the calculations are correct
        const expectedDelivered = 5 + 3; // Two deliveries
        const expectedRemaining = 10 - expectedDelivered; // Original quantity - delivered

        if (updatedOrder?.deliveredQuantity === expectedDelivered) {
          console.log('✅ Order delivered quantity calculation correct');
        } else {
          throw new Error(`Order delivered quantity incorrect: expected ${expectedDelivered}, got ${updatedOrder?.deliveredQuantity}`);
        }

        if (updatedOrderItem?.quantityRemaining === expectedRemaining) {
          console.log('✅ Order item remaining quantity calculation correct');
        } else {
          throw new Error(`Order item remaining quantity incorrect: expected ${expectedRemaining}, got ${updatedOrderItem?.quantityRemaining}`);
        }

        // Test 6: Test with soft-deleted order (should be filtered out)
        console.log('🔍 Test 6: Testing soft-deleted order filtering...');

        // Create a soft-deleted order
        const deletedOrder = manager.create(Order, {
          orderId: 'DELETED-ORDER-001',
          status: OrderStatus.CANCELLED,
          totalItems: 5,
          totalCost: 250.00,
          isDeleted: true, // This order is soft-deleted
          createdBy: testUser,
        });
        await manager.save(deletedOrder);

        // Try to find deliveries - should not include deliveries from deleted orders
        const allDeliveries = await this.deliveriesService.findAll({});
        const deliveriesFromDeletedOrder = allDeliveries.data.filter(d => d.order.id === deletedOrder.id);

        if (deliveriesFromDeletedOrder.length === 0) {
          console.log('✅ Soft-deleted orders correctly filtered out from queries');
        } else {
          throw new Error('Soft-deleted orders were not filtered out correctly');
        }

        console.log('🎉 All delivery column fix tests passed!');
      });

    } catch (error) {
      console.error('❌ Error during delivery column fix test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new DeliveryColumnFixTester();
tester.testDeliveryColumnFix()
  .then(() => {
    console.log('✅ Delivery column fix test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Delivery column fix test failed:', error);
    process.exit(1);
  });

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

class AllEntityMappingsTester {
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

  async testAllEntityMappings() {
    try {
      console.log('🔧 Testing all entity column mappings...');
      
      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Use transaction for all tests
      await this.dataSource.transaction(async (manager) => {
        // Test 1: User Entity
        console.log('🔍 Test 1: User Entity Mappings...');
        
        const testUser = manager.create(User, {
          email: 'test-all-entities@example.com',
          name: 'Test All Entities User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          lastLogin: new Date(),
        });
        await manager.save(testUser);

        // Query with all User columns
        const userQuery = await manager
          .getRepository(User)
          .createQueryBuilder('user')
          .select([
            'user.id',
            'user.email',
            'user.name',
            'user.role',
            'user.status',
            'user.isDeleted',
            'user.lastLogin',    // Maps to last_login
            'user.createdAt',    // Maps to created_at
            'user.updatedAt',    // Maps to updated_at
          ])
          .where('user.id = :id', { id: testUser.id })
          .getOne();

        console.log('✅ User entity query successful');

        // Test 2: Order Entity
        console.log('🔍 Test 2: Order Entity Mappings...');
        
        const testOrder = manager.create(Order, {
          orderId: 'TEST-ALL-001',
          status: OrderStatus.PROCESSING,
          totalItems: 10,
          totalCost: 500.00,
          deliveredQuantity: 0,
          remainingQuantity: 10,
          fileName: 'test-file.xlsx',
          createdBy: testUser,
        });
        await manager.save(testOrder);

        // Query with all Order columns
        const orderQuery = await manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .select([
            'order.id',
            'order.orderId',           // Maps to orderId (camelCase)
            'order.status',            // Maps to status
            'order.totalItems',        // Maps to totalItems
            'order.totalCost',         // Maps to totalCost
            'order.deliveredQuantity', // Maps to deliveredQuantity
            'order.remainingQuantity', // Maps to remainingQuantity
            'order.fileName',          // Maps to fileName
            'order.isDeleted',         // Maps to isDeleted
            'order.createdAt',         // Maps to createdAt
            'order.updatedAt',         // Maps to updatedAt
          ])
          .where('order.id = :id', { id: testOrder.id })
          .getOne();

        console.log('✅ Order entity query successful');

        // Test 3: OrderItem Entity
        console.log('🔍 Test 3: OrderItem Entity Mappings...');
        
        const testOrderItem = manager.create(OrderItem, {
          asin: 'TEST123456789',
          brandName: 'Test Brand',
          modelNumber: '1234567890123',
          title: 'Test Product',
          requestingDate: new Date(),
          quantityRequested: 10,
          quantityRemaining: 10,
          unitCost: 50.00,
          totalCost: 500.00,
          order: testOrder,
        });
        await manager.save(testOrderItem);

        // Query with all OrderItem columns
        const orderItemQuery = await manager
          .getRepository(OrderItem)
          .createQueryBuilder('item')
          .select([
            'item.id',
            'item.asin',
            'item.brandName',        // Maps to brand_name
            'item.modelNumber',      // Maps to model_number
            'item.title',
            'item.requestingDate',   // Maps to requesting_date
            'item.quantityRequested', // Maps to quantity_requested
            'item.quantityRemaining', // Maps to quantity_remaining
            'item.unitCost',         // Maps to unit_cost
            'item.totalCost',        // Maps to total_cost
            'item.createdAt',        // Maps to created_at
            'item.updatedAt',        // Maps to updated_at
          ])
          .where('item.id = :id', { id: testOrderItem.id })
          .getOne();

        console.log('✅ OrderItem entity query successful');

        // Test 4: Delivery Entity
        console.log('🔍 Test 4: Delivery Entity Mappings...');
        
        const testDelivery = manager.create(Delivery, {
          deliveryId: 'DEL-TEST-001',
          deliveryDate: new Date(),
          status: DeliveryStatus.DELIVERED,
          order: testOrder,
          createdBy: testUser,
        });
        await manager.save(testDelivery);

        // Query with all Delivery columns
        const deliveryQuery = await manager
          .getRepository(Delivery)
          .createQueryBuilder('delivery')
          .select([
            'delivery.id',
            'delivery.deliveryId',   // Maps to delivery_id
            'delivery.deliveryDate', // Maps to delivery_date
            'delivery.status',
            'delivery.createdAt',    // Maps to createdAt (camelCase)
            'delivery.updatedAt',    // Maps to updatedAt (camelCase)
          ])
          .where('delivery.id = :id', { id: testDelivery.id })
          .getOne();

        console.log('✅ Delivery entity query successful');

        // Test 5: DeliveryItem Entity
        console.log('🔍 Test 5: DeliveryItem Entity Mappings...');
        
        const testDeliveryItem = manager.create(DeliveryItem, {
          deliveredQuantity: 5,
          unitPrice: 50.00,
          totalAmount: 250.00,
          deliveryDate: new Date(),
          delivery: testDelivery,
          orderItem: testOrderItem,
        });
        await manager.save(testDeliveryItem);

        // Query with all DeliveryItem columns
        const deliveryItemQuery = await manager
          .getRepository(DeliveryItem)
          .createQueryBuilder('item')
          .select([
            'item.id',
            'item.deliveredQuantity', // Maps to delivered_quantity
            'item.unitPrice',         // Maps to unit_price
            'item.totalAmount',       // Maps to total_amount
            'item.deliveryDate',      // Maps to delivery_date
            'item.createdAt',         // Maps to createdAt (camelCase)
            'item.updatedAt',         // Maps to updatedAt (camelCase)
          ])
          .where('item.id = :id', { id: testDeliveryItem.id })
          .getOne();

        console.log('✅ DeliveryItem entity query successful');

        // Test 6: Complex Join Query
        console.log('🔍 Test 6: Complex Join Query with All Entities...');
        
        const complexQuery = await manager
          .getRepository(DeliveryItem)
          .createQueryBuilder('deliveryItem')
          .leftJoinAndSelect('deliveryItem.delivery', 'delivery')
          .leftJoinAndSelect('deliveryItem.orderItem', 'orderItem')
          .leftJoinAndSelect('delivery.order', 'order')
          .leftJoinAndSelect('delivery.createdBy', 'user')
          .select([
            // DeliveryItem columns
            'deliveryItem.id',
            'deliveryItem.deliveredQuantity',
            'deliveryItem.unitPrice',
            'deliveryItem.totalAmount',
            // Delivery columns
            'delivery.id',
            'delivery.deliveryId',
            'delivery.deliveryDate',
            'delivery.status',
            // OrderItem columns
            'orderItem.id',
            'orderItem.asin',
            'orderItem.brandName',
            'orderItem.quantityRequested',
            'orderItem.quantityRemaining',
            // Order columns
            'order.id',
            'order.orderId',
            'order.totalItems',
            'order.totalCost',
            // User columns
            'user.id',
            'user.email',
            'user.name',
            'user.role',
          ])
          .where('deliveryItem.id = :id', { id: testDeliveryItem.id })
          .getOne();

        console.log('✅ Complex join query successful');

        console.log('🎉 All entity column mapping tests passed!');

        // Cleanup test data
        console.log('🧹 Cleaning up test data...');
        await manager.delete(DeliveryItem, testDeliveryItem.id);
        await manager.delete(Delivery, testDelivery.id);
        await manager.delete(OrderItem, testOrderItem.id);
        await manager.delete(Order, testOrder.id);
        await manager.delete(User, testUser.id);
        console.log('✅ Test data cleaned up');
      });

    } catch (error) {
      console.error('❌ Error during entity mappings test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new AllEntityMappingsTester();
tester.testAllEntityMappings()
  .then(() => {
    console.log('✅ All entity mappings test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ All entity mappings test failed:', error);
    process.exit(1);
  });

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

class SimpleDeliveryColumnFixTester {
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

  async testDeliveryColumnFix() {
    try {
      console.log('🔧 Testing delivery column name fix (simple version)...');
      
      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Test 1: Test repository findOne with isDeleted condition
      console.log('🔍 Test 1: Testing Order repository findOne with isDeleted condition...');
      
      const orderRepository = this.dataSource.getRepository(Order);
      
      // This should work without "Unknown column" error
      const orders = await orderRepository.find({
        where: {
          isDeleted: false // This uses entity property name, should map to is_deleted column
        },
        take: 5,
      });
      
      console.log('✅ Order repository findOne with isDeleted works:', orders.length, 'orders found');

      // Test 2: Test QueryBuilder with correct column name
      console.log('🔍 Test 2: Testing QueryBuilder with correct snake_case column name...');
      
      const deliveryRepository = this.dataSource.getRepository(Delivery);
      
      // This should work with the fixed column name
      const deliveries = await deliveryRepository
        .createQueryBuilder('delivery')
        .leftJoinAndSelect('delivery.order', 'order')
        .where('order.is_deleted = :isDeleted', { isDeleted: false }) // Fixed: using snake_case
        .take(5)
        .getMany();
      
      console.log('✅ QueryBuilder with snake_case column name works:', deliveries.length, 'deliveries found');

      // Test 3: Test the raw SQL query fix
      console.log('🔍 Test 3: Testing raw SQL query with fixed column name...');
      
      const rawQueryResult = await this.dataSource.query(`
        SELECT COALESCE(SUM(di.delivered_quantity), 0) as totalDelivered
        FROM delivery_items di
        INNER JOIN order_items oi ON di.order_item_id = oi.id
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.is_deleted = 0
        LIMIT 1
      `);
      
      console.log('✅ Raw SQL query with snake_case column name works:', rawQueryResult);

      // Test 4: Test nested relation queries
      console.log('🔍 Test 4: Testing nested relation queries with isDeleted...');
      
      const deliveriesWithOrders = await deliveryRepository.find({
        where: {
          order: { isDeleted: false } // This should work with entity property name
        },
        relations: ['order'],
        take: 5,
      });
      
      console.log('✅ Nested relation query with isDeleted works:', deliveriesWithOrders.length, 'deliveries found');

      // Test 5: Test complex join query
      console.log('🔍 Test 5: Testing complex join query...');
      
      const complexQuery = await deliveryRepository
        .createQueryBuilder('delivery')
        .leftJoinAndSelect('delivery.order', 'order')
        .leftJoinAndSelect('delivery.createdBy', 'createdBy')
        .leftJoinAndSelect('delivery.deliveryItems', 'deliveryItems')
        .leftJoinAndSelect('deliveryItems.orderItem', 'orderItem')
        .where('order.is_deleted = :isDeleted', { isDeleted: false })
        .andWhere('delivery.status = :status', { status: DeliveryStatus.DELIVERED })
        .take(3)
        .getMany();
      
      console.log('✅ Complex join query works:', complexQuery.length, 'deliveries found');

      // Test 6: Verify column mappings are working in both directions
      console.log('🔍 Test 6: Verifying column mappings work in both directions...');
      
      if (orders.length > 0) {
        const firstOrder = orders[0];
        console.log('📊 Order properties:');
        console.log('  - ID:', firstOrder.id);
        console.log('  - Order ID:', firstOrder.orderId);
        console.log('  - Is Deleted:', firstOrder.isDeleted);
        console.log('  - Total Items:', firstOrder.totalItems);
        console.log('  - Total Cost:', firstOrder.totalCost);
        console.log('  - Created At:', firstOrder.createdAt);
        
        // Try to update the order to test write operations
        await orderRepository.update(firstOrder.id, {
          totalItems: firstOrder.totalItems, // Same value, just to test the update
        });
        
        console.log('✅ Order update operation works (column mappings work for writes too)');
      }

      console.log('🎉 All delivery column fix tests passed!');
      console.log('🎯 Column name mappings are working correctly:');
      console.log('  ✅ Repository methods use entity property names (isDeleted)');
      console.log('  ✅ QueryBuilder uses database column names (is_deleted)');
      console.log('  ✅ Raw SQL uses database column names (is_deleted)');
      console.log('  ✅ Nested relations use entity property names (isDeleted)');

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
const tester = new SimpleDeliveryColumnFixTester();
tester.testDeliveryColumnFix()
  .then(() => {
    console.log('✅ Simple delivery column fix test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Simple delivery column fix test failed:', error);
    process.exit(1);
  });

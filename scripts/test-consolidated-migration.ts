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

class ConsolidatedMigrationTester {
  private dataSource: DataSource;

  constructor() {
    this.dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '12345678',
      database: process.env.DB_NAME || 'order_tracker_test',
      entities: [join(__dirname, '..', 'src', '**', '*.entity{.ts,.js}')],
      migrations: [
        join(__dirname, '..', 'src', 'database', 'migrations', '1703000000020-ConsolidatedSchema.ts'),
        join(__dirname, '..', 'src', 'database', 'migrations', '1703000000021-ConsolidatedTriggers.ts'),
      ],
      synchronize: false,
      logging: true,
      dropSchema: true, // This will drop and recreate the schema
    });
  }

  async testConsolidatedMigration() {
    try {
      console.log('🔧 Testing consolidated migration with fresh database...');
      
      // Initialize connection and run migrations
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Run migrations
      await this.dataSource.runMigrations();
      console.log('✅ Consolidated migrations executed successfully');

      // Test 1: Verify all tables exist
      console.log('🔍 Test 1: Verifying table structure...');
      
      const tables = await this.dataSource.query('SHOW TABLES');
      const tableNames = tables.map((t: any) => Object.values(t)[0]);
      
      const expectedTables = ['users', 'orders', 'order_items', 'deliveries', 'delivery_items'];
      for (const expectedTable of expectedTables) {
        if (!tableNames.includes(expectedTable)) {
          throw new Error(`Table ${expectedTable} not found`);
        }
      }
      console.log('✅ All expected tables exist:', tableNames);

      // Test 2: Verify column names are snake_case
      console.log('🔍 Test 2: Verifying snake_case column naming...');
      
      const ordersColumns = await this.dataSource.query('DESCRIBE orders');
      const expectedOrderColumns = ['order_id', 'total_items', 'total_cost', 'delivered_quantity', 'remaining_quantity', 'file_name', 'is_deleted', 'created_at', 'updated_at'];
      
      for (const expectedCol of expectedOrderColumns) {
        const found = ordersColumns.find((col: any) => col.Field === expectedCol);
        if (!found) {
          throw new Error(`Column ${expectedCol} not found in orders table`);
        }
      }
      console.log('✅ Orders table has correct snake_case columns');

      // Test 3: Test entity CRUD operations
      console.log('🔍 Test 3: Testing entity CRUD operations...');
      
      await this.dataSource.transaction(async (manager) => {
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-consolidated@example.com',
          name: 'Test Consolidated User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);
        console.log('✅ User entity CRUD working');

        // Create test order
        const testOrder = manager.create(Order, {
          orderId: 'TEST-CONSOLIDATED-001',
          status: OrderStatus.PROCESSING,
          totalItems: 10,
          totalCost: 500.00,
          createdBy: testUser,
        });
        await manager.save(testOrder);
        console.log('✅ Order entity CRUD working');

        // Create test order item
        const testOrderItem = manager.create(OrderItem, {
          asin: 'CONSOLIDATED123',
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
        console.log('✅ OrderItem entity CRUD working');

        // Create test delivery
        const testDelivery = manager.create(Delivery, {
          deliveryId: 'DEL-CONSOLIDATED-001',
          deliveryDate: new Date(),
          status: DeliveryStatus.DELIVERED,
          order: testOrder,
          createdBy: testUser,
        });
        await manager.save(testDelivery);
        console.log('✅ Delivery entity CRUD working');

        // Create test delivery item
        const testDeliveryItem = manager.create(DeliveryItem, {
          deliveredQuantity: 5,
          unitPrice: 50.00,
          totalAmount: 250.00,
          delivery: testDelivery,
          orderItem: testOrderItem,
        });
        await manager.save(testDeliveryItem);
        console.log('✅ DeliveryItem entity CRUD working');

        // Test 4: Verify triggers are working
        console.log('🔍 Test 4: Testing database triggers...');
        
        // Check if quantity was automatically updated by trigger
        const updatedOrderItem = await manager.findOne(OrderItem, {
          where: { id: testOrderItem.id }
        });
        
        if (updatedOrderItem?.quantityRemaining === 5) { // 10 - 5 = 5
          console.log('✅ Quantity management triggers working correctly');
        } else {
          throw new Error(`Trigger failed: Expected remaining quantity 5, got ${updatedOrderItem?.quantityRemaining}`);
        }

        // Test 5: Test trigger protection
        console.log('🔍 Test 5: Testing trigger protection...');
        
        try {
          await manager.update(OrderItem, testOrderItem.id, {
            quantityRemaining: 999, // This should be blocked
          });
          throw new Error('Direct quantity update was not blocked by trigger');
        } catch (error: any) {
          if (error.message.includes('Direct updates to quantity_remaining are not allowed')) {
            console.log('✅ Trigger protection working correctly');
          } else {
            throw error;
          }
        }

        console.log('🎉 All consolidated migration tests passed!');
      });

    } catch (error) {
      console.error('❌ Error during consolidated migration test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new ConsolidatedMigrationTester();
tester.testConsolidatedMigration()
  .then(() => {
    console.log('✅ Consolidated migration test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Consolidated migration test failed:', error);
    process.exit(1);
  });

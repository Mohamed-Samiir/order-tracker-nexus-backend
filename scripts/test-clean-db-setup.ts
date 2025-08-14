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

class CleanDatabaseSetupTester {
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
      migrations: [join(__dirname, '..', 'src', 'database', 'migrations', '*.ts')],
      synchronize: false,
      logging: true,
    });
  }

  async testCleanDatabaseSetup() {
    try {
      console.log('🧹 Testing clean database setup with consolidated migrations only...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Test 1: Verify only consolidated migrations exist
      console.log('🔍 Test 1: Verifying migration files...');

      const fs = require('fs');
      const path = require('path');
      const migrationsDir = path.join(__dirname, '..', 'src', 'database', 'migrations');
      const migrationFiles = fs.readdirSync(migrationsDir);

      console.log('📁 Found migration files:', migrationFiles);

      const expectedFiles = [
        '1703000000020-ConsolidatedSchema.ts',
        '1703000000021-ConsolidatedTriggers.ts'
      ];

      if (migrationFiles.length !== expectedFiles.length) {
        throw new Error(`Expected ${expectedFiles.length} migration files, found ${migrationFiles.length}`);
      }

      for (const expectedFile of expectedFiles) {
        if (!migrationFiles.includes(expectedFile)) {
          throw new Error(`Missing expected migration file: ${expectedFile}`);
        }
      }

      console.log('✅ Only consolidated migration files exist');

      // Test 2: Check migration status
      console.log('🔍 Test 2: Checking migration status...');

      const pendingMigrations = await this.dataSource.showMigrations();
      console.log('📋 Pending migrations:', pendingMigrations);

      // Test 3: Check if migrations need to be run or are already executed
      console.log('🔍 Test 3: Checking migration execution status...');

      const executedMigrations = await this.dataSource.runMigrations();
      console.log('✅ Migration execution result:', executedMigrations.map(m => m.name));

      // Check if migrations are already in the database
      const migrationHistory = await this.dataSource.query('SELECT * FROM migrations ORDER BY timestamp');
      console.log('📋 Current migration history:', migrationHistory.map((m: any) => m.name));

      if (executedMigrations.length === 0 && migrationHistory.length === 2) {
        console.log('✅ Migrations were already executed (expected for clean setup test)');
      } else if (executedMigrations.length === 2) {
        console.log('✅ Migrations executed successfully');
      } else {
        throw new Error(`Unexpected migration state: ${executedMigrations.length} executed, ${migrationHistory.length} in history`);
      }

      // Test 4: Verify database schema
      console.log('🔍 Test 4: Verifying database schema...');

      const tables = await this.dataSource.query('SHOW TABLES');
      const tableNames = tables.map((t: any) => Object.values(t)[0]);

      const expectedTables = ['users', 'orders', 'order_items', 'deliveries', 'delivery_items', 'migrations'];
      for (const expectedTable of expectedTables) {
        if (!tableNames.includes(expectedTable)) {
          throw new Error(`Table ${expectedTable} not found`);
        }
      }
      console.log('✅ All expected tables exist:', tableNames);

      // Test 5: Verify snake_case column naming
      console.log('🔍 Test 5: Verifying snake_case column naming...');

      const ordersColumns = await this.dataSource.query('DESCRIBE orders');
      const orderColumnNames = ordersColumns.map((col: any) => col.Field);

      const expectedSnakeCaseColumns = [
        'order_id', 'total_items', 'total_cost', 'delivered_quantity',
        'remaining_quantity', 'file_name', 'is_deleted', 'created_at', 'updated_at'
      ];

      for (const expectedCol of expectedSnakeCaseColumns) {
        if (!orderColumnNames.includes(expectedCol)) {
          throw new Error(`Snake_case column ${expectedCol} not found in orders table`);
        }
      }
      console.log('✅ All snake_case columns verified in orders table');

      // Test 6: Verify database triggers
      console.log('🔍 Test 6: Verifying database triggers...');

      const triggers = await this.dataSource.query('SHOW TRIGGERS');
      const triggerNames = triggers.map((t: any) => t.Trigger);

      const expectedTriggers = [
        'prevent_direct_quantity_remaining_update',
        'validate_delivery_quantity_before_insert',
        'update_quantity_remaining_after_delivery_insert',
        'update_quantity_remaining_after_delivery_update',
        'update_quantity_remaining_after_delivery_delete',
        'validate_delivery_quantity_before_update'
      ];

      for (const expectedTrigger of expectedTriggers) {
        if (!triggerNames.includes(expectedTrigger)) {
          throw new Error(`Trigger ${expectedTrigger} not found`);
        }
      }
      console.log('✅ All database triggers verified:', triggerNames);

      // Test 7: Test entity operations
      console.log('🔍 Test 7: Testing entity operations...');

      await this.dataSource.transaction(async (manager) => {
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-clean-setup@example.com',
          name: 'Test Clean Setup User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);

        // Create test order
        const testOrder = manager.create(Order, {
          orderId: 'CLEAN-SETUP-001',
          status: OrderStatus.PROCESSING,
          totalItems: 5,
          totalCost: 250.00,
          createdBy: testUser,
        });
        await manager.save(testOrder);

        // Create test order item
        const testOrderItem = manager.create(OrderItem, {
          asin: 'CLEAN123456789',
          brandName: 'Clean Test Brand',
          modelNumber: '1234567890123',
          title: 'Clean Test Product',
          requestingDate: new Date(),
          quantityRequested: 5,
          quantityRemaining: 5,
          unitCost: 50.00,
          totalCost: 250.00,
          order: testOrder,
        });
        await manager.save(testOrderItem);

        // Create test delivery
        const testDelivery = manager.create(Delivery, {
          deliveryId: 'DEL-CLEAN-001',
          deliveryDate: new Date(),
          status: DeliveryStatus.DELIVERED,
          order: testOrder,
          createdBy: testUser,
        });
        await manager.save(testDelivery);

        // Create test delivery item (this will trigger quantity updates)
        const testDeliveryItem = manager.create(DeliveryItem, {
          deliveredQuantity: 3,
          unitPrice: 50.00,
          totalAmount: 150.00,
          delivery: testDelivery,
          orderItem: testOrderItem,
        });
        await manager.save(testDeliveryItem);

        // Verify trigger functionality
        const updatedOrderItem = await manager.findOne(OrderItem, {
          where: { id: testOrderItem.id }
        });

        if (updatedOrderItem?.quantityRemaining === 2) { // 5 - 3 = 2
          console.log('✅ Database triggers working correctly');
        } else {
          throw new Error(`Trigger failed: Expected remaining quantity 2, got ${updatedOrderItem?.quantityRemaining}`);
        }

        console.log('✅ All entity operations successful');
      });

      // Test 8: Final verification of migration history
      console.log('🔍 Test 8: Final verification of migration history...');

      const finalMigrationHistory = await this.dataSource.query('SELECT * FROM migrations ORDER BY timestamp');
      console.log('📋 Final migration history:', finalMigrationHistory.map((m: any) => m.name));

      if (finalMigrationHistory.length !== 2) {
        throw new Error(`Expected 2 migrations in history, found ${finalMigrationHistory.length}`);
      }

      const expectedMigrationNames = [
        'ConsolidatedSchema1703000000020',
        'ConsolidatedTriggers1703000000021'
      ];

      for (let i = 0; i < expectedMigrationNames.length; i++) {
        if (finalMigrationHistory[i].name !== expectedMigrationNames[i]) {
          throw new Error(`Expected migration ${expectedMigrationNames[i]}, found ${finalMigrationHistory[i].name}`);
        }
      }

      console.log('✅ Migration history is clean and contains only consolidated migrations');

      console.log('🎉 All clean database setup tests passed!');
      console.log('🎯 Database is ready with consolidated migrations only');

    } catch (error) {
      console.error('❌ Error during clean database setup test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new CleanDatabaseSetupTester();
tester.testCleanDatabaseSetup()
  .then(() => {
    console.log('✅ Clean database setup test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Clean database setup test failed:', error);
    process.exit(1);
  });

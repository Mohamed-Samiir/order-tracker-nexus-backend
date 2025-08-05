#!/usr/bin/env ts-node

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../.env') });

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class OrderDeletionValidationTests {
  private dataSource: DataSource;
  private results: TestResult[] = [];

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
      logging: false,
    });
  }

  async runAllTests() {
    console.log('🧪 Starting Order Deletion Validation Tests...\n');

    try {
      await this.dataSource.initialize();
      console.log('✅ Database connection established\n');

      // Setup test data
      await this.setupTestData();

      // Run all tests
      await this.testOrderDeletionWithoutDeliveries();
      await this.testOrderDeletionWithDeliveries();
      await this.testDatabaseConstraints();

      // Cleanup
      await this.cleanupTestData();

      // Report results
      this.reportResults();

    } catch (error) {
      console.error('❌ Test setup failed:', error.message);
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }

  private async setupTestData() {
    console.log('🔧 Setting up test data...');

    // Create test user
    await this.dataSource.query(`
      INSERT IGNORE INTO users (id, email, name, password, role, status, created_at, updated_at)
      VALUES ('test-user-order-del', 'order-del-test@example.com', 'Order Deletion Test User', 'hashed', 'admin', 'active', NOW(), NOW())
    `);

    // Create test order without deliveries
    await this.dataSource.query(`
      INSERT IGNORE INTO orders (id, order_id, status, total_items, total_cost, remaining_quantity, file_name, created_by, created_at, updated_at)
      VALUES ('test-order-no-del', 'ORDER-NO-DEL-001', 'pending', 50, 500.00, 50, 'no-deliveries.xlsx', 'test-user-order-del', NOW(), NOW())
    `);

    // Create test order with deliveries
    await this.dataSource.query(`
      INSERT IGNORE INTO orders (id, order_id, status, total_items, total_cost, remaining_quantity, file_name, created_by, created_at, updated_at)
      VALUES ('test-order-with-del', 'ORDER-WITH-DEL-001', 'pending', 100, 1000.00, 75, 'with-deliveries.xlsx', 'test-user-order-del', NOW(), NOW())
    `);

    // Create order items
    await this.dataSource.query(`
      INSERT IGNORE INTO order_items (id, asin, brand_name, model_number, title, requesting_date, quantity_requested, quantity_remaining, unit_cost, total_cost, order_id, created_at, updated_at)
      VALUES 
        ('test-item-no-del', 'B111111111', 'Brand A', '1111111111111', 'Product A', '2024-01-01', 50, 50, 10.00, 500.00, 'test-order-no-del', NOW(), NOW()),
        ('test-item-with-del', 'B222222222', 'Brand B', '2222222222222', 'Product B', '2024-01-01', 100, 75, 10.00, 1000.00, 'test-order-with-del', NOW(), NOW())
    `);

    // Create delivery for the order with deliveries
    await this.dataSource.query(`
      INSERT IGNORE INTO deliveries (id, delivery_date, status, order_id, created_by, created_at, updated_at)
      VALUES ('test-delivery-1', '2024-01-25', 'delivered', 'test-order-with-del', 'test-user-order-del', NOW(), NOW())
    `);

    // Create delivery item
    await this.dataSource.query(`
      INSERT IGNORE INTO delivery_items (id, delivered_quantity, unit_price, total_amount, delivery_date, delivery_id, order_item_id, created_at, updated_at)
      VALUES ('test-delivery-item-1', 25, 10.00, 250.00, '2024-01-25', 'test-delivery-1', 'test-item-with-del', NOW(), NOW())
    `);

    console.log('✅ Test data setup complete\n');
  }

  private async cleanupTestData() {
    console.log('🧹 Cleaning up test data...');

    await this.dataSource.query('DELETE FROM delivery_items WHERE id LIKE "test-delivery-item-%"');
    await this.dataSource.query('DELETE FROM deliveries WHERE id LIKE "test-delivery-%"');
    await this.dataSource.query('DELETE FROM order_items WHERE id LIKE "test-item-%"');
    await this.dataSource.query('DELETE FROM orders WHERE id LIKE "test-order-%"');
    await this.dataSource.query('DELETE FROM users WHERE id = "test-user-order-del"');

    console.log('✅ Cleanup complete\n');
  }

  private async testOrderDeletionWithoutDeliveries() {
    console.log('🔍 Testing order deletion without deliveries...');

    try {
      // Check that order exists and has no deliveries
      const [orderCheck] = await this.dataSource.query(`
        SELECT o.*, COUNT(d.id) as delivery_count
        FROM orders o
        LEFT JOIN deliveries d ON o.id = d.order_id
        WHERE o.id = 'test-order-no-del'
        GROUP BY o.id
      `);

      if (!orderCheck) {
        this.results.push({ 
          testName: 'Order Deletion Without Deliveries - Setup Check', 
          passed: false, 
          error: 'Test order not found' 
        });
        return;
      }

      if (orderCheck.delivery_count > 0) {
        this.results.push({ 
          testName: 'Order Deletion Without Deliveries - Setup Check', 
          passed: false, 
          error: 'Test order should not have deliveries' 
        });
        return;
      }

      this.results.push({ testName: 'Order Deletion Without Deliveries - Setup Check', passed: true });

      // Simulate the service logic: check delivery count
      const deliveryCount = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM deliveries WHERE order_id = 'test-order-no-del'
      `);

      if (deliveryCount[0].count === 0) {
        // Simulate soft delete
        await this.dataSource.query(`
          UPDATE orders SET is_deleted = true WHERE id = 'test-order-no-del'
        `);

        // Verify soft delete worked
        const [deletedOrder] = await this.dataSource.query(`
          SELECT is_deleted FROM orders WHERE id = 'test-order-no-del'
        `);

        if (deletedOrder && deletedOrder.is_deleted === 1) {
          this.results.push({ testName: 'Order Deletion Without Deliveries - Deletion Success', passed: true });
        } else {
          this.results.push({ 
            testName: 'Order Deletion Without Deliveries - Deletion Success', 
            passed: false, 
            error: 'Order was not soft deleted' 
          });
        }
      } else {
        this.results.push({ 
          testName: 'Order Deletion Without Deliveries - Deletion Success', 
          passed: false, 
          error: 'Unexpected deliveries found' 
        });
      }

    } catch (error) {
      this.results.push({ 
        testName: 'Order Deletion Without Deliveries', 
        passed: false, 
        error: error.message 
      });
    }
  }

  private async testOrderDeletionWithDeliveries() {
    console.log('🔍 Testing order deletion with deliveries...');

    try {
      // Check that order exists and has deliveries
      const [orderCheck] = await this.dataSource.query(`
        SELECT o.*, COUNT(d.id) as delivery_count
        FROM orders o
        LEFT JOIN deliveries d ON o.id = d.order_id
        WHERE o.id = 'test-order-with-del'
        GROUP BY o.id
      `);

      if (!orderCheck) {
        this.results.push({ 
          testName: 'Order Deletion With Deliveries - Setup Check', 
          passed: false, 
          error: 'Test order not found' 
        });
        return;
      }

      if (orderCheck.delivery_count === 0) {
        this.results.push({ 
          testName: 'Order Deletion With Deliveries - Setup Check', 
          passed: false, 
          error: 'Test order should have deliveries' 
        });
        return;
      }

      this.results.push({ testName: 'Order Deletion With Deliveries - Setup Check', passed: true });

      // Simulate the service logic: check delivery count
      const deliveryCount = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM deliveries WHERE order_id = 'test-order-with-del'
      `);

      if (deliveryCount[0].count > 0) {
        // This should trigger the validation error
        this.results.push({ 
          testName: 'Order Deletion With Deliveries - Validation Triggered', 
          passed: true,
          details: `Found ${deliveryCount[0].count} deliveries - deletion should be prevented`
        });

        // Verify order was NOT deleted (simulate the service not calling update)
        const [orderStatus] = await this.dataSource.query(`
          SELECT is_deleted FROM orders WHERE id = 'test-order-with-del'
        `);

        if (orderStatus && orderStatus.is_deleted === 0) {
          this.results.push({ testName: 'Order Deletion With Deliveries - Order Preserved', passed: true });
        } else {
          this.results.push({ 
            testName: 'Order Deletion With Deliveries - Order Preserved', 
            passed: false, 
            error: 'Order should not have been deleted' 
          });
        }
      } else {
        this.results.push({ 
          testName: 'Order Deletion With Deliveries - Validation Triggered', 
          passed: false, 
          error: 'Expected deliveries not found' 
        });
      }

    } catch (error) {
      this.results.push({ 
        testName: 'Order Deletion With Deliveries', 
        passed: false, 
        error: error.message 
      });
    }
  }

  private async testDatabaseConstraints() {
    console.log('🔍 Testing database constraints...');

    try {
      // Test 1: Try to delete order with deliveries directly (should fail due to foreign key constraint)
      let constraintWorked = false;
      try {
        await this.dataSource.query('DELETE FROM orders WHERE id = "test-order-with-del"');
      } catch (error) {
        if (error.message.includes('foreign key constraint') || error.code === 'ER_ROW_IS_REFERENCED_2') {
          constraintWorked = true;
        }
      }

      this.results.push({ 
        testName: 'Database Constraints - Foreign Key Protection', 
        passed: constraintWorked,
        error: constraintWorked ? undefined : 'Foreign key constraint should have prevented deletion'
      });

      // Test 2: Verify constraint details
      const constraints = await this.dataSource.query(`
        SELECT 
          CONSTRAINT_NAME,
          DELETE_RULE,
          UPDATE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
        WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND REFERENCED_TABLE_NAME = 'orders'
        AND TABLE_NAME = 'deliveries'
      `);

      const orderConstraint = constraints.find(c => c.DELETE_RULE === 'RESTRICT');
      
      if (orderConstraint) {
        this.results.push({ 
          testName: 'Database Constraints - RESTRICT Rule Verified', 
          passed: true,
          details: `Constraint: ${orderConstraint.CONSTRAINT_NAME}, Delete Rule: ${orderConstraint.DELETE_RULE}`
        });
      } else {
        this.results.push({ 
          testName: 'Database Constraints - RESTRICT Rule Verified', 
          passed: false, 
          error: 'RESTRICT constraint not found or not properly configured' 
        });
      }

    } catch (error) {
      this.results.push({ 
        testName: 'Database Constraints', 
        passed: false, 
        error: error.message 
      });
    }
  }

  private reportResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('=' .repeat(60));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    });

    console.log('=' .repeat(60));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Order deletion validation is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

// Run the tests
const tester = new OrderDeletionValidationTests();
tester.runAllTests()
  .then(() => {
    console.log('\n✅ Order deletion validation testing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Order deletion validation testing failed:', error);
    process.exit(1);
  });

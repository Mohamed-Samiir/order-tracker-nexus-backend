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

class QuantityEdgeCaseTests {
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
    console.log('🧪 Starting Quantity Edge Case Tests...\n');

    try {
      await this.dataSource.initialize();
      console.log('✅ Database connection established\n');

      // Setup test data
      await this.setupTestData();

      // Run all tests
      await this.testPartialDeliveries();
      await this.testDeliveryModifications();
      await this.testDeliveryCancellations();
      await this.testConstraintValidation();
      await this.testConcurrentDeliveries();
      await this.testQuantityRecalculation();
      await this.testAuditLogging();

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
      INSERT IGNORE INTO users (id, email, name, password, role, status, isDeleted, created_at, updated_at)
      VALUES ('test-user-edge', 'edge-test@example.com', 'Edge Test User', 'hashed', 'admin', 'active', false, NOW(), NOW())
    `);

    // Create test order
    await this.dataSource.query(`
      INSERT IGNORE INTO orders (id, order_id, status, file_name, created_by, created_at, updated_at)
      VALUES ('test-order-edge', 'EDGE-TEST-001', 'pending', 'edge-test.xlsx', 'test-user-edge', NOW(), NOW())
    `);

    // Create test order items
    await this.dataSource.query(`
      INSERT IGNORE INTO order_items (id, asin, brand_name, model_number, title, requesting_date, quantity_requested, quantity_remaining, unit_cost, total_cost, order_id, created_at, updated_at)
      VALUES 
        ('test-item-1', 'B111111111', 'Brand A', '1111111111111', 'Product A', '2024-01-01', 100, 100, 10.00, 1000.00, 'test-order-edge', NOW(), NOW()),
        ('test-item-2', 'B222222222', 'Brand B', '2222222222222', 'Product B', '2024-01-01', 50, 50, 20.00, 1000.00, 'test-order-edge', NOW(), NOW()),
        ('test-item-3', 'B333333333', 'Brand C', '3333333333333', 'Product C', '2024-01-01', 75, 75, 15.00, 1125.00, 'test-order-edge', NOW(), NOW())
    `);

    console.log('✅ Test data setup complete\n');
  }

  private async cleanupTestData() {
    console.log('🧹 Cleaning up test data...');

    await this.dataSource.query('DELETE FROM delivery_items WHERE delivery_id LIKE "test-delivery-%"');
    await this.dataSource.query('DELETE FROM deliveries WHERE id LIKE "test-delivery-%"');
    await this.dataSource.query('DELETE FROM order_items WHERE id LIKE "test-item-%"');
    await this.dataSource.query('DELETE FROM orders WHERE id = "test-order-edge"');
    await this.dataSource.query('DELETE FROM users WHERE id = "test-user-edge"');
    await this.dataSource.query('DELETE FROM quantity_audit_log WHERE order_item_id LIKE "test-item-%"');

    console.log('✅ Cleanup complete\n');
  }

  private async testPartialDeliveries() {
    console.log('🔍 Testing partial deliveries...');

    try {
      // Create delivery
      await this.dataSource.query(`
        INSERT INTO deliveries (id, delivery_date, status, order_id, created_by, created_at, updated_at)
        VALUES ('test-delivery-1', '2024-01-25', 'delivered', 'test-order-edge', 'test-user-edge', NOW(), NOW())
      `);

      // First partial delivery
      await this.dataSource.query(`
        INSERT INTO delivery_items (id, delivered_quantity, unit_price, total_amount, delivery_date, delivery_id, order_item_id, created_at, updated_at)
        VALUES ('test-delivery-item-1', 30, 10.00, 300.00, '2024-01-25', 'test-delivery-1', 'test-item-1', NOW(), NOW())
      `);

      // Check remaining quantity
      const [result1] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-1"');

      if (result1.quantity_remaining === 70) {
        this.results.push({ testName: 'Partial Delivery - First Delivery', passed: true });
      } else {
        this.results.push({
          testName: 'Partial Delivery - First Delivery',
          passed: false,
          error: `Expected 70, got ${result1.quantity_remaining}`
        });
      }

      // Second partial delivery
      await this.dataSource.query(`
        INSERT INTO delivery_items (id, delivered_quantity, unit_price, total_amount, delivery_date, delivery_id, order_item_id, created_at, updated_at)
        VALUES ('test-delivery-item-2', 25, 10.00, 250.00, '2024-01-25', 'test-delivery-1', 'test-item-1', NOW(), NOW())
      `);

      const [result2] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-1"');

      if (result2.quantity_remaining === 45) {
        this.results.push({ testName: 'Partial Delivery - Second Delivery', passed: true });
      } else {
        this.results.push({
          testName: 'Partial Delivery - Second Delivery',
          passed: false,
          error: `Expected 45, got ${result2.quantity_remaining}`
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Partial Deliveries', passed: false, error: error.message });
    }
  }

  private async testDeliveryModifications() {
    console.log('🔍 Testing delivery modifications...');

    try {
      // Update delivery item quantity
      await this.dataSource.query(`
        UPDATE delivery_items 
        SET delivered_quantity = 40, total_amount = 400.00 
        WHERE id = 'test-delivery-item-1'
      `);

      // Check updated remaining quantity (should be 35: 100 - 40 - 25)
      const [result] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-1"');

      if (result.quantity_remaining === 35) {
        this.results.push({ testName: 'Delivery Modification - Update Quantity', passed: true });
      } else {
        this.results.push({
          testName: 'Delivery Modification - Update Quantity',
          passed: false,
          error: `Expected 35, got ${result.quantity_remaining}`
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Delivery Modifications', passed: false, error: error.message });
    }
  }

  private async testDeliveryCancellations() {
    console.log('🔍 Testing delivery cancellations...');

    try {
      // Delete a delivery item
      await this.dataSource.query('DELETE FROM delivery_items WHERE id = "test-delivery-item-2"');

      // Check restored quantity (should be 60: 35 + 25)
      const [result] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-1"');

      if (result.quantity_remaining === 60) {
        this.results.push({ testName: 'Delivery Cancellation - Delete Item', passed: true });
      } else {
        this.results.push({
          testName: 'Delivery Cancellation - Delete Item',
          passed: false,
          error: `Expected 60, got ${result.quantity_remaining}`
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Delivery Cancellations', passed: false, error: error.message });
    }
  }

  private async testConstraintValidation() {
    console.log('🔍 Testing constraint validation...');

    try {
      // Test 1: Try to deliver more than remaining quantity
      let constraintWorked = false;
      try {
        await this.dataSource.query(`
          INSERT INTO delivery_items (id, delivered_quantity, unit_price, total_amount, delivery_date, delivery_id, order_item_id, created_at, updated_at)
          VALUES ('test-delivery-item-3', 100, 10.00, 1000.00, '2024-01-25', 'test-delivery-1', 'test-item-1', NOW(), NOW())
        `);
      } catch (error) {
        constraintWorked = true;
      }

      this.results.push({
        testName: 'Constraint Validation - Exceed Remaining Quantity',
        passed: constraintWorked,
        error: constraintWorked ? undefined : 'Constraint should have prevented this insertion'
      });

      // Test 2: Try direct update to quantity_remaining
      let protectionWorked = false;
      try {
        await this.dataSource.query('UPDATE order_items SET quantity_remaining = 999 WHERE id = "test-item-2"');
      } catch (error) {
        protectionWorked = true;
      }

      this.results.push({
        testName: 'Constraint Validation - Direct Update Protection',
        passed: protectionWorked,
        error: protectionWorked ? undefined : 'Protection trigger should have prevented this update'
      });

    } catch (error) {
      this.results.push({ testName: 'Constraint Validation', passed: false, error: error.message });
    }
  }

  private async testConcurrentDeliveries() {
    console.log('🔍 Testing concurrent deliveries...');

    try {
      // Create multiple deliveries for the same order item simultaneously
      const promises: Promise<any>[] = [];

      for (let i = 0; i < 3; i++) {
        promises.push(
          this.dataSource.query(`
            INSERT INTO delivery_items (id, delivered_quantity, unit_price, total_amount, delivery_date, delivery_id, order_item_id, created_at, updated_at)
            VALUES ('test-concurrent-${i}', 10, 20.00, 200.00, '2024-01-25', 'test-delivery-1', 'test-item-2', NOW(), NOW())
          `)
        );
      }

      await Promise.all(promises);

      // Check final quantity (should be 20: 50 - 30)
      const [result] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-2"');

      if (result.quantity_remaining === 20) {
        this.results.push({ testName: 'Concurrent Deliveries', passed: true });
      } else {
        this.results.push({
          testName: 'Concurrent Deliveries',
          passed: false,
          error: `Expected 20, got ${result.quantity_remaining}`
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Concurrent Deliveries', passed: false, error: error.message });
    }
  }

  private async testQuantityRecalculation() {
    console.log('🔍 Testing quantity recalculation...');

    try {
      // Manually corrupt quantity_remaining
      await this.dataSource.query(`
        SET @TRIGGER_CONTEXT = 'TEST_CORRUPTION';
        UPDATE order_items SET quantity_remaining = 999 WHERE id = 'test-item-3';
        SET @TRIGGER_CONTEXT = NULL;
      `);

      // Verify corruption
      const [corrupted] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-3"');

      if (corrupted.quantity_remaining === 999) {
        this.results.push({ testName: 'Quantity Recalculation - Setup Corruption', passed: true });
      } else {
        this.results.push({ testName: 'Quantity Recalculation - Setup Corruption', passed: false });
        return;
      }

      // Recalculate (simulate the service method)
      const [orderItem] = await this.dataSource.query(`
        SELECT oi.*, COALESCE(SUM(di.delivered_quantity), 0) as total_delivered
        FROM order_items oi
        LEFT JOIN delivery_items di ON oi.id = di.order_item_id
        WHERE oi.id = 'test-item-3'
        GROUP BY oi.id
      `);

      const correctQuantity = orderItem.quantity_requested - orderItem.total_delivered;

      await this.dataSource.query(`
        SET @TRIGGER_CONTEXT = 'RECALCULATION';
        UPDATE order_items SET quantity_remaining = ? WHERE id = 'test-item-3';
        SET @TRIGGER_CONTEXT = NULL;
      `, [correctQuantity]);

      // Verify fix
      const [fixed] = await this.dataSource.query('SELECT quantity_remaining FROM order_items WHERE id = "test-item-3"');

      if (fixed.quantity_remaining === correctQuantity) {
        this.results.push({ testName: 'Quantity Recalculation - Fix Corruption', passed: true });
      } else {
        this.results.push({
          testName: 'Quantity Recalculation - Fix Corruption',
          passed: false,
          error: `Expected ${correctQuantity}, got ${fixed.quantity_remaining}`
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Quantity Recalculation', passed: false, error: error.message });
    }
  }

  private async testAuditLogging() {
    console.log('🔍 Testing audit logging...');

    try {
      // Check if audit log entries were created
      const auditEntries = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM quantity_audit_log 
        WHERE order_item_id LIKE 'test-item-%'
      `);

      if (auditEntries[0].count > 0) {
        this.results.push({ testName: 'Audit Logging - Entries Created', passed: true });
      } else {
        this.results.push({
          testName: 'Audit Logging - Entries Created',
          passed: false,
          error: 'No audit log entries found'
        });
      }

      // Check audit log structure
      const sampleEntry = await this.dataSource.query(`
        SELECT * FROM quantity_audit_log 
        WHERE order_item_id LIKE 'test-item-%' 
        LIMIT 1
      `);

      if (sampleEntry.length > 0 && sampleEntry[0].operation_type && sampleEntry[0].old_quantity !== undefined) {
        this.results.push({ testName: 'Audit Logging - Correct Structure', passed: true });
      } else {
        this.results.push({
          testName: 'Audit Logging - Correct Structure',
          passed: false,
          error: 'Audit log entries missing required fields'
        });
      }

    } catch (error) {
      this.results.push({ testName: 'Audit Logging', passed: false, error: error.message });
    }
  }

  private reportResults() {
    console.log('\n📊 Test Results Summary:');
    console.log('='.repeat(50));

    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;

    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.testName}`);
      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });

    console.log('='.repeat(50));
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed === 0) {
      console.log('\n🎉 All tests passed! Quantity calculation system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the issues above.');
    }
  }
}

// Run the tests
const tester = new QuantityEdgeCaseTests();
tester.runAllTests()
  .then(() => {
    console.log('\n✅ Edge case testing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Edge case testing failed:', error);
    process.exit(1);
  });

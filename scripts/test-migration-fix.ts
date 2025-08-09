import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class MigrationTester {
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
      migrations: [join(__dirname, '..', 'src', 'database', 'migrations', '*{.ts,.js}')],
      synchronize: false,
      logging: true,
    });
  }

  async testMigrationAndSeeding() {
    try {
      console.log('🔧 Testing migration and seeding process...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Drop all tables (simulate fresh database)
      console.log('🗑️ Dropping all tables...');
      await this.dataSource.dropDatabase();
      await this.dataSource.synchronize(true); // This will recreate the database

      // Run migrations
      console.log('🚀 Running migrations...');
      await this.dataSource.runMigrations();
      console.log('✅ Migrations completed');

      // Check if users table has isDeleted column
      console.log('🔍 Checking users table structure...');
      const usersTableQuery = await this.dataSource.query(`
        DESCRIBE users
      `);

      const hasIsDeletedColumn = usersTableQuery.find((column: any) =>
        column.Field === 'isDeleted'
      );

      if (hasIsDeletedColumn) {
        console.log('✅ isDeleted column exists in users table');
        console.log('Column details:', hasIsDeletedColumn);
      } else {
        console.log('❌ isDeleted column NOT found in users table');
        console.log('Available columns:', usersTableQuery.map((col: any) => col.Field));
      }

      // Check if orders table structure is correct (tax_id should be removed)
      console.log('🔍 Checking orders table structure...');
      const ordersTableQuery = await this.dataSource.query(`
        DESCRIBE orders
      `);

      const hasTaxIdColumn = ordersTableQuery.find((column: any) =>
        column.Field === 'tax_id'
      );

      if (!hasTaxIdColumn) {
        console.log('✅ tax_id column correctly removed from orders table');
      } else {
        console.log('❌ tax_id column still exists in orders table');
        console.log('Column details:', hasTaxIdColumn);
      }

      const hasIsDeletedInOrders = ordersTableQuery.find((column: any) =>
        column.Field === 'isDeleted'
      );

      if (hasIsDeletedInOrders) {
        console.log('✅ isDeleted column exists in orders table');
      } else {
        console.log('❌ isDeleted column NOT found in orders table');
      }

      // Check if delivery_items table has correct structure
      console.log('🔍 Checking delivery_items table structure...');
      const deliveryItemsTableQuery = await this.dataSource.query(`
        DESCRIBE delivery_items
      `);

      const expectedColumns = ['delivered_quantity', 'unit_price', 'total_amount'];
      const missingColumns = expectedColumns.filter(colName =>
        !deliveryItemsTableQuery.find((col: any) => col.Field === colName)
      );

      if (missingColumns.length === 0) {
        console.log('✅ All expected columns exist in delivery_items table');
      } else {
        console.log('❌ Missing columns in delivery_items table:', missingColumns);
      }

      // Check if check constraints exist
      console.log('🔍 Checking delivery_items check constraints...');
      try {
        const constraints = await this.dataSource.query(`
          SELECT CONSTRAINT_NAME, CHECK_CLAUSE
          FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
          WHERE TABLE_NAME = 'delivery_items' AND TABLE_SCHEMA = DATABASE()
        `);

        const expectedConstraints = [
          'CHK_delivered_quantity_positive',
          'CHK_unit_price_non_negative',
          'CHK_total_amount_non_negative'
        ];

        const foundConstraints = constraints.map((c: any) => c.CONSTRAINT_NAME);
        const missingConstraints = expectedConstraints.filter(name =>
          !foundConstraints.includes(name)
        );

        if (missingConstraints.length === 0) {
          console.log('✅ All expected check constraints exist');
          console.log('Found constraints:', foundConstraints);
        } else {
          console.log('❌ Missing check constraints:', missingConstraints);
        }
      } catch (error) {
        console.log('⚠️ Could not check constraints:', error.message);
      }

      // Check if database triggers exist
      console.log('🔍 Checking database triggers...');
      try {
        const triggers = await this.dataSource.query(`
          SELECT TRIGGER_NAME
          FROM INFORMATION_SCHEMA.TRIGGERS
          WHERE TABLE_NAME = 'delivery_items' AND TABLE_SCHEMA = DATABASE()
        `);

        const expectedTriggers = [
          'validate_delivery_quantity_before_insert',
          'update_quantity_remaining_after_delivery_insert',
          'update_quantity_remaining_after_delivery_update',
          'update_quantity_remaining_after_delivery_delete'
        ];

        const foundTriggers = triggers.map((t: any) => t.TRIGGER_NAME);
        const missingTriggers = expectedTriggers.filter(name =>
          !foundTriggers.includes(name)
        );

        if (missingTriggers.length === 0) {
          console.log('✅ All expected triggers exist');
          console.log('Found triggers:', foundTriggers);
        } else {
          console.log('❌ Missing triggers:', missingTriggers);
        }
      } catch (error) {
        console.log('⚠️ Could not check triggers:', error.message);
      }

      // Test creating a user (simulating seeding)
      console.log('🌱 Testing user creation (simulating seeding)...');
      const testResult = await this.dataSource.query(`
        INSERT INTO users (id, email, name, password, role, status, isDeleted, created_at, updated_at)
        VALUES ('test-user-123', 'test@example.com', 'Test User', 'hashed', 'admin', 'active', false, NOW(), NOW())
      `);

      console.log('✅ User creation successful');

      // Verify the user was created with correct isDeleted value
      const createdUser = await this.dataSource.query(`
        SELECT id, email, name, role, status, isDeleted FROM users WHERE id = 'test-user-123'
      `);

      console.log('Created user:', createdUser[0]);

      console.log('🎉 Migration and seeding test completed successfully!');

    } catch (error) {
      console.error('❌ Error during migration/seeding test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new MigrationTester();
tester.testMigrationAndSeeding()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

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

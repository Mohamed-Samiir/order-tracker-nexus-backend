import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class OrdersQueryTester {
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

  async testOrdersQueryFix() {
    try {
      console.log('🔧 Testing Orders entity column mapping fix...');
      
      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Use transaction for all tests
      await this.dataSource.transaction(async (manager) => {
        // Test 1: Create test data
        console.log('🔍 Test 1: Creating test data...');
        
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-orders@example.com',
          name: 'Test Orders User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
        });
        await manager.save(testUser);

        // Create test orders
        const testOrder1 = manager.create(Order, {
          orderId: 'TEST-ORDERS-001',
          status: OrderStatus.PROCESSING,
          totalItems: 5,
          totalCost: 250.00,
          createdBy: testUser,
        });

        const testOrder2 = manager.create(Order, {
          orderId: 'TEST-ORDERS-002',
          status: OrderStatus.PENDING,
          totalItems: 3,
          totalCost: 150.00,
          createdBy: testUser,
        });

        await manager.save([testOrder1, testOrder2]);
        console.log('✅ Test data created successfully');

        // Test 2: Test the problematic query that was causing the error
        console.log('🔍 Test 2: Testing Orders service query builder...');
        
        // This replicates the query from OrdersService.createQueryBuilder()
        const queryBuilder = manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.createdBy', 'createdBy')
          .where('order.isDeleted = :isDeleted', { isDeleted: false })
          .select([
            'order.id',
            'order.orderId',  // This was causing the "Unknown column 'order.orderId'" error
            'order.status',
            'order.totalItems',
            'order.totalCost',
            'order.deliveredQuantity',
            'order.remainingQuantity',
            'order.fileName',
            'order.isDeleted',
            'order.createdAt',
            'order.updatedAt',
            'createdBy.id',
            'createdBy.name',
            'createdBy.email',
          ]);

        const orders = await queryBuilder.getMany();
        console.log(`✅ Query executed successfully, found ${orders.length} orders`);

        if (orders.length >= 2) {
          console.log('Sample order data:');
          console.log({
            id: orders[0].id,
            orderId: orders[0].orderId,
            status: orders[0].status,
            totalItems: orders[0].totalItems,
            totalCost: orders[0].totalCost,
            createdAt: orders[0].createdAt,
          });
        }

        // Test 3: Test pagination query (the one that was failing)
        console.log('🔍 Test 3: Testing paginated query...');
        
        const paginatedQuery = queryBuilder
          .orderBy('order.createdAt', 'DESC')
          .skip(0)
          .take(10);

        const paginatedOrders = await paginatedQuery.getMany();
        console.log(`✅ Paginated query executed successfully, found ${paginatedOrders.length} orders`);

        // Test 4: Test search functionality
        console.log('🔍 Test 4: Testing search functionality...');
        
        const searchQuery = manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.createdBy', 'createdBy')
          .where('order.isDeleted = :isDeleted', { isDeleted: false })
          .andWhere('order.orderId LIKE :search', { search: '%TEST-ORDERS%' })
          .select([
            'order.id',
            'order.orderId',
            'order.status',
            'order.totalItems',
            'order.totalCost',
            'createdBy.id',
            'createdBy.name',
          ]);

        const searchResults = await searchQuery.getMany();
        console.log(`✅ Search query executed successfully, found ${searchResults.length} orders`);

        // Test 5: Test sorting by different fields
        console.log('🔍 Test 5: Testing sorting by different fields...');
        
        const sortTests = [
          { field: 'createdAt', order: 'DESC' as const },
          { field: 'orderId', order: 'ASC' as const },
          { field: 'totalCost', order: 'DESC' as const },
          { field: 'status', order: 'ASC' as const },
        ];

        for (const sortTest of sortTests) {
          const sortedQuery = manager
            .getRepository(Order)
            .createQueryBuilder('order')
            .where('order.isDeleted = :isDeleted', { isDeleted: false })
            .orderBy(`order.${sortTest.field}`, sortTest.order)
            .select(['order.id', 'order.orderId', `order.${sortTest.field}`]);

          const sortedResults = await sortedQuery.getMany();
          console.log(`✅ Sort by ${sortTest.field} ${sortTest.order}: ${sortedResults.length} results`);
        }

        // Test 6: Test the exact query that was failing in the error
        console.log('🔍 Test 6: Testing the exact failing query pattern...');
        
        // This replicates the exact query structure from the error message
        const exactQuery = manager
          .getRepository(Order)
          .createQueryBuilder('order')
          .leftJoinAndSelect('order.createdBy', 'createdBy')
          .where('order.isDeleted = false')
          .orderBy('order.createdAt', 'DESC')
          .addOrderBy('order.id', 'ASC')
          .skip(0)
          .take(10);

        const exactResults = await exactQuery.getMany();
        console.log(`✅ Exact failing query pattern executed successfully: ${exactResults.length} results`);

        console.log('🎉 All Orders entity column mapping tests passed!');

        // Cleanup test data
        console.log('🧹 Cleaning up test data...');
        await manager.delete(Order, [testOrder1.id, testOrder2.id]);
        await manager.delete(User, testUser.id);
        console.log('✅ Test data cleaned up');
      });

    } catch (error) {
      console.error('❌ Error during Orders query test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new OrdersQueryTester();
tester.testOrdersQueryFix()
  .then(() => {
    console.log('✅ Orders query test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Orders query test failed:', error);
    process.exit(1);
  });

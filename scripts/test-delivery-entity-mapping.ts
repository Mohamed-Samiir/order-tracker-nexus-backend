import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { Delivery } from '../src/deliveries/entities/delivery.entity';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class DeliveryEntityMappingTester {
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

  async testDeliveryEntityMapping() {
    try {
      console.log('🔧 Testing Delivery entity column mappings...');

      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Test 1: Simple SELECT query to verify column mappings
      console.log('🔍 Test 1: Testing basic SELECT query with timestamp columns...');

      const deliveryRepository = this.dataSource.getRepository(Delivery);

      // This query should work without errors if column mappings are correct
      const deliveries = await deliveryRepository
        .createQueryBuilder('delivery')
        .select([
          'delivery.id',
          'delivery.deliveryId',
          'delivery.deliveryDate',
          'delivery.status',
          'delivery.createdAt',  // This should map to created_at
          'delivery.updatedAt'   // This should map to updated_at
        ])
        .limit(5)
        .getMany();

      console.log(`✅ Successfully queried ${deliveries.length} delivery records`);

      if (deliveries.length > 0) {
        console.log('Sample delivery record:');
        console.log({
          id: deliveries[0].id,
          deliveryId: deliveries[0].deliveryId,
          deliveryDate: deliveries[0].deliveryDate,
          status: deliveries[0].status,
          createdAt: deliveries[0].createdAt,
          updatedAt: deliveries[0].updatedAt
        });
      }

      // Test 2: Test ORDER BY with timestamp columns
      console.log('🔍 Test 2: Testing ORDER BY with timestamp columns...');

      const orderedDeliveries = await deliveryRepository
        .createQueryBuilder('delivery')
        .select(['delivery.id', 'delivery.createdAt'])
        .orderBy('delivery.createdAt', 'DESC')  // This should work with created_at column
        .limit(3)
        .getMany();

      console.log(`✅ Successfully ordered by createdAt: ${orderedDeliveries.length} records`);

      // Test 3: Test WHERE clause with timestamp columns
      console.log('🔍 Test 3: Testing WHERE clause with timestamp columns...');

      const recentDeliveries = await deliveryRepository
        .createQueryBuilder('delivery')
        .select(['delivery.id', 'delivery.createdAt'])
        .where('delivery.createdAt >= :date', {
          date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        })
        .getMany();

      console.log(`✅ Successfully filtered by createdAt: ${recentDeliveries.length} records`);

      // Test 4: Test with relations (if any exist)
      console.log('🔍 Test 4: Testing query with relations...');

      const deliveriesWithRelations = await deliveryRepository
        .createQueryBuilder('delivery')
        .leftJoinAndSelect('delivery.order', 'order')
        .leftJoinAndSelect('delivery.createdBy', 'user')
        .select([
          'delivery.id',
          'delivery.createdAt',
          'delivery.updatedAt',
          'order.id',
          'user.id'
        ])
        .limit(2)
        .getMany();

      console.log(`✅ Successfully queried with relations: ${deliveriesWithRelations.length} records`);

      // Test 5: Verify database schema consistency
      console.log('🔍 Test 5: Verifying database schema consistency...');

      // Check actual database columns
      const deliveriesSchema = await this.dataSource.query(`DESCRIBE deliveries`);
      const usersSchema = await this.dataSource.query(`DESCRIBE users`);
      const deliveryItemsSchema = await this.dataSource.query(`DESCRIBE delivery_items`);

      console.log('📋 Database Schema Summary:');
      console.log('Deliveries table timestamp columns:',
        deliveriesSchema
          .filter((col: any) => col.Field.includes('At') || col.Field.includes('_at'))
          .map((col: any) => col.Field)
      );
      console.log('Users table timestamp columns:',
        usersSchema
          .filter((col: any) => col.Field.includes('At') || col.Field.includes('_at'))
          .map((col: any) => col.Field)
      );
      console.log('DeliveryItems table timestamp columns:',
        deliveryItemsSchema
          .filter((col: any) => col.Field.includes('At') || col.Field.includes('_at'))
          .map((col: any) => col.Field)
      );

      console.log('🎉 All Delivery entity column mapping tests passed!');

    } catch (error) {
      console.error('❌ Error during Delivery entity mapping test:', error);

      // Check if it's the specific column mapping error we're trying to fix
      if (error.message && error.message.includes('createdAt')) {
        console.error('🚨 Column mapping issue detected: createdAt column mapping failed');
      }
      if (error.message && error.message.includes('updatedAt')) {
        console.error('🚨 Column mapping issue detected: updatedAt column mapping failed');
      }

      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new DeliveryEntityMappingTester();
tester.testDeliveryEntityMapping()
  .then(() => {
    console.log('✅ Delivery entity mapping test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Delivery entity mapping test failed:', error);
    process.exit(1);
  });

import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';
import { User, UserRole, UserStatus } from '../src/users/entities/user.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { Delivery, DeliveryStatus } from '../src/deliveries/entities/delivery.entity';
import { DeliveryItem } from '../src/deliveries/entities/delivery-item.entity';
import { DeliveriesService } from '../src/deliveries/deliveries.service';
import { CreateDeliveryDto } from '../src/deliveries/dto/create-delivery.dto';

// Load environment variables
config({ path: join(__dirname, '../.env') });

class ZeroDeliveryQuantityTester {
  private dataSource: DataSource;
  private deliveriesService: DeliveriesService;

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

  async testZeroDeliveryQuantity() {
    try {
      console.log('🔧 Testing zero delivery quantity validation...');
      
      // Initialize connection
      await this.dataSource.initialize();
      console.log('✅ Database connection established');

      // Initialize deliveries service
      const orderRepository = this.dataSource.getRepository(Order);
      const orderItemRepository = this.dataSource.getRepository(OrderItem);
      const deliveryRepository = this.dataSource.getRepository(Delivery);
      const deliveryItemRepository = this.dataSource.getRepository(DeliveryItem);
      
      this.deliveriesService = new DeliveriesService(
        deliveryRepository,
        deliveryItemRepository,
        orderRepository,
        orderItemRepository,
        this.dataSource
      );

      // Test in transaction to avoid affecting real data
      await this.dataSource.transaction(async (manager) => {
        // Create test user
        const testUser = manager.create(User, {
          email: 'test-zero-quantity@example.com',
          name: 'Test Zero Quantity User',
          password: 'hashed_password',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          isDeleted: false,
        });
        await manager.save(testUser);
        console.log('✅ Test user created');

        // Create test order
        const testOrder = manager.create(Order, {
          orderId: 'ZERO-QUANTITY-001',
          status: OrderStatus.PROCESSING,
          totalItems: 10,
          totalCost: 500.00,
          isDeleted: false,
          createdBy: testUser,
        });
        await manager.save(testOrder);
        console.log('✅ Test order created');

        // Create test order items
        const testOrderItem1 = manager.create(OrderItem, {
          asin: 'ZERO123456789',
          brandName: 'Zero Test Brand',
          modelNumber: '1234567890123',
          title: 'Zero Test Product 1',
          requestingDate: new Date(),
          quantityRequested: 10,
          quantityRemaining: 10,
          unitCost: 50.00,
          totalCost: 500.00,
          order: testOrder,
        });
        await manager.save(testOrderItem1);

        const testOrderItem2 = manager.create(OrderItem, {
          asin: 'ZERO987654321',
          brandName: 'Zero Test Brand',
          modelNumber: '9876543210987',
          title: 'Zero Test Product 2',
          requestingDate: new Date(),
          quantityRequested: 5,
          quantityRemaining: 5,
          unitCost: 30.00,
          totalCost: 150.00,
          order: testOrder,
        });
        await manager.save(testOrderItem2);
        console.log('✅ Test order items created');

        // Test 1: Create delivery with zero quantity (should be allowed)
        console.log('🔍 Test 1: Creating delivery with zero delivered quantity...');
        
        const createDeliveryDtoWithZero: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem1.id,
              deliveredQuantity: 0, // Zero quantity should be allowed
              unitPrice: 50.00,
            },
            {
              orderItemId: testOrderItem2.id,
              deliveredQuantity: 3, // Positive quantity
              unitPrice: 30.00,
            },
          ],
        };

        const deliveryWithZero = await this.deliveriesService.create(createDeliveryDtoWithZero, testUser);
        console.log('✅ Delivery with zero quantity created successfully:', deliveryWithZero.deliveryId);

        // Verify the delivery was created correctly
        const savedDelivery = await manager.findOne(Delivery, {
          where: { id: deliveryWithZero.id },
          relations: ['deliveryItems', 'deliveryItems.orderItem'],
        });

        if (!savedDelivery) {
          throw new Error('Delivery not found after creation');
        }

        const zeroQuantityItem = savedDelivery.deliveryItems.find(
          item => item.orderItem.id === testOrderItem1.id
        );
        const positiveQuantityItem = savedDelivery.deliveryItems.find(
          item => item.orderItem.id === testOrderItem2.id
        );

        if (zeroQuantityItem?.deliveredQuantity !== 0) {
          throw new Error(`Expected zero quantity, got ${zeroQuantityItem?.deliveredQuantity}`);
        }

        if (positiveQuantityItem?.deliveredQuantity !== 3) {
          throw new Error(`Expected quantity 3, got ${positiveQuantityItem?.deliveredQuantity}`);
        }

        console.log('✅ Zero quantity delivery item saved correctly');

        // Test 2: Verify quantities were updated correctly
        console.log('🔍 Test 2: Verifying quantity calculations with zero delivery...');
        
        const updatedOrderItem1 = await manager.findOne(OrderItem, { where: { id: testOrderItem1.id } });
        const updatedOrderItem2 = await manager.findOne(OrderItem, { where: { id: testOrderItem2.id } });

        // Item 1: 10 - 0 = 10 (no change)
        if (updatedOrderItem1?.quantityRemaining !== 10) {
          throw new Error(`Expected remaining quantity 10 for item 1, got ${updatedOrderItem1?.quantityRemaining}`);
        }

        // Item 2: 5 - 3 = 2
        if (updatedOrderItem2?.quantityRemaining !== 2) {
          throw new Error(`Expected remaining quantity 2 for item 2, got ${updatedOrderItem2?.quantityRemaining}`);
        }

        console.log('✅ Quantity calculations correct with zero delivery');

        // Test 3: Test negative quantity (should be rejected)
        console.log('🔍 Test 3: Testing negative quantity rejection...');
        
        const createDeliveryDtoWithNegative: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem1.id,
              deliveredQuantity: -1, // Negative quantity should be rejected
              unitPrice: 50.00,
            },
          ],
        };

        try {
          await this.deliveriesService.create(createDeliveryDtoWithNegative, testUser);
          throw new Error('Negative quantity should have been rejected');
        } catch (error: any) {
          if (error.message.includes('zero or positive')) {
            console.log('✅ Negative quantity correctly rejected');
          } else {
            throw error;
          }
        }

        // Test 4: Test null/undefined quantity (should be rejected)
        console.log('🔍 Test 4: Testing null/undefined quantity rejection...');
        
        const createDeliveryDtoWithNull: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem1.id,
              deliveredQuantity: null as any, // Null quantity should be rejected
              unitPrice: 50.00,
            },
          ],
        };

        try {
          await this.deliveriesService.create(createDeliveryDtoWithNull, testUser);
          throw new Error('Null quantity should have been rejected');
        } catch (error: any) {
          if (error.message.includes('zero or positive')) {
            console.log('✅ Null quantity correctly rejected');
          } else {
            throw error;
          }
        }

        // Test 5: Test decimal quantity (should be rejected)
        console.log('🔍 Test 5: Testing decimal quantity rejection...');
        
        const createDeliveryDtoWithDecimal: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem1.id,
              deliveredQuantity: 2.5, // Decimal quantity should be rejected
              unitPrice: 50.00,
            },
          ],
        };

        try {
          await this.deliveriesService.create(createDeliveryDtoWithDecimal, testUser);
          throw new Error('Decimal quantity should have been rejected');
        } catch (error: any) {
          if (error.message.includes('whole number')) {
            console.log('✅ Decimal quantity correctly rejected');
          } else {
            throw error;
          }
        }

        // Test 6: Test multiple zero quantities
        console.log('🔍 Test 6: Testing multiple zero quantities...');
        
        const createDeliveryDtoAllZeros: CreateDeliveryDto = {
          orderId: testOrder.id,
          deliveryDate: new Date().toISOString().split('T')[0],
          status: DeliveryStatus.DELIVERED,
          items: [
            {
              orderItemId: testOrderItem1.id,
              deliveredQuantity: 0,
              unitPrice: 50.00,
            },
            {
              orderItemId: testOrderItem2.id,
              deliveredQuantity: 0,
              unitPrice: 30.00,
            },
          ],
        };

        const deliveryAllZeros = await this.deliveriesService.create(createDeliveryDtoAllZeros, testUser);
        console.log('✅ Delivery with all zero quantities created successfully:', deliveryAllZeros.deliveryId);

        console.log('🎉 All zero delivery quantity tests passed!');
        console.log('🎯 Zero delivery quantity validation is working correctly:');
        console.log('  ✅ Zero (0) is accepted as valid delivered quantity');
        console.log('  ✅ Negative numbers are rejected');
        console.log('  ✅ Null/undefined values are rejected');
        console.log('  ✅ Decimal numbers are rejected');
        console.log('  ✅ Quantity calculations work correctly with zero deliveries');
      });

    } catch (error) {
      console.error('❌ Error during zero delivery quantity test:', error);
      throw error;
    } finally {
      if (this.dataSource.isInitialized) {
        await this.dataSource.destroy();
      }
    }
  }
}

// Run the test
const tester = new ZeroDeliveryQuantityTester();
tester.testZeroDeliveryQuantity()
  .then(() => {
    console.log('✅ Zero delivery quantity test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Zero delivery quantity test failed:', error);
    process.exit(1);
  });

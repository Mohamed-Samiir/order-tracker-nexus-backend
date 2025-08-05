import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Delivery } from '../deliveries/entities/delivery.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Delivery]),
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype.includes('spreadsheet') ||
          file.mimetype.includes('excel')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only Excel files are allowed'), false);
        }
      },
    }),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule { }

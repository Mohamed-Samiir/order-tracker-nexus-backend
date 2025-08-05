import { ApiProperty } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { DeliveryStatus } from '../entities/delivery.entity';

export class DeliveryItemResponseDto {
  @ApiProperty({
    example: 'delivery-item-uuid',
    description: 'Delivery item ID',
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'B09MNT3YQT',
    description: 'Product ASIN from order item',
  })
  @Expose()
  @Transform(({ obj }) => obj.orderItem?.asin)
  asin: string;

  @ApiProperty({
    example: 'Apple',
    description: 'Brand name from order item',
  })
  @Expose()
  @Transform(({ obj }) => obj.orderItem?.brandName)
  brandName: string;

  @ApiProperty({
    example: 'iPhone 13',
    description: 'Model number from order item',
  })
  @Expose()
  @Transform(({ obj }) => obj.orderItem?.modelNumber)
  modelNumber: string;

  @ApiProperty({
    example: 'Apple iPhone 13 Pro Max 128GB',
    description: 'Product title from order item',
  })
  @Expose()
  @Transform(({ obj }) => obj.orderItem?.title)
  title: string;

  @ApiProperty({
    example: 25,
    description: 'Quantity delivered',
  })
  @Expose()
  deliveredQuantity: number;

  @ApiProperty({
    example: 10.99,
    description: 'Unit price at delivery',
  })
  @Expose()
  unitPrice: number;

  @ApiProperty({
    example: 274.75,
    description: 'Total cost for this delivery item',
  })
  @Expose()
  totalAmount: number;

  @ApiProperty({
    example: '2024-01-25',
    description: 'Delivery date for this item',
  })
  @Expose()
  deliveryDate: Date;
}

export class OrderSummaryDto {
  @ApiProperty({
    example: 'order-uuid',
    description: 'Order ID',
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'ORD-000001',
    description: 'Human-readable order ID',
  })
  @Expose()
  orderId: string;
}

export class UserSummaryDto {
  @ApiProperty({
    example: 'user-uuid',
    description: 'User ID',
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'User name',
  })
  @Expose()
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email',
  })
  @Expose()
  email: string;
}

export class DeliveryResponseDto {
  @ApiProperty({
    example: 'delivery-uuid',
    description: 'Internal delivery ID (GUID)',
  })
  @Expose()
  id: string;

  @ApiProperty({
    example: 'DEL-000001',
    description: 'Human-readable delivery ID',
  })
  @Expose()
  deliveryId: string;

  @ApiProperty({
    example: '2024-01-25',
    description: 'Delivery date',
  })
  @Expose()
  deliveryDate: Date;

  @ApiProperty({
    enum: DeliveryStatus,
    example: DeliveryStatus.DELIVERED,
    description: 'Delivery status',
  })
  @Expose()
  status: DeliveryStatus;

  @ApiProperty({
    type: OrderSummaryDto,
    description: 'Order information',
  })
  @Expose()
  @Type(() => OrderSummaryDto)
  order: OrderSummaryDto;

  @ApiProperty({
    type: UserSummaryDto,
    description: 'User who created the delivery',
  })
  @Expose()
  @Type(() => UserSummaryDto)
  createdBy: UserSummaryDto;

  @ApiProperty({
    type: [DeliveryItemResponseDto],
    description: 'Delivery items',
  })
  @Expose()
  @Type(() => DeliveryItemResponseDto)
  deliveryItems: DeliveryItemResponseDto[];

  @ApiProperty({
    example: '2024-01-25T10:30:00Z',
    description: 'Creation timestamp',
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    example: '2024-01-25T10:30:00Z',
    description: 'Last update timestamp',
  })
  @Expose()
  updatedAt: Date;
}

export class PaginatedDeliveryResponseDto {
  @ApiProperty({
    type: [DeliveryResponseDto],
    description: 'Array of deliveries',
  })
  data: DeliveryResponseDto[];

  @ApiProperty({
    example: 150,
    description: 'Total number of deliveries',
  })
  total: number;

  @ApiProperty({
    example: 1,
    description: 'Current page number',
  })
  page: number;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
  })
  limit: number;

  @ApiProperty({
    example: 15,
    description: 'Total number of pages',
  })
  totalPages: number;
}

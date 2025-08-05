import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryStatus } from '../entities/delivery.entity';

export class ExcelImportDeliveryDto {
  @ApiProperty({
    example: 'uuid-order-id',
    description: 'Order ID to create delivery for (required)',
  })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty({
    example: '2024-01-25',
    description: 'Delivery date (YYYY-MM-DD)',
  })
  @IsDateString()
  deliveryDate: string;

  @ApiProperty({
    example: 'delivered',
    description: 'Delivery status',
    enum: DeliveryStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;
}

export class ExcelImportDeliveryResponseDto {
  @ApiProperty({
    example: true,
    description: 'Success status',
  })
  success: boolean;

  @ApiProperty({
    example: 'Delivery imported successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    example: {
      deliveryId: 'uuid-delivery-id',
      orderId: 'ORD-2024-001',
      totalItems: 25,
      itemsProcessed: 25,
      itemsSkipped: 0,
      totalRevenue: 7499.75,
      errors: [],
    },
    description: 'Import details',
  })
  data: {
    deliveryId: string;
    orderId: string;
    totalItems: number;
    itemsProcessed: number;
    itemsSkipped: number;
    totalRevenue: number;
    errors: string[];
  };
}

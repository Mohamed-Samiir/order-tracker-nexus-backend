import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsDateString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryStatus } from '../entities/delivery.entity';
import { CreateDeliveryItemDto } from './create-delivery-item.dto';

export class CreateDeliveryDto {
  @ApiProperty({
    example: 'uuid-order-id',
    description: 'Order ID this delivery belongs to',
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
    example: 'completed',
    description: 'Delivery status',
    enum: DeliveryStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiProperty({
    type: [CreateDeliveryItemDto],
    description: 'Array of delivery items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateDeliveryItemDto)
  items: CreateDeliveryItemDto[];
}

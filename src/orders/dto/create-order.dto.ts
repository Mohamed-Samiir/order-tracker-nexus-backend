import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '../entities/order.entity';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    example: 'ORD-2024-001',
    description: 'Unique order identifier (auto-generated if not provided)',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // Convert empty strings, null, and "undefined" string to undefined
    if (
      value === '' ||
      value === null ||
      value === 'undefined' ||
      value === undefined
    ) {
      return undefined;
    }
    return value;
  })
  @ValidateIf((o) => {
    // Only validate if orderId exists and is not empty
    return (
      o.orderId !== undefined &&
      o.orderId !== null &&
      o.orderId !== '' &&
      o.orderId !== 'undefined'
    );
  })
  // @IsString({ message: 'orderId must be a valid string' })
  orderId?: string;

  @ApiProperty({
    example: 'pending',
    description: 'Order status',
    enum: OrderStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiProperty({
    example: 'order_ORD-2024-001_1703000000000.xlsx',
    description: 'Original Excel file name',
    required: false,
  })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiProperty({
    type: [CreateOrderItemDto],
    description: 'Array of order items',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}

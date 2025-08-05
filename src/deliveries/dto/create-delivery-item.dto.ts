import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  Min,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateDeliveryItemDto {
  @ApiProperty({
    example: 'uuid-order-item-id',
    description: 'Order item ID this delivery item belongs to',
  })
  @IsString()
  @IsNotEmpty()
  orderItemId: string;

  @ApiProperty({
    example: 25,
    description: 'Quantity delivered',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  deliveredQuantity: number;

  @ApiProperty({
    example: 299.99,
    description: 'Unit price at delivery',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiProperty({
    example: '2024-01-25',
    description: 'Delivery date (YYYY-MM-DD) - optional, will use parent delivery date if not provided',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  deliveryDate?: string;
}

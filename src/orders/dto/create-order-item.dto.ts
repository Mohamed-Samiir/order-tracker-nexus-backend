import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsDateString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOrderItemDto {
  @ApiProperty({
    example: 'B08N5WRWNW',
    description: 'Amazon Standard Identification Number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  asin: string;

  @ApiProperty({
    example: 'Sony',
    description: 'Brand name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  brandName: string;

  @ApiProperty({
    example: '1234567890123',
    description: 'Model number (13 digits)',
  })
  @IsString()
  @IsNotEmpty()
  @Length(13, 13)
  modelNumber: string;

  @ApiProperty({
    example: 'Sony WH-1000XM4 Wireless Headphones',
    description: 'Product title',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({
    example: '2024-01-20',
    description: 'Requesting date (YYYY-MM-DD)',
  })
  @IsDateString()
  requestingDate: string;

  @ApiProperty({
    example: 50,
    description: 'Quantity requested',
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  quantityRequested: number;

  @ApiProperty({
    example: 299.99,
    description: 'Unit cost',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost: number;
}

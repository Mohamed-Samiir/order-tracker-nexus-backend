import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { DeliveryStatus } from '../entities/delivery.entity';

export class GetDeliveriesDto {
  @ApiProperty({
    example: 1,
    description: 'Page number',
    required: false,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiProperty({
    example: 10,
    description: 'Number of items per page',
    required: false,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 10;

  @ApiProperty({
    example: 'ORD-2024',
    description: 'Search by order ID',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    example: 'completed',
    description: 'Filter by status',
    enum: DeliveryStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @ApiProperty({
    example: '2024-01-01',
    description: 'Filter by start date (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    example: '2024-12-31',
    description: 'Filter by end date (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({
    example: 'deliveryDate',
    description: 'Sort field',
    required: false,
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'deliveryDate';

  @ApiProperty({
    example: 'DESC',
    description: 'Sort order',
    required: false,
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

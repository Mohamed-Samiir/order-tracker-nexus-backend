import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class GetAnalyticsDto {
  @ApiPropertyOptional({
    description: 'Start date for analytics period (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics period (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Time period for grouping data',
    enum: ['day', 'week', 'month', 'quarter', 'year'],
    default: 'month',
  })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'quarter', 'year'])
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';

  @ApiPropertyOptional({
    description: 'Limit number of results',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Category filter for analytics',
    example: 'Electronics',
  })
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({
    description: 'Brand filter for analytics',
    example: 'Sony',
  })
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Status filter for analytics',
    enum: ['pending', 'processing', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsIn(['pending', 'processing', 'completed', 'cancelled'])
  status?: string;
}

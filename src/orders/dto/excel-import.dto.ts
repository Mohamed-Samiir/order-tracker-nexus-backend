import { IsString, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ExcelImportDto {
  @ApiProperty({
    example: 'ORD-2024-001',
    description:
      'Order ID for the imported items (auto-generated if not provided)',
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
}

export class ExcelImportResponseDto {
  @ApiProperty({
    example: true,
    description: 'Success status',
  })
  success: boolean;

  @ApiProperty({
    example: 'Order imported successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    example: {
      orderId: 'ORD-2024-001',
      totalItems: 150,
      itemsProcessed: 150,
      itemsSkipped: 0,
      errors: [],
    },
    description: 'Import details',
  })
  data: {
    orderId: string;
    totalItems: number;
    itemsProcessed: number;
    itemsSkipped: number;
    errors: string[];
  };
}

export class ExcelPreviewResponseDto {
  @ApiProperty({
    example: true,
    description: 'Success status',
  })
  success: boolean;

  @ApiProperty({
    example: 'Excel file processed successfully',
    description: 'Response message',
  })
  message: string;

  @ApiProperty({
    example: {
      orderId: 'ORD-2024-001',
      totalItems: 150,
      itemsProcessed: 150,
      itemsSkipped: 0,
      errors: [],
      items: [
        {
          asin: 'B08N5WRWNW',
          brandName: 'Example Brand',
          modelNumber: '1234567890123',
          title: 'Example Product Title',
          requestingDate: '2024-01-15',
          quantityRequested: 10,
          unitCost: 25.99,
        },
      ],
    },
    description: 'Preview details with parsed items',
  })
  data: {
    orderId: string;
    totalItems: number;
    itemsProcessed: number;
    itemsSkipped: number;
    errors: string[];
    items: any[];
  };
}

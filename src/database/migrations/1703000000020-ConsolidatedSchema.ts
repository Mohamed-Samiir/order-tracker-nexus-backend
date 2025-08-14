import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class ConsolidatedSchema1703000000020 implements MigrationInterface {
  name = 'ConsolidatedSchema1703000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🚀 Creating consolidated database schema with snake_case naming...');

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'uploader', 'viewer'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive'],
            default: "'active'",
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'last_login',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { name: 'IDX_USER_EMAIL', columnNames: ['email'] },
          { name: 'IDX_USER_ROLE', columnNames: ['role'] },
          { name: 'IDX_USER_STATUS', columnNames: ['status'] },
          { name: 'IDX_USER_IS_DELETED', columnNames: ['is_deleted'] },
        ],
      }),
      true,
    );

    // Create orders table
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'order_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'total_items',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'delivered_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'remaining_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'file_name',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
            isNullable: false,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { name: 'IDX_ORDER_ID', columnNames: ['order_id'] },
          { name: 'IDX_ORDER_STATUS', columnNames: ['status'] },
          { name: 'IDX_ORDER_IS_DELETED', columnNames: ['is_deleted'] },
          { name: 'IDX_ORDER_CREATED_BY', columnNames: ['created_by'] },
          { name: 'IDX_ORDER_CREATED_AT', columnNames: ['created_at'] },
        ],
        foreignKeys: [
          {
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Create order_items table
    await queryRunner.createTable(
      new Table({
        name: 'order_items',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'asin',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'brand_name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'model_number',
            type: 'varchar',
            length: '13',
          },
          {
            name: 'title',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'requesting_date',
            type: 'date',
          },
          {
            name: 'quantity_requested',
            type: 'int',
          },
          {
            name: 'quantity_remaining',
            type: 'int',
            default: 0,
          },
          {
            name: 'unit_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'total_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'order_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_ORDER_ITEM_MODEL_NUMBER',
            columnNames: ['model_number'],
          },
          {
            name: 'IDX_ORDER_ITEM_QUANTITY_REMAINING',
            columnNames: ['quantity_remaining'],
          },
          { name: 'IDX_ORDER_ITEM_ORDER_ID', columnNames: ['order_id'] },
        ],
        foreignKeys: [
          {
            columnNames: ['order_id'],
            referencedTableName: 'orders',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        checks: [
          {
            name: 'CHK_quantity_remaining_non_negative',
            expression: 'quantity_remaining >= 0',
          },
          {
            name: 'CHK_quantity_remaining_not_exceed_requested',
            expression: 'quantity_remaining <= quantity_requested',
          },
        ],
      }),
      true,
    );

    // Create deliveries table
    await queryRunner.createTable(
      new Table({
        name: 'deliveries',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'delivery_id',
            type: 'varchar',
            length: '20',
            isUnique: true,
            comment: 'Human-readable delivery identifier (e.g., DEL-000001)',
          },
          {
            name: 'delivery_date',
            type: 'date',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'in-transit', 'delivered', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'order_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { name: 'IDX_DELIVERY_DELIVERY_ID', columnNames: ['delivery_id'] },
          { name: 'IDX_DELIVERY_DATE', columnNames: ['delivery_date'] },
          { name: 'IDX_DELIVERY_STATUS', columnNames: ['status'] },
          { name: 'IDX_DELIVERY_ORDER_ID', columnNames: ['order_id'] },
          { name: 'IDX_DELIVERY_CREATED_BY', columnNames: ['created_by'] },
        ],
        foreignKeys: [
          {
            columnNames: ['order_id'],
            referencedTableName: 'orders',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
          {
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );

    // Create delivery_items table
    await queryRunner.createTable(
      new Table({
        name: 'delivery_items',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'delivered_quantity',
            type: 'int',
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'total_amount',
            type: 'decimal',
            precision: 10,
            scale: 2,
          },
          {
            name: 'delivery_date',
            type: 'date',
            isNullable: true,
            comment: 'Date when the delivery item was delivered',
          },
          {
            name: 'delivery_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'order_item_id',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          {
            name: 'IDX_DELIVERY_ITEM_DELIVERY_ID',
            columnNames: ['delivery_id'],
          },
          {
            name: 'IDX_DELIVERY_ITEM_ORDER_ITEM_ID',
            columnNames: ['order_item_id'],
          },
          {
            name: 'IDX_DELIVERY_ITEM_DELIVERY_DATE',
            columnNames: ['delivery_date'],
          },
        ],
        uniques: [
          {
            name: 'UNQ_DELIVERY_ORDER_ITEM',
            columnNames: ['delivery_id', 'order_item_id'],
          },
        ],
        foreignKeys: [
          {
            columnNames: ['delivery_id'],
            referencedTableName: 'deliveries',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['order_item_id'],
            referencedTableName: 'order_items',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
        checks: [
          {
            name: 'CHK_delivered_quantity_positive',
            expression: 'delivered_quantity > 0',
          },
          {
            name: 'CHK_unit_price_non_negative',
            expression: 'unit_price >= 0',
          },
          {
            name: 'CHK_total_amount_non_negative',
            expression: 'total_amount >= 0',
          },
        ],
      }),
      true,
    );

    console.log('✅ Created delivery tables: deliveries, delivery_items');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Dropping consolidated schema...');

    await queryRunner.dropTable('delivery_items');
    await queryRunner.dropTable('deliveries');
    await queryRunner.dropTable('order_items');
    await queryRunner.dropTable('orders');
    await queryRunner.dropTable('users');

    console.log('✅ Consolidated schema dropped');
  }
}

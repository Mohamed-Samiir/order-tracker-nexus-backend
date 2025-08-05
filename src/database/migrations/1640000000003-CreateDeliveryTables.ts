import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreateDeliveryTables1640000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
            name: 'delivery_date',
            type: 'date',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'completed', 'cancelled'],
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('delivery_items');
    await queryRunner.dropTable('deliveries');
  }
}

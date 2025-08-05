import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreateOrderItemsTable1640000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('order_items');
  }
}

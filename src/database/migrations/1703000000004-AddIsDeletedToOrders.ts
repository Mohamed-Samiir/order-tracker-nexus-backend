import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddIsDeletedToOrders1703000000004 implements MigrationInterface {
  name = 'AddIsDeletedToOrders1703000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists
    const table = await queryRunner.getTable('orders');
    const hasIsDeletedColumn = table?.columns.find(
      (column) => column.name === 'isDeleted',
    );

    if (!hasIsDeletedColumn) {
      // Add isDeleted column to orders table
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'isDeleted',
          type: 'boolean',
          default: false,
          isNullable: false,
        }),
      );
    }

    // Check if the index already exists
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_ORDER_IS_DELETED',
    );

    if (!hasIndex) {
      // Add index for performance optimization on isDeleted queries
      await queryRunner.createIndex(
        'orders',
        new TableIndex({
          name: 'IDX_ORDER_IS_DELETED',
          columnNames: ['isDeleted'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if the index exists before dropping
    const table = await queryRunner.getTable('orders');
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_ORDER_IS_DELETED',
    );

    if (hasIndex) {
      // Drop index first
      await queryRunner.dropIndex('orders', 'IDX_ORDER_IS_DELETED');
    }

    // Check if the column exists before dropping
    const hasIsDeletedColumn = table?.columns.find(
      (column) => column.name === 'isDeleted',
    );

    if (hasIsDeletedColumn) {
      // Drop isDeleted column
      await queryRunner.dropColumn('orders', 'isDeleted');
    }
  }
}

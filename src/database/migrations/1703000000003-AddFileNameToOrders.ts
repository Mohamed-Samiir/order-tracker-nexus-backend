import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFileNameToOrders1703000000003 implements MigrationInterface {
  name = 'AddFileNameToOrders1703000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists
    const table = await queryRunner.getTable('orders');
    const hasFileNameColumn = table?.columns.find(
      (column) => column.name === 'fileName',
    );

    if (!hasFileNameColumn) {
      await queryRunner.addColumn(
        'orders',
        new TableColumn({
          name: 'fileName',
          type: 'varchar',
          length: '255',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if the column exists before dropping
    const table = await queryRunner.getTable('orders');
    const hasFileNameColumn = table?.columns.find(
      (column) => column.name === 'fileName',
    );

    if (hasFileNameColumn) {
      await queryRunner.dropColumn('orders', 'fileName');
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTaxIdFromOrders1640000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column exists before trying to drop it
    const table = await queryRunner.getTable('orders');
    const hasTaxIdColumn = table?.columns.find(
      (column) => column.name === 'tax_id',
    );

    if (hasTaxIdColumn) {
      // Remove the tax_id column from the orders table (note: snake_case, not camelCase)
      await queryRunner.dropColumn('orders', 'tax_id');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists before adding it back
    const table = await queryRunner.getTable('orders');
    const hasTaxIdColumn = table?.columns.find(
      (column) => column.name === 'tax_id',
    );

    if (!hasTaxIdColumn) {
      // Add the tax_id column back in case we need to rollback (note: snake_case)
      await queryRunner.query(`
        ALTER TABLE \`orders\`
        ADD COLUMN \`tax_id\` varchar(255) NOT NULL AFTER \`order_id\`
      `);
    }
  }
}

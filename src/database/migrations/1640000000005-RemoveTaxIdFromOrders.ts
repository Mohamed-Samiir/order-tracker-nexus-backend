import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveTaxIdFromOrders1640000000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Remove the taxId column from the orders table
    await queryRunner.dropColumn('orders', 'taxId');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Add the taxId column back in case we need to rollback
    await queryRunner.query(`
      ALTER TABLE \`orders\`
      ADD COLUMN \`taxId\` varchar(255) NOT NULL AFTER \`orderId\`
    `);
  }
}

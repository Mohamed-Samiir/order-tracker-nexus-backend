import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddQuantityRemainingToOrderItems1703000000005
  implements MigrationInterface {
  name = 'AddQuantityRemainingToOrderItems1703000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists
    const table = await queryRunner.getTable('order_items');
    const hasQuantityRemainingColumn = table?.columns.find(
      (column) =>
        column.name === 'quantityRemaining' ||
        column.name === 'quantity_remaining',
    );

    if (!hasQuantityRemainingColumn) {
      // Add the quantityRemaining column
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'quantityRemaining',
          type: 'int',
          default: 0,
          isNullable: false,
        }),
      );

      // Create index for the column
      await queryRunner.query(`
        CREATE INDEX IDX_ORDER_ITEM_QUANTITY_REMAINING ON order_items (quantityRemaining)
      `);

      // Add check constraints
      await queryRunner.query(`
        ALTER TABLE order_items 
        ADD CONSTRAINT CHK_quantity_remaining_non_negative 
        CHECK (quantityRemaining >= 0)
      `);

      await queryRunner.query(`
        ALTER TABLE order_items 
        ADD CONSTRAINT CHK_quantity_remaining_not_exceed_requested 
        CHECK (quantityRemaining <= quantityRequested)
      `);

      // Initialize quantityRemaining with quantityRequested for existing records
      await queryRunner.query(`
        UPDATE order_items 
        SET quantityRemaining = quantityRequested 
        WHERE quantityRemaining = 0
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop constraints
    await queryRunner.query(`
      ALTER TABLE order_items 
      DROP CONSTRAINT IF EXISTS CHK_quantity_remaining_not_exceed_requested
    `);

    await queryRunner.query(`
      ALTER TABLE order_items 
      DROP CONSTRAINT IF EXISTS CHK_quantity_remaining_non_negative
    `);

    // Drop index
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_ORDER_ITEM_QUANTITY_REMAINING ON order_items
    `);

    // Drop column
    const table = await queryRunner.getTable('order_items');
    const hasQuantityRemainingColumn = table?.columns.find(
      (column) =>
        column.name === 'quantityRemaining' ||
        column.name === 'quantity_remaining',
    );

    if (hasQuantityRemainingColumn) {
      await queryRunner.dropColumn(
        'order_items',
        hasQuantityRemainingColumn.name,
      );
    }
  }
}

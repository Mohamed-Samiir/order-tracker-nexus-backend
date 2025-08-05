import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddMissingColumnsToOrderItems1703000000006
  implements MigrationInterface {
  name = 'AddMissingColumnsToOrderItems1703000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the table exists
    const table = await queryRunner.getTable('order_items');
    if (!table) {
      throw new Error('order_items table does not exist');
    }

    // Add requesting_date column if it doesn't exist
    const hasRequestingDateColumn = table.columns.find(
      (column) => column.name === 'requesting_date',
    );

    if (!hasRequestingDateColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'requesting_date',
          type: 'date',
          isNullable: true, // Initially nullable to handle existing records
        }),
      );

      // Update existing records with a default date (current date)
      await queryRunner.query(`
        UPDATE order_items 
        SET requesting_date = CURDATE() 
        WHERE requesting_date IS NULL
      `);

      // Now make the column NOT NULL
      await queryRunner.query(`
        ALTER TABLE order_items 
        MODIFY COLUMN requesting_date date NOT NULL
      `);
    }

    // Add quantity_requested column if it doesn't exist
    const hasQuantityRequestedColumn = table.columns.find(
      (column) => column.name === 'quantity_requested',
    );

    if (!hasQuantityRequestedColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'quantity_requested',
          type: 'int',
          default: 0,
          isNullable: false,
        }),
      );

      // Update existing records: set quantity_requested = quantity_remaining for existing records
      await queryRunner.query(`
        UPDATE order_items 
        SET quantity_requested = quantity_remaining 
        WHERE quantity_requested = 0 AND quantity_remaining > 0
      `);
    }

    // Add unit_cost column if it doesn't exist
    const hasUnitCostColumn = table.columns.find(
      (column) => column.name === 'unit_cost',
    );

    if (!hasUnitCostColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'unit_cost',
          type: 'decimal',
          precision: 10,
          scale: 2,
          default: 0.00,
          isNullable: false,
        }),
      );
    }

    // Add total_cost column if it doesn't exist
    const hasTotalCostColumn = table.columns.find(
      (column) => column.name === 'total_cost',
    );

    if (!hasTotalCostColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'total_cost',
          type: 'decimal',
          precision: 10,
          scale: 2,
          default: 0.00,
          isNullable: false,
        }),
      );

      // Calculate total_cost = unit_cost * quantity_requested for existing records
      await queryRunner.query(`
        UPDATE order_items 
        SET total_cost = unit_cost * quantity_requested 
        WHERE total_cost = 0.00
      `);
    }

    // Add created_at column if it doesn't exist
    const hasCreatedAtColumn = table.columns.find(
      (column) => column.name === 'created_at',
    );

    if (!hasCreatedAtColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'created_at',
          type: 'datetime',
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          isNullable: false,
        }),
      );
    }

    // Add updated_at column if it doesn't exist
    const hasUpdatedAtColumn = table.columns.find(
      (column) => column.name === 'updated_at',
    );

    if (!hasUpdatedAtColumn) {
      await queryRunner.addColumn(
        'order_items',
        new TableColumn({
          name: 'updated_at',
          type: 'datetime',
          precision: 6,
          default: 'CURRENT_TIMESTAMP(6)',
          onUpdate: 'CURRENT_TIMESTAMP(6)',
          isNullable: false,
        }),
      );
    }

    // Create indexes for the new columns
    // Check if index exists before creating it
    const indexExists = await queryRunner.query(`
      SELECT COUNT(*) as count FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'order_items' AND index_name = 'IDX_ORDER_ITEM_REQUESTING_DATE'
    `);

    if (indexExists[0].count === 0) {
      await queryRunner.query(`
        CREATE INDEX IDX_ORDER_ITEM_REQUESTING_DATE
        ON order_items (requesting_date)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_ORDER_ITEM_REQUESTING_DATE ON order_items
    `);

    // Check if columns exist before dropping them
    const table = await queryRunner.getTable('order_items');
    if (!table) return;

    const columnsToRemove = [
      'updated_at',
      'created_at',
      'total_cost',
      'unit_cost',
      'quantity_requested',
      'requesting_date',
    ];

    for (const columnName of columnsToRemove) {
      const hasColumn = table.columns.find(
        (column) => column.name === columnName,
      );
      if (hasColumn) {
        await queryRunner.dropColumn('order_items', columnName);
      }
    }
  }
}

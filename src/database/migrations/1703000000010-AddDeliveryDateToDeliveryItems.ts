import { MigrationInterface, QueryRunner, TableColumn, Index } from 'typeorm';

export class AddDeliveryDateToDeliveryItems1703000000010 implements MigrationInterface {
  name = 'AddDeliveryDateToDeliveryItems1703000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists to prevent errors on re-run
    const table = await queryRunner.getTable('delivery_items');
    const hasDeliveryDateColumn = table?.columns.find(
      (column) => column.name === 'delivery_date',
    );

    if (!hasDeliveryDateColumn) {
      // Add delivery_date column to delivery_items table
      await queryRunner.addColumn(
        'delivery_items',
        new TableColumn({
          name: 'delivery_date',
          type: 'date',
          isNullable: true, // Initially nullable to handle existing records
          comment: 'Date when the delivery item was delivered',
        }),
      );

      // Create index on delivery_date for query performance
      await queryRunner.query(`
        CREATE INDEX IDX_DELIVERY_ITEM_DELIVERY_DATE ON delivery_items (delivery_date)
      `);

      // Update existing records to set delivery_date from the parent delivery
      // This ensures data consistency for existing records
      await queryRunner.query(`
        UPDATE delivery_items di
        INNER JOIN deliveries d ON di.delivery_id = d.id
        SET di.delivery_date = d.delivery_date
        WHERE di.delivery_date IS NULL
      `);

      console.log('✅ Added delivery_date column to delivery_items table');
      console.log('✅ Created index IDX_DELIVERY_ITEM_DELIVERY_DATE');
      console.log('✅ Updated existing records with delivery dates from parent deliveries');
    } else {
      console.log('⚠️  delivery_date column already exists in delivery_items table');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if the index exists before dropping
    const table = await queryRunner.getTable('delivery_items');
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_DELIVERY_ITEM_DELIVERY_DATE',
    );

    if (hasIndex) {
      // Drop the index first
      await queryRunner.query('DROP INDEX IDX_DELIVERY_ITEM_DELIVERY_DATE ON delivery_items');
    }

    // Check if the column exists before dropping
    const hasDeliveryDateColumn = table?.columns.find(
      (column) => column.name === 'delivery_date',
    );

    if (hasDeliveryDateColumn) {
      // Drop the delivery_date column
      await queryRunner.dropColumn('delivery_items', 'delivery_date');
    }

    console.log('✅ Removed delivery_date column and index from delivery_items table');
  }
}

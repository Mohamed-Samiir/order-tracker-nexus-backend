import { MigrationInterface, QueryRunner, TableColumn, Index } from 'typeorm';

export class AddDeliveryIdToDeliveries1703000000012 implements MigrationInterface {
  name = 'AddDeliveryIdToDeliveries1703000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Adding delivery_id column to deliveries table...');

    // Check if the column already exists to prevent errors on re-run
    const table = await queryRunner.getTable('deliveries');
    const hasDeliveryIdColumn = table?.columns.find(
      (column) => column.name === 'delivery_id',
    );

    if (!hasDeliveryIdColumn) {
      // Add delivery_id column to deliveries table
      await queryRunner.addColumn(
        'deliveries',
        new TableColumn({
          name: 'delivery_id',
          type: 'varchar',
          length: '20',
          isNullable: true, // Initially nullable to allow population of existing records
          comment: 'Human-readable delivery identifier (e.g., DEL-000001)',
        }),
      );

      console.log('✅ Added delivery_id column to deliveries table');

      // Populate existing records with generated delivery IDs based on creation order
      console.log('🔄 Populating existing delivery records with delivery IDs...');

      // Initialize the row number variable
      await queryRunner.query(`SET @row_number = 0`);

      // Update deliveries with generated IDs
      await queryRunner.query(`
        UPDATE deliveries
        SET delivery_id = CONCAT('DEL-', LPAD((@row_number := @row_number + 1), 6, '0'))
        WHERE delivery_id IS NULL
        ORDER BY created_at ASC
      `);

      console.log('✅ Populated existing delivery records with delivery IDs');

      // Now make the column NOT NULL since all records have values
      await queryRunner.changeColumn(
        'deliveries',
        'delivery_id',
        new TableColumn({
          name: 'delivery_id',
          type: 'varchar',
          length: '20',
          isNullable: false,
          isUnique: true,
          comment: 'Human-readable delivery identifier (e.g., DEL-000001)',
        }),
      );

      console.log('✅ Made delivery_id column NOT NULL and UNIQUE');

      // Create index on delivery_id for query performance
      await queryRunner.query(`
        CREATE INDEX IDX_DELIVERY_DELIVERY_ID ON deliveries (delivery_id)
      `);

      console.log('✅ Created index IDX_DELIVERY_DELIVERY_ID');

      // Verify the population worked correctly
      const countResult = await queryRunner.query(`
        SELECT COUNT(*) as total_count, 
               COUNT(delivery_id) as populated_count 
        FROM deliveries
      `);

      const { total_count, populated_count } = countResult[0];
      console.log(`✅ Verification: ${populated_count}/${total_count} delivery records have delivery_id populated`);

      if (total_count !== populated_count) {
        throw new Error(`Failed to populate all delivery records. Expected: ${total_count}, Got: ${populated_count}`);
      }

    } else {
      console.log('⚠️  delivery_id column already exists in deliveries table');
    }

    console.log('🎉 AddDeliveryIdToDeliveries migration completed successfully!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Reverting delivery_id column changes...');

    // Check if the index exists before dropping
    const table = await queryRunner.getTable('deliveries');
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_DELIVERY_DELIVERY_ID',
    );

    if (hasIndex) {
      // Drop the index first
      await queryRunner.query('DROP INDEX IDX_DELIVERY_DELIVERY_ID ON deliveries');
      console.log('✅ Dropped index IDX_DELIVERY_DELIVERY_ID');
    }

    // Check if the column exists before dropping
    const hasDeliveryIdColumn = table?.columns.find(
      (column) => column.name === 'delivery_id',
    );

    if (hasDeliveryIdColumn) {
      // Drop the delivery_id column
      await queryRunner.dropColumn('deliveries', 'delivery_id');
      console.log('✅ Dropped delivery_id column from deliveries table');
    }

    console.log('✅ AddDeliveryIdToDeliveries migration reverted successfully');
  }
}

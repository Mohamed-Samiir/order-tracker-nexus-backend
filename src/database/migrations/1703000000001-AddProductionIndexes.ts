import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProductionIndexes1703000000001 implements MigrationInterface {
  name = 'AddProductionIndexes1703000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Helper function to create index if it doesn't exist
    const createIndexIfNotExists = async (indexName: string, tableName: string, columns: string) => {
      const indexExists = await queryRunner.query(`
        SELECT COUNT(*) as count FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = '${tableName}' AND index_name = '${indexName}'
      `);

      if (indexExists[0].count === 0) {
        await queryRunner.query(`CREATE INDEX ${indexName} ON ${tableName}(${columns})`);
      }
    };

    // Users table indexes
    await createIndexIfNotExists('IDX_users_email', 'users', 'email');
    await createIndexIfNotExists('IDX_users_role', 'users', 'role');
    await createIndexIfNotExists('IDX_users_status', 'users', 'status');
    await createIndexIfNotExists('IDX_users_created_at', 'users', 'created_at');

    // Orders table indexes
    await createIndexIfNotExists('IDX_orders_order_id', 'orders', 'order_id');
    await createIndexIfNotExists('IDX_orders_status', 'orders', 'status');
    await createIndexIfNotExists('IDX_orders_created_by', 'orders', 'created_by_id');
    await createIndexIfNotExists('IDX_orders_created_at', 'orders', 'created_at');
    await createIndexIfNotExists('IDX_orders_updated_at', 'orders', 'updated_at');
    await createIndexIfNotExists('IDX_orders_status_created_at', 'orders', 'status, created_at');

    // Order items table indexes
    await createIndexIfNotExists('IDX_order_items_order_id', 'order_items', 'order_id');
    await createIndexIfNotExists('IDX_order_items_asin', 'order_items', 'asin');
    await createIndexIfNotExists('IDX_order_items_model_number', 'order_items', 'model_number');
    await createIndexIfNotExists('IDX_order_items_brand_name', 'order_items', 'brand_name');
    await createIndexIfNotExists('IDX_order_items_requesting_date', 'order_items', 'requesting_date');
    await createIndexIfNotExists('IDX_order_items_quantity_remaining', 'order_items', 'quantity_remaining');

    // Deliveries table indexes
    await createIndexIfNotExists('IDX_deliveries_order_id', 'deliveries', 'order_id');
    await createIndexIfNotExists('IDX_deliveries_status', 'deliveries', 'status');
    await createIndexIfNotExists('IDX_deliveries_delivery_date', 'deliveries', 'delivery_date');
    await createIndexIfNotExists('IDX_deliveries_created_by', 'deliveries', 'created_by_id');
    await createIndexIfNotExists('IDX_deliveries_created_at', 'deliveries', 'created_at');
    await createIndexIfNotExists('IDX_deliveries_status_date', 'deliveries', 'status, delivery_date');

    // Delivery items table indexes
    await createIndexIfNotExists('IDX_delivery_items_delivery_id', 'delivery_items', 'delivery_id');
    await createIndexIfNotExists('IDX_delivery_items_order_item_id', 'delivery_items', 'order_item_id');
    await createIndexIfNotExists('IDX_delivery_items_delivered_quantity', 'delivery_items', 'delivered_quantity');

    // Composite indexes for common queries
    await createIndexIfNotExists('IDX_orders_status_created_by', 'orders', 'status, created_by_id');
    await createIndexIfNotExists('IDX_order_items_order_asin', 'order_items', 'order_id, asin');
    await createIndexIfNotExists('IDX_deliveries_order_status', 'deliveries', 'order_id, status');

    // Full-text search indexes (skip for compatibility)
    // Note: FULLTEXT indexes require specific MySQL versions and table engines
    // These can be added manually if needed for the specific MySQL setup

    // Performance optimization: Add covering indexes for common SELECT queries
    await createIndexIfNotExists('IDX_orders_list_covering', 'orders', 'status, created_at, id, order_id, total_items, total_cost, created_by_id');
    await createIndexIfNotExists('IDX_order_items_summary_covering', 'order_items', 'order_id, quantity_requested, quantity_remaining, unit_cost, total_cost');

    // Optimize foreign key constraints with indexes
    await createIndexIfNotExists('IDX_orders_created_by_fk', 'orders', 'created_by_id');
    await createIndexIfNotExists('IDX_deliveries_order_fk', 'deliveries', 'order_id');
    await createIndexIfNotExists('IDX_deliveries_created_by_fk', 'deliveries', 'created_by_id');
    await createIndexIfNotExists('IDX_delivery_items_delivery_fk', 'delivery_items', 'delivery_id');
    await createIndexIfNotExists('IDX_delivery_items_order_item_fk', 'delivery_items', 'order_item_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Helper function to drop index if it exists
    const dropIndexIfExists = async (indexName: string, tableName: string) => {
      const indexExists = await queryRunner.query(`
        SELECT COUNT(*) as count FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = '${tableName}' AND index_name = '${indexName}'
      `);

      if (indexExists[0].count > 0) {
        await queryRunner.query(`DROP INDEX ${indexName} ON ${tableName}`);
      }
    };

    // Drop all indexes in reverse order
    await dropIndexIfExists('IDX_delivery_items_order_item_fk', 'delivery_items');
    await dropIndexIfExists('IDX_delivery_items_delivery_fk', 'delivery_items');
    await dropIndexIfExists('IDX_deliveries_created_by_fk', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_order_fk', 'deliveries');
    await dropIndexIfExists('IDX_orders_created_by_fk', 'orders');

    await dropIndexIfExists('IDX_order_items_summary_covering', 'order_items');
    await dropIndexIfExists('IDX_orders_list_covering', 'orders');

    await dropIndexIfExists('IDX_deliveries_order_status', 'deliveries');
    await dropIndexIfExists('IDX_order_items_order_asin', 'order_items');
    await dropIndexIfExists('IDX_orders_status_created_by', 'orders');

    await dropIndexIfExists('IDX_delivery_items_delivered_quantity', 'delivery_items');
    await dropIndexIfExists('IDX_delivery_items_order_item_id', 'delivery_items');
    await dropIndexIfExists('IDX_delivery_items_delivery_id', 'delivery_items');

    await dropIndexIfExists('IDX_deliveries_status_date', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_created_at', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_created_by', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_delivery_date', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_status', 'deliveries');
    await dropIndexIfExists('IDX_deliveries_order_id', 'deliveries');

    await dropIndexIfExists('IDX_order_items_quantity_remaining', 'order_items');
    await dropIndexIfExists('IDX_order_items_requesting_date', 'order_items');
    await dropIndexIfExists('IDX_order_items_brand_name', 'order_items');
    await dropIndexIfExists('IDX_order_items_model_number', 'order_items');
    await dropIndexIfExists('IDX_order_items_asin', 'order_items');
    await dropIndexIfExists('IDX_order_items_order_id', 'order_items');

    await dropIndexIfExists('IDX_orders_status_created_at', 'orders');
    await dropIndexIfExists('IDX_orders_updated_at', 'orders');
    await dropIndexIfExists('IDX_orders_created_at', 'orders');
    await dropIndexIfExists('IDX_orders_created_by', 'orders');
    await dropIndexIfExists('IDX_orders_status', 'orders');
    await dropIndexIfExists('IDX_orders_order_id', 'orders');

    await dropIndexIfExists('IDX_users_created_at', 'users');
    await dropIndexIfExists('IDX_users_status', 'users');
    await dropIndexIfExists('IDX_users_role', 'users');
    await dropIndexIfExists('IDX_users_email', 'users');
  }
}

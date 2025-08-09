import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixTriggerContext1703000000009 implements MigrationInterface {
  name = 'FixTriggerContext1703000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing delivery triggers that don't set the trigger context
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);

    // Recreate triggers with proper @TRIGGER_CONTEXT handling
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          -- Set trigger context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_INSERT';

          -- AUTOMATIC RECALCULATION: Subtract delivered quantity from remaining quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;

          -- Clear trigger context
          SET @TRIGGER_CONTEXT = NULL;

          -- This happens ATOMICALLY within the same transaction as the INSERT
          -- Example: If quantity_remaining was 100 and delivered_quantity is 25,
          -- the quantity_remaining becomes 75 automatically
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_update
      AFTER UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_difference INT DEFAULT 0;

          -- Set trigger context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_UPDATE';

          -- Calculate the difference in delivered quantities
          SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;

          -- Adjust remaining quantity by the difference
          -- Positive difference = more delivered = less remaining
          -- Negative difference = less delivered = more remaining
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - quantity_difference
          WHERE id = NEW.order_item_id;

          -- Clear trigger context
          SET @TRIGGER_CONTEXT = NULL;
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_delete
      AFTER DELETE ON delivery_items
      FOR EACH ROW
      BEGIN
          -- Set trigger context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_DELETE';

          -- RESTORE QUANTITY: Add back the delivered quantity to remaining quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining + OLD.delivered_quantity
          WHERE id = OLD.order_item_id;

          -- Clear trigger context
          SET @TRIGGER_CONTEXT = NULL;

          -- Example: If a delivery of 25 items is deleted,
          -- quantity_remaining increases by 25 automatically
      END
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the fixed triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);

    // Recreate original triggers without trigger context
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          -- AUTOMATIC RECALCULATION: Subtract delivered quantity from remaining quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;

          -- This happens ATOMICALLY within the same transaction as the INSERT
          -- Example: If quantity_remaining was 100 and delivered_quantity is 25,
          -- the quantity_remaining becomes 75 automatically
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_update
      AFTER UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_difference INT DEFAULT 0;

          -- Calculate the difference in delivered quantities
          SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;

          -- Adjust remaining quantity by the difference
          -- Positive difference = more delivered = less remaining
          -- Negative difference = less delivered = more remaining
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - quantity_difference
          WHERE id = NEW.order_item_id;
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_delete
      AFTER DELETE ON delivery_items
      FOR EACH ROW
      BEGIN
          -- RESTORE QUANTITY: Add back the delivered quantity to remaining quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining + OLD.delivered_quantity
          WHERE id = OLD.order_item_id;

          -- Example: If a delivery of 25 items is deleted,
          -- quantity_remaining increases by 25 automatically
      END
    `);
  }
}

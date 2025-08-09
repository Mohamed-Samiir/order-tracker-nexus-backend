import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDeliveryTriggers1703000000008 implements MigrationInterface {
  name = 'FixDeliveryTriggers1703000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop existing triggers that reference incorrect column names
    await queryRunner.query(`DROP TRIGGER IF EXISTS validate_delivery_quantity_before_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);

    // Recreate triggers with correct column names (snake_case - actual database column names)
    await queryRunner.query(`
      CREATE TRIGGER validate_delivery_quantity_before_insert
      BEFORE INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_remaining_var INT DEFAULT 0;

          -- Get current remaining quantity for the order item
          SELECT oi.quantity_remaining INTO quantity_remaining_var
          FROM order_items oi WHERE oi.id = NEW.order_item_id;

          -- PREVENT NEGATIVE QUANTITIES: Reject if delivery would exceed remaining quantity
          IF NEW.delivered_quantity > quantity_remaining_var THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delivery quantity exceeds remaining quantity';
          END IF;

          -- Additional validation: Ensure order item exists
          IF quantity_remaining_var IS NULL THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item not found';
          END IF;
      END
    `);

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

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the corrected triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS validate_delivery_quantity_before_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);

    // Recreate original triggers with snake_case column names
    await queryRunner.query(`
      CREATE TRIGGER validate_delivery_quantity_before_insert
      BEFORE INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_remaining_var INT DEFAULT 0;

          -- Get current remaining quantity for the order item
          SELECT oi.quantity_remaining INTO quantity_remaining_var
          FROM order_items oi WHERE oi.id = NEW.order_item_id;

          -- PREVENT NEGATIVE QUANTITIES: Reject if delivery would exceed remaining quantity
          IF NEW.delivered_quantity > quantity_remaining_var THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delivery quantity exceeds remaining quantity';
          END IF;

          -- Additional validation: Ensure order item exists
          IF quantity_remaining_var IS NULL THEN
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item not found';
          END IF;
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          -- AUTOMATIC RECALCULATION: Subtract delivered quantity from remaining quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;
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
      END
    `);
  }
}

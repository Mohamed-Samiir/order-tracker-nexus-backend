import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuantityRemainingTriggers1640000000004
  implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Validation trigger - Prevent delivery items that would cause negative quantity_remaining
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
      END;
    `);

    // 2. CRITICAL: Automatic quantity recalculation trigger - AFTER INSERT
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
      END;
    `);

    // 3. Handle delivery item updates
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
      END;
    `);

    // 4. Handle delivery item deletions - restore quantities
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
      END;
    `);

    // 5. Protection trigger - Prevent direct updates to quantity_remaining
    await queryRunner.query(`
      CREATE TRIGGER prevent_direct_quantity_remaining_update
      BEFORE UPDATE ON order_items
      FOR EACH ROW
      BEGIN
          -- Allow updates during initial setup (when old value is 0)
          -- But prevent direct updates once the system is running
          IF OLD.quantity_remaining != NEW.quantity_remaining AND OLD.quantity_remaining != 0 THEN
              -- Check if this update is coming from our triggers by examining the call stack
              -- If quantity_remaining is being updated directly (not via delivery operations)
              IF @TRIGGER_CONTEXT IS NULL THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Direct updates to quantity_remaining are not allowed. Use delivery operations instead.';
              END IF;
          END IF;
      END;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS prevent_direct_quantity_remaining_update',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert',
    );
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS validate_delivery_quantity_before_insert',
    );
  }
}

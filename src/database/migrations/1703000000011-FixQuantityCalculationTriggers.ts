import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixQuantityCalculationTriggers1703000000011 implements MigrationInterface {
  name = 'FixQuantityCalculationTriggers1703000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Fixing quantity calculation triggers...');

    // Drop existing triggers to recreate them with fixes
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_direct_quantity_remaining_update`);

    // 1. FIXED INSERT TRIGGER - Handles new delivery items
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE remaining_qty INT DEFAULT 0;
          DECLARE requested_qty INT DEFAULT 0;
          
          -- Set trigger context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_INSERT';

          -- Get current quantities for validation
          SELECT quantity_remaining, quantity_requested 
          INTO remaining_qty, requested_qty
          FROM order_items 
          WHERE id = NEW.order_item_id;

          -- Validate that we don't exceed available quantity
          IF NEW.delivered_quantity > remaining_qty THEN
              SET @TRIGGER_CONTEXT = NULL;
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Delivery quantity exceeds remaining quantity';
          END IF;

          -- Update remaining quantity
          UPDATE order_items 
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;

          -- Clear trigger context
          SET @TRIGGER_CONTEXT = NULL;

          -- Log the operation for debugging
          INSERT INTO quantity_audit_log (operation_type, order_item_id, delivery_item_id, old_quantity, new_quantity, delivered_quantity, created_at)
          VALUES ('INSERT', NEW.order_item_id, NEW.id, remaining_qty, remaining_qty - NEW.delivered_quantity, NEW.delivered_quantity, NOW())
          ON DUPLICATE KEY UPDATE created_at = NOW();
      END
    `);

    console.log('✅ Created fixed INSERT trigger');

    // 2. FIXED UPDATE TRIGGER - Handles delivery item quantity changes
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_update
      AFTER UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_difference INT DEFAULT 0;
          DECLARE remaining_qty INT DEFAULT 0;
          DECLARE requested_qty INT DEFAULT 0;
          
          -- Only process if delivered_quantity actually changed
          IF OLD.delivered_quantity != NEW.delivered_quantity THEN
              -- Set trigger context to allow quantity_remaining updates
              SET @TRIGGER_CONTEXT = 'DELIVERY_UPDATE';

              -- Calculate the difference in delivered quantities
              SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;

              -- Get current quantities for validation
              SELECT quantity_remaining, quantity_requested 
              INTO remaining_qty, requested_qty
              FROM order_items 
              WHERE id = NEW.order_item_id;

              -- Validate that the update won't cause negative remaining quantity
              IF (remaining_qty - quantity_difference) < 0 THEN
                  SET @TRIGGER_CONTEXT = NULL;
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Update would result in negative remaining quantity';
              END IF;

              -- Validate that remaining quantity won't exceed requested quantity
              IF (remaining_qty - quantity_difference) > requested_qty THEN
                  SET @TRIGGER_CONTEXT = NULL;
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Update would result in remaining quantity exceeding requested quantity';
              END IF;

              -- Update remaining quantity
              UPDATE order_items
              SET quantity_remaining = quantity_remaining - quantity_difference
              WHERE id = NEW.order_item_id;

              -- Clear trigger context
              SET @TRIGGER_CONTEXT = NULL;

              -- Log the operation for debugging
              INSERT INTO quantity_audit_log (operation_type, order_item_id, delivery_item_id, old_quantity, new_quantity, delivered_quantity, created_at)
              VALUES ('UPDATE', NEW.order_item_id, NEW.id, remaining_qty, remaining_qty - quantity_difference, quantity_difference, NOW())
              ON DUPLICATE KEY UPDATE created_at = NOW();
          END IF;
      END
    `);

    console.log('✅ Created fixed UPDATE trigger');

    // 3. FIXED DELETE TRIGGER - Handles delivery item deletions
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_delete
      AFTER DELETE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE remaining_qty INT DEFAULT 0;
          DECLARE requested_qty INT DEFAULT 0;
          
          -- Set trigger context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_DELETE';

          -- Get current quantities for validation
          SELECT quantity_remaining, quantity_requested 
          INTO remaining_qty, requested_qty
          FROM order_items 
          WHERE id = OLD.order_item_id;

          -- Validate that restoring quantity won't exceed requested quantity
          IF (remaining_qty + OLD.delivered_quantity) > requested_qty THEN
              SET @TRIGGER_CONTEXT = NULL;
              SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Restoring quantity would exceed requested quantity';
          END IF;

          -- Restore quantity by adding back the delivered quantity
          UPDATE order_items
          SET quantity_remaining = quantity_remaining + OLD.delivered_quantity
          WHERE id = OLD.order_item_id;

          -- Clear trigger context
          SET @TRIGGER_CONTEXT = NULL;

          -- Log the operation for debugging
          INSERT INTO quantity_audit_log (operation_type, order_item_id, delivery_item_id, old_quantity, new_quantity, delivered_quantity, created_at)
          VALUES ('DELETE', OLD.order_item_id, OLD.id, remaining_qty, remaining_qty + OLD.delivered_quantity, OLD.delivered_quantity, NOW())
          ON DUPLICATE KEY UPDATE created_at = NOW();
      END
    `);

    console.log('✅ Created fixed DELETE trigger');

    // 4. IMPROVED PROTECTION TRIGGER - Prevents direct quantity_remaining updates
    await queryRunner.query(`
      CREATE TRIGGER prevent_direct_quantity_remaining_update
      BEFORE UPDATE ON order_items
      FOR EACH ROW
      BEGIN
          -- Allow updates during initial setup (when old value is 0 or during data migration)
          -- But prevent direct updates once the system is running
          IF OLD.quantity_remaining != NEW.quantity_remaining THEN
              -- Check if this update is coming from our triggers
              IF @TRIGGER_CONTEXT IS NULL OR @TRIGGER_CONTEXT = '' THEN
                  -- Allow updates during initial data load (when old quantity is 0)
                  IF OLD.quantity_remaining != 0 THEN
                      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Direct updates to quantity_remaining are not allowed. Use delivery operations instead.';
                  END IF;
              END IF;

              -- Additional validation: ensure quantity_remaining is within valid bounds
              IF NEW.quantity_remaining < 0 THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'quantity_remaining cannot be negative';
              END IF;

              IF NEW.quantity_remaining > NEW.quantity_requested THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'quantity_remaining cannot exceed quantity_requested';
              END IF;
          END IF;
      END
    `);

    console.log('✅ Created improved protection trigger');

    // 5. Create audit log table for debugging quantity changes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS quantity_audit_log (
          id INT AUTO_INCREMENT PRIMARY KEY,
          operation_type ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
          order_item_id VARCHAR(36) NOT NULL,
          delivery_item_id VARCHAR(36),
          old_quantity INT,
          new_quantity INT,
          delivered_quantity INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_order_item_id (order_item_id),
          INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB
    `);

    console.log('✅ Created quantity audit log table');
    console.log('🎉 All quantity calculation triggers have been fixed and improved!');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the improved triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS prevent_direct_quantity_remaining_update`);

    // Drop audit log table
    await queryRunner.query(`DROP TABLE IF EXISTS quantity_audit_log`);

    // Recreate the original triggers (from the previous migration)
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          SET @TRIGGER_CONTEXT = 'DELIVERY_INSERT';
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;
          SET @TRIGGER_CONTEXT = NULL;
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_update
      AFTER UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_difference INT DEFAULT 0;
          SET @TRIGGER_CONTEXT = 'DELIVERY_UPDATE';
          SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;
          UPDATE order_items
          SET quantity_remaining = quantity_remaining - quantity_difference
          WHERE id = NEW.order_item_id;
          SET @TRIGGER_CONTEXT = NULL;
      END
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_delete
      AFTER DELETE ON delivery_items
      FOR EACH ROW
      BEGIN
          SET @TRIGGER_CONTEXT = 'DELIVERY_DELETE';
          UPDATE order_items
          SET quantity_remaining = quantity_remaining + OLD.delivered_quantity
          WHERE id = OLD.order_item_id;
          SET @TRIGGER_CONTEXT = NULL;
      END
    `);

    console.log('✅ Reverted to original triggers');
  }
}

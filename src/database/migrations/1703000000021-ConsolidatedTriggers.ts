import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConsolidatedTriggers1703000000021 implements MigrationInterface {
  name = 'ConsolidatedTriggers1703000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('🔧 Creating consolidated database triggers for quantity management...');

    // 1. Protection trigger - Prevent direct updates to quantity_remaining
    await queryRunner.query(`
      CREATE TRIGGER prevent_direct_quantity_remaining_update
      BEFORE UPDATE ON order_items
      FOR EACH ROW
      BEGIN
          -- Allow updates if triggered by delivery operations (context variable set)
          IF @TRIGGER_CONTEXT IS NULL OR @TRIGGER_CONTEXT != 'DELIVERY_OPERATION' THEN
              -- Check if quantity_remaining is being changed directly
              IF OLD.quantity_remaining != NEW.quantity_remaining THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Direct updates to quantity_remaining are not allowed. Use delivery operations instead.';
              END IF;
          END IF;
      END;
    `);

    // 2. Validation trigger - Prevent delivery items that would cause negative quantity_remaining
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

    // 3. Automatic quantity recalculation trigger - AFTER INSERT
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_insert
      AFTER INSERT ON delivery_items
      FOR EACH ROW
      BEGIN
          -- Set context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_OPERATION';
          
          -- AUTOMATIC RECALCULATION: Subtract delivered quantity from remaining quantity
          UPDATE order_items 
          SET quantity_remaining = quantity_remaining - NEW.delivered_quantity
          WHERE id = NEW.order_item_id;
          
          -- Clear context
          SET @TRIGGER_CONTEXT = NULL;
      END;
    `);

    // 4. Handle delivery item updates
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_update
      AFTER UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE quantity_difference INT DEFAULT 0;
          
          -- Calculate the difference in delivered quantities
          SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;
          
          -- Only update if there's actually a change in delivered quantity
          IF quantity_difference != 0 THEN
              -- Set context to allow quantity_remaining updates
              SET @TRIGGER_CONTEXT = 'DELIVERY_OPERATION';
              
              -- Adjust the remaining quantity by the difference
              UPDATE order_items 
              SET quantity_remaining = quantity_remaining - quantity_difference
              WHERE id = NEW.order_item_id;
              
              -- Clear context
              SET @TRIGGER_CONTEXT = NULL;
          END IF;
      END;
    `);

    // 5. Handle delivery item deletions
    await queryRunner.query(`
      CREATE TRIGGER update_quantity_remaining_after_delivery_delete
      AFTER DELETE ON delivery_items
      FOR EACH ROW
      BEGIN
          -- Set context to allow quantity_remaining updates
          SET @TRIGGER_CONTEXT = 'DELIVERY_OPERATION';
          
          -- RESTORE QUANTITY: Add back the delivered quantity to remaining quantity
          UPDATE order_items 
          SET quantity_remaining = quantity_remaining + OLD.delivered_quantity
          WHERE id = OLD.order_item_id;
          
          -- Clear context
          SET @TRIGGER_CONTEXT = NULL;
      END;
    `);

    // 6. Validation trigger for delivery item updates
    await queryRunner.query(`
      CREATE TRIGGER validate_delivery_quantity_before_update
      BEFORE UPDATE ON delivery_items
      FOR EACH ROW
      BEGIN
          DECLARE current_remaining INT DEFAULT 0;
          DECLARE quantity_difference INT DEFAULT 0;
          
          -- Calculate the difference (positive means increase, negative means decrease)
          SET quantity_difference = NEW.delivered_quantity - OLD.delivered_quantity;
          
          -- Only validate if delivered quantity is increasing
          IF quantity_difference > 0 THEN
              -- Get current remaining quantity
              SELECT quantity_remaining INTO current_remaining
              FROM order_items WHERE id = NEW.order_item_id;
              
              -- Check if the increase would cause negative remaining quantity
              IF quantity_difference > current_remaining THEN
                  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Updated delivery quantity would exceed remaining quantity';
              END IF;
          END IF;
      END;
    `);

    console.log('✅ Created all quantity management triggers');
    console.log('✅ Triggers protect against direct quantity_remaining updates');
    console.log('✅ Triggers automatically manage quantities on delivery operations');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('🔄 Dropping consolidated triggers...');

    // Drop all triggers in reverse order
    await queryRunner.query('DROP TRIGGER IF EXISTS validate_delivery_quantity_before_update');
    await queryRunner.query('DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_delete');
    await queryRunner.query('DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_update');
    await queryRunner.query('DROP TRIGGER IF EXISTS update_quantity_remaining_after_delivery_insert');
    await queryRunner.query('DROP TRIGGER IF EXISTS validate_delivery_quantity_before_insert');
    await queryRunner.query('DROP TRIGGER IF EXISTS prevent_direct_quantity_remaining_update');

    console.log('✅ All triggers dropped');
  }
}

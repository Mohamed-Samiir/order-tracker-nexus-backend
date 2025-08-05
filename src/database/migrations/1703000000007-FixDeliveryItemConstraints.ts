import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixDeliveryItemConstraints1703000000007
  implements MigrationInterface
{
  name = 'FixDeliveryItemConstraints1703000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop any existing check constraints with incorrect column names
    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT IF EXISTS CHK_delivered_quantity_positive
      `);
    } catch (error) {
      // Constraint might not exist, continue
      console.log('CHK_delivered_quantity_positive constraint not found, continuing...');
    }

    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT IF EXISTS CHK_unit_price_non_negative
      `);
    } catch (error) {
      // Constraint might not exist, continue
      console.log('CHK_unit_price_non_negative constraint not found, continuing...');
    }

    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT IF EXISTS CHK_total_amount_non_negative
      `);
    } catch (error) {
      // Constraint might not exist, continue
      console.log('CHK_total_amount_non_negative constraint not found, continuing...');
    }

    // Add check constraints with correct column names (camelCase)
    await queryRunner.query(`
      ALTER TABLE delivery_items 
      ADD CONSTRAINT CHK_delivered_quantity_positive 
      CHECK (deliveredQuantity > 0)
    `);

    await queryRunner.query(`
      ALTER TABLE delivery_items 
      ADD CONSTRAINT CHK_unit_price_non_negative 
      CHECK (unitPrice >= 0)
    `);

    await queryRunner.query(`
      ALTER TABLE delivery_items 
      ADD CONSTRAINT CHK_total_amount_non_negative 
      CHECK (totalAmount >= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the check constraints
    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT CHK_delivered_quantity_positive
      `);
    } catch (error) {
      console.log('Error dropping CHK_delivered_quantity_positive:', error.message);
    }

    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT CHK_unit_price_non_negative
      `);
    } catch (error) {
      console.log('Error dropping CHK_unit_price_non_negative:', error.message);
    }

    try {
      await queryRunner.query(`
        ALTER TABLE delivery_items 
        DROP CONSTRAINT CHK_total_amount_non_negative
      `);
    } catch (error) {
      console.log('Error dropping CHK_total_amount_non_negative:', error.message);
    }
  }
}

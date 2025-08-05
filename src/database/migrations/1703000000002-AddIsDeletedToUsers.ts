import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsDeletedToUsers1703000000002 implements MigrationInterface {
  name = 'AddIsDeletedToUsers1703000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the column already exists
    const table = await queryRunner.getTable('users');
    const hasIsDeletedColumn = table?.columns.find(
      (column) => column.name === 'isDeleted',
    );

    if (!hasIsDeletedColumn) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        ADD COLUMN \`isDeleted\` tinyint NOT NULL DEFAULT 0
      `);
    }

    // Check if the index already exists
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_USER_IS_DELETED',
    );

    if (!hasIndex) {
      await queryRunner.query(`
        CREATE INDEX \`IDX_USER_IS_DELETED\` ON \`users\` (\`isDeleted\`)
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Check if the index exists before dropping
    const table = await queryRunner.getTable('users');
    const hasIndex = table?.indices.find(
      (index) => index.name === 'IDX_USER_IS_DELETED',
    );

    if (hasIndex) {
      await queryRunner.query(`
        DROP INDEX \`IDX_USER_IS_DELETED\` ON \`users\`
      `);
    }

    // Check if the column exists before dropping
    const hasIsDeletedColumn = table?.columns.find(
      (column) => column.name === 'isDeleted',
    );

    if (hasIsDeletedColumn) {
      await queryRunner.query(`
        ALTER TABLE \`users\`
        DROP COLUMN \`isDeleted\`
      `);
    }
  }
}

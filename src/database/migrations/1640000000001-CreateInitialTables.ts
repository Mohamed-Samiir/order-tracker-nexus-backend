import {
  MigrationInterface,
  QueryRunner,
  Table,
  Index,
  ForeignKey,
} from 'typeorm';

export class CreateInitialTables1640000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'uploader', 'viewer'],
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['active', 'inactive'],
            default: "'active'",
          },
          {
            name: 'last_login',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { name: 'IDX_USER_EMAIL', columnNames: ['email'] },
          { name: 'IDX_USER_ROLE', columnNames: ['role'] },
          { name: 'IDX_USER_STATUS', columnNames: ['status'] },
        ],
      }),
      true,
    );

    // Create orders table
    await queryRunner.createTable(
      new Table({
        name: 'orders',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '36',
            isPrimary: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'order_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
          },
          {
            name: 'tax_id',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['pending', 'processing', 'completed', 'cancelled'],
            default: "'pending'",
          },
          {
            name: 'total_items',
            type: 'int',
            default: 0,
          },
          {
            name: 'total_cost',
            type: 'decimal',
            precision: 10,
            scale: 2,
            default: 0,
          },
          {
            name: 'delivered_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'remaining_quantity',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_by',
            type: 'varchar',
            length: '36',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
          },
        ],
        indices: [
          { name: 'IDX_ORDER_ID', columnNames: ['order_id'] },
          { name: 'IDX_ORDER_STATUS', columnNames: ['status'] },
          { name: 'IDX_ORDER_CREATED_BY', columnNames: ['created_by'] },
          { name: 'IDX_ORDER_CREATED_AT', columnNames: ['created_at'] },
        ],
        foreignKeys: [
          {
            columnNames: ['created_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('orders');
    await queryRunner.dropTable('users');
  }
}

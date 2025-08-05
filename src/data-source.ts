import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from backend directory
config({ path: join(__dirname, '../.env') });

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'order_tracker',
  entities: [join(__dirname, '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, 'database', 'migrations', '*{.ts,.js}')],
  migrationsTableName: 'migrations',
  synchronize: false, // Always false for production safety
  logging: process.env.NODE_ENV === 'development',
  timezone: 'Z',
  charset: 'utf8mb4',
  // Additional production-ready settings
  extra: {
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '20'),
    acquireTimeout: parseInt(process.env.DB_TIMEOUT || '60000'),
    timeout: parseInt(process.env.DB_TIMEOUT || '60000'),
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  },
});

export default AppDataSource;

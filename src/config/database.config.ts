import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables from backend directory
config({ path: join(__dirname, '../../.env') });

const configService = new ConfigService();

export const databaseConfig = {
  type: 'mysql' as const,
  host: configService.get('DB_HOST', 'localhost'),
  port: parseInt(configService.get('DB_PORT', '3306')),
  username: configService.get('DB_USERNAME', 'root'),
  password: configService.get('DB_PASSWORD', '12345678'),
  database: configService.get('DB_NAME', 'order_tracker'),
  entities: [join(__dirname, '..', '**', '*.entity{.ts,.js}')],
  migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
  synchronize: false, // Disabled to prevent automatic schema changes
  logging: configService.get('NODE_ENV') === 'development',
  timezone: 'Z',
  charset: 'utf8mb4',
  // Additional production-ready settings
  extra: {
    connectionLimit: parseInt(configService.get('DB_CONNECTION_LIMIT', '20')),
    acquireTimeout: parseInt(configService.get('DB_TIMEOUT', '60000')),
    timeout: parseInt(configService.get('DB_TIMEOUT', '60000')),
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
  },
};

// Export DataSource for TypeORM CLI
export default new DataSource(databaseConfig);

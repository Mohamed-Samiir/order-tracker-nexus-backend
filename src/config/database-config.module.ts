import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT!, 10) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'order_tracker',
  ssl: process.env.DB_SSL === 'true',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT!, 10) || 20,
  timeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
  logging: process.env.NODE_ENV === 'development',
  synchronize: false, // Never use synchronize in production
  migrationsRun: process.env.NODE_ENV === 'production',
  extra: {
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT!, 10) || 20,
    acquireTimeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
    timeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
  },
}));

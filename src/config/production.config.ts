import { registerAs } from '@nestjs/config';

export default registerAs('production', () => ({
  // Database Configuration
  database: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT!, 10) || 3306,
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.DB_SSL === 'true',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT!, 10) || 20,
    timeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
    logging: false, // Disable query logging in production
    synchronize: false, // Never use synchronize in production
    migrationsRun: true,
    extra: {
      connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT!, 10) || 20,
      acquireTimeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
      timeout: parseInt(process.env.DB_TIMEOUT!, 10) || 60000,
    },
  },

  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS!, 10) || 12,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET,
    refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    sessionSecret: process.env.SESSION_SECRET,
  },

  // Rate Limiting Configuration
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL!, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT!, 10) || 100,
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE!, 10) || 10485760, // 10MB
    uploadPath: process.env.UPLOAD_PATH || '/var/uploads/order-tracker',
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ],
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'warn',
    filePath: process.env.LOG_FILE_PATH || '/var/log/order-tracker/app.log',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES!, 10) || 5,
    enableConsole: false, // Disable console logging in production
  },

  // Monitoring Configuration
  monitoring: {
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: parseInt(process.env.METRICS_PORT!, 10) || 9090,
    healthCheckEndpoint: process.env.HEALTH_CHECK_ENDPOINT || '/health',
  },

  // Email Configuration
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT!, 10) || 587,
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  },

  // Redis Configuration
  redis: {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT!, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB!, 10) || 0,
  },

  // SSL Configuration
  ssl: {
    certPath: process.env.SSL_CERT_PATH,
    keyPath: process.env.SSL_KEY_PATH,
  },

  // CORS Configuration
  cors: {
    origins: process.env.FRONTEND_URL?.split(',') || [],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
  },
}));

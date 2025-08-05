import { registerAs } from '@nestjs/config';

export default registerAs('security', () => ({
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret:
      process.env.REFRESH_TOKEN_SECRET ||
      'fallback-refresh-secret-change-in-production',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    algorithm: 'HS256',
    issuer: 'order-tracker-nexus',
    audience: 'order-tracker-users',
  },

  // Password Security
  password: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS!, 10) || 12,
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },

  // Rate Limiting
  rateLimit: {
    // Global rate limiting
    global: {
      ttl: parseInt(process.env.THROTTLE_TTL!, 10) || 60, // seconds
      limit: parseInt(process.env.THROTTLE_LIMIT!, 10) || 100, // requests per TTL
    },

    // Authentication endpoints
    auth: {
      ttl: 900, // 15 minutes
      limit: 5, // 5 login attempts per 15 minutes
    },

    // File upload endpoints
    upload: {
      ttl: 60, // 1 minute
      limit: 10, // 10 uploads per minute
    },

    // API endpoints
    api: {
      ttl: 60, // 1 minute
      limit: 1000, // 1000 requests per minute
    },
  },

  // CORS Configuration
  cors: {
    origin:
      process.env.NODE_ENV === 'production'
        ? process.env.FRONTEND_URL?.split(',') || []
        : true, // Allow all origins in development
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
      'X-CSRF-Token',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
    maxAge: 86400, // 24 hours
  },

  // Security Headers
  headers: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    noSniff: true,
    frameguard: { action: 'deny' },
    xssFilter: true,
    referrerPolicy: 'strict-origin-when-cross-origin',
  },

  // Session Security
  session: {
    secret:
      process.env.SESSION_SECRET ||
      'fallback-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    },
  },

  // File Upload Security
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE!, 10) || 10485760, // 10MB
    allowedMimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ],
    allowedExtensions: ['.xlsx', '.xls', '.csv'],
    scanForViruses: process.env.NODE_ENV === 'production',
    quarantinePath: '/var/quarantine/order-tracker',
  },

  // Input Validation
  validation: {
    maxStringLength: 1000,
    maxArrayLength: 100,
    maxObjectDepth: 5,
    stripUnknownProperties: true,
    forbidNonWhitelisted: true,
    whitelist: true,
    transform: true,
  },

  // API Security
  api: {
    enableVersioning: true,
    defaultVersion: '1',
    enableSwagger: process.env.NODE_ENV !== 'production',
    swaggerPath: 'api/docs',
    enableApiKey: false, // Set to true if using API keys
    apiKeyHeader: 'X-API-Key',
  },

  // Database Security
  database: {
    ssl: process.env.NODE_ENV === 'production',
    connectionTimeout: 60000,
    acquireTimeout: 60000,
    timeout: 60000,
    enableQueryLogging: process.env.NODE_ENV !== 'production',
    maxConnections: 20,
  },

  // Monitoring and Alerting
  monitoring: {
    enableHealthCheck: true,
    healthCheckPath: '/health',
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPath: '/metrics',
    alertOnFailedLogins: true,
    alertOnHighErrorRate: true,
    alertThreshold: 0.05, // 5% error rate
  },

  // Encryption
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    encoding: 'hex',
  },
}));

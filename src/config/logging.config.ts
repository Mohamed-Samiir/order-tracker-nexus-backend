import { registerAs } from '@nestjs/config';
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export default registerAs('logging', (): WinstonModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';
  const logLevel = process.env.LOG_LEVEL || (isProduction ? 'warn' : 'debug');
  const logDir = process.env.LOG_FILE_PATH
    ? process.env.LOG_FILE_PATH.substring(
        0,
        process.env.LOG_FILE_PATH.lastIndexOf('/'),
      )
    : './logs';

  const transports: winston.transport[] = [];

  // Console transport for development
  if (!isProduction) {
    transports.push(
      new winston.transports.Console({
        level: logLevel,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.colorize(),
          winston.format.printf(
            ({ timestamp, level, message, context, trace, ...meta }) => {
              const metaString = Object.keys(meta).length
                ? JSON.stringify(meta, null, 2)
                : '';
              const traceString = trace ? `\n${trace}` : '';
              return `${timestamp} [${context || 'Application'}] ${level}: ${message}${metaString}${traceString}`;
            },
          ),
        ),
      }),
    );
  }

  // File transports for production
  if (isProduction) {
    // Error log file
    transports.push(
      new DailyRotateFile({
        level: 'error',
        filename: `${logDir}/error-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    );

    // Combined log file
    transports.push(
      new DailyRotateFile({
        level: logLevel,
        filename: `${logDir}/combined-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      }),
    );

    // Access log file
    transports.push(
      new DailyRotateFile({
        level: 'http',
        filename: `${logDir}/access-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '7d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );

    // Security log file
    transports.push(
      new DailyRotateFile({
        level: 'warn',
        filename: `${logDir}/security-%DATE%.log`,
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '30d',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          // Filter for security-related events only
          winston.format((info) => {
            const message =
              typeof info.message === 'string' ? info.message : '';
            const isSecurityLog =
              info.context === 'Security' ||
              (message &&
                (message.includes('authentication') ||
                  message.includes('authorization') ||
                  message.includes('login') ||
                  message.includes('failed') ||
                  message.includes('unauthorized')));
            return isSecurityLog ? info : false;
          })(),
          winston.format.json(),
        ),
      }),
    );
  }

  // Add console transport for production if explicitly enabled
  if (isProduction && process.env.ENABLE_CONSOLE_LOGS === 'true') {
    transports.push(
      new winston.transports.Console({
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
        ),
      }),
    );
  }

  return {
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp'],
      }),
    ),
    defaultMeta: {
      service: 'order-tracker-nexus',
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
    },
    transports,

    // Exception handling
    exceptionHandlers: isProduction
      ? [
          new DailyRotateFile({
            filename: `${logDir}/exceptions-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_MAX_FILES || '30d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            ),
          }),
        ]
      : [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
        ],

    // Rejection handling
    rejectionHandlers: isProduction
      ? [
          new DailyRotateFile({
            filename: `${logDir}/rejections-%DATE%.log`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: process.env.LOG_MAX_SIZE || '20m',
            maxFiles: process.env.LOG_MAX_FILES || '30d',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            ),
          }),
        ]
      : [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.colorize(),
              winston.format.simple(),
            ),
          }),
        ],

    // Exit on error
    exitOnError: false,

    // Silent mode for testing
    silent: process.env.NODE_ENV === 'test',
  };
});

// Custom log levels for application-specific logging
export const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6,
    security: 1, // Same as warn but for security events
    audit: 2, // Same as info but for audit events
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey',
    security: 'red bold',
    audit: 'green bold',
  },
};

// Log message templates
export const LOG_TEMPLATES = {
  // Authentication events
  LOGIN_SUCCESS: (userId: string, ip: string) => ({
    message: 'User login successful',
    userId,
    ip,
    event: 'login_success',
    context: 'Security',
  }),

  LOGIN_FAILED: (email: string, ip: string, reason: string) => ({
    message: 'User login failed',
    email,
    ip,
    reason,
    event: 'login_failed',
    context: 'Security',
  }),

  LOGOUT: (userId: string, ip: string) => ({
    message: 'User logout',
    userId,
    ip,
    event: 'logout',
    context: 'Security',
  }),

  // API events
  API_REQUEST: (method: string, url: string, ip: string, userId?: string) => ({
    message: 'API request',
    method,
    url,
    ip,
    userId,
    event: 'api_request',
    context: 'API',
  }),

  API_ERROR: (
    method: string,
    url: string,
    error: string,
    ip: string,
    userId?: string,
  ) => ({
    message: 'API error',
    method,
    url,
    error,
    ip,
    userId,
    event: 'api_error',
    context: 'API',
  }),

  // Business events
  ORDER_CREATED: (orderId: string, userId: string) => ({
    message: 'Order created',
    orderId,
    userId,
    event: 'order_created',
    context: 'Business',
  }),

  DELIVERY_CREATED: (deliveryId: string, orderId: string, userId: string) => ({
    message: 'Delivery created',
    deliveryId,
    orderId,
    userId,
    event: 'delivery_created',
    context: 'Business',
  }),

  EXCEL_IMPORT: (
    fileName: string,
    recordsProcessed: number,
    userId: string,
  ) => ({
    message: 'Excel import completed',
    fileName,
    recordsProcessed,
    userId,
    event: 'excel_import',
    context: 'Business',
  }),

  // System events
  APPLICATION_START: () => ({
    message: 'Application started',
    event: 'app_start',
    context: 'System',
  }),

  APPLICATION_SHUTDOWN: () => ({
    message: 'Application shutdown',
    event: 'app_shutdown',
    context: 'System',
  }),

  DATABASE_CONNECTION: (status: string) => ({
    message: 'Database connection status',
    status,
    event: 'db_connection',
    context: 'System',
  }),
};

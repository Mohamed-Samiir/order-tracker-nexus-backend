import { registerAs } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

/**
 * Safely parse integer from environment variable
 * @param value - Environment variable value
 * @param defaultValue - Default value if parsing fails
 * @returns Parsed integer or default value
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return !isNaN(parsed) && parsed >= 0 ? parsed : defaultValue;
}

/**
 * Cache configuration factory
 * Returns appropriate cache configuration based on environment
 */
export default registerAs('cache', (): CacheModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.REDIS_HOST) {
    // Redis cache for production
    const validPort = safeParseInt(process.env.REDIS_PORT, 6379);
    const validDb = safeParseInt(process.env.REDIS_DB, 0);

    return {
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: validPort,
      password: process.env.REDIS_PASSWORD,
      db: validDb,
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of items in cache

      // Redis-specific options
      retry_strategy: (options: any) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with an error
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          // End reconnecting after a specific timeout and flush all commands with an error
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          // End reconnecting with built in error
          return undefined;
        }
        // Reconnect after
        return Math.min(options.attempt * 100, 3000);
      },

      // Connection options
      connect_timeout: 60000,
      lazyConnect: true,
      maxRetriesPerRequest: null, // Remove duplicate and keep only null value
      retryDelayOnFailover: 100,
      enableReadyCheck: false,

      // Compression
      compression: 'gzip',

      // Serialization
      serialize: JSON.stringify,
      deserialize: JSON.parse,
    };
  } else {
    // In-memory cache for development
    return {
      ttl: 300, // 5 minutes
      max: 100, // Maximum number of items in cache

      // Memory store options
      store: 'memory',

      // Development-specific options
      checkperiod: 600, // Check for expired keys every 10 minutes
    };
  }
});

// Cache key patterns
export const CACHE_KEYS = {
  // User-related caches
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_PERMISSIONS: (userId: string) => `user:permissions:${userId}`,

  // Order-related caches
  ORDER_LIST: (page: number, limit: number, filters: string) =>
    `orders:list:${page}:${limit}:${filters}`,
  ORDER_DETAIL: (orderId: string) => `order:detail:${orderId}`,
  ORDER_ITEMS: (orderId: string) => `order:items:${orderId}`,
  ORDER_STATS: () => 'orders:stats',

  // Delivery-related caches
  DELIVERY_LIST: (page: number, limit: number, filters: string) =>
    `deliveries:list:${page}:${limit}:${filters}`,
  DELIVERY_DETAIL: (deliveryId: string) => `delivery:detail:${deliveryId}`,
  DELIVERY_STATS: () => 'deliveries:stats',

  // Dashboard caches
  DASHBOARD_STATS: (userId: string) => `dashboard:stats:${userId}`,
  RECENT_ORDERS: (userId: string) => `dashboard:recent_orders:${userId}`,
  RECENT_DELIVERIES: (userId: string) =>
    `dashboard:recent_deliveries:${userId}`,

  // System caches
  SYSTEM_CONFIG: () => 'system:config',
  API_RATE_LIMIT: (ip: string, endpoint: string) =>
    `rate_limit:${ip}:${endpoint}`,

  // Search caches
  SEARCH_RESULTS: (query: string, type: string) => `search:${type}:${query}`,

  // File processing caches
  EXCEL_PROCESSING: (fileHash: string) => `excel:processing:${fileHash}`,
  EXCEL_RESULTS: (fileHash: string) => `excel:results:${fileHash}`,
};

// Cache TTL configurations (in seconds)
export const CACHE_TTL = {
  // Short-term caches (1-5 minutes)
  USER_PROFILE: 300, // 5 minutes
  ORDER_LIST: 60, // 1 minute
  DELIVERY_LIST: 60, // 1 minute
  SEARCH_RESULTS: 300, // 5 minutes

  // Medium-term caches (5-30 minutes)
  ORDER_DETAIL: 900, // 15 minutes
  DELIVERY_DETAIL: 900, // 15 minutes
  DASHBOARD_STATS: 1800, // 30 minutes

  // Long-term caches (1+ hours)
  USER_PERMISSIONS: 3600, // 1 hour
  SYSTEM_CONFIG: 7200, // 2 hours
  ORDER_STATS: 3600, // 1 hour
  DELIVERY_STATS: 3600, // 1 hour

  // Very long-term caches (1+ days)
  EXCEL_RESULTS: 86400, // 24 hours

  // Rate limiting
  API_RATE_LIMIT: 3600, // 1 hour
};

// Cache invalidation patterns
export const CACHE_INVALIDATION = {
  // When order is created/updated/deleted
  ORDER_OPERATIONS: [
    'orders:list:*',
    'orders:stats',
    'dashboard:stats:*',
    'dashboard:recent_orders:*',
  ],

  // When delivery is created/updated/deleted
  DELIVERY_OPERATIONS: [
    'deliveries:list:*',
    'deliveries:stats',
    'dashboard:stats:*',
    'dashboard:recent_deliveries:*',
    'order:detail:*', // Because delivery affects order quantities
  ],

  // When user is updated
  USER_OPERATIONS: ['user:profile:*', 'user:permissions:*'],

  // When system configuration changes
  SYSTEM_OPERATIONS: ['system:config'],
};

// Cache warming strategies
export const CACHE_WARMING = {
  // Warm up these caches on application start
  STARTUP: ['system:config', 'orders:stats', 'deliveries:stats'],

  // Warm up these caches when user logs in
  USER_LOGIN: (userId: string) => [
    CACHE_KEYS.USER_PROFILE(userId),
    CACHE_KEYS.USER_PERMISSIONS(userId),
    CACHE_KEYS.DASHBOARD_STATS(userId),
  ],

  // Warm up these caches during off-peak hours
  SCHEDULED: ['orders:list:1:10:', 'deliveries:list:1:10:'],
};

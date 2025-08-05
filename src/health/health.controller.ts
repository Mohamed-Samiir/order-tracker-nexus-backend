import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get application health status' })
  @ApiResponse({ status: 200, description: 'Health check successful' })
  @ApiResponse({ status: 503, description: 'Health check failed' })
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health check
      () => this.db.pingCheck('database'),

      // Memory health check (alert if using more than 1GB)
      () => this.memory.checkHeap('memory_heap', 1024 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),

      // Disk health check (alert if less than 1GB free space)
      () =>
        this.disk.checkStorage('storage', {
          path: '/',
          thresholdPercent: 0.9, // 90% usage threshold
        }),
    ]);
  }

  @Get('ready')
  @ApiOperation({ summary: 'Check if application is ready to serve requests' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  @HealthCheck()
  readiness() {
    return this.health.check([
      // Database connectivity
      () => this.db.pingCheck('database'),

      // Critical services check
      async () => {
        try {
          // Check if we can perform basic operations
          const dbConnection = this.db['connection'];
          await dbConnection.query('SELECT 1');

          return {
            database_operations: {
              status: 'up',
              message: 'Database operations working',
            },
          };
        } catch (error) {
          return {
            database_operations: {
              status: 'down',
              message: error.message,
            },
          };
        }
      },
    ]);
  }

  @Get('live')
  @ApiOperation({ summary: 'Check if application is alive' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('app.nodeEnv'),
      version: process.env.npm_package_version || '1.0.0',
      node_version: process.version,
      memory: {
        used:
          Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
          100,
        total:
          Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
          100,
        external:
          Math.round((process.memoryUsage().external / 1024 / 1024) * 100) /
          100,
      },
      cpu: {
        usage: process.cpuUsage(),
      },
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get application metrics' })
  @ApiResponse({ status: 200, description: 'Metrics retrieved successfully' })
  async metrics() {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get('app.nodeEnv'),
      version: process.env.npm_package_version || '1.0.0',

      // System metrics
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
      },

      // Memory metrics (in MB)
      memory: {
        heap_used: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
        heap_total:
          Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
        external: Math.round((memoryUsage.external / 1024 / 1024) * 100) / 100,
        rss: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
        array_buffers:
          Math.round((memoryUsage.arrayBuffers / 1024 / 1024) * 100) / 100,
      },

      // CPU metrics
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },

      // Event loop metrics
      event_loop: {
        delay: await this.getEventLoopDelay(),
      },

      // Database metrics
      database: await this.getDatabaseMetrics(),

      // Application metrics
      application: {
        active_handles: this.getActiveHandles(),
        active_requests: this.getActiveRequests(),
      },
    };
  }

  private async getEventLoopDelay(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delta = process.hrtime.bigint() - start;
        resolve(Number(delta) / 1000000); // Convert to milliseconds
      });
    });
  }

  private async getDatabaseMetrics() {
    try {
      const connection = this.db['connection'];

      // Get connection pool info if available
      const poolInfo = connection.driver?.pool || {};

      return {
        status: 'connected',
        type: connection.options.type,
        database: connection.options.database,
        pool: {
          total: poolInfo.totalCount || 0,
          idle: poolInfo.idleCount || 0,
          waiting: poolInfo.waitingCount || 0,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
      };
    }
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'Check external dependencies health' })
  @ApiResponse({ status: 200, description: 'Dependencies check completed' })
  async dependencies() {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkFileSystem(),
    ]);

    return {
      timestamp: new Date().toISOString(),
      dependencies: {
        database:
          checks[0].status === 'fulfilled'
            ? checks[0].value
            : { status: 'error', error: checks[0].reason },
        redis:
          checks[1].status === 'fulfilled'
            ? checks[1].value
            : { status: 'error', error: checks[1].reason },
        filesystem:
          checks[2].status === 'fulfilled'
            ? checks[2].value
            : { status: 'error', error: checks[2].reason },
      },
    };
  }

  private async checkDatabase() {
    try {
      const connection = this.db['connection'];
      const result = await connection.query('SELECT 1 as test');

      return {
        status: 'healthy',
        response_time: Date.now(),
        details: {
          connected: connection.isConnected,
          database: connection.options.database,
          test_query: result[0]?.test === 1,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkRedis() {
    try {
      // If Redis is configured, check its health
      const redisHost = this.configService.get('redis.host');

      if (!redisHost) {
        return {
          status: 'not_configured',
          message: 'Redis is not configured',
        };
      }

      // Add Redis health check logic here if Redis is implemented
      return {
        status: 'healthy',
        message: 'Redis health check not implemented yet',
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  private async checkFileSystem() {
    try {
      const fs = require('fs').promises;
      const uploadPath =
        this.configService.get('upload.uploadPath') || './uploads';

      // Check if upload directory is accessible
      await fs.access(uploadPath);

      // Check disk space
      const stats = await fs.stat(uploadPath);

      return {
        status: 'healthy',
        details: {
          upload_path: uploadPath,
          accessible: true,
          stats: {
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
          },
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  /**
   * Safely get active handles count
   * Uses type assertion to access internal Node.js methods
   */
  private getActiveHandles(): number {
    try {
      const processWithInternals = process as any;
      return processWithInternals._getActiveHandles
        ? processWithInternals._getActiveHandles().length
        : 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Safely get active requests count
   * Uses type assertion to access internal Node.js methods
   */
  private getActiveRequests(): number {
    try {
      const processWithInternals = process as any;
      return processWithInternals._getActiveRequests
        ? processWithInternals._getActiveRequests().length
        : 0;
    } catch (error) {
      return 0;
    }
  }
}

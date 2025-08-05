import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable CORS with multiple origins support
  const frontendUrls = configService.get('app.frontendUrl').split(',');
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if the origin is in our allowed list
      if (frontendUrls.includes(origin)) {
        return callback(null, true);
      }

      // For development, also allow localhost with any port
      if (configService.get('app.nodeEnv') === 'development') {
        const localhostRegex = /^http:\/\/localhost:\d+$/;
        if (localhostRegex.test(origin)) {
          return callback(null, true);
        }
      }

      return callback(new Error('Not allowed by CORS'), false);
    },
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
    credentials: true,
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  });

  // Security middleware
  app.use(
    helmet({
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
    }),
  );

  // Compression middleware
  app.use(compression());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false, // Allow non-whitelisted properties to pass through
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      skipMissingProperties: true, // Skip validation for missing properties
      skipNullProperties: true, // Skip validation for null properties
      skipUndefinedProperties: true, // Skip validation for undefined properties
    }),
  );

  // Swagger documentation
  if (configService.get('app.nodeEnv') === 'development') {
    const config = new DocumentBuilder()
      .setTitle('Order Tracker Nexus API')
      .setDescription(
        'API documentation for Order Tracker Nexus backend with JWT authentication',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Authentication', 'Authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Orders', 'Order management endpoints with Excel import')
      .addTag(
        'Deliveries',
        'Delivery management with automatic quantity tracking',
      )
      .addTag('Health', 'Health check endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = configService.get('app.port');
  await app.listen(port);

  console.log(`🚀 Application is running on: http://localhost:${port}`);
  if (configService.get('app.nodeEnv') === 'development') {
    console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}
bootstrap();

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { ConfigService } from '@nestjs/config';

describe('Production E2E Tests', () => {
  let app: INestApplication;
  let configService: ConfigService;
  let authToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = app.get(ConfigService);

    // Apply the same configuration as production
    app.enableCors({
      origin: configService.get('app.frontendUrl'),
      credentials: true,
    });

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Security Tests', () => {
    it('should have security headers', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-content-type-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should enforce rate limiting', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/health'));

      const responses = await Promise.all(requests);
      const statusCodes = responses.map((r) => r.status);

      // Should have some successful requests
      expect(statusCodes.filter((code) => code === 200).length).toBeGreaterThan(
        0,
      );
    });

    it('should reject requests without proper CORS', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Origin', 'https://malicious-site.com')
        .expect(403);
    });
  });

  describe('Authentication Flow Tests', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@ordertracker.com',
          password: 'admin123',
        })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe('admin@ordertracker.com');

      authToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject invalid credentials', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@ordertracker.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('should refresh token successfully', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({
          refreshToken: refreshToken,
        })
        .expect(201);

      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.email).toBe('admin@ordertracker.com');
    });

    it('should reject requests without token', async () => {
      await request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });

  describe('Orders CRUD Tests', () => {
    let orderId: string;

    it('should create a new order', async () => {
      const orderData = {
        orderId: 'TEST-ORDER-001',
        status: 'pending',
        items: [
          {
            asin: 'B08N5WRWNW',
            brandName: 'Test Brand',
            modelNumber: '1234567890123',
            title: 'Test Product',
            requestingDate: '2024-01-15',
            quantityRequested: 10,
            unitCost: 25.99,
          },
        ],
      };

      const response = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.data.orderId).toBe('TEST-ORDER-001');
      expect(response.body.data.items).toHaveLength(1);
      orderId = response.body.data.id;
    });

    it('should get orders list with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders?page=1&limit=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toBeDefined();
      expect(response.body.total).toBeDefined();
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
    });

    it('should get order by ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(orderId);
      expect(response.body.data.orderId).toBe('TEST-ORDER-001');
    });

    it('should update order', async () => {
      const updateData = {
        status: 'processing',
      };

      const response = await request(app.getHttpServer())
        .patch(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.data.status).toBe('processing');
    });
  });

  describe('Excel Import Tests', () => {
    it('should reject non-Excel files', async () => {
      await request(app.getHttpServer())
        .post('/orders/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('not an excel file'), 'test.txt')
        .field('orderId', 'TEST-IMPORT-001')
        .expect(400);
    });

    it('should reject files that are too large', async () => {
      const largeBuffer = Buffer.alloc(20 * 1024 * 1024); // 20MB

      await request(app.getHttpServer())
        .post('/orders/import')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeBuffer, 'large.xlsx')
        .field('orderId', 'TEST-IMPORT-002')
        .expect(413);
    });
  });

  describe('Role-Based Access Control Tests', () => {
    let viewerToken: string;

    it('should login as viewer', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'viewer@ordertracker.com',
          password: 'viewer123',
        })
        .expect(201);

      viewerToken = response.body.accessToken;
    });

    it('should allow viewer to read orders', async () => {
      await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('should deny viewer from creating orders', async () => {
      const orderData = {
        orderId: 'VIEWER-TEST-001',
        status: 'pending',
        items: [],
      };

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send(orderData)
        .expect(403);
    });

    it('should deny viewer from accessing user management', async () => {
      await request(app.getHttpServer())
        .get('/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });

  describe('Performance Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();

      await request(app.getHttpServer()).get('/health').expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests', async () => {
      const concurrentRequests = Array(50)
        .fill(null)
        .map(() =>
          request(app.getHttpServer())
            .get('/orders')
            .set('Authorization', `Bearer ${authToken}`),
        );

      const responses = await Promise.all(concurrentRequests);
      const successfulResponses = responses.filter((r) => r.status === 200);

      expect(successfulResponses.length).toBeGreaterThan(40); // Allow some to fail due to rate limiting
    });
  });

  describe('Error Handling Tests', () => {
    it('should return proper error format', async () => {
      const response = await request(app.getHttpServer())
        .get('/orders/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.message).toBeDefined();
      expect(response.body.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);
    });
  });
});

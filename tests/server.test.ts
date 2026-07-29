import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';

describe('Server API tests', () => {
  let app: any;
  let token = '';

  beforeEach(async () => {
    // Make sure we are in test environment to avoid starting the server
    process.env.NODE_ENV = 'test';
    app = await startServer();
    const authLoginRes = await request(app).post('/api/auth/login').send({ pin: '0000' });
    token = authLoginRes.body.token;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/menu', () => {
    it('should return 500 when database transaction fails', async () => {
      // Mock db.transaction to throw an error
      const errorMessage = 'Database transaction failed';
      vi.spyOn(db, 'transaction').mockImplementation(() => {
        throw new Error(errorMessage);
      });

      const mockMenuItems = [
        { id: 1, name: "Test item", description: "Test description", price: 1.0, available: true, category: "Test" }
      ];

      const response = await request(app)
        .post('/api/menu')
        .set('Authorization', `Bearer ${token}`)
        .send(mockMenuItems);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: "Internal Server Error",
        message: "An unexpected error occurred",
        path: "/api/menu"
      });
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  describe('Rate Limiter', () => {
    it('should return 429 Too Many Requests when rate limit is exceeded', async () => {
      // Make 100 requests (the limit)
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(request(app).get('/api/menu').set('Authorization', `Bearer ${token}`));
      }
      await Promise.all(promises);

      // The 101st request should be rate limited
      const response = await request(app).get('/api/menu').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(429);
    });
  });

  describe('CORS', () => {
    it('should allow local origins', async () => {
      const response = await request(app)
        .get('/api/menu')
        .set('Origin', 'http://localhost:5173')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).not.toBe(500);
      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    });

    it('should allow same-origin requests (Origin matches Host)', async () => {
      const response = await request(app)
        .get('/api/menu')
        .set('Origin', 'https://ss.plcnet.org:3402')
        .set('Host', 'ss.plcnet.org:3402')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).not.toBe(500);
      expect(response.headers['access-control-allow-origin']).toBe('https://ss.plcnet.org:3402');
    });

    it('should block unauthorized remote origins without throwing 500', async () => {
      const response = await request(app)
        .get('/api/menu')
        .set('Origin', 'https://malicious.com')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).not.toBe(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});

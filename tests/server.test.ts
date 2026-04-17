import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';

describe('POST /api/menu', () => {
  let app: any;

  beforeEach(async () => {
    // Make sure we are in test environment to avoid starting the server
    process.env.NODE_ENV = 'test';
    app = await startServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return 500 when database transaction fails', async () => {
    // Obtain a valid token first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ pin: '0000' });

    const token = loginRes.body.token;

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

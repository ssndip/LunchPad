import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer, db } from '../server';

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
      .send(mockMenuItems);

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: errorMessage });
    expect(db.transaction).toHaveBeenCalled();
  });
});

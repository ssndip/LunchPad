import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startServer } from './server.js';
import express from 'express';

describe('/api/v1/order API', () => {
  let app: express.Express;
  let server: any;

  beforeAll(async () => {
    // Set environment to test so we don't start the vite server
    process.env.NODE_ENV = 'test';
    // Use an arbitrary available port for testing
    process.env.PORT = '0';
    const result = await startServer();
    app = result.app;
    server = result.server;
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it('should return 400 when an empty itemIds array is provided', async () => {
    const response = await request(app)
      .post('/api/v1/order')
      .send({
        rfid: '1234567890', // Valid seeded RFID
        itemIds: []         // Empty array
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toEqual({
      error: 'No valid items selected'
    });
  });

  it('should return 400 when an array with non-existent itemIds is provided', async () => {
    const response = await request(app)
      .post('/api/v1/order')
      .send({
        rfid: '1234567890', // Valid seeded RFID
        itemIds: [9999, 10000] // Non-existent IDs
      })
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body).toEqual({
      error: 'No valid items selected'
    });
  });
});

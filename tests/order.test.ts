import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { appPromise } from '../server';

let app: any;
let authToken: string;

beforeAll(async () => {
  // Wait for the app to initialize
  app = await appPromise;

  // Login to get a token for admin-restricted routes
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ pin: '0000' });
  
  if (loginRes.body.success) {
    authToken = loginRes.body.token;
  }
});

describe('POST /api/v1/order', () => {
  it('should return 400 if RFID or items are missing', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request: Missing RFID or items');
  });

  it('should return 400 if items is not an array', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request: Missing RFID or items');
  });

  it('should return 404 if card is not found', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: 'unknown_rfid', items: [{ id: 1 }] });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Card not found: unknown_rfid/);
  });

  it('should return 400 if no valid items are selected', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: [{ id: 999 }] }); // Assuming 999 doesn't exist

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No valid items selected');
  });

  it('should process a valid order successfully', async () => {
    const cardsBeforeRes = await request(app).get('/api/cards').set('Authorization', `Bearer ${authToken}`);
    const userCardBefore = Array.isArray(cardsBeforeRes.body) ? cardsBeforeRes.body.find((c: any) => c.rfid === '1234567890') : null;
    const initialBalance = userCardBefore ? userCardBefore.balance : 0;

    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: [{ id: 1 }, { id: 2 }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.items.length).toBe(2);

    const totalExpected = res.body.order.items.reduce((sum: number, i: any) => sum + i.price, 0);
    expect(res.body.order.totalPrice).toBe(totalExpected);

    const cardsAfterRes = await request(app).get('/api/cards').set('Authorization', `Bearer ${authToken}`);
    const userCardAfter = Array.isArray(cardsAfterRes.body) ? cardsAfterRes.body.find((c: any) => c.rfid === '1234567890') : null;
    expect(userCardAfter?.balance).toBe(initialBalance + totalExpected);
  });

  it('should return 409 if menu version mismatch', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ 
        rfid: '1234567890', 
        items: [{ id: 1 }],
        menuVersion: 999 // Intentionally wrong version
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Menu Updated');
  });

  it('should return 403 if kiosk is closed', async () => {
    await request(app).post('/api/status').set('Authorization', `Bearer ${authToken}`).send({ open: false });

    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: [{ id: 1 }] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Kiosk is closed.');

    await request(app).post('/api/status').set('Authorization', `Bearer ${authToken}`).send({ open: true });
  });

  it('should handle rfid string cleaning correctly', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '  1234567890  ', items: [{ id: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

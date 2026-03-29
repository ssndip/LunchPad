import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { appPromise } from '../server';

let app: any;

beforeAll(async () => {
  // Wait for the app to initialize
  app = await appPromise;
});

describe('POST /api/v1/order', () => {
  it('should return 400 if RFID or itemIds are missing', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request: Missing RFID or items');
  });

  it('should return 400 if itemIds is not an array', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', itemIds: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid request: Missing RFID or items');
  });

  it('should return 404 if card is not found', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: 'unknown_rfid', itemIds: [1] });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Card not found: unknown_rfid/);
  });

  it('should return 400 if no valid items are selected', async () => {
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', itemIds: [999] }); // Assuming 999 doesn't exist

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No valid items selected');
  });

  it('should process a valid order successfully', async () => {
    // 1. Initial state check (optional but good for testing balance update)
    const cardsBeforeRes = await request(app).get('/api/cards?pin=test');
    const userCardBefore = Array.isArray(cardsBeforeRes.body) ? cardsBeforeRes.body.find((c: any) => c.rfid === '1234567890') : null;
    const initialBalance = userCardBefore ? userCardBefore.balance : 0;

    // 2. Process order
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', itemIds: [1, 2] }); // Items 1 and 2 seeded

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order).toBeDefined();
    expect(res.body.order.rfid).toBe('1234567890');
    expect(res.body.order.items.length).toBe(2);

    const totalExpected = res.body.order.items.reduce((sum: number, i: any) => sum + i.price, 0);
    expect(res.body.order.totalPrice).toBe(totalExpected);

    // 3. Verify balance was updated
    const cardsAfterRes = await request(app).get('/api/cards?pin=test');
    const userCardAfter = Array.isArray(cardsAfterRes.body) ? cardsAfterRes.body.find((c: any) => c.rfid === '1234567890') : null;
    expect(userCardAfter?.balance).toBe(initialBalance + totalExpected);
  });

  it('should return 403 if kiosk is closed', async () => {
    // Close the kiosk
    await request(app).post('/api/status?pin=test').send({ open: false });

    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', itemIds: [1] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Kiosk is closed. Please open it from the Admin panel.');

    // Re-open for other tests if any
    await request(app).post('/api/status?pin=test').send({ open: true });
  });

  it('should handle rfid string cleaning correctly', async () => {
    // Pass rfid with spaces and weird casing
    const res = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '  1234567890  ', itemIds: [1] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

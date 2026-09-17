/**
 * orderIdempotency.test.ts — Regression for an order being charged twice.
 *
 * Nothing identified an order attempt, so a response lost after the server had
 * already committed (wifi dropping at the wrong moment, a proxy timing out, the
 * tablet sleeping) looked exactly like a failure to the kiosk. App.tsx's catch
 * queued it, the offline sync replayed it later, and the customer was charged
 * again. The three-second duplicate-tap guard cannot help — the replay happens
 * minutes or hours afterwards.
 *
 * A `clientOrderId` sent with the attempt now makes the submission idempotent:
 * replaying one returns the original order instead of creating a second.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';

process.env.NODE_ENV = 'test';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

const RFID = '1234567890';
let app: any;
let token = '';

const auth = () => ({ Authorization: `Bearer ${token}` });

const order = (body: any) => request(app).post('/api/v1/order').send(body);

const balanceOf = async (rfid: string): Promise<number> => {
  const res = await request(app).get('/api/cards').set(auth());
  return res.body.find((c: any) => c.rfid === rfid)?.balance ?? 0;
};

const orderRowCount = (): number =>
  (db.prepare('SELECT COUNT(*) AS c FROM orders').get() as any).c;

beforeAll(async () => {
  app = await startServer();
  db.prepare('DELETE FROM settings WHERE key = ?').run('admin_pin');
  token = (await request(app).post('/api/auth/login').send({ pin: '424242' })).body.token;
  expect(token).toBeTruthy();

  await request(app)
    .post('/api/menu')
    .set(auth())
    .send({ items: [{ id: 1, name: 'Супа', price: 2.0, available: true, category: 'Супи' }] })
    .expect(200);
});

beforeEach(() => {
  db.prepare('DELETE FROM orders').run();
  db.prepare('UPDATE cards SET balance = 0').run();
});

describe('replaying the same order attempt', () => {
  it('charges once and records one order', async () => {
    const clientOrderId = 'attempt-aaa';

    const first = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId });
    expect(first.status).toBe(200);
    expect(first.body.success).toBe(true);

    const second = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId });
    expect(second.status).toBe(200);
    expect(second.body.success).toBe(true);

    expect(await balanceOf(RFID)).toBe(2.0);
    expect(orderRowCount()).toBe(1);
  });

  it('returns the original order, flagged as a replay', async () => {
    const clientOrderId = 'attempt-bbb';

    const first = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId });
    const second = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId });

    expect(second.body.duplicate).toBe(true);
    expect(second.body.order.id).toBe(first.body.order.id);
    expect(second.body.order.totalPrice).toBe(first.body.order.totalPrice);
    expect(Array.isArray(second.body.order.items)).toBe(true);
  });

  it('succeeds even when the menu has moved on since the original', async () => {
    // The overnight replay: without this the retry would 409 and the order,
    // already paid for, would be reported as failed.
    const clientOrderId = 'attempt-ccc';
    await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId }).expect(200);

    const replay = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId, menuVersion: 999 });

    expect(replay.status).toBe(200);
    expect(replay.body.duplicate).toBe(true);
    expect(orderRowCount()).toBe(1);
  });

  it('succeeds even when the kiosk has since closed', async () => {
    const clientOrderId = 'attempt-ddd';
    await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId }).expect(200);

    await request(app).post('/api/status').set(auth()).send({ open: false }).expect(200);
    try {
      const replay = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId });
      expect(replay.status).toBe(200);
      expect(replay.body.duplicate).toBe(true);
    } finally {
      await request(app).post('/api/status').set(auth()).send({ open: true });
    }
  });
});

describe('distinct order attempts', () => {
  it('charges each one', async () => {
    await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId: 'attempt-1' }).expect(200);
    await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId: 'attempt-2' }).expect(200);

    expect(await balanceOf(RFID)).toBe(4.0);
    expect(orderRowCount()).toBe(2);
  });

  it('still works for a client that sends no id at all', async () => {
    const res = await order({ rfid: RFID, items: [{ id: 1 }] });

    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBeUndefined();
    expect(orderRowCount()).toBe(1);
  });

  it('does not treat two id-less orders as duplicates of each other', async () => {
    await order({ rfid: RFID, items: [{ id: 1 }] }).expect(200);
    // Past the three-second duplicate-tap window, which is a separate guard.
    db.prepare("UPDATE orders SET timestamp = ?").run(new Date(Date.now() - 60000).toISOString());
    await order({ rfid: RFID, items: [{ id: 1 }] }).expect(200);

    expect(orderRowCount()).toBe(2);
  });

  it('rejects an id that is not a string', async () => {
    const res = await order({ rfid: RFID, items: [{ id: 1 }], clientOrderId: 42 });
    expect(res.status).toBe(400);
  });
});

/**
 * auditFixes.test.ts — Regressions for the defects found in the 2026-09-11
 * "what is not working" sweep.
 *
 *   1. An admin card's RFID was published by /api/cards/active-list to every
 *      client on the LAN, and /api/auth/login accepts a bare RFID as the whole
 *      credential — so anyone who could reach the kiosk could read the list and
 *      log into the dashboard as an admin.
 *   2. An unknown /api/... path fell through to the SPA fallback and answered
 *      200 text/html, so a client saw a typo'd endpoint as a success and then
 *      choked parsing the page as JSON.
 *   3. The kiosk open/close times and the close day were written to settings
 *      unvalidated. "banana" compares below every real HH:mm, so auto-timing
 *      then held the kiosk shut forever with no way to see why.
 *   4. Fees accepted negative and non-finite values, which flow straight into
 *      what a customer is charged.
 *   5. Deleting or resetting a card that does not exist reported success.
 *   6. Stored orders carried no record of the box fee charged, so the itemised
 *      day breakdown re-priced history every time the canteen fee changed.
 *   7. Only IPv4 counted as a local address, so on a network handing out IPv6
 *      the kiosk was refused its own card list.
 *   8. A system backup shipped `jwt_secret`, making the downloaded file a
 *      permanent skeleton key to the dashboard.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import { settings } from '../server/config';
import * as OrderService from '../server/services/orderService';
import { isPrivateAddress } from '../server/middleware/auth';

process.env.NODE_ENV = 'test';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

const adminToken = async (app: any): Promise<string> => {
  db.prepare("DELETE FROM settings WHERE key = ?").run("admin_pin");
  const res = await request(app).post('/api/auth/login').send({ pin: '424242' });
  return res.body.token;
};

describe('admin card RFIDs are not published', () => {
  const ADMIN_RFID = 'audit-admin-card';
  const PLAIN_RFID = 'audit-plain-card';

  beforeEach(() => {
    const insert = db.prepare(
      "INSERT OR REPLACE INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin) VALUES (?,?,?,?,?,?)"
    );
    insert.run(ADMIN_RFID, 'Audit Admin', 0, new Date().toISOString(), 1, null);
    insert.run(PLAIN_RFID, 'Audit Diner', 0, new Date().toISOString(), 0, null);
  });

  afterEach(() => {
    db.prepare("DELETE FROM cards WHERE rfid IN (?, ?)").run(ADMIN_RFID, PLAIN_RFID);
  });

  it('leaves admin cards out of the offline validation list', async () => {
    const app = await startServer();
    const res = await request(app).get('/api/cards/active-list');

    expect(res.status).toBe(200);
    expect(res.body).toContain(PLAIN_RFID);
    expect(res.body).not.toContain(ADMIN_RFID);
  });

  it('still lets an admin card log in when its RFID is known', async () => {
    const app = await startServer();
    const res = await request(app).post('/api/auth/login').send({ pin: ADMIN_RFID });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });
});

describe('unknown API routes', () => {
  it('answers 404 JSON rather than the SPA shell', async () => {
    const app = await startServer();
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.error).toBeTruthy();
  });

  it('still serves the SPA for a non-API path', async () => {
    const app = await startServer();
    const res = await request(app).get('/some/deep/kiosk/route');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

describe('settings validation', () => {
  let token: string;
  let app: any;

  beforeEach(async () => {
    app = await startServer();
    token = await adminToken(app);
  });

  const post = (body: any) =>
    request(app).post('/api/settings').set('Authorization', `Bearer ${token}`).send(body);

  it('rejects a kiosk open time that is not HH:mm', async () => {
    const before = settings.kioskOpenTime;
    const res = await post({ kioskOpenTime: 'banana' });

    expect(res.status).toBe(400);
    expect(settings.kioskOpenTime).toBe(before);
  });

  it('rejects an out-of-range close day', async () => {
    const before = settings.kioskCloseDay;
    const res = await post({ kioskCloseDay: 99 });

    expect(res.status).toBe(400);
    expect(settings.kioskCloseDay).toBe(before);
  });

  it('accepts -1 as "no closing day"', async () => {
    const res = await post({ kioskCloseDay: -1 });

    expect(res.status).toBe(200);
    expect(settings.kioskCloseDay).toBe(-1);
  });

  it('rejects a negative packaging fee', async () => {
    const before = settings.packagingFee;
    const res = await post({ packagingFee: -5 });

    expect(res.status).toBe(400);
    expect(settings.packagingFee).toBe(before);
  });

  it('rejects a negative delivery fee', async () => {
    const before = settings.deliveryFee;
    const res = await post({ deliveryFee: -1 });

    expect(res.status).toBe(400);
    expect(settings.deliveryFee).toBe(before);
  });

  it('still accepts valid values', async () => {
    const res = await post({ kioskOpenTime: '07:30', kioskCloseTime: '10:45', packagingFee: 0.25 });

    expect(res.status).toBe(200);
    expect(settings.kioskOpenTime).toBe('07:30');
    expect(settings.packagingFee).toBe(0.25);
  });
});

describe('card operations on a card that does not exist', () => {
  it('404s on delete instead of reporting success', async () => {
    const app = await startServer();
    const token = await adminToken(app);
    const res = await request(app)
      .delete('/api/cards/no-such-card-xyz')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('404s on balance reset instead of reporting success', async () => {
    const app = await startServer();
    const token = await adminToken(app);
    const res = await request(app)
      .post('/api/cards/no-such-card-xyz/reset')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });
});

describe('a stored order keeps the price it was charged', () => {
  const original = settings.packagingFee;

  afterEach(() => {
    settings.packagingFee = original;
    db.prepare("DELETE FROM cards WHERE rfid = ?").run('audit-fee-card');
  });

  it('does not re-price the itemised breakdown when the box fee changes', async () => {
    const app = await startServer();
    settings.packagingFee = 0.10;

    db.prepare("INSERT OR REPLACE INTO cards (rfid, ownerName, balance, lastUpdated, isAdmin, pin) VALUES (?,?,?,?,?,?)")
      .run('audit-fee-card', 'Audit Diner', 0, new Date().toISOString(), 0, null);

    // Qualifies for the fee by category, and names no amount of its own — so
    // before the fix it was re-priced against whatever the fee later became.
    const enriched = [
      { id: 90001, name: 'Audit Salad', price: 2.0, category: 'Salads', available: 1 },
    ] as any;

    const order = OrderService.processOrderTransaction({ rfid: 'audit-fee-card', ownerName: 'Audit Diner' }, enriched);
    expect(order.totalPrice).toBe(2.1);

    const stored = db.prepare("SELECT items FROM orders WHERE id = ?").get(order.id) as { items: string };
    const storedItems = JSON.parse(stored.items);

    // The manager raises the box fee the next day.
    settings.packagingFee = 0.50;

    expect(OrderService.calculateItemPrice(storedItems[0]).total).toBe(2.1);

    db.prepare("DELETE FROM orders WHERE id = ?").run(order.id);
    expect(app).toBeTruthy();
  });
});

describe('private address detection', () => {
  it('recognises IPv4 LAN ranges', () => {
    expect(isPrivateAddress('192.168.1.50')).toBe(true);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('172.20.0.9')).toBe(true);
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:192.168.1.50')).toBe(true);
  });

  it('recognises IPv6 link-local and unique-local addresses', () => {
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1c2b:aaff:fe12:3456')).toBe(true);
    expect(isPrivateAddress('febf::1')).toBe(true);
    expect(isPrivateAddress('fd00:1234::5')).toBe(true);
    expect(isPrivateAddress('fc00::1')).toBe(true);
    expect(isPrivateAddress('fe80::1%eth0')).toBe(true);
    expect(isPrivateAddress('FE80::ABCD')).toBe(true);
  });

  it('still rejects public addresses', () => {
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateAddress('fec0::1')).toBe(false); // site-local, deprecated
    expect(isPrivateAddress('fe7f::1')).toBe(false); // just below fe80::/10
    expect(isPrivateAddress(undefined)).toBe(false);
  });
});

describe('system backup export', () => {
  it('omits the JWT signing key but keeps the PIN pepper', async () => {
    const app = await startServer();
    const token = await adminToken(app);

    const res = await request(app).get('/api/system/backup').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const settingsRows = res.body.data.settings as { key: string }[];
    const keys = settingsRows.map(r => r.key);

    expect(keys).not.toContain('jwt_secret');
    expect(keys).toContain('pin_pepper');
    expect(res.headers['cache-control']).toContain('no-store');
  });
});

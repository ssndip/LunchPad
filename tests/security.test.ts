/**
 * security.test.ts — Regressions for the three access-control holes found in the
 * 2026-09-11 audit:
 *
 *   1. `verifyAdminPin` accepted the literal "0000" even when ADMIN_PIN was set
 *      to something else, so every install shipped a hardcoded admin password.
 *   2. `trust proxy` was pinned to 1, so any client could spoof `req.ip` with an
 *      X-Forwarded-For header and walk past the admin IP whitelist and both
 *      rate limiters.
 *   3. `/api/cards/active-list` and `/api/cards/:rfid/profile` were fully public,
 *      handing anyone on the internet every RFID plus each holder's name,
 *      balance and order history.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import { verifyAdminPin } from '../server/config';

process.env.NODE_ENV = 'test';

/** Clear any admin PIN so `verifyAdminPin` exercises its default-PIN fallback. */
const clearStoredAdminPin = () => {
  db.prepare("DELETE FROM settings WHERE key = ?").run("admin_pin");
};

describe('admin PIN fallback', () => {
  const originalAdminPin = process.env.ADMIN_PIN;

  beforeEach(() => {
    clearStoredAdminPin();
  });

  afterEach(() => {
    if (originalAdminPin === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = originalAdminPin;
  });

  it('accepts 0000 when no PIN has been configured (intended default)', () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin('0000')).toBe(true);
  });

  it('rejects 0000 once ADMIN_PIN is configured to something else', () => {
    process.env.ADMIN_PIN = 'SuperSecret9999';
    expect(verifyAdminPin('SuperSecret9999')).toBe(true);
    expect(verifyAdminPin('0000')).toBe(false);
  });

  it('rejects a wrong PIN of the same length as the default', () => {
    delete process.env.ADMIN_PIN;
    expect(verifyAdminPin('9999')).toBe(false);
  });

  it('rejects the default once an admin has set their own PIN', async () => {
    delete process.env.ADMIN_PIN;
    const app = await startServer();
    const token = (await request(app).post('/api/auth/login').send({ pin: '0000' })).body.token;

    await request(app)
      .post('/api/settings/pin')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPin: '135790' })
      .expect(200);

    expect(verifyAdminPin('135790')).toBe(true);
    expect(verifyAdminPin('0000')).toBe(false);
  });
});

describe('proxy trust', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
  });

  it('does not trust X-Forwarded-For by default', async () => {
    delete process.env.TRUST_PROXY;
    const app = await startServer();
    expect(app.get('trust proxy')).toBe(false);
  });

  it('ignores a spoofed X-Forwarded-For when deciding the whitelist', async () => {
    delete process.env.TRUST_PROXY;
    clearStoredAdminPin();
    const app = await startServer();

    // The request really comes from 127.0.0.1, which is always whitelisted.
    // Claiming to be 8.8.8.8 must not change that verdict.
    const res = await request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', '8.8.8.8')
      .send({ pin: '0000' });

    expect(res.status).toBe(200);
  });

  it('honours TRUST_PROXY when an operator opts in behind a reverse proxy', async () => {
    process.env.TRUST_PROXY = 'loopback, uniquelocal';
    const app = await startServer();
    expect(app.get('trust proxy')).toBe('loopback, uniquelocal');
  });

  it('reads the forwarded client IP once a trusted proxy is configured', async () => {
    // Mirrors the deployed config: Nginx on loopback/a private network is
    // allowed to speak for the client, so its X-Forwarded-For is honoured.
    process.env.TRUST_PROXY = 'loopback, uniquelocal';
    clearStoredAdminPin();
    const app = await startServer();

    const res = await request(app)
      .get('/api/cards/active-list')
      .set('X-Forwarded-For', '203.0.113.7');

    expect(res.status).toBe(401);
  });
});

describe('card endpoints are not public', () => {
  const originalTrustProxy = process.env.TRUST_PROXY;
  let app: any;
  let token = '';

  beforeEach(async () => {
    // Mirror the deployed config, so X-Forwarded-For from loopback (supertest
    // connects that way, as Nginx would) stands in for a remote client.
    process.env.TRUST_PROXY = 'loopback, uniquelocal';
    clearStoredAdminPin();
    app = await startServer();
    token = (await request(app).post('/api/auth/login').send({ pin: '0000' })).body.token;

    db.prepare(
      "INSERT OR REPLACE INTO cards (rfid, ownerName, balance, lastUpdated) VALUES (?, ?, ?, ?)"
    ).run('1234567890', 'Test User', 4.2, new Date().toISOString());
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
  });

  const REMOTE = '203.0.113.7';

  it('refuses the RFID dump to an unauthenticated remote client', async () => {
    const res = await request(app)
      .get('/api/cards/active-list')
      .set('X-Forwarded-For', REMOTE);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('1234567890');
  });

  it('refuses a card profile to an unauthenticated remote client', async () => {
    const res = await request(app)
      .get('/api/cards/1234567890/profile')
      .set('X-Forwarded-For', REMOTE);

    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain('Test User');
  });

  it('still serves a kiosk on the local network', async () => {
    // No X-Forwarded-For: supertest connects over loopback, like a LAN kiosk
    // hitting http://<lan-ip>:3400 directly with no proxy in the path.
    const list = await request(app).get('/api/cards/active-list');
    expect(list.status).toBe(200);
    expect(list.body).toContain('1234567890');

    const profile = await request(app).get('/api/cards/1234567890/profile');
    expect(profile.status).toBe(200);
    expect(profile.body.ownerName).toBe('Test User');
  });

  it('still serves an authenticated client from anywhere', async () => {
    const res = await request(app)
      .get('/api/cards/active-list')
      .set('X-Forwarded-For', REMOTE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toContain('1234567890');
  });
});

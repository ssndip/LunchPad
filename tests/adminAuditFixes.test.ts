/**
 * adminAuditFixes.test.ts — Regressions for the defects found in the
 * 2026-09-17 sweep of the admin interface.
 *
 *   1. The whitelist matcher understood only IPv4, and the Settings panel told
 *      admins to enter hostnames. On an IPv6 LAN, or after following that
 *      advice, no entry could ever match and enabling the whitelist locked
 *      everyone out of /api/auth/login.
 *   2. A whitelist string was stored unvalidated, so a hostname or a malformed
 *      prefix was accepted and simply never matched.
 *   3. Nothing stopped an admin committing a whitelist that excluded their own
 *      address, which is only felt once the current 8h token expires.
 *   4. A refusal caused by the install's own configuration (default PIN with
 *      the whitelist off) was reported as "Invalid PIN or Admin Card".
 *   5. /api/history capped at 100 rows silently, and the dashboard computed its
 *      totals from whatever it received.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import { settings } from '../server/config';
import { isWhitelisted, validateWhitelist } from '../server/middleware/whitelist';
import { HISTORY_LIMIT } from '../server/controllers/orderController';
import { HISTORY_LIMIT as CLIENT_HISTORY_LIMIT } from '../src/api';

process.env.NODE_ENV = 'test';
process.env.ADMIN_PIN = '424242';

const adminToken = async (app: any): Promise<string> => {
  db.prepare("DELETE FROM settings WHERE key = ?").run("admin_pin");
  const res = await request(app).post('/api/auth/login').send({ pin: '424242' });
  return res.body.token;
};

describe('whitelist matching', () => {
  it('matches an IPv4 address and CIDR range', () => {
    expect(isWhitelisted('192.168.1.5', '192.168.1.5')).toBe(true);
    expect(isWhitelisted('192.168.1.5', '192.168.1.0/24')).toBe(true);
    expect(isWhitelisted('192.168.2.5', '192.168.1.0/24')).toBe(false);
  });

  it('matches an IPv6 address regardless of how it is spelled', () => {
    expect(isWhitelisted('fd00::1', 'fd00:0:0:0:0:0:0:1')).toBe(true);
    expect(isWhitelisted('fd00:0:0:0:0:0:0:1', 'fd00::1')).toBe(true);
  });

  it('matches an IPv6 CIDR range, which used to match nothing at all', () => {
    // The whole point: on a network handing out IPv6 the client's address is
    // something like fd12:3456::a1, and before this no entry could match it.
    expect(isWhitelisted('fd12:3456::a1', 'fd00::/8')).toBe(true);
    expect(isWhitelisted('fe80::1234', 'fe80::/10')).toBe(true);
    expect(isWhitelisted('2001:db8::1', 'fd00::/8')).toBe(false);
  });

  it('strips an IPv4-mapped prefix and a zone index', () => {
    expect(isWhitelisted('::ffff:192.168.1.5', '192.168.1.0/24')).toBe(true);
    expect(isWhitelisted('fe80::1%eth0', 'fe80::/10')).toBe(true);
  });

  it('still allows loopback whatever the list says', () => {
    expect(isWhitelisted('127.0.0.1', '10.0.0.0/8')).toBe(true);
    expect(isWhitelisted('::1', '10.0.0.0/8')).toBe(true);
  });
});

describe('whitelist validation', () => {
  it('accepts addresses and CIDR ranges in both families', () => {
    expect(validateWhitelist('127.0.0.1, 192.168.0.0/16, fd00::/8, ::1')).toBeUndefined();
  });

  it('rejects a hostname, which can never match a peer address', () => {
    expect(validateWhitelist('office.local')).toMatch(/Hostnames cannot be matched/);
    expect(validateWhitelist('127.0.0.1, localhost')).toMatch(/Hostnames cannot be matched/);
  });

  it('rejects an out-of-range prefix length', () => {
    expect(validateWhitelist('192.168.1.0/33')).toMatch(/invalid prefix length/);
    expect(validateWhitelist('fd00::/129')).toMatch(/invalid prefix length/);
  });

  it('rejects an empty list', () => {
    expect(validateWhitelist('  ,  ')).toMatch(/at least one/);
  });
});

describe('settings guard against locking the admin out', () => {
  let app: any;
  let token: string;
  const original = { enabled: settings.adminWhitelistEnabled, list: settings.adminWhitelist };
  const originalTrustProxy = process.env.TRUST_PROXY;

  // supertest always connects over loopback, and loopback is allowed whatever
  // the list says — so it can never trip this guard on its own. Trusting the
  // proxy header lets these cases present as the LAN address an admin would
  // actually be coming from.
  beforeEach(async () => {
    process.env.TRUST_PROXY = 'true';
    app = await startServer();
    token = await adminToken(app);
  });

  afterEach(() => {
    if (originalTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = originalTrustProxy;
    settings.adminWhitelistEnabled = original.enabled;
    settings.adminWhitelist = original.list;
  });

  const asLanAdmin = () =>
    request(app)
      .post('/api/settings')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Forwarded-For', '192.168.1.50');

  it('refuses a whitelist that would exclude the caller', async () => {
    const res = await asLanAdmin()
      .send({ adminWhitelistEnabled: true, adminWhitelist: '203.0.113.7' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/lock you out/);
    // Nothing was committed, so the admin can still log in.
    expect(settings.adminWhitelist).not.toBe('203.0.113.7');
  });

  it('refuses a whitelist of hostnames before storing it', async () => {
    const res = await asLanAdmin().send({ adminWhitelist: 'office.local' });

    expect(res.status).toBe(400);
    expect(settings.adminWhitelist).not.toBe('office.local');
  });

  it('allows a list that still covers the caller', async () => {
    const res = await asLanAdmin()
      .send({ adminWhitelistEnabled: true, adminWhitelist: '127.0.0.1, ::1, 192.168.0.0/16' });

    expect(res.status).toBe(200);
  });

  it('leaves the guard out of the way when the whitelist stays off', async () => {
    const res = await asLanAdmin().send({ announcement: 'Lunch is at noon' });
    expect(res.status).toBe(200);
  });
});

describe('a configuration refusal explains itself', () => {
  let app: any;
  const originalPin = process.env.ADMIN_PIN;
  const originalWhitelist = settings.adminWhitelistEnabled;

  beforeEach(async () => {
    app = await startServer();
  });

  afterEach(() => {
    process.env.ADMIN_PIN = originalPin;
    settings.adminWhitelistEnabled = originalWhitelist;
  });

  it('says the install is unconfigured rather than "Invalid PIN"', async () => {
    // A fresh install: no PIN of anyone's choosing, and no whitelist.
    db.prepare("DELETE FROM settings WHERE key = ?").run("admin_pin");
    delete process.env.ADMIN_PIN;
    settings.adminWhitelistEnabled = false;

    const res = await request(app).post('/api/auth/login').send({ pin: '0000' });

    // Still a 401: the status drives rate limiting and the client's retry path.
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/ADMIN_PIN/);
    expect(res.body.error).not.toBe('Invalid PIN or Admin Card');
  });
});

describe('history result cap', () => {
  let app: any;
  let token: string;

  beforeEach(async () => {
    app = await startServer();
    token = await adminToken(app);
  });

  it('is the same number the dashboard checks against', () => {
    // The client flags a capped result by comparing the row count to its own
    // copy of this limit, so the two must not drift apart.
    expect(CLIENT_HISTORY_LIMIT).toBe(HISTORY_LIMIT);
  });

  it('caps a query at the limit rather than at the old hardcoded 100', async () => {
    const insert = db.prepare(
      "INSERT INTO orders (id, rfid, ownerName, items, totalPrice, timestamp, date) VALUES (?,?,?,?,?,?,?)"
    );
    const made: string[] = [];
    db.transaction(() => {
      for (let i = 0; i < 120; i++) {
        const id = `hist-cap-${i}`;
        made.push(id);
        insert.run(id, 'hist-cap-rfid', 'Cap Tester', '[]', 1, new Date().toISOString(), '2026-09-17');
      }
    })();

    try {
      const res = await request(app)
        .get('/api/history?rfid=hist-cap-rfid')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(120);
      expect(res.body.length).toBeLessThanOrEqual(HISTORY_LIMIT);
    } finally {
      db.prepare(`DELETE FROM orders WHERE id IN (${made.map(() => '?').join(',')})`).run(...made);
    }
  });
});

describe('server-side automatic backups', () => {
  let app: any;
  let token: string;

  beforeEach(async () => {
    app = await startServer();
    token = await adminToken(app);
  });

  it('lists the snapshots the dashboard now shows', async () => {
    const res = await request(app)
      .get('/api/system/backups')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // The panel renders these three fields for every row.
    for (const entry of res.body) {
      expect(entry).toHaveProperty('filename');
      expect(entry).toHaveProperty('sizeBytes');
      expect(entry).toHaveProperty('createdAt');
    }
  });

  it('refuses a filename that escapes the backups directory', async () => {
    for (const name of ['../lunchpad.db', 'nope.txt', 'missing.db']) {
      const res = await request(app)
        .post(`/api/system/backups/restore/${encodeURIComponent(name)}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    }
  });

  it('keeps the list behind admin auth', async () => {
    expect((await request(app).get('/api/system/backups')).status).toBe(401);
  });

  it('checkpoints and removes the WAL on close, so restoring by file copy is safe', () => {
    // restoreSystemBackup closes the database and copies a snapshot over
    // lunchpad.db. That is only sound if closing leaves no stale -wal beside
    // the file it replaces, which would otherwise be replayed onto the
    // restored database and corrupt it.
    const Database = require('better-sqlite3');
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lunchpad-wal-'));
    const dbPath = path.join(dir, 'probe.db');
    const probe = new Database(dbPath);
    try {
      probe.pragma('journal_mode = WAL');
      probe.exec('CREATE TABLE t (a TEXT)');
      probe.prepare('INSERT INTO t VALUES (?)').run('x');
      expect(fs.existsSync(`${dbPath}-wal`)).toBe(true);

      probe.close();

      expect(fs.existsSync(`${dbPath}-wal`)).toBe(false);
      expect(fs.existsSync(`${dbPath}-shm`)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

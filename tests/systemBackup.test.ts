/**
 * systemBackup.test.ts — Regressions for the system restore endpoint.
 *
 *  10a. `importSystemBundle` ran `DELETE FROM <table>` for every table before
 *       checking whether the bundle had anything to put back. A bundle that
 *       omitted a table therefore emptied it and committed — and for `settings`
 *       that means losing `jwt_secret` (every card PIN hash becomes
 *       unverifiable) and `admin_pin` (the dashboard falls back to the default).
 *
 *  10b. Nothing reloaded the in-memory config afterwards, so the running
 *       process kept serving the pre-restore `settings` — menuVersion, fees,
 *       jwtSecret — until someone restarted it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import { verifyAdminPin } from '../server/config';
import bcrypt from 'bcryptjs';

process.env.NODE_ENV = 'test';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

let app: any;
let token = '';

// Logged in once for the whole file: the auth limiter allows ten attempts a
// minute, which a per-test login would exhaust.
const login = async (pin: string) =>
  (await request(app).post('/api/auth/login').send({ pin })).body.token;

const exportBundle = async () =>
  (await request(app).get('/api/system/backup').set('Authorization', `Bearer ${token}`)).body;

const restore = (bundle: any) =>
  request(app).post('/api/system/restore').set('Authorization', `Bearer ${token}`).send(bundle);

const settingValue = (key: string): string | undefined =>
  (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value;

beforeAll(async () => {
  app = await startServer();
  db.prepare("DELETE FROM settings WHERE key = ?").run('admin_pin');
  token = await login('424242');
  expect(token).toBeTruthy();
});

describe('export', () => {
  it('produces a bundle carrying every table', async () => {
    const bundle = await exportBundle();

    expect(bundle.type).toBe('LUNCHPAD_FULL_SYSTEM_SNAPSHOT');
    for (const table of ['cards', 'menu', 'orders', 'settings', 'daily_summaries']) {
      expect(Array.isArray(bundle.data[table])).toBe(true);
    }
  });
});

describe('restoring a bundle that omits a table', () => {
  it('leaves settings alone rather than emptying them', async () => {
    // `admin_pin` stands in for the whole settings table here. It is written
    // straight to the DB so the shared login PIN keeps working, and it travels
    // the same path as `jwt_secret` — which in these tests comes from the
    // environment (vitest.setup.ts) rather than a row.
    const hashed = bcrypt.hashSync('246813', bcrypt.genSaltSync(10));
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
      .run('admin_pin', hashed);
    expect(verifyAdminPin('246813')).toBe(true);

    const settingsCountBefore = (db.prepare('SELECT COUNT(*) AS c FROM settings').get() as any).c;

    const bundle = await exportBundle();
    delete bundle.data.settings; // a hand-edited or older-format bundle

    await restore(bundle).expect(200);

    // Losing this row is what drops a real install back to the default PIN.
    expect(settingValue('admin_pin')).toBe(hashed);
    expect(verifyAdminPin('246813')).toBe(true);
    expect((db.prepare('SELECT COUNT(*) AS c FROM settings').get() as any).c).toBe(settingsCountBefore);

    db.prepare("DELETE FROM settings WHERE key = ?").run('admin_pin');
  });

  it('leaves an omitted data table alone', async () => {
    await request(app)
      .post('/api/cards')
      .set('Authorization', `Bearer ${token}`)
      .send({ rfid: 'keep-me', ownerName: 'Keep Me' })
      .expect(200);

    const bundle = await exportBundle();
    delete bundle.data.cards;

    await restore(bundle).expect(200);

    const cards = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body;
    expect(cards.some((c: any) => c.rfid === 'keep-me')).toBe(true);
  });
});

describe('restoring a bundle that includes a table', () => {
  it('replaces its contents', async () => {
    const bundle = await exportBundle();
    bundle.data.cards = [
      { rfid: 'from-backup', ownerName: 'Restored User', balance: 7.5, lastUpdated: null, isAdmin: 0, pin: null },
    ];

    await restore(bundle).expect(200);

    const cards = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body;
    expect(cards.map((c: any) => c.rfid)).toEqual(['from-backup']);
  });

  it('honours an explicitly empty table', async () => {
    const bundle = await exportBundle();
    bundle.data.orders = [];

    await restore(bundle).expect(200);

    const orders = (await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`)).body;
    expect(orders).toEqual([]);
  });

  it('copes with rows that do not all carry the same columns', async () => {
    const bundle = await exportBundle();
    // The first row lacks `balance`, which used to decide the column list for
    // the entire table and silently drop the second row's value.
    bundle.data.cards = [
      { rfid: 'sparse-a', ownerName: 'A' },
      { rfid: 'sparse-b', ownerName: 'B', balance: 3.25, isAdmin: 0 },
    ];

    await restore(bundle).expect(200);

    const cards = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body;
    expect(cards.map((c: any) => c.rfid).sort()).toEqual(['sparse-a', 'sparse-b']);
    expect(cards.find((c: any) => c.rfid === 'sparse-b').balance).toBe(3.25);
  });
});

describe('in-memory config after a restore', () => {
  it('serves the restored menu version without needing a restart', async () => {
    const bundle = await exportBundle();
    bundle.data.settings = bundle.data.settings
      .filter((r: any) => r.key !== 'menu_version')
      .concat({ key: 'menu_version', value: '77' });

    await restore(bundle).expect(200);

    const init = (await request(app).get('/api/init')).body;
    expect(init.menuVersion).toBe(77);
  });

  it('serves restored fees without needing a restart', async () => {
    const bundle = await exportBundle();
    bundle.data.settings = bundle.data.settings
      .filter((r: any) => r.key !== 'delivery_fee')
      .concat({ key: 'delivery_fee', value: '12.34' });

    await restore(bundle).expect(200);

    const init = (await request(app).get('/api/init')).body;
    expect(init.deliveryFee).toBeCloseTo(12.34, 2);
  });
});

describe('malformed bundles', () => {
  it('rejects one with the wrong type marker', async () => {
    await restore({ type: 'SOMETHING_ELSE', data: {} }).expect(400);
  });

  it('rejects one with no data object, without touching the database', async () => {
    const before = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body.length;

    const res = await restore({ type: 'LUNCHPAD_FULL_SYSTEM_SNAPSHOT' });
    expect(res.status).toBe(400);

    const after = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body.length;
    expect(after).toBe(before);
  });

  it('rejects a table whose value is not an array, without touching the database', async () => {
    const before = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body.length;

    const res = await restore({
      type: 'LUNCHPAD_FULL_SYSTEM_SNAPSHOT',
      data: { cards: 'not-an-array' },
    });
    expect(res.status).toBe(400);

    const after = (await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`)).body.length;
    expect(after).toBe(before);
  });
});

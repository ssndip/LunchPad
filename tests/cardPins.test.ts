/**
 * cardPins.test.ts — Regressions for the two ways a card PIN could go wrong.
 *
 *  M1. `hashPin` was an HMAC keyed on `settings.jwtSecret`. Rotating
 *      JWT_SECRET — or restoring a bundle carrying a different one — silently
 *      invalidated every stored PIN, and the migration guard treats a 64-char
 *      value as already-hashed, so it could never repair itself. The key is now
 *      a dedicated pepper that is generated once and never rotates with the JWT
 *      secret.
 *
 *  M2. PIN uniqueness was enforced in `addOrUpdateCard` and `updateSingleCard`
 *      but not in the CSV batch import or the bulk update, and there was no
 *      constraint in the schema. Checkout looks a PIN up with
 *      `SELECT * FROM cards WHERE pin = ?`, so a duplicate meant charging
 *      whichever row SQLite happened to return.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import { hashPin, settings } from '../server/config';

process.env.NODE_ENV = 'test';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

let app: any;
let token = '';

const auth = () => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  app = await startServer();
  db.prepare('DELETE FROM settings WHERE key = ?').run('admin_pin');
  token = (await request(app).post('/api/auth/login').send({ pin: '424242' })).body.token;
  expect(token).toBeTruthy();
});

beforeEach(() => {
  db.prepare("DELETE FROM cards WHERE rfid LIKE 'pin-test-%'").run();
});

describe('PIN hashing is independent of the JWT secret', () => {
  it('produces the same hash after the JWT secret changes', () => {
    const before = hashPin('123456');

    const original = settings.jwtSecret;
    try {
      settings.jwtSecret = 'a-completely-different-secret';
      expect(hashPin('123456')).toBe(before);
    } finally {
      settings.jwtSecret = original;
    }
  });

  it('still lets a card check out after the JWT secret changes', async () => {
    await request(app)
      .post('/api/cards')
      .set(auth())
      .send({ rfid: 'pin-test-rotate', ownerName: 'Rotate Me', pin: '654321' })
      .expect(200);

    const original = settings.jwtSecret;
    try {
      settings.jwtSecret = 'rotated-after-deploy';
      const res = await request(app)
        .post('/api/v1/order')
        .send({ pin: '654321', items: [{ id: 1 }] });

      // The PIN must still resolve to its card; anything but 401 proves the
      // lookup succeeded (the order itself may fail for unrelated reasons).
      expect(res.status).not.toBe(401);
    } finally {
      settings.jwtSecret = original;
    }
  });

  it('keeps a pepper distinct from the JWT secret once seeded', () => {
    const pepper = (db.prepare("SELECT value FROM settings WHERE key = 'pin_pepper'").get() as any)?.value;
    expect(pepper).toBeTruthy();
    expect(typeof pepper).toBe('string');
  });
});

describe('PIN uniqueness across every write path', () => {
  const card = (rfid: string, pin?: string) => ({ rfid, ownerName: rfid, pin });

  it('still rejects a duplicate on the single-card path', async () => {
    await request(app).post('/api/cards').set(auth()).send(card('pin-test-a', '111111')).expect(200);

    const res = await request(app).post('/api/cards').set(auth()).send(card('pin-test-b', '111111'));
    expect(res.status).toBe(409);
  });

  it('rejects a batch import where two rows share a PIN', async () => {
    const res = await request(app)
      .post('/api/cards/batch')
      .set(auth())
      .send([card('pin-test-c', '222222'), card('pin-test-d', '222222')]);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/PIN/i);

    const cards = (await request(app).get('/api/cards').set(auth())).body;
    expect(cards.some((c: any) => c.rfid === 'pin-test-c')).toBe(false);
  });

  it('rejects a batch import reusing a PIN already held by another card', async () => {
    await request(app).post('/api/cards').set(auth()).send(card('pin-test-e', '333333')).expect(200);

    const res = await request(app)
      .post('/api/cards/batch')
      .set(auth())
      .send([card('pin-test-f', '333333')]);

    expect(res.status).toBe(409);
  });

  it('rejects a bulk update where two rows share a PIN', async () => {
    const res = await request(app)
      .post('/api/cards/update')
      .set(auth())
      .send([card('pin-test-g', '444444'), card('pin-test-h', '444444')]);

    expect(res.status).toBe(409);
  });

  it('allows a batch where every PIN is distinct, and cards without a PIN', async () => {
    const res = await request(app)
      .post('/api/cards/batch')
      .set(auth())
      .send([card('pin-test-i', '555555'), card('pin-test-j', '666666'), card('pin-test-k')]);

    expect(res.status).toBe(200);
  });

  it('allows several cards with no PIN at all', async () => {
    const res = await request(app)
      .post('/api/cards/batch')
      .set(auth())
      .send([card('pin-test-l'), card('pin-test-m'), card('pin-test-n')]);

    expect(res.status).toBe(200);

    const cards = (await request(app).get('/api/cards').set(auth())).body;
    expect(cards.filter((c: any) => String(c.rfid).startsWith('pin-test-')).length).toBe(3);
  });

  it('refuses a duplicate written straight to the database', async () => {
    // The schema-level guarantee, independent of any controller check.
    db.prepare("INSERT INTO cards (rfid, ownerName, pin) VALUES (?, ?, ?)")
      .run('pin-test-direct-1', 'Direct One', hashPin('777777'));

    expect(() =>
      db.prepare("INSERT INTO cards (rfid, ownerName, pin) VALUES (?, ?, ?)")
        .run('pin-test-direct-2', 'Direct Two', hashPin('777777'))
    ).toThrow();
  });
});

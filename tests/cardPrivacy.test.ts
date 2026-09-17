/**
 * cardPrivacy.test.ts — PIN hashes must not leave the server, and editing a
 * card must not silently destroy its PIN.
 *
 * `getCards` was `SELECT *`, so every card's PIN digest went to the dashboard,
 * into the WebSocket bootstrap, and into the CSV export. The digest is an
 * unsalted HMAC over a six-digit number, so anyone holding it and the pepper
 * can recover the PIN by brute force.
 *
 * The two halves are coupled: `updateSingleCard` did `hashedPin = pin || null`
 * and always wrote the column, so it only preserved PINs *because* the client
 * echoed the hash back. Removing the hash from the payload without changing
 * that handler would wipe a PIN on every unrelated edit.
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

let app: any;
let token = '';
const auth = () => ({ Authorization: `Bearer ${token}` });

const storedPin = (rfid: string): string | null =>
  (db.prepare('SELECT pin FROM cards WHERE rfid = ?').get(rfid) as any)?.pin ?? null;

const getCards = async () => (await request(app).get('/api/cards').set(auth())).body;

beforeAll(async () => {
  app = await startServer();
  db.prepare('DELETE FROM settings WHERE key = ?').run('admin_pin');
  token = (await request(app).post('/api/auth/login').send({ pin: '424242' })).body.token;
  expect(token).toBeTruthy();
});

beforeEach(async () => {
  db.prepare("DELETE FROM cards WHERE rfid LIKE 'priv-%'").run();
  await request(app).post('/api/cards').set(auth())
    .send({ rfid: 'priv-withpin', ownerName: 'Has Pin', balance: 5, pin: '135791' }).expect(200);
  await request(app).post('/api/cards').set(auth())
    .send({ rfid: 'priv-nopin', ownerName: 'No Pin', balance: 2 }).expect(200);
});

describe('the card list never carries PIN material', () => {
  it('omits the hash entirely', async () => {
    const cards = await getCards();
    const card = cards.find((c: any) => c.rfid === 'priv-withpin');

    expect(card).toBeTruthy();
    expect(card.pin).toBeUndefined();
    expect(JSON.stringify(cards)).not.toContain(storedPin('priv-withpin'));
  });

  it('says whether a PIN is set, which is all the dashboard needs', async () => {
    const cards = await getCards();

    expect(cards.find((c: any) => c.rfid === 'priv-withpin').hasPin).toBe(true);
    expect(cards.find((c: any) => c.rfid === 'priv-nopin').hasPin).toBe(false);
  });

  it('keeps the fields the dashboard actually uses', async () => {
    const card = (await getCards()).find((c: any) => c.rfid === 'priv-withpin');

    expect(card.ownerName).toBe('Has Pin');
    expect(card.balance).toBe(5);
    expect(card.isAdmin).toBe(false);
  });
});

describe('editing a card leaves an untouched PIN alone', () => {
  it('preserves the PIN when the payload omits it', async () => {
    const before = storedPin('priv-withpin');
    expect(before).toBeTruthy();

    // Exactly what the dashboard sends after renaming a card, now that it has
    // no hash to echo back.
    await request(app)
      .post('/api/cards/priv-withpin/update')
      .set(auth())
      .send({ ownerName: 'Renamed', balance: 9 })
      .expect(200);

    expect(storedPin('priv-withpin')).toBe(before);
    const card = (await getCards()).find((c: any) => c.rfid === 'priv-withpin');
    expect(card.ownerName).toBe('Renamed');
    expect(card.hasPin).toBe(true);
  });

  it('sets a new PIN when one is supplied', async () => {
    const before = storedPin('priv-withpin');

    await request(app)
      .post('/api/cards/priv-withpin/update')
      .set(auth())
      .send({ ownerName: 'Has Pin', balance: 5, pin: '246802' })
      .expect(200);

    const after = storedPin('priv-withpin');
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
  });

  it('clears the PIN when the field is explicitly emptied', async () => {
    await request(app)
      .post('/api/cards/priv-withpin/update')
      .set(auth())
      .send({ ownerName: 'Has Pin', balance: 5, pin: '' })
      .expect(200);

    expect(storedPin('priv-withpin')).toBeNull();
    expect((await getCards()).find((c: any) => c.rfid === 'priv-withpin').hasPin).toBe(false);
  });

  it('clears the PIN when explicitly sent as null', async () => {
    await request(app)
      .post('/api/cards/priv-withpin/update')
      .set(auth())
      .send({ ownerName: 'Has Pin', balance: 5, pin: null })
      .expect(200);

    expect(storedPin('priv-withpin')).toBeNull();
  });

  it('still rejects a malformed PIN', async () => {
    const before = storedPin('priv-withpin');

    const res = await request(app)
      .post('/api/cards/priv-withpin/update')
      .set(auth())
      .send({ ownerName: 'Has Pin', balance: 5, pin: '12' });

    expect(res.status).toBe(400);
    expect(storedPin('priv-withpin')).toBe(before);
  });

  it('still rejects a PIN already used by another card', async () => {
    const res = await request(app)
      .post('/api/cards/priv-nopin/update')
      .set(auth())
      .send({ ownerName: 'No Pin', balance: 2, pin: '135791' });

    expect(res.status).toBe(409);
  });

  it('reports a card that does not exist instead of silently doing nothing', async () => {
    const res = await request(app)
      .post('/api/cards/priv-ghost/update')
      .set(auth())
      .send({ ownerName: 'Ghost', balance: 0 });

    expect(res.status).toBe(404);
  });
});

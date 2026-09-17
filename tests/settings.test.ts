/**
 * settings.test.ts — Regression for a settings save applying half of itself.
 *
 * `updateSettings` wrote each field to the database and broadcast it inline,
 * then hit the next field's type check and returned 400. Everything validated
 * before the bad field was already live, while the dashboard reported the save
 * as failed — so the UI and the server disagreed about what had been saved.
 *
 * Validation must now happen for the whole payload before anything is written.
 */
import { describe, it, expect, beforeAll } from 'vitest';
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

const getSettings = async () =>
  (await request(app).get('/api/settings').set('Authorization', `Bearer ${token}`)).body;

const save = (payload: any) =>
  request(app).post('/api/settings').set('Authorization', `Bearer ${token}`).send(payload);

const storedValue = (key: string): string | undefined =>
  (db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any)?.value;

// Logged in once: the auth limiter allows ten attempts a minute.
beforeAll(async () => {
  app = await startServer();
  db.prepare('DELETE FROM settings WHERE key = ?').run('admin_pin');
  token = (await request(app).post('/api/auth/login').send({ pin: '424242' })).body.token;
  expect(token).toBeTruthy();
});

describe('rejecting an invalid payload', () => {
  it('does not apply the valid fields alongside an invalid one', async () => {
    await save({ announcement: 'BEFORE' }).expect(200);

    // `announcement` is fine and is handled first; `kioskCloseDay` is the wrong
    // type. The whole request must be refused.
    const res = await save({ announcement: 'SHOULD NOT STICK', kioskCloseDay: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('kioskCloseDay');

    const after = await getSettings();
    expect(after.announcement).toBe('BEFORE');
    expect(storedValue('announcement')).toBe('BEFORE');
  });

  it('leaves an invalid field out of the database entirely', async () => {
    await save({ deliveryFee: 3.5 }).expect(200);

    const res = await save({ deliveryFee: 9.99, packagingFee: 'free' });
    expect(res.status).toBe(400);

    const after = await getSettings();
    expect(after.deliveryFee).toBe(3.5);
    expect(storedValue('delivery_fee')).toBe('3.5');
  });

  it('reports the first offending field by name', async () => {
    const res = await save({ orderButtonEnabled: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid value for orderButtonEnabled');
  });

  it('still enforces the public access code format', async () => {
    const res = await save({ publicAccessCode: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('digits');
  });
});

describe('accepting a valid payload', () => {
  it('applies every field in one go', async () => {
    const res = await save({
      announcement: 'All good',
      deliveryFee: 4.25,
      packagingFee: 0.15,
      kioskCloseDay: 6,
      bgnEnabled: false,
      systemLanguage: 'en',
      customCategories: [{ id: 'x', names: { en: 'X', bg: 'Х' }, keywords: [], color: 'blue' }],
    });

    expect(res.status).toBe(200);

    const after = await getSettings();
    expect(after.announcement).toBe('All good');
    expect(after.deliveryFee).toBe(4.25);
    expect(after.packagingFee).toBe(0.15);
    expect(after.kioskCloseDay).toBe(6);
    expect(after.bgnEnabled).toBe(false);
    expect(after.systemLanguage).toBe('en');
    expect(after.customCategories).toHaveLength(1);
  });

  it('persists booleans and numbers in the database', async () => {
    await save({ testModeEnabled: true, kioskCloseDay: 3 }).expect(200);

    expect(storedValue('test_mode_enabled')).toBe('1');
    expect(storedValue('kiosk_close_day')).toBe('3');

    await save({ testModeEnabled: false }).expect(200);
    expect(storedValue('test_mode_enabled')).toBe('0');
  });

  it('ignores fields that were not sent', async () => {
    await save({ announcement: 'Keep me' }).expect(200);
    const before = await getSettings();

    await save({ deliveryFee: 1.11 }).expect(200);

    const after = await getSettings();
    expect(after.announcement).toBe('Keep me');
    expect(after.bgnEnabled).toBe(before.bgnEnabled);
  });
});

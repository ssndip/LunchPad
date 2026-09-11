/**
 * menuValidation.test.ts — Regression for a menu item saved without a price.
 *
 * `updateMenu` validated with `Number(i.price)`, and `Number(null)` is 0 — so a
 * null, undefined or empty price passed the `isNaN`/`< 0` checks and was stored
 * as NULL. `getMenu` then handed the kiosk `price: null`, and rendering it ran
 * `item.price.toFixed(2)`, which throws and takes the whole kiosk down to the
 * error boundary.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';

process.env.NODE_ENV = 'test';

let app: any;
let token = '';

const putMenu = (items: any[]) =>
  request(app).post('/api/menu').set('Authorization', `Bearer ${token}`).send({ items });

const named = (name: string, over: any = {}) => ({
  id: 1, name, price: 1.5, available: true, category: 'Супи', ...over,
});

beforeAll(async () => {
  app = await startServer();
  db.prepare('DELETE FROM settings WHERE key = ?').run('admin_pin');
  token = (await request(app).post('/api/auth/login').send({ pin: '0000' })).body.token;
  expect(token).toBeTruthy();
});

describe('menu price validation', () => {
  it('refuses an item whose price is null', async () => {
    const res = await putMenu([named('Null Price', { price: null })]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Null Price');
  });

  it('refuses an item with no price field at all', async () => {
    const item: any = named('Missing Price');
    delete item.price;

    const res = await putMenu([item]);
    expect(res.status).toBe(400);
  });

  it('refuses an empty-string price, as an emptied form field would send', async () => {
    const res = await putMenu([named('Blank Price', { price: '' })]);
    expect(res.status).toBe(400);
  });

  it('still refuses a negative or non-numeric price', async () => {
    expect((await putMenu([named('Negative', { price: -1 })])).status).toBe(400);
    expect((await putMenu([named('Wordy', { price: 'free' })])).status).toBe(400);
  });

  it('accepts a zero price', async () => {
    const res = await putMenu([named('Free Bread', { price: 0 })]);
    expect(res.status).toBe(200);
  });

  it('accepts a numeric string, which the editor sends', async () => {
    const res = await putMenu([named('Stringy', { price: '2.40' })]);
    expect(res.status).toBe(200);

    const menu = (await request(app).get('/api/menu')).body;
    expect(menu[0].price).toBe(2.4);
  });

  it('never lets a null price reach the kiosk', async () => {
    await putMenu([named('Priced', { price: 3.2 })]).expect(200);

    const menu = (await request(app).get('/api/menu')).body;
    for (const item of menu) {
      expect(typeof item.price).toBe('number');
      expect(Number.isFinite(item.price)).toBe(true);
    }
  });
});

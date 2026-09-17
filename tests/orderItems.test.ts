/**
 * orderItems.test.ts — Regressions for the two ways an order could be accepted
 * for something the kiosk would not have let anyone pick:
 *
 *   4. `validateAndEnrichItems` never looked at `available` — the manager's
 *      per-item Active/Inactive toggle (MenuTab), which KioskItemList honours by
 *      filtering the tile away. The server accepted the id regardless, so a cart
 *      already holding an item as it was deactivated still went through. This is
 *      not stock: nothing in this system tracks quantity.
 *   5. An id with no matching menu row was skipped with `continue`, so an order
 *      for three items where two had been removed came back `success: true`
 *      having charged for one — with nothing in the response to say so.
 *
 * In both cases the whole order must now be refused, naming what went wrong,
 * and no money may move.
 */
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';

process.env.NODE_ENV = 'test';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

const RFID = '1234567890';
const SOUP = { id: 1, name: 'Пилешка супа', price: 1.8, available: true, category: 'Супи' };
const SALAD = { id: 2, name: 'Зелева салата', price: 2.5, available: true, category: 'Салати' };
const INACTIVE = { id: 3, name: 'Таратор', price: 1.5, available: false, category: 'Супи' };
const GONE_ID = 999;

let app: any;
let token = '';

const setMenu = (items: any[]) =>
  request(app).post('/api/menu').set('Authorization', `Bearer ${token}`).send({ items }).expect(200);

const balanceOf = async (rfid: string): Promise<number> => {
  const res = await request(app).get('/api/cards').set('Authorization', `Bearer ${token}`);
  return res.body.find((c: any) => c.rfid === rfid)?.balance ?? 0;
};

const orderCount = async (): Promise<number> => {
  const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
  return res.body.length;
};

const order = (items: { id: number; side?: string }[]) =>
  request(app).post('/api/v1/order').send({ rfid: RFID, items });

beforeAll(async () => {
  app = await startServer();
  token = (await request(app).post('/api/auth/login').send({ pin: '424242' })).body.token;
});

beforeEach(async () => {
  await setMenu([SOUP, SALAD, INACTIVE]);
});

describe('items deactivated in the manager', () => {
  it('refuses an order for an item toggled Inactive', async () => {
    const before = await balanceOf(RFID);

    const res = await order([{ id: INACTIVE.id }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(INACTIVE.name);
    expect(await balanceOf(RFID)).toBe(before);
  });

  it('refuses the whole order when one line is inactive', async () => {
    const before = await balanceOf(RFID);
    const ordersBefore = await orderCount();

    const res = await order([{ id: SOUP.id }, { id: INACTIVE.id }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(INACTIVE.name);
    // Nothing charged and nothing recorded — not even the line that was fine.
    expect(await balanceOf(RFID)).toBe(before);
    expect(await orderCount()).toBe(ordersBefore);
  });

  it('names an inactive item once even when several were requested', async () => {
    // The kiosk expands quantity into repeated entries.
    const res = await order([{ id: INACTIVE.id }, { id: INACTIVE.id }, { id: INACTIVE.id }]);

    expect(res.status).toBe(400);
    expect(res.body.error.match(new RegExp(INACTIVE.name, 'g'))).toHaveLength(1);
  });
});

describe('items missing from the menu', () => {
  it('refuses an order for an id that no longer exists', async () => {
    const before = await balanceOf(RFID);

    const res = await order([{ id: GONE_ID }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain(String(GONE_ID));
    expect(await balanceOf(RFID)).toBe(before);
  });

  it('does not quietly charge for the surviving part of a cart', async () => {
    const before = await balanceOf(RFID);
    const ordersBefore = await orderCount();

    // The exact shape from the audit: one real item, two that were removed.
    const res = await order([{ id: SOUP.id }, { id: GONE_ID }, { id: 998 }]);

    expect(res.status).toBe(400);
    expect(res.body.success).toBeUndefined();
    expect(await balanceOf(RFID)).toBe(before);
    expect(await orderCount()).toBe(ordersBefore);
  });
});

describe('orders that are still fine', () => {
  it('accepts an order where every item is on the menu and available', async () => {
    const before = await balanceOf(RFID);

    const res = await order([{ id: SOUP.id }, { id: SALAD.id }]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.order.items).toHaveLength(2);
    // The salad carries the packaging fee and the soup does not. This total was
    // previously fee-free: the server's category list named `гарнитури`/`side
    // dishes` and `скара`/`bbq` but had lost `салати`/`salads`, so a salad the
    // kiosk quoted at 2.60 was billed at 2.50. Both sides read one list now —
    // see tests/packagingFeeParity.test.ts.
    const PACKAGING_FEE = 0.10;
    expect(await balanceOf(RFID)).toBeCloseTo(before + SOUP.price + SALAD.price + PACKAGING_FEE, 2);
  });

  it('accepts an item switched back to Active', async () => {
    await setMenu([SOUP, SALAD, { ...INACTIVE, available: true }]);

    const res = await order([{ id: INACTIVE.id }]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

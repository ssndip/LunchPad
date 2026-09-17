import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { appPromise } from '../server';
import { localDateString } from '../server/utils/localTime';

// An admin PIN of this suite's own. Logging in with DEFAULT_ADMIN_PIN is
// refused while the admin whitelist is off (see verifyAdminPin), which is
// the state a fresh test database starts in.
process.env.ADMIN_PIN = '424242';

let app: any;
let token: string;

beforeAll(async () => {
  app = await appPromise;
  const res = await request(app).post('/api/auth/login').send({ pin: '424242' });
  token = res.body.token;
});

/**
 * The breakdown rows sit directly under the day's totalSales in the Orders tab,
 * so they have to add up to it. They were summed straight from the stored
 * `$.price`, which is the base price — the packaging fee the customer was
 * actually charged was left out, and a day of side dishes came up short by ten
 * cents an item.
 */
describe('GET /api/summaries/:date', () => {
  it('itemised rows add up to the day total when a packaging fee applies', async () => {
    await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ id: 1, name: 'Гарнитура', price: 2.0, available: true, category: 'Гарнитури' }] });

    const order = await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: [{ id: 1 }] });
    expect(order.status).toBe(200);

    const date = localDateString(new Date());
    const summaries = await request(app).get('/api/summaries').set('Authorization', `Bearer ${token}`);
    const day = summaries.body.find((s: any) => s.date === date);

    const details = await request(app).get(`/api/summaries/${date}`).set('Authorization', `Bearer ${token}`);
    const rows = details.body.items;

    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Гарнитура');
    expect(rows[0].price).toBeCloseTo(2.1, 2); // 2.00 + the 0.10 packaging fee
    expect(rows[0].total).toBeCloseTo(day.totalSales, 2);
  });

  it('groups by side choice and counts repeats', async () => {
    await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          { id: 1, name: 'Основно', price: 3.0, available: true, category: 'Основни ястия',
            requiresSideChoice: true, sideChoices: ['Ориз', 'Картофи'] },
        ],
      });

    await request(app).post('/api/reset').set('Authorization', `Bearer ${token}`);
    await request(app)
      .post('/api/v1/order')
      .send({ rfid: '1234567890', items: [{ id: 1, side: 'Ориз' }, { id: 1, side: 'Ориз' }, { id: 1, side: 'Картофи' }] });

    const date = localDateString(new Date());
    const details = await request(app).get(`/api/summaries/${date}`).set('Authorization', `Bearer ${token}`);
    const byName = Object.fromEntries(details.body.items.map((i: any) => [i.name, i]));

    expect(byName['Основно (Ориз)'].quantity).toBe(2);
    expect(byName['Основно (Ориз)'].total).toBeCloseTo(6.0, 2);
    expect(byName['Основно (Картофи)'].quantity).toBe(1);
  });
});

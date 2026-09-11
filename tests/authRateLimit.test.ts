/**
 * authRateLimit.test.ts — the login limiter must throttle the callers that can
 * actually reach the login route.
 *
 * `authLimiter` used to `skip` whitelisted IPs. `adminWhitelistGuard` answers
 * the same route against the same list, so the two cancelled out: every caller
 * allowed to attempt a PIN was exempt from the limit, and the only requests the
 * limiter ever throttled were ones already being refused with 403. Against a
 * 4-6 digit admin PIN that left unlimited guessing open to any machine on the
 * canteen LAN.
 *
 * The old `skip` began with `if (NODE_ENV === 'test') return false`, so under
 * the test environment it throttled either way and a naive test passed against
 * the bug. This one runs the requests with NODE_ENV flipped to 'production' so
 * the real branch is exercised — the module is still imported under 'test' so
 * the database stays in memory.
 */
process.env.NODE_ENV = 'test';

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';

describe('login rate limiting', () => {
  it('throttles repeated wrong PINs from a whitelisted address', async () => {
    const app = await startServer();

    // supertest connects over loopback, which `isWhitelisted` always allows —
    // precisely the caller that used to be unlimited.
    const previous = process.env.NODE_ENV;
    const codes: number[] = [];
    try {
      process.env.NODE_ENV = 'production';
      for (let i = 0; i < 14; i++) {
        const res = await request(app).post('/api/auth/login').send({ pin: '999999' });
        codes.push(res.status);
      }
    } finally {
      process.env.NODE_ENV = previous;
    }

    expect(codes.filter(c => c === 401)).toHaveLength(10);
    expect(codes.slice(10).every(c => c === 429)).toBe(true);
  });
});

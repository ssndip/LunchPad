/**
 * orderId.test.ts — The attempt id must be unique and must exist on a kiosk.
 *
 * The kiosks run over plain http on the LAN, which is not a secure context, so
 * `crypto.randomUUID` is undefined there. Generating an id must still work.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { newClientOrderId } from './orderId';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('newClientOrderId', () => {
  it('produces distinct ids across many calls', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newClientOrderId()));
    expect(ids.size).toBe(5000);
  });

  it('produces distinct ids within the same millisecond', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ids = new Set(Array.from({ length: 1000 }, () => newClientOrderId()));
    expect(ids.size).toBe(1000);
  });

  it('stays within the length the server accepts', () => {
    expect(newClientOrderId().length).toBeLessThanOrEqual(100);
  });

  it('works where Web Crypto is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    const ids = new Set(Array.from({ length: 1000 }, () => newClientOrderId()));
    expect(ids.size).toBe(1000);
    expect(newClientOrderId()).toMatch(/^ord-/);
  });

  it('does not depend on crypto.randomUUID, which kiosks do not have', () => {
    vi.stubGlobal('crypto', { getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto) });
    expect(() => newClientOrderId()).not.toThrow();
  });
});

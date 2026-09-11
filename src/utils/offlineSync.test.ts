/**
 * offlineSync.test.ts — Regression for offline orders vanishing on replay.
 *
 * The old loop in useSyncState treated `res.ok || res.status < 500` as
 * "processed" and dropped the order from the queue. Every permanent refusal —
 * 409 because the menu moved on, 404 for an unknown card, 400 for an item that
 * is gone — therefore deleted the order with nothing but a console.log, and a
 * 429 from the duplicate-tap guard threw away a perfectly good second order.
 *
 * Nothing may be discarded silently: an order is either accepted, still worth
 * retrying, or recorded as failed with a reason a human can act on.
 */
import { describe, it, expect, vi } from 'vitest';
import { syncOfflineOrders, MAX_QUEUE_AGE_MS } from './offlineSync';
import type { OfflineOrder } from '../store/slices/orderSlice';

const makeOrder = (tempId: string, over: Partial<OfflineOrder> = {}): OfflineOrder => ({
  tempId,
  rfid: '1234567890',
  items: [{ id: 1 }],
  menuVersion: 1,
  timestamp: Date.now(),
  ...over,
});

/** Minimal stand-in for the fetch Response the API layer hands back. */
const reply = (status: number, body: any = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as Response;

describe('syncOfflineOrders', () => {
  it('clears the queue when every order is accepted', async () => {
    const submit = vi.fn().mockResolvedValue(reply(200, { success: true }));

    const out = await syncOfflineOrders([makeOrder('a'), makeOrder('b')], submit);

    expect(out.syncedCount).toBe(2);
    expect(out.pending).toEqual([]);
    expect(out.failed).toEqual([]);
  });

  it('records a 409 as failed instead of dropping it', async () => {
    // The overnight case: kiosk offline, admin publishes a new menu, every
    // queued order comes back 409. These used to disappear entirely.
    const submit = vi.fn().mockResolvedValue(reply(409, { error: 'Menu Updated' }));

    const out = await syncOfflineOrders([makeOrder('a')], submit);

    expect(out.pending).toEqual([]);
    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].tempId).toBe('a');
    expect(out.failed[0].reason).toContain('Menu Updated');
  });

  it('records a 404 unknown card as failed', async () => {
    const submit = vi.fn().mockResolvedValue(reply(404, { error: 'Card not found: 999' }));

    const out = await syncOfflineOrders([makeOrder('a')], submit);

    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].reason).toContain('Card not found');
  });

  it('records a 400 for an item that is gone', async () => {
    const submit = vi.fn().mockResolvedValue(reply(400, { error: 'No longer available: #999' }));

    const out = await syncOfflineOrders([makeOrder('a')], submit);

    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].reason).toContain('No longer available');
  });

  it('keeps a 429 queued rather than losing the order', async () => {
    // Two offline orders from one card replay back-to-back and trip the 3s
    // duplicate-tap guard. The second is real and must survive to be retried.
    const submit = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { success: true }))
      .mockResolvedValueOnce(reply(429, { error: 'Duplicate Tap' }));

    const out = await syncOfflineOrders([makeOrder('a'), makeOrder('b')], submit);

    expect(out.syncedCount).toBe(1);
    expect(out.pending.map((o) => o.tempId)).toEqual(['b']);
    expect(out.failed).toEqual([]);
  });

  it('stops at a 5xx and keeps that order and the rest queued', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { success: true }))
      .mockResolvedValueOnce(reply(503, {}))
      .mockResolvedValueOnce(reply(200, { success: true }));

    const out = await syncOfflineOrders([makeOrder('a'), makeOrder('b'), makeOrder('c')], submit);

    expect(out.syncedCount).toBe(1);
    expect(out.pending.map((o) => o.tempId)).toEqual(['b', 'c']);
    // Must not have tried 'c' after the server started failing.
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('stops on a network error and keeps everything still unsent', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { success: true }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const out = await syncOfflineOrders([makeOrder('a'), makeOrder('b'), makeOrder('c')], submit);

    expect(out.syncedCount).toBe(1);
    expect(out.pending.map((o) => o.tempId)).toEqual(['b', 'c']);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('fails an order too old to still be meaningful, without sending it', async () => {
    // A day-old order must not quietly charge someone today.
    const stale = makeOrder('old', { timestamp: Date.now() - MAX_QUEUE_AGE_MS - 1000 });
    const submit = vi.fn().mockResolvedValue(reply(200, { success: true }));

    const out = await syncOfflineOrders([stale, makeOrder('fresh')], submit);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(out.failed.map((o) => o.tempId)).toEqual(['old']);
    expect(out.syncedCount).toBe(1);
  });

  it('keeps going past a permanent failure to sync the orders behind it', async () => {
    const submit = vi
      .fn()
      .mockResolvedValueOnce(reply(404, { error: 'Card not found' }))
      .mockResolvedValueOnce(reply(200, { success: true }));

    const out = await syncOfflineOrders([makeOrder('bad'), makeOrder('good')], submit);

    expect(out.failed.map((o) => o.tempId)).toEqual(['bad']);
    expect(out.syncedCount).toBe(1);
    expect(out.pending).toEqual([]);
  });

  it('reports a PIN order whose PIN did not survive a reload', async () => {
    const submit = vi.fn().mockResolvedValue(reply(200, { success: true }));
    const restored = makeOrder('reloaded', { rfid: null, pin: undefined, pinRedacted: true });

    const out = await syncOfflineOrders([restored, makeOrder('fine')], submit);

    // Never sent: there is no credential to send it with.
    expect(submit).toHaveBeenCalledTimes(1);
    expect(out.failed.map((o) => o.tempId)).toEqual(['reloaded']);
    expect(out.failed[0].reason).toMatch(/reload/i);
    expect(out.syncedCount).toBe(1);
  });

  it('still replays a PIN order whose PIN is present in memory', async () => {
    const submit = vi.fn().mockResolvedValue(reply(200, { success: true }));
    const inMemory = makeOrder('kept', { rfid: null, pin: '123456', pinRedacted: true });

    const out = await syncOfflineOrders([inMemory], submit);

    expect(submit).toHaveBeenCalledTimes(1);
    expect(out.syncedCount).toBe(1);
    expect(out.failed).toEqual([]);
  });

  it('survives an error body that is not JSON', async () => {
    const submit = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    } as unknown as Response);

    const out = await syncOfflineOrders([makeOrder('a')], submit);

    expect(out.failed).toHaveLength(1);
    expect(out.failed[0].reason).toBeTruthy();
  });
});

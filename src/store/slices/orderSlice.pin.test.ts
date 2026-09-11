/**
 * orderSlice.pin.test.ts — A queued PIN order must not leave the PIN sitting in
 * localStorage.
 *
 * `addToOfflineQueue` persisted the whole order, PIN included, on a kiosk tablet
 * that anyone in the queue can pick up. The order still needs the PIN to be
 * replayed, so it stays in memory for the session; what is written to disk is
 * redacted, and an order whose PIN did not survive a reload is reported rather
 * than replayed without one.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../useStore';

const persistedQueue = () => JSON.parse(localStorage.getItem('lunchpad_offline_queue') || '[]');

beforeEach(() => {
  localStorage.clear();
  useStore.getState().setOfflineQueue([]);
});

describe('offline queue persistence', () => {
  it('keeps the PIN in memory so the order can still be replayed', () => {
    useStore.getState().addToOfflineQueue({
      rfid: null,
      items: [{ id: 1 }],
      menuVersion: 1,
      pin: '123456',
      clientOrderId: 'ord-a',
    });

    expect(useStore.getState().offlineQueue[0].pin).toBe('123456');
  });

  it('does not write the PIN to localStorage', () => {
    useStore.getState().addToOfflineQueue({
      rfid: null,
      items: [{ id: 1 }],
      menuVersion: 1,
      pin: '123456',
      clientOrderId: 'ord-b',
    });

    const raw = localStorage.getItem('lunchpad_offline_queue') || '';
    expect(raw).not.toContain('123456');
    expect(persistedQueue()[0].pin).toBeUndefined();
  });

  it('records that a PIN was redacted, so a reload can tell', () => {
    useStore.getState().addToOfflineQueue({
      rfid: null,
      items: [{ id: 1 }],
      menuVersion: 1,
      pin: '123456',
      clientOrderId: 'ord-c',
    });

    expect(persistedQueue()[0].pinRedacted).toBe(true);
  });

  it('persists an RFID order unchanged', () => {
    useStore.getState().addToOfflineQueue({
      rfid: '1234567890',
      items: [{ id: 1 }],
      menuVersion: 1,
      clientOrderId: 'ord-d',
    });

    const stored = persistedQueue()[0];
    expect(stored.rfid).toBe('1234567890');
    expect(stored.pinRedacted).toBeUndefined();
    expect(stored.clientOrderId).toBe('ord-d');
  });

  it('redacts on an explicit queue replacement too', () => {
    useStore.getState().setOfflineQueue([
      { tempId: 't1', rfid: null, items: [{ id: 1 }], timestamp: Date.now(), pin: '654321' },
    ]);

    expect(localStorage.getItem('lunchpad_offline_queue')).not.toContain('654321');
    expect(useStore.getState().offlineQueue[0].pin).toBe('654321');
  });
});

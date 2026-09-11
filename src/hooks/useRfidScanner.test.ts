/**
 * useRfidScanner.test.ts — Regression for the scan buffer being wiped by
 * unrelated re-renders.
 *
 * The hook's effect cleanup clears the keystroke buffer. Because `handleKeyDown`
 * was rebuilt whenever `onScan` changed identity — and KioskView passed a fresh
 * inline arrow on every render — any re-render in the middle of a swipe tore the
 * listener down, dropped the characters typed so far, and either silently lost
 * the scan or reported a truncated card number.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRfidScanner } from './useRfidScanner';

/** Hardware scanners type the code then send Enter; keystrokes are ~ms apart. */
const type = (chars: string) => {
  for (const key of chars) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  }
};

const pressEnter = () => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
};

describe('useRfidScanner', () => {
  it('reports a full scan with no re-render in the way', () => {
    const onScan = vi.fn();
    renderHook(() => useRfidScanner({ onScan, active: true }));

    type('0123456789');
    pressEnter();

    expect(onScan).toHaveBeenCalledWith('0123456789');
  });

  it('keeps the buffer across a re-render that changes the onScan identity', () => {
    const onScan = vi.fn();
    // A new inline arrow every render, exactly how KioskView passes it.
    const { rerender } = renderHook(
      ({ tick }) => useRfidScanner({ onScan: (rfid: string) => onScan(rfid, tick), active: true }),
      { initialProps: { tick: 0 } }
    );

    type('01234');
    rerender({ tick: 1 }); // e.g. a WebSocket message or a cart update lands
    type('56789');
    pressEnter();

    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith('0123456789', 1);
  });

  it('routes the scan to the newest callback, not a stale closure', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ onScan }) => useRfidScanner({ onScan, active: true }),
      { initialProps: { onScan: first } }
    );

    type('01234');
    rerender({ onScan: second });
    type('56789');
    pressEnter();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('0123456789');
  });

  it('drops the buffer when the scanner is deactivated', () => {
    const onScan = vi.fn();
    const { rerender } = renderHook(
      ({ active }) => useRfidScanner({ onScan, active }),
      { initialProps: { active: true } }
    );

    type('01234');
    rerender({ active: false });
    type('56789');
    pressEnter();

    expect(onScan).not.toHaveBeenCalled();
  });

  it('ignores human typing, which is far slower than a scanner', async () => {
    const onScan = vi.fn();
    renderHook(() => useRfidScanner({ onScan, active: true }));

    for (const key of '0123') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await new Promise((r) => setTimeout(r, 110));
    }
    pressEnter();

    expect(onScan).not.toHaveBeenCalled();
  });
});

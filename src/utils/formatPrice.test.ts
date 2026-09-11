/**
 * formatPrice.test.ts — Rendering money without crashing the kiosk.
 *
 * The kiosk called `item.price.toFixed(2)` directly. A menu row stored with a
 * NULL price therefore threw during render and dropped the whole kiosk into the
 * error boundary. Server-side validation now rejects such rows, but databases
 * written before that fix still hold them, so display has to survive one.
 */
import { describe, it, expect } from 'vitest';
import { formatPrice } from './formatPrice';

describe('formatPrice', () => {
  it('formats an ordinary number to two places', () => {
    expect(formatPrice(1.5)).toBe('1.50');
    expect(formatPrice(0)).toBe('0.00');
    expect(formatPrice(12)).toBe('12.00');
  });

  it('rounds like toFixed', () => {
    expect(formatPrice(2.345)).toBe('2.35');
    expect(formatPrice(2.344)).toBe('2.34');
  });

  it('accepts the numeric strings the menu editor produces', () => {
    expect(formatPrice('2.40')).toBe('2.40');
  });

  it('falls back to zero for a legacy row with no price', () => {
    expect(formatPrice(null)).toBe('0.00');
    expect(formatPrice(undefined)).toBe('0.00');
    expect(formatPrice('')).toBe('0.00');
  });

  it('falls back to zero rather than printing NaN or Infinity', () => {
    expect(formatPrice('not a price')).toBe('0.00');
    expect(formatPrice(NaN)).toBe('0.00');
    expect(formatPrice(Infinity)).toBe('0.00');
  });
});

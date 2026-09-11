import { describe, it, expect } from 'vitest';
import { splitFeeCents } from './splitFee';

describe('splitFeeCents', () => {
  it('divides evenly when it can', () => {
    expect(splitFeeCents(1000, 4)).toEqual([250, 250, 250, 250]);
  });

  it('never loses a cent on an uneven split', () => {
    // 10.00 across 3 used to collect 9.99.
    const parts = splitFeeCents(1000, 3);
    expect(parts).toEqual([334, 333, 333]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('never invents a cent either', () => {
    // 10.00 across 7 used to collect 10.01.
    const parts = splitFeeCents(1000, 7);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('adds up for every group size', () => {
    for (let n = 1; n <= 60; n++) {
      for (const total of [1, 7, 100, 555, 1000, 12345]) {
        expect(splitFeeCents(total, n).reduce((a, b) => a + b, 0)).toBe(total);
      }
    }
  });

  it('spreads the leftover by at most one cent each', () => {
    const parts = splitFeeCents(1000, 3);
    expect(Math.max(...parts) - Math.min(...parts)).toBeLessThanOrEqual(1);
  });

  it('handles nobody to split between', () => {
    expect(splitFeeCents(500, 0)).toEqual([]);
  });
});

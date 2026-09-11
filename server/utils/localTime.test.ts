/**
 * localTime.test.ts — The canteen day must be computed in one zone.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { localDateString, localHHmm, localDayOfWeek, resolveTimeZone } from './localTime';

const SOFIA = 'Europe/Sofia';

afterEach(() => {
  delete process.env.TZ;
});

describe('localDateString', () => {
  it('gives the local date, not the UTC one, late in the evening', () => {
    // 22:30 UTC on the 11th is already 01:30 on the 12th in Sofia.
    const instant = new Date('2026-09-11T22:30:00Z');

    expect(instant.toISOString().split('T')[0]).toBe('2026-09-11');
    expect(localDateString(instant, SOFIA)).toBe('2026-09-12');
  });

  it('agrees with UTC during canteen hours', () => {
    const lunchtime = new Date('2026-09-11T08:30:00Z');
    expect(localDateString(lunchtime, SOFIA)).toBe('2026-09-11');
  });

  it('handles a zone behind UTC', () => {
    const instant = new Date('2026-09-11T02:00:00Z'); // 21:00 on the 10th in New York
    expect(localDateString(instant, 'America/New_York')).toBe('2026-09-10');
  });

  it('formats as YYYY-MM-DD, matching the date column', () => {
    expect(localDateString(new Date('2026-01-05T12:00:00Z'), SOFIA)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('localHHmm', () => {
  it('gives the local wall clock, which decides whether the kiosk is open', () => {
    // The bug in miniature: 06:00 UTC is 09:00 in Sofia, inside an 08:00–11:00
    // window that a UTC process would have called closed.
    const instant = new Date('2026-09-11T06:00:00Z');

    expect(localHHmm(instant, 'UTC')).toBe('06:00');
    expect(localHHmm(instant, SOFIA)).toBe('09:00');
  });

  it('uses a 24-hour clock with midnight as 00', () => {
    expect(localHHmm(new Date('2026-09-11T21:00:00Z'), SOFIA)).toBe('00:00');
    expect(localHHmm(new Date('2026-09-11T10:05:00Z'), SOFIA)).toBe('13:05');
  });

  it('stays lexicographically comparable, as the window check assumes', () => {
    const value = localHHmm(new Date('2026-09-11T06:00:00Z'), SOFIA);
    expect(value >= '08:00' && value < '11:00').toBe(true);
  });
});

describe('localDayOfWeek', () => {
  it('returns 0 for Sunday, matching kioskCloseDay', () => {
    expect(localDayOfWeek(new Date('2026-09-13T09:00:00Z'), SOFIA)).toBe(0);
    expect(localDayOfWeek(new Date('2026-09-11T09:00:00Z'), SOFIA)).toBe(5);
  });

  it('rolls over with the local date, not the UTC one', () => {
    // 22:00 UTC Saturday is already Sunday in Sofia.
    const instant = new Date('2026-09-12T22:00:00Z');
    expect(instant.getUTCDay()).toBe(6);
    expect(localDayOfWeek(instant, SOFIA)).toBe(0);
  });
});

describe('resolveTimeZone', () => {
  it('prefers TZ when the operator has set one', () => {
    process.env.TZ = SOFIA;
    expect(resolveTimeZone()).toBe(SOFIA);
  });

  it('falls back to something usable when TZ is blank', () => {
    process.env.TZ = '';
    expect(resolveTimeZone()).toBeTruthy();
  });
});

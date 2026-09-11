/**
 * localTime.ts — One timezone for everything the canteen day depends on.
 *
 * Order rows were stamped with `new Date().toISOString().split('T')[0]`, a UTC
 * date, while the kiosk opening hours compared `now.getHours()`, the process's
 * local time. Two different clocks decided when "today" started and whether the
 * kiosk was open.
 *
 * It matters most in a container, which runs UTC unless TZ says otherwise: an
 * 08:00–11:00 window then opens at 10:00 or 11:00 Bulgarian time, and the peak
 * hours chart is shifted by the same offset. Set TZ to the canteen's zone (see
 * docker-compose.yml) and every one of these agrees.
 */

/** The zone the canteen runs in: TZ if set, else the host's, else UTC. */
export const resolveTimeZone = (): string => {
  const configured = (process.env.TZ || '').trim();
  if (configured) return configured;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

/** `YYYY-MM-DD` for the given instant, in the canteen's zone. */
export const localDateString = (date: Date = new Date(), timeZone: string = resolveTimeZone()): string => {
  try {
    // en-CA formats as YYYY-MM-DD, which is what the `date` column holds.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
};

/** `HH:mm` on a 24-hour clock, for comparing against the open/close times. */
export const localHHmm = (date: Date = new Date(), timeZone: string = resolveTimeZone()): string => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(date);
  } catch {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Day of week, 0 = Sunday, matching the `kioskCloseDay` setting. */
export const localDayOfWeek = (date: Date = new Date(), timeZone: string = resolveTimeZone()): number => {
  try {
    const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
    const index = WEEKDAYS.indexOf(short);
    return index === -1 ? date.getDay() : index;
  } catch {
    return date.getDay();
  }
};

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The combination guard on verifyAdminPin.
 *
 * Shipping the admin whitelist off by default (so a new install can be set up
 * remotely) means the PIN is the only thing in front of the dashboard on a
 * first boot — and until someone sets one, that PIN is the publicly known
 * DEFAULT_ADMIN_PIN. Either of those alone is fine: a default PIN behind an
 * IP whitelist is a LAN-only convenience, and an open whitelist with a real
 * PIN is an ordinary remote login. Together they are an open door.
 *
 * So the guard refuses exactly that intersection, and nothing else. It must
 * not fire when an operator has set ADMIN_PIN to something of their own, and
 * it must not fire when the whitelist is on.
 */

const dbGet = vi.hoisted(() => vi.fn());
vi.mock('./db', () => ({
  db: {
    prepare: vi.fn(() => ({ get: dbGet, run: vi.fn(), all: vi.fn() })),
    exec: vi.fn(),
    pragma: vi.fn(),
  },
  initDb: vi.fn(),
}));

/** No admin_pin row at all — the fallback branch verifyAdminPin guards. */
const noStoredPin = () => dbGet.mockReturnValue(undefined);
/** A bcrypt hash in the settings table — an operator has set a real PIN. */
const storedPin = (hash: string) => dbGet.mockReturnValue({ value: hash });

describe('verifyAdminPin with no PIN set', () => {
  const originalPin = process.env.ADMIN_PIN;

  beforeEach(() => {
    vi.resetModules();
    dbGet.mockReset();
    delete process.env.ADMIN_PIN;
  });

  afterEach(() => {
    if (originalPin === undefined) delete process.env.ADMIN_PIN;
    else process.env.ADMIN_PIN = originalPin;
  });

  it('refuses the default PIN when the whitelist is off', async () => {
    const { verifyAdminPin, settings, DEFAULT_ADMIN_PIN } = await import('./config');
    settings.adminWhitelistEnabled = false;
    noStoredPin();
    expect(verifyAdminPin(DEFAULT_ADMIN_PIN)).toBe(false);
  });

  it('still accepts the default PIN when the whitelist is on', async () => {
    const { verifyAdminPin, settings, DEFAULT_ADMIN_PIN } = await import('./config');
    settings.adminWhitelistEnabled = true;
    noStoredPin();
    expect(verifyAdminPin(DEFAULT_ADMIN_PIN)).toBe(true);
  });

  it('accepts an operator-supplied ADMIN_PIN with the whitelist off', async () => {
    process.env.ADMIN_PIN = '482913';
    const { verifyAdminPin, settings } = await import('./config');
    settings.adminWhitelistEnabled = false;
    noStoredPin();
    expect(verifyAdminPin('482913')).toBe(true);
  });

  it('refuses the default PIN even when ADMIN_PIN is set to something else', async () => {
    process.env.ADMIN_PIN = '482913';
    const { verifyAdminPin, settings, DEFAULT_ADMIN_PIN } = await import('./config');
    settings.adminWhitelistEnabled = false;
    noStoredPin();
    expect(verifyAdminPin(DEFAULT_ADMIN_PIN)).toBe(false);
  });

  it('accepts a PIN stored in the database with the whitelist off', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const { verifyAdminPin, settings } = await import('./config');
    settings.adminWhitelistEnabled = false;
    storedPin(bcrypt.hashSync('735120', 10));
    expect(verifyAdminPin('735120')).toBe(true);
  });

  it('does not let the default PIN through once a real one is stored', async () => {
    const bcrypt = (await import('bcryptjs')).default;
    const { verifyAdminPin, settings, DEFAULT_ADMIN_PIN } = await import('./config');
    settings.adminWhitelistEnabled = false;
    storedPin(bcrypt.hashSync('735120', 10));
    expect(verifyAdminPin(DEFAULT_ADMIN_PIN)).toBe(false);
  });
});

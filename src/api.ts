/**
 * api.ts — Centralised fetch layer.
 * All network calls live here. No React imports.
 */
import { MenuItem, Order, Card } from './types';

// ─── Session expiry ──────────────────────────────────────────────────────────
/**
 * The admin token lasts 8h. Before this, every call made with an expired one
 * simply rejected with a generic "Failed to fetch X": `isManagerLoggedIn` is
 * derived from the presence of the token, not its validity, so the dashboard
 * stayed "logged in" and silently rendered nothing, with no way back except
 * clearing sessionStorage. Any authenticated call that comes back 401/403 now
 * reports it once, and the app tears the session down and shows the login.
 */
let onAuthFailure: (() => void) | null = null;

export const setAuthFailureHandler = (fn: (() => void) | null) => {
  onAuthFailure = fn;
};

/**
 * `fetch` that notices an expired session.
 *
 * Only calls that actually sent an Authorization header can expire, so a 401
 * from the public kiosk endpoints (a wrong access code, say) is left alone.
 */
const apiFetch = async (url: string, init?: RequestInit): Promise<Response> => {
  const res = await fetch(url, init);
  const sentAuth = Boolean((init?.headers as Record<string, string> | undefined)?.['Authorization']);
  if (sentAuth && (res.status === 401 || res.status === 403)) {
    onAuthFailure?.();
  }
  return res;
};

/** Reads the server's own error message, falling back to `fallback`. */
export const errorFrom = async (res: Response, fallback: string): Promise<string> => {
  try {
    const body = await res.json();
    return body?.error || fallback;
  } catch {
    return fallback;
  }
};

/** Throws with the server's message when `res` is not ok. */
const assertOk = async (res: Response, fallback: string): Promise<Response> => {
  if (!res.ok) throw new Error(await errorFrom(res, fallback));
  return res;
};

// ─── Auth Headers ────────────────────────────────────────────────────────────
const authHeaders = (token: string) => ({ 'Authorization': `Bearer ${token}` });
const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

export const login = async (pin: string): Promise<{ success: boolean, token?: string, error?: string }> => {
  const res = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return res.json();
};

export const unlock = async (code: string): Promise<{ success: boolean, token?: string, error?: string }> => {
  const res = await apiFetch('/api/auth/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
};

// ─── Init / Menu ─────────────────────────────────────────────────────────────
export const fetchInitialState = async () => {
  const res = await apiFetch('/api/init');
  if (!res.ok) throw new Error('Failed to fetch initial state');
  return res.json();
};

export const fetchMenu = async (): Promise<MenuItem[]> => {
  const res = await apiFetch('/api/menu');
  if (!res.ok) throw new Error('Failed to fetch menu');
  return res.json();
};

export const updateMenu = async (token: string, menu: MenuItem[], date?: string): Promise<void> => {
  const res = await apiFetch('/api/menu', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ items: menu, date }),
  });
  if (!res.ok) throw new Error('Failed to update menu');
};

export interface MenuBackup {
  id: number;
  timestamp: string;
  menuDate: string;
  menuVersion: number;
  itemCount: number;
}

export const fetchMenuBackups = async (token: string): Promise<MenuBackup[]> => {
  const res = await apiFetch('/api/menu/backups', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch menu backups');
  return res.json();
};

export const restoreMenuBackup = async (token: string, id: number): Promise<void> => {
  const res = await apiFetch(`/api/menu/backups/restore/${id}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to restore menu backup');
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const fetchOrders = async (token: string): Promise<Order[]> => {
  const res = await apiFetch('/api/orders', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

/** Place a kiosk order. Returns the raw response so callers can read error bodies. */
export const placeOrder = async (
  rfid: string | null,
  items: { id: number, side?: string }[],
  menuVersion?: number,
  pin?: string,
  /** Identifies this attempt so a replay is not charged again. */
  clientOrderId?: string,
): Promise<Response> => {
  return apiFetch('/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rfid: rfid?.trim() || undefined, pin, items, menuVersion, clientOrderId }),
  });
};

/**
 * The server's `LIMIT` on a history query. Mirrors HISTORY_LIMIT in
 * server/controllers/orderController.ts — a result of exactly this length
 * means the query was capped, not that it was complete.
 */
export const HISTORY_LIMIT = 500;

export const fetchHistory = async (
  token: string,
  filters: Record<string, string>,
): Promise<Order[]> => {
  const params = new URLSearchParams(filters);
  const res = await apiFetch(`/api/history?${params}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

export const fetchSummaries = async (token: string) => {
  const res = await apiFetch('/api/summaries', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch summaries');
  return res.json();
};

export const fetchDailySummaryDetails = async (token: string, date: string) => {
  const res = await apiFetch(`/api/summaries/${date}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch daily details');
  return res.json();
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const fetchSettings = async (token: string) => {
  const res = await apiFetch('/api/settings', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const updateSettings = async (
  token: string,
  settings: Record<string, unknown>,
): Promise<void> => {
  const res = await apiFetch('/api/settings', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(settings),
  });
  await assertOk(res, 'Failed to update settings');
};

export const updatePin = async (token: string, newPin: string): Promise<Response> => {
  return apiFetch('/api/settings/pin', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ newPin }),
  });
};

export const toggleKioskStatus = async (token: string, open: boolean): Promise<void> => {
  const res = await apiFetch('/api/status', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ open }),
  });
  await assertOk(res, 'Failed to toggle kiosk status');
};

// ─── Cards ───────────────────────────────────────────────────────────────────
export const fetchCards = async (token: string): Promise<Card[]> => {
  const res = await apiFetch('/api/cards', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
};

export const addCard = async (token: string, card: Card): Promise<Response> => {
  return apiFetch('/api/cards', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(card),
  });
};

export const deleteCard = async (token: string, rfid: string): Promise<void> => {
  const res = await apiFetch(`/api/cards/${encodeURIComponent(rfid)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  await assertOk(res, 'Failed to delete card');
};

export const batchAddCards = async (token: string, cards: Card[]): Promise<void> => {
  const res = await apiFetch('/api/cards/batch', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(cards),
  });
  if (!res.ok) throw new Error('Failed to batch add cards');
};

export const updateCard = async (token: string, rfid: string, card: Card): Promise<Response> => {
  return apiFetch(`/api/cards/${encodeURIComponent(rfid)}/update`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(card),
  });
};

export const updateCards = async (token: string, cards: Card[]): Promise<Response> => {
  return apiFetch('/api/cards/update', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(cards),
  });
};

export const resetAllBalances = async (token: string): Promise<void> => {
  const res = await apiFetch('/api/cards/reset-all', {
    method: 'POST',
    headers: authHeaders(token),
  });
  await assertOk(res, 'Failed to reset balances');
};

export const resetCardBalance = async (token: string, rfid: string): Promise<void> => {
  const res = await apiFetch(`/api/cards/${encodeURIComponent(rfid)}/reset`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  await assertOk(res, 'Failed to reset balance');
};

// ─── Feature 3: Card Profile ─────────────────────────────────────────────────
/** Fetch a card's profile (name, balance, recent orders) for the kiosk scan view. */
export const fetchCardProfile = async (rfid: string) => {
  const res = await apiFetch(`/api/cards/${encodeURIComponent(rfid)}/profile`);
  if (!res.ok) throw new Error('Card not found');
  return res.json();
};

export const fetchAnalytics = async (token: string, filters?: Record<string, string>) => {
  const params = filters ? new URLSearchParams(filters) : '';
  const url = `/api/analytics${params ? `?${params}` : ''}`;
  const res = await apiFetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
};

export const distributeFee = async (token: string, date: string, fee: number) => {
  const res = await apiFetch('/api/distribute-fee', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, fee }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to distribute fee');
  }
  return res.json();
};

// ─── Parser API ───────────────────────────────────────────────────────────────
export const createParserProfile = async (token: string, profile: { name: string, description: string, config: any }) => {
  const res = await apiFetch('/api/parser/profiles', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to create parser profile');
  return res.json();
};

export const getParserProfiles = async (token: string) => {
  const res = await apiFetch('/api/parser/profiles', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser profiles');
  return res.json();
};

export const saveParserFixture = async (token: string, fixture: any) => {
  const res = await apiFetch('/api/parser/fixtures', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(fixture),
  });
  if (!res.ok) throw new Error('Failed to save parser fixture');
  return res.json();
};

export const getParserFixtures = async (token: string) => {
  const res = await apiFetch('/api/parser/fixtures', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser fixtures');
  return res.json();
};

export const suggestParserRules = async (token: string, menuText: string, currentConfig: any, instructions?: string, currentResult?: any) => {
  const res = await apiFetch('/api/ai/suggest-rules', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ menuText, currentConfig, instructions, currentResult }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'AI request failed');
  }
  return res.json();
};

// ─── Language API ────────────────────────────────────────────────────────────
export const fetchLanguages = async () => {
  const res = await apiFetch('/api/languages');
  if (!res.ok) throw new Error('Failed to fetch languages');
  return res.json() as Promise<{ static: { code: string, name: string }[], custom: { code: string, name: string }[] }>;
};

export const fetchLanguageData = async (code: string) => {
  const res = await apiFetch(`/api/languages/${code}`);
  if (!res.ok) throw new Error('Failed to fetch language data');
  return res.json();
};

export const importLanguage = async (token: string, code: string, name: string, translations: any) => {
  const res = await apiFetch('/api/languages/import', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ code, name, translations }),
  });
  if (!res.ok) throw new Error('Failed to import language');
  return res.json();
};

export const deleteLanguage = async (token: string, code: string) => {
  const res = await apiFetch(`/api/languages/${code}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete language');
  return res.json();
};

// ─── Bulk Sync (Database Agnostic) ──────────────────────────────────────────
export const exportParserBundle = async (token: string) => {
  const res = await apiFetch('/api/parser/export-all', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to export parser bundle');
  return res.json();
};

export const importParserBundle = async (token: string, bundle: any) => {
  const res = await apiFetch('/api/parser/import-bundle', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(bundle),
  });
  if (!res.ok) throw new Error('Failed to import parser bundle');
  return res.json();
};

// ─── Server-side automatic backups ──────────────────────────────────────────
export interface SystemBackupFile {
  filename: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * The rolling database snapshots the server takes on its own.
 *
 * These have always existed (see initAutoBackup) and have always been listable
 * and restorable over the API, but nothing in the dashboard reached them — so
 * the only recovery an admin had was a JSON export they remembered to take.
 */
export const listSystemBackups = async (token: string): Promise<SystemBackupFile[]> => {
  const res = await apiFetch('/api/system/backups', { headers: authHeaders(token) });
  await assertOk(res, 'Failed to list server backups');
  return res.json();
};

/**
 * Restores one of those snapshots.
 *
 * The server replaces its database file and then exits, relying on its
 * supervisor to restart it, so this request often does not get a reply at all —
 * the connection dies mid-flight. A transport error is therefore treated as
 * success-in-progress; `waitForServer` is what actually confirms the outcome.
 */
export const restoreSystemBackupFile = async (token: string, filename: string): Promise<void> => {
  try {
    const res = await apiFetch(`/api/system/backups/restore/${encodeURIComponent(filename)}`, {
      method: 'POST',
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error(await errorFrom(res, 'Failed to restore the server backup'));
  } catch (err: any) {
    if (err instanceof TypeError) return; // connection dropped as the server exited
    throw err;
  }
};

/**
 * Polls until the server answers again, or gives up.
 *
 * Returns true if it came back. A false means the process did not restart —
 * which happens when nothing is supervising it — and the admin needs to start
 * it by hand rather than sit on a page that claims to be working.
 */
export const waitForServer = async (timeoutMs = 30000): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (res.ok) return true;
    } catch {
      // Still down; keep waiting.
    }
  }
  return false;
};

// ─── Full System Backup & Restore ───────────────────────────────────────────
export const exportSystemBackup = async (token: string) => {
  const res = await apiFetch('/api/system/backup', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to export system backup');
  return res.json();
};

export const importSystemBackup = async (token: string, bundle: any) => {
  const res = await apiFetch('/api/system/restore', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(bundle),
  });
  await assertOk(res, 'Failed to restore system');
  return res.json();
};

/**
 * api.ts — Centralised fetch layer.
 * All network calls live here. No React imports.
 */
import { MenuItem, Order, Card } from './types';

// ─── Auth Headers ────────────────────────────────────────────────────────────
const authHeaders = (token: string) => ({ 'Authorization': `Bearer ${token}` });
const jsonHeaders = (token: string) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`,
});

export const login = async (pin: string): Promise<{ success: boolean, token?: string, error?: string }> => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  return res.json();
};

export const unlock = async (code: string): Promise<{ success: boolean, token?: string, error?: string }> => {
  const res = await fetch('/api/auth/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return res.json();
};

// ─── Init / Menu ─────────────────────────────────────────────────────────────
export const fetchInitialState = async () => {
  const res = await fetch('/api/init');
  if (!res.ok) throw new Error('Failed to fetch initial state');
  return res.json();
};

export const fetchMenu = async (): Promise<MenuItem[]> => {
  const res = await fetch('/api/menu');
  if (!res.ok) throw new Error('Failed to fetch menu');
  return res.json();
};

export const updateMenu = async (token: string, menu: MenuItem[]): Promise<void> => {
  const res = await fetch('/api/menu', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(menu),
  });
  if (!res.ok) throw new Error('Failed to update menu');
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const fetchOrders = async (token: string): Promise<Order[]> => {
  const res = await fetch('/api/orders', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

/** Place a kiosk order. Returns the raw response so callers can read error bodies. */
export const placeOrder = async (
  rfid: string,
  items: { id: number, side?: string }[],
  menuVersion?: number,
): Promise<Response> => {
  return fetch('/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rfid: rfid.trim(), items, menuVersion }),
  });
};

export const fetchHistory = async (
  token: string,
  filters: Record<string, string>,
): Promise<Order[]> => {
  const params = new URLSearchParams(filters);
  const res = await fetch(`/api/history?${params}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

export const fetchSummaries = async (token: string) => {
  const res = await fetch('/api/summaries', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch summaries');
  return res.json();
};

export const fetchDailySummaryDetails = async (token: string, date: string) => {
  const res = await fetch(`/api/summaries/${date}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch daily details');
  return res.json();
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const fetchSettings = async (token: string) => {
  const res = await fetch('/api/settings', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const updateSettings = async (
  token: string,
  settings: Record<string, unknown>,
): Promise<void> => {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
};

export const updatePin = async (token: string, newPin: string): Promise<Response> => {
  return fetch('/api/settings/pin', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ newPin }),
  });
};

export const toggleKioskStatus = async (token: string, open: boolean): Promise<void> => {
  await fetch('/api/status', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ open }),
  });
};

// ─── Cards ───────────────────────────────────────────────────────────────────
export const fetchCards = async (token: string): Promise<Card[]> => {
  const res = await fetch('/api/cards', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
};

export const addCard = async (token: string, card: Card): Promise<void> => {
  const res = await fetch('/api/cards', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error('Failed to add card');
};

export const deleteCard = async (token: string, rfid: string): Promise<void> => {
  await fetch(`/api/cards/${encodeURIComponent(rfid)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
};

export const batchAddCards = async (token: string, cards: Card[]): Promise<void> => {
  const res = await fetch('/api/cards/batch', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(cards),
  });
  if (!res.ok) throw new Error('Failed to batch add cards');
};

export const updateCards = async (token: string, cards: Card[]): Promise<void> => {
  await fetch('/api/cards/update', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(cards),
  });
};

export const resetAllBalances = async (token: string): Promise<void> => {
  await fetch('/api/cards/reset-all', {
    method: 'POST',
    headers: authHeaders(token),
  });
};

export const resetCardBalance = async (token: string, rfid: string): Promise<void> => {
  await fetch(`/api/cards/${encodeURIComponent(rfid)}/reset`, {
    method: 'POST',
    headers: authHeaders(token),
  });
};

// ─── Feature 3: Card Profile ─────────────────────────────────────────────────
/** Fetch a card's profile (name, balance, recent orders) for the kiosk scan view. */
export const fetchCardProfile = async (rfid: string) => {
  const res = await fetch(`/api/cards/${encodeURIComponent(rfid)}/profile`);
  if (!res.ok) throw new Error('Card not found');
  return res.json();
};

export const fetchAnalytics = async (token: string) => {
  const res = await fetch('/api/analytics', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
};

export const distributeFee = async (token: string, date: string, fee: number) => {
  const res = await fetch('/api/distribute-fee', {
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

// ─── Auth Verification ────────────────────────────────────────────────────────
export const verifyPin = async (
  pin: string,
): Promise<[Response, Response]> => {
  return Promise.all([
    fetch('/api/cards', { headers: authHeaders(pin) }),
    fetch('/api/orders', { headers: authHeaders(pin) }),
  ]) as Promise<[Response, Response]>;
};

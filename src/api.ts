/**
 * api.ts — Centralised fetch layer.
 * All network calls live here. No React imports.
 */
import { MenuItem, Order, Card } from './types';

// ─── Auth Headers ────────────────────────────────────────────────────────────
const authHeaders = (pin: string) => ({ 'x-admin-pin': pin });
const jsonHeaders = (pin: string) => ({
  'Content-Type': 'application/json',
  'x-admin-pin': pin,
});

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

export const updateMenu = async (pin: string, menu: MenuItem[]): Promise<void> => {
  const res = await fetch('/api/menu', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify(menu),
  });
  if (!res.ok) throw new Error('Failed to update menu');
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const fetchOrders = async (pin: string): Promise<Order[]> => {
  const res = await fetch('/api/orders', { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

/** Place a kiosk order. Returns the raw response so callers can read error bodies. */
export const placeOrder = async (
  rfid: string,
  itemIds: number[],
): Promise<Response> => {
  return fetch('/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rfid: rfid.trim(), itemIds }),
  });
};

export const fetchHistory = async (
  pin: string,
  filters: Record<string, string>,
): Promise<Order[]> => {
  const params = new URLSearchParams(filters);
  const res = await fetch(`/api/history?${params}`, { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch history');
  return res.json();
};

export const fetchSummaries = async (pin: string) => {
  const res = await fetch('/api/summaries', { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch summaries');
  return res.json();
};

export const resetOrders = async (pin: string): Promise<void> => {
  const res = await fetch('/api/orders/reset', {
    method: 'POST',
    headers: authHeaders(pin),
  });
  if (!res.ok) throw new Error('Failed to reset orders');
};

export const fetchDailySummaryDetails = async (pin: string, date: string) => {
  const res = await fetch(`/api/summaries/${date}`, { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch daily details');
  return res.json();
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const fetchSettings = async (pin: string) => {
  const res = await fetch('/api/settings', { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
};

export const updateSettings = async (
  pin: string,
  settings: Record<string, unknown>,
): Promise<void> => {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
};

export const updatePin = async (pin: string, newPin: string): Promise<Response> => {
  return fetch('/api/settings/pin', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify({ newPin }),
  });
};

export const toggleKioskStatus = async (pin: string, open: boolean): Promise<void> => {
  await fetch('/api/status', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify({ open }),
  });
};

// ─── Cards ───────────────────────────────────────────────────────────────────
export const fetchCards = async (pin: string): Promise<Card[]> => {
  const res = await fetch('/api/cards', { headers: authHeaders(pin) });
  if (!res.ok) throw new Error('Failed to fetch cards');
  return res.json();
};

export const addCard = async (pin: string, card: Card): Promise<void> => {
  const res = await fetch('/api/cards', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error('Failed to add card');
};

export const deleteCard = async (pin: string, rfid: string): Promise<void> => {
  await fetch(`/api/cards/${encodeURIComponent(rfid)}`, {
    method: 'DELETE',
    headers: authHeaders(pin),
  });
};

export const batchAddCards = async (pin: string, cards: Card[]): Promise<void> => {
  const res = await fetch('/api/cards/batch', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify(cards),
  });
  if (!res.ok) throw new Error('Failed to batch add cards');
};

export const updateCards = async (pin: string, cards: Card[]): Promise<void> => {
  await fetch('/api/cards/update', {
    method: 'POST',
    headers: jsonHeaders(pin),
    body: JSON.stringify(cards),
  });
};

export const resetAllBalances = async (pin: string): Promise<void> => {
  await fetch('/api/cards/reset-all', {
    method: 'POST',
    headers: authHeaders(pin),
  });
};

export const deleteAllCards = async (pin: string): Promise<void> => {
  await fetch('/api/cards', {
    method: 'DELETE',
    headers: authHeaders(pin),
  });
};

export const resetCardBalance = async (pin: string, rfid: string): Promise<void> => {
  await fetch(`/api/cards/${encodeURIComponent(rfid)}/reset`, {
    method: 'POST',
    headers: authHeaders(pin),
  });
};

// ─── Feature 3: Card Profile ─────────────────────────────────────────────────
/** Fetch a card's profile (name, balance, recent orders) for the kiosk scan view. */
export const fetchCardProfile = async (rfid: string) => {
  const res = await fetch(`/api/cards/${encodeURIComponent(rfid)}/profile`);
  if (!res.ok) throw new Error('Card not found');
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

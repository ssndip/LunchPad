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

export const updateMenu = async (token: string, menu: MenuItem[], date?: string): Promise<void> => {
  const res = await fetch('/api/menu', {
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
  const res = await fetch('/api/menu/backups', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch menu backups');
  return res.json();
};

export const restoreMenuBackup = async (token: string, id: number): Promise<void> => {
  const res = await fetch(`/api/menu/backups/restore/${id}`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to restore menu backup');
};

// ─── Orders ──────────────────────────────────────────────────────────────────
export const fetchOrders = async (token: string): Promise<Order[]> => {
  const res = await fetch('/api/orders', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
};

/** Place a kiosk order. Returns the raw response so callers can read error bodies. */
export const placeOrder = async (
  rfid: string | null,
  items: { id: number, side?: string }[],
  menuVersion?: number,
  pin?: string,
): Promise<Response> => {
  return fetch('/api/v1/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rfid: rfid?.trim() || undefined, pin, items, menuVersion }),
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

export const addCard = async (token: string, card: Card): Promise<Response> => {
  return fetch('/api/cards', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(card),
  });
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

export const updateCard = async (token: string, rfid: string, card: Card): Promise<Response> => {
  return fetch(`/api/cards/${encodeURIComponent(rfid)}/update`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(card),
  });
};

export const updateCards = async (token: string, cards: Card[]): Promise<Response> => {
  return fetch('/api/cards/update', {
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

export const fetchAnalytics = async (token: string, filters?: Record<string, string>) => {
  const params = filters ? new URLSearchParams(filters) : '';
  const url = `/api/analytics${params ? `?${params}` : ''}`;
  const res = await fetch(url, { headers: authHeaders(token) });
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


// ─── Parser API ───────────────────────────────────────────────────────────────
export const createParserProfile = async (token: string, profile: { name: string, description: string, config: any }) => {
  const res = await fetch('/api/parser/profiles', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to create parser profile');
  return res.json();
};

export const duplicateParserProfile = async (token: string, profileId: string) => {
  const res = await fetch(`/api/parser/profiles/${profileId}/duplicate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to duplicate parser profile');
  return res.json();
};

export const getParserProfiles = async (token: string) => {
  const res = await fetch('/api/parser/profiles', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser profiles');
  return res.json();
};

export const getParserVersions = async (token: string, profileId: string) => {
  const res = await fetch(`/api/parser/profiles/${profileId}/versions`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser versions');
  return res.json();
};

export const publishParserVersion = async (token: string, profileId: string, config: any, changeNote: string) => {
  const res = await fetch(`/api/parser/profiles/${profileId}/publish`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ config, changeNote }),
  });
  if (!res.ok) throw new Error('Failed to publish parser version');
  return res.json();
};

export const activateParserProfile = async (token: string, profileId: string) => {
  const res = await fetch(`/api/parser/profiles/${profileId}/activate`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to activate parser profile');
  return res.json();
};


export const saveParserFixture = async (token: string, fixture: any) => {
  const res = await fetch('/api/parser/fixtures', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(fixture),
  });
  if (!res.ok) throw new Error('Failed to save parser fixture');
  return res.json();
};

export const getParserFixtures = async (token: string) => {
  const res = await fetch('/api/parser/fixtures', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser fixtures');
  return res.json();
};

export const getParserLogs = async (token: string) => {
  const res = await fetch('/api/parser/logs', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to fetch parser logs');
  return res.json();
};

export const suggestParserRules = async (token: string, menuText: string, currentConfig: any, instructions?: string, currentResult?: any) => {
  const res = await fetch('/api/ai/suggest-rules', {
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
  const res = await fetch('/api/languages');
  if (!res.ok) throw new Error('Failed to fetch languages');
  return res.json() as Promise<{ static: { code: string, name: string }[], custom: { code: string, name: string }[] }>;
};

export const fetchLanguageData = async (code: string) => {
  const res = await fetch(`/api/languages/${code}`);
  if (!res.ok) throw new Error('Failed to fetch language data');
  return res.json();
};

export const importLanguage = async (token: string, code: string, name: string, translations: any) => {
  const res = await fetch('/api/languages/import', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ code, name, translations }),
  });
  if (!res.ok) throw new Error('Failed to import language');
  return res.json();
};

export const deleteLanguage = async (token: string, code: string) => {
  const res = await fetch(`/api/languages/${code}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error('Failed to delete language');
  return res.json();
};

// ─── Bulk Sync (Database Agnostic) ──────────────────────────────────────────
export const exportParserBundle = async (token: string) => {
  const res = await fetch('/api/parser/export-all', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to export parser bundle');
  return res.json();
};

export const importParserBundle = async (token: string, bundle: any) => {
  const res = await fetch('/api/parser/import-bundle', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(bundle),
  });
  if (!res.ok) throw new Error('Failed to import parser bundle');
  return res.json();
};

// ─── Full System Backup & Restore ───────────────────────────────────────────
export const exportSystemBackup = async (token: string) => {
  const res = await fetch('/api/system/backup', { headers: authHeaders(token) });
  if (!res.ok) throw new Error('Failed to export system backup');
  return res.json();
};

export const importSystemBackup = async (token: string, bundle: any) => {
  const res = await fetch('/api/system/restore', {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(bundle),
  });
  if (!res.ok) throw new Error('Failed to restore system');
  return res.json();
};

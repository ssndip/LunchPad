import { useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useWebSocket } from './useWebSocket';
import * as api from '../api';
import { Language } from '../translations';

export function useSyncState() {
  const s = useStore();

  const fetchCards = useCallback(async () => {
    if (!s.token) return;
    try {
      const cards = await api.fetchCards(s.token);
      s.setCards(cards);
    } catch (err) {
      console.error('Failed to fetch cards', err);
    }
  }, [s.token, s.setCards]);

  const fetchInitFallback = useCallback(async () => {
    try {
      const data = await api.fetchInitialState();
      if (data && data.menu) {
        s.setMenu(data.menu);
        s.setKioskOpen(data.kioskOpen ?? true);
        s.setGlobalAccess(data.globalAccess ?? true);
        s.setOrderButtonEnabled(data.orderButtonEnabled ?? true);
        s.setTestModeEnabled(data.testModeEnabled ?? false);
        s.setMenuVersion(data.menuVersion ?? 1);
        if (data.systemLanguage) s.setLang(data.systemLanguage as Language);
        s.setConnectionError(null);
      }
    } catch {
      // Keep existing error state
    }
  }, [s]);

  // WebSocket Handlers
  useWebSocket({
    onInitialState: (data: any) => {
      s.setMenu(data.menu);
      s.setKioskOpen(data.kioskOpen);
      s.setGlobalAccess(data.globalAccess);
      s.setPublicAccessCode(data.publicAccessCode || "");
      s.setOrderButtonEnabled(data.orderButtonEnabled);
      s.setTestModeEnabled(data.testModeEnabled);
      if (data.packagingFee !== undefined) s.setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) s.setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) s.setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) s.setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) s.setLang(data.systemLanguage);
      s.setMenuVersion(data.menuVersion);
      s.setConnectionError(null);
      s.setPublicAccessRequired(false);
    },
    onMenuUpdate: (data) => {
      s.setMenu(data.menu);
      s.setMenuVersion(data.menuVersion);
    },
    onStatusUpdate: (data: any) => {
      if (data.kioskOpen !== undefined) s.setKioskOpen(data.kioskOpen);
      if (data.orderButtonEnabled !== undefined) s.setOrderButtonEnabled(data.orderButtonEnabled);
      if (data.testModeEnabled !== undefined) s.setTestModeEnabled(data.testModeEnabled);
      if (data.globalAccess !== undefined) s.setGlobalAccess(data.globalAccess);
      if (data.publicAccessCode !== undefined) s.setPublicAccessCode(data.publicAccessCode);
      if (data.packagingFee !== undefined) s.setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) s.setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) s.setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) s.setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) s.setLang(data.systemLanguage);
    },
    onPWASettingsUpdate: (data: any) => {
      if (data.kioskModeEnabled !== undefined) s.setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) s.setAllowPWAInstall(data.allowPWAInstall);
    },
    onCardsUpdate: () => {
      if (s.token) fetchCards();
    },
    onConnectionError: (msg) => {
      if (msg === 'PUBLIC_ACCESS_REQUIRED') {
        s.setPublicAccessRequired(true);
        s.setConnectionError(null);
      } else {
        s.setConnectionError(msg);
      }
    },
  }, s.token || s.publicAccessToken);

  // Synchronize Manager Data
  useEffect(() => {
    if (s.isManagerLoggedIn && s.token) {
      fetchCards();
      api.fetchOrders(s.token).then(s.setOrders).catch(console.error);
      api.fetchSummaries(s.token).then(s.setSummaries).catch(console.error);
      api.fetchSettings(s.token).then((res) => {
        s.setGlobalAccess(res.globalAccess);
        s.setPublicAccessCode(res.publicAccessCode);
        s.setOrderButtonEnabled(res.orderButtonEnabled);
        s.setTestModeEnabled(res.testModeEnabled);
        if (res.packagingFee !== undefined) s.setPackagingFee(res.packagingFee);
        if (res.deliveryFee !== undefined) s.setDeliveryFee(res.deliveryFee);
        if (res.systemLanguage) s.setLang(res.systemLanguage);
      }).catch(console.error);
    }
  }, [s.isManagerLoggedIn, s.token, fetchCards, s.setOrders, s.setSummaries, s.setGlobalAccess, s.setPublicAccessCode, s.setOrderButtonEnabled, s.setTestModeEnabled, s.setLang, s.setPackagingFee, s.setDeliveryFee]);

  // Initialization & Fallbacks
  useEffect(() => {
    if (s.connectionError) fetchInitFallback();
  }, [s.connectionError, fetchInitFallback]);

  useEffect(() => {
    fetchInitFallback();
  }, [fetchInitFallback]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!s.isManagerLoggedIn) fetchInitFallback();
    }, 30000);
    return () => clearInterval(id);
  }, [s.isManagerLoggedIn, fetchInitFallback]);

  return { fetchCards, fetchInitFallback };
}

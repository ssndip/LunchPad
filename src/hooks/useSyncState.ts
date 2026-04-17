import { useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useWebSocket } from './useWebSocket';
import * as api from '../api';
import { Language } from '../translations';

export function useSyncState() {
  const token = useStore(s => s.token);
  const publicAccessToken = useStore(s => s.publicAccessToken);
  const isManagerLoggedIn = useStore(s => s.isManagerLoggedIn);
  const connectionError = useStore(s => s.connectionError);

  const setMenu = useStore(s => s.setMenu);
  const setCards = useStore(s => s.setCards);
  const setOrders = useStore(s => s.setOrders);
  const setSummaries = useStore(s => s.setSummaries);
  const setKioskOpen = useStore(s => s.setKioskOpen);
  const setGlobalAccess = useStore(s => s.setGlobalAccess);
  const setOrderButtonEnabled = useStore(s => s.setOrderButtonEnabled);
  const setTestModeEnabled = useStore(s => s.setTestModeEnabled);
  const setMenuVersion = useStore(s => s.setMenuVersion);
  const setLang = useStore(s => s.setLang);
  const setPackagingFee = useStore(s => s.setPackagingFee);
  const setDeliveryFee = useStore(s => s.setDeliveryFee);
  const setKioskModeEnabled = useStore(s => s.setKioskModeEnabled);
  const setAllowPWAInstall = useStore(s => s.setAllowPWAInstall);
  const setPublicAccessCode = useStore(s => s.setPublicAccessCode);
  const setConnectionError = useStore(s => s.setConnectionError);
  const setPublicAccessRequired = useStore(s => s.setPublicAccessRequired);

  const fetchCards = useCallback(async () => {
    if (!token) return;
    try {
      const cards = await api.fetchCards(token);
      setCards(cards);
    } catch (err) {
      console.error('Failed to fetch cards', err);
    }
  }, [token, setCards]);

  const fetchInitFallback = useCallback(async () => {
    try {
      const data = await api.fetchInitialState();
      if (data && data.menu) {
        setMenu(data.menu);
        setKioskOpen(data.kioskOpen ?? true);
        setGlobalAccess(data.globalAccess ?? true);
        setOrderButtonEnabled(data.orderButtonEnabled ?? true);
        setTestModeEnabled(data.testModeEnabled ?? false);
        setMenuVersion(data.menuVersion ?? 1);
        if (data.systemLanguage) setLang(data.systemLanguage as Language);
        setConnectionError(null);
      }
    } catch {
      // Keep existing error state
    }
  }, [setMenu, setKioskOpen, setGlobalAccess, setOrderButtonEnabled, setTestModeEnabled, setMenuVersion, setLang, setConnectionError]);

  // WebSocket Handlers
  useWebSocket({
    onInitialState: (data) => {
      setMenu(data.menu);
      setKioskOpen(data.kioskOpen);
      setGlobalAccess(data.globalAccess);
      setPublicAccessCode(data.publicAccessCode || "");
      setOrderButtonEnabled(data.orderButtonEnabled);
      setTestModeEnabled(data.testModeEnabled);
      if (data.packagingFee !== undefined) setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage as Language);
      if (data.cards) setCards(data.cards);
      if (data.orders) setOrders(data.orders);
      setMenuVersion(data.menuVersion);
      setConnectionError(null);
      setPublicAccessRequired(false);
    },
    onMenuUpdate: (data) => {
      setMenu(data.menu);
      setMenuVersion(data.menuVersion);
    },
    onStatusUpdate: (data: any) => {
      if (data.kioskOpen !== undefined) setKioskOpen(data.kioskOpen);
      if (data.orderButtonEnabled !== undefined) setOrderButtonEnabled(data.orderButtonEnabled);
      if (data.testModeEnabled !== undefined) setTestModeEnabled(data.testModeEnabled);
      if (data.globalAccess !== undefined) setGlobalAccess(data.globalAccess);
      if (data.publicAccessCode !== undefined) setPublicAccessCode(data.publicAccessCode);
      if (data.packagingFee !== undefined) setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage as Language);
    },
    onPWASettingsUpdate: (data: any) => {
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
    },
    onCardsUpdate: () => {
      if (token) fetchCards();
    },
    onConnectionError: (msg) => {
      if (msg === 'PUBLIC_ACCESS_REQUIRED') {
        setPublicAccessRequired(true);
        setConnectionError(null);
      } else {
        setConnectionError(msg);
      }
    },
  }, token || publicAccessToken);

  // Synchronize Manager Data
  useEffect(() => {
    if (isManagerLoggedIn && token) {
      fetchCards();
      api.fetchOrders(token).then(setOrders).catch(console.error);
      api.fetchSummaries(token).then(setSummaries).catch(console.error);
      api.fetchSettings(token).then((res) => {
        setGlobalAccess(res.globalAccess);
        setPublicAccessCode(res.publicAccessCode);
        setOrderButtonEnabled(res.orderButtonEnabled);
        setTestModeEnabled(res.testModeEnabled);
        if (res.packagingFee !== undefined) setPackagingFee(res.packagingFee);
        if (res.deliveryFee !== undefined) setDeliveryFee(res.deliveryFee);
        if (res.systemLanguage) setLang(res.systemLanguage as Language);
      }).catch(console.error);
    }
  }, [isManagerLoggedIn, token, fetchCards, setOrders, setSummaries, setGlobalAccess, setPublicAccessCode, setOrderButtonEnabled, setTestModeEnabled, setLang, setPackagingFee, setDeliveryFee]);

  // Initialization & Fallbacks
  useEffect(() => {
    if (connectionError) fetchInitFallback();
  }, [connectionError, fetchInitFallback]);

  useEffect(() => {
    fetchInitFallback();
  }, [fetchInitFallback]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!isManagerLoggedIn) fetchInitFallback();
    }, 30000);
    return () => clearInterval(id);
  }, [isManagerLoggedIn, fetchInitFallback]);

  return { fetchCards, fetchInitFallback };
}

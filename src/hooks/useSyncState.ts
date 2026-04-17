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
  const setMenuDate = useStore(s => s.setMenuDate);
  const setBgnEnabled = useStore(s => s.setBgnEnabled);

  const fetchCards = useCallback(async () => {
    if (!token) return;
    try {
      const cards = await api.fetchCards(token);
      setCards(cards);
    } catch (err) {
      console.error('Failed to fetch cards', err);
    }
  }, [token, setCards]);

  const fetchLanguages = useCallback(async () => {
    try {
      const data = await api.fetchLanguages();
      const allLangs = [...data.static, ...data.custom];
      useStore.getState().setAvailableLanguages(allLangs);
      
      // Also fetch dynamic translation data for each custom language to populate dynamicTranslations
      const dynamicData: Record<string, any> = {};
      await Promise.all(data.custom.map(async (l) => {
        try {
          const tData = await api.fetchLanguageData(l.code);
          dynamicData[l.code] = tData;
        } catch (e) {
          console.error(`Failed to load translations for ${l.code}`, e);
        }
      }));
      useStore.getState().setDynamicTranslations(dynamicData);
    } catch (err) {
      console.error('Failed to fetch languages', err);
    }
  }, []);

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
        if (data.systemLanguage) setLang(data.systemLanguage);
        if (data.menuDate) setMenuDate(data.menuDate);
        if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
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
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage);
      if (data.cards) setCards(data.cards);
      if (data.orders) setOrders(data.orders);
      if (data.menuDate) setMenuDate(data.menuDate);
      if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
      setMenuVersion(data.menuVersion);
      setConnectionError(null);
      setPublicAccessRequired(false);
      fetchLanguages();
    },
    onMenuUpdate: (data) => {
      setMenu(data.menu);
      setMenuVersion(data.menuVersion);
      if (data.menuDate) setMenuDate(data.menuDate);
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
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage);
      if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
    },
    onPWASettingsUpdate: (data: any) => {
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
    },
    onOrderUpdate: (orders) => {
      setOrders(orders);
    },
    onNewOrder: (order) => {
      // Instead of manual append, trigger a full fetch to be sure we have the latest
      if (token) api.fetchOrders(token).then(setOrders).catch(console.error);
    },
    onCardsUpdate: () => {
      if (token) fetchCards();
    },
    onLanguagesUpdated: () => {
      fetchLanguages();
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


  // Synchronize Manager Data — Batched for stability
  useEffect(() => {
    if (isManagerLoggedIn && token) {
      const loadManagerData = async () => {
        try {
          const [cards, orders, summaries, settings] = await Promise.all([
            api.fetchCards(token),
            api.fetchOrders(token),
            api.fetchSummaries(token),
            api.fetchSettings(token)
          ]);

          useStore.setState({
            cards,
            orders,
            summaries,
            globalAccess: settings.globalAccess,
            publicAccessCode: settings.publicAccessCode,
            orderButtonEnabled: settings.orderButtonEnabled,
            testModeEnabled: settings.testModeEnabled,
            packagingFee: settings.packagingFee !== undefined ? settings.packagingFee : 0.1,
            deliveryFee: settings.deliveryFee !== undefined ? settings.deliveryFee : 0,
            lang: settings.systemLanguage ? settings.systemLanguage as Language : useStore.getState().lang,
            menuDate: settings.menuDate || useStore.getState().menuDate,
            bgnEnabled: settings.bgnEnabled !== undefined ? settings.bgnEnabled : useStore.getState().bgnEnabled
          });
        } catch (err) {
          console.error('[Sync] Failed to load batched manager data', err);
        }
      };

      loadManagerData();
    }
  }, [isManagerLoggedIn, token]);

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

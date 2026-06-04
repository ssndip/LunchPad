import { useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { useWebSocket } from './useWebSocket';
import * as api from '../api';
import { Language } from '../translations';

export function useSyncState() {
  const token = useStore(s => s.token);
  const isManagerLoggedIn = useStore(s => s.isManagerLoggedIn);
  const connectionError = useStore(s => s.connectionError);

  const setMenu = useStore(s => s.setMenu);
  const setCards = useStore(s => s.setCards);
  const setOrders = useStore(s => s.setOrders);
  const setSummaries = useStore(s => s.setSummaries);
  const setKioskOpen = useStore(s => s.setKioskOpen);
  const setAdminWhitelistEnabled = useStore(s => s.setAdminWhitelistEnabled);
  const setOrderButtonEnabled = useStore(s => s.setOrderButtonEnabled);
  const setTestModeEnabled = useStore(s => s.setTestModeEnabled);
  const setMenuVersion = useStore(s => s.setMenuVersion);
  const setLang = useStore(s => s.setLang);
  const setPackagingFee = useStore(s => s.setPackagingFee);
  const setDeliveryFee = useStore(s => s.setDeliveryFee);
  const setKioskModeEnabled = useStore(s => s.setKioskModeEnabled);
  const setAllowPWAInstall = useStore(s => s.setAllowPWAInstall);
  const setConnectionError = useStore(s => s.setConnectionError);
  const setMenuDate = useStore(s => s.setMenuDate);
  const setBgnEnabled = useStore(s => s.setBgnEnabled);
  const setAdminWhitelist = useStore(s => s.setAdminWhitelist);
  const setAnnouncement = useStore(s => s.setAnnouncement);
  const setAiProvider = useStore(s => s.setAiProvider);
  const setAiApiKey = useStore(s => s.setAiApiKey);
  const setAiModel = useStore(s => s.setAiModel);
  const setAiEndpoint = useStore(s => s.setAiEndpoint);
  const setPreIdentificationEnabled = useStore(s => s.setPreIdentificationEnabled);
  const setKioskAutoTiming = useStore(s => s.setKioskAutoTiming);
  const setKioskOpenTime = useStore(s => s.setKioskOpenTime);
  const setKioskCloseTime = useStore(s => s.setKioskCloseTime);
  const setKioskCloseDay = useStore(s => s.setKioskCloseDay);

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
        setAdminWhitelistEnabled(data.adminWhitelistEnabled ?? true);
        setOrderButtonEnabled(data.orderButtonEnabled ?? true);
        setTestModeEnabled(data.testModeEnabled ?? false);
        setMenuVersion(data.menuVersion ?? 1);
        if (data.systemLanguage) setLang(data.systemLanguage);
        if (data.menuDate) setMenuDate(data.menuDate);
        if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
        if (data.adminWhitelist !== undefined) setAdminWhitelist(data.adminWhitelist);
        if (data.announcement !== undefined) setAnnouncement(data.announcement);
        if (data.aiProvider !== undefined) setAiProvider(data.aiProvider);
        if (data.aiApiKey !== undefined) setAiApiKey(data.aiApiKey);
        if (data.aiModel !== undefined) setAiModel(data.aiModel);
        if (data.aiEndpoint !== undefined) setAiEndpoint(data.aiEndpoint);
        if (data.preIdentificationEnabled !== undefined) setPreIdentificationEnabled(data.preIdentificationEnabled);
        if (data.kioskAutoTiming !== undefined) setKioskAutoTiming(data.kioskAutoTiming);
        if (data.kioskOpenTime !== undefined) setKioskOpenTime(data.kioskOpenTime);
        if (data.kioskCloseTime !== undefined) setKioskCloseTime(data.kioskCloseTime);
        if (data.kioskCloseDay !== undefined) setKioskCloseDay(data.kioskCloseDay);
        if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
        if (data.packagingFee !== undefined) setPackagingFee(data.packagingFee);
        setConnectionError(null);
        fetchLanguages();
      }
    } catch {
      // Keep existing error state
    }
  }, [setMenu, setKioskOpen, setAdminWhitelistEnabled, setOrderButtonEnabled, setTestModeEnabled, setMenuVersion, setLang, setConnectionError, setAiProvider, setAiApiKey, setAiModel, setAiEndpoint, setPreIdentificationEnabled, setKioskAutoTiming, setKioskOpenTime, setKioskCloseTime, setKioskCloseDay, setDeliveryFee, setPackagingFee, fetchLanguages]);

  // WebSocket Handlers
  useWebSocket({
    onInitialState: (data) => {
      setMenu(data.menu);
      setKioskOpen(data.kioskOpen);
      setAdminWhitelistEnabled(data.adminWhitelistEnabled);
      setOrderButtonEnabled(data.orderButtonEnabled);
      setTestModeEnabled(data.testModeEnabled);
      if (data.packagingFee !== undefined) setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage as Language);
      if (data.cards) setCards(data.cards);
      if (data.orders) setOrders(data.orders);
      if (data.menuDate) setMenuDate(data.menuDate);
      if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
      if (data.adminWhitelist !== undefined) setAdminWhitelist(data.adminWhitelist);
      if (data.announcement !== undefined) setAnnouncement(data.announcement);
      if (data.aiProvider !== undefined) setAiProvider(data.aiProvider);
      if (data.aiApiKey !== undefined) setAiApiKey(data.aiApiKey);
      if (data.aiModel !== undefined) setAiModel(data.aiModel);
      if (data.aiEndpoint !== undefined) setAiEndpoint(data.aiEndpoint);
      if (data.preIdentificationEnabled !== undefined) setPreIdentificationEnabled(data.preIdentificationEnabled);
      if (data.kioskAutoTiming !== undefined) setKioskAutoTiming(data.kioskAutoTiming);
      if (data.kioskOpenTime !== undefined) setKioskOpenTime(data.kioskOpenTime);
      if (data.kioskCloseTime !== undefined) setKioskCloseTime(data.kioskCloseTime);
      if (data.kioskCloseDay !== undefined) setKioskCloseDay(data.kioskCloseDay);
      setMenuVersion(data.menuVersion);
      setConnectionError(null);
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
      if (data.adminWhitelistEnabled !== undefined) setAdminWhitelistEnabled(data.adminWhitelistEnabled);
      if (data.packagingFee !== undefined) setPackagingFee(data.packagingFee);
      if (data.deliveryFee !== undefined) setDeliveryFee(data.deliveryFee);
      if (data.kioskModeEnabled !== undefined) setKioskModeEnabled(data.kioskModeEnabled);
      if (data.allowPWAInstall !== undefined) setAllowPWAInstall(data.allowPWAInstall);
      if (data.systemLanguage !== undefined) setLang(data.systemLanguage);
      if (data.bgnEnabled !== undefined) setBgnEnabled(data.bgnEnabled);
      if (data.adminWhitelist !== undefined) setAdminWhitelist(data.adminWhitelist);
      if (data.announcement !== undefined) setAnnouncement(data.announcement);
      if (data.aiProvider !== undefined) setAiProvider(data.aiProvider);
      if (data.aiApiKey !== undefined) setAiApiKey(data.aiApiKey);
      if (data.aiModel !== undefined) setAiModel(data.aiModel);
      if (data.aiEndpoint !== undefined) setAiEndpoint(data.aiEndpoint);
      if (data.preIdentificationEnabled !== undefined) setPreIdentificationEnabled(data.preIdentificationEnabled);
      if (data.kioskAutoTiming !== undefined) setKioskAutoTiming(data.kioskAutoTiming);
      if (data.kioskOpenTime !== undefined) setKioskOpenTime(data.kioskOpenTime);
      if (data.kioskCloseTime !== undefined) setKioskCloseTime(data.kioskCloseTime);
      if (data.kioskCloseDay !== undefined) setKioskCloseDay(data.kioskCloseDay);
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
      setConnectionError(msg);
    },
  }, token);


  // Synchronize Manager Data — Batched for stability
  useEffect(() => {
    if (isManagerLoggedIn && token) {
      const loadManagerData = async () => {
        useStore.getState().setIsSyncing(true);
        try {
          const [cards, orders, summaries, settings, languages] = await Promise.all([
            api.fetchCards(token),
            api.fetchOrders(token),
            api.fetchSummaries(token),
            api.fetchSettings(token),
            api.fetchLanguages()
          ]);

          useStore.setState({
            cards,
            orders,
            summaries,
            adminWhitelistEnabled: settings.adminWhitelistEnabled !== undefined ? settings.adminWhitelistEnabled : useStore.getState().adminWhitelistEnabled,
            orderButtonEnabled: settings.orderButtonEnabled,
            testModeEnabled: settings.testModeEnabled,
            packagingFee: settings.packagingFee !== undefined ? settings.packagingFee : 0.1,
            deliveryFee: settings.deliveryFee !== undefined ? settings.deliveryFee : 0,
            lang: settings.systemLanguage ? settings.systemLanguage as Language : useStore.getState().lang,
            menuDate: settings.menuDate || useStore.getState().menuDate,
            bgnEnabled: settings.bgnEnabled !== undefined ? settings.bgnEnabled : useStore.getState().bgnEnabled,
            adminWhitelist: settings.adminWhitelist || useStore.getState().adminWhitelist,
            announcement: settings.announcement !== undefined ? settings.announcement : useStore.getState().announcement,
            aiProvider: settings.aiProvider || useStore.getState().aiProvider,
            aiApiKey: settings.aiApiKey || useStore.getState().aiApiKey,
            aiModel: settings.aiModel !== undefined ? settings.aiModel : useStore.getState().aiModel,
            aiEndpoint: settings.aiEndpoint !== undefined ? settings.aiEndpoint : useStore.getState().aiEndpoint,
            preIdentificationEnabled: settings.preIdentificationEnabled !== undefined ? settings.preIdentificationEnabled : useStore.getState().preIdentificationEnabled,
            kioskAutoTiming: settings.kioskAutoTiming !== undefined ? settings.kioskAutoTiming : useStore.getState().kioskAutoTiming,
            kioskOpenTime: settings.kioskOpenTime || useStore.getState().kioskOpenTime,
            kioskCloseTime: settings.kioskCloseTime || useStore.getState().kioskCloseTime,
            kioskCloseDay: settings.kioskCloseDay !== undefined ? settings.kioskCloseDay : useStore.getState().kioskCloseDay,
            customCategories: settings.customCategories || useStore.getState().customCategories
          });
          
          const allLangs = [...languages.static, ...languages.custom];
          useStore.getState().setAvailableLanguages(allLangs);
        } catch (err) {
          console.error('[Sync] Failed to load batched manager data', err);
        } finally {
          useStore.getState().setIsSyncing(false);
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

  // Offline Synchronization Queue Logic
  const offlineQueue = useStore(s => s.offlineQueue);
  const setOfflineQueue = useStore(s => s.setOfflineQueue);

  const syncOfflineQueue = useCallback(async () => {
    if (offlineQueue.length === 0) return;
    console.log(`[Offline Sync] Syncing ${offlineQueue.length} offline orders...`);
    
    let currentQueue = [...offlineQueue];
    let hasChanges = false;

    for (const order of offlineQueue) {
      try {
        const res = await api.placeOrder(order.rfid, order.items, order.menuVersion, order.pin);
        if (res.ok || res.status < 500) {
          currentQueue = currentQueue.filter(item => item.tempId !== order.tempId);
          hasChanges = true;
          console.log(`[Offline Sync] Order ${order.tempId} processed by server (status ${res.status}). Removed from queue.`);
        } else {
          console.warn(`[Offline Sync] Server error ${res.status} during order sync. Stopping sync.`);
          break;
        }
      } catch (err) {
        console.log('[Offline Sync] Connection still offline. Stopping sync.', err);
        break;
      }
    }

    if (hasChanges) {
      setOfflineQueue(currentQueue);
    }
  }, [offlineQueue, setOfflineQueue]);

  // Sync when online event is triggered
  useEffect(() => {
    const handleOnline = () => {
      syncOfflineQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [syncOfflineQueue]);

  // Sync when connection is restored (connectionError is null) or WebSocket is connected
  useEffect(() => {
    if (connectionError === null && offlineQueue.length > 0) {
      syncOfflineQueue();
    }
  }, [connectionError, offlineQueue.length, syncOfflineQueue]);

  // Periodically check/sync every 15s in the background
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (offlineQueue.length > 0 && navigator.onLine) {
        syncOfflineQueue();
      }
    }, 15000);
    return () => clearInterval(intervalId);
  }, [offlineQueue.length, syncOfflineQueue]);

  return { fetchCards, fetchInitFallback, fetchLanguages };
}

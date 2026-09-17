import React, { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Smartphone, X, Info } from 'lucide-react';
import { useStore } from './store/useStore';
import { 
  useGroupedMenu, 
  useSideItems, 
  useTotalPrice, 
  useSelectedItemIds, 
  useComputedKioskOpen 
} from './store/selectors';
import { useWebSocket } from './hooks/useWebSocket';
import { translations, Language } from './translations';
import * as api from './api';
import { MenuItem, Card, CartItem } from './types';
import { usePWA } from './hooks/usePWA';
import { APP_VERSION } from './version';

// Components
import { KioskView } from './components/kiosk/KioskView';
import { KioskClosed } from './components/kiosk/KioskView';
import { PublicAccessCodeEntry } from './components/kiosk/PublicAccessCodeEntry';
import { ManagerLogin } from './components/manager/ManagerLogin';
import { ManagerDashboard } from './components/manager/ManagerDashboard';

import { ConfirmModal } from './components/shared/ConfirmModal';
import { PwaInstallBanner } from './components/shared/PwaInstallBanner';
import { PullToRefresh } from './components/shared/PullToRefresh';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

// Tabs
// Loaded on demand: these are manager-only and pull in the heaviest dependencies
// in the app (xlsx via CardsTab, recharts via AnalyticsTab). Keeping them out of
// the entry chunk means kiosk clients never download the dashboard at all.
const MenuTab = lazy(() => import('./components/manager/tabs/MenuTab').then(m => ({ default: m.MenuTab })));
const OrdersTab = lazy(() => import('./components/manager/tabs/OrdersTab').then(m => ({ default: m.OrdersTab })));
const HistoryTab = lazy(() => import('./components/manager/tabs/HistoryTab').then(m => ({ default: m.HistoryTab })));
const CardsTab = lazy(() => import('./components/manager/tabs/CardsTab').then(m => ({ default: m.CardsTab })));
const SettingsTab = lazy(() => import('./components/manager/tabs/SettingsTab').then(m => ({ default: m.SettingsTab })));
const ParserRulesTab = lazy(() => import('./components/manager/tabs/ParserRulesTab').then(m => ({ default: m.ParserRulesTab })));
const AnalyticsTab = lazy(() => import('./components/manager/tabs/AnalyticsTab').then(m => ({ default: m.AnalyticsTab })));

// Small and dependency-light, so it stays in the main chunk: it renders inside an
// AnimatePresence, where an extra Suspense boundary would break exit animations.
import { HistoryReport } from './components/manager/tabs/HistoryReport';

import { useTranslation } from './hooks/useTranslation';
import { useSyncState } from './hooks/useSyncState';
import { newClientOrderId } from './utils/orderId';

/** The tabs the dashboard can render. */
const MANAGER_TABS = ['menu', 'orders', 'history', 'cards', 'settings', 'analytics', 'parser_rules'] as const;
type ManagerTab = (typeof MANAGER_TABS)[number];

/** Falls back to 'menu' for anything the dashboard cannot render. */
const normalizeTab = (value: string | null): ManagerTab =>
  MANAGER_TABS.includes(value as ManagerTab) ? (value as ManagerTab) : 'menu';

/**
 * Copy that also works off a secure origin.
 *
 * The dashboard is normally reached over plain HTTP on the LAN, which is not a
 * secure context, so `navigator.clipboard` is undefined there and Copy Summary
 * threw instead of copying. Falls back to a hidden textarea + execCommand.
 */
const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
};

/** Shown in the dashboard content area while a lazily-loaded tab chunk arrives. */
const TabLoadingFallback = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
    <div className="w-8 h-8 border-2 border-neutral-600 border-t-transparent rounded-full animate-spin" />
    <span className="sr-only">Loading…</span>
  </div>
);


export default function App() {
  const s = useStore();
  const { t } = useTranslation();
  const { fetchInitFallback, fetchCards, fetchLanguages } = useSyncState();
  
  // Selectors
  const groupedMenu = useGroupedMenu();
  const sideItems = useSideItems();
  const totalPrice = useTotalPrice();
  const selectedItemIds = useSelectedItemIds();
  const computedKioskOpen = useComputedKioskOpen();
  const { installApp, deferredPrompt, isIOS } = usePWA();

  const [confirmConfig, setConfirmConfig] = React.useState<any | null>(null);
  const [showPWAInstructions, setShowPWAInstructions] = useState(false);
  /** True when the server capped the history result, so the tab can say so. */
  const [historyTruncated, setHistoryTruncated] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  /** Surfaces a failed admin action instead of swallowing it into the console. */
  const reportFailure = React.useCallback((err: any, fallback: string) => {
    setConfirmConfig({
      title: t('menu.Error'),
      message: err?.message || fallback,
      isDestructive: true,
      confirmText: t('menu.OK'),
      onConfirm: () => {},
    });
  }, [t]);

  /**
   * Runs a history query and records whether the server capped the result.
   *
   * The History tab's summary bar (total spent, average, unique users) is
   * computed from the rows it holds, so a silently truncated result produced
   * confident, wrong figures. `historyTruncated` lets the tab say the numbers
   * cover only what is shown.
   */
  const runHistoryQuery = React.useCallback(async (filters?: Record<string, string>) => {
    const token = useStore.getState().token;
    if (!token) return;
    const activeFilters = filters ?? useStore.getState().historyFilters;
    setHistoryLoading(true);
    try {
      const results = await api.fetchHistory(token, activeFilters);
      useStore.getState().setHistory(results);
      setHistoryTruncated(results.length >= api.HISTORY_LIMIT);
    } catch (err: any) {
      reportFailure(err, t('menu.no_history'));
    } finally {
      setHistoryLoading(false);
    }
  }, [reportFailure, t]);

// Tear the session down when the server stops accepting our token, instead of
  // leaving a dashboard that looks logged in and silently renders nothing.
  useEffect(() => {
    api.setAuthFailureHandler(() => useStore.getState().expireSession());
    return () => api.setAuthFailureHandler(null);
  }, []);

// Sync mode with URL view param
  useEffect(() => {
    const handleUrlChange = () => {
      const search = new URLSearchParams(window.location.search);
      const isManager = search.get('view') === 'manager';
      // An unknown ?tab= used to be written to the store verbatim, which left
      // the dashboard with no tab highlighted and an empty content area.
      const currentTab = normalizeTab(search.get('tab'));

      useStore.setState({ 
        mode: isManager ? 'manager' : 'kiosk', 
        activeTab: currentTab 
      });
    };
    window.addEventListener('popstate', handleUrlChange);
    handleUrlChange();
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [s.setMode]);

  // Reset modals on tab/mode change
  useEffect(() => {
    setConfirmConfig(null);
    setShowPWAInstructions(false);
    
    // Feature: Force refresh cards when entering card management
    if (s.mode === 'manager' && s.activeTab === 'cards') {
      fetchCards();
    }
    if (s.mode === 'manager' && s.activeTab === 'history') {
      runHistoryQuery();
    }
  }, [s.mode, s.activeTab, fetchCards, runHistoryQuery]);

  // Cache active RFIDs for offline card validation
  useEffect(() => {
    const fetchActiveRfids = async () => {
      try {
        const res = await fetch('/api/cards/active-list');
        if (res.ok) {
          const rfids = await res.json();
          localStorage.setItem('lunchpad_valid_rfids', JSON.stringify(rfids));
        }
      } catch (err) {
        console.error('Failed to cache active RFIDs:', err);
      }
    };
    if (navigator.onLine) {
      fetchActiveRfids();
    }
  }, [s.connectionError]);


  // ─── Kiosk Handlers ────────────────────────────────────────────────────────
  const handleToggleItem = React.useCallback((item: MenuItem) => {
    const isSelected = selectedItemIds.has(item.id);
    if (isSelected) {
      s.setSelectedItems(s.selectedItems.filter((i) => i.id !== item.id));
    } else {
      let side: string | undefined = item.selectedSide;
      const cartItem: CartItem = { ...item, side, quantity: 1 };
      s.setSelectedItems([...s.selectedItems, cartItem]);
    }
  }, [selectedItemIds, s.selectedItems, s.setSelectedItems]);

  const handleAddWithSide = React.useCallback((item: MenuItem, side?: string) => {
    const isSelected = selectedItemIds.has(item.id);
    if (isSelected) {
      // Update existing
      s.setSelectedItems(s.selectedItems.map((i) => 
        i.id === item.id ? { ...i, side } : i
      ));
    } else {
      // Add new
      const cartItem: CartItem = { ...item, side, quantity: 1 };
      s.setSelectedItems([...s.selectedItems, cartItem]);
    }
  }, [selectedItemIds, s.selectedItems, s.setSelectedItems]);

  const handleOrder = React.useCallback(async (rfidOverride?: string, pinOverride?: string) => {
    // Determine the final identification to use
    // If pinOverride is provided, we send rfid=null to trigger PIN lookup
    const finalRfid = pinOverride ? null : (rfidOverride || s.rfid);
    const finalPin = pinOverride;

    if (!finalRfid && !finalPin && !s.testModeEnabled) return;

    // Feature 7: Validation - Ensure mandatory sides are selected
    const missingSides = s.selectedItems.filter(i => (i.requiresSideChoice || i.hasIncludedSide) && !i.side);
    if (missingSides.length > 0) {
      s.setError(t('kiosk.choose_side') + ": " + missingSides[0].name);
      return;
    }

    s.setIsScanning(true);
    s.setError(null);

    // Map CartItems to simple ID+Side objects for the API, duplicating by quantity
    const items = s.selectedItems.flatMap((i) => 
      Array(i.quantity).fill({ id: i.id, side: i.side })
    );

    // One id for this attempt, reused if it ends up queued and replayed. A
    // response lost after the server committed is indistinguishable from a
    // failure here, so without it the retry charged the customer a second time.
    const clientOrderId = newClientOrderId();

    try {
      const res = await api.placeOrder(finalRfid, items, s.menuVersion, finalPin, clientOrderId);

      if (!res.ok) {
        if (res.status === 409) {
          const err = await res.json();
          s.setError(t('modals.menu_updated') || err.message);
          return;
        }
        if (res.status >= 500) {
          s.addToOfflineQueue({
            rfid: finalRfid,
            items,
            menuVersion: s.menuVersion,
            pin: finalPin || undefined,
            clientOrderId
          });
          s.setSuccessMessage(t('kiosk.order_queued_offline') || 'Order queued offline! It will sync once connection is restored.');
          s.setShowSuccess(true);
          s.resetCart();
          s.setRfid('');
          setTimeout(() => {
            s.setShowSuccess(false);
            s.setSuccessMessage(null);
          }, 3000);
          return;
        }
        const err = await res.json();
        s.setError(err.error || t('menu.order_failed'));
      } else {
        s.setSuccessMessage(null);
        s.setShowSuccess(true);
        s.resetCart();
        s.setRfid('');
        setTimeout(() => s.setShowSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Order error:', err);
      s.addToOfflineQueue({
        rfid: finalRfid,
        items,
        menuVersion: s.menuVersion,
        pin: finalPin || undefined,
        clientOrderId
      });
      s.setSuccessMessage(t('kiosk.order_queued_offline') || 'Order queued offline! It will sync once connection is restored.');
      s.setShowSuccess(true);
      s.resetCart();
      s.setRfid('');
      setTimeout(() => {
        s.setShowSuccess(false);
        s.setSuccessMessage(null);
      }, 3000);
    } finally {
      s.setIsScanning(false);
    }
  }, [s.rfid, s.testModeEnabled, s.selectedItems, s.menuVersion, s.setError, s.setIsScanning, s.setShowSuccess, s.resetCart, s.setRfid, s.addToOfflineQueue, s.setSuccessMessage, t]);

  const handleIdentify = React.useCallback((rfid: string) => {
    s.setRfid(rfid);
    s.resetCart();
  }, [s.setRfid, s.resetCart]);

  const handleGoToManager = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'manager');
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  // ─── Manager Handlers ──────────────────────────────────────────────────────
  const handleApplyMenu = async (items: MenuItem[], date?: string) => {
    if (!s.token) return;
    try {
      s.setMenu(items);
      if (date) s.setMenuDate(date);
      await api.updateMenu(s.token, items, date);
    } catch {
      setConfirmConfig({
        title: t('menu.Error'),
        message: t('menu.failed_update'),
        confirmText: t('menu.OK'),
        onConfirm: () => {}
      });
    }
  };

  const handleRemoveMenuItem = (id: number) => {
    const updated = s.menu.filter((item) => item.id !== id);
    handleApplyMenu(updated);
  };

  const handleUpdateMenuItem = (id: number, field: keyof MenuItem, value: any) => {
    const updated = s.menu.map((item) =>
      item.id === id ? { ...item, [field]: value } : item
    );
    s.setMenu(updated);
    handleApplyMenu(updated);
  };

  const handleUpdateSettings = async (whitelistEnabled: boolean, orderBtn: boolean, test?: boolean, kiosk?: boolean, allowPwa?: boolean, systemLang?: string, bgn?: boolean, whitelist?: string, announcement?: string, aiProvider?: string, aiApiKey?: string, preIdent?: boolean, customCategories?: import('./types').CustomCategory[], aiModel?: string, aiEndpoint?: string, kioskAutoTiming?: boolean, kioskOpenTime?: string, kioskCloseTime?: string, kioskCloseDay?: number, publicAccessReq?: boolean, publicAccessCode?: string, globalAccess?: boolean) => {
    if (!s.token) return;
    try {
      const update = {
        adminWhitelistEnabled: whitelistEnabled,
        orderButtonEnabled: orderBtn,
        testModeEnabled: test ?? s.testModeEnabled,
        kioskModeEnabled: kiosk ?? s.kioskModeEnabled,
        allowPWAInstall: allowPwa ?? s.allowPWAInstall,
        systemLanguage: systemLang,
        bgnEnabled: bgn ?? s.bgnEnabled,
        adminWhitelist: whitelist ?? s.adminWhitelist,
        announcement: announcement ?? s.announcement,
        aiProvider: aiProvider ?? s.aiProvider,
        aiApiKey: aiApiKey ?? s.aiApiKey,
        aiModel: aiModel ?? s.aiModel,
        aiEndpoint: aiEndpoint ?? s.aiEndpoint,
        preIdentificationEnabled: preIdent ?? s.preIdentificationEnabled,
        customCategories: customCategories ?? s.customCategories,
        kioskAutoTiming: kioskAutoTiming ?? s.kioskAutoTiming,
        kioskOpenTime: kioskOpenTime ?? s.kioskOpenTime,
        kioskCloseTime: kioskCloseTime ?? s.kioskCloseTime,
        kioskCloseDay: kioskCloseDay ?? s.kioskCloseDay,
        publicAccessRequired: publicAccessReq ?? s.publicAccessRequired,
        publicAccessCode: publicAccessCode !== undefined ? publicAccessCode : s.publicAccessCode,
        globalAccess: globalAccess ?? s.globalAccess
      };
      await api.updateSettings(s.token, update);
      s.setAdminWhitelistEnabled(whitelistEnabled);
      s.setOrderButtonEnabled(orderBtn);
      if (test !== undefined) s.setTestModeEnabled(test);
      if (kiosk !== undefined) s.setKioskModeEnabled(kiosk);
      if (allowPwa !== undefined) s.setAllowPWAInstall(allowPwa);
      if (systemLang) s.setLang(systemLang as Language);
      if (bgn !== undefined) s.setBgnEnabled(bgn);
      if (whitelist !== undefined) s.setAdminWhitelist(whitelist);
      if (announcement !== undefined) s.setAnnouncement(announcement);
      if (aiProvider !== undefined) s.setAiProvider(aiProvider);
      if (aiApiKey !== undefined) s.setAiApiKey(aiApiKey);
      if (aiModel !== undefined) s.setAiModel(aiModel);
      if (aiEndpoint !== undefined) s.setAiEndpoint(aiEndpoint);
      if (preIdent !== undefined) s.setPreIdentificationEnabled(preIdent);
      if (kioskAutoTiming !== undefined) s.setKioskAutoTiming(kioskAutoTiming);
      if (kioskOpenTime !== undefined) s.setKioskOpenTime(kioskOpenTime);
      if (kioskCloseTime !== undefined) s.setKioskCloseTime(kioskCloseTime);
      if (kioskCloseDay !== undefined) s.setKioskCloseDay(kioskCloseDay);
      if (publicAccessReq !== undefined) s.setPublicAccessRequired(publicAccessReq);
      if (publicAccessCode !== undefined) s.setPublicAccessCode(publicAccessCode);
      if (globalAccess !== undefined) s.setGlobalAccess(globalAccess);
      if (customCategories !== undefined) {
        s.setCustomCategories(customCategories);
      }
    } catch {
      setConfirmConfig({
        title: t('menu.Error'),
        message: t('settings.failed_update'),
        confirmText: t('menu.OK'),
        onConfirm: () => {}
      });
    }
  };

  const handleToggleKioskManual = async (open: boolean) => {
    if (!s.token) return;
    try {
      await api.toggleKioskStatus(s.token, open);
      s.setKioskOpen(open);
    } catch {
      setConfirmConfig({
        title: t('menu.Error'),
        message: t('settings.failed_kiosk_toggle'),
        confirmText: t('menu.OK'),
        onConfirm: () => {}
      });
    }
  };

  const handleUnlock = async (code: string) => {
    try {
      const res = await api.unlock(code);
      if (res.success) {
        // Recorded against this browser session, not by clearing
        // `publicAccessRequired` — that field mirrors the server setting and is
        // rewritten by the 30s /api/init poll and by every WebSocket
        // INITIAL_STATE, which used to re-lock the kiosk mid-order.
        s.setPublicAccessUnlocked(true);
      } else {
        throw new Error(res.error || t('settings.invalid_code'));
      }
    } catch (err: any) {
      throw err;
    }
  };



  // ─── Render Logic ──────────────────────────────────────────────────────────
  if (s.publicAccessRequired && !s.publicAccessUnlocked) {
    return (
      <div className="relative">
        <PublicAccessCodeEntry onUnlock={handleUnlock} />
        <div className="fixed inset-safe-bottom left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
      </div>
    );
  }

  if (s.mode === 'manager') {
    if (!s.isManagerLoggedIn) {
      return (
        <div key="manager-login-view" className="relative">
          <ManagerLogin
            onLogin={(pin) => s.loginManager(pin)}
            onBack={() => { window.location.href = window.location.origin + '/'; }}
          />
          <div className="fixed inset-safe-bottom left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
        </div>
      );
    }

    return (
      <div key="manager-dashboard-view" className="min-h-screen bg-neutral-900 relative">
        <ManagerDashboard
          activeTab={s.activeTab}
          onTabChange={s.setActiveTab}
          onLogout={s.logoutManager}
          kioskOpen={s.kioskOpen}
          onToggleKiosk={handleToggleKioskManual}
        >
          {/* Boundary sits inside the dashboard chrome so switching tabs shows a
              spinner in the content area only, not a full-page flash. */}
          <ErrorBoundary inline resetKey={s.activeTab}>
          <Suspense fallback={<TabLoadingFallback />}>
          {s.activeTab === 'menu' && (
            <MenuTab
              editingMenu={s.menu}
              onAddItem={async () => {
                const newId = Math.max(0, ...s.menu.map((i) => i.id)) + 1;
                const newItem: MenuItem = {
                  id: newId,
                  name: t('menu.new_item'),
                  basePrice: 0,
                  price: 0,
                  available: true,
                  category: 'Uncategorized',
                  tags: [],
                  extraFees: [],
                };
                
                // Optimistically update local state first
                const updatedMenu = [...s.menu, newItem];
                s.setMenu(updatedMenu);
                
                // Set as editing immediately to provide feedback
                s.setEditingMenu(updatedMenu);
                
                // Persist to server in background
                try {
                  if (s.token) await api.updateMenu(s.token, updatedMenu);
                } catch (error: any) {
                  // Roll the optimistic insert back. It used to stay on screen
                  // with the failure only in the console, so the item looked
                  // saved and quietly vanished on the next refresh.
                  s.setMenu(s.menu);
                  s.setEditingMenu(s.menu);
                  reportFailure(error, t('settings.failed_update'));
                }
              }}
              onUpdateItem={handleUpdateMenuItem}
              onRemoveItem={handleRemoveMenuItem}
              onDeleteAll={() => handleApplyMenu([])}
              onApplyMenu={handleApplyMenu}
              confirm={setConfirmConfig}
            />
          )}
          {s.activeTab === 'orders' && (
            <OrdersTab
              summaries={s.summaries}
              expandedDate={s.expandedDate}
              dailyDetails={s.dailyDetails}
              dailySides={s.dailySides}
              confirm={setConfirmConfig}
              onExpandDate={async (date) => {
                if (s.expandedDate === date) {
                  s.setExpandedDate(null);
                  return;
                }
                s.setExpandedDate(date);
                // Cleared before the fetch, not after: the previously expanded
                // date's rows used to stay on screen under the new date's
                // heading for the length of the request.
                s.setDailyDetails([]);
                s.setDailySides([]);
                if (!s.token) return;
                try {
                  const details = await api.fetchDailySummaryDetails(s.token, date);
                  s.setDailyDetails(details.items || []);
                  s.setDailySides(details.sides || []);
                } catch (err: any) {
                  setConfirmConfig({
                    title: t('menu.Error'),
                    message: err?.message || t('orders.load_details_failed'),
                    confirmText: t('menu.OK'),
                    onConfirm: () => {},
                  });
                }
              }}
              onCopySummary={(date, total) => {
                let text = `SUMMARY FOR ${date}\n`;
                text += `TOTAL REVENUE: €${(Number(total) || 0).toFixed(2)}\n`;
                text += `─────────────────────────\n\n`;
                
                s.dailyDetails.forEach(d => {
                  text += `• ${d.name} x${d.quantity}\n`;
                });
                
                text += `\n─────────────────────────`;
                
                copyText(text).then((ok) => {
                  setConfirmConfig({
                    title: t('navigation.order_summary'),
                    message: ok ? t('navigation.copy_success') : t('navigation.copy_failed'),
                    confirmText: t('menu.OK'),
                    onConfirm: () => {}
                  });
                });
              }}
            />
          )}
          {s.activeTab === 'history' && (
            <HistoryTab
              history={s.history}
              truncated={historyTruncated}
              loading={historyLoading}
              filters={s.historyFilters}
              onFilterChange={(k, v) => s.setHistoryFilters({ ...s.historyFilters, [k]: v })}
              onApplyFilters={runHistoryQuery}
            />
          )}
          {s.activeTab === 'cards' && (
            <CardsTab
              cards={s.cards}
              confirm={setConfirmConfig}
              onUpdateSingleCard={async (rfid, updatedCard) => {
                if (s.token) {
                  try {
                    const res = await api.updateCard(s.token, rfid, updatedCard);
                    const data = await res.json();
                    
                    if (!res.ok) {
                      if (res.status === 409) {
                        setConfirmConfig({
                          title: t('menu.Error'),
                          message: data.error || t('cards.conflict'),
                          isDestructive: true,
                          confirmText: t('menu.OK'),
                          onConfirm: () => {}
                        });
                        return false;
                      }
                      throw new Error(data.error);
                    }
                    
                    // Update successfully - fetch cards to be sure
                    fetchCards();
                    return true;
                  } catch (err: any) {
                    setConfirmConfig({
                      title: t('menu.Error'),
                      message: err?.message || t('cards.update_failed'),
                      isDestructive: true,
                      confirmText: t('menu.OK'),
                      onConfirm: () => {}
                    });
                    return false;
                  }
                }
                return false;
              }}
              onRemoveCard={async (rfid) => {
                if (s.token) {
                  setConfirmConfig({
                    title: t('modals.remove_item'),
                    message: t('modals.delete_warning'),
                    isDestructive: true,
                    onConfirm: async () => {
                      try {
                        await api.deleteCard(s.token!, rfid);
                      } catch (err: any) {
                        reportFailure(err, t('cards.delete_failed'));
                      }
                      fetchCards();
                    }
                  });
                }
              }}
              onResetCardBalance={async (rfid) => {
                if (!s.token) return;
                try {
                  await api.resetCardBalance(s.token, rfid);
                } catch (err: any) {
                  reportFailure(err, t('cards.reset_failed'));
                }
                fetchCards();
              }}
              onResetAllBalances={async () => {
                if (s.token) {
                  setConfirmConfig({
                    title: 'Reset Balances',
                    message: t('modals.reset_warning'),
                    isDestructive: true,
                    onConfirm: async () => {
                      try {
                        await api.resetAllBalances(s.token!);
                      } catch (err: any) {
                        reportFailure(err, t('cards.reset_failed'));
                      }
                      fetchCards();
                    }
                  });
                }
              }}
              onAddManualCard={async () => {
                if (s.token && s.newCardRfid && s.newCardOwner) {
                  const res = await api.addCard(s.token, {
                    rfid: s.newCardRfid,
                    ownerName: s.newCardOwner,
                    balance: 0,
                    isAdmin: s.newCardIsAdmin,
                    pin: s.newCardPin,
                  });
                  
                  if (!res.ok) {
                    // Every failure stops here. Only 409 used to, so a 400 or a
                    // 500 fell through to clearing the form — the universal
                    // "saved" signal — with no card created.
                    setConfirmConfig({
                      title: t('menu.Error'),
                      message: await api.errorFrom(res, t('cards.add_failed')),
                      isDestructive: true,
                      confirmText: t('menu.OK'),
                      onConfirm: () => {}
                    });
                    return;
                  }

                  s.setNewCardRfid('');
                  s.setNewCardOwner('');
                  s.setNewCardIsAdmin(false);
                  s.setNewCardPin('');
                  fetchCards();
                }
              }}
              onBatchAddCards={async (data?: Card[]) => {
                if (s.token) {
                  let cardsToBatch: any[] = [];
                  if (data) {
                    cardsToBatch = data;
                  } else if (s.pasteCardsText) {
                    const lines = s.pasteCardsText.split('\n');
                    cardsToBatch = lines.map(line => {
                      // Support both comma-separated and space-separated for flexibility
                      const parts = line.includes(',') ? line.split(',') : line.trim().split(/\s+/);
                      const [rfid, ownerName, pin] = parts.map(part => part?.trim());
                      if (!rfid) return null;
                      return { 
                        rfid, 
                        ownerName: ownerName || 'User', 
                        balance: 0, 
                        isAdmin: false, 
                        pin: pin || undefined 
                      };
                    }).filter(Boolean);
                  }
                  
                  if (cardsToBatch.length > 0) {
                    try {
                      await api.batchAddCards(s.token, cardsToBatch);
                    } catch (err: any) {
                      // Previously an unhandled rejection: the modal simply
                      // stayed open with no indication of what went wrong.
                      reportFailure(err, t('cards.import_error'));
                      return;
                    }
                    s.setIsPasteCardsModalOpen(false);
                    s.setPasteCardsText('');
                    fetchCards();
                  }
                }
              }}
              newCardRfid={s.newCardRfid}
              setNewCardRfid={s.setNewCardRfid}
              newCardOwner={s.newCardOwner}
              setNewCardOwner={s.setNewCardOwner}
              newCardIsAdmin={s.newCardIsAdmin}
              setNewCardIsAdmin={s.setNewCardIsAdmin}
              newCardPin={s.newCardPin}
              setNewCardPin={s.setNewCardPin}
              lastScanned={s.lastScanned}
              isScanning={s.isScanningForCard}
              setIsScanning={s.setIsScanningForCard}
              pasteCardsText={s.pasteCardsText}
              setPasteCardsText={s.setPasteCardsText}
              isPasteCardsModalOpen={s.isPasteCardsModalOpen}
              setIsPasteCardsModalOpen={s.setIsPasteCardsModalOpen}
              onViewStats={(rfid) => {
                const newFilters = { ...s.historyFilters, rfid };
                s.setHistoryFilters(newFilters);
                s.setActiveTab('history');
                runHistoryQuery(newFilters);
              }}
            />
          )}
          {s.activeTab === 'settings' && (
            <SettingsTab
              adminWhitelistEnabled={s.adminWhitelistEnabled}
              orderButtonEnabled={s.orderButtonEnabled}
              testModeEnabled={s.testModeEnabled}
              newPin={s.newPin}
              setNewPin={s.setNewPin}
              confirmPin={s.confirmPin}
              setConfirmPin={s.setConfirmPin}
              pinUpdateStatus={s.pinUpdateStatus}
              preIdentificationEnabled={s.preIdentificationEnabled}
              kioskAutoTiming={s.kioskAutoTiming}
              kioskOpenTime={s.kioskOpenTime}
              kioskCloseTime={s.kioskCloseTime}
              kioskCloseDay={s.kioskCloseDay}
              publicAccessRequired={s.publicAccessRequired}
              publicAccessCode={s.publicAccessCode}
              globalAccess={s.globalAccess}
              onUpdateSettings={(whitelistEnabled, ord, tst, kiosk, pwaSettings, systemLang, bgn, whitelist, ann, aiP, aiK, preI, customCats, aiM, aiE, kAuto, kOpen, kClose, kDay, pubAccessReq, pubAccessCode, glbAcc) => {
                handleUpdateSettings(whitelistEnabled, ord, tst, kiosk, pwaSettings, systemLang, bgn, whitelist, ann, aiP, aiK, preI, customCats, aiM, aiE, kAuto, kOpen, kClose, kDay, pubAccessReq, pubAccessCode, glbAcc);
              }}
              kioskModeEnabled={s.kioskModeEnabled}
              allowPWAInstall={s.allowPWAInstall}
              bgnEnabled={s.bgnEnabled}
              customCategories={s.customCategories}
              adminWhitelist={s.adminWhitelist}
              announcement={s.announcement}
              aiProvider={s.aiProvider}
              aiApiKey={s.aiApiKey}
              aiModel={s.aiModel}
              aiEndpoint={s.aiEndpoint}
              availableLanguages={s.availableLanguages}
              confirm={setConfirmConfig}
              onImportLanguage={async (code, name, data) => {
                if (s.token) {
                  try {
                    await api.importLanguage(s.token, code, name, data);
                    fetchLanguages();
                  } catch (err: any) {
                    setConfirmConfig({
                      title: t('menu.Error'),
                      message: err.message || 'Failed to import language.',
                      confirmText: t('menu.OK'),
                      onConfirm: () => {}
                    });
                  }
                }
              }}
              onDeleteLanguage={async (code) => {
                if (s.token) {
                  try {
                    await api.deleteLanguage(s.token, code);
                    fetchLanguages();
                  } catch (err: any) {
                    setConfirmConfig({
                      title: t('menu.Error'),
                      message: err.message || 'Failed to delete language.',
                      confirmText: t('menu.OK'),
                      onConfirm: () => {}
                    });
                  }
                }
              }}
              onInstallApp={() => {
                if (deferredPrompt && !isIOS) {
                  installApp();
                } else {
                  setShowPWAInstructions(true);
                }
              }}
              onUpdatePin={async () => {
                if (!s.token || s.newPin !== s.confirmPin) return;
                s.setPinUpdateStatus('loading');
                try {
                  const res = await api.updatePin(s.token, s.newPin);
                  if (!res.ok) {
                    s.setPinUpdateStatus('error');
                    setConfirmConfig({
                      title: t('menu.Error'),
                      message: await api.errorFrom(res, t('settings.failed_update')),
                      confirmText: t('menu.OK'),
                      onConfirm: () => {},
                    });
                    return;
                  }

                  // The old token was minted against the previous PIN and stays
                  // valid, but this used to call loginManager(newPin) — which
                  // takes a JWT, not a PIN — and then reload. That wrote the raw
                  // PIN into sessionStorage as the bearer token, so every admin
                  // call after the reload came back 403 and the dashboard was
                  // stuck "logged in" with nothing working. Exchange the new PIN
                  // for a real token instead, and stay on the page.
                  const relogin = await api.login(s.newPin);
                  if (relogin.success && relogin.token) {
                    s.loginManager(relogin.token);
                  }
                  s.setNewPin('');
                  s.setConfirmPin('');
                  s.setPinUpdateStatus('success');
                } catch {
                  s.setPinUpdateStatus('error');
                  setConfirmConfig({
                    title: t('menu.Error'),
                    message: t('navigation.connection_failed'),
                    confirmText: t('menu.OK'),
                    onConfirm: () => {},
                  });
                }
              }}
            />
          )}
          {s.activeTab === 'analytics' && (
            <AnalyticsTab />
          )}
          {s.activeTab === 'parser_rules' && (
            <ParserRulesTab confirm={setConfirmConfig} />
          )}
          </Suspense>
          </ErrorBoundary>
        </ManagerDashboard>

        <ConfirmModal
          config={confirmConfig}
          onClose={() => setConfirmConfig(null)}
        />

        <AnimatePresence>
          {showPWAInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-neutral-900/80 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-neutral-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-violet-600" />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900">{t('pwa.how_to_install')}</h3>
                  </div>
                  <button
                    onClick={() => setShowPWAInstructions(false)}
                    className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all"
                    title={t('modals.close')}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0">{t('pwa.step')} 1</div>
                    <p className="text-sm font-medium text-neutral-700">{t('pwa.ios_share')}</p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0">{t('pwa.step')} 2</div>
                    <p className="text-sm font-medium text-neutral-700">{t('pwa.ios_add')}</p>
                  </div>
                  
                  <div className="pt-4 p-4 bg-violet-50 rounded-2xl flex items-center gap-3">
                    <Info className="w-5 h-5 text-violet-500" />
                    <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider">{t('pwa.install_description')}</p>
                  </div>
                </div>
                
                <div className="p-8 pt-0">
                  <button
                    onClick={() => setShowPWAInstructions(false)}
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold uppercase tracking-widest text-sm"
                  >
                    {t('menu.OK')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {s.showHistoryReport && (
            <HistoryReport 
              orders={s.history} 
              filters={s.historyFilters} 
              truncated={historyTruncated}
              onClose={() => s.setShowHistoryReport(false)} 
            />
          )}
        </AnimatePresence>
        {/* Dynamic Build Version Overlay in Manager Dashboard */}
        <div className="fixed inset-safe-bottom left-3 z-[9999] bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-white/50 pointer-events-none select-none">{APP_VERSION}</div>
      </div>
    );
  }

  if (!computedKioskOpen && !s.testModeEnabled) {
    return (
      <div className="relative">
        <KioskClosed onGoToManager={() => { 
          const url = new URL(window.location.href);
          url.searchParams.set('view', 'manager');
          window.history.pushState({}, '', url);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }} />
        <div className="fixed inset-safe-bottom left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
      </div>
    );
  }

  return (
    <div key="kiosk-main-view">
      <PullToRefresh>
        <KioskView
          menu={s.menu}
          groupedMenu={groupedMenu}
          sideItems={sideItems}
          selectedItems={s.selectedItems}
          selectedItemIds={selectedItemIds}
          totalPrice={totalPrice}
          rfid={s.rfid}
          setRfid={s.setRfid}
          isScanning={s.isScanning}
          showSuccess={s.showSuccess}
          successMessage={s.successMessage}
          error={s.error}
          connectionError={s.connectionError}
          orderButtonEnabled={s.orderButtonEnabled}
          testModeEnabled={s.testModeEnabled}
          computedKioskOpen={computedKioskOpen}
          kioskAutoTiming={s.kioskAutoTiming}
          kioskCloseTime={s.kioskCloseTime}
          lang={s.lang}
          announcement={s.announcement}
          onToggleItem={handleToggleItem}
          onAddWithSide={handleAddWithSide}
          onUpdateQuantity={s.updateItemQuantity}
          onOrder={handleOrder}
          onClearCart={s.resetCart}
          menuDate={s.menuDate}
          preIdentificationEnabled={s.preIdentificationEnabled}
          onIdentify={handleIdentify}
          onGoToManager={handleGoToManager}
        />
        <PwaInstallBanner onNeedInstructions={() => setShowPWAInstructions(true)} />

        <AnimatePresence>
          {showPWAInstructions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-neutral-900/80 backdrop-blur-xl flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[40px] w-full max-w-sm overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-neutral-100 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6 text-violet-600" />
                    </div>
                    <h3 className="text-xl font-bold text-neutral-900">{t('pwa.how_to_install')}</h3>
                  </div>
                  <button
                    onClick={() => setShowPWAInstructions(false)}
                    className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all"
                    title={t('modals.close')}
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0">{t('pwa.step')} 1</div>
                    <p className="text-sm font-medium text-neutral-700">
                      {isIOS ? t('pwa.ios_share') : t('pwa.android_menu')}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-xs shrink-0">{t('pwa.step')} 2</div>
                    <p className="text-sm font-medium text-neutral-700">
                      {isIOS ? t('pwa.ios_add') : t('pwa.android_install')}
                    </p>
                  </div>
                  
                  <div className="pt-4 p-4 bg-violet-50 rounded-2xl flex items-center gap-3">
                    <Info className="w-5 h-5 text-violet-500" />
                    <p className="text-[10px] text-violet-600 font-bold uppercase tracking-wider">{t('pwa.install_description')}</p>
                  </div>
                </div>
                
                <div className="p-8 pt-0">
                  <button
                    onClick={() => setShowPWAInstructions(false)}
                    className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold uppercase tracking-widest text-sm"
                  >
                    {t('menu.OK')}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </PullToRefresh>

      {/* Dynamic Build Version Overlay.
          Hidden once there is a cart: it is anchored bottom-left, which is where
          the order bar slides in, and it was sitting on top of the totals. It is
          a build stamp, not something anyone needs mid-order. */}
      {s.selectedItems.length === 0 && (
        <div
          className="fixed inset-safe-bottom left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none"
          title={`Build Version: ${APP_VERSION}`}
        >
          {APP_VERSION}
        </div>
      )}
    </div>
  );
}


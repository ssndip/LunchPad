import React, { useEffect, useCallback, useState } from 'react';
import { useStore } from './store/useStore';
import { 
  useGroupedMenu, 
  useSideItems, 
  useTotalPrice, 
  useSelectedItemIds, 
  useComputedKioskOpen 
} from './store/selectors';
import { useWebSocket } from './hooks/useWebSocket';
import { translations } from './translations';
import * as api from './api';
import { MenuItem, Card, CartItem } from './types';

// Components
import { KioskView } from './components/kiosk/KioskView';
import { KioskClosed } from './components/kiosk/KioskView';
import { ManagerLogin } from './components/manager/ManagerLogin';
import { ManagerDashboard } from './components/manager/ManagerDashboard';
import { PublicAccessCodeEntry } from './components/shared/PublicAccessCodeEntry';
import { ConfirmModal } from './components/shared/ConfirmModal';

// Tabs
import { MenuTab } from './components/manager/tabs/MenuTab';
import { OrdersTab } from './components/manager/tabs/OrdersTab';
import { HistoryTab } from './components/manager/tabs/HistoryTab';
import { CardsTab } from './components/manager/tabs/CardsTab';
import { SettingsTab } from './components/manager/tabs/SettingsTab';
import { AnalyticsTab } from './components/manager/tabs/AnalyticsTab';

export default function App() {
  const s = useStore();
  
  // Selectors
  const groupedMenu = useGroupedMenu();
  const sideItems = useSideItems();
  const totalPrice = useTotalPrice();
  const selectedItemIds = useSelectedItemIds();
  const computedKioskOpen = useComputedKioskOpen();


  const t = (key: string) => {
    const keys = key.split('.');
    let val: any = translations[s.lang];
    for (const k of keys) {
      if (!val || typeof val !== 'object') return key;
      val = val[k];
    }
    return typeof val === 'string' ? val : key;
  };

  // Modal State
  const [confirmConfig, setConfirmConfig] = React.useState<any | null>(null);

  // ─── WebSocket Logic ───────────────────────────────────────────────────────
  useWebSocket({
    onInitialState: (data: any) => {
      s.setMenu(data.menu);
      s.setKioskOpen(data.kioskOpen);
      s.setGlobalAccess(data.globalAccess);
      s.setPublicAccessCode(data.publicAccessCode || "");
      s.setOrderButtonEnabled(data.orderButtonEnabled);
      s.setTestModeEnabled(data.testModeEnabled);
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

  // ─── Initial Fetch ─────────────────────────────────────────────────────────
  const fetchCards = useCallback(async () => {
    if (!s.token) return;
    try {
      const cards = await api.fetchCards(s.token);
      s.setCards(cards);
    } catch (err) {
      console.error('Failed to fetch cards', err);
    }
  }, [s.token, s.setCards]);

  // HTTP Fallback: when WS is unavailable, load state from /api/init
  const fetchInitFallback = useCallback(async () => {
    try {
      const data = await api.fetchInitialState();
      if (data && data.menu && data.menu.length > 0) {
        s.setMenu(data.menu);
        s.setKioskOpen(data.kioskOpen ?? true);
        s.setGlobalAccess(data.globalAccess ?? true);
        s.setOrderButtonEnabled(data.orderButtonEnabled ?? true);
        s.setTestModeEnabled(data.testModeEnabled ?? false);
        s.setMenuVersion(data.menuVersion ?? 1);
        s.setConnectionError(null); // menu available via HTTP — clear the blocked error
      }
    } catch {
      // HTTP also failed, keep existing error state
    }
  }, []); // eslint-disable-line

  // Trigger HTTP fallback on any connection error (WS blocked, reconnecting, etc.)
  useEffect(() => {
    if (s.connectionError) {
      fetchInitFallback();
    }
  }, [s.connectionError, fetchInitFallback]);

  // Always fetch init on mount (instant bootstrap regardless of WS)
  useEffect(() => {
    fetchInitFallback();
  }, []); // eslint-disable-line

  // Poll /api/init every 30s when WS is not providing live updates
  // This keeps globalAccess, kioskOpen, and menu in sync for remote users
  useEffect(() => {
    const id = setInterval(() => {
      if (!s.isManagerLoggedIn) {
        fetchInitFallback();
      }
    }, 30000);
    return () => clearInterval(id);
  }, [s.isManagerLoggedIn, fetchInitFallback]); // eslint-disable-line


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
      }).catch(console.error);
    }
  }, [s.isManagerLoggedIn, s.token, fetchCards, s.setOrders, s.setSummaries, s.setGlobalAccess, s.setPublicAccessCode, s.setOrderButtonEnabled, s.setTestModeEnabled]);

  // ─── Kiosk Handlers ────────────────────────────────────────────────────────
  const handleToggleItem = (item: MenuItem) => {
    const isSelected = selectedItemIds.has(item.id);
    if (isSelected) {
      s.setSelectedItems(s.selectedItems.filter((i) => i.id !== item.id));
    } else {
      let side: string | undefined = item.selectedSide;
      
      // Feature 7: Auto-select fallback if required but not pre-selected
      if (!side && item.requiresSideChoice && sideItems.length > 0) {
        const allowedSides = item.sideChoices && item.sideChoices.length > 0
          ? sideItems.filter(s => item.sideChoices?.includes(s.name))
          : sideItems;
        if (allowedSides.length > 0) {
          side = allowedSides[0].name;
        }
      }
      const cartItem: CartItem = { ...item, side };
      s.setSelectedItems([...s.selectedItems, cartItem]);
    }
  };

  const handleAddWithSide = (item: MenuItem, side?: string) => {
    const isSelected = selectedItemIds.has(item.id);
    if (isSelected) {
      // Update existing
      s.setSelectedItems(s.selectedItems.map((i) => 
        i.id === item.id ? { ...i, side } : i
      ));
    } else {
      // Add new
      const cartItem: CartItem = { ...item, side };
      s.setSelectedItems([...s.selectedItems, cartItem]);
    }
  };

  const handleOrder = async (rfidOverride?: string) => {
    const finalRfid = rfidOverride || s.rfid;
    if (!finalRfid && !s.testModeEnabled) return;

    // Feature 7: Validation - Ensure mandatory sides are selected
    const missingSides = s.selectedItems.filter(i => (i.requiresSideChoice || i.hasIncludedSide) && !i.side);
    if (missingSides.length > 0) {
      s.setError(t('kiosk.choose_side') + ": " + missingSides[0].name);
      return;
    }

    s.setIsScanning(true);
    s.setError(null);

    try {
      // Map CartItems to simple ID+Side objects for the API
      const items = s.selectedItems.map((i) => ({ id: i.id, side: i.side }));
      
      const res = await api.placeOrder(finalRfid || 'TEST-ADMIN', items, s.menuVersion);

      if (!res.ok) {
        if (res.status === 409) {
          const err = await res.json();
          s.setError(t('modals.menu_updated') || err.message);
          return;
        }
        const err = await res.json();
        s.setError(err.error || 'Order failed');
      } else {
        s.setShowSuccess(true);
        s.resetCart();
        setTimeout(() => s.setShowSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Order error:', err);
      s.setError(t('navigation.network_error'));
    } finally {
      s.setIsScanning(false);
    }
  };

  // ─── Manager Handlers ──────────────────────────────────────────────────────
  const handleApplyMenu = async (items: MenuItem[]) => {
    if (!s.token) return;
    try {
      await api.updateMenu(s.token, items);
      s.setMenu(items);
    } catch {
      setConfirmConfig({
        title: 'Error',
        message: 'Failed to update menu',
        confirmText: 'OK',
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

  const handleUpdateSettings = async (access: boolean, orderBtn: boolean, test?: boolean, publicCode?: string) => {
    if (!s.token) return;
    try {
      const update = {
        globalAccess: access,
        orderButtonEnabled: orderBtn,
        testModeEnabled: test ?? s.testModeEnabled,
        publicAccessCode: publicCode ?? s.publicAccessCode,
      };
      await api.updateSettings(s.token, update);
      s.setGlobalAccess(access);
      s.setOrderButtonEnabled(orderBtn);
      if (test !== undefined) s.setTestModeEnabled(test);
      if (publicCode !== undefined) s.setPublicAccessCode(publicCode);
    } catch {
      setConfirmConfig({
        title: 'Error',
        message: 'Failed to update settings',
        confirmText: 'OK',
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
        title: 'Error',
        message: 'Failed to update kiosk status',
        confirmText: 'OK',
        onConfirm: () => {}
      });
    }
  };

  const handleUnlock = async (code: string) => {
    try {
      const res = await api.unlock(code);
      if (res.success && res.token) {
        s.setPublicAccessToken(res.token);
        s.setPublicAccessRequired(false);
        // useWebSocket will auto-reconnect with the new token
        return { success: true };
      }
      return { success: false, error: res.error };
    } catch (err) {
      return { success: false, error: 'Network error' };
    }
  };

  // ─── Render Logic ──────────────────────────────────────────────────────────
  if (s.publicAccessRequired) {
    return <PublicAccessCodeEntry onUnlock={handleUnlock} lang={s.lang} />;
  }

  if (s.mode === 'manager') {
    if (!s.isManagerLoggedIn) {
      return (
        <ManagerLogin
          onLogin={(pin) => s.loginManager(pin)}
          onBack={() => s.setMode('kiosk')}
          t={t}
        />
      );
    }

    return (
      <div className="min-h-screen bg-neutral-900">
        <ManagerDashboard
          activeTab={s.activeTab}
          onTabChange={s.setActiveTab}
          onLogout={s.logoutManager}
          lang={s.lang}
          t={t}
          kioskOpen={s.kioskOpen}
          onToggleKiosk={handleToggleKioskManual}
        >
          {s.activeTab === 'menu' && (
            <MenuTab
              editingMenu={s.menu}
              onAddItem={() => {
                const newId = Math.max(0, ...s.menu.map((i) => i.id)) + 1;
                const newItem: MenuItem = {
                  id: newId,
                  name: 'New Item',
                  basePrice: 0,
                  price: 0,
                  available: true,
                  category: 'Uncategorized',
                  tags: [],
                  extraFees: [],
                };
                handleApplyMenu([...s.menu, newItem]);
              }}
              onUpdateItem={handleUpdateMenuItem}
              onRemoveItem={handleRemoveMenuItem}
              onDeleteAll={() => handleApplyMenu([])}
              onApplyMenu={handleApplyMenu}
              t={t}
            />
          )}
          {s.activeTab === 'orders' && (
            <OrdersTab
              summaries={s.summaries}
              expandedDate={s.expandedDate}
              dailyDetails={s.dailyDetails}
              confirm={setConfirmConfig}
              onExpandDate={async (date) => {
                if (s.expandedDate === date) {
                  s.setExpandedDate(null);
                } else {
                  s.setExpandedDate(date);
                  if (s.token) {
                    const details = await api.fetchDailySummaryDetails(s.token, date);
                    s.setDailyDetails(details.items || []);
                  }
                }
              }}
              onCopySummary={(date, total) => {
                const text = `Summary for ${date}\nTotal: €${(Number(total) || 0).toFixed(2)}\n\n` + 
                  s.dailyDetails.map(d => `${d.name} x${d.quantity}: €${(Number(d.total) || 0).toFixed(2)}`).join('\n');
                navigator.clipboard.writeText(text);
                setConfirmConfig({
                  title: t('navigation.order_summary'),
                  message: 'Summary copied to clipboard',
                  confirmText: 'OK',
                  onConfirm: () => {}
                });
              }}
              t={t}
            />
          )}
          {s.activeTab === 'history' && (
            <HistoryTab
              history={s.orders}
              filters={s.historyFilters}
              onFilterChange={(k, v) => s.setHistoryFilters({ ...s.historyFilters, [k]: v })}
              onApplyFilters={async () => {
                if (s.token) {
                  const results = await api.fetchHistory(s.token, s.historyFilters);
                  s.setOrders(results);
                }
              }}
              t={t}
            />
          )}
          {s.activeTab === 'cards' && (
            <CardsTab
              cards={s.cards}
              onUpdateCards={async (newCards) => {
                if (s.token) {
                  await api.updateCards(s.token, newCards);
                  s.setCards(newCards);
                }
              }}
              onRemoveCard={async (rfid) => {
                if (s.token) {
                  setConfirmConfig({
                    title: t('modals.remove_item'),
                    message: t('modals.delete_warning'),
                    isDestructive: true,
                    onConfirm: async () => {
                      await api.deleteCard(s.token!, rfid);
                      fetchCards();
                    }
                  });
                }
              }}
              onResetCardBalance={async (rfid) => {
                if (s.token) {
                  await api.resetCardBalance(s.token, rfid);
                  fetchCards();
                }
              }}
              onResetAllBalances={async () => {
                if (s.token) {
                  setConfirmConfig({
                    title: 'Reset Balances',
                    message: t('modals.reset_warning'),
                    isDestructive: true,
                    onConfirm: async () => {
                      await api.resetAllBalances(s.token!);
                      fetchCards();
                    }
                  });
                }
              }}
              onAddManualCard={async () => {
                if (s.token && s.newCardRfid && s.newCardOwner) {
                  await api.addCard(s.token, {
                    rfid: s.newCardRfid,
                    ownerName: s.newCardOwner,
                    balance: 0,
                    isAdmin: s.newCardIsAdmin,
                  });
                  s.setNewCardRfid('');
                  s.setNewCardOwner('');
                  s.setNewCardIsAdmin(false);
                  fetchCards();
                }
              }}
              onBatchAddCards={async () => {
                if (s.token && s.pasteCardsText) {
                  const lines = s.pasteCardsText.split('\n');
                  const cardsToBatch: Card[] = lines.map(line => {
                    const [rfid, ...nameParts] = line.trim().split(/\s+/);
                    return { rfid, ownerName: nameParts.join(' ') || 'User', balance: 0, isAdmin: false };
                  }).filter(c => c.rfid);
                  await api.batchAddCards(s.token, cardsToBatch);
                  s.setIsPasteCardsModalOpen(false);
                  s.setPasteCardsText('');
                  fetchCards();
                }
              }}
              newCardRfid={s.newCardRfid}
              setNewCardRfid={s.setNewCardRfid}
              newCardOwner={s.newCardOwner}
              setNewCardOwner={s.setNewCardOwner}
              newCardIsAdmin={s.newCardIsAdmin}
              setNewCardIsAdmin={s.setNewCardIsAdmin}
              lastScanned={s.lastScanned}
              isScanning={s.isScanningForCard}
              setIsScanning={s.setIsScanningForCard}
              pasteCardsText={s.pasteCardsText}
              setPasteCardsText={s.setPasteCardsText}
              isPasteCardsModalOpen={s.isPasteCardsModalOpen}
              setIsPasteCardsModalOpen={s.setIsPasteCardsModalOpen}
              t={t}
            />
          )}
          {s.activeTab === 'settings' && (
            <SettingsTab
              lang={s.lang}
              setLang={s.setLang}
              globalAccess={s.globalAccess}
              publicAccessCode={s.publicAccessCode}
              orderButtonEnabled={s.orderButtonEnabled}
              testModeEnabled={s.testModeEnabled}
              newPin={s.newPin}
              setNewPin={s.setNewPin}
              confirmPin={s.confirmPin}
              setConfirmPin={s.setConfirmPin}
              pinUpdateStatus={s.pinUpdateStatus}
              onUpdateSettings={(acc, ord, tst, code) => {
                handleUpdateSettings(acc, ord, tst, code);
              }}
              onUpdatePin={async () => {
                if (s.token && s.newPin === s.confirmPin) {
                  s.setPinUpdateStatus('loading');
                  const res = await api.updatePin(s.token, s.newPin);
                  if (res.ok) {
                    s.setPinUpdateStatus('success');
                    s.loginManager(s.newPin);
                    setTimeout(() => s.setPinUpdateStatus('idle'), 2000);
                  } else {
                    s.setPinUpdateStatus('error');
                  }
                }
              }}
              t={t}
            />
          )}
          {s.activeTab === 'analytics' && (
            <AnalyticsTab t={t} />
          )}
        </ManagerDashboard>

        <ConfirmModal
          config={confirmConfig}
          onClose={() => setConfirmConfig(null)}
          cancelLabel={t('modals.cancel')}
        />
      </div>
    );
  }

  if (!computedKioskOpen && !s.testModeEnabled) {
    return <KioskClosed onGoToManager={() => s.setMode('manager')} t={t} />;
  }

  return (
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
      error={s.error}
      connectionError={s.connectionError}
      orderButtonEnabled={s.orderButtonEnabled}
      testModeEnabled={s.testModeEnabled}
      computedKioskOpen={computedKioskOpen}
      kioskAutoTiming={s.kioskAutoTiming}
      kioskCloseTime={s.kioskCloseTime}
      lang={s.lang}
      onToggleItem={handleToggleItem}
      onAddWithSide={handleAddWithSide}
      onOrder={handleOrder}
      onClearCart={s.resetCart}
      onGoToManager={() => s.setMode('manager')}
      t={t}
    />
  );
}

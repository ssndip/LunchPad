/**
 * App.tsx — Modular Root Component
 * Refactored from 2700 lines to ~300.
 */
import { useEffect, useCallback } from 'react';
import { useAppState } from './hooks/useAppState';
import { useWebSocket } from './hooks/useWebSocket';
import { translations } from './translations';
import * as api from './api';
import { MenuItem, Card, CartItem } from './types';

// Components
import { KioskView, KioskClosed } from './components/kiosk/KioskView';
import { ManagerLogin } from './components/manager/ManagerLogin';
import { ManagerDashboard } from './components/manager/ManagerDashboard';

// Tabs
import { MenuTab } from './components/manager/tabs/MenuTab';
import { OrdersTab } from './components/manager/tabs/OrdersTab';
import { HistoryTab } from './components/manager/tabs/HistoryTab';
import { CardsTab } from './components/manager/tabs/CardsTab';
import { SettingsTab } from './components/manager/tabs/SettingsTab';

export default function App() {
  const s = useAppState();
  const t = (key: string) => {
    const keys = key.split('.');
    let obj: any = translations[s.lang];
    for (const k of keys) {
      if (!obj || !obj[k]) return key;
      obj = obj[k];
    }
    return obj;
  };

  // ─── WebSocket Logic ───────────────────────────────────────────────────────
  useWebSocket({
    onInitialState: (data) => {
      s.setMenu(data.menu);
      s.setKioskOpen(data.kioskOpen);
      s.setGlobalAccess(data.globalAccess);
      s.setOrderButtonEnabled(data.orderButtonEnabled);
      s.setTestModeEnabled(data.testModeEnabled);
      s.setConnectionError(null);
    },
    onMenuUpdate: (menu) => s.setMenu(menu),
    onStatusUpdate: (data) => {
      if (data.kioskOpen !== undefined) s.setKioskOpen(data.kioskOpen);
      if (data.orderButtonEnabled !== undefined) s.setOrderButtonEnabled(data.orderButtonEnabled);
      if (data.testModeEnabled !== undefined) s.setTestModeEnabled(data.testModeEnabled);
    },
    onCardsUpdate: () => {
      if (s.adminPin) fetchCards();
    },
    onConnectionError: (err) => s.setConnectionError(err),
  });

  // ─── Initial Fetch (Auth protected data if PIN exists) ─────────────────────
  const fetchCards = useCallback(async () => {
    if (!s.adminPin) return;
    try {
      const cards = await api.fetchCards(s.adminPin);
      s.setCards(cards);
    } catch (err) {
      console.error('Failed to fetch cards', err);
    }
  }, [s.adminPin]);

  useEffect(() => {
    if (s.isManagerLoggedIn && s.adminPin) {
      // Sync all manager data when logged in
      fetchCards();
      api.fetchOrders(s.adminPin).then(s.setOrders).catch(console.error);
      api.fetchSummaries(s.adminPin).then(s.setSummaries).catch(console.error);
      api.fetchSettings(s.adminPin).then((res) => {
        s.setGlobalAccess(res.globalAccess);
        s.setOrderButtonEnabled(res.orderButtonEnabled);
        s.setTestModeEnabled(res.testModeEnabled);
      }).catch(console.error);
    }
  }, [s.isManagerLoggedIn, s.adminPin, fetchCards]);

  // ─── Kiosk Handlers ────────────────────────────────────────────────────────
  const handleToggleItem = (item: MenuItem) => {
    const isSelected = s.selectedItemIds.has(item.id);
    if (isSelected) {
      s.setSelectedItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      const cartItem: CartItem = { ...item };
      s.setSelectedItems((prev) => [...prev, cartItem]);
    }
  };

  const handleAddWithSide = (item: MenuItem, side?: string) => {
    const cartItem: CartItem = { ...item, side };
    s.setSelectedItems((prev) => [...prev, cartItem]);
  };

  const handleOrder = async (rfidOverride?: string) => {
    const finalRfid = rfidOverride || s.rfid;
    if (!finalRfid && !s.testModeEnabled) return;

    s.setIsScanning(true);
    s.setError(null);

    try {
      const itemIds = s.selectedItems.map((i) => i.id);
      const res = await api.placeOrder(finalRfid || 'TEST-ADMIN', itemIds);

      if (!res.ok) {
        const err = await res.json();
        s.setError(err.error || 'Order failed');
      } else {
        s.setShowSuccess(true);
        s.resetCart();
        setTimeout(() => s.setShowSuccess(false), 3000);
      }
    } catch {
      s.setError(t('navigation.network_error'));
    } finally {
      s.setIsScanning(false);
    }
  };

  // ─── Manager Handlers ──────────────────────────────────────────────────────
  const handleApplyMenu = async (items: MenuItem[]) => {
    if (!s.adminPin) return;
    try {
      await api.updateMenu(s.adminPin, items);
      s.setMenu(items);
    } catch (err) {
      alert('Failed to update menu');
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
    // Debounce or manual save? Existing App.tsx saved instantly on blur/change
    handleApplyMenu(updated);
  };

  const handleUpdateSettings = async (access: boolean, orderBtn: boolean, test?: boolean) => {
    if (!s.adminPin) return;
    try {
      const update = {
        globalAccess: access,
        orderButtonEnabled: orderBtn,
        testModeEnabled: test ?? s.testModeEnabled,
      };
      await api.updateSettings(s.adminPin, update);
      s.setGlobalAccess(access);
      s.setOrderButtonEnabled(orderBtn);
      if (test !== undefined) s.setTestModeEnabled(test);
    } catch (err) {
      alert('Failed to update settings');
    }
  };

  const handleToggleKioskManual = async (open: boolean) => {
    if (!s.adminPin) return;
    try {
      await api.toggleKioskStatus(s.adminPin, open);
      s.setKioskOpen(open);
    } catch (err) {
      alert('Failed to update kiosk status');
    }
  };

  // ─── Render Logic ──────────────────────────────────────────────────────────
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
      <ManagerDashboard
        activeTab={s.activeTab}
        onTabChange={s.setActiveTab}
        onLogout={s.logoutManager}
        lang={s.lang}
        t={t}
      >
        {s.activeTab === 'menu' && (
          <MenuTab
            editingMenu={s.menu}
            onAddItem={() => {
              const newId = Math.max(0, ...s.menu.map((i) => i.id)) + 1;
              const newItem: MenuItem = {
                id: newId,
                name: 'New Item',
                price: 0,
                available: true,
                category: 'Uncategorized',
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
            onExpandDate={async (date) => {
              if (s.expandedDate === date) {
                s.setExpandedDate(null);
              } else {
                s.setExpandedDate(date);
                if (s.adminPin) {
                  const details = await api.fetchDailySummaryDetails(s.adminPin, date);
                  s.setDailyDetails(details);
                }
              }
            }}
            onCopySummary={(date, total) => {
              const text = `Summary for ${date}\nTotal: €${total.toFixed(2)}\n\n` + 
                s.dailyDetails.map(d => `${d.name} x${d.quantity}: €${d.total.toFixed(2)}`).join('\n');
              navigator.clipboard.writeText(text);
              alert('Summary copied to clipboard');
            }}
            t={t}
          />
        )}
        {s.activeTab === 'history' && (
          <HistoryTab
            history={s.orders}
            filters={s.historyFilters}
            onFilterChange={(k, v) => s.setHistoryFilters(prev => ({ ...prev, [k]: v }))}
            onApplyFilters={async () => {
              if (s.adminPin) {
                const results = await api.fetchHistory(s.adminPin, s.historyFilters);
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
              if (s.adminPin) {
                await api.updateCards(s.adminPin, newCards);
                s.setCards(newCards);
              }
            }}
            onRemoveCard={async (rfid) => {
              if (s.adminPin && window.confirm(t('modals.delete_warning'))) {
                await api.deleteCard(s.adminPin, rfid);
                fetchCards();
              }
            }}
            onResetCardBalance={async (rfid) => {
              if (s.adminPin) {
                await api.resetCardBalance(s.adminPin, rfid);
                fetchCards();
              }
            }}
            onResetAllBalances={async () => {
              if (s.adminPin && window.confirm(t('modals.reset_warning'))) {
                await api.resetAllBalances(s.adminPin);
                fetchCards();
              }
            }}
            onAddManualCard={async () => {
              if (s.adminPin && s.newCardRfid && s.newCardOwner) {
                await api.addCard(s.adminPin, {
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
              if (s.adminPin && s.pasteCardsText) {
                const lines = s.pasteCardsText.split('\n');
                const cards: Card[] = lines.map(line => {
                  const [rfid, ...nameParts] = line.trim().split(/\s+/);
                  return { rfid, ownerName: nameParts.join(' ') || 'User', balance: 0, isAdmin: false };
                }).filter(c => c.rfid);
                await api.batchAddCards(s.adminPin, cards);
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
            setLang={s.changeLang}
            globalAccess={s.globalAccess}
            orderButtonEnabled={s.orderButtonEnabled}
            testModeEnabled={s.testModeEnabled}
            kioskOpen={s.kioskOpen}
            computedKioskOpen={s.computedKioskOpen}
            kioskAutoTiming={s.kioskAutoTiming}
            kioskOpenTime={s.kioskOpenTime}
            kioskCloseTime={s.kioskCloseTime}
            kioskCloseDay={s.kioskCloseDay}
            newPin={s.newPin}
            setNewPin={s.setNewPin}
            confirmPin={s.confirmPin}
            setConfirmPin={s.setConfirmPin}
            pinUpdateStatus={s.pinUpdateStatus}
            onUpdateSettings={(acc, ord, tst, auto, oTime, cTime, cDay) => {
              if (auto !== undefined) s.setKioskAutoTiming(auto);
              if (oTime !== undefined) s.setKioskOpenTime(oTime);
              if (cTime !== undefined) s.setKioskCloseTime(cTime);
              if (cDay !== undefined) s.setKioskCloseDay(cDay);
              handleUpdateSettings(acc, ord, tst);
            }}
            onToggleKiosk={handleToggleKioskManual}
            onUpdatePin={async () => {
              if (s.adminPin && s.newPin === s.confirmPin) {
                s.setPinUpdateStatus('loading');
                const res = await api.updatePin(s.adminPin, s.newPin);
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
      </ManagerDashboard>
    );
  }

  if (!s.computedKioskOpen && !s.testModeEnabled) {
    return <KioskClosed onGoToManager={() => s.setMode('manager')} t={t} />;
  }

  return (
    <KioskView
      menu={s.menu}
      groupedMenu={s.groupedMenu}
      sideItems={s.sideItems}
      selectedItems={s.selectedItems}
      selectedItemIds={s.selectedItemIds}
      totalPrice={s.totalPrice}
      rfid={s.rfid}
      setRfid={s.setRfid}
      isScanning={s.isScanning}
      showSuccess={s.showSuccess}
      error={s.error}
      connectionError={s.connectionError}
      orderButtonEnabled={s.orderButtonEnabled}
      testModeEnabled={s.testModeEnabled}
      computedKioskOpen={s.computedKioskOpen}
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

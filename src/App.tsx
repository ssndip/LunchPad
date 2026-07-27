import React, { useEffect, useCallback, useState } from 'react';
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

// Tabs
import { MenuTab } from './components/manager/tabs/MenuTab';
import { OrdersTab } from './components/manager/tabs/OrdersTab';
import { HistoryTab } from './components/manager/tabs/HistoryTab';
import { CardsTab } from './components/manager/tabs/CardsTab';
import { SettingsTab } from './components/manager/tabs/SettingsTab';
import { ParserRulesTab } from './components/manager/tabs/ParserRulesTab';
import { AnalyticsTab } from './components/manager/tabs/AnalyticsTab';
import { HistoryReport } from './components/manager/tabs/HistoryReport';

import { useTranslation } from './hooks/useTranslation';
import { useSyncState } from './hooks/useSyncState';

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

// Sync mode with URL view param
  useEffect(() => {
    const handleUrlChange = () => {
      const search = new URLSearchParams(window.location.search);
      const isManager = search.get('view') === 'manager';
      const currentTab = search.get('tab') as any || 'menu';
      
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
  }, [s.mode, s.activeTab, fetchCards]);


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

    try {
      const res = await api.placeOrder(finalRfid, items, s.menuVersion, finalPin);

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
            pin: finalPin || undefined
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
        pin: finalPin || undefined
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
        s.setPublicAccessRequired(false);
        if (res.token) {
          // If public session token is provided, store it or handle accordingly
        }
      } else {
        throw new Error(res.error || t('settings.invalid_code'));
      }
    } catch (err: any) {
      throw err;
    }
  };



  // ─── Render Logic ──────────────────────────────────────────────────────────
  if (s.publicAccessRequired) {
    return (
      <div className="relative">
        <PublicAccessCodeEntry onUnlock={handleUnlock} />
        <div className="fixed bottom-3 left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
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
          <div className="fixed bottom-3 left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
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
                } catch (error) {
                  console.error('Failed to persist new item:', error);
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
                } else {
                  s.setExpandedDate(date);
                  if (s.token) {
                    const details = await api.fetchDailySummaryDetails(s.token, date);
                    s.setDailyDetails(details.items || []);
                    s.setDailySides(details.sides || []);
                  }
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
                
                navigator.clipboard.writeText(text);
                setConfirmConfig({
                  title: t('navigation.order_summary'),
                  message: t('navigation.copy_success'),
                  confirmText: t('menu.OK'),
                  onConfirm: () => {}
                });
              }}
            />
          )}
          {s.activeTab === 'history' && (
            <HistoryTab
              history={s.history}
              filters={s.historyFilters}
              onFilterChange={(k, v) => s.setHistoryFilters({ ...s.historyFilters, [k]: v })}
              onApplyFilters={async () => {
                if (s.token) {
                  const results = await api.fetchHistory(s.token, s.historyFilters);
                  s.setHistory(results);
                }
              }}
            />
          )}
          {s.activeTab === 'cards' && (
            <CardsTab
              cards={s.cards}
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
                     console.error("Update failed:", err);
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
                  const res = await api.addCard(s.token, {
                    rfid: s.newCardRfid,
                    ownerName: s.newCardOwner,
                    balance: 0,
                    isAdmin: s.newCardIsAdmin,
                    pin: s.newCardPin,
                  });
                  
                  if (!res.ok) {
                    const data = await res.json();
                    if (res.status === 409) {
                      setConfirmConfig({
                        title: t('menu.Error'),
                        message: data.error,
                        isDestructive: true,
                        confirmText: 'OK',
                        onConfirm: () => {}
                      });
                      return;
                    }
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
                    await api.batchAddCards(s.token, cardsToBatch);
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
              onViewStats={async (rfid) => {
                const newFilters = { ...s.historyFilters, rfid };
                s.setHistoryFilters(newFilters);
                s.setActiveTab('history');
                if (s.token) {
                  const results = await api.fetchHistory(s.token, newFilters);
                  s.setHistory(results);
                }
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
                if (s.token && s.newPin === s.confirmPin) {
                  s.setPinUpdateStatus('loading');
                  const res = await api.updatePin(s.token, s.newPin);
                  if (res.ok) {
                    s.setPinUpdateStatus('success');
                    s.loginManager(s.newPin);
                    setTimeout(() => {
                      window.location.reload();
                    }, 500);
                  } else {
                    s.setPinUpdateStatus('error');
                  }
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
              onClose={() => s.setShowHistoryReport(false)} 
            />
          )}
        </AnimatePresence>
        {/* Dynamic Build Version Overlay in Manager Dashboard */}
        <div className="fixed bottom-3 left-3 z-[9999] bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-white/50 pointer-events-none select-none">{APP_VERSION}</div>
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
        <div className="fixed bottom-3 left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none">{APP_VERSION}</div>
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

      {/* Dynamic Build Version Overlay */}
      <div 
        className="fixed bottom-3 left-3 z-[9999] bg-neutral-900/5 backdrop-blur-sm px-2 py-0.5 rounded-full text-[9px] font-mono font-black text-neutral-500/80 pointer-events-none select-none"
        title={`Build Version: ${APP_VERSION}`}
      >
        {APP_VERSION}
      </div>
    </div>
  );
}


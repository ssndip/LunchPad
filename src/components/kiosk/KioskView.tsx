/**
 * KioskView — Root kiosk screen.
 * Orchestrates: header, menu grid, order bar, side picker, user history modal.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, AlertCircle, LogOut, Users } from 'lucide-react';
import { MenuItem, CartItem } from '../../types';
import { Language } from '../../translations';
import { KioskMenuGrid } from './KioskMenuGrid';
import { KioskOrderBar, OrderSuccessOverlay } from './KioskOrderBar';
import { SideDishPicker } from './SideDishPicker';
import { UserHistoryModal } from './UserHistoryModal';
import { useRfidScanner } from '../../hooks/useRfidScanner';

interface KioskViewProps {
  // State
  menu: MenuItem[];
  groupedMenu: Record<string, MenuItem[]>;
  sideItems: MenuItem[];
  selectedItems: CartItem[];
  selectedItemIds: Set<number>;
  totalPrice: number;
  rfid: string;
  setRfid: (v: string) => void;
  isScanning: boolean;
  showSuccess: boolean;
  error: string | null;
  connectionError: string | null;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  computedKioskOpen: boolean;
  lang: Language;
  // Actions
  onToggleItem: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onOrder: (rfidOverride?: string) => void;
  onClearCart: () => void;
  onGoToManager: () => void;
  onToggleKiosk: (open: boolean) => void;
  t: (key: string) => string;
}

export const KioskView: React.FC<KioskViewProps> = ({
  groupedMenu,
  sideItems,
  selectedItems,
  selectedItemIds,
  totalPrice,
  rfid,
  setRfid,
  isScanning,
  showSuccess,
  error,
  connectionError,
  orderButtonEnabled,
  testModeEnabled,
  computedKioskOpen,
  lang,
  onToggleItem,
  onAddWithSide,
  onOrder,
  onClearCart,
  onGoToManager,
  onToggleKiosk,
  t,
}) => {
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  const [historyScanRfid, setHistoryScanRfid] = useState<string | undefined>(undefined);
  const [sidePicker, setSidePicker] = useState<MenuItem | null>(null);

  // Feature 2 & 3: Unified RFID scanner logic
  useRfidScanner({
    active: true,
    onScan: (scanned) => {
      if (selectedItems.length > 0 && !userHistoryOpen && orderButtonEnabled) {
        setRfid(scanned);
        onOrder(scanned);
      } else {
        setRfid(scanned);
        setHistoryScanRfid(scanned);
        setUserHistoryOpen(true);
      }
    },
  });

  const handleCloseHistory = () => {
    setUserHistoryOpen(false);
    setHistoryScanRfid(undefined);
  };

  const handleToggle = (item: MenuItem) => {
    const isSelected = selectedItemIds.has(item.id);
    if (!isSelected && item.hasIncludedSide && sideItems.length > 0) {
      setSidePicker(item);
    } else {
      onToggleItem(item);
    }
  };

  const handleSideSelected = (side?: string) => {
    if (sidePicker) {
      onAddWithSide(sidePicker, side);
    }
    setSidePicker(null);
  };

  const displayDate = (() => {
    const target = new Date();
    return target.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  })();

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#F8F9FA] flex flex-col relative font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neutral-300 rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-neutral-200 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        <header className="shrink-0 flex justify-between items-center px-4 md:px-8 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
              {t('kiosk.daily_menu')}
            </h1>
            <span className="text-lg font-mono text-neutral-400 uppercase tracking-tight leading-none hidden sm:block">
              {displayDate}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Kiosk Status Toggle */}
            <button
              onClick={() => onToggleKiosk(!computedKioskOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all active:scale-95 shadow-sm hover:shadow-md ${
                computedKioskOpen 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
              title={computedKioskOpen ? "Kiosk is OPEN" : "Kiosk is CLOSED"}
            >
              <div className={`w-2 h-2 rounded-full ${computedKioskOpen ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
              <span className="text-[10px] font-black uppercase tracking-wider">
                {computedKioskOpen ? t('settings.kiosk_open') : t('settings.kiosk_closed')}
              </span>
            </button>

            <button
              onClick={() => setUserHistoryOpen(true)}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
              aria-label="User Balance & History"
            >
              <Users className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
              <span className="hidden sm:block text-xs font-bold text-neutral-500 group-hover:text-neutral-900 transition-colors uppercase tracking-wider">
                {t('kiosk.user_balance')}
              </span>
            </button>

            <button
              onClick={onGoToManager}
              className="group p-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
              aria-label="Manager Settings"
            >
              <Settings className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </button>
          </div>
        </header>

        <KioskMenuGrid
          groupedMenu={groupedMenu}
          selectedItemIds={selectedItemIds}
          onToggle={handleToggle}
          orderButtonEnabled={orderButtonEnabled}
          connectionError={connectionError}
          t={t}
        />

        <KioskOrderBar
          selectedItems={selectedItems}
          totalPrice={totalPrice}
          rfid={rfid}
          setRfid={setRfid}
          rfidInputRef={rfidInputRef as React.RefObject<HTMLInputElement>}
          isScanning={isScanning}
          computedKioskOpen={computedKioskOpen}
          testModeEnabled={testModeEnabled}
          orderButtonEnabled={orderButtonEnabled}
          onOrder={() => onOrder(rfid || undefined)}
          onClearCart={onClearCart}
          t={t}
        />
      </div>

      <OrderSuccessOverlay show={showSuccess} t={t} />

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-50"
          >
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-bold">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {sidePicker && (
        <SideDishPicker
          item={sidePicker}
          sides={sideItems}
          onSelect={handleSideSelected}
          t={t}
        />
      )}

      <UserHistoryModal
        isOpen={userHistoryOpen}
        onClose={handleCloseHistory}
        scannedRfid={historyScanRfid}
        t={t}
      />
    </div>
  );
};

export const KioskClosed: React.FC<{ onGoToManager: () => void; t: (key: string) => string }> = ({ onGoToManager, t }) => (
  <div className="h-[100dvh] overflow-hidden bg-neutral-100 flex items-center justify-center p-8">
    <div className="bg-white p-12 rounded-[40px] shadow-2xl text-center max-w-lg w-full">
      <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8">
        <LogOut className="w-12 h-12 text-red-600" />
      </div>
      <h1 className="text-4xl font-black text-neutral-900 mb-4 uppercase tracking-tighter">
        {t('kiosk.ordering_closed')}
      </h1>
      <p className="text-neutral-500 text-lg leading-relaxed">
        {t('kiosk.check_back_tomorrow')}
      </p>
      <button
        onClick={onGoToManager}
        className="mt-8 px-8 py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all"
      >
        {t('navigation.admin_login')}
      </button>
    </div>
  </div>
);

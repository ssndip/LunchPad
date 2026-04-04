/**
 * KioskView — Root kiosk screen.
 * Orchestrates: header, menu grid, order bar, side picker, user history modal.
 * Feature 1: h-[100dvh] overflow-hidden, inner grid scrolls.
 * Feature 2: useRfidScanner global listener fires handleOrder automatically.
 * Feature 3: User history modal.
 * Feature 5: SideDishPicker intercept.
 */
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, AlertCircle, LogOut, CreditCard, Users } from 'lucide-react';
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
  kioskAutoTiming: boolean;
  kioskCloseTime: string;
  lang: Language;
  // Actions
  onToggleItem: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onOrder: (rfidOverride?: string) => void;
  onClearCart: () => void;
  onGoToManager: () => void;
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
  kioskAutoTiming,
  kioskCloseTime,
  lang,
  onToggleItem,
  onAddWithSide,
  onOrder,
  onClearCart,
  onGoToManager,
  t,
}) => {
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  const [sidePicker, setSidePicker] = useState<MenuItem | null>(null);

  // Feature 2: Global RFID scan-to-order listener
  // Only active when there are items in the cart and the user history modal is closed
  useRfidScanner({
    active: selectedItems.length > 0 && !userHistoryOpen && orderButtonEnabled,
    onScan: (rfid) => {
      setRfid(rfid);
      onOrder(rfid);
    },
  });

  // Intercept toggleItem — open SideDishPicker for main dishes
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

  // Date display
  const displayDate = (() => {
    const now = new Date();
    const currentHHmm =
      now.getHours().toString().padStart(2, '0') +
      ':' +
      now.getMinutes().toString().padStart(2, '0');
    const target = new Date(now);
    if (kioskAutoTiming && currentHHmm >= kioskCloseTime) {
      target.setDate(now.getDate() + 1);
    }
    return target.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  })();

  return (
    /* Feature 1: Full-viewport lock — no outer scroll */
    <div className="h-[100dvh] overflow-hidden bg-[#F8F9FA] flex flex-col relative font-sans">
      {/* Decorative background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-20">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neutral-300 rounded-full blur-[140px] -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-neutral-200 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative z-10 flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="shrink-0 flex justify-between items-center px-4 md:px-8 py-4">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-2xl font-black text-neutral-900 tracking-tighter uppercase leading-none">
              {t('kiosk.daily_menu')}
            </h1>
            <span className="text-lg font-mono text-neutral-400 uppercase tracking-tight leading-none hidden sm:block">
              {displayDate}
            </span>
            {kioskAutoTiming && (
              <span className="text-[10px] font-bold px-3 py-1 bg-white text-neutral-500 rounded-full border border-neutral-200 uppercase tracking-widest shadow-sm">
                {t('kiosk.orders_for')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Feature 3: User history button */}
            <button
              onClick={() => setUserHistoryOpen(true)}
              className="group flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
              title="Check balance & history"
              aria-label="User Balance & History"
            >
              <Users className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
              <span className="hidden sm:block text-xs font-bold text-neutral-500 group-hover:text-neutral-900 transition-colors uppercase tracking-wider">
                {t('kiosk.user_balance')}
              </span>
            </button>

            {/* Manager link */}
            <button
              onClick={onGoToManager}
              className="group p-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:shadow-md transition-all active:scale-95"
              title="Manager Settings"
              aria-label="Manager Settings"
            >
              <Settings className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 transition-colors" />
            </button>
          </div>
        </header>

        {/* Menu grid — scrolls inside, Feature 1 */}
        <KioskMenuGrid
          groupedMenu={groupedMenu}
          selectedItemIds={selectedItemIds}
          onToggle={handleToggle}
          orderButtonEnabled={orderButtonEnabled}
          connectionError={connectionError}
          t={t}
        />

        {/* Order bar — shrink-0, never scrolls */}
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

      {/* Success overlay */}
      <OrderSuccessOverlay show={showSuccess} t={t} />

      {/* Error toast */}
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

      {/* Feature 5: Side dish picker */}
      {sidePicker && (
        <SideDishPicker
          item={sidePicker}
          sides={sideItems}
          onSelect={handleSideSelected}
          t={t}
        />
      )}

      {/* Feature 3: User history modal */}
      <UserHistoryModal
        isOpen={userHistoryOpen}
        onClose={() => setUserHistoryOpen(false)}
        t={t}
      />
    </div>
  );
};

// ─── Closed kiosk screen ──────────────────────────────────────────────────────
interface KioskClosedProps {
  onGoToManager: () => void;
  t: (key: string) => string;
}

export const KioskClosed: React.FC<KioskClosedProps> = ({ onGoToManager, t }) => (
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

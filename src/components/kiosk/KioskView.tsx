import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, AlertCircle, LogOut, Users } from 'lucide-react';
import { MenuItem, CartItem } from '../../types';
import { Language } from '../../translations';
import { KioskCategorySidebar } from './KioskCategorySidebar';
import { KioskItemList } from './KioskItemList';
import { KioskOrderPanel, OrderSuccessOverlay } from './KioskOrderPanel';
import { UserHistoryModal } from './UserHistoryModal';
import { useRfidScanner } from '../../hooks/useRfidScanner';

interface KioskViewProps {
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
  onToggleItem: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onOrder: (rfidOverride?: string) => void;
  onClearCart: () => void;
  onGoToManager: () => void;
  t: (key: string) => string;
}

export const KioskView: React.FC<KioskViewProps> = ({
  menu,
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
  onUpdateQuantity,
  onOrder,
  onClearCart,
  onGoToManager,
  t,
}) => {
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  
  // Category Navigation
  const categories = useMemo(() => Object.keys(groupedMenu), [groupedMenu]);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || '');

  // Ensure activeCategory stays valid
  React.useEffect(() => {
    if (!activeCategory && categories.length > 0) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const activeItems = useMemo(() => groupedMenu[activeCategory] || [], [groupedMenu, activeCategory]);

  useRfidScanner({
    active: selectedItems.length > 0 && !userHistoryOpen && orderButtonEnabled,
    onScan: (rfid) => {
      setRfid(rfid);
      onOrder(rfid);
    },
  });

  const displayDate = (() => {
    const now = new Date();
    const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    const target = new Date(now);
    if (kioskAutoTiming && currentHHmm >= kioskCloseTime) target.setDate(now.getDate() + 1);
    return target.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', { day: 'numeric', month: 'short' });
  })();

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F4F4F5] flex flex-col font-sans fixed-viewport items-stretch">
      {/* 1. Header — Compact 48px */}
      <header className="h-12 shrink-0 bg-white border-b border-neutral-200 px-4 flex items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-black text-neutral-900 tracking-tight uppercase">
            {t('kiosk.daily_menu')}
          </h1>
          <div className="h-4 w-[1px] bg-neutral-200" />
          <span className="text-xs font-bold text-neutral-400 uppercase">
            {displayDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setUserHistoryOpen(true)} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors">
            <Users className="w-4 h-4" />
          </button>
          <button onClick={onGoToManager} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-900 transition-colors">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Area — 3 Columns (Responsive) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Col 1: Categories (Narrow Sidebar on desktop, Top Tab Bar on tablet) */}
        <div className="flex shrink-0 md:w-40 bg-white border-b md:border-b-0 md:border-r border-neutral-200 overflow-x-auto md:overflow-y-auto no-scrollbar md:custom-scrollbar">
          <KioskCategorySidebar 
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            menu={menu}
            t={t}
          />
        </div>

        {/* Col 2: Items (Flexible) */}
        <KioskItemList
          items={activeItems}
          sideItems={sideItems}
          selectedItems={selectedItems}
          selectedItemIds={selectedItemIds}
          onToggle={onToggleItem}
          onAddWithSide={onAddWithSide}
          onUpdateQuantity={onUpdateQuantity}
          orderButtonEnabled={orderButtonEnabled}
          connectionError={connectionError}
          t={t}
        />

        {/* Col 3: Order Panel (Fixed Width) */}
        <div className="hidden sm:flex md:w-80 border-t md:border-t-0 md:border-l border-neutral-200">
          <KioskOrderPanel
            selectedItems={selectedItems}
            totalPrice={totalPrice}
            rfid={rfid}
            setRfid={setRfid}
            isScanning={isScanning}
            computedKioskOpen={computedKioskOpen}
            testModeEnabled={testModeEnabled}
            orderButtonEnabled={orderButtonEnabled}
            onOrder={() => onOrder(rfid || undefined)}
            onClearCart={onClearCart}
            onUpdateSide={() => {}}
            onUpdateQuantity={onUpdateQuantity}
            t={t}
          />
        </div>
      </main>

      {/* Overlays */}
      <OrderSuccessOverlay show={showSuccess} t={t} />
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 text-xs font-bold"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <UserHistoryModal isOpen={userHistoryOpen} onClose={() => setUserHistoryOpen(false)} t={t} />
    </div>
  );
};

export const KioskClosed: React.FC<{ onGoToManager: () => void; t: (key: string) => string; }> = ({ onGoToManager, t }) => (
  <div className="h-screen w-screen overflow-hidden bg-neutral-50 flex items-center justify-center p-8 fixed-viewport">
    <div className="bg-white p-10 rounded-[32px] shadow-2xl text-center max-w-md w-full border border-neutral-100">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
        <LogOut className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-3xl font-black text-neutral-900 mb-2 uppercase tracking-tight">{t('kiosk.ordering_closed')}</h1>
      <p className="text-neutral-400 text-sm">{t('kiosk.check_back_tomorrow')}</p>
      <button onClick={onGoToManager} className="mt-8 w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all">
        {t('navigation.admin_login')}
      </button>
    </div>
  </div>
);


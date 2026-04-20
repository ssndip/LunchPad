import React, { useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, AlertCircle, LogOut, Users, Maximize, Smartphone, AlertTriangle, Info, X } from 'lucide-react';
import { MenuItem, CartItem } from '../../types';
import { Language } from '../../translations';
import { KioskCategorySidebar } from './KioskCategorySidebar';
import { KioskItemList } from './KioskItemList';
import { KioskOrderPanel, OrderSuccessOverlay } from './KioskOrderPanel';
import { UserHistoryModal } from './UserHistoryModal';
import { useRfidScanner } from '../../hooks/useRfidScanner';
import { useResponsive } from '../../hooks/useResponsive';
import { usePWA } from '../../hooks/usePWA';
import { triggerHaptic } from '../../utils/haptics';
import { useStore } from '../../store/useStore';
import { PinPadModal } from '../shared/PinPadModal';

import { useTranslation } from '../../hooks/useTranslation';

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
  onToggleItem: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  onOrder: (rfidOverride?: string, pinOverride?: string) => void;
  onClearCart: () => void;
  onGoToManager: () => void;
  menuDate?: string;
  announcement?: string;
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
  onToggleItem,
  onAddWithSide,
  onUpdateQuantity,
  onOrder,
  onClearCart,
  onGoToManager,
  menuDate,
  announcement,
}) => {
  const { t, lang } = useTranslation();
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const { kioskModeEnabled } = useStore();
  const { isStandalone, enterFullscreen } = usePWA();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  
  // Category Navigation
  const categories = useMemo(() => Object.keys(groupedMenu), [groupedMenu]);
  const [activeCategory, setActiveCategory] = useState<string>(categories[0] || '');
  const { isPhone, isTablet } = useResponsive();

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

  const isMenuOutdated = useMemo(() => {
    if (!menuDate) return false;
    
    // Try to parse DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY
    const parts = menuDate.split(/[.\-/]/);
    if (parts.length !== 3) return false;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
    
    const menuD = new Date(year, month, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return menuD < today;
  }, [menuDate]);

  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientY;
    const distance = touchEnd - touchStart;
    
    // If user pulls down more than 150px, reload app
    if (distance > 150) {
      triggerHaptic('success');
      window.location.reload();
    }
    setTouchStart(null);
  };

  return (
    <div 
      className="h-screen w-screen overflow-hidden bg-[#F4F4F5] flex flex-col font-sans fixed-viewport items-stretch transition-colors duration-500"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 1. Header — Compact 48px with Glassmorphism */}
      <header className="h-14 shrink-0 glass-morphism flex items-center z-20 shadow-sm border-b-neutral-200/50">
        {/* Left Section — Matches Sidebar Width */}
        <div className="hidden md:flex shrink-0 md:w-[20%] xl:w-40 px-4 items-center gap-3">
          <motion.h1 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-[10px] lg:text-xs font-black text-neutral-900 tracking-tight uppercase"
          >
            {t('kiosk.daily_menu')}
          </motion.h1>
        </div>

        {/* Center Section — Matches Item List (flex-1) — Date Centered Here */}
        <div className="flex-1 flex items-center justify-center px-4 relative">
          <div className="flex md:hidden items-center absolute left-4">
             <h1 className="text-[10px] font-black text-neutral-900 uppercase tracking-tight">{t('kiosk.daily_menu')}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm md:text-lg font-black text-neutral-900 uppercase tracking-tight">
              {menuDate || displayDate}
            </span>
            {isMenuOutdated && (
              <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 rounded-full border border-orange-100 shadow-sm animate-pulse">
                <AlertTriangle className="w-3 h-3 text-orange-600" />
                <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">
                  {t('kiosk.menu_outdated')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Section — Matches Order Panel Width */}
        <div className="flex shrink-0 md:w-[35%] lg:w-80 px-4 items-center justify-end gap-2">
          {kioskModeEnabled && isStandalone && !document.fullscreenElement && (
            <button 
              onClick={enterFullscreen}
              className="p-2 rounded-xl bg-violet-600 text-white shadow-md hover:bg-violet-700 transition-all active:scale-95"
              title="Fullscreen"
              aria-label="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>
          )}
          <button 
            onClick={() => setUserHistoryOpen(true)} 
            className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all active:scale-95 shadow-sm border border-neutral-100" 
            title={t('kiosk.user_history_title')} 
            aria-label={t('kiosk.user_history_title')}
          >
            <Users className="w-5 h-5" />
          </button>
          <button 
            onClick={onGoToManager} 
            className="p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-all active:scale-95 shadow-sm border border-neutral-100" 
            title={t('navigation.admin_login')} 
            aria-label={t('navigation.admin_login')}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>
      
      {/* 1.5 Announcement Banner */}
      <AnimatePresence>
        {announcement && !announcementDismissed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-blue-600 text-white shrink-0 relative overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 shrink-0" />
                <p className="text-sm font-bold leading-tight">
                  {announcement}
                </p>
              </div>
              <button 
                onClick={() => setAnnouncementDismissed(true)}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                title={t('modals.close')}
                aria-label={t('modals.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* 2. Main Area — 3 Columns (Responsive) */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Col 1: Categories (Horizontal Top Bar on Phone, Vertical Sidebar on Tablet/Desktop) */}
        <div className="flex shrink-0 md:w-[20%] xl:w-40 bg-white border-b md:border-b-0 md:border-r border-neutral-200 overflow-x-auto md:overflow-y-auto no-scrollbar md:custom-scrollbar">
          <KioskCategorySidebar 
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            menu={menu}
            t={t}
          />
        </div>

        {/* Col 2: Items (Flexible Grid on Tablet, List on Phone) */}
        <div className="flex-1 overflow-hidden relative">
          <KioskItemList
            items={activeItems}
            sideItems={sideItems}
            selectedItems={selectedItems}
            selectedItemIds={selectedItemIds}
            onToggle={onToggleItem}
            onAddWithSide={onAddWithSide}
            onUpdateQuantity={onUpdateQuantity}
            orderButtonEnabled={orderButtonEnabled}
            isMenuOutdated={isMenuOutdated}
            connectionError={connectionError}
            t={t}
          />
        </div>

        {/* Col 3: Order Panel (Fixed Right Panel Tablet/Desktop, Bottom Sheet Phone) */}
        <div className="md:w-[35%] lg:w-80 md:border-t-0 md:border-l border-neutral-200">
          <KioskOrderPanel
            selectedItems={selectedItems}
            totalPrice={totalPrice}
            rfid={rfid}
            setRfid={setRfid}
            isScanning={isScanning}
            computedKioskOpen={computedKioskOpen}
            testModeEnabled={testModeEnabled}
            orderButtonEnabled={orderButtonEnabled && !isMenuOutdated}
            onOrder={() => onOrder(rfid || undefined)}
            onPinOrder={() => setPinModalOpen(true)}
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
      
      <PinPadModal 
        isOpen={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        onSubmit={(pin) => {
          setPinModalOpen(false);
          onOrder(undefined, pin);
        }}
        t={t}
      />
    </div>
  );
};

export const KioskClosed: React.FC<{ onGoToManager: () => void; }> = ({ onGoToManager }) => {
  const { t } = useTranslation();
  return (
    <div className="h-screen w-screen overflow-hidden bg-white flex items-center justify-center p-8 fixed-viewport">
      {/* Dynamic background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-100/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-100/20 rounded-full blur-[100px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 glass-morphism p-12 rounded-[48px] shadow-2xl text-center max-w-md w-full border border-white/60"
      >
        <motion.div 
          initial={{ rotate: -10, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", damping: 10 }}
          className="w-24 h-24 premium-gradient-neutral rounded-[32px] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-neutral-200"
        >
          <LogOut className="w-10 h-10 text-white" />
        </motion.div>
        
        <h1 className="text-3xl font-black text-neutral-900 mb-3 uppercase tracking-tighter leading-none">
          {t('kiosk.ordering_closed')}
        </h1>
        <p className="text-neutral-500 font-medium text-sm mb-10 px-4">
          {t('kiosk.check_back_tomorrow')}
        </p>
        
        <button 
          onClick={onGoToManager} 
          className="w-full py-5 premium-gradient-neutral text-white rounded-3xl font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-neutral-200 hover:scale-[1.02] active:scale-95 transition-all"
        >
          {t('navigation.admin_login')}
        </button>
      </motion.div>
    </div>
  );
};


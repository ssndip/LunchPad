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
  
  // Feature: Multi-Day Navigation
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(menu.map(i => i.date).filter(Boolean)));
    return dates.sort();
  }, [menu]);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    // Handle YYYY-MM-DD
    if (dateStr.includes('-')) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    // Handle DD.MM.YYYY or DD/MM/YYYY
    const parts = dateStr.split(/[./]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const todayStr = today.toISOString().split('T')[0];

  // Find the "Ordering Date" (The active schedule)
  // Per user request: Closest date on or before today if available, otherwise first future
  const orderingDate = useMemo(() => {
    if (availableDates.length === 0) return '';
    
    const parsedDates = availableDates.map(d => ({ str: d, time: parseDate(d).getTime() }));
    
    // 1. Try to find today exactly
    const todayEntry = parsedDates.find(d => d.time === todayTime);
    if (todayEntry) return todayEntry.str;
    
    // 2. Find closest BEFORE today
    const pastEntries = parsedDates.filter(d => d.time < todayTime).sort((a, b) => b.time - a.time);
    if (pastEntries.length > 0) return pastEntries[0].str;
    
    // 3. Fallback to first future
    return availableDates[0];
  }, [availableDates, todayTime]);

  const [selectedDate, setSelectedDate] = useState<string>(orderingDate);

  // Sync selectedDate if orderingDate changes (e.g. menu loads)
  React.useEffect(() => {
    if (orderingDate && !selectedDate) {
      setSelectedDate(orderingDate);
    }
  }, [orderingDate, selectedDate]);

  const isReadOnly = useMemo(() => {
    if (!selectedDate || !orderingDate) return false;
    return selectedDate !== orderingDate;
  }, [selectedDate, orderingDate]);

  // Filter and Group Menu by selected date
  const filteredMenu = useMemo(() => {
    if (availableDates.length === 0) return menu;
    return menu.filter(i => i.date === selectedDate);
  }, [menu, selectedDate, availableDates]);

  const filteredGroupedMenu = useMemo(() => {
    return filteredMenu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [filteredMenu]);

  // Category Navigation
  const categories = useMemo(() => Object.keys(filteredGroupedMenu), [filteredGroupedMenu]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const { isPhone, isTablet } = useResponsive();

  // Ensure activeCategory stays valid
  React.useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] || '');
    }
  }, [categories, activeCategory]);

  const activeItems = useMemo(() => filteredGroupedMenu[activeCategory] || [], [filteredGroupedMenu, activeCategory]);

  useRfidScanner({
    active: selectedItems.length > 0 && !userHistoryOpen && orderButtonEnabled && !isReadOnly,
    onScan: (rfid) => {
      setRfid(rfid);
      onOrder(rfid);
    },
  });

  const formatDateLabel = (dateStr: string) => {
    const d = parseDate(dateStr);
    if (isNaN(d.getTime()) || d.getTime() === 0) return { dayName: '???', fullDate: dateStr };
    
    const dayName = d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', { weekday: 'long' });
    const fullDate = d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { dayName, fullDate };
  };

  const isMenuOutdated = useMemo(() => {
    if (!selectedDate) return false;
    const menuD = parseDate(selectedDate);
    if (isNaN(menuD.getTime())) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return menuD < today;
  }, [selectedDate]);

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
      <header className="h-16 shrink-0 glass-morphism flex items-center z-20 shadow-sm border-b-neutral-200/50">
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

        {/* Center Section — Date Picker Tabs */}
        <div className="flex-1 flex items-center justify-center px-4 overflow-x-auto no-scrollbar gap-2">
          {availableDates.length > 0 ? (
            availableDates.map(date => {
              const { dayName, fullDate } = formatDateLabel(date);
              const isActive = selectedDate === date;
              const isOrdering = date === orderingDate;

              return (
                <button
                  key={date}
                  onClick={() => { triggerHaptic('light'); setSelectedDate(date); }}
                  className={`flex flex-col items-center justify-center min-w-[120px] h-12 rounded-2xl transition-all relative ${
                    isActive 
                      ? 'bg-neutral-900 text-white shadow-lg scale-105' 
                      : 'bg-white/50 text-neutral-500 hover:bg-white border border-neutral-100'
                  }`}
                >
                  <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-white/60' : 'text-neutral-400'}`}>
                    {dayName}
                  </span>
                  <span className="text-xs font-black leading-none mt-0.5">
                    {fullDate}
                  </span>
                  {isOrdering && (
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                  )}
                </button>
              );
            })
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm md:text-lg font-black text-neutral-900 uppercase tracking-tight">
                {menuDate || todayStr}
              </span>
            </div>
          )}
          
          {isReadOnly && (
             <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-xl shadow-xl ml-4">
                <Info className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-black uppercase tracking-widest">Preview Mode</span>
             </div>
          )}
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
            orderButtonEnabled={orderButtonEnabled && !isReadOnly}
            isMenuOutdated={isMenuOutdated}
            connectionError={connectionError}
            isReadOnly={isReadOnly}
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
            orderButtonEnabled={orderButtonEnabled && !isMenuOutdated && !isReadOnly}
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


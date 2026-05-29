import React, { useState, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, AlertCircle, LogOut, Users, Maximize, Smartphone, AlertTriangle, Info, X, CreditCard } from 'lucide-react';
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
  successMessage?: string | null;
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
  preIdentificationEnabled?: boolean;
  onIdentify?: (rfid: string) => void;
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
  successMessage,
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
  preIdentificationEnabled,
  onIdentify,
}) => {
  const { t, lang } = useTranslation();
  const rfidInputRef = useRef<HTMLInputElement>(null);

  const [userHistoryOpen, setUserHistoryOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const { kioskModeEnabled } = useStore();
  const { isStandalone, enterFullscreen } = usePWA();
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [pendingItem, setPendingItem] = useState<MenuItem | null>(null);
  
  // Feature: Multi-Day Navigation
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(menu.map(i => i.date).filter(Boolean)));
    return dates.sort();
  }, [menu]);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date(0);
    // Handle YYYY-MM-DD
    if (dateStr.includes('-') && dateStr.split('-').length === 3) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    // Handle DD.MM.YYYY, DD/MM/YYYY, DD.MM, or DD/MM
    const parts = dateStr.split(/[./-]/);
    if (parts.length >= 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parts.length === 3 
        ? (parts[2].length === 2 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10))
        : new Date().getFullYear();
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };


  const handleToggle = useCallback((item: MenuItem) => {
    if (preIdentificationEnabled && !rfid && !testModeEnabled) {
      setPendingItem(item);
      setIsIdentifying(true);
      return;
    }
    onToggleItem(item);
  }, [preIdentificationEnabled, rfid, testModeEnabled, onToggleItem]);

  const handleItemAddWithSide = useCallback((item: MenuItem, side?: string) => {
    if (preIdentificationEnabled && !rfid && !testModeEnabled) {
      setPendingItem(item);
      setIsIdentifying(true);
      return;
    }
    onAddWithSide(item, side);
  }, [preIdentificationEnabled, rfid, testModeEnabled, onAddWithSide]);

  const handleUpdateSide = useCallback(() => {}, []);

  const handleOrderSubmit = useCallback(() => onOrder(rfid || undefined), [onOrder, rfid]);
  const handlePinOrder = useCallback(() => setPinModalOpen(true), []);

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

  const isMenuOutdated = useMemo(() => {
    if (!selectedDate) return false;
    const menuD = parseDate(selectedDate);
    if (isNaN(menuD.getTime())) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return menuD < today;
  }, [selectedDate]);

  const isReadOnly = useMemo(() => {
    return isMenuOutdated;
  }, [isMenuOutdated]);

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
  const categories = useMemo(() => {
    const cats = Object.keys(filteredGroupedMenu);
    const normalCats = cats.filter(c => c.toLowerCase() !== 'други' && c.toLowerCase() !== 'other');
    const otherCats = cats.filter(c => c.toLowerCase() === 'други' || c.toLowerCase() === 'other');
    return [...normalCats, ...otherCats];
  }, [filteredGroupedMenu]);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const { isPhone, isTablet, useMobileLayout } = useResponsive();

  // Ensure activeCategory stays valid
  React.useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory(categories[0] || '');
    }
  }, [categories, activeCategory]);

  const activeItems = useMemo(() => filteredGroupedMenu[activeCategory] || [], [filteredGroupedMenu, activeCategory]);



  useRfidScanner({
    active: ((isIdentifying || selectedItems.length > 0 || (preIdentificationEnabled && !rfid)) && !userHistoryOpen && orderButtonEnabled && !isReadOnly),
    onScan: (scannedRfid) => {
      if (preIdentificationEnabled) {
        // If scanning a DIFFERENT card than the current session
        if (scannedRfid !== rfid) {
          if (onIdentify) onIdentify(scannedRfid);
          setIsIdentifying(false);
          triggerHaptic('success');
          
          // If we were waiting for identification to add an item
          if (pendingItem) {
            onToggleItem(pendingItem);
            setPendingItem(null);
          }
        } else {
          // If scanning the SAME card, proceed to order
          onOrder(scannedRfid);
        }
      } else {
        setRfid(scannedRfid);
        onOrder(scannedRfid);
      }
    },
  });

  const formatDateLabel = (dateStr: string) => {
    const d = parseDate(dateStr);
    if (isNaN(d.getTime()) || d.getTime() === 0) return { dayName: '???', fullDate: dateStr };
    
    const dayName = d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', { weekday: 'long' });
    const fullDate = d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return { dayName, fullDate };
  };



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
                <span className="text-[10px] font-black uppercase tracking-widest">
                  {isMenuOutdated ? t('kiosk.historical_view') : t('kiosk.preview_mode')}
                </span>
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
          {preIdentificationEnabled && rfid && (
            <button 
              onClick={() => { triggerHaptic('medium'); onClearCart(); if (onIdentify) onIdentify(''); }} 
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-500 transition-all active:scale-95 border border-red-100 group" 
              title={t('kiosk.logout')} 
              aria-label={t('kiosk.logout')}
            >
              <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">{t('kiosk.logout')}</span>
              <span className="text-[8px] font-mono opacity-50 ml-1 hidden lg:inline">({rfid})</span>
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


      {/* 2. Main Area — 3 Columns (Responsive based on orientation & width) */}
      <main className={`flex-1 flex overflow-hidden relative ${useMobileLayout ? 'flex-col' : 'flex-row'}`}>
        {/* Col 1: Categories (Horizontal Top Bar on Mobile & Portrait Tablet, Vertical Sidebar on Desktop & Landscape Tablet) */}
        <div className={`flex shrink-0 bg-white border-neutral-200 ${useMobileLayout ? 'border-b overflow-x-auto no-scrollbar' : 'md:w-[20%] xl:w-40 border-r overflow-y-auto custom-scrollbar'}`}>
          <KioskCategorySidebar 
            categories={categories}
            activeCategory={activeCategory}
            onSelect={setActiveCategory}
            menu={menu}
            t={t}
            customCategories={useStore(s => s.customCategories) || []}
            lang={lang}
          />
        </div>

        {/* Col 2: Items (Flexible Grid / List) */}
        <div className="flex-1 overflow-hidden relative">
          <KioskItemList
            items={activeItems}
            sideItems={sideItems}
            selectedItems={selectedItems}
            selectedItemIds={selectedItemIds}
            onToggle={handleToggle}
            onAddWithSide={handleItemAddWithSide}
            onUpdateQuantity={onUpdateQuantity}
            orderButtonEnabled={orderButtonEnabled && !isReadOnly}
            isMenuOutdated={isMenuOutdated}
            connectionError={connectionError}
            isReadOnly={isReadOnly}
            t={t}
          />
        </div>

        {/* Col 3: Order Panel (Fixed Right Panel on Widescreen, hidden on Mobile & Portrait Tablet where it renders as sticky bottom drawer) */}
        <div className={useMobileLayout ? 'hidden' : 'md:w-[35%] lg:w-80 border-l border-neutral-200'}>
          <KioskOrderPanel
            selectedItems={selectedItems}
            totalPrice={totalPrice}
            rfid={rfid}
            setRfid={setRfid}
            isScanning={isScanning}
            computedKioskOpen={computedKioskOpen}
            testModeEnabled={testModeEnabled}
            orderButtonEnabled={orderButtonEnabled && !isMenuOutdated && !isReadOnly}
            onOrder={handleOrderSubmit}
            onPinOrder={handlePinOrder}
            onClearCart={onClearCart}
            onUpdateSide={handleUpdateSide}
            onUpdateQuantity={onUpdateQuantity}
            t={t}
          />
        </div>
      </main>

      {/* Overlays */}
      <OrderSuccessOverlay show={showSuccess} message={successMessage || undefined} t={t} />
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

      <AnimatePresence>
        {(isIdentifying || (preIdentificationEnabled && !rfid && selectedItems.length > 0 && !pendingItem)) && !userHistoryOpen && !pinModalOpen && computedKioskOpen && !isReadOnly && (
          <IdentificationOverlay 
            t={t} 
            onIdentify={(scanned) => {
              if (onIdentify) onIdentify(scanned);
              setIsIdentifying(false);
              triggerHaptic('success');
              if (pendingItem) {
                onToggleItem(pendingItem);
                setPendingItem(null);
              }
            }} 
            onClose={() => {
              setIsIdentifying(false);
              setPendingItem(null);
              // If we have items but no user, and they click X, clear items to allow closing
              if (!rfid && selectedItems.length > 0) {
                onClearCart();
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const IdentificationOverlay: React.FC<{ t: any; onIdentify: (rfid: string) => void, onClose: () => void }> = ({ t, onIdentify, onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-neutral-900/60 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="max-w-md w-full bg-white rounded-[48px] p-12 text-center shadow-2xl border border-white/20 relative overflow-hidden"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition-all active:scale-90"
          title={t('modals.close') || 'Close'}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="absolute top-0 left-0 w-full h-2 bg-neutral-900" />
        
        <div className="relative mb-10">
          <div className="w-24 h-24 bg-neutral-50 rounded-[32px] flex items-center justify-center mx-auto mb-4 relative z-10">
            <CreditCard className="w-10 h-10 text-neutral-900" />
          </div>
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-neutral-200 rounded-full blur-3xl z-0"
          />
        </div>

        <h2 className="text-3xl font-black text-neutral-900 mb-4 uppercase tracking-tighter">
          {t('kiosk.pre_identification_title')}
        </h2>
        <p className="text-neutral-500 font-bold text-sm mb-8 px-6 leading-relaxed">
          {t('kiosk.pre_identification_desc')}
        </p>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-3 py-4 px-6 bg-neutral-50 rounded-2xl border border-neutral-100">
            <div className="w-2 h-2 rounded-full bg-neutral-900 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-900">
              {t('kiosk.waiting_for_scan')}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
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


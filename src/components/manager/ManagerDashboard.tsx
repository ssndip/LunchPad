import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Menu as MenuIcon,
  ShoppingBag,
  History,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  TrendingUp,
  BarChart2,
  Terminal,
} from 'lucide-react';
import { Language } from '../../translations';
import { useResponsive } from '../../hooks/useResponsive';

import { useTranslation } from '../../hooks/useTranslation';

interface ManagerDashboardProps {
  activeTab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules';
  onTabChange: (tab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules') => void;
  onLogout: () => void;
  children: React.ReactNode;
  kioskOpen: boolean;
  onToggleKiosk: (open: boolean) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  children,
  kioskOpen,
  onToggleKiosk,
}) => {
  const { t, lang } = useTranslation();
  const { isPhone, isTablet, isDesktop } = useResponsive();

  const menuItems = [
    { id: 'menu', icon: MenuIcon, label: t('navigation.menu_management') },
    { id: 'orders', icon: TrendingUp, label: t('navigation.order_summary') },
    { id: 'cards', icon: CreditCard, label: t('navigation.card_management') },
    { id: 'analytics', icon: BarChart2, label: t('navigation.analytics') },
    { id: 'parser_rules', icon: Terminal, label: 'Parser Rules' },
    { id: 'settings', icon: Settings, label: t('navigation.system_settings') },
  ];

  // Desktop Side Navigation
  const DesktopNav = () => (
    <aside className="hidden lg:flex w-80 bg-white border-r border-neutral-100 flex-col shrink-0 z-20">
      <div className="p-8 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center text-white shadow-md">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter">LunchPad</h2>
        </div>
        <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest ml-1">
          {t('navigation.dashboard')}
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all group active:scale-95 ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200 invert-0'
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                <span className="font-bold text-sm">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="w-4 h-4 opacity-50" />}
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-neutral-50">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3.5 text-red-500 rounded-xl hover:bg-red-50 transition-all font-bold text-sm active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span>{t('navigation.logout')}</span>
        </button>
      </div>
    </aside>
  );

  // Tablet Top Navigation
  const TabletNav = () => (
    <nav className="hidden md:flex lg:hidden w-full bg-white border-b border-neutral-100 shrink-0 z-20 overflow-x-auto no-scrollbar items-center px-4 h-16">
      <div className="flex items-center gap-2 mr-6 shrink-0">
        <div className="w-8 h-8 bg-neutral-900 rounded-xl flex items-center justify-center text-white">
          <ShoppingBag className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-center gap-1">
        {menuItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap active:scale-95 ${
                isActive
                  ? 'bg-neutral-900 text-white shadow-md'
                  : 'text-neutral-500 hover:bg-neutral-50'
              }`}
            >
              <item.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
              <span className="font-bold text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="ml-auto flex items-center pl-4 border-l border-neutral-100">
        <button onClick={onLogout} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all">
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );

  // Phone Bottom Navigation
  const PhoneBottomNav = () => (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-3xl border-t border-white/60 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_50px_rgba(0,0,0,0.1)]">
      <div className="flex w-full justify-around items-center h-[72px] px-1 relative">
        {menuItems.filter(i => i.id !== 'settings').map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 active:scale-95 transition-transform"
            >
              <div className={`p-1 transition-all z-10 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
              </div>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-x-2 inset-y-2 bg-neutral-900/5 rounded-2xl z-0 pointer-events-none"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
              <span className={`text-[9px] font-bold z-10 truncate w-full text-center transition-colors ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <div className="h-[100dvh] w-[100vw] overflow-hidden bg-[#F8F9FA] flex flex-col lg:flex-row text-neutral-900 font-sans fixed-viewport">
      <DesktopNav />
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col relative w-full pb-[env(safe-area-inset-bottom)] md:pb-0 mb-16 md:mb-0">
        <TabletNav />
        
        {/* Top Header Shell (Visible on all breakpoints, but adjusted for mobile) */}
        <header className="h-16 lg:h-20 bg-white/80 backdrop-blur-md border-b border-neutral-100 shrink-0 flex items-center justify-between px-4 lg:px-10 z-10 sticky top-0">
          <div className="flex items-center gap-2 lg:gap-4">
            <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-1.5 lg:py-2 bg-white rounded-full border border-neutral-100 shadow-sm">
              <div className={`w-2 h-2 rounded-full animate-pulse ${kioskOpen ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="hidden sm:inline text-[9px] lg:text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                {t('settings.kiosk_status')}: {kioskOpen ? t('modals.open') : t('modals.close')}
              </span>
              <button
                onClick={() => onToggleKiosk(!kioskOpen)}
                className={`ml-1 lg:ml-2 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                  kioskOpen 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
              >
                {kioskOpen ? t('modals.close') : t('modals.open')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Setting & Logout Buttons (visible entirely on Mobile so they don't clog bottom bar) */}
            <div className="flex md:hidden items-center gap-1.5 mr-1 border-r border-neutral-200 pr-2">
              <button 
                onClick={() => onTabChange('settings')} 
                className={`p-2 rounded-full transition-all active:scale-95 ${activeTab === 'settings' ? 'bg-neutral-900 text-white shadow-md' : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-600'}`}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={onLogout} 
                className="p-2 rounded-full bg-red-50 hover:bg-red-100 text-red-500 transition-all active:scale-95"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <span className="hidden sm:inline text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
              {lang === 'bg' ? 'Български' : 'English'}
            </span>
            <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              <span className="text-[10px] font-black text-neutral-900">{lang.toUpperCase()}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Content — scrolls internally */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 hide-scrollbar-on-mobile">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="max-w-[var(--app-max-width)] mx-auto"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <PhoneBottomNav />
    </div>
  );
};

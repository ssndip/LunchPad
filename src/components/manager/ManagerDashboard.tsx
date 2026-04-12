import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Menu as MenuIcon,
  ShoppingBag,
  History,
  CreditCard,
  Settings,
  LogOut,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Language } from "../../translations";

interface ManagerDashboardProps {
  activeTab: "menu" | "orders" | "history" | "cards" | "settings";
  onTabChange: (
    tab: "menu" | "orders" | "history" | "cards" | "settings",
  ) => void;
  onLogout: () => void;
  lang: Language;
  t: (key: string) => string;
  children: React.ReactNode;
  kioskOpen: boolean;
  onToggleKiosk: (open: boolean) => void;
}

export const ManagerDashboard: React.FC<ManagerDashboardProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  lang,
  t,
  children,
  kioskOpen,
  onToggleKiosk,
}) => {
  const menuItems = [
    { id: "menu", icon: MenuIcon, label: t("navigation.menu_management") },
    { id: "orders", icon: TrendingUp, label: t("navigation.order_summary") },
    { id: "history", icon: History, label: t("navigation.history") },
    { id: "cards", icon: CreditCard, label: t("navigation.card_management") },
    { id: "settings", icon: Settings, label: t("navigation.system_settings") },
  ];

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#F8F9FA] flex text-neutral-900 font-sans">
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-neutral-100 flex flex-col shrink-0">
        <div className="p-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-neutral-900 rounded-2xl flex items-center justify-center text-white">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">
              LunchPad
            </h2>
          </div>
          <p className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-widest ml-1">
            Manager Control
          </p>
        </div>

        <nav className="flex-1 px-6 space-y-1">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as any)}
                className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all group ${
                  isActive
                    ? "bg-neutral-900 text-white shadow-xl shadow-neutral-100 invert-0"
                    : "text-neutral-400 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
              >
                <div className="flex items-center gap-4">
                  <item.icon className="w-5 h-5" />
                  <span className="font-bold text-sm">{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-4 h-4" />}
              </button>
            );
          })}
        </nav>

        <div className="p-8 border-t border-neutral-50">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-4 px-5 py-4 text-red-500 rounded-2xl hover:bg-red-50 transition-all font-bold text-sm"
          >
            <LogOut className="w-5 h-5" />
            <span>{t("navigation.logout")}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {/* Top Header Shell */}
        <header className="h-20 bg-white/50 backdrop-blur-md border-b border-neutral-100 shrink-0 flex items-center justify-between px-10">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-neutral-100 shadow-sm">
              <div
                className={`w-2 h-2 rounded-full animate-pulse ${kioskOpen ? "bg-green-500" : "bg-red-500"}`}
              />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
                Kiosk: {kioskOpen ? "Open" : "Closed"}
              </span>
              <button
                onClick={() => onToggleKiosk(!kioskOpen)}
                className={`ml-2 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                  kioskOpen
                    ? "bg-red-50 text-red-600 hover:bg-red-100"
                    : "bg-green-50 text-green-600 hover:bg-green-100"
                }`}
              >
                {kioskOpen ? "Close" : "Open"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">
              {lang === "bg" ? "Български" : "English"}
            </span>
            <div className="w-8 h-8 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
              <span className="text-[10px] font-black text-neutral-900">
                {lang.toUpperCase()}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Content — scrolls internally */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

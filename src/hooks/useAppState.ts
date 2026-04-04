/**
 * useAppState.ts — The single source of truth for the LunchPad application state.
 * Extracts all useState, useMemo, and business logic from the monolithic App.tsx.
 */
import { useState, useMemo, useCallback } from 'react';
import { MenuItem, Order, Card, DailySummary, CartItem, UserProfile } from '../types';
import { Language } from '../translations';

export function useAppState() {
  // ─── View State ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<'kiosk' | 'manager'>('kiosk');
  const [activeTab, setActiveTab] = useState<'menu' | 'orders' | 'history' | 'cards' | 'settings'>('menu');
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('lang');
    return (saved as Language) || 'bg';
  });

  // ─── Data State ─────────────────────────────────────────────────────────────
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  
  // ─── Kiosk Ordering State ───────────────────────────────────────────────────
  const [selectedItems, setSelectedItems] = useState<CartItem[]>([]);
  const [rfid, setRfid] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ─── Manager Credentials / Form State ──────────────────────────────────────
  const [adminPin, setAdminPin] = useState<string | null>(() => sessionStorage.getItem('adminPin'));
  const [isManagerLoggedIn, setIsManagerLoggedIn] = useState(!!sessionStorage.getItem('adminPin'));
  
  // Editing Menu (local copy for Manager Dashboard)
  const [editingMenu, setEditingMenu] = useState<MenuItem[]>([]);
  
  // Card Management Form
  const [newCardRfid, setNewCardRfid] = useState('');
  const [newCardOwner, setNewCardOwner] = useState('');
  const [newCardIsAdmin, setNewCardIsAdmin] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isScanningForCard, setIsScanningForCard] = useState(false);
  const [pasteCardsText, setPasteCardsText] = useState('');
  const [isPasteCardsModalOpen, setIsPasteCardsModalOpen] = useState(false);

  // Orders History Filters
  const [historyFilters, setHistoryFilters] = useState({
    startDate: '',
    endDate: '',
    rfid: '',
    ownerName: '',
  });

  // Settings Toggles
  const [globalAccess, setGlobalAccess] = useState(true);
  const [orderButtonEnabled, setOrderButtonEnabled] = useState(true);
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [kioskOpen, setKioskOpen] = useState(false);

  // PIN Change Form
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinUpdateStatus, setPinUpdateStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Daily Summary Detail Expansion
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [dailyDetails, setDailyDetails] = useState<any[]>([]);

  // ─── Derived Values ────────────────────────────────────────────────────────
  
  /** Group menu items by category for the grid display */
  const groupedMenu = useMemo(() => {
    return menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);

  /** List of all available side items for the SideDishPicker */
  const sideItems = useMemo(() => {
    return menu.filter(item => 
      item.available && (item.category === 'Side Dishes' || item.category === 'Гарнитури')
    );
  }, [menu]);

  /** Total price of everything currently in the kiosk cart */
  const totalPrice = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price, 0);
  }, [selectedItems]);

  /** Set of selected item IDs for efficient lookups in the grid */
  const selectedItemIds = useMemo(() => new Set(selectedItems.map(i => i.id)), [selectedItems]);

  /** 
   * Determines if the kiosk is currently open based on either manual toggle
   * or automated timing logic.
   */
  const computedKioskOpen = kioskOpen;

  // ─── Actions ───────────────────────────────────────────────────────────────

  const resetCart = useCallback(() => {
    setSelectedItems([]);
    setRfid('');
  }, []);

  const changeLang = useCallback((l: Language) => {
    setLang(l);
    localStorage.setItem('lang', l);
  }, []);

  const loginManager = useCallback((pin: string) => {
    sessionStorage.setItem('adminPin', pin);
    setAdminPin(pin);
    setIsManagerLoggedIn(true);
  }, []);

  const logoutManager = useCallback(() => {
    sessionStorage.removeItem('adminPin');
    setAdminPin(null);
    setIsManagerLoggedIn(false);
    setMode('kiosk');
  }, []);

  return {
    // View State
    mode, setMode,
    activeTab, setActiveTab,
    lang, changeLang,
    // Data
    menu, setMenu,
    orders, setOrders,
    cards, setCards,
    summaries, setSummaries,
    // Kiosk Ordering
    selectedItems, setSelectedItems,
    selectedItemIds, totalPrice,
    rfid, setRfid,
    isScanning, setIsScanning,
    showSuccess, setShowSuccess,
    error, setError,
    connectionError, setConnectionError,
    // Manager
    adminPin, setAdminPin,
    isManagerLoggedIn, setIsManagerLoggedIn,
    loginManager, logoutManager,
    editingMenu, setEditingMenu,
    // Forms
    newCardRfid, setNewCardRfid,
    newCardOwner, setNewCardOwner,
    newCardIsAdmin, setNewCardIsAdmin,
    lastScanned, setLastScanned,
    isScanningForCard, setIsScanningForCard,
    pasteCardsText, setPasteCardsText,
    isPasteCardsModalOpen, setIsPasteCardsModalOpen,
    historyFilters, setHistoryFilters,
    // Settings
    globalAccess, setGlobalAccess,
    orderButtonEnabled, setOrderButtonEnabled,
    testModeEnabled, setTestModeEnabled,
    kioskOpen, setKioskOpen,
    newPin, setNewPin,
    confirmPin, setConfirmPin,
    pinUpdateStatus, setPinUpdateStatus,
    // Summaries
    expandedDate, setExpandedDate,
    dailyDetails, setDailyDetails,
    // Derived
    groupedMenu,
    sideItems,
    computedKioskOpen,
    resetCart,
  };
}

import { create } from 'zustand';
import { MenuItem, Order, Card, DailySummary, CartItem } from '../types';
import { Language } from '../translations';

interface AppState {
  // --- View State ---
  mode: 'kiosk' | 'manager';
  activeTab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules';
  lang: string;
  dynamicTranslations: Record<string, any>;
  availableLanguages: { code: string, name: string }[];
  
  // --- Data ---
  menu: MenuItem[];
  orders: Order[];
  history: Order[];
  deliveryFee: number;
  packagingFee: number;
  cards: Card[];
  summaries: DailySummary[];
  menuVersion: number;
  menuDate: string;
  
  // --- Kiosk Ordering ---
  selectedItems: CartItem[];
  rfid: string;
  isScanning: boolean;
  showSuccess: boolean;
  error: string | null;
  connectionError: string | null;
  
  // --- Manager ---
  token: string | null;
  isManagerLoggedIn: boolean;
  editingMenu: MenuItem[];
  newCardRfid: string;
  newCardOwner: string;
  newCardIsAdmin: boolean;
  newCardPin: string;
  lastScanned: string | null;
  isScanningForCard: boolean;
  pasteCardsText: string;
  isPasteCardsModalOpen: boolean;
  historyFilters: {
    startDate: string;
    endDate: string;
    rfid: string;
    ownerName: string;
  };
  analyticsFilters: {
    startDate: string;
    endDate: string;
    rfid: string;
  };
  
  // --- Settings ---
  adminWhitelistEnabled: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskOpen: boolean;
  kioskAutoTiming: boolean;
  kioskOpenTime: string;
  kioskCloseTime: string;
  kioskCloseDay: number;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  bgnEnabled: boolean;
  adminWhitelist: string;
  
  // --- PIN Change ---
  newPin: string;
  confirmPin: string;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  isSyncing: boolean;
  
  // --- Summaries ---
  expandedDate: string | null;
  dailyDetails: any[];
  dailySides: any[];

  // --- Actions ---
  setMode: (mode: 'kiosk' | 'manager') => void;
  setActiveTab: (tab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules') => void;
  setLang: (lang: Language) => void;
  setMenu: (menu: MenuItem[]) => void;
  setOrders: (orders: Order[]) => void;
  setHistory: (history: Order[]) => void;
  setCards: (cards: Card[]) => void;
  setDeliveryFee: (fee: number) => void;
  setPackagingFee: (fee: number) => void;
  setSummaries: (summaries: DailySummary[]) => void;
  setMenuVersion: (v: number) => void;
  setMenuDate: (date: string) => void;
  setSelectedItems: (items: CartItem[]) => void;
  setRfid: (rfid: string) => void;
  setIsScanning: (v: boolean) => void;
  setShowSuccess: (v: boolean) => void;
  setError: (v: string | null) => void;
  setConnectionError: (v: string | null) => void;
  setToken: (token: string | null) => void;
  setIsManagerLoggedIn: (v: boolean) => void;
  setEditingMenu: (menu: MenuItem[]) => void;
  setNewCardRfid: (v: string) => void;
  setNewCardOwner: (v: string) => void;
  setNewCardIsAdmin: (v: boolean) => void;
  setNewCardPin: (v: string) => void;
  setLastScanned: (v: string | null) => void;
  setIsScanningForCard: (v: boolean) => void;
  setPasteCardsText: (v: string) => void;
  setIsPasteCardsModalOpen: (v: boolean) => void;
  setHistoryFilters: (filters: any) => void;
  setAnalyticsFilters: (filters: any) => void;
  setAdminWhitelistEnabled: (v: boolean) => void;
  setOrderButtonEnabled: (v: boolean) => void;
  setTestModeEnabled: (v: boolean) => void;
  setKioskOpen: (v: boolean) => void;
  setKioskAutoTiming: (v: boolean) => void;
  setKioskOpenTime: (v: string) => void;
  setKioskCloseTime: (v: string) => void;
  setKioskCloseDay: (v: number) => void;
  setKioskModeEnabled: (v: boolean) => void;
  setAllowPWAInstall: (v: boolean) => void;
  setBgnEnabled: (v: boolean) => void;
  setAdminWhitelist: (v: string) => void;
  setNewPin: (v: string) => void;
  setConfirmPin: (v: string) => void;
  setPinUpdateStatus: (v: 'idle' | 'loading' | 'success' | 'error') => void;
  setExpandedDate: (v: string | null) => void;
  setDailyDetails: (v: any[]) => void;
  setDailySides: (v: any[]) => void;
  setDynamicTranslations: (translations: Record<string, any>) => void;
  setAvailableLanguages: (languages: { code: string, name: string }[]) => void;
  setIsSyncing: (v: boolean) => void;
  
  // Complex Actions
  loginManager: (pin: string) => void;
  logoutManager: () => void;
  resetCart: () => void;
  updateItemQuantity: (id: number, delta: number) => void;
}

export const useStore = create<AppState>((set) => ({
  mode: (() => {
    const isManager = new URLSearchParams(window.location.search).get('view') === 'manager';
    if (!isManager) sessionStorage.removeItem('token');
    return isManager ? 'manager' : 'kiosk';
  })(),
  activeTab: (new URLSearchParams(window.location.search).get('tab') as any) || 'menu',
  lang: localStorage.getItem('lang') || 'bg',
  dynamicTranslations: {},
  availableLanguages: [
    { code: 'en', name: 'English' },
    { code: 'bg', name: 'Български' }
  ],
  menu: [],
  orders: [],
  history: [],
  deliveryFee: 0,
  packagingFee: 0.1,
  cards: [],
  summaries: [],
  menuVersion: 1,
  menuDate: '',
  selectedItems: [],
  rfid: '',
  isScanning: false,
  showSuccess: false,
  error: null,
  connectionError: null,
  token: sessionStorage.getItem('token'),
  isManagerLoggedIn: !!sessionStorage.getItem('token'),
  editingMenu: [],
  newCardOwner: '',
  newCardIsAdmin: false,
  newCardPin: '',
  lastScanned: null,
  isScanningForCard: false,
  pasteCardsText: '',
  isPasteCardsModalOpen: false,
  historyFilters: {
    startDate: '',
    endDate: '',
    rfid: '',
    ownerName: '',
  },
  analyticsFilters: {
    startDate: '',
    endDate: '',
    rfid: '',
  },
  adminWhitelistEnabled: true,
  orderButtonEnabled: true,
  testModeEnabled: false,
  kioskOpen: true,
  kioskAutoTiming: false,
  kioskOpenTime: '08:00',
  kioskCloseTime: '11:00',
  kioskCloseDay: 0,
  kioskModeEnabled: false,
  allowPWAInstall: true,
  bgnEnabled: true,
  adminWhitelist: '',
  newPin: '',
  confirmPin: '',
  pinUpdateStatus: 'idle',
  isSyncing: false,
  expandedDate: null,
  dailyDetails: [],
  dailySides: [],

  // Setters
  setMode: (mode) => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', mode);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    set({ mode });
  },
  setActiveTab: (activeTab) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    set({ activeTab });
  },
  setLang: (lang) => {
    localStorage.setItem('lang', lang);
    set({ lang });
  },
  setMenu: (menu) => set({ menu }),
  setOrders: (orders) => set({ orders }),
  setHistory: (history) => set({ history }),
  setCards: (cards) => set({ cards }),
  setDeliveryFee: (deliveryFee) => set({ deliveryFee }),
  setPackagingFee: (packagingFee) => set({ packagingFee }),
  setSummaries: (summaries) => set({ summaries }),
  setMenuVersion: (menuVersion) => set({ menuVersion }),
  setMenuDate: (menuDate) => set({ menuDate }),
  setSelectedItems: (selectedItems) => set({ selectedItems }),
  setRfid: (rfid) => set({ rfid }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setShowSuccess: (showSuccess) => set({ showSuccess }),
  setError: (error) => set({ error }),
  setConnectionError: (connectionError) => set({ connectionError }),
  setToken: (token) => set({ token }),
  setIsManagerLoggedIn: (isManagerLoggedIn) => set({ isManagerLoggedIn }),
  setEditingMenu: (editingMenu) => set({ editingMenu }),
  setNewCardRfid: (newCardRfid) => set({ newCardRfid }),
  setNewCardOwner: (newCardOwner) => set({ newCardOwner }),
  setNewCardIsAdmin: (newCardIsAdmin) => set({ newCardIsAdmin }),
  setNewCardPin: (newCardPin) => set({ newCardPin }),
  setLastScanned: (lastScanned) => set({ lastScanned }),
  setIsScanningForCard: (isScanningForCard) => set({ isScanningForCard }),
  setPasteCardsText: (pasteCardsText) => set({ pasteCardsText }),
  setIsPasteCardsModalOpen: (isPasteCardsModalOpen) => set({ isPasteCardsModalOpen }),
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  setAnalyticsFilters: (analyticsFilters) => set({ analyticsFilters }),
  setAdminWhitelistEnabled: (v) => set({ adminWhitelistEnabled: v }),
  setOrderButtonEnabled: (orderButtonEnabled) => set({ orderButtonEnabled }),
  setTestModeEnabled: (testModeEnabled) => set({ testModeEnabled }),
  setKioskOpen: (kioskOpen) => set({ kioskOpen }),
  setKioskAutoTiming: (kioskAutoTiming) => set({ kioskAutoTiming }),
  setKioskOpenTime: (kioskOpenTime) => set({ kioskOpenTime }),
  setKioskCloseTime: (kioskCloseTime) => set({ kioskCloseTime }),
  setKioskCloseDay: (kioskCloseDay) => set({ kioskCloseDay }),
  setKioskModeEnabled: (v) => set({ kioskModeEnabled: v }),
  setAllowPWAInstall: (v) => set({ allowPWAInstall: v }),
  setBgnEnabled: (v) => set({ bgnEnabled: v }),
  setAdminWhitelist: (v) => set({ adminWhitelist: v }),
  setNewPin: (newPin) => set({ newPin }),
  setConfirmPin: (confirmPin) => set({ confirmPin }),
  setPinUpdateStatus: (pinUpdateStatus) => set({ pinUpdateStatus }),
  setPublicAccessRequired: (v) => set({ publicAccessRequired: v }),
  setExpandedDate: (expandedDate) => set({ expandedDate }),
  setDailyDetails: (dailyDetails) => set({ dailyDetails }),
  setDailySides: (dailySides) => set({ dailySides }),
  setDynamicTranslations: (dynamicTranslations) => set({ dynamicTranslations }),
  setAvailableLanguages: (availableLanguages) => set({ availableLanguages }),
  setIsSyncing: (isSyncing) => set({ isSyncing }),
  
  // Complex Actions
  loginManager: (token) => {
    sessionStorage.setItem('token', token);
    set({ token, isManagerLoggedIn: true });
    // Refresh to ensure all sync hooks and state are fresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
  },
  logoutManager: () => {
    sessionStorage.removeItem('token');
    window.location.href = window.location.origin + '/';
  },
  resetCart: () => set({ selectedItems: [], rfid: '' }),
  updateItemQuantity: (id, delta) => set((state) => {
    const updated = state.selectedItems.map((item) => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(i => i.quantity > 0);
    return { selectedItems: updated };
  }),
}));

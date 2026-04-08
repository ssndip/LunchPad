import { create } from 'zustand';
import { MenuItem, Order, Card, DailySummary, CartItem } from '../types';
import { Language } from '../translations';

interface AppState {
  // --- View State ---
  mode: 'kiosk' | 'manager';
  activeTab: 'menu' | 'orders' | 'history' | 'cards' | 'settings';
  lang: Language;
  
  // --- Data ---
  menu: MenuItem[];
  orders: Order[];
  cards: Card[];
  summaries: DailySummary[];
  
  // --- Kiosk Ordering ---
  selectedItems: CartItem[];
  rfid: string;
  isScanning: boolean;
  showSuccess: boolean;
  error: string | null;
  connectionError: string | null;
  
  // --- Manager ---
  adminPin: string | null;
  isManagerLoggedIn: boolean;
  editingMenu: MenuItem[];
  
  // --- Forms ---
  newCardRfid: string;
  newCardOwner: string;
  newCardIsAdmin: boolean;
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
  
  // --- Settings ---
  globalAccess: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskOpen: boolean;
  kioskAutoTiming: boolean;
  kioskOpenTime: string;
  kioskCloseTime: string;
  kioskCloseDay: number;
  
  // --- PIN Change ---
  newPin: string;
  confirmPin: string;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  
  // --- Summaries ---
  expandedDate: string | null;
  dailyDetails: any[];

  // --- Actions ---
  setMode: (mode: 'kiosk' | 'manager') => void;
  setActiveTab: (tab: 'menu' | 'orders' | 'history' | 'cards' | 'settings') => void;
  setLang: (lang: Language) => void;
  setMenu: (menu: MenuItem[]) => void;
  setOrders: (orders: Order[]) => void;
  setCards: (cards: Card[]) => void;
  setSummaries: (summaries: DailySummary[]) => void;
  setSelectedItems: (items: CartItem[]) => void;
  setRfid: (rfid: string) => void;
  setIsScanning: (v: boolean) => void;
  setShowSuccess: (v: boolean) => void;
  setError: (v: string | null) => void;
  setConnectionError: (v: string | null) => void;
  setAdminPin: (pin: string | null) => void;
  setIsManagerLoggedIn: (v: boolean) => void;
  setEditingMenu: (menu: MenuItem[]) => void;
  setNewCardRfid: (v: string) => void;
  setNewCardOwner: (v: string) => void;
  setNewCardIsAdmin: (v: boolean) => void;
  setLastScanned: (v: string | null) => void;
  setIsScanningForCard: (v: boolean) => void;
  setPasteCardsText: (v: string) => void;
  setIsPasteCardsModalOpen: (v: boolean) => void;
  setHistoryFilters: (filters: any) => void;
  setGlobalAccess: (v: boolean) => void;
  setOrderButtonEnabled: (v: boolean) => void;
  setTestModeEnabled: (v: boolean) => void;
  setKioskOpen: (v: boolean) => void;
  setKioskAutoTiming: (v: boolean) => void;
  setKioskOpenTime: (v: string) => void;
  setKioskCloseTime: (v: string) => void;
  setKioskCloseDay: (v: number) => void;
  setNewPin: (v: string) => void;
  setConfirmPin: (v: string) => void;
  setPinUpdateStatus: (v: 'idle' | 'loading' | 'success' | 'error') => void;
  setExpandedDate: (v: string | null) => void;
  setDailyDetails: (v: any[]) => void;
  
  // Complex Actions
  loginManager: (pin: string) => void;
  logoutManager: () => void;
  resetCart: () => void;
}

export const useStore = create<AppState>((set) => ({
  mode: 'kiosk',
  activeTab: 'menu',
  lang: (localStorage.getItem('lang') as Language) || 'bg',
  menu: [],
  orders: [],
  cards: [],
  summaries: [],
  selectedItems: [],
  rfid: '',
  isScanning: false,
  showSuccess: false,
  error: null,
  connectionError: null,
  adminPin: sessionStorage.getItem('adminPin'),
  isManagerLoggedIn: !!sessionStorage.getItem('adminPin'),
  editingMenu: [],
  newCardRfid: '',
  newCardOwner: '',
  newCardIsAdmin: false,
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
  globalAccess: true,
  orderButtonEnabled: true,
  testModeEnabled: false,
  kioskOpen: true,
  kioskAutoTiming: false,
  kioskOpenTime: '08:00',
  kioskCloseTime: '11:00',
  kioskCloseDay: 0,
  newPin: '',
  confirmPin: '',
  pinUpdateStatus: 'idle',
  expandedDate: null,
  dailyDetails: [],

  // Setters
  setMode: (mode) => set({ mode }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLang: (lang) => {
    localStorage.setItem('lang', lang);
    set({ lang });
  },
  setMenu: (menu) => set({ menu }),
  setOrders: (orders) => set({ orders }),
  setCards: (cards) => set({ cards }),
  setSummaries: (summaries) => set({ summaries }),
  setSelectedItems: (selectedItems) => set({ selectedItems }),
  setRfid: (rfid) => set({ rfid }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setShowSuccess: (showSuccess) => set({ showSuccess }),
  setError: (error) => set({ error }),
  setConnectionError: (connectionError) => set({ connectionError }),
  setAdminPin: (adminPin) => set({ adminPin }),
  setIsManagerLoggedIn: (isManagerLoggedIn) => set({ isManagerLoggedIn }),
  setEditingMenu: (editingMenu) => set({ editingMenu }),
  setNewCardRfid: (newCardRfid) => set({ newCardRfid }),
  setNewCardOwner: (newCardOwner) => set({ newCardOwner }),
  setNewCardIsAdmin: (newCardIsAdmin) => set({ newCardIsAdmin }),
  setLastScanned: (lastScanned) => set({ lastScanned }),
  setIsScanningForCard: (isScanningForCard) => set({ isScanningForCard }),
  setPasteCardsText: (pasteCardsText) => set({ pasteCardsText }),
  setIsPasteCardsModalOpen: (isPasteCardsModalOpen) => set({ isPasteCardsModalOpen }),
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  setGlobalAccess: (globalAccess) => set({ globalAccess }),
  setOrderButtonEnabled: (orderButtonEnabled) => set({ orderButtonEnabled }),
  setTestModeEnabled: (testModeEnabled) => set({ testModeEnabled }),
  setKioskOpen: (kioskOpen) => set({ kioskOpen }),
  setKioskAutoTiming: (kioskAutoTiming) => set({ kioskAutoTiming }),
  setKioskOpenTime: (kioskOpenTime) => set({ kioskOpenTime }),
  setKioskCloseTime: (kioskCloseTime) => set({ kioskCloseTime }),
  setKioskCloseDay: (kioskCloseDay) => set({ kioskCloseDay }),
  setNewPin: (newPin) => set({ newPin }),
  setConfirmPin: (confirmPin) => set({ confirmPin }),
  setPinUpdateStatus: (pinUpdateStatus) => set({ pinUpdateStatus }),
  setExpandedDate: (expandedDate) => set({ expandedDate }),
  setDailyDetails: (dailyDetails) => set({ dailyDetails }),

  // Complex Actions
  loginManager: (pin) => {
    sessionStorage.setItem('adminPin', pin);
    set({ adminPin: pin, isManagerLoggedIn: true });
  },
  logoutManager: () => {
    sessionStorage.removeItem('adminPin');
    set({ adminPin: null, isManagerLoggedIn: false, mode: 'kiosk' });
  },
  resetCart: () => set({ selectedItems: [], rfid: '' }),
}));

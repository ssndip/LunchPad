import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Card, DailySummary } from '../../types';

export interface AnalyticsSlice {
  cards: Card[];
  summaries: DailySummary[];
  analyticsFilters: {
    startDate: string;
    endDate: string;
    rfid: string;
  };
  expandedDate: string | null;
  dailyDetails: any[];
  dailySides: any[];
  newCardRfid: string;
  newCardOwner: string;
  newCardIsAdmin: boolean;
  newCardPin: string;
  lastScanned: string | null;
  isScanningForCard: boolean;
  pasteCardsText: string;
  isPasteCardsModalOpen: boolean;
  newPin: string;
  confirmPin: string;
  pinUpdateStatus: 'idle' | 'loading' | 'success' | 'error';
  isSyncing: boolean;
  deliveryFee: number;
  packagingFee: number;

  setCards: (cards: Card[]) => void;
  setSummaries: (summaries: DailySummary[]) => void;
  setAnalyticsFilters: (filters: any) => void;
  setExpandedDate: (v: string | null) => void;
  setDailyDetails: (v: any[]) => void;
  setDailySides: (v: any[]) => void;
  setNewCardRfid: (v: string) => void;
  setNewCardOwner: (v: string) => void;
  setNewCardIsAdmin: (v: boolean) => void;
  setNewCardPin: (v: string) => void;
  setLastScanned: (v: string | null) => void;
  setIsScanningForCard: (v: boolean) => void;
  setPasteCardsText: (v: string) => void;
  setIsPasteCardsModalOpen: (v: boolean) => void;
  setNewPin: (v: string) => void;
  setConfirmPin: (v: string) => void;
  setPinUpdateStatus: (v: 'idle' | 'loading' | 'success' | 'error') => void;
  setIsSyncing: (v: boolean) => void;
  setDeliveryFee: (fee: number) => void;
  setPackagingFee: (fee: number) => void;
}

export const createAnalyticsSlice: StateCreator<AppState, [], [], AnalyticsSlice> = (set) => ({
  cards: [],
  summaries: [],
  analyticsFilters: {
    startDate: '',
    endDate: '',
    rfid: '',
  },
  expandedDate: null,
  dailyDetails: [],
  dailySides: [],
  newCardRfid: '',
  newCardOwner: '',
  newCardIsAdmin: false,
  newCardPin: '',
  lastScanned: null,
  isScanningForCard: false,
  pasteCardsText: '',
  isPasteCardsModalOpen: false,
  newPin: '',
  confirmPin: '',
  pinUpdateStatus: 'idle',
  isSyncing: false,
  deliveryFee: 0,
  packagingFee: 0.1,

  setCards: (cards) => set({ cards }),
  setSummaries: (summaries) => set({ summaries }),
  setAnalyticsFilters: (filters) => set({ analyticsFilters: filters }),
  setExpandedDate: (v) => set({ expandedDate: v }),
  setDailyDetails: (v) => set({ dailyDetails: v }),
  setDailySides: (v) => set({ dailySides: v }),
  setNewCardRfid: (v) => set({ newCardRfid: v }),
  setNewCardOwner: (v) => set({ newCardOwner: v }),
  setNewCardIsAdmin: (v) => set({ newCardIsAdmin: v }),
  setNewCardPin: (v) => set({ newCardPin: v }),
  setLastScanned: (v) => set({ lastScanned: v }),
  setIsScanningForCard: (v) => set({ isScanningForCard: v }),
  setPasteCardsText: (v) => set({ pasteCardsText: v }),
  setIsPasteCardsModalOpen: (v) => set({ isPasteCardsModalOpen: v }),
  setNewPin: (v) => set({ newPin: v }),
  setConfirmPin: (v) => set({ confirmPin: v }),
  setPinUpdateStatus: (v) => set({ pinUpdateStatus: v }),
  setIsSyncing: (v) => set({ isSyncing: v }),
  setDeliveryFee: (v) => set({ deliveryFee: v }),
  setPackagingFee: (v) => set({ packagingFee: v }),
});

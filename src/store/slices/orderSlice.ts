import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Order, CartItem } from '../../types';

export interface OfflineOrder {
  tempId: string;
  rfid: string | null;
  items: { id: number; side?: string }[];
  menuVersion?: number;
  pin?: string;
  timestamp: number;
}

export interface OrderSlice {
  orders: Order[];
  history: Order[];
  selectedItems: CartItem[];
  rfid: string;
  isScanning: boolean;
  showSuccess: boolean;
  error: string | null;
  connectionError: string | null;
  historyFilters: {
    startDate: string;
    endDate: string;
    rfid: string;
    ownerName: string;
  };
  offlineQueue: OfflineOrder[];
  successMessage: string | null;
  
  setOrders: (orders: Order[]) => void;
  setHistory: (history: Order[]) => void;
  setSelectedItems: (items: CartItem[]) => void;
  setRfid: (rfid: string) => void;
  setIsScanning: (v: boolean) => void;
  setShowSuccess: (v: boolean) => void;
  setError: (v: string | null) => void;
  setConnectionError: (v: string | null) => void;
  setHistoryFilters: (filters: any) => void;
  resetCart: () => void;
  updateItemQuantity: (id: number, delta: number) => void;
  addToOfflineQueue: (order: Omit<OfflineOrder, 'tempId' | 'timestamp'>) => void;
  setOfflineQueue: (queue: OfflineOrder[]) => void;
  setSuccessMessage: (msg: string | null) => void;
}

export const createOrderSlice: StateCreator<AppState, [], [], OrderSlice> = (set) => ({
  orders: [],
  history: [],
  selectedItems: [],
  rfid: '',
  isScanning: false,
  showSuccess: false,
  error: null,
  connectionError: null,
  successMessage: null,
  historyFilters: {
    startDate: '',
    endDate: '',
    rfid: '',
    ownerName: '',
  },
  offlineQueue: (() => {
    try {
      return JSON.parse(localStorage.getItem('lunchpad_offline_queue') || '[]');
    } catch {
      return [];
    }
  })(),

  setOrders: (orders) => set({ orders }),
  setHistory: (history) => set({ history }),
  setSelectedItems: (selectedItems) => set({ selectedItems }),
  setRfid: (rfid) => set({ rfid }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setShowSuccess: (showSuccess) => set({ showSuccess }),
  setError: (error) => set({ error }),
  setConnectionError: (connectionError) => set({ connectionError }),
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  setSuccessMessage: (successMessage) => set({ successMessage }),
  
  resetCart: () => set({ selectedItems: [] }),
  
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

  addToOfflineQueue: (order) => set((state) => {
    const newOrder: OfflineOrder = {
      ...order,
      tempId: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      timestamp: Date.now(),
    };
    const newQueue = [...state.offlineQueue, newOrder];
    localStorage.setItem('lunchpad_offline_queue', JSON.stringify(newQueue));
    return { offlineQueue: newQueue };
  }),

  setOfflineQueue: (offlineQueue) => {
    localStorage.setItem('lunchpad_offline_queue', JSON.stringify(offlineQueue));
    set({ offlineQueue });
  },
});

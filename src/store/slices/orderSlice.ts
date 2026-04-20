import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Order, CartItem } from '../../types';

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
  historyFilters: {
    startDate: '',
    endDate: '',
    rfid: '',
    ownerName: '',
  },

  setOrders: (orders) => set({ orders }),
  setHistory: (history) => set({ history }),
  setSelectedItems: (selectedItems) => set({ selectedItems }),
  setRfid: (rfid) => set({ rfid }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setShowSuccess: (showSuccess) => set({ showSuccess }),
  setError: (error) => set({ error }),
  setConnectionError: (connectionError) => set({ connectionError }),
  setHistoryFilters: (historyFilters) => set({ historyFilters }),
  
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
});

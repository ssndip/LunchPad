import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { Order, CartItem } from '../../types';
import type { FailedOrder } from '../../utils/offlineSync';

export interface OfflineOrder {
  tempId: string;
  /**
   * The id this order was first submitted under. Reused on every replay so the
   * server can tell a retry from a new order, even if the original actually
   * committed and only the response was lost.
   */
  clientOrderId?: string;
  rfid: string | null;
  items: { id: number; side?: string }[];
  menuVersion?: number;
  pin?: string;
  /**
   * Set on a persisted order whose PIN was stripped before writing. Such an
   * order cannot be replayed after a reload, and is reported as failed rather
   * than sent without the credential it needs.
   */
  pinRedacted?: boolean;
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
  /**
   * Offline orders the server refused for good. Kept (and persisted) instead of
   * being dropped, so the loss is visible to whoever is standing at the kiosk
   * rather than buried in a console log.
   */
  failedOrders: FailedOrder[];
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
  addFailedOrders: (orders: FailedOrder[]) => void;
  clearFailedOrders: () => void;
  setSuccessMessage: (msg: string | null) => void;
}

/**
 * Read a persisted list, tolerating anything the browser hands back. A value
 * that is not an array (cleared storage, a half-written entry) used to become
 * the queue itself and blow up on the first spread.
 */
/**
 * Write the queue to localStorage without the PINs.
 *
 * A kiosk tablet is a shared device, and a queued order used to leave the
 * customer's six-digit PIN sitting in storage until it synced — up to a day.
 * The in-memory copy keeps the PIN so the order can still be replayed in this
 * session; what survives a reload is marked so the sync can report it instead
 * of silently sending an order with no credential.
 */
const persistQueue = (queue: OfflineOrder[]) => {
  const redacted = queue.map(({ pin, ...rest }) =>
    pin ? { ...rest, pinRedacted: true } : rest
  );
  localStorage.setItem('lunchpad_offline_queue', JSON.stringify(redacted));
};

const readPersistedArray = <T,>(key: string): T[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

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
  offlineQueue: readPersistedArray('lunchpad_offline_queue'),
  failedOrders: readPersistedArray<FailedOrder>('lunchpad_failed_orders'),

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
    persistQueue(newQueue);
    return { offlineQueue: newQueue };
  }),

  setOfflineQueue: (offlineQueue) => {
    persistQueue(offlineQueue);
    set({ offlineQueue });
  },

  addFailedOrders: (orders) => set((state) => {
    if (orders.length === 0) return {};
    const failedOrders = [...state.failedOrders, ...orders];
    localStorage.setItem('lunchpad_failed_orders', JSON.stringify(failedOrders));
    return { failedOrders };
  }),

  clearFailedOrders: () => {
    localStorage.removeItem('lunchpad_failed_orders');
    set({ failedOrders: [] });
  },
});

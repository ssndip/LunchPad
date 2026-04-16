/**
 * KioskOrderBar — Bottom order summary + RFID scan input
 * Feature 1: stays fixed / does not scroll
 * Feature 2: RFID input fires handleOrder on Enter
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trash2,
  CreditCard,
  ChevronRight,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { CartItem } from '../../types';

interface KioskOrderBarProps {
  selectedItems: CartItem[];
  totalPrice: number;
  rfid: string;
  setRfid: (v: string) => void;
  rfidInputRef: React.RefObject<HTMLInputElement | null>;
  isScanning: boolean;
  computedKioskOpen: boolean;
  testModeEnabled: boolean;
  orderButtonEnabled: boolean;
  onOrder: () => void;
  onClearCart: () => void;
  onChangeSide: (item: CartItem) => void;
  t: (key: string) => string;
}

export const KioskOrderBar: React.FC<KioskOrderBarProps> = ({
  selectedItems,
  totalPrice,
  rfid,
  setRfid,
  rfidInputRef,
  isScanning,
  computedKioskOpen,
  testModeEnabled,
  orderButtonEnabled,
  onOrder,
  onClearCart,
  onChangeSide,
  t,
}) => {
  const orderDisabled =
    isScanning ||
    selectedItems.length === 0 ||
    (!testModeEnabled && !rfid) ||
    !computedKioskOpen;

  return (
    <AnimatePresence>
      {selectedItems.length > 0 && orderButtonEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          className="shrink-0 w-full px-4 pb-4 pt-2"
        >
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-200/80 px-5 py-4 flex flex-col gap-3">
            <div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex flex-col flex-1 min-w-0 pb-1 border-b border-neutral-50 last:border-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-bold text-neutral-900 truncate flex items-center gap-2">
                      {item.quantity > 1 && <span className="text-[10px] bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-500 font-mono">x{item.quantity}</span>}
                      {item.name}
                    </span>
                    <span className="text-xs font-mono text-neutral-500 shrink-0 ml-2">
                      €{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>

                  {/* Nested Sides & Fees */}
                  <div className="pl-3 mt-1 space-y-0.5">
                    {item.side && (
                      <div className="flex items-center justify-between group">
                        <span className="text-[10px] text-neutral-400 font-medium">
                          └─ {t('kiosk.side')}: <span className="text-neutral-600 font-bold">{item.side}</span>
                          <span className="ml-1 text-[8px] opacity-70">({t('kiosk.included')})</span>
                        </span>
                        {(item.requiresSideChoice || item.hasIncludedSide) && (
                          <button
                            onClick={() => onChangeSide(item)}
                            className="text-[9px] font-bold text-blue-500 hover:text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded transition-all opacity-0 group-hover:opacity-100"
                          >
                            {t('kiosk.change')}
                          </button>
                        )}
                      </div>
                    )}
                    {item.extraFees && item.extraFees.length > 0 && item.extraFees.map((fee, idx) => (
                      <div key={idx} className="flex items-baseline justify-between text-[10px] text-neutral-400">
                        <span>└─ {fee.type}</span>
                        <span className="font-mono">+{fee.amount.toFixed(2)}€</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100" />

            {/* Total + actions row */}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                  {t('orders.total')}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-neutral-900 tracking-tighter">
                    €{totalPrice.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                    ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)}{' '}
                    {selectedItems.reduce((acc, i) => acc + i.quantity, 0) === 1 ? t('menu.item') : t('menu.items')})
                  </span>
                </div>
              </div>

              <button
                onClick={onClearCart}
                className="p-2 text-neutral-400 hover:text-red-500 transition-colors shrink-0"
                title="Clear order"
                aria-label="Clear order"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              {/* RFID input */}
              <div className="relative w-44 shrink-0">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <input
                  ref={rfidInputRef}
                  type="text"
                  placeholder={t('cards.scan_to_register')}
                  aria-label={t('cards.scan_to_register')}
                  value={rfid}
                  autoComplete="off"
                  onChange={(e) => setRfid(e.target.value)}
                  onFocus={(e) => { if (e.target.value) e.target.select(); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const clean = e.currentTarget.value
                        .trim()
                        .replace(/[^\x20-\x7E]/g, '')
                        .toLowerCase();
                      if (!clean) return;
                      setRfid(clean);
                      onOrder();
                    }
                  }}
                  className="w-full pl-9 pr-8 py-2.5 bg-neutral-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm"
                />
                {rfid && (
                  <button

                    onClick={() => setRfid('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
                    aria-label="Clear RFID"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Order button */}
              <button
                onClick={onOrder}
                disabled={orderDisabled}
                className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl font-bold text-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shrink-0"
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                {testModeEnabled && !rfid ? 'Test Order' : t('kiosk.place_order')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Success overlay ──────────────────────────────────────────────────────────
interface OrderSuccessProps {
  show: boolean;
  t: (key: string) => string;
}

export const OrderSuccessOverlay: React.FC<OrderSuccessProps> = ({ show, t }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.8, opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-50"
      >
        <div className="bg-neutral-900 text-white p-12 rounded-[60px] text-center shadow-2xl">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-4xl font-bold mb-4">{t('kiosk.order_success')}</h2>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

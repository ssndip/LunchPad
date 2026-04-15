import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Trash2, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { CartItem, MenuItem } from '../../types';
import { useStore } from '../../store/useStore';
import { isItemAutoBox } from '../../utils/categoryAutobox';
import { useResponsive } from '../../hooks/useResponsive';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface KioskOrderPanelProps {
  selectedItems: CartItem[];
  totalPrice: number;
  rfid: string;
  setRfid: (v: string) => void;
  isScanning: boolean;
  computedKioskOpen: boolean;
  testModeEnabled: boolean;
  orderButtonEnabled: boolean;
  onOrder: () => void;
  onClearCart: () => void;
  onUpdateSide: (item: CartItem) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  t: (key: string) => string;
}

export const KioskOrderPanel: React.FC<KioskOrderPanelProps> = ({
  selectedItems,
  totalPrice,
  rfid,
  setRfid,
  isScanning,
  computedKioskOpen,
  testModeEnabled,
  orderButtonEnabled,
  onOrder,
  onClearCart,
  onUpdateSide,
  onUpdateQuantity,
  t,
}) => {
  const packagingFee = useStore(s => s.packagingFee);
  const { isPhone } = useResponsive();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const bgTotal = (totalPrice * 1.95).toFixed(2);
  const orderDisabled = !selectedItems.length || (!rfid && !testModeEnabled) || isScanning || !computedKioskOpen;
  const itemCount = selectedItems.reduce((acc, i) => acc + i.quantity, 0);

  // Phone Sticky Bottom Layout
  if (isPhone) {
    return (
      <div className={`fixed bottom-0 left-0 right-0 z-40 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] rounded-t-3xl transition-all duration-300 ease-in-out border-t border-neutral-200 ${isExpanded ? 'h-[85vh] flex flex-col' : 'h-auto'}`}>
        {/* Toggle/Handle */}
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center pt-3 pb-2 focus:outline-none"
        >
          <div className="w-12 h-1.5 bg-neutral-200 rounded-full mb-2" />
        </button>

        <div className="px-5 pb-5 pt-2 flex items-center justify-between">
          <div onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <ShoppingCart className={`w-6 h-6 ${selectedItems.length > 0 ? 'text-neutral-900' : 'text-neutral-300'}`} />
              {selectedItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full animate-bounce">
                  {itemCount}
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest leading-tight">{t('orders.total')}</span>
              <span className="text-lg font-black text-neutral-900 leading-tight">€{totalPrice.toFixed(2)}</span>
            </div>
          </div>
          
          <button
            onClick={(e) => {
              if (!isExpanded && selectedItems.length > 0) {
                setIsExpanded(true);
                return;
              }
              onOrder();
            }}
            disabled={orderDisabled}
            className={`px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-widest transition-transform active:scale-95 ${orderDisabled ? 'bg-neutral-100 text-neutral-400' : 'bg-neutral-900 text-white shadow-xl shadow-neutral-900/20'}`}
          >
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : (!rfid && !testModeEnabled && isExpanded ? t('kiosk.please_scan_card') : (isExpanded ? t('modals.confirm') : t('kiosk.view_cart')))}
          </button>
        </div>

        {/* Expanded Area */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 flex flex-col overflow-hidden border-t border-neutral-100 bg-neutral-50"
            >
              <div className="p-4 flex items-center justify-between bg-white border-b border-neutral-100">
                <span className="text-xs font-black uppercase tracking-widest text-neutral-400">{t('orders.items')}</span>
                {selectedItems.length > 0 && (
                  <button onClick={onClearCart} className="text-red-500 text-xs font-bold uppercase tracking-widest p-2 active:scale-90">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                {selectedItems.map((item, idx) => (
                  <div key={`${item.id}-${idx}`} className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100">
                    <div className="flex justify-between items-start gap-2 mb-2">
                       <span className="text-sm font-bold text-neutral-900 leading-tight">{item.name}</span>
                       <span className="text-sm font-black text-neutral-900 shrink-0">€{item.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => onUpdateQuantity(item.id, -1)} className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 font-bold active:scale-90">-</button>
                      <span className="text-sm font-black w-4 text-center">{item.quantity}</span>
                      <button onClick={() => onUpdateQuantity(item.id, 1)} className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-600 font-bold active:scale-90">+</button>
                    </div>
                    {/* Nested details exactly as desktop... */}
                     <div className="pl-2 border-l-2 border-neutral-100 space-y-1 mt-2">
                        {item.side && (
                          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 font-bold uppercase">
                            <span>{item.side}</span>
                            <span className="text-[8px] bg-neutral-100 px-1 py-0.5 rounded text-neutral-400">{t('kiosk.included')}</span>
                          </div>
                        )}
                        {item.extraFees?.map((fee, fIdx) => (
                          <div key={fIdx} className="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase">
                            <span>{fee.type}</span>
                            <span className="font-mono">+€{fee.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        {isItemAutoBox(item) && (
                          <div className="flex justify-between items-center text-[10px] text-neutral-500 font-bold uppercase">
                            <span>{t('menu.packaging_fee') || 'Box'}</span>
                            <span className="font-mono">+€{packagingFee.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop / Tablet Persistent Side Panel
  return (
    <div className="w-full h-full bg-white flex flex-col overflow-hidden z-10">
      {/* Header */}
      <div className="p-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/30">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-neutral-400" />
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
            {t('orders.items')}
          </h2>
        </div>
        {selectedItems.length > 0 && (
          <button 
            onClick={onClearCart}
            className="p-1.5 hover:bg-red-50 text-neutral-300 hover:text-red-500 rounded-lg transition-all active:scale-90"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Cart Items — Flexible & Inner Scrollable */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
        {selectedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale p-4">
            <ShoppingCart className="w-8 h-8 mb-4 stroke-1" />
            <p className="text-[10px] font-black uppercase tracking-widest">{t('kiosk.no_items_selected')}</p>
          </div>
        ) : (
          selectedItems.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="group flex flex-col gap-1 pb-3 border-b border-neutral-50 last:border-0">
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-bold text-neutral-900 leading-tight">
                  {item.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-neutral-400">
                    {item.quantity} ×
                  </span>
                  <span className="text-xs font-mono font-black text-neutral-900 shrink-0">
                    €{item.price.toFixed(2)}
                  </span>
                </div>
              </div>
              
              {/* Nested Details */}
              <div className="pl-3 space-y-0.5">
                {item.side && (
                  <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                    <span className="opacity-40">└</span>
                    <span>{item.side}</span>
                    <span className="text-[7px] bg-neutral-100 px-1 py-0.5 rounded text-neutral-500">
                      {t('kiosk.included')}
                    </span>
                  </div>
                )}
                {item.extraFees?.map((fee, fIdx) => (
                  <div key={fIdx} className="flex justify-between items-center text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-40">└</span>
                      <span>{fee.type}</span>
                    </div>
                    <span className="font-mono">+€{fee.amount.toFixed(2)}</span>
                  </div>
                ))}
                
                {isItemAutoBox(item) && (
                  <div className="flex justify-between items-center text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-40">└</span>
                      <span>{t('menu.packaging_fee') || 'Box'}</span>
                    </div>
                    <span className="font-mono">+€{packagingFee.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer — Fixed at bottom */}
      <div className="shrink-0 p-5 bg-neutral-50 border-t border-neutral-200 flex flex-col gap-4">
        <div className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">{t('orders.total')}</span>
            <span className="text-2xl font-black text-neutral-900 font-mono">€{totalPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-baseline leading-none opacity-60">
            <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">{t('kiosk.in_leva')} (×1.95)</span>
            <div className="flex flex-col items-end">
              <span className="text-sm font-black text-neutral-900 font-mono">{bgTotal}{t('kiosk.currency_bg')}</span>
              <span className="text-[9px] font-bold text-neutral-400">
                ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)} {t('menu.items')})
              </span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onOrder}
          disabled={orderDisabled}
          className={`w-full py-4 rounded-2xl relative overflow-hidden transition-all active:scale-[0.98] ${
            orderDisabled 
              ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed grayscale' 
              : 'bg-neutral-900 text-white shadow-xl hover:shadow-2xl'
          }`}
        >
          <div className="relative z-10 flex items-center justify-center gap-3">
            {isScanning ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-black uppercase tracking-widest">{t('kiosk.processing')}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-black uppercase tracking-widest">
                  {testModeEnabled && !rfid ? t('kiosk.place_order') : (rfid ? t('modals.confirm') : t('kiosk.please_scan_card'))}
                </span>
                {!rfid && !testModeEnabled && <ShoppingCart className="w-4 h-4 animate-pulse" />}
              </>
            )}
          </div>
          
          {/* Scan highlight animator if no RFID */}
          {!rfid && !testModeEnabled && !isScanning && (
            <motion.div
              animate={{ x: ['100%', '-100%'] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
            />
          )}
        </button>

        {/* RFID hint if scanning */}
        {!orderDisabled && !rfid && !testModeEnabled && (
           <div className="flex items-center justify-center gap-1.5 p-2 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-100">
             <Loader2 className="w-3 h-3 animate-spin" />
             <span className="text-[9px] font-black uppercase tracking-tighter">{t('kiosk.user_history_scan_prompt')}</span>
           </div>
        )}
      </div>
    </div>
  );
};

export const OrderSuccessOverlay: React.FC<{ show: boolean, t: any }> = ({ show, t }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-[40px] p-8 shadow-2xl text-center max-w-sm w-full border border-neutral-100"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-neutral-900 mb-2 uppercase tracking-tight">
            {t('kiosk.order_success')}
          </h2>
          <p className="text-neutral-400 text-sm">{t('kiosk.balance_cleared')}</p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

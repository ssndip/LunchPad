import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, AlertCircle, Utensils, Clock, Plus, Minus } from 'lucide-react';
import { MenuItem, CartItem } from '../../types';

interface KioskItemListProps {
  items: MenuItem[];
  sideItems: MenuItem[];
  selectedItems: CartItem[];
  selectedItemIds: Set<number>;
  onToggle: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  orderButtonEnabled: boolean;
  connectionError: string | null;
  t: (key: string) => string;
}

export const KioskItemList: React.FC<KioskItemListProps> = ({
  items,
  sideItems,
  selectedItems,
  selectedItemIds,
  onToggle,
  onAddWithSide,
  onUpdateQuantity,
  orderButtonEnabled,
  connectionError,
  t,
}) => {
  const isPackagingFeeItem = (category?: string) => {
    if (!category) return false;
    const c = category.toLowerCase();
    return c.includes('side dishes') || c.includes('гарнитури') || c.includes('bbq') || c.includes('скара');
  };

  if (connectionError === 'Global Access Disabled') return <Placeholder t={t} icon={<AlertCircle />} title={t('kiosk.connection_restricted')} message={t('restricted_message')} />;
  if (!orderButtonEnabled) return <Placeholder t={t} icon={<Utensils />} title={t('kiosk.testing_mode')} message={t('kiosk.ordering_disabled')} />;
  if (items.length === 0) return <Placeholder t={t} icon={<Clock />} title={t('kiosk.no_items_available')} message={t('kiosk.check_later')} />;

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar bg-white">
      <div className="divide-y divide-neutral-100">
        {items.filter(i => i.available).map((item) => {
          const isSelected = selectedItemIds.has(item.id);
          const cartItem = selectedItems.find(i => i.id === item.id);
          const needsSide = !!(item.requiresSideChoice || item.hasIncludedSide);

          return (
            <div key={item.id} className="flex flex-col">
              <motion.div
                whileTap={{ backgroundColor: '#F9FAFB' }}
                onClick={() => onToggle(item)}
                className={`flex items-center justify-between px-6 py-4 cursor-pointer transition-colors ${
                  isSelected ? 'bg-neutral-50' : 'bg-white hover:bg-neutral-50/50'
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  <QuantityControl 
                    isSelected={isSelected}
                    quantity={cartItem?.quantity || 1}
                    onIncrement={() => onUpdateQuantity(item.id, 1)}
                    onDecrement={() => onUpdateQuantity(item.id, -1)}
                    onToggle={() => !isSelected && onToggle(item)}
                  />
                  <div>
                    <h3 className={`text-base font-bold leading-tight ${isSelected ? 'text-neutral-900' : 'text-neutral-700'}`}>
                      {item.name}
                    </h3>
                    {needsSide && !isSelected && (
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-0.5">
                        {t('kiosk.choose_side')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-4 shrink-0">
                  <span className="text-sm font-black font-mono text-neutral-900">
                    €{item.price.toFixed(2)}
                  </span>
                  {isPackagingFeeItem(item.category) && (
                    <span className="text-[8px] font-black text-neutral-400 uppercase tracking-tighter">
                      +{t('menu.packaging_fee') || 'Кутийка'}
                    </span>
                  )}
                </div>
              </motion.div>

              {/* Inline Side Picker */}
              <AnimatePresence>
                {isSelected && needsSide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden bg-neutral-50 px-6 pb-4"
                  >
                    <div className="pl-9 pt-1">
                      <p className="text-[9px] font-black text-neutral-400 uppercase tracking-[0.2em] mb-2">
                        {t('kiosk.choose_side')}
                      </p>
                      <SideDishInlinePicker 
                        item={item}
                        sides={sideItems}
                        selectedSide={cartItem?.side}
                        onSelect={(side) => onAddWithSide(item, side)}
                        t={t}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Placeholder: React.FC<{ icon: React.ReactNode, title: string, message: string, t: any }> = ({ icon, title, message, t }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
    <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-4 text-neutral-400">
      {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
    </div>
    <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight mb-1">{title}</h3>
    <p className="text-xs text-neutral-400 max-w-[200px] leading-relaxed">{message}</p>
  </div>
);

const QuantityControl: React.FC<{
  isSelected: boolean;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggle: () => void;
}> = ({ isSelected, quantity, onIncrement, onDecrement, onToggle }) => {
  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait">
        {!isSelected ? (
          <motion.div
            key="dot"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            onClick={onToggle}
            className="w-8 h-8 rounded-full border-2 border-neutral-200 cursor-pointer flex items-center justify-center hover:border-neutral-400 transition-colors"
          />
        ) : (
          <motion.div
            key="control"
            initial={{ width: 32, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 32, opacity: 0 }}
            className="flex items-center bg-neutral-900 rounded-full p-1.5 gap-5 overflow-hidden shadow-lg shadow-black/20"
          >
            <button
              onClick={onDecrement}
              className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
            >
              <Minus className="w-5 h-5" />
            </button>
            <span className="text-lg font-black font-mono text-white min-w-[20px] text-center">
              {quantity}
            </span>
            <button
              onClick={onIncrement}
              className="w-10 h-10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90"
            >
              <Plus className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SideDishInlinePicker: React.FC<{ item: MenuItem, sides: MenuItem[], selectedSide?: string, onSelect: (s?: string) => void, t: any }> = ({ item, sides, selectedSide, onSelect, t }) => {
  const allowedSides = item.sideChoices && item.sideChoices.length > 0
    ? sides.filter(s => item.sideChoices?.includes(s.name))
    : sides;

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowedSides.map(side => {
        const isActive = selectedSide === side.name;
        return (
          <button
            key={side.id}
            onClick={(e) => { e.stopPropagation(); onSelect(side.name); }}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
              isActive 
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-sm' 
                : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'
            }`}
          >
            {side.name}
          </button>
        );
      })}
    </div>
  );
};

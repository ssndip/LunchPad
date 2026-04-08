import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, ChevronRight, AlertCircle, Utensils, Clock } from 'lucide-react';
import { MenuItem, CartItem } from '../../types';

interface KioskItemListProps {
  items: MenuItem[];
  sideItems: MenuItem[];
  selectedItems: CartItem[];
  selectedItemIds: Set<number>;
  onToggle: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
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
  orderButtonEnabled,
  connectionError,
  t,
}) => {
  if (connectionError) return <Placeholder t={t} icon={<AlertCircle />} title={t('kiosk.connection_restricted')} message={t('kiosk.restricted_message')} />;
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
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-200'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
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
                <span className="text-sm font-black font-mono text-neutral-900 ml-4">
                  €{item.price.toFixed(2)}
                </span>
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

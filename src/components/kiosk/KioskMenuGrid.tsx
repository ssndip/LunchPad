/**
 * KioskMenuGrid — Feature 1 (viewport-locked scroll) + Feature 5 (side picker intercept)
 * Renders the grouped menu in a scrollable grid; fires onToggle which may open the side picker.
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Clock, Utensils, CheckCircle2 } from 'lucide-react';
import { MenuItem } from '../../types';

interface KioskMenuGridProps {
  groupedMenu: Record<string, MenuItem[]>;
  selectedItemIds: Set<number>;
  onToggle: (item: MenuItem) => void;
  orderButtonEnabled: boolean;
  connectionError: string | null;
  t: (key: string) => string;
}

export const KioskMenuGrid: React.FC<KioskMenuGridProps> = ({
  groupedMenu,
  selectedItemIds,
  onToggle,
  orderButtonEnabled,
  connectionError,
  t,
}) => {
  if (connectionError) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-red-200 text-center shadow-lg max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-black text-neutral-900 mb-2 uppercase tracking-tighter">
            {t('kiosk.connection_restricted')}
          </h3>
          <p className="text-neutral-500 text-sm leading-relaxed">
            {t('kiosk.restricted_message')}
          </p>
        </div>
      </div>
    );
  }

  if (!orderButtonEnabled) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="bg-white p-12 rounded-[40px] border-2 border-dashed border-neutral-200 text-center shadow-sm max-w-md w-full">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Utensils className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-xl font-black text-neutral-900 mb-2 uppercase tracking-tighter">
            {t('kiosk.testing_mode')}
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            {t('kiosk.ordering_disabled')}
          </p>
        </div>
      </div>
    );
  }

  if (Object.keys(groupedMenu).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="bg-white p-12 rounded-[40px] border border-neutral-200 text-center shadow-sm max-w-md w-full">
          <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900 mb-1">
            {t('kiosk.no_items_available')}
          </h3>
          <p className="text-neutral-400 text-xs uppercase tracking-widest font-mono">
            {t('kiosk.check_later')}
          </p>
        </div>
      </div>
    );
  }

  return (
    /* Feature 1: overflow-y-auto here, not on the outer container */
    <div className="flex-1 overflow-y-auto custom-scrollbar px-4 md:px-8 pb-2 pt-0">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {(Object.entries(groupedMenu) as [string, MenuItem[]][]).map(
          ([category, items]) => (
            <section
              key={category}
              className="bg-white rounded-2xl border border-neutral-200 shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
            >
              {/* Category header */}
              <div className="px-4 py-2.5 bg-gradient-to-r from-neutral-50 to-white border-b border-neutral-100 flex justify-between items-center">
                <h2 className="text-[9px] font-black text-neutral-700 uppercase tracking-[0.25em]">
                  {category}
                </h2>
                <span className="text-[8px] font-mono text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {items.filter((i) => i.available).length}
                </span>
              </div>

              {/* Items */}
              <div className="divide-y divide-neutral-50">
                {items
                  .filter((item) => item.available)
                  .map((item) => {
                    const isSelected = selectedItemIds.has(item.id);
                    return (
                      <motion.div
                        key={item.id}
                        layout
                        initial={false}
                        animate={{
                          backgroundColor: isSelected ? '#111111' : '#ffffff',
                          color: isSelected ? '#ffffff' : '#404040',
                          scale: isSelected ? 1.01 : 1,
                        }}
                        transition={{ duration: 0.12 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onToggle(item)}
                        className={`cursor-pointer flex justify-between items-center px-4 py-3.5 relative transition-all duration-150 ${
                          isSelected
                            ? 'shadow-inner'
                            : 'hover:bg-neutral-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <AnimatePresence mode="wait">
                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              >
                                <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <div className="flex-1 min-w-0">
                            <span className="text-[15px] font-bold block truncate leading-tight">
                              {item.name}
                            </span>
                            {item.hasIncludedSide && (
                              <span
                                className={`text-[9px] font-bold uppercase tracking-wider ${
                                  isSelected ? 'text-neutral-400' : 'text-neutral-400'
                                }`}
                              >
                                + {t('kiosk.choose_side')}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 ml-4">
                          <span className="text-[13px] font-black font-mono">
                            €{item.price.toFixed(2)}
                          </span>
                        </div>

                        {/* Left accent bar when selected */}
                        {isSelected && (
                          <motion.div
                            layoutId={`accent-${item.id}`}
                            className="absolute left-0 top-0 bottom-0 w-1 bg-white/40 rounded-r"
                          />
                        )}
                      </motion.div>
                    );
                  })}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
};

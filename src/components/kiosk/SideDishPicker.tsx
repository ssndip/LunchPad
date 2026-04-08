/**
 * Feature 5 — Side Dish Picker Modal
 * Shown when a user selects a main dish that includes a side dish.
 */
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2 } from 'lucide-react';
import { MenuItem } from '../../types';

interface SideDishPickerProps {
  /** The main dish the user tapped */
  item: MenuItem;
  /** Available side dishes from the menu */
  sides: MenuItem[];
  /** Called with the chosen side name, or undefined if user skips */
  onSelect: (side?: string) => void;
  /** Translation helper */
  t: (key: string) => string;
}

export const SideDishPicker: React.FC<SideDishPickerProps> = ({
  item,
  sides,
  onSelect,
  t,
}) => {
  const isRequired = !!item.requiresSideChoice;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
        onClick={() => !isRequired && onSelect(undefined)}
      >
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1">
                {t('kiosk.choose_side')}
              </p>
              <h3 className="text-lg font-black text-neutral-900 leading-tight">
                {item.name}
              </h3>
              <p className="text-sm text-neutral-500 mt-0.5">
                {isRequired ? t('kiosk.side_required') : t('kiosk.side_included')}
              </p>
            </div>
            {!isRequired && (
              <button
                onClick={() => onSelect(undefined)}
                className="p-2 hover:bg-neutral-100 rounded-xl transition-colors text-neutral-400"
                aria-label="Skip side dish"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Side dish options */}
          {(() => {
            const allowedSides = item.sideChoices && item.sideChoices.length > 0
              ? sides.filter(s => item.sideChoices?.includes(s.name))
              : sides;

            return allowedSides.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {allowedSides.map((side) => (
                  <motion.button
                    key={side.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => onSelect(side.name)}
                    className="flex flex-col items-start p-3 bg-neutral-50 hover:bg-neutral-900 hover:text-white rounded-2xl border border-neutral-200 hover:border-neutral-900 transition-all duration-150 text-left group"
                  >
                    <CheckCircle2 className="w-4 h-4 mb-2 text-neutral-300 group-hover:text-white transition-colors" />
                    <span className="text-sm font-bold leading-tight">{side.name}</span>
                    <span className="text-[10px] font-mono mt-0.5 text-neutral-400 group-hover:text-neutral-300">
                      {t('kiosk.included')}
                    </span>
                  </motion.button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400 italic mb-4 text-center py-4">
                {t('kiosk.no_sides_available')}
              </p>
            );
          })()}

          {/* Skip button - only if not required */}
          {!isRequired && (
            <button
              onClick={() => onSelect(undefined)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 font-bold text-sm hover:border-neutral-400 hover:text-neutral-600 transition-all"
            >
              {t('kiosk.no_side')}
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

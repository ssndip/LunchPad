import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from '../../hooks/useTranslation';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Rendered in the header row, right of the title. */
  headerAction?: React.ReactNode;
  /** Max width of the md+ dialog. Ignored on a phone, where the sheet is full width. */
  maxWidth?: string;
  children: React.ReactNode;
}

/**
 * A bottom sheet below md, a centred dialog above it.
 *
 * Phones put a centred dialog's controls in the middle of the screen, out of
 * thumb reach, and its backdrop-dismiss target where the palm rests. A sheet
 * anchored to the bottom edge puts the actions where the thumb already is,
 * which is why every mobile OS converges on it.
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  headerAction,
  maxWidth = 'max-w-md',
  children,
}) => {
  const { isPhone } = useResponsive();
  const { t } = useTranslation();
  const titleId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[100] flex ${isPhone ? 'items-end' : 'items-center justify-center p-4'}`}
        >
          <motion.div
            data-testid="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />

          <motion.div
            data-testid="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={isPhone ? { y: '100%' } : { scale: 0.94, opacity: 0, y: 16 }}
            animate={isPhone ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
            exit={isPhone ? { y: '100%' } : { scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className={`relative bg-white shadow-2xl flex flex-col ${
              isPhone
                ? 'w-full rounded-t-[28px] max-h-[88dvh] pad-safe-bottom'
                : `w-full ${maxWidth} rounded-[28px] max-h-[85dvh]`
            }`}
          >
            {isPhone && (
              <div className="shrink-0 flex justify-center pt-3 pb-1" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-neutral-200" />
              </div>
            )}

            {(title || headerAction) && (
              <div className="shrink-0 flex items-center justify-between gap-3 px-6 pt-4 pb-3 border-b border-neutral-100">
                {title && (
                  <h2 id={titleId} className="text-lg font-black tracking-tight text-neutral-900 truncate">
                    {title}
                  </h2>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  {headerAction}
                  <button
                    onClick={onClose}
                    className="touch-target flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors active:scale-95"
                    aria-label={t('modals.close') || 'Close'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

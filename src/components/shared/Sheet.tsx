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
  /** Accessible name to use when there is no `title`. Ignored when `title` is set. */
  ariaLabel?: string;
  /**
   * Element to focus on open instead of the first focusable element in the
   * panel. Ignored if its `current` is null at open time (e.g. content that
   * only renders in some states), in which case the default first-focusable
   * behaviour applies.
   */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Elements a keyboard user can land on inside the panel, for initial focus and the Tab trap. */
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  ariaLabel,
  initialFocusRef,
}) => {
  const { isPhone } = useResponsive();
  const { t } = useTranslation();
  const titleId = React.useId();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  // Focus capture/init/restore and scroll locking depend only on whether the
  // sheet is open, never on `onClose`'s identity. Keying this on `onClose`
  // too would re-run it (and yank focus back to the top of the panel) on
  // every parent re-render for a caller passing an inline `onClose` arrow —
  // the common pattern, and exactly what Task 11 does.
  React.useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const preferred = initialFocusRef?.current;
    if (preferred) {
      preferred.focus();
    } else {
      const focusable = panel ? panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) : null;
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      } else {
        panel?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
      const toRestore = previouslyFocusedRef.current;
      if (toRestore && document.contains(toRestore)) {
        toRestore.focus();
      }
    };
    // `initialFocusRef` is a ref object, stable across renders by definition
    // (only its `.current` changes, which doesn't need to re-run this), so
    // including it here doesn't reintroduce the inline-onClose re-run
    // problem the comment above describes.
  }, [isOpen, initialFocusRef]);

  // Escape-to-close and the Tab trap legitimately need the current
  // `onClose`, so this effect is keyed on it. Re-running it on every render
  // of an inline `onClose` only re-adds a keydown listener, which is
  // harmless — cleanup always removes the previous one first.
  React.useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      const panel = panelRef.current;
      if (e.key === 'Tab' && panel) {
        const items: HTMLElement[] = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first: HTMLElement = items[0];
        const last: HTMLElement = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey) {
          if (active === first || !panel.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panel.contains(active)) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
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
            ref={panelRef}
            data-testid="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            aria-label={!title ? ariaLabel : undefined}
            tabIndex={-1}
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

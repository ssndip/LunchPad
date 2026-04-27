import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Utensils,
  Clock,
  Plus,
  Minus,
} from "lucide-react";
import { MenuItem, CartItem } from "../../types";
import { isItemAutoBox } from "../../utils/categoryAutobox";
import { triggerHaptic } from "../../utils/haptics";

interface KioskItemListProps {
  items: MenuItem[];
  sideItems: MenuItem[];
  selectedItems: CartItem[];
  selectedItemIds: Set<number>;
  onToggle: (item: MenuItem) => void;
  onAddWithSide: (item: MenuItem, side?: string) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  orderButtonEnabled: boolean;
  isMenuOutdated?: boolean;
  connectionError: string | null;
  isReadOnly?: boolean;
  t: (key: string) => string;
}

export const KioskItemList: React.FC<KioskItemListProps> = React.memo(
  ({
    items,
    sideItems,
    selectedItems,
    selectedItemIds,
    onToggle,
    onAddWithSide,
    onUpdateQuantity,
    orderButtonEnabled,
    isMenuOutdated,
    connectionError,
    isReadOnly,
    t,
  }) => {
    const [expandedItemId, setExpandedItemId] = React.useState<number | null>(
      null,
    );
    const isPackagingFeeItem = (item: MenuItem) => isItemAutoBox(item);

    if (connectionError === "Global Access Disabled")
      return (
        <Placeholder
          t={t}
          icon={<AlertCircle />}
          title={t("kiosk.connection_restricted")}
          message={t("restricted_message")}
        />
      );

    if (!orderButtonEnabled && !isReadOnly)
      return (
        <Placeholder
          t={t}
          icon={<Utensils />}
          title={t("kiosk.testing_mode")}
          message={t("kiosk.ordering_disabled")}
        />
      );
    if (items.length === 0)
      return (
        <Placeholder
          t={t}
          icon={<Clock />}
          title={t("kiosk.no_items_available")}
          message={t("kiosk.check_later")}
        />
      );

    return (
      <div className="h-full overflow-y-auto no-scrollbar bg-[#F4F4F5] p-2 pb-[180px] md:p-6 md:pb-6">
        <div className="flex flex-col gap-[6px] mb-0 md:mb-6">
          {items
            .filter((i) => i.available)
            .map((item) => {
              const isSelected = selectedItemIds.has(item.id);
              const cartItem = selectedItems.find((i) => i.id === item.id);
              const needsSide = !!(
                item.requiresSideChoice || item.hasIncludedSide
              );

              return (
                <div
                  key={item.id}
                  className={`flex flex-col transition-all overflow-hidden rounded-[20px] md:rounded-[24px] border border-transparent ${isSelected ? "bg-neutral-900/[0.04] !border-neutral-900/10" : "bg-white shadow-sm hover:border-neutral-200"} ${isReadOnly ? "opacity-80" : ""} no-tap-highlight`}
                >
                  <motion.div
                    whileTap={isReadOnly ? {} : { scale: 0.98 }}
                    onClick={() => {
                      if (isReadOnly) return;
                      triggerHaptic("light");
                      if (needsSide) {
                        setExpandedItemId(
                          expandedItemId === item.id ? null : item.id,
                        );
                      } else {
                        onToggle(item);
                      }
                    }}
                    className={`flex items-center justify-between px-5 py-2 md:px-8 md:py-3 ${isReadOnly ? "cursor-default" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 pr-4">
                      <div className="flex-1 min-w-0">
                        <h3
                          className={`text-[var(--fluid-base)] font-bold leading-snug tracking-tight line-clamp-2 ${isSelected ? "text-neutral-900" : "text-neutral-700"}`}
                        >
                          {item.name}
                        </h3>
                        {isReadOnly && (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-neutral-100 text-neutral-500 rounded text-[9px] font-black uppercase tracking-widest">
                              {t("kiosk.preview_only") || "Preview Only"}
                            </span>
                          </div>
                        )}
                        {needsSide && !isReadOnly && (
                          <div className="mt-1">
                            {!isSelected ? (
                              <span className="inline-flex items-center px-2 py-0.5 bg-violet-50 text-violet-600 rounded text-[9px] font-black uppercase tracking-widest animate-pulse">
                                {t("kiosk.choose_side")}
                              </span>
                            ) : (
                              cartItem?.side && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[10px] font-bold uppercase tracking-tight">
                                  {cartItem.side}
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 md:gap-6 shrink-0">
                      {!isReadOnly && (
                        <div className="w-[40px] md:w-[48px] flex items-center justify-center relative">
                          <QuantityControl
                            isSelected={isSelected}
                            quantity={cartItem?.quantity || 1}
                            onIncrement={() => onUpdateQuantity(item.id, 1)}
                            onDecrement={() => onUpdateQuantity(item.id, -1)}
                            onToggle={() => !isSelected && onToggle(item)}
                            t={t}
                          />
                        </div>
                      )}

                      <div className="flex flex-col items-end gap-0.5 min-w-[60px] md:min-w-[80px]">
                        <span className="text-[var(--fluid-lg)] font-black font-mono text-neutral-900">
                          €{item.price.toFixed(2)}
                        </span>
                        {isPackagingFeeItem(item) && (
                          <span className="text-[9px] font-black text-neutral-400 uppercase tracking-tighter">
                            +{t("menu.packaging_fee") || "Box"}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Inline Side Picker */}
                  <AnimatePresence>
                    {needsSide &&
                      (expandedItemId === item.id ||
                        (isSelected && !cartItem?.side)) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="overflow-hidden bg-neutral-50 border-t border-neutral-100"
                        >
                          <div className="p-5 md:p-6 bg-violet-50/30">
                            <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                              <ChevronRight className="w-3 h-3 text-violet-500" />
                              {t("kiosk.choose_side")}
                            </p>
                            <SideDishInlinePicker
                              item={item}
                              sides={sideItems}
                              selectedSide={cartItem?.side}
                              onSelect={(side) => {
                                onAddWithSide(item, side);
                                setExpandedItemId(null); // auto-collapse on select
                              }}
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
  },
);

const Placeholder: React.FC<{
  icon: React.ReactNode;
  title: string;
  message: string;
  t: any;
}> = ({ icon, title, message, t }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white">
    <div className="w-12 h-12 bg-neutral-50 rounded-full flex items-center justify-center mb-4 text-neutral-400">
      {React.cloneElement(icon as React.ReactElement, { className: "w-6 h-6" })}
    </div>
    <h3 className="text-sm font-black text-neutral-900 uppercase tracking-tight mb-1">
      {title}
    </h3>
    <p className="text-xs text-neutral-400 max-w-[200px] leading-relaxed">
      {message}
    </p>
  </div>
);

const QuantityControl: React.FC<{
  isSelected: boolean;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onToggle: () => void;
  t: (key: string) => string;
}> = ({ isSelected, quantity, onIncrement, onDecrement, onToggle, t }) => {
  return (
    <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait">
        {!isSelected ? (
          <motion.div
            key="dot"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => {
              triggerHaptic("light");
              onToggle();
            }}
            className="w-8 h-8 md:w-9 md:h-9 rounded-full border-2 border-neutral-200 cursor-pointer flex items-center justify-center hover:border-neutral-400 transition-colors touch-target-expansion touch-manipulation"
          />
        ) : (
          <motion.div
            key="control"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center bg-neutral-900 rounded-full p-0.5 gap-1 md:gap-2 overflow-hidden shadow-sm absolute right-0"
          >
            <button
              onClick={() => {
                triggerHaptic("light");
                onDecrement();
              }}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 touch-target-expansion touch-manipulation"
              title={t("modals.remove") || "Decrease"}
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] md:text-xs font-black font-mono text-white min-w-[12px] text-center">
              {quantity}
            </span>
            <button
              onClick={() => {
                triggerHaptic("light");
                onIncrement();
              }}
              className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-90 touch-target-expansion touch-manipulation"
              title={t("modals.add") || "Increase"}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SideDishInlinePicker: React.FC<{
  item: MenuItem;
  sides: MenuItem[];
  selectedSide?: string;
  onSelect: (s?: string) => void;
  t: any;
}> = ({ item, sides, selectedSide, onSelect, t }) => {
  const allowedSides =
    item.sideChoices && item.sideChoices.length > 0
      ? sides.filter((s) => item.sideChoices?.includes(s.name))
      : sides;

  return (
    <div className="flex flex-wrap gap-1.5">
      {allowedSides.map((side) => {
        const isActive = selectedSide === side.name;
        return (
          <button
            key={side.id}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("medium");
              onSelect(side.name);
            }}
            className={`px-3 py-2 touch:px-5 touch:py-3 rounded-xl text-[var(--fluid-base)] font-bold transition-all border active:scale-95 ${
              isActive
                ? "bg-neutral-900 text-white border-neutral-900 shadow-sm"
                : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
            }`}
          >
            {side.name}
          </button>
        );
      })}
    </div>
  );
};

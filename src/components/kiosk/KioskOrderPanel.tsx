import React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingCart,
  Trash2,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Lock,
  X,
} from "lucide-react";
import { CartItem, MenuItem } from "../../types";
import { useStore } from "../../store/useStore";
import { isItemAutoBox } from "../../utils/categoryAutobox";
import { useResponsive } from "../../hooks/useResponsive";
import { triggerHaptic } from "../../utils/haptics";
import { ChevronUp, ChevronDown } from "lucide-react";

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
  onPinOrder: () => void;
  onClearCart: () => void;
  onUpdateSide: (item: CartItem) => void;
  onUpdateQuantity: (id: number, delta: number) => void;
  t: (key: string) => string;
}

export const KioskOrderPanel: React.FC<KioskOrderPanelProps> = React.memo(
  ({
    selectedItems,
    totalPrice,
    rfid,
    setRfid,
    isScanning,
    computedKioskOpen,
    testModeEnabled,
    orderButtonEnabled,
    onOrder,
    onPinOrder,
    onClearCart,
    onUpdateSide,
    onUpdateQuantity,
    t,
  }) => {
    const packagingFee = useStore((s) => s.packagingFee);
    const bgnEnabled = useStore((s) => s.bgnEnabled);
    const { useMobileLayout } = useResponsive();
    const [isExpanded, setIsExpanded] = React.useState(false);

    const bgTotal = (totalPrice * 1.95583).toFixed(2);
    const orderDisabled =
      !selectedItems.length ||
      (!rfid && !testModeEnabled && !useMobileLayout) ||
      isScanning ||
      (!computedKioskOpen && !testModeEnabled);
    const itemCount = selectedItems.reduce((acc, i) => acc + i.quantity, 0);

    // Phone & Portrait Tablet Sticky Bottom Layout
    if (useMobileLayout) {
      return (
        <>
          {/* Backdrop for expanded state */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsExpanded(false)}
                className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm md:hidden"
              />
            )}
          </AnimatePresence>

          <motion.div
            layout
            initial={false}
            animate={{
              height: isExpanded ? "80vh" : "auto",
            }}
            transition={{
              type: "spring",
              damping: 30,
              stiffness: 400,
              restDelta: 0.001,
            }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) {
                triggerHaptic("light");
                setIsExpanded(false);
              }
            }}
            className={`fixed bottom-0 left-0 right-0 z-[70] overflow-hidden rounded-t-[36px] border-t border-white/60 flex flex-col transition-shadow ${isExpanded ? "bg-white shadow-[0_-20px_50px_rgba(0,0,0,0.25)]" : "bg-white/95 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.1)]"}`}
          >
            {/* Draggable Handle */}
            <div
              className="w-full flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
              onClick={() => {
                triggerHaptic("light");
                setIsExpanded(!isExpanded);
              }}
            >
              <div className="w-12 h-1.5 bg-neutral-200 rounded-full" />
            </div>

            {/* Expanded Content Area (Item List) */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="flex-1 flex flex-col overflow-hidden"
                >
                  <div className="px-6 py-4 flex items-center justify-between border-b border-black/5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">
                      {t("orders.items")}
                    </span>
                    {selectedItems.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearCart();
                        }}
                        className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-red-50 active:scale-90 transition-transform"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t("modals.remove")}
                      </button>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {selectedItems.map((item, idx) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={`${item.id}-${idx}`}
                        className="bg-white/50 border border-black/5 backdrop-blur-md p-5 rounded-[24px] shadow-sm relative group"
                      >
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <span className="text-sm font-black text-neutral-900 leading-tight flex-1">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-neutral-900 shrink-0 font-mono">
                              €{item.price.toFixed(2)}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateQuantity(item.id, -item.quantity);
                              }}
                              className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-100 active:scale-90 transition-all shrink-0"
                              title={t("modals.remove")}
                            >
                              <X className="w-5 h-5 stroke-[2.5]" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 bg-neutral-100/50 p-1.5 rounded-xl">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-900 font-bold active:scale-90 transition-transform disabled:opacity-30 touch-target-expansion touch-manipulation"
                              aria-label={`-1 ${item.name}`}
                              title={`-1 ${item.name}`}
                            >
                              -
                            </button>
                            <span
                              className="text-xs font-black w-6 text-center"
                              aria-label={`${t("orders.quantity")}: ${item.quantity}`}
                            >
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-neutral-900 font-bold active:scale-90 transition-transform disabled:opacity-30 touch-target-expansion touch-manipulation"
                              aria-label={`+1 ${item.name}`}
                              title={`+1 ${item.name}`}
                            >
                              +
                            </button>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            {item.side && (
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-black uppercase tracking-tighter bg-neutral-100 px-2 py-1 rounded-md">
                                <span>{item.side}</span>
                              </div>
                            )}
                            {item.extraFees?.some((f) => f.amount > 0) && (
                              <span className="text-[9px] font-bold text-neutral-400 uppercase">
                                + {t("menu.packaging_fee")}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sticky Summary Area (Total + Order Button) */}
            <div
              className={`px-4 pt-3 pb-6 flex items-center justify-between shrink-0 border-t gap-2 ${isExpanded ? "border-black/5" : "border-transparent"}`}
            >
              <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-3 cursor-pointer shrink-0"
              >
                <div className="relative">
                  <div
                    className={`p-2 rounded-xl transition-colors ${selectedItems.length > 0 ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-300"}`}
                  >
                    <ShoppingCart className="w-5 h-5" />
                  </div>
                  {selectedItems.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black w-4 h-4 flex items-center justify-center rounded-full ring-2 ring-white">
                      {itemCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-neutral-400 uppercase tracking-widest leading-none mb-1">
                    {t("orders.total")}
                  </span>
                  <span className="text-xl font-black text-neutral-900 leading-none">
                    €{totalPrice.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex-1 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded && selectedItems.length > 0) {
                      triggerHaptic("medium");
                      setIsExpanded(true);
                      return;
                    }

                    // On mobile, if not in test mode and no RFID, trigger PIN order
                    if (!testModeEnabled && !rfid) {
                      onPinOrder();
                    } else {
                      onOrder();
                    }
                  }}
                  disabled={
                    isExpanded
                      ? orderDisabled
                      : !selectedItems.length || isScanning
                  }
                  className={`flex-1 px-5 py-3.5 rounded-2xl font-black text-[11px] whitespace-nowrap uppercase tracking-widest transition-all active:scale-95 ${
                    (
                      isExpanded
                        ? orderDisabled
                        : !selectedItems.length || isScanning
                    )
                      ? "bg-neutral-100 text-neutral-400"
                      : "bg-neutral-900 text-white shadow-lg shadow-neutral-900/20"
                  }`}
                >
                  {isScanning ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t("kiosk.processing")}</span>
                    </div>
                  ) : !isExpanded ? (
                    t("kiosk.view_cart")
                  ) : testModeEnabled && !rfid ? (
                    t("kiosk.place_order")
                  ) : rfid ? (
                    t("modals.confirm")
                  ) : (
                    t("kiosk.pin_order")
                  )}
                </button>

                {/* PIN Code Quick Access (Available even when collapsed) */}
                {selectedItems.length > 0 && !isScanning && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPinOrder();
                    }}
                    disabled={!computedKioskOpen && !testModeEnabled}
                    className={`p-3.5 rounded-2xl active:scale-95 transition-all shadow-sm flex items-center justify-center ${
                      !computedKioskOpen && !testModeEnabled
                        ? "bg-neutral-50 text-neutral-300 border-neutral-100"
                        : "bg-white border-2 border-neutral-900 text-neutral-900"
                    }`}
                    title={t("kiosk.pin_order")}
                    aria-label={t("kiosk.pin_order")}
                  >
                    <Lock className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Safe Area Spacer for iOS Home Indicator */}
            <div className="h-[env(safe-area-inset-bottom,20px)] bg-transparent" />
          </motion.div>
        </>
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
              {t("orders.items")}
            </h2>
          </div>
          {selectedItems.length > 0 && (
            <button
              onClick={onClearCart}
              className="p-2.5 bg-white border border-neutral-100 hover:bg-red-50 text-neutral-400 hover:text-red-500 rounded-xl transition-all active:scale-90 shadow-sm"
              aria-label={t("modals.remove")}
              title={t("modals.remove")}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Cart Items — Flexible & Inner Scrollable */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {selectedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale p-4">
              <ShoppingCart className="w-8 h-8 mb-4 stroke-1" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                {t("kiosk.no_items_selected")}
              </p>
            </div>
          ) : (
            selectedItems.map((item, idx) => (
              <div
                key={`${item.id}-${idx}`}
                className="group flex flex-col gap-1 pb-3 border-b border-neutral-50 last:border-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="text-xs font-bold text-neutral-900 leading-tight flex-1">
                    {item.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {item.quantity} ×
                      </span>
                      <span className="text-xs font-mono font-black text-neutral-900 shrink-0">
                        €{item.price.toFixed(2)}
                      </span>
                    </div>
                    <button
                      onClick={() => onUpdateQuantity(item.id, -item.quantity)}
                      className="ml-1 w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all active:scale-90"
                      title={t("modals.remove")}
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* Nested Details */}
                <div className="pl-3 space-y-0.5">
                  {item.side && (
                    <div className="flex items-center gap-1.5 text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                      <span className="opacity-40">└</span>
                      <span>{item.side}</span>
                      <span className="text-[7px] bg-neutral-100 px-1 py-0.5 rounded text-neutral-500">
                        {t("kiosk.included")}
                      </span>
                    </div>
                  )}
                  {item.extraFees?.map((fee, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex justify-between items-center text-[9px] text-neutral-400 font-bold uppercase tracking-wider"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-40">└</span>
                        <span>{fee.type}</span>
                      </div>
                      <span className="font-mono">
                        +€{fee.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}

                  {isItemAutoBox(item) && (
                    <div className="flex justify-between items-center text-[9px] text-neutral-400 font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <span className="opacity-40">└</span>
                        <span>{t("menu.packaging_fee") || "Box"}</span>
                      </div>
                      <span className="font-mono">
                        +€{packagingFee.toFixed(2)}
                      </span>
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
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                {t("orders.total")}
              </span>
              <span className="text-2xl font-black text-neutral-900 font-mono">
                €{totalPrice.toFixed(2)}
              </span>
            </div>
            {bgnEnabled && (
              <div className="flex justify-between items-baseline leading-none opacity-60">
                <span className="text-[8px] font-black uppercase tracking-widest text-neutral-400">
                  {t("kiosk.in_leva")} (×1.95583)
                </span>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-neutral-900 font-mono">
                    {bgTotal}
                    {t("kiosk.currency_bg")}
                  </span>
                  <span className="text-[9px] font-bold text-neutral-400">
                    ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)}{" "}
                    {t("menu.items")})
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <div className="flex gap-3">
            <button
              onClick={onOrder}
              disabled={orderDisabled}
              className={`flex-1 py-4 rounded-2xl relative overflow-hidden transition-all active:scale-[0.98] ${
                orderDisabled
                  ? "bg-neutral-200 text-neutral-400 cursor-not-allowed grayscale"
                  : "bg-neutral-900 text-white shadow-xl hover:shadow-2xl"
              }`}
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                {isScanning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-[10px] xl:text-xs xxl:text-sm font-black uppercase tracking-wider xl:tracking-widest whitespace-nowrap px-1">
                      {t("kiosk.processing")}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[10px] xl:text-xs xxl:text-sm font-black uppercase tracking-wider xl:tracking-widest whitespace-nowrap px-1">
                      {testModeEnabled && !rfid
                        ? t("kiosk.place_order")
                        : rfid
                          ? t("modals.confirm")
                          : t("kiosk.please_scan_card")}
                    </span>
                    {!rfid && !testModeEnabled && (
                      <ShoppingCart className="w-4 h-4 animate-pulse" />
                    )}
                  </>
                )}
              </div>

              {/* Scan highlight animator if no RFID */}
              {!rfid && !testModeEnabled && !isScanning && (
                <motion.div
                  animate={{ x: ["100%", "-100%"] }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "linear",
                  }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none"
                />
              )}
            </button>

            {!orderDisabled && (
              <button
                onClick={onPinOrder}
                className="px-6 py-4 rounded-2xl bg-white border-2 border-neutral-900 text-neutral-900 font-black flex items-center justify-center gap-2 hover:bg-neutral-50 transition-all shadow-md active:scale-95"
                title={t("kiosk.pin_order")}
                aria-label={t("kiosk.pin_order")}
              >
                <Lock className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* RFID hint if scanning */}
          {!orderDisabled && !rfid && !testModeEnabled && !useMobileLayout && (
            <div className="flex items-center justify-center gap-1.5 p-2 bg-yellow-50 text-yellow-700 rounded-xl border border-yellow-100">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-tighter">
                {t("kiosk.user_history_scan_prompt")}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  },
);

export const OrderSuccessOverlay: React.FC<{ show: boolean; t: any; message?: string }> = ({
  show,
  t,
  message,
}) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: "circOut" }}
          className="bg-white rounded-[40px] p-8 shadow-2xl text-center max-w-sm w-full border border-neutral-100"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-neutral-900 mb-2 uppercase tracking-tight">
            {t("kiosk.order_success")}
          </h2>
          <p className="text-neutral-400 text-sm">
            {message || t("kiosk.balance_cleared")}
          </p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

import React from "react";
import { motion } from "motion/react";
import { isCategoryAutoBox } from "../../utils/categoryAutobox";

interface KioskCategorySidebarProps {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
  menu: import("../../types").MenuItem[];
  t: (key: string) => string;
}

export const KioskCategorySidebar: React.FC<KioskCategorySidebarProps> =
  React.memo(({ categories, activeCategory, onSelect, menu, t }) => {
    // Reads live from parser settings in localStorage — no re-parse needed
    const isPackagingFeeItem = (category: string) =>
      isCategoryAutoBox(category);

    return (
      <div className="flex-1 flex md:flex-col overflow-hidden">
        <div className="flex-1 flex md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar p-1 md:p-2 gap-1 md:space-y-1">
          {categories.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => onSelect(cat)}
                className={`shrink-0 md:w-full text-left px-4 py-3 md:py-4 rounded-xl transition-all relative group overflow-hidden ${
                  isActive
                    ? "bg-neutral-900 text-white shadow-md"
                    : "hover:bg-neutral-50 text-neutral-500"
                }`}
              >
                <span
                  className={`text-[10px] md:text-xs font-black uppercase tracking-wider relative z-10 transition-colors whitespace-nowrap ${
                    isActive ? "text-white" : "group-hover:text-neutral-900"
                  }`}
                >
                  {(() => {
                    const normalizedCat = cat.trim().toLowerCase();
                    // Try matching common English labels to our lowercase keys
                    const keyMap: Record<string, string> = {
                      "main dishes": "mains",
                      "side dishes": "sides",
                      soups: "soups",
                      salads: "salads",
                      bread: "bread",
                      bbq: "bbq",
                      desserts: "desserts",
                      drinks: "drinks",
                      other: "other",
                    };
                    const key = keyMap[normalizedCat] || normalizedCat;
                    const translated = t(`categories.${key}`);
                    return translated !== `categories.${key}`
                      ? translated
                      : cat;
                  })()}
                </span>

                {isPackagingFeeItem(cat) && (
                  <div
                    className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter z-10 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-neutral-100 text-neutral-400"
                    }`}
                  >
                    {t("menu.packaging_fee") || "Box"}
                  </div>
                )}
                {isActive && (
                  <motion.div
                    layoutId="active-cat-pill"
                    className="absolute inset-0 bg-neutral-900"
                    transition={{
                      type: "tween",
                      ease: "circOut",
                      duration: 0.25,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  });

import React from "react";
import { motion } from "motion/react";
import { isCategoryAutoBox } from "../../utils/categoryAutobox";

interface KioskCategorySidebarProps {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
  menu: import("../../types").MenuItem[];
  t: (key: string) => string;
  customCategories?: import("../../types").CustomCategory[];
  lang?: string;
}

export const KioskCategorySidebar: React.FC<KioskCategorySidebarProps> =
  React.memo(({ categories, activeCategory, onSelect, menu, t, customCategories = [], lang = 'bg' }) => {
    // Reads live from parser settings in localStorage — no re-parse needed
    const isPackagingFeeItem = (category: string) =>
      isCategoryAutoBox(category);

    const containerRef = React.useRef<HTMLDivElement>(null);
    const [showLeftFade, setShowLeftFade] = React.useState(false);
    const [showRightFade, setShowRightFade] = React.useState(false);

    const handleScroll = React.useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftFade(scrollLeft > 5);
      setShowRightFade(scrollLeft < scrollWidth - clientWidth - 5);
    }, []);

    React.useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      handleScroll();
      container.addEventListener("scroll", handleScroll);

      const resizeObserver = new ResizeObserver(handleScroll);
      resizeObserver.observe(container);

      // Also trigger scroll handle on category count updates
      return () => {
        container.removeEventListener("scroll", handleScroll);
        resizeObserver.disconnect();
      };
    }, [categories, handleScroll]);

    return (
      <div className="flex-1 flex md:flex-col overflow-hidden relative">
        {/* Left Fade Overlay */}
        <div 
          className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent pointer-events-none transition-opacity duration-200 z-20 md:hidden"
          style={{ opacity: showLeftFade ? 1 : 0 }}
        />
        {/* Right Fade Overlay */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent pointer-events-none transition-opacity duration-200 z-20 md:hidden"
          style={{ opacity: showRightFade ? 1 : 0 }}
        />

        <div ref={containerRef} className="flex-1 flex md:flex-col overflow-x-auto md:overflow-y-auto custom-scrollbar p-1 md:p-2 gap-1 md:space-y-1 no-scrollbar">
          {[...categories]
            .sort((a, b) => {
              const isOtherA =
                a.toLowerCase().includes("other") ||
                a.toLowerCase().includes("други");
              const isOtherB =
                b.toLowerCase().includes("other") ||
                b.toLowerCase().includes("други");
              if (isOtherA && !isOtherB) return 1;
              if (!isOtherA && isOtherB) return -1;
              return 0;
            })
            .map((cat) => {
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
                    const customCat = customCategories.find(c => c.id === cat);
                    if (customCat) {
                       return customCat.names[lang] || customCat.names['en'] || customCat.names['bg'] || cat;
                    }
                    const translated = t(`categories.${cat}`);
                    return translated !== `categories.${cat}` ? translated : cat;
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

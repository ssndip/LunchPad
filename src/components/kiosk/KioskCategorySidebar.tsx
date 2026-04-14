import React from 'react';
import { motion } from 'motion/react';

interface KioskCategorySidebarProps {
  categories: string[];
  activeCategory: string;
  onSelect: (cat: string) => void;
  t: (key: string) => string;
}

export const KioskCategorySidebar: React.FC<KioskCategorySidebarProps> = ({
  categories,
  activeCategory,
  onSelect,
  t,
}) => {
  const isPackagingFeeItem = (category?: string) => {
    if (!category) return false;
    const c = category.toLowerCase();
    return c.includes('side dishes') || c.includes('гарнитури') || c.includes('bbq') || c.includes('скара');
  };

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
                  ? 'bg-neutral-900 text-white shadow-md' 
                  : 'hover:bg-neutral-50 text-neutral-500'
              }`}
            >
              <span className={`text-[10px] md:text-xs font-black uppercase tracking-wider relative z-10 transition-colors whitespace-nowrap ${
                isActive ? 'text-white' : 'group-hover:text-neutral-900'
              }`}>
                {(() => {
                  const normalizedCat = cat.trim().toUpperCase();
                  const translated = t(`categories.${normalizedCat}`);
                  return translated !== `categories.${normalizedCat}` ? translated : cat;
                })()}
              </span>
              
              {isPackagingFeeItem(cat) && (
                <div className={`absolute top-1 right-1 px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-tighter z-10 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-400'
                }`}>
                  {t('menu.packaging_fee') || 'Box'}
                </div>
              )}
              {isActive && (
                <motion.div
                  layoutId="active-cat-pill"
                  className="absolute inset-0 bg-neutral-900"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

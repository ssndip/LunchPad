import { useStore } from './useStore';
import { useMemo } from 'react';
import { MenuItem } from '../types';

export const useGroupedMenu = () => {
  const menu = useStore((state) => state.menu);
  return useMemo(() => {
    return menu.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);
};

// Helper to identify items requiring packaging fee
const isPackagingFeeItem = (category?: string) => {
  if (!category) return false;
  const c = category.toLowerCase();
  return c.includes('side dishes') || c.includes('гарнитури') || c.includes('bbq') || c.includes('скара');
};

export const useSideItems = () => {
  const menu = useStore((state) => state.menu);
  return useMemo(() => {
    return menu.filter(item => 
      item.available && (item.category === 'Side Dishes' || item.category === 'Гарнитури')
    );
  }, [menu]);
};

export const useTotalPrice = () => {
  const selectedItems = useStore((state) => state.selectedItems);
  const packagingFee = useStore((state) => state.packagingFee);
  return useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      const extra = isPackagingFeeItem(item.category) ? packagingFee : 0;
      return sum + (item.price + extra) * (item.quantity || 1);
    }, 0);
  }, [selectedItems, packagingFee]);
};

export const useSelectedItemIds = () => {
  const selectedItems = useStore((state) => state.selectedItems);
  return useMemo(() => new Set(selectedItems.map(i => i.id)), [selectedItems]);
};

export const useComputedKioskOpen = () => {
  const kioskOpen = useStore((state) => state.kioskOpen);
  const kioskAutoTiming = useStore((state) => state.kioskAutoTiming);
  const openTime = useStore((state) => state.kioskOpenTime);
  const closeTime = useStore((state) => state.kioskCloseTime);

  return useMemo(() => {
    // 1. Manual override takes precedence? 
    // Usually, if it's manually closed, it's closed.
    // However, if Auto Timing is ON, we evaluate the window.
    if (!kioskAutoTiming) return kioskOpen;

    const now = new Date();
    const currentHHmm = now.getHours().toString().padStart(2, '0') + ':' + 
                        now.getMinutes().toString().padStart(2, '0');

    // Simple time range check (assumes same-day window like 08:00 - 11:00)
    // If closeTime < openTime, it crosses midnight (not handled here yet, but based on UI it's morning hours)
    const isWithinWindow = currentHHmm >= openTime && currentHHmm < closeTime;
    
    return isWithinWindow;
  }, [kioskOpen, kioskAutoTiming, openTime, closeTime]);
};

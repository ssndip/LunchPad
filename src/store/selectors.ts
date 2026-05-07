import { useStore } from './useStore';
import { useMemo } from 'react';
import { MenuItem } from '../types';
import { isItemAutoBox } from '../utils/categoryAutobox';

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


export const useSideItems = () => {
  const menu = useStore((state) => state.menu);
  const customCategories = useStore((state) => state.customCategories) || [];
  return useMemo(() => {
    // Collect all category IDs that represent side dishes:
    // 1. The built-in 'sides' ID used by the parser
    // 2. Legacy display-name strings (backward compat)
    // 3. Any custom category whose id contains 'side' or keywords suggest it
    const sideIds = new Set<string>(['sides', 'side dishes', 'Side Dishes', 'Гарнитури', 'гарнитури']);
    // Also mark custom categories that are configured as hasSideDish=false but ARE the side dish pool
    // (identified by their id being 'sides')
    customCategories.forEach((c: any) => {
      if (c.id === 'sides' || c.keywords?.some((k: string) => /^(гарнитур|side dish)/i.test(k))) {
        sideIds.add(c.id);
      }
    });
    return menu.filter(item =>
      item.available && sideIds.has(item.category)
    );
  }, [menu, customCategories]);
};

export const useTotalPrice = () => {
  const selectedItems = useStore((state) => state.selectedItems);
  const packagingFee = useStore((state) => state.packagingFee);
  return useMemo(() => {
    return selectedItems.reduce((sum, item) => {
      // Priority: 
      // 1. Explicit item packaging fee (extracted from text)
      // 2. Global packaging fee if tagged or categorized
      const isFeeItem = isItemAutoBox(item);
      const fee = (item.packagingFee !== undefined && item.packagingFee !== null) ? item.packagingFee : (isFeeItem ? packagingFee : 0);
      return sum + (item.price + fee) * (item.quantity || 1);
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

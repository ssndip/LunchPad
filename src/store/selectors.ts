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
  return useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price, 0);
  }, [selectedItems]);
};

export const useSelectedItemIds = () => {
  const selectedItems = useStore((state) => state.selectedItems);
  return useMemo(() => new Set(selectedItems.map(i => i.id)), [selectedItems]);
};

export const useComputedKioskOpen = () => {
  return useStore((state) => state.kioskOpen);
};

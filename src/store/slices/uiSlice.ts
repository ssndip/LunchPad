import { StateCreator } from 'zustand';
import { AppState } from '../useStore';

export interface UISlice {
  mode: 'kiosk' | 'manager';
  activeTab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules';
  showHistoryReport: boolean;
  setMode: (mode: 'kiosk' | 'manager') => void;
  setActiveTab: (tab: 'menu' | 'orders' | 'history' | 'cards' | 'settings' | 'analytics' | 'parser_rules') => void;
  setShowHistoryReport: (show: boolean) => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  mode: (() => {
    const isManager = new URLSearchParams(window.location.search).get('view') === 'manager';
    if (!isManager) sessionStorage.removeItem('token');
    return isManager ? 'manager' : 'kiosk';
  })(),
  activeTab: (new URLSearchParams(window.location.search).get('tab') as any) || 'menu',
  showHistoryReport: false,

  setMode: (mode) => {
    const params = new URLSearchParams(window.location.search);
    params.set('view', mode);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    set({ mode });
  },
  setActiveTab: (activeTab) => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', activeTab);
    window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    set({ activeTab });
  },
  setShowHistoryReport: (showHistoryReport) => set({ showHistoryReport }),
});

import { create } from 'zustand';
import { createAuthSlice, AuthSlice } from './slices/authSlice';
import { createMenuSlice, MenuSlice } from './slices/menuSlice';
import { createOrderSlice, OrderSlice } from './slices/orderSlice';
import { createSettingsSlice, SettingsSlice } from './slices/settingsSlice';
import { createAnalyticsSlice, AnalyticsSlice } from './slices/analyticsSlice';
import { createUISlice, UISlice } from './slices/uiSlice';

export type AppState = AuthSlice & MenuSlice & OrderSlice & SettingsSlice & AnalyticsSlice & UISlice;

export const useStore = create<AppState>()((...a) => ({
  ...createAuthSlice(...a),
  ...createMenuSlice(...a),
  ...createOrderSlice(...a),
  ...createSettingsSlice(...a),
  ...createAnalyticsSlice(...a),
  ...createUISlice(...a),
}));

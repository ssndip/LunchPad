import { StateCreator } from 'zustand';
import { AppState } from '../useStore';
import { MenuItem } from '../../types';

export interface MenuSlice {
  menu: MenuItem[];
  editingMenu: MenuItem[];
  menuVersion: number;
  menuDate: string;
  setMenu: (menu: MenuItem[]) => void;
  setEditingMenu: (menu: MenuItem[]) => void;
  setMenuVersion: (v: number) => void;
  setMenuDate: (date: string) => void;
}

export const createMenuSlice: StateCreator<AppState, [], [], MenuSlice> = (set) => ({
  menu: [],
  editingMenu: [],
  menuVersion: 1,
  menuDate: '',

  setMenu: (menu) => set({ menu }),
  setEditingMenu: (editingMenu) => set({ editingMenu }),
  setMenuVersion: (menuVersion) => set({ menuVersion }),
  setMenuDate: (menuDate) => set({ menuDate }),
});

import { StateCreator } from 'zustand';
import { AppState } from '../useStore';

export interface AuthSlice {
  token: string | null;
  isManagerLoggedIn: boolean;
  loginManager: (token: string) => void;
  logoutManager: () => void;
  setToken: (token: string | null) => void;
  setIsManagerLoggedIn: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  token: sessionStorage.getItem('token'),
  isManagerLoggedIn: !!sessionStorage.getItem('token'),
  
  setToken: (token) => set({ token }),
  setIsManagerLoggedIn: (isManagerLoggedIn) => set({ isManagerLoggedIn }),

  loginManager: (token) => {
    sessionStorage.setItem('token', token);
    set({ token, isManagerLoggedIn: true });
    // Refresh to ensure all sync hooks and state are fresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
  },
  
  logoutManager: () => {
    sessionStorage.removeItem('token');
    window.location.href = window.location.origin + '/';
  },
});

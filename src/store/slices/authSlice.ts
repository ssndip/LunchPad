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
    // No page reload. This used to hard-refresh 100ms after logging in, because
    // useWebSocket captured the token once on mount and reconnecting the socket
    // as an admin was only possible by reloading everything. The hook now
    // watches the token, so setting it here is enough: the socket reconnects
    // authenticated and useSyncState's loadManagerData pulls the dashboard's
    // data, without throwing away the app and rebuilding it.
  },
  
  logoutManager: () => {
    sessionStorage.removeItem('token');
    window.location.href = window.location.origin + '/';
  },
});

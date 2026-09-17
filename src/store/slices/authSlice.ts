import { StateCreator } from 'zustand';
import { AppState } from '../useStore';

export interface AuthSlice {
  token: string | null;
  isManagerLoggedIn: boolean;
  /** Set when the server rejected our token, so the login can say why. */
  sessionExpired: boolean;
  loginManager: (token: string) => void;
  logoutManager: () => void;
  /** Tear down a session the server no longer accepts, without navigating. */
  expireSession: () => void;
  setToken: (token: string | null) => void;
  setIsManagerLoggedIn: (v: boolean) => void;
}

export const createAuthSlice: StateCreator<AppState, [], [], AuthSlice> = (set) => ({
  token: sessionStorage.getItem('token'),
  isManagerLoggedIn: !!sessionStorage.getItem('token'),
  sessionExpired: false,
  
  setToken: (token) => set({ token }),
  setIsManagerLoggedIn: (isManagerLoggedIn) => set({ isManagerLoggedIn }),

  loginManager: (token) => {
    sessionStorage.setItem('token', token);
    set({ token, isManagerLoggedIn: true, sessionExpired: false });
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

  /**
   * The counterpart to `logoutManager` for a token the server has stopped
   * accepting. It deliberately does not navigate: the admin stays on
   * ?view=manager and gets the login form with an explanation, so they can
   * carry on where they were instead of being bounced to the kiosk.
   *
   * Idempotent, because several in-flight requests typically fail together.
   */
  expireSession: () => {
    sessionStorage.removeItem('token');
    set((state) =>
      state.token === null && state.sessionExpired
        ? state
        : { token: null, isManagerLoggedIn: false, sessionExpired: true },
    );
  },
});

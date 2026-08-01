import { create } from 'zustand';

const KEY = 'mlbstriker.token';

// Persist the token in localStorage on web so a refresh keeps you logged in.
// On native there's no localStorage; the token just lives in memory.
function load(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
  } catch {
    return null;
  }
}
function save(token: string | null) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore storage failures */
  }
}

interface AuthState {
  token: string | null;
  setToken: (token: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: load(),
  setToken: (token) => {
    save(token);
    set({ token });
  },
  logout: () => {
    save(null);
    set({ token: null });
  },
}));

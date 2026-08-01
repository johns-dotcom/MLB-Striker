import { create } from 'zustand';

const KEY = 'mlbstriker.pins';

// Pinned game codes, persisted to localStorage on web so pins survive refresh.
function load(): string[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}
function save(codes: string[]) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(codes));
  } catch {
    /* ignore */
  }
}

interface PinsState {
  // Ordered list of pinned game event tickers (globally unique across sports).
  pinned: string[];
  isPinned: (eventTicker: string) => boolean;
  toggle: (eventTicker: string) => void;
}

export const usePins = create<PinsState>((set, get) => ({
  pinned: load(),
  isPinned: (id) => get().pinned.includes(id),
  toggle: (id) =>
    set((s) => {
      const next = s.pinned.includes(id)
        ? s.pinned.filter((c) => c !== id)
        : [...s.pinned, id];
      save(next);
      return { pinned: next };
    }),
}));

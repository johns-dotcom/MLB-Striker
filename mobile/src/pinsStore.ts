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
  pinned: string[]; // ordered; most-recently pinned last
  isPinned: (code: string) => boolean;
  toggle: (code: string) => void;
}

export const usePins = create<PinsState>((set, get) => ({
  pinned: load(),
  isPinned: (code) => get().pinned.includes(code),
  toggle: (code) =>
    set((s) => {
      const next = s.pinned.includes(code)
        ? s.pinned.filter((c) => c !== code)
        : [...s.pinned, code];
      save(next);
      return { pinned: next };
    }),
}));

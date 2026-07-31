import { create } from 'zustand';
import type { BasketLeg } from './types';

let counter = 0;
function localId(): string {
  counter += 1;
  return `leg-${Date.now()}-${counter}`;
}

interface BasketState {
  legs: BasketLeg[];
  addLeg: (leg: Omit<BasketLeg, 'id'>) => void;
  updateLeg: (id: string, patch: Partial<Omit<BasketLeg, 'id'>>) => void;
  removeLeg: (id: string) => void;
  clear: () => void;
  /** Total capital at risk in dollars (matches the backend's cap logic). */
  totalRiskUsd: () => number;
}

export const useBasket = create<BasketState>((set, get) => ({
  legs: [],
  addLeg: (leg) => set((s) => ({ legs: [...s.legs, { ...leg, id: localId() }] })),
  updateLeg: (id, patch) =>
    set((s) => ({ legs: s.legs.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
  removeLeg: (id) => set((s) => ({ legs: s.legs.filter((l) => l.id !== id) })),
  clear: () => set({ legs: [] }),
  totalRiskUsd: () =>
    get().legs.reduce((sum, l) => {
      const perContract = l.action === 'buy' ? l.price : 100 - l.price;
      return sum + (perContract * l.count) / 100;
    }, 0),
}));

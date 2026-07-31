import type { BasketLeg, Game, StrikeResult } from './types';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const TOKEN = process.env.EXPO_PUBLIC_API_TOKEN ?? '';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

export const api = {
  health: () => req<{ ok: boolean; env: string; dbEnabled: boolean }>('/health'),

  games: () => req<{ env: string; games: Game[] }>('/mlb/games'),

  balance: () => req<{ env: string; balanceCents: number }>('/portfolio/balance'),

  positions: () =>
    req<{ env: string; positions: { ticker: string; position: number; realized_pnl: number }[] }>(
      '/portfolio/positions',
    ),

  history: () =>
    req<{ dbEnabled: boolean; baskets: Record<string, unknown>[] }>('/history/baskets'),

  strike: (legs: BasketLeg[], expectEnv: string, note?: string) =>
    req<StrikeResult>('/basket/strike', {
      method: 'POST',
      body: JSON.stringify({
        expectEnv,
        note,
        legs: legs.map((l) => ({
          ticker: l.ticker,
          action: l.action,
          side: l.side,
          count: l.count,
          price: l.price,
          clientOrderId: l.id,
        })),
      }),
    }),
};

export const apiEnvBase = BASE;

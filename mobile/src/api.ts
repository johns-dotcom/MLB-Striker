import type { BasketLeg, Game, GameDetail, StrikeResult } from './types';
import { useAuth } from './authStore';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = useAuth.getState().token ?? '';
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  // A 401 means our token is stale/invalid — drop it so the login screen shows.
  if (res.status === 401) {
    useAuth.getState().logout();
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = body?.message || body?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body as T;
}

/** Exchange the shared password for an API token. Throws ApiError on bad password. */
export async function login(password: string): Promise<string> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || !body?.token) {
    const msg =
      res.status === 401
        ? 'Incorrect password'
        : body?.error === 'login_not_configured'
          ? 'Login is not set up on the server yet'
          : body?.error || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, body);
  }
  return body.token as string;
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

  gameDetail: (gameCode: string) =>
    req<GameDetail>(`/mlb/game/${encodeURIComponent(gameCode)}`),

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

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
  const text = await res.text();
  const body = safeParse(text);
  if (!res.ok) {
    // Only drop the session on a genuine auth-token failure (requireAuth),
    // not on business-logic 401s like a wrong current password.
    if (res.status === 401 && body?.error === 'unauthorized') {
      useAuth.getState().logout();
    }
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
  const body = safeParse(text) ?? {};
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

// Tolerate non-JSON responses (e.g. an HTML 502 from a proxy) without throwing
// a raw SyntaxError — callers rely on ApiError.
function safeParse(text: string): any {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
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

  sports: () => req<{ sports: { key: string; label: string }[] }>('/sports'),

  games: (sport: string) =>
    req<{ sport: string; env: string; games: Game[] }>(`/sports/${encodeURIComponent(sport)}/games`),

  gameDetail: (sport: string, gameCode: string) =>
    req<GameDetail>(`/sports/${encodeURIComponent(sport)}/games/${encodeURIComponent(gameCode)}`),

  prices: (tickers: string[]) =>
    req<{
      prices: Record<
        string,
        { yesBid?: number; yesAsk?: number; noBid?: number; noAsk?: number; lastPrice?: number }
      >;
    }>('/markets/prices', { method: 'POST', body: JSON.stringify({ tickers }) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    req<{ ok: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

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

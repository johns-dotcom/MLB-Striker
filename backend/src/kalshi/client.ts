import { config } from '../config.js';
import { normalizePrivateKey, signRequest } from './sign.js';
import type {
  KalshiBalance,
  KalshiBatchOrderResponse,
  KalshiEvent,
  KalshiMarket,
  KalshiOrderRequest,
  KalshiPosition,
} from './types.js';

const BASE = config.kalshi.baseUrl;
// Path prefix that must be included in the signed message (everything after host).
const PATH_PREFIX = new URL(BASE).pathname; // "/trade-api/v2"

// Private key is normalised lazily on first use so the server can boot before
// credentials are configured (e.g. a fresh Railway deploy).
let cachedPrivateKey: string | null = null;
function getPrivateKey(): string {
  if (!config.kalshiConfigured) throw new KalshiNotConfigured();
  if (!cachedPrivateKey) cachedPrivateKey = normalizePrivateKey(config.kalshi.privateKey);
  return cachedPrivateKey;
}

export class KalshiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = 'KalshiError';
  }
}

/** Thrown when a Kalshi endpoint is hit before API credentials are set. */
export class KalshiNotConfigured extends Error {
  constructor() {
    super('Kalshi credentials are not configured (set KALSHI_API_KEY_ID and KALSHI_PRIVATE_KEY).');
    this.name = 'KalshiNotConfigured';
  }
}

async function request<T>(
  method: string,
  route: string, // e.g. "/markets" — appended to PATH_PREFIX
  opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  const path = `${PATH_PREFIX}${route}`;
  const url = new URL(`${BASE}${route}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  // NOTE: the signature covers only the path, never the query string.
  const authHeaders = signRequest({
    privateKeyPem: getPrivateKey(),
    apiKeyId: config.kalshi.apiKeyId,
    method,
    path,
  });

  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!res.ok) {
    throw new KalshiError(
      `Kalshi ${method} ${route} failed: ${res.status}`,
      res.status,
      parsed ?? text,
    );
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const kalshi = {
  env: config.kalshi.env,

  async exchangeStatus(): Promise<{ trading_active: boolean; exchange_active: boolean }> {
    return request('GET', '/exchange/status');
  },

  async getBalance(): Promise<KalshiBalance> {
    return request('GET', '/portfolio/balance');
  },

  async getPositions(): Promise<{ market_positions: KalshiPosition[] }> {
    return request('GET', '/portfolio/positions');
  },

  /** MLB game events for the configured series. */
  async getMlbEvents(params: { status?: string; limit?: number } = {}): Promise<{
    events: KalshiEvent[];
  }> {
    return request('GET', '/events', {
      query: {
        series_ticker: config.kalshi.mlbSeriesTicker,
        status: params.status ?? 'open',
        limit: params.limit ?? 100,
        with_nested_markets: 'false',
      },
    });
  },

  /** Markets, optionally scoped to an event or the MLB series. */
  async getMarkets(
    params: { eventTicker?: string; status?: string; limit?: number } = {},
  ): Promise<{ markets: KalshiMarket[]; cursor?: string }> {
    return request('GET', '/markets', {
      query: {
        event_ticker: params.eventTicker,
        series_ticker: params.eventTicker ? undefined : config.kalshi.mlbSeriesTicker,
        status: params.status ?? 'open',
        limit: params.limit ?? 200,
      },
    });
  },

  async getMarket(ticker: string): Promise<{ market: KalshiMarket }> {
    return request('GET', `/markets/${encodeURIComponent(ticker)}`);
  },

  /**
   * Place up to 20 orders atomically-ish via the batched endpoint. Kalshi
   * validates each order independently and returns a per-order result.
   */
  async placeBatchOrders(orders: KalshiOrderRequest[]): Promise<KalshiBatchOrderResponse> {
    return request('POST', '/portfolio/orders/batched', { body: { orders } });
  },
};

export type KalshiClient = typeof kalshi;

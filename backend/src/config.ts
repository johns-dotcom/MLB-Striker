import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v.trim();
}

function optional(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v || v.trim() === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Env var ${name} must be a number, got "${v}"`);
  return n;
}

const KALSHI_ENV = optional('KALSHI_ENV', 'demo') as 'demo' | 'prod';
if (KALSHI_ENV !== 'demo' && KALSHI_ENV !== 'prod') {
  throw new Error(`KALSHI_ENV must be "demo" or "prod", got "${KALSHI_ENV}"`);
}

// Kalshi API base URLs (v2). Demo is a fully separate sandbox with fake money.
const KALSHI_BASE_URLS = {
  demo: 'https://demo-api.kalshi.co/trade-api/v2',
  prod: 'https://api.elections.kalshi.com/trade-api/v2',
} as const;

export const config = {
  port: num('PORT', 8080),
  apiAuthToken: required('API_AUTH_TOKEN'),
  corsOrigins: optional('CORS_ORIGINS', '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  kalshi: {
    env: KALSHI_ENV,
    baseUrl: KALSHI_BASE_URLS[KALSHI_ENV],
    // Optional at boot so the server can start (and pass health checks) before
    // credentials are configured. Trading endpoints check `kalshiConfigured`.
    apiKeyId: optional('KALSHI_API_KEY_ID', ''),
    privateKey: optional('KALSHI_PRIVATE_KEY', ''),
    mlbSeriesTicker: optional('KALSHI_MLB_SERIES_TICKER', 'KXMLBGAME'),
  },

  limits: {
    maxOrderNotionalUsd: num('MAX_ORDER_NOTIONAL_USD', 100),
    // Kalshi's batched endpoint hard-caps at 20 orders per request.
    maxBasketSize: Math.min(num('MAX_BASKET_SIZE', 20), 20),
  },

  databaseUrl: optional('DATABASE_URL', ''),

  get isLive(): boolean {
    return KALSHI_ENV === 'prod';
  },

  get kalshiConfigured(): boolean {
    return (
      !!process.env.KALSHI_API_KEY_ID?.trim() && !!process.env.KALSHI_PRIVATE_KEY?.trim()
    );
  },
} as const;

export type Config = typeof config;

import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { kalshi } from '../kalshi/client.js';
import { dbEnabled } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance) {
  // Friendly root so hitting the bare URL isn't a bare 404. No auth.
  app.get('/', async () => ({
    service: 'mlb-striker-api',
    ok: true,
    env: kalshi.env,
    endpoints: ['/health', '/health/kalshi', '/mlb/games', '/portfolio/balance', '/basket/strike'],
    note: 'API only — the mobile app talks to these endpoints with a bearer token.',
  }));

  // Liveness — no auth, no external calls. Safe for Railway health checks.
  app.get('/health', async () => ({
    ok: true,
    env: kalshi.env,
    dbEnabled,
    kalshiConfigured: config.kalshiConfigured,
  }));

  // Readiness — verifies Kalshi credentials actually work (requires auth).
  app.get('/health/kalshi', async (_req, reply) => {
    if (!config.kalshiConfigured) {
      reply.code(503);
      return { ok: false, error: 'kalshi_not_configured' };
    }
    try {
      const status = await kalshi.exchangeStatus();
      return { ok: true, env: kalshi.env, exchange: status };
    } catch (err) {
      reply.code(502);
      return { ok: false, error: (err as Error).message };
    }
  });
}

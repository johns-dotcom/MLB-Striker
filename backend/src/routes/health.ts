import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { kalshi } from '../kalshi/client.js';
import { dbEnabled } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance) {
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

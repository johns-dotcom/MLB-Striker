import type { FastifyInstance } from 'fastify';
import { kalshi } from '../kalshi/client.js';
import { dbEnabled } from '../db/pool.js';

export async function healthRoutes(app: FastifyInstance) {
  // Liveness — no auth, no external calls.
  app.get('/health', async () => ({ ok: true, env: kalshi.env, dbEnabled }));

  // Readiness — verifies Kalshi credentials actually work (requires auth).
  app.get('/health/kalshi', async (_req, reply) => {
    try {
      const status = await kalshi.exchangeStatus();
      return { ok: true, env: kalshi.env, exchange: status };
    } catch (err) {
      reply.code(502);
      return { ok: false, error: (err as Error).message };
    }
  });
}

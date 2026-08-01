import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { requireAuth } from './auth.js';
import { healthRoutes } from './routes/health.js';
import { sessionRoutes } from './routes/session.js';
import { marketsRoutes } from './routes/markets.js';
import { ordersRoutes } from './routes/orders.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { debugRoutes } from './routes/debug.js';

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Never log Kalshi auth headers or the bearer token.
      redact: ['req.headers.authorization', 'req.headers["kalshi-access-signature"]'],
    },
  });

  await app.register(cors, {
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  });

  // Public endpoints (no bearer): liveness + login.
  await app.register(healthRoutes);
  await app.register(sessionRoutes);

  // Everything below requires the bearer token.
  await app.register(async (authed) => {
    authed.addHook('onRequest', requireAuth);
    await authed.register(marketsRoutes);
    await authed.register(portfolioRoutes);
    await authed.register(ordersRoutes);
    await authed.register(debugRoutes);
    // Re-expose the auth'd Kalshi readiness check.
    authed.get('/ready', async () => ({ ok: true, env: config.kalshi.env }));
  });

  const banner =
    config.kalshi.env === 'prod'
      ? '🔴 LIVE (prod) — real money'
      : '🟢 demo — sandbox money';
  app.log.info(`MLB Striker backend starting | Kalshi env: ${banner}`);

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

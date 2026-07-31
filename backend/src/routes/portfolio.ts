import type { FastifyInstance } from 'fastify';
import { kalshi } from '../kalshi/client.js';
import { handleKalshiError } from './markets.js';
import { recentBaskets } from '../db/baskets.js';
import { dbEnabled } from '../db/pool.js';

export async function portfolioRoutes(app: FastifyInstance) {
  app.get('/portfolio/balance', async (_req, reply) => {
    try {
      const balance = await kalshi.getBalance();
      return { env: kalshi.env, balanceCents: balance.balance };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  app.get('/portfolio/positions', async (_req, reply) => {
    try {
      const { market_positions } = await kalshi.getPositions();
      return { env: kalshi.env, positions: market_positions };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // Our own history of struck baskets (empty when DB is off).
  app.get('/history/baskets', async () => {
    return { dbEnabled, baskets: await recentBaskets() };
  });
}

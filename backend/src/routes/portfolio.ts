import type { FastifyInstance } from 'fastify';
import { kalshi } from '../kalshi/client.js';
import { handleKalshiError } from './markets.js';
import { recentBaskets } from '../db/baskets.js';
import { dbEnabled } from '../db/pool.js';
import type { KalshiOrder } from '../kalshi/types.js';

function toCents(dollars?: string): number | null {
  if (dollars == null) return null;
  const n = Number(dollars);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function toCount(fp?: string): number | null {
  if (fp == null) return null;
  const n = Number(fp);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Map a Kalshi order to the app's shape (price in cents for the chosen side).
function mapOrder(o: KalshiOrder) {
  const side = o.outcome_side ?? (o.book_side === 'ask' ? 'no' : 'yes');
  const priceCents = toCents(side === 'yes' ? o.yes_price_dollars : o.no_price_dollars);
  return {
    orderId: o.order_id,
    ticker: o.ticker,
    side,
    priceCents,
    remaining: toCount(o.remaining_count_fp),
    initial: toCount(o.initial_count_fp),
    status: o.status,
    createdTime: o.created_time,
  };
}

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

  // Resting (open) orders — the Orders page. status: resting | canceled | executed.
  app.get('/orders', async (req, reply) => {
    try {
      const status = ((req.query as { status?: string }).status || 'resting') as string;
      const { orders } = await kalshi.getOrders(status);
      return { env: kalshi.env, orders: (orders ?? []).map(mapOrder) };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // Cancel a resting order by id.
  app.delete('/orders/:orderId', async (req, reply) => {
    try {
      const { orderId } = req.params as { orderId: string };
      const res = await kalshi.cancelOrder(orderId);
      return { ok: true, orderId: res.order_id ?? orderId, reducedBy: res.reduced_by };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // Our own history of struck baskets (empty when DB is off).
  app.get('/history/baskets', async () => {
    return { dbEnabled, baskets: await recentBaskets() };
  });
}

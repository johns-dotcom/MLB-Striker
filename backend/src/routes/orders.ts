import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { kalshi, KalshiError } from '../kalshi/client.js';
import { handleKalshiError } from './markets.js';
import { logBasket, type LoggedOrderOutcome } from '../db/baskets.js';
import type { KalshiOrderRequest } from '../kalshi/types.js';

// One leg of a basket. v1 supports limit orders only — explicit prices keep the
// safety cap meaningful and avoid surprise fills on thin MLB books.
const legSchema = z
  .object({
    ticker: z.string().min(1),
    action: z.enum(['buy', 'sell']),
    side: z.enum(['yes', 'no']),
    // Absolute ceiling; the real limiter is the per-leg notional cap below.
    count: z.number().int().positive().max(1_000_000),
    // Limit price in cents (1–99) for the chosen side.
    price: z.number().int().min(1).max(99),
    clientOrderId: z.string().min(1).max(64).optional(),
  })
  .strict();

const basketSchema = z
  .object({
    legs: z.array(legSchema).min(1).max(config.limits.maxBasketSize),
    note: z.string().max(500).optional(),
    // Client must echo the target env — guards against an app pointed at the
    // wrong backend firing live orders it thought were demo.
    expectEnv: z.enum(['demo', 'prod']).optional(),
  })
  .strict();

/** Max capital at risk for one leg, in cents. Buy: stake. Sell: 100−price per contract. */
function legRiskCents(leg: z.infer<typeof legSchema>): number {
  const perContract = leg.action === 'buy' ? leg.price : 100 - leg.price;
  return perContract * leg.count;
}

export async function ordersRoutes(app: FastifyInstance) {
  app.post('/basket/strike', async (req, reply) => {
    const parsed = basketSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: 'invalid_basket', detail: parsed.error.flatten() };
    }
    const basket = parsed.data;

    // Guard: env mismatch between app and backend.
    if (basket.expectEnv && basket.expectEnv !== kalshi.env) {
      reply.code(409);
      return {
        error: 'env_mismatch',
        message: `App expected "${basket.expectEnv}" but backend is "${kalshi.env}".`,
      };
    }

    // Safety caps, evaluated before anything is sent to Kalshi.
    const capCents = config.limits.maxOrderNotionalUsd * 100;
    for (const leg of basket.legs) {
      const risk = legRiskCents(leg);
      if (risk > capCents) {
        reply.code(422);
        return {
          error: 'order_exceeds_cap',
          message: `Leg ${leg.ticker} risks $${(risk / 100).toFixed(2)}, over the $${config.limits.maxOrderNotionalUsd} cap.`,
          ticker: leg.ticker,
        };
      }
    }

    const totalRiskCents = basket.legs.reduce((sum, l) => sum + legRiskCents(l), 0);

    // Map to Kalshi order requests.
    const orders: KalshiOrderRequest[] = basket.legs.map((leg) => ({
      ticker: leg.ticker,
      client_order_id: leg.clientOrderId ?? crypto.randomUUID(),
      action: leg.action,
      side: leg.side,
      count: leg.count,
      type: 'limit',
      ...(leg.side === 'yes' ? { yes_price: leg.price } : { no_price: leg.price }),
    }));

    try {
      // Place each order individually via the v2 endpoint. Everything is quoted
      // from the YES side: buy YES → bid; buy NO → ask at (1 − price).
      const outcomes: LoggedOrderOutcome[] = [];
      for (const order of orders) {
        const priceCents = order.side === 'yes' ? order.yes_price! : order.no_price!;
        const yesCents = order.side === 'yes' ? priceCents : 100 - priceCents;
        const v2Order = {
          ticker: order.ticker,
          side: order.side === 'yes' ? ('bid' as const) : ('ask' as const),
          count: order.count.toFixed(2),
          price: (yesCents / 100).toFixed(2),
          time_in_force: 'good_till_canceled' as const,
          self_trade_prevention_type: 'taker_at_cross' as const,
          client_order_id: order.client_order_id,
        };
        try {
          const res = await kalshi.placeOrder(v2Order);
          outcomes.push({ order, kalshiOrderId: res.order_id, status: 'accepted' });
        } catch (e) {
          if (e instanceof KalshiError) {
            const detail =
              typeof e.body === 'object' ? JSON.stringify(e.body) : String(e.body ?? '');
            req.log.warn({ ticker: order.ticker, status: e.status, detail }, 'order rejected');
            outcomes.push({ order, status: 'rejected', error: `HTTP ${e.status}: ${detail}` });
          } else {
            outcomes.push({ order, status: 'rejected', error: (e as Error).message });
          }
        }
      }

      const acceptedCount = outcomes.filter((o) => o.status === 'accepted').length;
      const status =
        acceptedCount === orders.length
          ? 'submitted'
          : acceptedCount === 0
            ? 'failed'
            : 'partial';

      const basketId = await logBasket({
        env: kalshi.env,
        status,
        notionalUsd: totalRiskCents / 100,
        note: basket.note,
        outcomes,
      });

      // Always 200 — the basket was processed; per-order `status` conveys the
      // outcome so the app can render each order's result (incl. rejection text).
      return {
        env: kalshi.env,
        basketId,
        status,
        acceptedCount,
        totalCount: orders.length,
        totalRiskUsd: Number((totalRiskCents / 100).toFixed(2)),
        results: outcomes.map((o) => ({
          ticker: o.order.ticker,
          clientOrderId: o.order.client_order_id,
          status: o.status,
          kalshiOrderId: o.kalshiOrderId,
          error: o.error,
        })),
      };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });
}

import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config.js';
import { kalshi } from '../kalshi/client.js';
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
    count: z.number().int().positive().max(10_000),
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
      const res = await kalshi.placeBatchOrders(orders);

      const outcomes: LoggedOrderOutcome[] = orders.map((order, i) => {
        const r = res.orders?.[i];
        const accepted = !!r?.order && !r?.error;
        return {
          order,
          kalshiOrderId: r?.order?.order_id,
          status: accepted ? 'accepted' : 'rejected',
          error: r?.error ? `${r.error.code}: ${r.error.message}` : undefined,
        };
      });

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

      reply.code(status === 'failed' ? 502 : 200);
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

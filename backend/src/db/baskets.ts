import { dbEnabled, query } from './pool.js';
import type { KalshiOrderRequest } from '../kalshi/types.js';

export interface LoggedOrderOutcome {
  order: KalshiOrderRequest;
  kalshiOrderId?: string;
  status: 'accepted' | 'rejected';
  error?: string;
}

/**
 * Persist a struck basket and its per-order outcomes. No-op (returns null) when
 * the database isn't configured, so the trading path never depends on the DB.
 */
export async function logBasket(input: {
  env: string;
  status: 'submitted' | 'partial' | 'failed';
  notionalUsd: number;
  note?: string;
  outcomes: LoggedOrderOutcome[];
}): Promise<string | null> {
  if (!dbEnabled) return null;

  const basket = await query<{ id: string }>(
    `INSERT INTO baskets (kalshi_env, order_count, status, notional_usd, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [input.env, input.outcomes.length, input.status, input.notionalUsd, input.note ?? null],
  );
  const basketId = basket.rows[0].id;

  for (const o of input.outcomes) {
    const priceCents = o.order.side === 'yes' ? o.order.yes_price : o.order.no_price;
    await query(
      `INSERT INTO basket_orders
         (basket_id, client_order_id, ticker, action, side, order_type, count,
          price_cents, kalshi_order_id, status, error)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        basketId,
        o.order.client_order_id,
        o.order.ticker,
        o.order.action,
        o.order.side,
        o.order.type,
        o.order.count,
        priceCents ?? null,
        o.kalshiOrderId ?? null,
        o.status,
        o.error ?? null,
      ],
    );
  }
  return basketId;
}

export async function recentBaskets(limit = 25) {
  if (!dbEnabled) return [];
  const res = await query(
    `SELECT id, created_at, kalshi_env, order_count, status, notional_usd, note
     FROM baskets ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return res.rows;
}

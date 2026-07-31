import type { FastifyInstance, FastifyReply } from 'fastify';
import { kalshi, KalshiError } from '../kalshi/client.js';

export async function marketsRoutes(app: FastifyInstance) {
  // MLB game events (each event ≈ one game), with their markets attached.
  app.get('/mlb/games', async (_req, reply) => {
    try {
      const { events } = await kalshi.getMlbEvents({ status: 'open' });

      // Fetch markets per event so the app can render "Team A vs Team B" cards.
      const games = await Promise.all(
        events.map(async (ev) => {
          const { markets } = await kalshi.getMarkets({ eventTicker: ev.event_ticker });
          return {
            eventTicker: ev.event_ticker,
            title: ev.title,
            subtitle: ev.sub_title,
            markets: markets
              .filter((m) => m.status === 'active')
              .map((m) => ({
                ticker: m.ticker,
                title: m.title,
                yesSubTitle: m.yes_sub_title,
                noSubTitle: m.no_sub_title,
                yesBid: m.yes_bid,
                yesAsk: m.yes_ask,
                noBid: m.no_bid,
                noAsk: m.no_ask,
                lastPrice: m.last_price,
                closeTime: m.close_time,
                volume: m.volume,
              })),
          };
        }),
      );

      return { env: kalshi.env, games };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  app.get('/markets/:ticker', async (req, reply) => {
    try {
      const { ticker } = req.params as { ticker: string };
      const { market } = await kalshi.getMarket(ticker);
      return { market };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });
}

export function handleKalshiError(err: unknown, reply: FastifyReply) {
  if (err instanceof KalshiError) {
    reply.code(err.status >= 400 && err.status < 600 ? err.status : 502);
    return { error: 'kalshi_error', status: err.status, detail: err.body };
  }
  reply.code(500);
  return { error: 'internal_error', message: (err as Error).message };
}

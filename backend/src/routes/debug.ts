import type { FastifyInstance } from 'fastify';
import { kalshi } from '../kalshi/client.js';
import { handleKalshiError } from './markets.js';

/**
 * Temporary read-only inspection endpoints for discovering how Kalshi structures
 * MLB markets. Auth-gated. Safe to remove once the games aggregation is built.
 */
export async function debugRoutes(app: FastifyInstance) {
  // List series in a category, optionally filtered by a substring of ticker/title.
  app.get('/debug/series', async (req, reply) => {
    try {
      const { category, q } = req.query as { category?: string; q?: string };
      const { series } = await kalshi.getSeriesList({ category: category ?? 'Sports' });
      let list = series.map((s) => ({ ticker: s.ticker, title: s.title, tags: s.tags }));
      if (q) {
        const needle = q.toLowerCase();
        list = list.filter((s) => `${s.ticker} ${s.title ?? ''}`.toLowerCase().includes(needle));
      }
      return { count: list.length, series: list };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // Inspect one event and its nested markets (to see per-bet-type market shape).
  app.get('/debug/event/:ticker', async (req, reply) => {
    try {
      const { ticker } = req.params as { ticker: string };
      return await kalshi.getEvent(ticker);
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // Events for a given series (to see how bet-type series name their per-game events).
  app.get('/debug/events', async (req, reply) => {
    try {
      const { series_ticker } = req.query as { series_ticker?: string };
      if (!series_ticker) {
        reply.code(400);
        return { error: 'series_ticker query param required' };
      }
      const { events } = await kalshi.getEventsBySeries(series_ticker, { limit: 30 });
      return {
        count: events.length,
        events: events.map((e) => ({ event_ticker: e.event_ticker, title: e.title, sub_title: e.sub_title })),
      };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });
}

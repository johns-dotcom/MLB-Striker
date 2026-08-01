import type { FastifyInstance, FastifyReply } from 'fastify';
import { kalshi, KalshiError, KalshiNotConfigured } from '../kalshi/client.js';
import type { KalshiMarket } from '../kalshi/types.js';
import { SPORTS, SPORT_ORDER } from '../sports.js';

function mapMarket(m: KalshiMarket) {
  return {
    ticker: m.ticker,
    title: m.title,
    yesSubTitle: m.yes_sub_title,
    noSubTitle: m.no_sub_title,
    yesBid: m.yes_bid,
    yesAsk: m.yes_ask,
    noBid: m.no_bid,
    noAsk: m.no_ask,
    lastPrice: m.last_price,
    volume: m.volume,
    closeTime: m.close_time,
  };
}

// A game's code is the event ticker minus the "<SERIES>-" prefix.
function gameCodeFromEventTicker(eventTicker: string): string {
  const dash = eventTicker.indexOf('-');
  return dash >= 0 ? eventTicker.slice(dash + 1) : eventTicker;
}

// Run async fn over items with bounded concurrency (keeps us under Kalshi's
// rate limit when a game fans out to ~22 bet-type series).
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = { status: 'fulfilled', value: await fn(items[idx]) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function marketsRoutes(app: FastifyInstance) {
  // Available sports (for the browse-page tabs).
  app.get('/sports', async () => ({
    sports: SPORT_ORDER.map((k) => ({ key: SPORTS[k].key, label: SPORTS[k].label })),
  }));

  // Game list for a sport — one nested call to its winner series.
  app.get('/sports/:sport/games', async (req, reply) => {
    const sport = SPORTS[(req.params as { sport: string }).sport];
    if (!sport) {
      reply.code(404);
      return { error: 'unknown_sport' };
    }
    try {
      const { events } = await kalshi.getEventsBySeries(sport.gameSeries, {
        status: 'open',
        limit: 60,
        withNestedMarkets: true,
      });
      const games = events.map((ev) => ({
        eventTicker: ev.event_ticker,
        gameCode: gameCodeFromEventTicker(ev.event_ticker),
        title: ev.title,
        subtitle: ev.sub_title,
        markets: (ev.markets ?? []).filter((m) => m.status === 'active').map(mapMarket),
      }));
      return { sport: sport.key, env: kalshi.env, games };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // All bet types for one game, grouped into categories.
  app.get('/sports/:sport/games/:gameCode', async (req, reply) => {
    const { sport: sportKey, gameCode } = req.params as { sport: string; gameCode: string };
    const sport = SPORTS[sportKey];
    if (!sport) {
      reply.code(404);
      return { error: 'unknown_sport' };
    }
    try {
      const settled = await mapLimit(sport.bets, 6, async (bet) => {
        const { event, markets } = await kalshi.getEvent(`${bet.prefix}-${gameCode}`);
        return { bet, event, markets };
      });

      let title: string | undefined;
      const categories = [];
      for (const r of settled) {
        if (r.status !== 'fulfilled') continue; // series without this game (404) skipped
        const { bet, event, markets } = r.value;
        title = title ?? event?.title;
        const active = markets.filter((m) => m.status === 'active').map(mapMarket);
        if (active.length) categories.push({ key: bet.key, label: bet.label, markets: active });
      }

      if (categories.length === 0) {
        reply.code(404);
        return { error: 'no_markets_for_game', gameCode };
      }
      return { sport: sport.key, env: kalshi.env, gameCode, title, categories };
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
  if (err instanceof KalshiNotConfigured) {
    reply.code(503);
    return { error: 'kalshi_not_configured', message: err.message };
  }
  if (err instanceof KalshiError) {
    reply.code(err.status >= 400 && err.status < 600 ? err.status : 502);
    return { error: 'kalshi_error', status: err.status, detail: err.body };
  }
  reply.code(500);
  return { error: 'internal_error', message: (err as Error).message };
}

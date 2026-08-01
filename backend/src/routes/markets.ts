import type { FastifyInstance, FastifyReply } from 'fastify';
import { kalshi, KalshiError, KalshiNotConfigured } from '../kalshi/client.js';
import type { KalshiMarket } from '../kalshi/types.js';

const GAME_SERIES = 'KXMLBGAME';

// Per-game bet-type series, in display order. Each game's events across these
// series share the same code suffix (e.g. "26AUG011507STLTOR").
const BET_SERIES: { key: string; label: string; prefix: string }[] = [
  { key: 'winner', label: 'Game Winner', prefix: 'KXMLBGAME' },
  { key: 'spread', label: 'Run Line (Spread)', prefix: 'KXMLBSPREAD' },
  { key: 'total', label: 'Total Runs (Over/Under)', prefix: 'KXMLBTOTAL' },
  { key: 'teamtotal', label: 'Team Total Runs', prefix: 'KXMLBTEAMTOTAL' },
  { key: 'rfi', label: 'Run in 1st Inning (YRFI / NRFI)', prefix: 'KXMLBRFI' },
  { key: 'f3', label: 'First 3 Innings — Winner', prefix: 'KXMLBF3' },
  { key: 'f5', label: 'First 5 Innings — Winner', prefix: 'KXMLBF5' },
  { key: 'f5spread', label: 'First 5 Innings — Spread', prefix: 'KXMLBF5SPREAD' },
  { key: 'f5total', label: 'First 5 Innings — Total', prefix: 'KXMLBF5TOTAL' },
  { key: 'f7', label: 'First 7 Innings — Winner', prefix: 'KXMLBF7' },
  { key: 'extras', label: 'Extra Innings', prefix: 'KXMLBEXTRAS' },
];

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

export async function marketsRoutes(app: FastifyInstance) {
  // Game list — one nested call to the winner series. Each game carries its
  // winner markets for a quick moneyline preview; full bets load on demand.
  app.get('/mlb/games', async (_req, reply) => {
    try {
      const { events } = await kalshi.getEventsBySeries(GAME_SERIES, {
        status: 'open',
        limit: 60,
        withNestedMarkets: true,
      });

      const games = events.map((ev) => ({
        eventTicker: ev.event_ticker,
        gameCode: gameCodeFromEventTicker(ev.event_ticker),
        title: ev.title,
        subtitle: ev.sub_title,
        markets: (ev.markets ?? [])
          .filter((m) => m.status === 'active')
          .map(mapMarket),
      }));

      return { env: kalshi.env, games };
    } catch (err) {
      return handleKalshiError(err, reply);
    }
  });

  // All bet types for one game, grouped into categories. Fans out one call per
  // bet-type series; series without this game (404) are skipped.
  app.get('/mlb/game/:gameCode', async (req, reply) => {
    try {
      const { gameCode } = req.params as { gameCode: string };

      const settled = await Promise.allSettled(
        BET_SERIES.map(async (b) => {
          const { event, markets } = await kalshi.getEvent(`${b.prefix}-${gameCode}`);
          return { bet: b, event, markets };
        }),
      );

      let title: string | undefined;
      const categories = [];
      for (const r of settled) {
        if (r.status !== 'fulfilled') continue; // 404 / not offered for this game
        const { bet, event, markets } = r.value;
        title = title ?? event?.title;
        const active = markets.filter((m) => m.status === 'active').map(mapMarket);
        if (active.length) categories.push({ key: bet.key, label: bet.label, markets: active });
      }

      if (categories.length === 0) {
        reply.code(404);
        return { error: 'no_markets_for_game', gameCode };
      }
      return { env: kalshi.env, gameCode, title, categories };
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

export interface Market {
  ticker: string;
  title: string;
  yesSubTitle?: string;
  noSubTitle?: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  lastPrice?: number;
  closeTime?: string;
  volume?: number;
}

export interface Game {
  eventTicker: string;
  gameCode: string;
  title: string;
  subtitle?: string;
  markets: Market[];
}

export interface BetCategory {
  key: string;
  label: string;
  markets: Market[];
}

export interface GameDetail {
  env: string;
  gameCode: string;
  title?: string;
  categories: BetCategory[];
}

export type Side = 'yes' | 'no';
export type Action = 'buy' | 'sell';

/** A leg the user has added to the basket. */
export interface BasketLeg {
  id: string; // local uuid
  ticker: string;
  label: string; // human summary, e.g. "Yankees to win — YES"
  action: Action;
  side: Side;
  count: number;
  price: number; // cents, 1–99
}

export interface StrikeResult {
  env: string;
  basketId: string | null;
  status: 'submitted' | 'partial' | 'failed';
  acceptedCount: number;
  totalCount: number;
  totalRiskUsd: number;
  results: {
    ticker: string;
    clientOrderId: string;
    status: 'accepted' | 'rejected';
    kalshiOrderId?: string;
    error?: string;
  }[];
}

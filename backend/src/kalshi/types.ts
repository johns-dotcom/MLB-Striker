// Subset of Kalshi v2 API shapes we use. Prices are in integer cents (1–99).

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  market_type: string;
  title: string;
  subtitle?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
  status: string; // "active" | "closed" | "settled" | ...
  open_time?: string;
  close_time?: string;
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  volume?: number;
  liquidity?: number;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title?: string;
  category?: string;
  // Present when the event is fetched with_nested_markets=true.
  markets?: KalshiMarket[];
}

export interface KalshiBalance {
  balance: number; // cents
}

export interface KalshiPosition {
  ticker: string;
  position: number; // signed contract count
  market_exposure: number;
  realized_pnl: number;
  total_traded: number;
}

export type OrderSide = 'yes' | 'no';
export type OrderAction = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';

/** A single order as sent to Kalshi's batched endpoint. */
export interface KalshiOrderRequest {
  ticker: string;
  client_order_id: string;
  action: OrderAction;
  side: OrderSide;
  count: number;
  type: OrderType;
  // Limit orders: price in cents for the chosen side.
  yes_price?: number;
  no_price?: number;
  // Market buys: optional max spend cap in cents.
  buy_max_cost?: number;
}

export interface KalshiOrderResult {
  order?: {
    order_id: string;
    client_order_id: string;
    status: string;
    ticker: string;
  };
  error?: { code: string; message: string };
}

export interface KalshiBatchOrderResponse {
  orders: KalshiOrderResult[];
}

// v2 create-order endpoint (POST /portfolio/events/orders). All prices are the
// YES price in dollars; counts/prices are fixed-point strings.
export interface V2OrderRequest {
  ticker: string;
  side: 'bid' | 'ask'; // bid = buy YES, ask = sell YES (≡ buy NO)
  count: string; // e.g. "10.00"
  price: string; // YES price in dollars, e.g. "0.5600"
  time_in_force: 'good_till_canceled' | 'fill_or_kill' | 'immediate_or_cancel';
  self_trade_prevention_type: 'taker_at_cross' | 'maker';
  client_order_id?: string;
}

export interface V2OrderResponse {
  order_id?: string;
  client_order_id?: string;
  fill_count?: string;
  remaining_count?: string;
  average_fill_price?: string;
}

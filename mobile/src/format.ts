/** Kalshi prices are integer cents (1–99). Helpers to display them as money/%. */

export function centsToUsd(cents?: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

/** A yes-price of 63¢ implies a 63% chance. */
export function priceToPct(cents?: number | null): string {
  if (cents == null) return '—';
  return `${cents}%`;
}

export function usd(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

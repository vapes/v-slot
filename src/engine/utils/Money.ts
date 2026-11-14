import type { SlotConfig } from '../config/SlotConfig';

/** Format integer minor units: 100000 → "1 000.00 PLN" (decimals 2) or "10 000" (decimals 0). */
export function formatMoney(cfg: SlotConfig, minor: number, withCode = true): string {
  const { code, decimals } = cfg.currency;
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const div = 10 ** decimals;
  const whole = Math.floor(abs / div).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = decimals > 0 ? '.' + (abs % div).toString().padStart(decimals, '0') : '';
  return `${sign}${whole}${frac}${withCode && code ? ` ${code}` : ''}`;
}

export function assetUrl(gameId: string, path: string): string {
  return `${import.meta.env.BASE_URL}games/${gameId}/${path}`;
}

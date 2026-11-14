import { CURRENCY } from '../core/Config';

/** Format integer cents as "1 000.00 PLN". */
export function formatMoney(cents: number, withCurrency = true): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const frac = (abs % 100).toString().padStart(2, '0');
  return `${sign}${whole}.${frac}${withCurrency ? ` ${CURRENCY}` : ''}`;
}

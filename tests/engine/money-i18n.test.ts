import { describe, expect, it } from 'vitest';
import { formatMoney } from '../../src/engine/utils/Money';
import { I18n } from '../../src/engine/i18n/I18n';
import { testConfig } from '../helpers';

describe('formatMoney', () => {
  it('formats minor units with a code', () => {
    expect(formatMoney(testConfig({ currency: { code: 'PLN', decimals: 2 } }), 123456789)).toBe('1 234 567.89 PLN');
  });
  it('formats with a currency symbol and thousands separator', () => {
    expect(formatMoney(testConfig({ currency: { code: 'USD', decimals: 2, symbol: '$', thousands: ',' } }), 542050)).toBe('$5,420.50');
  });
  it('handles zero decimals, negatives and hiding the code', () => {
    const cfg = testConfig({ currency: { code: 'CR', decimals: 0 } });
    expect(formatMoney(cfg, -10000)).toBe('-10 000 CR');
    expect(formatMoney(cfg, 5, false)).toBe('5');
  });
});

describe('I18n.t', () => {
  it('falls back to engine strings and interpolates params', () => {
    const i18n = new I18n();
    expect(i18n.t('status.idle')).toBe('Place your bets');
    expect(i18n.t('hud.win', { amount: '5.00' })).toBe('WIN 5.00');
    expect(i18n.t('unknown.key', {}, 'Fallback {x}')).toBe('Fallback {x}');
    expect(i18n.t('totally.unknown')).toBe('totally.unknown');
  });
});

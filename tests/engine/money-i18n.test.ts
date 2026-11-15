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

  it('picks plural forms for a numeric n', () => {
    const i18n = new I18n();
    expect(i18n.t('feature.won', { n: 1 })).toBe('YOU WON 1 RESPIN');
    expect(i18n.t('feature.won', { n: 5 })).toBe('YOU WON 5 RESPINS');
    const ru = i18n as unknown as { lang: string; dict: Record<string, string> };
    ru.lang = 'ru';
    ru.dict = { 'feature.won.one': '{n} РЕСПИН', 'feature.won.few': '{n} РЕСПИНА', 'feature.won.many': '{n} РЕСПИНОВ' };
    expect(i18n.t('feature.won', { n: 1 })).toBe('1 РЕСПИН');
    expect(i18n.t('feature.won', { n: 3 })).toBe('3 РЕСПИНА');
    expect(i18n.t('feature.won', { n: 5 })).toBe('5 РЕСПИНОВ');
    expect(i18n.t('feature.won', { n: 21 })).toBe('21 РЕСПИН');
  });
});

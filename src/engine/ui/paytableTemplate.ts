import type { SlotConfig } from '../config/SlotConfig';
import { linePayout, lineBetOf } from '../math/Paytable';
import { assetUrl, formatMoney } from '../utils/Money';
import { t } from '../i18n/I18n';

/**
 * Fills a paytable HTML template from the content CDN. Placeholders:
 *
 *   {{title}}            game title (i18n `game.title`, else config.title)
 *   {{rtp}}              "96.20%"            {{lines}}     number of paylines
 *   {{bet}} {{lineBet}}  current total / line bet as money
 *   {{pay:ID:N}}         money paid for N × symbol ID at the current bet
 *   {{mult:ID:N}}        "×50" multiplier of the line bet
 *   {{symbol:ID}}        translated symbol name (i18n `symbol.ID`)
 *   {{asset:PATH}}       absolute URL of public/games/<id>/PATH
 *   {{t:KEY}}            any translation
 *   {{paylines}}         generated payline diagrams (HTML, style .pl-* classes)
 *   {{buyCost}}          feature-buy price at the current bet (config.buyFeature)
 *
 * Text values are HTML-escaped; unknown placeholders are left visible so
 * template authors notice them.
 */
export function renderPaytable(template: string, cfg: SlotConfig, totalBet: number, baseHref: string): string {
  const lineBet = lineBetOf(cfg, totalBet);
  const money = (v: number) => formatMoney(cfg, v);

  const html = template.replace(/\{\{\s*([\w.-]+)(?::([^}:]+))?(?::([^}]+))?\s*\}\}/g, (m, name: string, a?: string, b?: string) => {
    switch (name) {
      case 'title': return esc(t('game.title', {}, cfg.title));
      case 'rtp': return `${(cfg.rtp * 100).toFixed(2)}%`;
      case 'lines': return String(cfg.paylines.length);
      case 'bet': return esc(money(totalBet));
      case 'lineBet': return esc(money(lineBet));
      case 'pay': return a && b ? esc(money(linePayout(cfg, a, Number(b)) * lineBet)) : m;
      case 'mult': return a && b ? `×${linePayout(cfg, a, Number(b))}` : m;
      case 'symbol': return a ? esc(t(`symbol.${a}`, {}, cfg.symbolName(a))) : m;
      case 'asset': return a ? esc(new URL(assetUrl(cfg.id, a), window.location.href).href) : m;
      case 't': return a ? esc(t(a)) : m;
      case 'paylines': return paylinesHtml(cfg);
      case 'buyCost': return cfg.buyFeature ? esc(money(Math.round(totalBet * cfg.buyFeature.cost))) : m;
      default: return m;
    }
  });

  // Relative URLs in the template resolve against its CDN folder.
  const base = `<base href="${esc(baseHref)}">`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + base) : base + html;
}

function paylinesHtml(cfg: SlotConfig): string {
  const { cols, rows } = cfg.grid;
  const items = cfg.paylines.map((line, i) => {
    const cells: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cells.push(line[c] === r ? '<i class="on"></i>' : '<i></i>');
    }
    return `<div class="pl"><span class="pl-n">${i + 1}</span>`
      + `<div class="pl-cells" style="grid-template-columns:repeat(${cols},1fr)">${cells.join('')}</div></div>`;
  });
  return `<div class="pl-grid">${items.join('')}</div>`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

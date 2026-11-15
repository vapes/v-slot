import { Text, TextStyle } from 'pixi.js';
import { vGradient, formatMoney } from '@/engine';
import { config, JACKPOT, uiAnchor } from '../config';

/**
 * Decorative progressive-jackpot meter (not part of the math). The amount is
 * redrawn every `skin.jackpot.refreshMs` and only when its text changes:
 * each Text change re-rasterises the string and uploads a texture, which is
 * too costly to do 60× a second on phones.
 */
export class JackpotTicker {
  readonly text: Text;
  private value = JACKPOT.start;
  private sinceRefresh = 0;

  constructor() {
    this.text = new Text({ text: '', style: new TextStyle({
      fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fill: vGradient(['#FFF4C2', '#FFD54A', '#E79A16']),
      stroke: { color: 0x3A2200, width: 3 },
    }) });
    const a = uiAnchor('jackpot');
    this.text.anchor.set(0.5);
    this.text.position.set(a.x, a.y);
    this.render();
  }

  update(dt: number): void {
    this.value += (JACKPOT.perSecond * dt) / 60;
    this.sinceRefresh += dt * (1000 / 60);
    if (this.sinceRefresh < JACKPOT.refreshMs) return;
    this.sinceRefresh = 0;
    this.render();
  }

  private render(): void {
    const next = formatMoney(config, Math.floor(this.value));
    if (next !== this.text.text) this.text.text = next;
  }
}

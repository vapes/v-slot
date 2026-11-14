import { Text, TextStyle } from 'pixi.js';
import { formatMoney } from '@/engine';
import { config, JACKPOT, uiAnchor } from '../config';

/** Decorative progressive-jackpot meter (not part of the math). */
export class JackpotTicker {
  readonly text: Text;
  private value = JACKPOT.start;

  constructor() {
    this.text = new Text('', new TextStyle({
      fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
      fontSize: 34,
      fontWeight: 'bold',
      fill: ['#FFF4C2', '#FFD54A', '#E79A16'],
      stroke: 0x3A2200,
      strokeThickness: 3,
    }));
    const a = uiAnchor('jackpot');
    this.text.anchor.set(0.5);
    this.text.position.set(a.x, a.y);
    this.render();
  }

  update(dt: number): void {
    this.value += (JACKPOT.perSecond * dt) / 60;
    this.render();
  }

  private render(): void {
    this.text.text = formatMoney(config, Math.floor(this.value));
  }
}

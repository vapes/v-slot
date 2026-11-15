import { Container, Text, TextStyle } from 'pixi.js';
import { vGradient, shadow } from './textStyle';
import { fitText } from './fitText';
import { t } from '../i18n/I18n';
import type { WinCategory } from './WinCelebration';
import { WIN_TIERS } from './winTicks';

const FONT = 'Arial Black, Arial, sans-serif';
const TIER = new TextStyle({
  fontFamily: FONT, fontSize: 64, fontWeight: 'bold',
  fill: vGradient(['#FFF8D0', '#FFD34A', '#FF8A00', '#C2410C'], [0, 0.4, 0.75, 1]),
  stroke: { color: 0x3A0A00, width: 8 }, dropShadow: shadow(4, 0.85, 8), align: 'center',
});
const WIN = new TextStyle({
  fontFamily: FONT, fontSize: 40, fontWeight: 'bold',
  fill: vGradient(['#FFFFFF', '#FFE08A']),
  stroke: { color: 0x3A0A00, width: 6 }, dropShadow: shadow(3, 0.8, 6), align: 'center',
});

/** Pop length of a new title, frames. */
const POP = 22;

/**
 * "BIG / HUGE / EPIC / MAX" + "WIN" over the win box while it rides on the
 * reels. Every tier word is its own pre-rendered Text (switching = visibility,
 * no re-raster); a new tier pops in with an elastic scale.
 */
export class WinTitle {
  readonly container = new Container();
  private tiers = new Map<WinCategory, Text>();
  /** fitText scale of every tier word (the pop multiplies it). */
  private bases = new Map<Text, number>();
  private win: Text;
  private pop = POP;
  private current: Text | null = null;

  constructor(maxWidth: number) {
    for (const tier of WIN_TIERS) {
      const text = fitText(new Text({ text: t(`celebration.${tier}`), style: TIER }), maxWidth);
      text.anchor.set(0.5);
      text.visible = false;
      this.tiers.set(tier, text);
      this.bases.set(text, text.scale.x);
      this.container.addChild(text);
    }
    this.win = fitText(new Text({ text: t('celebration.win'), style: WIN }), maxWidth);
    this.win.anchor.set(0.5);
    this.win.y = 52;
    this.container.addChild(this.win);
  }

  show(tier: WinCategory): void {
    for (const [k, text] of this.tiers) text.visible = k === tier;
    this.current = this.tiers.get(tier) ?? null;
    this.pop = 0;
  }

  update(dt: number): void {
    if (!this.current || this.pop >= POP) return;
    this.pop = Math.min(this.pop + dt, POP);
    const p = this.pop / POP;
    // elastic settle: 1.6 → overshoot → 1
    const k = 1 + 0.6 * Math.pow(1 - p, 2) * Math.cos(p * Math.PI * 2.5);
    this.current.scale.set((this.bases.get(this.current) ?? 1) * k);
  }

  reset(): void {
    for (const text of this.tiers.values()) text.visible = false;
    this.current = null;
  }
}

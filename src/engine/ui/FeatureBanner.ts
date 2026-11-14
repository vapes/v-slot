import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { fitText } from './fitText';

const TITLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 50, fontWeight: 'bold',
  fill: ['#FFF8D0', '#FFD34A', '#FF8A00'], fillGradientStops: [0, 0.5, 1],
  stroke: 0x3A0A00, strokeThickness: 8, dropShadow: true, dropShadowDistance: 4, dropShadowAlpha: 0.7,
  align: 'center',
});
const SUB = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 26, fontWeight: 'bold',
  fill: 0xFFFFFF, stroke: 0x2A0A00, strokeThickness: 5, align: 'center',
});

/** Centred title + subtitle over a dimmed reel area; `show()` resolves when it is gone. */
export class FeatureBanner {
  readonly container = new Container();
  private elapsed = 0;
  private duration = 0;
  private done: (() => void) | null = null;
  private title = new Text('', TITLE);
  private sub = new Text('', SUB);
  private shade = new Graphics();
  private titleBase = 1;

  constructor(private cfg: SlotConfig) {
    const { reelOffsetX: x, reelOffsetY: y, reelAreaWidth: w, reelAreaHeight: h } = cfg;
    this.shade.beginFill(0x000000, 0.55);
    this.shade.drawRoundedRect(x, y, w, h, 10);
    this.shade.endFill();
    this.title.anchor.set(0.5);
    this.sub.anchor.set(0.5);
    this.title.position.set(x + w / 2, y + h / 2 - 22);
    this.sub.position.set(x + w / 2, y + h / 2 + 34);
    this.container.addChild(this.shade, this.title, this.sub);
    this.container.visible = false;
  }

  show(title: string, subtitle: string, ms: number): Promise<void> {
    this.title.text = title;
    this.sub.text = subtitle;
    fitText(this.title, this.cfg.reelAreaWidth * 0.92);
    this.titleBase = this.title.scale.x;
    fitText(this.sub, this.cfg.reelAreaWidth * 0.9);
    this.elapsed = 0;
    this.duration = ms;
    this.container.visible = true;
    this.container.alpha = 0;
    return new Promise(resolve => { this.done = resolve; });
  }

  update(dt: number): void {
    if (!this.done) return;
    this.elapsed += dt * (1000 / 60);
    const t = this.elapsed / this.duration;
    const fade = 0.12;
    this.container.alpha = t < fade ? t / fade : t > 1 - fade ? Math.max(0, (1 - t) / fade) : 1;
    const pop = t < fade ? 0.6 + 0.4 * (t / fade) : 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.04;
    this.title.scale.set(this.titleBase * pop);
    if (t >= 1) {
      this.container.visible = false;
      const cb = this.done;
      this.done = null;
      cb();
    }
  }
}

import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { vGradient, shadow } from './textStyle';
import type { SlotConfig } from '../config/SlotConfig';
import { fitText } from './fitText';

const HEADER = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 18, fontWeight: 'bold',
  fill: 0xFFC94A, letterSpacing: 4, align: 'center',
});
const TITLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 44, fontWeight: 'bold',
  fill: vGradient(['#FFF8D0', '#FFD34A', '#FF8A00'], [0, 0.5, 1]),
  stroke: { color: 0x3A0A00, width: 7 }, dropShadow: shadow(4, 0.7),
  align: 'center',
});
const SUB = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif', fontSize: 30, fontWeight: 'bold',
  fill: 0xFFFFFF, stroke: { color: 0x2A0A00, width: 5 }, align: 'center',
});

const PANEL_H = 250;
/** Part of the duration after which a tap closes the window early. */
const TAP_AFTER = 0.25;

/**
 * Modal window over the dimmed screen: small header, big title, subtitle
 * (e.g. "DRAGON'S NEST" / "CONGRATULATIONS!" / "YOU WON 5 RESPINS").
 * `show()` resolves when it closes — after `ms`, or earlier on a tap.
 */
export class FeatureBanner {
  readonly container = new Container();
  private elapsed = 0;
  private duration = 0;
  private done: (() => void) | null = null;
  private panel = new Container();
  private header = new Text({ text: '', style: HEADER });
  private title = new Text({ text: '', style: TITLE });
  private sub = new Text({ text: '', style: SUB });
  private titleBase = 1;
  private readonly innerW: number;

  constructor(cfg: SlotConfig) {
    const { reelOffsetX: x, reelOffsetY: y, reelAreaWidth: w, reelAreaHeight: h } = cfg;
    const shade = new Graphics().rect(0, 0, cfg.canvas.width, cfg.canvas.height).fill({ color: 0x000000, alpha: 0.6 });
    const pw = Math.min(w * 0.96, cfg.canvas.width - 20);
    this.innerW = pw - 40;
    const frame = new Graphics()
      .roundRect(-pw / 2, -PANEL_H / 2, pw, PANEL_H, 18).fill({ color: 0x1A0820, alpha: 0.96 }).stroke({ width: 3, color: 0xFFC94A })
      .roundRect(-pw / 2 + 8, -PANEL_H / 2 + 8, pw - 16, PANEL_H - 16, 12).stroke({ width: 1, color: 0xFFC94A, alpha: 0.45 });
    const rule = new Graphics().moveTo(-pw * 0.3, -62).lineTo(pw * 0.3, -62).stroke({ width: 1, color: 0xFFC94A, alpha: 0.5 });
    for (const [txt, ty] of [[this.header, -84], [this.title, -12], [this.sub, 64]] as const) {
      txt.anchor.set(0.5);
      txt.y = ty;
    }
    this.panel.position.set(x + w / 2, y + h / 2);
    this.panel.addChild(frame, rule, this.header, this.title, this.sub);
    this.container.addChild(shade, this.panel);
    this.container.visible = false;
    this.container.eventMode = 'static';
    this.container.on('pointertap', () => {
      if (this.done && this.elapsed < this.duration * 0.88 && this.elapsed > this.duration * TAP_AFTER) {
        this.elapsed = this.duration * 0.88; // jump to the fade-out
      }
    });
  }

  show(header: string, title: string, subtitle: string, ms: number): Promise<void> {
    this.header.text = header;
    this.title.text = title;
    this.sub.text = subtitle;
    fitText(this.header, this.innerW);
    fitText(this.title, this.innerW);
    this.titleBase = this.title.scale.x;
    fitText(this.sub, this.innerW);
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
    const pop = t < fade ? 0.7 + 0.3 * (t / fade) : 1;
    this.panel.scale.set(pop);
    this.title.scale.set(this.titleBase * (1 + Math.sin(Math.min(t, 1) * Math.PI * 3) * 0.03));
    if (t >= 1) {
      this.container.visible = false;
      const cb = this.done;
      this.done = null;
      cb();
    }
  }
}

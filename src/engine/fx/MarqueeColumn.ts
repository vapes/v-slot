import { BLEND_MODES, Container, Graphics, Sprite } from 'pixi.js';
import { sparkTexture } from './Sparks';

const SPACING = 16;   // px between bulbs along the frame
const CHASE = 3;      // every n-th bulb is lit, the pattern runs around the frame
const SPEED = 9;      // bulbs per second

/**
 * Light anticipation for classic machines: a thin frame with chasing marquee
 * bulbs around one reel column. No shader, no smoke — subtle by design.
 */
export class MarqueeColumn {
  readonly container = new Container();
  private frame = new Graphics();
  private bulbs: Sprite[] = [];
  private time = 0;

  constructor(w: number, h: number, private core: number, private glow: number) {
    const inset = 3;
    this.frame.lineStyle(2.5, glow, 0.95);
    this.frame.drawRoundedRect(inset, inset, w - inset * 2, h - inset * 2, 6);
    this.frame.lineStyle(1, core, 0.8);
    this.frame.drawRoundedRect(inset + 2, inset + 2, w - inset * 2 - 4, h - inset * 2 - 4, 5);
    this.container.addChild(this.frame);

    // bulbs clockwise around the perimeter
    const pts: [number, number][] = [];
    const along = (x0: number, y0: number, x1: number, y1: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.max(1, Math.round(len / SPACING));
      for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
    };
    const m = inset;
    along(m, m, w - m, m);
    along(w - m, m, w - m, h - m);
    along(w - m, h - m, m, h - m);
    along(m, h - m, m, m);
    for (const [x, y] of pts) {
      const b = new Sprite(sparkTexture());
      b.anchor.set(0.5);
      b.position.set(x, y);
      b.blendMode = BLEND_MODES.ADD;
      this.bulbs.push(b);
      this.container.addChild(b);
    }
  }

  update(dt: number, alpha: number): void {
    this.time += dt / 60;
    this.container.alpha = alpha;
    this.container.visible = alpha > 0;
    const head = this.time * SPEED;
    this.bulbs.forEach((b, i) => {
      const lit = ((i - Math.floor(head)) % CHASE + CHASE) % CHASE === 0;
      b.tint = lit ? this.core : this.glow;
      b.alpha = lit ? 1 : 0.4;
      b.scale.set(lit ? 0.3 : 0.15);
    });
  }
}

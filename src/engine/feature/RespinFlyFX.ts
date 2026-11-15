import { BLEND_MODES, Container, Graphics } from 'pixi.js';

interface Spark {
  g: Graphics;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Ring: grows by this per frame instead of shrinking. */
  grow?: number;
}

interface Comet {
  head: Graphics;
  x0: number; y0: number;
  cx: number; cy: number;
  x1: number; y1: number;
  t: number;
  frames: number;
  done: () => void;
}

const FRAME_MS = 1000 / 60;

function softDot(radius: number, color: number): Graphics {
  const g = new Graphics();
  g.beginFill(color, 0.35).drawCircle(0, 0, radius).endFill();
  g.beginFill(color, 0.75).drawCircle(0, 0, radius * 0.62).endFill();
  g.beginFill(0xFFFFFF, 1).drawCircle(0, 0, radius * 0.32).endFill();
  g.blendMode = BLEND_MODES.ADD;
  return g;
}

/**
 * "Respins fly to the counter": a glowing comet with a spark trail leaves a
 * cell (burst at launch), arcs to the respin meter and bursts on arrival.
 * `fly()` resolves when the comet lands. Visual only (Math.random is fine).
 */
export class RespinFlyFX {
  readonly container = new Container();
  private sparks: Spark[] = [];
  private comets: Comet[] = [];

  constructor(private color = 0xFFB020) {}

  fly(from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    this.burst(from.x, from.y, 34, 4.5);
    this.ring(from.x, from.y);
    const head = softDot(24, this.color);
    head.position.set(from.x, from.y);
    this.container.addChild(head);
    // control point: up and to the side, so the path arcs instead of a straight line
    const side = from.x < to.x ? -1 : 1;
    const cx = (from.x + to.x) / 2 + side * 60 * Math.random();
    const cy = Math.min(from.y, to.y) - 40 - 50 * Math.random();
    return new Promise(done => {
      this.comets.push({ head, x0: from.x, y0: from.y, cx, cy, x1: to.x, y1: to.y, t: 0, frames: Math.max(ms / FRAME_MS, 1), done });
    });
  }

  update(dt: number): void {
    for (const c of [...this.comets]) {
      c.t = Math.min(c.t + dt / c.frames, 1);
      const e = c.t < 0.5 ? 2 * c.t * c.t : 1 - (-2 * c.t + 2) ** 2 / 2; // ease in-out
      const u = 1 - e;
      const x = u * u * c.x0 + 2 * u * e * c.cx + e * e * c.x1;
      const y = u * u * c.y0 + 2 * u * e * c.cy + e * e * c.y1;
      c.head.position.set(x, y);
      c.head.scale.set(0.9 + Math.sin(c.t * Math.PI) * 0.5);
      for (let i = 0; i < 6; i++) this.spawn(x, y, 1.2, 18 + Math.random() * 18, 4 + Math.random() * 5);
      if (c.t >= 1) {
        this.comets.splice(this.comets.indexOf(c), 1);
        c.head.destroy();
        this.burst(c.x1, c.y1, 40, 5);
        this.ring(c.x1, c.y1);
        c.done();
      }
    }
    for (const s of [...this.sparks]) {
      s.life += dt;
      s.g.x += s.vx * dt;
      s.g.y += s.vy * dt;
      s.vx *= 0.94;
      if (!s.grow) s.vy = s.vy * 0.94 + 0.05 * dt;
      const k = 1 - s.life / s.max;
      s.g.alpha = Math.max(k, 0);
      s.g.scale.set(s.grow ? 1 + s.life * s.grow : Math.max(k, 0.05));
      if (s.life >= s.max) {
        this.sparks.splice(this.sparks.indexOf(s), 1);
        s.g.destroy();
      }
    }
  }

  clear(): void {
    this.comets.forEach(c => { c.head.destroy(); c.done(); });
    this.sparks.forEach(s => s.g.destroy());
    this.comets = [];
    this.sparks = [];
  }

  /** Expanding glow ring (launch from the cell, landing on the counter). */
  private ring(x: number, y: number): void {
    const g = new Graphics().lineStyle(6, this.color, 0.9).drawCircle(0, 0, 14)
      .lineStyle(2, 0xFFFFFF, 0.9).drawCircle(0, 0, 14);
    g.blendMode = BLEND_MODES.ADD;
    g.position.set(x, y);
    this.container.addChild(g);
    this.sparks.push({ g, vx: 0, vy: 0, life: 0, max: 24, grow: 0.22 });
  }

  private burst(x: number, y: number, n: number, speed: number): void {
    for (let i = 0; i < n; i++) this.spawn(x, y, speed, 20 + Math.random() * 18, 2.5 + Math.random() * 3.5);
  }

  private spawn(x: number, y: number, speed: number, max: number, r: number): void {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    const g = softDot(r, Math.random() < 0.3 ? 0xFFF0B0 : this.color);
    g.position.set(x, y);
    this.container.addChild(g);
    this.sparks.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max });
  }
}

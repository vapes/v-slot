import { Container, Sprite, Texture } from 'pixi.js';
import { sparkTexture } from '../fx/Sparks';

interface Spark {
  g: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  /** Ring: grows by this per frame instead of shrinking. */
  grow?: number;
  /** Scale at birth. */
  base: number;
}

interface Comet {
  head: Sprite;
  x0: number; y0: number;
  cx: number; cy: number;
  x1: number; y1: number;
  t: number;
  frames: number;
  done: () => void;
}

const FRAME_MS = 1000 / 60;

/** Sprite size of the shared glow texture (sparkTexture is 64 px). A dot of radius r → scale r * DOT / TEX. */
const TEX = 64;
/** The soft texture fades early; this factor matches the old 3-layer drawn dots visually. */
const DOT = 3.4;

let ringTex: Texture | null = null;
/** Soft glowing ring, drawn once into a canvas texture. */
function ringTexture(): Texture {
  if (ringTex) return ringTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 9;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,1)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(size / 2, size / 2, 22, 0, Math.PI * 2); ctx.stroke();
  ringTex = Texture.from(c);
  return ringTex;
}

/**
 * "Respins fly to the counter": a glowing comet with a spark trail leaves a
 * cell (burst + ring at launch), arcs to the respin meter and bursts on
 * arrival. `fly()` resolves when the comet lands. Every particle is a pooled
 * Sprite on one shared glow texture (one batch, no per-frame allocations).
 * Visual only (Math.random is fine).
 */
export class RespinFlyFX {
  readonly container = new Container();
  private sparks: Spark[] = [];
  private comets: Comet[] = [];
  private pool: Sprite[] = [];
  private ringPool: Sprite[] = [];

  constructor(private color = 0xFFB020) {}

  fly(from: { x: number; y: number }, to: { x: number; y: number }, ms: number): Promise<void> {
    this.burst(from.x, from.y, 34, 4.5);
    this.ring(from.x, from.y);
    const head = this.take(this.pool, sparkTexture());
    head.tint = 0xFFF4C8;
    head.position.set(from.x, from.y);
    head.scale.set((24 * DOT) / TEX);
    // control point: up and to the side, so the path arcs instead of a straight line
    const side = from.x < to.x ? -1 : 1;
    const cx = (from.x + to.x) / 2 + side * 60 * Math.random();
    const cy = Math.min(from.y, to.y) - 40 - 50 * Math.random();
    return new Promise(done => {
      this.comets.push({ head, x0: from.x, y0: from.y, cx, cy, x1: to.x, y1: to.y, t: 0, frames: Math.max(ms / FRAME_MS, 1), done });
    });
  }

  update(dt: number): void {
    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i];
      c.t = Math.min(c.t + dt / c.frames, 1);
      const e = c.t < 0.5 ? 2 * c.t * c.t : 1 - (-2 * c.t + 2) ** 2 / 2; // ease in-out
      const u = 1 - e;
      const x = u * u * c.x0 + 2 * u * e * c.cx + e * e * c.x1;
      const y = u * u * c.y0 + 2 * u * e * c.cy + e * e * c.y1;
      c.head.position.set(x, y);
      c.head.scale.set(((24 * DOT) / TEX) * (0.9 + Math.sin(c.t * Math.PI) * 0.5));
      for (let k = 0; k < 6; k++) this.spawn(x, y, 1.2, 18 + Math.random() * 18, 4 + Math.random() * 5);
      if (c.t >= 1) {
        this.comets.splice(i, 1);
        this.give(this.pool, c.head);
        this.burst(c.x1, c.y1, 40, 5);
        this.ring(c.x1, c.y1);
        c.done();
      }
    }
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life += dt;
      s.g.x += s.vx * dt;
      s.g.y += s.vy * dt;
      s.vx *= 0.94;
      if (!s.grow) s.vy = s.vy * 0.94 + 0.05 * dt;
      const k = 1 - s.life / s.max;
      s.g.alpha = Math.max(k, 0);
      s.g.scale.set(s.base * (s.grow ? 1 + s.life * s.grow : Math.max(k, 0.05)));
      if (s.life >= s.max) {
        this.sparks.splice(i, 1);
        this.give(s.grow ? this.ringPool : this.pool, s.g);
      }
    }
  }

  clear(): void {
    this.comets.forEach(c => { this.give(this.pool, c.head); c.done(); });
    this.sparks.forEach(s => this.give(s.grow ? this.ringPool : this.pool, s.g));
    this.comets = [];
    this.sparks = [];
  }

  /** Expanding glow ring (launch from the cell, landing on the counter). */
  private ring(x: number, y: number): void {
    const g = this.take(this.ringPool, ringTexture());
    g.tint = this.color;
    g.position.set(x, y);
    const base = 28 / 44; // ring radius 22 px in the texture → 14 px
    g.scale.set(base);
    this.sparks.push({ g, vx: 0, vy: 0, life: 0, max: 24, grow: 0.22, base });
  }

  private burst(x: number, y: number, n: number, speed: number): void {
    for (let i = 0; i < n; i++) this.spawn(x, y, speed, 20 + Math.random() * 18, 2.5 + Math.random() * 3.5);
  }

  private spawn(x: number, y: number, speed: number, max: number, r: number): void {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random() * 0.7);
    const g = this.take(this.pool, sparkTexture());
    g.tint = Math.random() < 0.3 ? 0xFFF0B0 : this.color;
    g.position.set(x, y);
    const base = (r * DOT) / TEX; // glow dot of radius r
    g.scale.set(base);
    this.sparks.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max, base });
  }

  private take(pool: Sprite[], texture: Texture): Sprite {
    let s = pool.pop();
    if (!s) {
      s = new Sprite(texture);
      s.anchor.set(0.5);
      s.blendMode = 'add';
      this.container.addChild(s);
    }
    s.visible = true;
    s.alpha = 1;
    return s;
  }

  private give(pool: Sprite[], s: Sprite): void {
    s.visible = false;
    pool.push(s);
  }
}

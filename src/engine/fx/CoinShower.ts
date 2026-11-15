import { Container, Sprite, Texture } from 'pixi.js';
import { sparkTexture } from './Sparks';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  max: number;
  base: number;
  /** Coin flip phase / speed (coins only). */
  spin: number;
  spinV: number;
  coin: boolean;
}

const TEX = 48;
const GRAVITY = 0.32;
/** Hard cap so a MAX win cannot flood a weak phone. */
const MAX_LIVE = 260;

let coinTex: Texture | null = null;
/** Gold coin (rim, inner ring, shine), drawn once into a canvas texture. */
export function coinTexture(): Texture {
  if (coinTex) return coinTex;
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const ctx = c.getContext('2d')!;
  const m = TEX / 2;
  const body = ctx.createRadialGradient(m - 6, m - 8, 2, m, m, m);
  body.addColorStop(0, '#FFF6C0');
  body.addColorStop(0.45, '#FFC83A');
  body.addColorStop(1, '#B26A08');
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.arc(m, m, m - 1, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,60,0,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(m, m, m - 2.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,236,150,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(m, m, m - 9, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(m - 6, m - 9, 7, 3.5, -0.6, 0, Math.PI * 2); ctx.fill();
  coinTex = Texture.from(c);
  return coinTex;
}

/**
 * Win shower: spinning gold coins (fountain from a point, rain from the top)
 * plus additive glints. Pooled sprites on two shared textures, hidden and
 * reused — no allocations once warmed up. Visual only (Math.random is fine).
 */
export class CoinShower {
  readonly container = new Container();
  private coins = new Container();
  private glints = new Container();
  private live: Particle[] = [];
  private coinPool: Sprite[] = [];
  private glintPool: Sprite[] = [];

  constructor(private width: number, private height: number) {
    this.container.addChild(this.coins, this.glints);
  }

  get count(): number {
    return this.live.length;
  }

  /** Coins thrown up and out from (x, y). */
  fountain(x: number, y: number, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const v = (7 + Math.random() * 7) * power;
      this.spawn(true, x + (Math.random() - 0.5) * 40, y, Math.cos(a) * v, Math.sin(a) * v, 90 + Math.random() * 40);
    }
  }

  /** Coins falling from above the screen. */
  rain(n: number): void {
    for (let i = 0; i < n; i++) {
      this.spawn(true, Math.random() * this.width, -30, (Math.random() - 0.5) * 2, 2 + Math.random() * 4, 140);
    }
  }

  /** Additive glints bursting from (x, y). */
  glint(x: number, y: number, n: number, spread = 60): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 1 + Math.random() * 4;
      this.spawn(false, x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread * 0.4,
        Math.cos(a) * v, Math.sin(a) * v - 1, 30 + Math.random() * 30);
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life += dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      if (p.coin) {
        p.vy += GRAVITY * dt;
        p.vx *= 0.995;
        p.spin += p.spinV * dt;
        p.s.scale.set(p.base * Math.max(Math.abs(Math.cos(p.spin)), 0.12), p.base);
        p.s.alpha = Math.min(1, (p.max - p.life) / 20);
      } else {
        p.vx *= 0.95;
        p.vy *= 0.95;
        const k = 1 - p.life / p.max;
        p.s.alpha = Math.max(k, 0);
        p.s.scale.set(p.base * Math.max(k, 0.1));
      }
      if (p.life >= p.max || p.s.y > this.height + 40) {
        this.live.splice(i, 1);
        p.s.visible = false;
        (p.coin ? this.coinPool : this.glintPool).push(p.s);
      }
    }
  }

  clear(): void {
    for (const p of this.live) {
      p.s.visible = false;
      (p.coin ? this.coinPool : this.glintPool).push(p.s);
    }
    this.live = [];
  }

  private spawn(coin: boolean, x: number, y: number, vx: number, vy: number, max: number): void {
    if (this.live.length >= MAX_LIVE) return;
    const pool = coin ? this.coinPool : this.glintPool;
    let s = pool.pop();
    if (!s) {
      s = new Sprite(coin ? coinTexture() : sparkTexture());
      s.anchor.set(0.5);
      if (!coin) {
        s.blendMode = 'add';
        s.tint = 0xFFE7A0;
      }
      (coin ? this.coins : this.glints).addChild(s);
    }
    s.visible = true;
    s.alpha = 1;
    s.position.set(x, y);
    const base = coin ? (14 + Math.random() * 8) / TEX : (8 + Math.random() * 10) / 64;
    s.scale.set(base);
    this.live.push({ s, vx, vy, life: 0, max, base, spin: Math.random() * 6, spinV: 0.12 + Math.random() * 0.18, coin });
  }
}

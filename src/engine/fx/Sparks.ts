import { BLEND_MODES, Container, Sprite, Texture } from 'pixi.js';

interface Spark {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  sway: number;
}

let glowTexture: Texture | null = null;

/** Soft round glow dot, generated once (canvas → texture). */
export function sparkTexture(): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  glowTexture = Texture.from(canvas);
  return glowTexture;
}

/** Additive spark/ember particles rising through rectangular areas (pooled sprites). */
export class Sparks {
  readonly container = new Container();
  private live: Spark[] = [];
  private pool: Sprite[] = [];

  constructor(private colors: [number, number]) {}

  /** Emit `count` sparks from the bottom and sides of the rect (x, y, w, h). */
  emit(x: number, y: number, w: number, h: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const sprite = this.pool.pop() ?? new Sprite(sparkTexture());
      sprite.anchor.set(0.5);
      sprite.blendMode = BLEND_MODES.ADD;
      const side = Math.random();
      // 60 % from the bottom edge, the rest climb along the side edges
      sprite.x = side < 0.6 ? x + Math.random() * w : side < 0.8 ? x + Math.random() * 10 : x + w - Math.random() * 10;
      sprite.y = side < 0.6 ? y + h - Math.random() * 12 : y + Math.random() * h;
      sprite.tint = Math.random() < 0.5 ? this.colors[0] : this.colors[1];
      const maxLife = 40 + Math.random() * 50;
      this.container.addChild(sprite);
      this.live.push({
        sprite, vx: (Math.random() - 0.5) * 0.8, vy: -(2 + Math.random() * 4.5),
        life: maxLife, maxLife, sway: Math.random() * Math.PI * 2,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.container.removeChild(p.sprite);
        this.pool.push(p.sprite);
        this.live.splice(i, 1);
        continue;
      }
      p.sway += dt * 0.15;
      p.sprite.x += (p.vx + Math.sin(p.sway) * 0.6) * dt;
      p.sprite.y += p.vy * dt;
      const t = p.life / p.maxLife;
      p.sprite.alpha = Math.min(1, t * 1.6);
      p.sprite.scale.set(0.12 + 0.28 * t);
    }
  }

  get active(): number {
    return this.live.length;
  }
}

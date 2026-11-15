import { Container, Graphics } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import { ANTICIPATION_DEFAULTS } from '../config/defaults';
import { createFlameMesh, flameUniforms, type FlameMesh } from './flameShader';
import { MarqueeColumn } from './MarqueeColumn';
import { Sparks } from './Sparks';

const FADE_FRAMES = 12;
const PAD = 16;

/** One anticipating-column visual; `update` gets the current fade (0..1). */
interface ColumnFX {
  readonly display: Container | FlameMesh;
  update(dt: number, alpha: number, time: number): void;
}

interface Column {
  fx: ColumnFX;
  on: boolean;
  alpha: number;
}

function flameColumn(w: number, h: number, core: number, glow: number): ColumnFX {
  const mesh = createFlameMesh(w, h, PAD, core, glow);
  const u = flameUniforms(mesh);
  return {
    display: mesh,
    update(_dt, alpha, time) {
      mesh.visible = alpha > 0;
      if (!mesh.visible) return;
      u.uTime = time;
      u.uAlpha = alpha;
    },
  };
}

function marqueeColumn(w: number, h: number, core: number, glow: number): ColumnFX {
  const m = new MarqueeColumn(w, h, core, glow);
  return { display: m.container, update: (dt, alpha) => m.update(dt, alpha) };
}

/**
 * Anticipation visuals over one reel column, style from config.anticipation:
 *  - "flame" (default): GLSL flame border + rising sparks
 *  - "marquee": thin frame with chasing casino bulbs (light, classic look)
 * plus a dim veil (anticipation.veil) over the other reels.
 * Coordinates are local to ReelController.container.
 */
export class AnticipationFX {
  readonly container = new Container();
  private columns: Column[] = [];
  private sparks: Sparks | null = null;
  private veil = new Graphics();
  private time = 0;
  private readonly veilAlpha: number;

  constructor(private cfg: SlotConfig) {
    const a = cfg.tease ?? ANTICIPATION_DEFAULTS;
    const [core, glow] = [...a.colors, ...ANTICIPATION_DEFAULTS.colors].map(color);
    const style = a.style;
    this.veilAlpha = a.veil;
    this.container.addChild(this.veil);
    const make = style === 'marquee' ? marqueeColumn : flameColumn;
    for (let i = 0; i < cfg.grid.cols; i++) {
      const fx = make(cfg.symbol.width, cfg.reelAreaHeight, core, glow);
      fx.display.x = i * cfg.reelWidth;
      fx.display.visible = false;
      this.container.addChild(fx.display);
      this.columns.push({ fx, on: false, alpha: 0 });
    }
    if (a.sparks ?? style === 'flame') {
      this.sparks = new Sparks([core, glow]);
      this.container.addChild(this.sparks.container);
    }
  }

  start(reel: number): void {
    this.columns[reel].on = true;
  }

  stop(reel: number): void {
    this.columns[reel].on = false;
  }

  stopAll(): void {
    this.columns.forEach(c => { c.on = false; });
  }

  update(dt: number): void {
    this.time += dt / 60;
    const { reelWidth, reelAreaHeight, symbol } = this.cfg;
    let active = -1;
    this.columns.forEach((c, i) => {
      c.alpha = Math.max(0, Math.min(1, c.alpha + (c.on ? dt : -dt) / FADE_FRAMES));
      c.fx.update(dt, c.alpha, this.time);
      if (c.on) {
        active = i;
        // ~1.3 sparks per frame per active column
        this.sparks?.emit(i * reelWidth, 0, symbol.width, reelAreaHeight, Math.random() < 0.3 ? 2 : 1);
      }
    });
    this.drawVeil(active);
    this.sparks?.update(dt);
  }

  /**
   * Darken every column except the anticipating one, fading with the effect.
   * Geometry is rebuilt only when the active column changes; the fade is alpha.
   */
  private drawVeil(active: number): void {
    const strength = Math.max(...this.columns.map(c => c.alpha));
    this.veil.visible = strength > 0 && this.veilAlpha > 0;
    if (!this.veil.visible) return;
    this.veil.alpha = this.veilAlpha * strength;
    if (active === this.veilColumn) return;
    this.veilColumn = active;
    const { reelWidth, reelAreaHeight, grid } = this.cfg;
    this.veil.clear();
    for (let i = 0; i < grid.cols; i++) {
      if (i !== active) this.veil.rect(i * reelWidth, 0, reelWidth, reelAreaHeight);
    }
    this.veil.fill(0x000000);
  }

  private veilColumn = -2;
}

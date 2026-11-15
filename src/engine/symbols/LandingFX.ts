import { ColorMatrixFilter, Container, Graphics } from 'pixi.js';
import { color, type LandingConfig } from '../config/SlotConfig';

const FRAME_MS = 1000 / 60;
/** Band width relative to the cell width. */
const BAND = 0.42;

/**
 * Landing animation of one reel cell (config.symbols[].landing): quick pop,
 * diagonal light bands sweeping across the art, a brightness flash and an
 * optional hue rotation ("iridescent" shimmer). Lives inside SlotSymbol and
 * drives its `content` container; masked to the cell so bands never spill.
 * The mask and the hue filter exist only while the animation plays (both cost
 * extra GPU passes on mobile).
 */
export class LandingFX {
  private layer = new Container();
  private bands = new Graphics();
  private flash = new Graphics();
  private mask = new Graphics();
  private hue: ColorMatrixFilter | null = null;
  private spec: LandingConfig | null = null;
  private elapsed = 0;

  constructor(private content: Container, private w: number, private h: number) {
    this.mask.rect(0, 0, w, h).fill(0xFFFFFF);
    this.bands.blendMode = 'add';
    this.flash.blendMode = 'add';
    this.layer.addChild(this.flash, this.bands, this.mask);
    this.layer.visible = false;
    content.addChild(this.layer);
  }

  get active(): boolean {
    return this.spec !== null;
  }

  play(spec: LandingConfig): void {
    this.spec = spec;
    this.elapsed = 0;
    const c = color(spec.color);
    this.flash.clear().rect(0, 0, this.w, this.h).fill(c);
    this.drawBand(c);
    this.layer.visible = true;
    this.layer.mask = this.mask;
    this.content.pivot.set(this.w / 2, this.h / 2);
    this.content.position.set(this.w / 2, this.h / 2);
    if (spec.hue) {
      this.hue ??= new ColorMatrixFilter({ resolution: 1 }); // a short shimmer does not need retina resolution
      this.content.filters = [this.hue];
    }
    this.update(0);
  }

  update(dt: number): void {
    const s = this.spec;
    if (!s) return;
    this.elapsed += dt * FRAME_MS;
    const t = Math.min(this.elapsed / s.ms, 1);

    // pop: fast rise in the first 30 %, eased back
    const pop = t < 0.3 ? Math.sin((t / 0.3) * Math.PI / 2) : Math.cos(((t - 0.3) / 0.7) * Math.PI / 2);
    this.content.scale.set(1 + (s.scale - 1) * pop);

    // flash peaks early and fades
    this.flash.alpha = s.flash * Math.max(0, 1 - t * 2.2) * Math.min(1, t * 12);

    // sweeps: each band crosses the cell in its own slice of the timeline
    const n = Math.max(1, s.sweeps);
    const slice = Math.min(t * n, n - 1e-6);
    const p = slice - Math.floor(slice);
    this.bands.x = -this.w * BAND * 1.6 + p * this.w * (1 + BAND * 2.2);
    this.bands.alpha = Math.sin(p * Math.PI) * (t < 1 ? 1 : 0);

    if (this.hue) {
      this.hue.hue(s.hue * t, false);
    }
    if (t >= 1) this.stop();
  }

  stop(): void {
    if (!this.spec) return;
    this.spec = null;
    this.layer.visible = false;
    this.layer.mask = null;
    this.content.scale.set(1);
    this.content.pivot.set(0, 0);
    this.content.position.set(0, 0);
    if (this.content.filters) this.content.filters = null;
  }

  /** A slanted soft band: bright core, fading edges (stacked strips, additive). */
  private drawBand(c: number): void {
    const g = this.bands.clear();
    const bw = this.w * BAND;
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const k = 1 - Math.abs((i + 0.5) / steps * 2 - 1); // 0 at edges, 1 in the centre
      const x = (i / steps) * bw;
      const skew = this.h * 0.45;
      g.poly([x + skew, -4, x + skew + bw / steps, -4, x + bw / steps, this.h + 4, x, this.h + 4])
        .fill({ color: i === (steps >> 1) ? 0xFFFFFF : c, alpha: 0.08 + 0.5 * k * k });
    }
  }
}

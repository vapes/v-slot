import { Container, Graphics, type Mesh, type Shader } from 'pixi.js';
import { color, type SlotConfig } from '../config/SlotConfig';
import { createFlameMesh } from './flameShader';
import { Sparks } from './Sparks';

const FADE_FRAMES = 12;
const PAD = 16;

interface Column {
  mesh: Mesh<Shader>;
  on: boolean;
  alpha: number;
}

/**
 * Anticipation visuals over one reel column: GLSL flame border (flameShader),
 * rising spark particles and a dim veil over the other reels.
 * Coordinates are local to ReelController.container.
 */
export class AnticipationFX {
  readonly container = new Container();
  private columns: Column[] = [];
  private sparks: Sparks;
  private veil = new Graphics();
  private time = 0;

  constructor(private cfg: SlotConfig) {
    const [core = 0xFFE9A0, glow = 0xFF6A00] = (cfg.anticipation?.colors ?? []).map(color);
    this.sparks = new Sparks([core, glow]);
    this.container.addChild(this.veil);
    for (let i = 0; i < cfg.grid.cols; i++) {
      const mesh = createFlameMesh(cfg.symbol.width, cfg.reelAreaHeight, PAD, core, glow);
      mesh.x = i * cfg.reelWidth;
      mesh.visible = false;
      this.container.addChild(mesh);
      this.columns.push({ mesh, on: false, alpha: 0 });
    }
    this.container.addChild(this.sparks.container);
  }

  start(reel: number): void {
    this.columns[reel].on = true;
    this.columns[reel].mesh.visible = true;
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
      c.mesh.visible = c.alpha > 0;
      c.mesh.shader.uniforms.uTime = this.time;
      c.mesh.shader.uniforms.uAlpha = c.alpha;
      if (c.on) {
        active = i;
        // ~1.3 sparks per frame per active column
        const n = Math.random() < 0.3 ? 2 : 1;
        this.sparks.emit(i * reelWidth, 0, symbol.width, reelAreaHeight, n);
      }
    });
    this.drawVeil(active);
    this.sparks.update(dt);
  }

  /** Darken every column except the anticipating one, fading with the effect. */
  private drawVeil(active: number): void {
    this.veil.clear();
    const strength = Math.max(...this.columns.map(c => c.alpha));
    if (strength <= 0) return;
    const { reelWidth, reelAreaHeight, grid } = this.cfg;
    this.veil.beginFill(0x000000, 0.32 * strength);
    for (let i = 0; i < grid.cols; i++) {
      if (i !== active) this.veil.drawRect(i * reelWidth, 0, reelWidth, reelAreaHeight);
    }
    this.veil.endFill();
  }
}

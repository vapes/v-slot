import { Container, Graphics } from 'pixi.js';
import { soundSettings } from '../audio/soundSettings';

const GOLD = 0xFFD27A;
const BG = 0x1B1024;

/** Round sound on/off toggle (Pixi Graphics, same look as HomeButton). */
export class SoundButton {
  readonly container = new Container();
  private icon = new Graphics();

  constructor(x: number, y: number, private radius = 21) {
    const c = this.container;
    c.position.set(x, y);
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const bg = new Graphics();
    bg.circle(0, 0, radius).fill({ color: BG, alpha: 0.95 }).stroke({ width: 2, color: GOLD, alpha: 0.9 });
    c.addChild(bg, this.icon);

    c.on('pointertap', () => soundSettings.toggle());
    soundSettings.onChange(() => this.draw());
    this.draw();
  }

  private draw(): void {
    const g = this.icon;
    const s = this.radius / 21;
    g.clear();
    // speaker body
    g.poly([-9 * s, -4 * s, -4 * s, -4 * s, 2 * s, -9 * s, 2 * s, 9 * s, -4 * s, 4 * s, -9 * s, 4 * s]).fill(GOLD);
    if (soundSettings.muted) {
      g.moveTo(5 * s, -5 * s).lineTo(12 * s, 5 * s);
      g.moveTo(12 * s, -5 * s).lineTo(5 * s, 5 * s);
      g.stroke({ width: 2.4 * s, color: GOLD });
    } else {
      const arcFrom = (r: number, a0: number, a1: number) =>
        g.moveTo(1 * s + r * Math.cos(a0), r * Math.sin(a0)).arc(1 * s, 0, r, a0, a1);
      arcFrom(6 * s, -Math.PI / 4, Math.PI / 4);
      arcFrom(10.5 * s, -Math.PI / 3.2, Math.PI / 3.2);
      g.stroke({ width: 2.2 * s, color: GOLD });
    }
  }
}

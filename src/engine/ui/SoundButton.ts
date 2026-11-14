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
    bg.lineStyle(2, GOLD, 0.9);
    bg.beginFill(BG, 0.95);
    bg.drawCircle(0, 0, radius);
    bg.endFill();
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
    g.beginFill(GOLD, 1);
    g.drawPolygon([-9 * s, -4 * s, -4 * s, -4 * s, 2 * s, -9 * s, 2 * s, 9 * s, -4 * s, 4 * s, -9 * s, 4 * s]);
    g.endFill();
    if (soundSettings.muted) {
      g.lineStyle(2.4 * s, GOLD, 1);
      g.moveTo(5 * s, -5 * s).lineTo(12 * s, 5 * s);
      g.moveTo(12 * s, -5 * s).lineTo(5 * s, 5 * s);
    } else {
      g.lineStyle(2.2 * s, GOLD, 1);
      g.arc(1 * s, 0, 6 * s, -Math.PI / 4, Math.PI / 4);
      g.moveTo(1 * s + 10.5 * s * Math.cos(-Math.PI / 3.2), 10.5 * s * Math.sin(-Math.PI / 3.2));
      g.arc(1 * s, 0, 10.5 * s, -Math.PI / 3.2, Math.PI / 3.2);
    }
  }
}

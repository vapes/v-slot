import { Container, Graphics } from 'pixi.js';

/** Small round "back to lobby" button drawn with Pixi Graphics (house glyph). */
export class HomeButton {
  readonly container = new Container();

  constructor(x: number, y: number, onTap: () => void, radius = 21) {
    this.container.position.set(x, y);
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    const g = new Graphics();
    g.circle(0, 0, radius).fill({ color: 0x1B1024, alpha: 0.95 }).stroke({ width: 2, color: 0xFFD27A, alpha: 0.9 });
    const s = radius * 0.5;
    g.poly([-s, -s * 0.05, 0, -s * 0.95, s, -s * 0.05]).fill(0xFFD27A);
    g.rect(-s * 0.68, -s * 0.1, s * 1.36, s * 0.95).fill(0xFFD27A);
    g.rect(-s * 0.2, s * 0.3, s * 0.4, s * 0.55).fill(0x1B1024);
    this.container.addChild(g);
    this.container.on('pointertap', onTap);
  }
}

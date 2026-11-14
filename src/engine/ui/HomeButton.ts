import { Container, Graphics } from 'pixi.js';

/** Small round "back to lobby" button drawn with Pixi Graphics (house glyph). */
export class HomeButton {
  readonly container = new Container();

  constructor(x: number, y: number, onTap: () => void, radius = 21) {
    this.container.position.set(x, y);
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';

    const g = new Graphics();
    g.lineStyle(2, 0xFFD27A, 0.9);
    g.beginFill(0x1B1024, 0.95);
    g.drawCircle(0, 0, radius);
    g.endFill();
    const s = radius * 0.5;
    g.lineStyle(0);
    g.beginFill(0xFFD27A, 1);
    g.drawPolygon([-s, -s * 0.05, 0, -s * 0.95, s, -s * 0.05]);
    g.drawRect(-s * 0.68, -s * 0.1, s * 1.36, s * 0.95);
    g.endFill();
    g.beginFill(0x1B1024, 1);
    g.drawRect(-s * 0.2, s * 0.3, s * 0.4, s * 0.55);
    g.endFill();
    this.container.addChild(g);
    this.container.on('pointertap', onTap);
  }
}

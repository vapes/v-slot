import { Application, Graphics, Text, TextStyle } from 'pixi.js';
import { fitCanvas, type GameManifest } from '@/engine';
import { GameCard } from './GameCard';

const W = 540;
const H = 900;
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

/** Portrait start screen listing every registered game. Pixi only. */
export class Lobby {
  private app = new Application({
    width: W,
    height: H,
    backgroundColor: 0x0E0614,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  constructor(private games: GameManifest[], private onPick: (id: string) => void) {}

  mount(): void {
    document.body.appendChild(this.app.view as HTMLCanvasElement);
    fitCanvas(this.app, W, H);
    const stage = this.app.stage;

    const glow = new Graphics();
    for (let i = 0; i < 12; i++) {
      glow.beginFill(0x7A2A8C, 0.035);
      glow.drawCircle(W / 2, 40, 120 + i * 40);
      glow.endFill();
    }
    stage.addChild(glow);

    const title = new Text('V-SLOT', new TextStyle({
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 56, fontWeight: 'bold',
      fill: ['#FFF3B0', '#FFC94A', '#E08A12'], letterSpacing: 6,
      dropShadow: true, dropShadowDistance: 3, dropShadowAlpha: 0.6,
    }));
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 44);
    const sub = new Text('CHOOSE YOUR GAME', new TextStyle({ fontFamily: FONT, fontSize: 16, fill: 0xFFFFFF, letterSpacing: 4 }));
    sub.alpha = 0.6;
    sub.anchor.set(0.5, 0);
    sub.position.set(W / 2, 118);
    stage.addChild(title, sub);

    const top = 170;
    const gap = 22;
    const cardW = W - 60;
    const cardH = Math.min(340, (H - top - 30 - gap * (this.games.length - 1)) / this.games.length);
    this.games.forEach((g, i) => {
      const card = new GameCard(g, cardW, cardH, this.onPick);
      card.container.position.set(30, top + i * (cardH + gap));
      stage.addChild(card.container);
    });
  }
}

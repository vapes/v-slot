import { Graphics, Text, TextStyle } from 'pixi.js';
import { createApp, fitCanvas, shadow, t, vGradient, type GameManifest } from '@/engine';
import { GameCard } from './GameCard';

const W = 540;
const H = 900;
const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

/** Portrait start screen listing every registered game. Pixi only. */
export class Lobby {
  constructor(private games: GameManifest[], private onPick: (id: string) => void) {}

  async mount(): Promise<void> {
    const app = await createApp(W, H, 0x0E0614, 30); // static screen: 30 fps is plenty
    document.body.appendChild(app.canvas);
    fitCanvas(app, W, H);
    const stage = app.stage;

    const glow = new Graphics();
    for (let i = 0; i < 12; i++) {
      glow.circle(W / 2, 40, 120 + i * 40).fill({ color: 0x7A2A8C, alpha: 0.035 });
    }
    stage.addChild(glow);

    const title = new Text({ text: t('lobby.title'), style: new TextStyle({
      fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 56, fontWeight: 'bold',
      fill: vGradient(['#FFF3B0', '#FFC94A', '#E08A12']), letterSpacing: 6,
      dropShadow: shadow(3, 0.6),
    }) });
    title.anchor.set(0.5, 0);
    title.position.set(W / 2, 44);
    const sub = new Text({ text: t('lobby.choose'), style: new TextStyle({ fontFamily: FONT, fontSize: 16, fill: 0xFFFFFF, letterSpacing: 4 }) });
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

import { Assets, Container, Graphics, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import type { GameManifest } from '@/engine';

const FONT = '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif';

/** Tappable lobby card: thumbnail, title, subtitle and PLAY pill. */
export class GameCard {
  readonly container = new Container();

  constructor(private game: GameManifest, private w: number, private h: number, onPick: (id: string) => void) {
    const c = this.container;
    c.eventMode = 'static';
    c.cursor = 'pointer';

    const frame = new Graphics();
    frame.lineStyle(2, game.accent, 0.9);
    frame.beginFill(0x170C1F, 1);
    frame.drawRoundedRect(0, 0, w, h, 18);
    frame.endFill();
    c.addChild(frame);

    const thumbH = h - 96;
    const thumb = new Container();
    thumb.position.set(8, 8);
    const mask = new Graphics();
    mask.beginFill(0xFFFFFF);
    mask.drawRoundedRect(0, 0, w - 16, thumbH, 12);
    mask.endFill();
    const placeholder = new Graphics();
    placeholder.beginFill(game.accent, 0.25);
    placeholder.drawRect(0, 0, w - 16, thumbH);
    placeholder.endFill();
    thumb.addChild(placeholder, mask);
    thumb.mask = mask;
    c.addChild(thumb);
    void this.loadThumb(thumb, w - 16, thumbH);

    const title = new Text(game.title.toUpperCase(), new TextStyle({
      fontFamily: FONT, fontSize: 24, fontWeight: 'bold', fill: 0xFFFFFF, letterSpacing: 1.5,
    }));
    title.position.set(20, thumbH + 20);
    const sub = new Text(game.subtitle, new TextStyle({ fontFamily: FONT, fontSize: 14, fill: 0xFFFFFF }));
    sub.alpha = 0.65;
    sub.position.set(20, thumbH + 54);

    const pill = new Graphics();
    pill.beginFill(game.accent, 1);
    pill.drawRoundedRect(-52, -20, 104, 40, 20);
    pill.endFill();
    pill.position.set(w - 72, thumbH + 48);
    const play = new Text('PLAY', new TextStyle({ fontFamily: FONT, fontSize: 18, fontWeight: 'bold', fill: 0x140A10 }));
    play.anchor.set(0.5);
    pill.addChild(play);
    c.addChild(title, sub, pill);

    c.on('pointerdown', () => c.scale.set(0.98));
    c.on('pointerupoutside', () => c.scale.set(1));
    c.on('pointertap', () => {
      c.scale.set(1);
      onPick(game.id);
    });
  }

  /** Cover-fit the thumbnail image; keep the accent placeholder if missing. */
  private async loadThumb(holder: Container, w: number, h: number): Promise<void> {
    try {
      const tex = await Assets.load<Texture>(import.meta.env.BASE_URL + this.game.thumbnail);
      const s = new Sprite(tex);
      const scale = Math.max(w / tex.width, h / tex.height);
      s.scale.set(scale);
      s.position.set((w - tex.width * scale) / 2, (h - tex.height * scale) / 2);
      holder.addChildAt(s, 1);
    } catch {
      console.warn(`[Lobby] no thumbnail for ${this.game.id}`);
    }
  }
}

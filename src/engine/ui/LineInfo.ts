import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SlotConfig } from '../config/SlotConfig';
import { fitText } from './fitText';

const STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, Helvetica, sans-serif',
  fontSize: 14, fontWeight: 'bold', fill: 0xFFE7A3, letterSpacing: 0.4,
  stroke: { color: 0x1A0A00, width: 3 },
});
const PILL_H = 22;
const PAD_X = 14;

/**
 * Info line under the reels (engine, every game): "LINE 3: 4× KING — 1.20"
 * while the win cycle walks through the winning lines; hidden otherwise.
 * Position: `config.lineInfo.y` (game px, centre), default just below the
 * reels (`lineInfo.gap`). The pill is redrawn only when the text changes.
 */
export class LineInfo {
  readonly container = new Container();
  private pill = new Graphics();
  private text = new Text({ text: '', style: STYLE });
  private readonly maxW: number;

  constructor(cfg: SlotConfig) {
    const li = cfg.lineInfo;
    this.maxW = cfg.reelAreaWidth - 2 * PAD_X;
    this.container.position.set(
      cfg.reelOffsetX + cfg.reelAreaWidth / 2,
      li.y ?? cfg.reelOffsetY + cfg.reelAreaHeight + li.gap + PILL_H / 2,
    );
    this.text.anchor.set(0.5);
    this.container.addChild(this.pill, this.text);
    this.container.visible = false;
  }

  show(text: string): void {
    if (this.text.text !== text) {
      this.text.text = text;
      fitText(this.text, this.maxW);
      const w = this.text.width + 2 * PAD_X;
      this.pill.clear().roundRect(-w / 2, -PILL_H / 2, w, PILL_H, PILL_H / 2)
        .fill({ color: 0x12060F, alpha: 0.88 }).stroke({ width: 1.5, color: 0xD9A441, alpha: 0.85 });
    }
    this.container.visible = true;
  }

  hide(): void {
    this.container.visible = false;
  }
}

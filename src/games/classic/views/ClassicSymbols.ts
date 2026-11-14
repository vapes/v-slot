import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { SymbolRenderer, SymbolView } from '@/engine';
import { config, SYMBOL_COLORS } from '../config';

const TEXT_STYLE = new TextStyle({
  fontFamily: 'Arial, Helvetica, sans-serif',
  fontSize: 48,
  fontWeight: 'bold',
  fill: 0xFFFFFF,
  dropShadow: true,
  dropShadowColor: 0x000000,
  dropShadowDistance: 2,
  dropShadowBlur: 4,
});

/** Coloured rounded tile with the symbol letter. */
export const classicSymbols: SymbolRenderer = {
  createView(id: string): SymbolView {
    const { width: W, height: H } = config.symbol;
    const root = new Container();
    const bg = new Graphics();
    const label = new Text(id, TEXT_STYLE);
    label.anchor.set(0.5);
    label.position.set(W / 2, H / 2);
    root.addChild(bg, label);

    const draw = (sym: string) => {
      label.text = sym;
      bg.clear();
      bg.beginFill(SYMBOL_COLORS[sym] ?? 0x444444, 0.9);
      bg.drawRoundedRect(0, 0, W, H, 12);
      bg.endFill();
      bg.lineStyle(2, 0xFFFFFF, 0.15);
      bg.drawRoundedRect(0, 0, W, H, 12);
    };
    draw(id);
    return { display: root, setSymbol: draw };
  },
};

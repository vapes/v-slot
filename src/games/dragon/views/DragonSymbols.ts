import { Container, Graphics, Sprite, Text, TextStyle } from 'pixi.js';
import { shadow, vGradient, fitText, type SymbolRenderer, type SymbolView } from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

const VALUE_STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  fontSize: 19, fontWeight: 'bold', fill: vGradient(['#FFFBE0', '#FFD34A', '#FF9A1F']),
  stroke: { color: 0x2A0600, width: 4 }, dropShadow: shadow(1, 0.8),
});

/** Vertical centre of the value badge, in cell px (top of the tile, above the WILD caption). */
const VALUE_Y = 16;

/**
 * Opaque art tiles sliced from the mockup, stretched to the cell size.
 * Sticky wilds in the Dragon's Nest carry their cash value / jackpot name on a
 * dark pill at the top of the tile (the baked WILD caption stays readable below).
 */
export const dragonSymbols: SymbolRenderer = {
  createView(id: string): SymbolView {
    const { width: w, height: h } = config.symbol;
    const root = new Container();
    const sprite = new Sprite(symbolTexture(id));
    const value = new Text({ text: '', style: VALUE_STYLE });
    value.anchor.set(0.5);
    value.position.set(w / 2, VALUE_Y);
    const pill = new Graphics();
    const badge = new Container();
    badge.addChild(pill, value);
    badge.visible = false;
    root.addChild(sprite, badge);

    const fit = () => {
      sprite.width = w;
      sprite.height = h;
    };
    fit();
    return {
      display: root,
      setSymbol(next: string) {
        sprite.texture = symbolTexture(next);
        fit();
        badge.visible = false;
      },
      setValue(label: string | null) {
        badge.visible = !!label;
        value.text = label ?? '';
        fitText(value, w - 16);
        const pw = value.width + 14, ph = value.height + 2;
        pill.clear().roundRect((w - pw) / 2, VALUE_Y - ph / 2, pw, ph, ph / 2)
          .fill({ color: 0x1A0505, alpha: 0.82 }).stroke({ width: 1.5, color: 0xFFC94A, alpha: 0.9 });
      },
    };
  },
};

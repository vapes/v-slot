import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { shadow, vGradient, fitText, type SymbolRenderer, type SymbolView } from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

const VALUE_STYLE = new TextStyle({
  fontFamily: 'Arial Black, Arial, sans-serif', fontSize: 30, fontWeight: 'bold',
  fill: vGradient(['#FFFFFF', '#FFE27A', '#FF9A1F'], [0, 0.5, 1]),
  stroke: { color: 0x3A0866, width: 5 }, dropShadow: shadow(2, 0.8, 2),
});

/**
 * Transparent gem sprites (tools/draw-symbols.py) on the dark reel panel.
 * The power orb's multiplier value ("×25", from the cell id "mult:25") is a
 * caption centred on the orb.
 */
export const crystalSymbols: SymbolRenderer = {
  createView(id: string): SymbolView {
    const { width: w, height: h } = config.symbol;
    const root = new Container();
    const sprite = new Sprite(symbolTexture(id));
    sprite.width = w;
    sprite.height = h;
    const value = new Text({ text: '', style: VALUE_STYLE });
    value.anchor.set(0.5);
    value.position.set(w / 2, h / 2 + 2);
    value.visible = false;
    root.addChild(sprite, value);
    return {
      display: root,
      setSymbol(next: string) {
        sprite.texture = symbolTexture(next);
        sprite.width = w;
        sprite.height = h;
        value.visible = false;
      },
      setValue(label: string | null) {
        value.visible = !!label;
        if (label && value.text !== label) {
          value.text = label;
          value.scale.set(1);
          fitText(value, w * 0.8);
        }
      },
    };
  },
};

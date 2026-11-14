import { Container, Sprite, Text, TextStyle } from 'pixi.js';
import { fitText, type SymbolRenderer, type SymbolView } from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

const VALUE_STYLE = new TextStyle({
  fontFamily: '"Roboto Condensed", "Arial Narrow", Arial, sans-serif',
  fontSize: 19, fontWeight: 'bold', fill: ['#FFFBE0', '#FFD34A', '#FF9A1F'],
  stroke: 0x2A0600, strokeThickness: 4, dropShadow: true, dropShadowDistance: 1, dropShadowAlpha: 0.8,
});

/**
 * Opaque art tiles sliced from the mockup, stretched to the cell size.
 * Sticky eggs in the Dragon's Nest carry their cash value / jackpot name.
 */
export const dragonSymbols: SymbolRenderer = {
  createView(id: string): SymbolView {
    const { width: w, height: h } = config.symbol;
    const root = new Container();
    const sprite = new Sprite(symbolTexture(id));
    const value = new Text('', VALUE_STYLE);
    value.anchor.set(0.5);
    value.position.set(w / 2, h - 15);
    value.visible = false;
    root.addChild(sprite, value);

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
        value.visible = false;
      },
      setValue(label: string | null) {
        value.visible = !!label;
        value.text = label ?? '';
        fitText(value, w - 10);
      },
    };
  },
};

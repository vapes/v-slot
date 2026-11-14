import { Sprite } from 'pixi.js';
import type { SymbolRenderer, SymbolView } from '@/engine';
import { config } from '../config';
import { symbolTexture } from '../assets';

/** Opaque fruit-machine tiles sliced from the mockup, stretched to the cell. */
export const classicSymbols: SymbolRenderer = {
  createView(id: string): SymbolView {
    const sprite = new Sprite(symbolTexture(id));
    const fit = () => {
      sprite.width = config.symbol.width;
      sprite.height = config.symbol.height;
    };
    fit();
    return {
      display: sprite,
      setSymbol(next: string) {
        sprite.texture = symbolTexture(next);
        fit();
      },
    };
  },
};

import { Assets, Texture } from 'pixi.js';
import { SYMBOLS, type SymbolId } from './Config';

export const UI_SPRITES = ['menu', 'coins', 'auto', 'spin', 'turbo', 'trophy', 'minus', 'plus'] as const;
export type UiSpriteName = typeof UI_SPRITES[number];

const base = import.meta.env.BASE_URL + 'assets/';
const symbolTextures = new Map<SymbolId, Texture>();
const uiTextures = new Map<UiSpriteName, Texture>();
let background: Texture = Texture.EMPTY;

/** Load all skin textures (sliced from art/dragon-skin-source.png by scripts/slice-skin.py). */
export async function loadSkin(onProgress?: (p: number) => void): Promise<void> {
  const entries: Record<string, string> = { bg: base + 'bg.jpg' };
  for (const id of SYMBOLS) entries[`sym:${id}`] = `${base}symbols/${id}.jpg`;
  for (const name of UI_SPRITES) entries[`ui:${name}`] = `${base}ui/${name}.png`;

  Assets.addBundle('skin', entries);
  const loaded = await Assets.loadBundle('skin', onProgress) as Record<string, Texture>;

  background = loaded.bg;
  for (const id of SYMBOLS) symbolTextures.set(id, loaded[`sym:${id}`]);
  for (const name of UI_SPRITES) uiTextures.set(name, loaded[`ui:${name}`]);
}

export function backgroundTexture(): Texture {
  return background;
}

export function symbolTexture(id: SymbolId): Texture {
  return symbolTextures.get(id) ?? Texture.WHITE;
}

export function uiTexture(name: UiSpriteName): Texture {
  return uiTextures.get(name) ?? Texture.WHITE;
}

import { Assets, Texture } from 'pixi.js';
import { assetUrl } from '@/engine';
import { config } from './config';

export const UI_SPRITES = ['info', 'auto', 'spin', 'turbo', 'buy', 'minus', 'plus'] as const;
export type UiSpriteName = typeof UI_SPRITES[number];

const textures = new Map<string, Texture>();

/** Load textures sliced from art/source.png by tools/slice-skin.py. */
export async function loadSkin(): Promise<void> {
  const entries: Record<string, string> = { bg: assetUrl(config.id, 'bg.jpg'), overlay: assetUrl(config.id, 'overlay.webp') };
  for (const id of config.symbolIds) entries[`sym:${id}`] = assetUrl(config.id, `symbols/${id}.jpg`);
  for (const name of UI_SPRITES) entries[`ui:${name}`] = assetUrl(config.id, `ui/${name}.png`);

  Assets.addBundle('dragon', entries);
  const loaded = await Assets.loadBundle('dragon') as Record<string, Texture>;
  for (const [key, tex] of Object.entries(loaded)) textures.set(key, tex);
}

export const backgroundTexture = (): Texture => textures.get('bg') ?? Texture.EMPTY;
/** Frame, plates and the dragon cut out of bg.jpg, laid over the background video (tools/make-video-bg.py). */
export const overlayTexture = (): Texture => textures.get('overlay') ?? Texture.EMPTY;
/** Background video, muted (H.264 first, VP9 for browsers without it). */
export const backgroundVideos = (): string[] => [assetUrl(config.id, 'bg.mp4'), assetUrl(config.id, 'bg.webm')];
export const symbolTexture = (id: string): Texture => textures.get(`sym:${id}`) ?? Texture.WHITE;
export const uiTexture = (name: UiSpriteName): Texture => textures.get(`ui:${name}`) ?? Texture.WHITE;

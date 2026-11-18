import type { GameManifest } from '@/engine';

export const manifest: GameManifest = {
  id: 'crystal',
  title: 'Crystal Falls',
  subtitle: '6×5 · pay anywhere · tumbles · multipliers',
  thumbnail: 'games/crystal/thumb.jpg',
  accent: 0x9A6BFF,
  load: () => import('./index').then(m => m.default),
};

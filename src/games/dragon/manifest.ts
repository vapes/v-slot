import type { GameManifest } from '@/engine';

export const manifest: GameManifest = {
  id: 'dragon',
  title: 'Dragon Hoard',
  subtitle: "4×5 · 20 lines · Dragon's Nest respins",
  thumbnail: 'games/dragon/thumb.jpg',
  accent: 0xFF9A1F,
  load: () => import('./index').then(m => m.default),
};

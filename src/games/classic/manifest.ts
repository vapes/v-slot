import type { GameManifest } from '@/engine';

export const manifest: GameManifest = {
  id: 'classic',
  title: 'V-Slot Classic',
  subtitle: '5×3 · 20 lines · precomputed math · RTP 98%',
  thumbnail: 'games/classic/thumb.jpg',
  accent: 0x4CAF50,
  load: () => import('./index').then(m => m.default),
};

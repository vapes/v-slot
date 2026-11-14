import type { GameManifest } from '@/engine';

export const manifest: GameManifest = {
  id: 'classic',
  title: '777 Casino Classic',
  subtitle: '5×3 · 20 lines · fruit classic · RTP 98%',
  thumbnail: 'games/classic/thumb.jpg',
  accent: 0x2E7DF6,
  load: () => import('./index').then(m => m.default),
};

import { Game } from './core/Game';
import { loadSkin } from './core/SkinAssets';

async function boot(): Promise<void> {
  await loadSkin();
  const game = new Game();
  await game.init();
}

boot().catch(console.error);

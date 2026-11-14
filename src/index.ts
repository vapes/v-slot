import { SlotGame } from '@/engine';
import { GAMES } from './games/registry';
import { Lobby } from './lobby/Lobby';

/**
 * Router: `?game=<id>` launches that game, anything else shows the lobby.
 * Switching games reloads the page, so every game starts from a clean slate.
 */
async function boot(): Promise<void> {
  const id = new URLSearchParams(window.location.search).get('game');
  const manifest = GAMES.find(g => g.id === id);

  if (!manifest) {
    new Lobby(GAMES, (pick) => { window.location.search = `?game=${pick}`; }).mount();
    return;
  }

  document.title = `${manifest.title} — V-Slot`;
  const def = await manifest.load();
  await def.loadAssets?.();
  await new SlotGame(def).init();
}

boot().catch(console.error);

import { SlotGame, detectLanguage, i18n } from '@/engine';
import { GAMES } from './games/registry';
import { Lobby } from './lobby/Lobby';

/**
 * Router: `?game=<id>` launches that game, anything else shows the lobby.
 * Switching games reloads the page, so every game starts from a clean slate.
 */
async function boot(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const manifest = GAMES.find(g => g.id === params.get('game'));
  const lang = detectLanguage();
  // Translations come from the content CDN: common + the game's own namespace.
  await i18n.load(lang, manifest ? ['common', manifest.id] : ['common']);

  if (!manifest) {
    new Lobby(GAMES, (pick) => {
      const next = new URLSearchParams(params);
      next.set('game', pick);
      window.location.search = `?${next}`;
    }).mount();
    return;
  }

  document.title = `${i18n.t('game.title', {}, manifest.title)} — V-Slot`;
  const def = await manifest.load();
  await def.loadAssets?.();
  await new SlotGame(def).init();
}

boot().catch(console.error);

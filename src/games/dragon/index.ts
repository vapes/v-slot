import type { GameDefinition } from '@/engine';
import { config, MATH } from './config';
import { DragonMath } from './math/DragonMath';
import { loadSkin } from './assets';
import { dragonSymbols } from './views/DragonSymbols';
import { DragonView } from './views/DragonView';

const dragon: GameDefinition = {
  config,
  loadAssets: loadSkin,
  // Dev/QA only: ?force=feature makes every spin trigger the Dragon's Nest.
  createMath: () => new DragonMath(config, MATH, Math.random,
    import.meta.env.DEV && new URLSearchParams(window.location.search).get('force') === 'feature'),
  createSymbolRenderer: () => dragonSymbols,
  createView: (actions) => new DragonView(actions),
};

export default dragon;

import { forced, type GameDefinition } from '@/engine';
import { config, MATH } from './config';
import { DragonMath } from './math/DragonMath';
import { loadSkin } from './assets';
import { dragonSymbols } from './views/DragonSymbols';
import { DragonView } from './views/DragonView';

const dragon: GameDefinition = {
  config,
  loadAssets: loadSkin,
  // ?force=feature (dev only) makes every spin trigger the Dragon's Nest.
  createMath: () => new DragonMath(config, MATH, undefined, forced('feature')),
  createSymbolRenderer: () => dragonSymbols,
  createView: (actions) => new DragonView(actions),
};

export default dragon;

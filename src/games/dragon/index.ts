import { ReelStripMath, type GameDefinition } from '@/engine';
import { config, REEL_STRIPS } from './config';
import { loadSkin } from './assets';
import { dragonSymbols } from './views/DragonSymbols';
import { DragonView } from './views/DragonView';

const dragon: GameDefinition = {
  config,
  loadAssets: loadSkin,
  createMath: () => new ReelStripMath(config, REEL_STRIPS),
  createSymbolRenderer: () => dragonSymbols,
  createView: (actions) => new DragonView(actions),
};

export default dragon;

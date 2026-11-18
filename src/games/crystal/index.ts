import { forced, type GameDefinition } from '@/engine';
import { config, MATH } from './config';
import { loadArt } from './assets';
import { CrystalMath } from './math/CrystalMath';
import { crystalSymbols } from './views/CrystalSymbols';
import { CrystalView } from './views/CrystalView';


const crystal: GameDefinition = {
  config,
  loadAssets: loadArt,
  createMath: () => new CrystalMath(config, MATH, undefined, forced('feature')),
  createSymbolRenderer: () => crystalSymbols,
  createView: (actions) => new CrystalView(actions),
};

export default crystal;

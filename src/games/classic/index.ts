import type { GameDefinition } from '@/engine';
import { config } from './config';
import { loadSkin } from './assets';
import { ClassicMath } from './math/ClassicMath';
import { classicSymbols } from './views/ClassicSymbols';
import { ClassicView } from './views/ClassicView';

const classic: GameDefinition = {
  config,
  loadAssets: loadSkin,
  createMath: () => new ClassicMath(),
  createSymbolRenderer: () => classicSymbols,
  createView: (actions) => new ClassicView(actions),
};

export default classic;

import type { GameDefinition } from '@/engine';
import { config } from './config';
import { ClassicMath } from './math/ClassicMath';
import { classicSymbols } from './views/ClassicSymbols';
import { ClassicView } from './views/ClassicView';

const classic: GameDefinition = {
  config,
  createMath: () => new ClassicMath(),
  createSymbolRenderer: () => classicSymbols,
  createView: (actions) => new ClassicView(actions),
};

export default classic;

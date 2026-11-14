import gameConfig from '../gameConfig.json';

export const GAME_WIDTH = gameConfig.canvas.width;
export const GAME_HEIGHT = gameConfig.canvas.height;

/** Source mockup pixels → game pixels (UI sprites are sliced at source scale). */
export const SKIN_SCALE = GAME_WIDTH / gameConfig.skin.sourceWidth;
export const CURRENCY = gameConfig.skin.currency;

export type UiAnchor = { x: number; y: number; r?: number };
/** UI anchor converted from source-mockup coordinates to game coordinates. */
export function uiAnchor(name: keyof typeof gameConfig.skin.ui): { x: number; y: number; r: number } {
  const a: UiAnchor = gameConfig.skin.ui[name];
  return { x: a.x * SKIN_SCALE, y: a.y * SKIN_SCALE, r: (a.r ?? 0) * SKIN_SCALE };
}

export const REEL_COUNT = gameConfig.grid.cols;
export const ROW_COUNT = gameConfig.grid.rows;

export const SYMBOL_WIDTH = gameConfig.symbol.width;
export const SYMBOL_HEIGHT = gameConfig.symbol.height;
export const SYMBOL_GAP = gameConfig.symbol.gap;

export const REEL_WIDTH = SYMBOL_WIDTH + SYMBOL_GAP;
export const CELL_HEIGHT = SYMBOL_HEIGHT + SYMBOL_GAP;

export const REEL_AREA_WIDTH = REEL_COUNT * REEL_WIDTH;
export const REEL_AREA_HEIGHT = ROW_COUNT * CELL_HEIGHT;

export const REEL_OFFSET_X = gameConfig.reelOffsetX;
export const REEL_OFFSET_Y = gameConfig.reelOffsetY;

/** Available total-bet values in cents (player cycles through these with − / +). */
export const BET_OPTIONS = gameConfig.betOptions;
export const DEFAULT_BET_INDEX = gameConfig.defaultBetIndex;
export const START_BALANCE = gameConfig.startBalance;

export type SymbolId = string;

export const SYMBOLS: SymbolId[] = gameConfig.symbols.map(s => s.id);
export const WILD: SymbolId = gameConfig.wild;

export const SYMBOL_NAMES: Record<SymbolId, string> = Object.fromEntries(
  gameConfig.symbols.map(s => [s.id, s.name])
);

/** Visual-only weights for random "blur" symbols during spin. */
export const SYMBOL_WEIGHTS: Record<SymbolId, number> = Object.fromEntries(
  gameConfig.symbols.map(s => [s.id, s.weight])
);

export const REEL_STRIPS: SymbolId[][] = gameConfig.reels;

export const PAYLINES: number[][] = gameConfig.paylines;

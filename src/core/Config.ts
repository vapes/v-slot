import gameConfig from '../gameConfig.json';

export const GAME_WIDTH = gameConfig.canvas.width;
export const GAME_HEIGHT = gameConfig.canvas.height;

export const REEL_COUNT = gameConfig.grid.cols;
export const ROW_COUNT = gameConfig.grid.rows;

export const SYMBOL_WIDTH = gameConfig.symbol.width;
export const SYMBOL_HEIGHT = gameConfig.symbol.height;
export const SYMBOL_GAP = gameConfig.symbol.gap;

export const REEL_WIDTH = SYMBOL_WIDTH + SYMBOL_GAP;
export const CELL_HEIGHT = SYMBOL_HEIGHT + SYMBOL_GAP;

export const REEL_AREA_WIDTH = REEL_COUNT * REEL_WIDTH;
export const REEL_AREA_HEIGHT = ROW_COUNT * CELL_HEIGHT;

export const REEL_OFFSET_X = (GAME_WIDTH - REEL_AREA_WIDTH) / 2;
export const REEL_OFFSET_Y = gameConfig.reelOffsetY;

// Available line-bet values (player cycles through these with − / + buttons)
export const BET_OPTIONS = gameConfig.betOptions;


export type SymbolId = 'V' | 'A' | 'P' | 'E' | 'S';

export const SYMBOLS: SymbolId[] = gameConfig.symbols.map(s => s.id as SymbolId);

export const SYMBOL_COLORS: Record<SymbolId, number> = Object.fromEntries(
  gameConfig.symbols.map(s => [s.id, Number(s.color)])
) as Record<SymbolId, number>;

export const SYMBOL_WEIGHTS: Record<SymbolId, number> = Object.fromEntries(
  gameConfig.symbols.map(s => [s.id, s.weight])
) as Record<SymbolId, number>;

export const REEL_STRIP_LENGTH = gameConfig.reels[0].length;

export const PAYLINES: number[][] = gameConfig.paylines;

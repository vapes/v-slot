export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

export const REEL_COUNT = 5;
export const ROW_COUNT = 3;

export const SYMBOL_WIDTH = 100;
export const SYMBOL_HEIGHT = 120;
export const SYMBOL_GAP = 4;

export const REEL_WIDTH = SYMBOL_WIDTH + SYMBOL_GAP;
export const CELL_HEIGHT = SYMBOL_HEIGHT + SYMBOL_GAP;

export const REEL_AREA_WIDTH = REEL_COUNT * REEL_WIDTH;
export const REEL_AREA_HEIGHT = ROW_COUNT * CELL_HEIGHT;

export const REEL_OFFSET_X = (GAME_WIDTH - REEL_AREA_WIDTH) / 2;
export const REEL_OFFSET_Y = 120;

// Spin animation settings are in spinConfig.json

export type SymbolId = 'V' | 'A' | 'P' | 'E' | 'S';

export const SYMBOLS: SymbolId[] = ['V', 'A', 'P', 'E', 'S'];

export const SYMBOL_COLORS: Record<SymbolId, number> = {
  V: 0xE63946,  // Red
  A: 0xF4A261,  // Orange
  P: 0x2A9D8F,  // Teal
  E: 0x457B9D,  // Blue
  S: 0x6C757D,  // Gray
};

export const SYMBOL_WEIGHTS: Record<SymbolId, number> = {
  S: 9,
  E: 8,
  P: 6,
  A: 4,
  V: 3,
};

export const REEL_STRIP_LENGTH = 30;

export const PAYLINES: number[][] = [
  [1, 1, 1, 1, 1],  // middle row
  [0, 0, 0, 0, 0],  // top row
  [2, 2, 2, 2, 2],  // bottom row
  [0, 1, 2, 1, 0],  // V shape
  [2, 1, 0, 1, 2],  // inverted V
  [0, 0, 1, 2, 2],  // diagonal down
  [2, 2, 1, 0, 0],  // diagonal up
  [1, 0, 0, 0, 1],  // U shape top
  [1, 2, 2, 2, 1],  // U shape bottom
  [0, 1, 0, 1, 0],  // zigzag top
  [2, 1, 2, 1, 2],  // zigzag bottom
  [1, 0, 1, 0, 1],  // wave top
  [1, 2, 1, 2, 1],  // wave bottom
  [0, 1, 1, 1, 0],  // flat middle dip top
  [2, 1, 1, 1, 2],  // flat middle dip bottom
  [0, 0, 1, 0, 0],  // bump top
  [2, 2, 1, 2, 2],  // bump bottom
  [1, 0, 1, 2, 1],  // S shape
  [1, 2, 1, 0, 1],  // reverse S
  [0, 2, 0, 2, 0],  // alternating top-bottom
];

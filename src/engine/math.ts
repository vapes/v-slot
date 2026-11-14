/**
 * Pure math entry point of the engine — no Pixi, no DOM. Usable from game
 * math modules AND from Node tools (e.g. `npx tsx src/games/<id>/tools/*.ts`).
 * Games may import from '@/engine' or '@/engine/math' (both are public).
 */
export { resolveConfig, color, type RawSlotConfig, type SlotConfig } from './config/SlotConfig';
export type { SpinResult, WinResult, StickyCell, FeatureStep, FeatureRound } from './math/types';
export { evaluateLines, toSpinResult } from './math/evaluateLines';
export { linePayout, payingCounts, lineBetOf } from './math/Paytable';
export { ReelStripMath } from './math/ReelStripMath';
export type { MathModel } from './contracts';

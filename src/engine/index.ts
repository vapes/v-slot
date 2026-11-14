/**
 * Public engine API. Games import ONLY from '@/engine' (enforced by
 * `npm run check`). Add exports here rather than deep-importing.
 */
export * from './contracts';
export { resolveConfig, color, type RawSlotConfig, type SlotConfig } from './config/SlotConfig';
export type { SpinResult, WinResult } from './math/types';
export { evaluateLines, toSpinResult } from './math/evaluateLines';
export { linePayout, payingCounts, lineBetOf } from './math/Paytable';
export { ReelStripMath } from './math/ReelStripMath';
export { SlotGame } from './core/SlotGame';
export { fitCanvas, goToLobby } from './core/fitCanvas';
export { InfoButton } from './ui/PaytableScreen';
export { SpriteButton } from './ui/SpriteButton';
export { SpriteSpinButton, type SpinButtonStyle } from './ui/SpriteSpinButton';
export {
  DEFAULT_THEME, PAD, ptStyle, ptText, ptPanel, ptDivider, ptPaylines, ptRtp, type PaytableTheme,
} from './ui/paytableBlocks';
export { formatMoney, assetUrl } from './utils/Money';

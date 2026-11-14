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
export { SpriteButton } from './ui/SpriteButton';
export { fitText } from './ui/fitText';
export { SpriteSpinButton, type SpinButtonStyle } from './ui/SpriteSpinButton';
export { i18n, t, detectLanguage, ENGINE_STRINGS, FALLBACK_LANG } from './i18n/I18n';
export { CONTENT_CDN, cdnUrl } from './content/cdn';
export { soundSettings } from './audio/soundSettings';
export { formatMoney, assetUrl } from './utils/Money';

/**
 * Public engine API. Games import ONLY from '@/engine' (enforced by
 * `npm run check`). Add exports here rather than deep-importing.
 */
export * from './contracts';
export * from './math';
export { SlotGame } from './core/SlotGame';
export { fitCanvas, goToLobby } from './core/fitCanvas';
export { detectPlayMode, type PlayMode } from './core/playMode';
export { SpriteButton } from './ui/SpriteButton';
export { fitText } from './ui/fitText';
export { SpriteSpinButton, type SpinButtonStyle } from './ui/SpriteSpinButton';
export { i18n, t, detectLanguage, ENGINE_STRINGS, FALLBACK_LANG } from './i18n/I18n';
export { CONTENT_CDN, cdnUrl } from './content/cdn';
export { soundSettings } from './audio/soundSettings';
export { formatMoney, assetUrl } from './utils/Money';

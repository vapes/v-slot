/**
 * Public engine API. Games import ONLY from '@/engine' (enforced by
 * `npm run check`). Add exports here rather than deep-importing.
 */
export * from './contracts';
export * from './math';
export { SlotGame } from './core/SlotGame';
export { fitCanvas, goToLobby } from './core/fitCanvas';
export { createApp } from './core/createApp';
export { detectPlayMode, type PlayMode } from './core/playMode';
export { forced, debugging, applySeed } from './core/devFlags';
export { gameEvents, type GameEventMap } from './core/GameEvents';
export { SpriteButton } from './ui/SpriteButton';
export { fitText } from './ui/fitText';
export { WinBox, type WinBoxRect, type WinBoxStyles } from './ui/WinBox';
export { vGradient, shadow } from './ui/textStyle';
export { createSkin, type Skin, type SkinAnchor, type SkinAnchorRaw } from './ui/skin';
export { SpriteSpinButton, type SpinButtonStyle } from './ui/SpriteSpinButton';
export { i18n, t, detectLanguage, FALLBACK_LANG } from './i18n/I18n';
export { soundSettings } from './audio/soundSettings';
export { formatMoney, assetUrl } from './utils/Money';

import { fetchText, i18nUrl } from '../content/cdn';

export type Dict = Record<string, string>;

export const FALLBACK_LANG = 'en';

/**
 * Engine strings used when the CDN has no translation (or is unreachable).
 * Keys are the contract between code and i18n/<lang>/common.json.
 */
export const ENGINE_STRINGS: Dict = {
  'status.idle': 'Place your bets',
  'status.spin': 'Good luck!',
  'status.noBalance': 'Not enough balance',
  'status.loadFailed': 'Failed to load the game',
  'hud.win': 'WIN {amount}',
  'win.line': 'LINE {line}: {count}× {symbol} — {amount}',
  'celebration.big': 'BIG',
  'celebration.huge': 'HUGE',
  'celebration.epic': 'EPIC',
  'celebration.max': 'MAX',
  'celebration.win': 'WIN',
  'lobby.choose': 'CHOOSE YOUR GAME',
  'lobby.play': 'PLAY',
};

/**
 * Translations loaded from the content CDN. Lookup order:
 * current language → English → caller fallback → ENGINE_STRINGS → key.
 * `{name}` placeholders are replaced from params.
 */
export class I18n {
  private lang = FALLBACK_LANG;
  private dict: Dict = {};
  private fallback: Dict = {};

  get language(): string {
    return this.lang;
  }

  /** Load namespaces (e.g. ['common', 'dragon']) for `lang`, plus English as fallback. */
  async load(lang: string, namespaces: string[]): Promise<void> {
    this.lang = lang;
    const [dict, fallback] = await Promise.all([
      loadAll(lang, namespaces),
      lang === FALLBACK_LANG ? Promise.resolve({}) : loadAll(FALLBACK_LANG, namespaces),
    ]);
    this.dict = dict;
    this.fallback = fallback;
    document.documentElement.lang = lang;
  }

  has(key: string): boolean {
    return key in this.dict || key in this.fallback;
  }

  t(key: string, params: Record<string, string | number> = {}, fallback?: string): string {
    const raw = this.dict[key] ?? this.fallback[key] ?? fallback ?? ENGINE_STRINGS[key] ?? key;
    return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
  }
}

async function loadAll(lang: string, namespaces: string[]): Promise<Dict> {
  const parts = await Promise.all(namespaces.map(async (ns) => {
    try {
      return JSON.parse(await fetchText(i18nUrl(lang, ns))) as Dict;
    } catch (err) {
      console.warn(`[i18n] ${lang}/${ns} unavailable:`, err);
      return {};
    }
  }));
  return Object.assign({}, ...parts);
}

/** `?lang=xx` wins, then the browser language, then English. */
export function detectLanguage(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('lang');
  const raw = fromUrl || navigator.language || FALLBACK_LANG;
  return raw.toLowerCase().split('-')[0];
}

/** Shared instance used by the engine, games and lobby. */
export const i18n = new I18n();
export const t = (key: string, params?: Record<string, string | number>, fallback?: string): string =>
  i18n.t(key, params, fallback);

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
  'label.win': 'WIN',
  'win.line': 'LINE {line}: {count}× {symbol} — {amount}',
  'celebration.big': 'BIG',
  'celebration.huge': 'HUGE',
  'celebration.epic': 'EPIC',
  'celebration.max': 'MAX',
  'celebration.win': 'WIN',
  'feature.title': 'BONUS',
  'feature.intro': 'CONGRATULATIONS!',
  'feature.won': 'YOU WON {n} RESPINS',
  'feature.won.one': 'YOU WON {n} RESPIN',
  'feature.respins': 'RESPINS',
  'feature.collected': 'TOTAL {amount}',
  'feature.total': 'TOTAL WIN',
  'feature.grand': 'GRAND',
  'feature.jackpot.mini': 'MINI',
  'feature.jackpot.major': 'MAJOR',
  'lobby.title': 'V-SLOT',
  'buy.title': 'BUY FEATURE',
  'buy.confirm': 'BUY',
  'buy.cancel': 'CANCEL',
  'button.buy': 'BUY',
  'lobby.choose': 'CHOOSE YOUR GAME',
  'lobby.play': 'PLAY',
  'paytable.title': 'Paytable',
  'paytable.close': 'Close',
  'paytable.unavailable': 'Paytable is unavailable. Check your connection and try again.',
};

/**
 * Translations loaded from the content CDN. Lookup order:
 * current language → English → caller fallback → ENGINE_STRINGS → key.
 * `{name}` placeholders are replaced from params. A numeric `n` param picks a
 * plural form first when the dictionary has one: `<key>.<one|few|many|other>`
 * (Intl.PluralRules of the current language), e.g. "feature.won.few".
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
    if (typeof params.n === 'number') {
      const form = `${key}.${new Intl.PluralRules(this.lang).select(params.n)}`;
      // the first dictionary that knows the key (or the form) decides
      for (const d of [this.dict, this.fallback, ENGINE_STRINGS]) {
        if (form in d) return fill(d[form], params);
        if (key in d) break;
      }
    }
    const raw = this.dict[key] ?? this.fallback[key] ?? fallback ?? ENGINE_STRINGS[key] ?? key;
    return fill(raw, params);
  }
}

function fill(raw: string, params: Record<string, string | number>): string {
  return raw.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
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

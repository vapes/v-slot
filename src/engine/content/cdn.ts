/**
 * Content CDN: paytable HTML templates and translation files live outside the
 * game bundle so they can be updated without a release.
 *
 * Base URL: build-time env `VITE_CONTENT_CDN` (e.g. https://cdn.example.com/slots/),
 * else the local mirror `public/cdn/` deployed with the app.
 *
 * Layout on the CDN (mirrors public/cdn/):
 *   i18n/<lang>/common.json         shared engine + lobby strings
 *   i18n/<lang>/<gameId>.json       per-game strings (symbol names, …)
 *   paytables/<gameId>/<lang>.html  paytable template (see engine/ui/paytableTemplate.ts)
 *
 * The CDN must send CORS headers (Access-Control-Allow-Origin) for fetch().
 */
const env = import.meta.env as Record<string, string | undefined>;

export const CONTENT_CDN = withSlash(env.VITE_CONTENT_CDN || `${import.meta.env.BASE_URL}cdn/`);

function withSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

/** Absolute URL (needed inside the paytable iframe). */
export function cdnUrl(path: string): string {
  return new URL(CONTENT_CDN + path, window.location.href).href;
}

export const i18nUrl = (lang: string, ns: string): string => cdnUrl(`i18n/${lang}/${ns}.json`);
export const paytableUrl = (gameId: string, lang: string): string => cdnUrl(`paytables/${gameId}/${lang}.html`);

export async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

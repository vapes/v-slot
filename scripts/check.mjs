/**
 * Architecture guard — run via `npm run check` (after tsc). Fails with a list
 * of violations. Checks:
 *   1. every src/**\/*.ts file ≤ MAX_LINES lines; no hardcoded Text strings
 *   2. import boundaries: engine ↛ games/lobby; games → '@/engine' + own folder
 *      only; manifests stay light (type imports + dynamic import)
 *   3. game folder layout + registry + ids
 *   4. config.json sanity (grid, paylines, paytable, bets, reels)
 *   5. content CDN mirror: en translations per game, key parity across
 *      languages, paytable templates referencing real symbols/pays
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { resolve, relative, dirname, sep } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
const MAX_LINES = 250;
const REQUIRED = ['config.json', 'config.ts', 'index.ts', 'manifest.ts', 'GAME.md'];
const errors = [];
const warn = [];
const err = (file, msg) => errors.push(`${relative(ROOT, file)}: ${msg}`);

const walk = (dir) => readdirSync(dir).flatMap(n => {
  const p = resolve(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const tsFiles = walk(SRC).filter(f => f.endsWith('.ts'));
const importsOf = (src) => [...src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g)]
  .map(m => ({ spec: m[1] ?? m[2], typeOnly: /^(?:import|export)\s+type\s/.test(m[0]), dynamic: !!m[2] }));

// 1 + 2 ───────────────────────────────────────────────────────────────────────
for (const file of tsFiles) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n').length - (src.endsWith('\n') ? 1 : 0);
  if (lines > MAX_LINES) err(file, `${lines} lines (max ${MAX_LINES}) — split into focused modules`);

  // user-facing strings must go through t() (translations come from the content CDN)
  for (const m of src.matchAll(/new Text\(\s*(['"`])([^'"`]*)\1|\.text\s*=\s*(['"`])([^'"`]*)\3/g)) {
    const literal = m[2] ?? m[4] ?? '';
    if (/\p{L}{2,}/u.test(literal.replace(/\$\{[^}]*\}/g, ''))) err(file, `hardcoded UI text "${literal}" — use t('key') + i18n/<lang>/*.json`);
  }

  const rel = relative(SRC, file).split(sep);
  for (const { spec, typeOnly, dynamic } of importsOf(src)) {
    const abs = spec.startsWith('.') ? resolve(dirname(file), spec) : spec.startsWith('@/') ? resolve(SRC, spec.slice(2)) : null;
    const target = abs ? relative(SRC, abs).split(sep) : null;

    if (rel[0] === 'engine' && target && target[0] !== 'engine') {
      err(file, `engine must not import "${spec}" (engine is game-agnostic)`);
    }
    if (rel[0] === 'games' && rel.length > 2 && target) {
      const ownGame = target[0] === 'games' && target[1] === rel[1];
      const engineRoot = target[0] === 'engine' && target.length === 1;
      if (target[0] === 'engine' && !engineRoot) err(file, `deep engine import "${spec}" — import from '@/engine' (add an export to src/engine/index.ts)`);
      else if (!ownGame && !engineRoot) err(file, `game imports outside its folder: "${spec}"`);
      if (rel[2] === 'manifest.ts' && !typeOnly && !dynamic) err(file, `manifest must be light: use "import type" or dynamic import() for "${spec}"`);
    }
    if (rel[0] === 'lobby' && target && !(target[0] === 'engine' && target.length === 1) && target[0] !== 'lobby') {
      err(file, `lobby may import only '@/engine' and lobby files, not "${spec}"`);
    }
  }
}

// 3 ───────────────────────────────────────────────────────────────────────────
const gamesDir = resolve(SRC, 'games');
const games = readdirSync(gamesDir).filter(n => statSync(resolve(gamesDir, n)).isDirectory());
const registry = readFileSync(resolve(gamesDir, 'registry.ts'), 'utf8');

for (const id of games) {
  const dir = resolve(gamesDir, id);
  for (const f of REQUIRED) if (!existsSync(resolve(dir, f))) err(dir, `missing ${f}`);
  if (!registry.includes(`'./${id}/manifest'`)) err(resolve(gamesDir, 'registry.ts'), `game "${id}" is not registered`);
  const manifest = existsSync(resolve(dir, 'manifest.ts')) ? readFileSync(resolve(dir, 'manifest.ts'), 'utf8') : '';
  if (!manifest.includes(`id: '${id}'`)) err(resolve(dir, 'manifest.ts'), `manifest id must be '${id}'`);
  if (!existsSync(resolve(ROOT, 'public/games', id))) err(dir, `missing public/games/${id}/ (runtime assets)`);
  else if (!existsSync(resolve(ROOT, 'public/games', id, 'thumb.jpg'))) warn.push(`${id}: no lobby thumbnail (npm run thumbnails -- ${id})`);

  // 4 ─────────────────────────────────────────────────────────────────────────
  const cfgPath = resolve(dir, 'config.json');
  if (!existsSync(cfgPath)) continue;
  const c = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const bad = (msg) => err(cfgPath, msg);
  const ids = c.symbols.map(s => s.id);
  if (c.id !== id) bad(`id "${c.id}" must equal folder name "${id}"`);
  if (new Set(ids).size !== ids.length) bad('duplicate symbol ids');
  if (c.wild && !ids.includes(c.wild)) bad(`wild "${c.wild}" is not a symbol`);
  c.paylines.forEach((l, i) => {
    if (l.length !== c.grid.cols) bad(`payline ${i + 1} has ${l.length} entries, grid has ${c.grid.cols} reels`);
    if (l.some(r => r < 0 || r >= c.grid.rows)) bad(`payline ${i + 1} row out of range 0..${c.grid.rows - 1}`);
  });
  for (const [sym, pays] of Object.entries(c.paytable)) {
    if (!ids.includes(sym)) bad(`paytable symbol "${sym}" is not in symbols`);
    for (const n of Object.keys(pays)) if (+n > c.grid.cols || +n < 1) bad(`paytable ${sym}[${n}] impossible on ${c.grid.cols} reels`);
  }
  c.betOptions.forEach(b => { if (b % c.paylines.length) bad(`bet ${b} is not divisible by ${c.paylines.length} lines`); });
  if (c.defaultBetIndex < 0 || c.defaultBetIndex >= c.betOptions.length) bad('defaultBetIndex out of range');
  if (c.spin.scrollScreens.length < c.grid.cols) bad(`spin.scrollScreens needs ${c.grid.cols} entries`);
  if (Array.isArray(c.reels) && c.reels.length) {
    if (c.reels.length !== c.grid.cols) bad(`reels has ${c.reels.length} strips for ${c.grid.cols} reels`);
    c.reels.forEach((strip, i) => strip.forEach(s => { if (!ids.includes(s)) bad(`reel ${i + 1} has unknown symbol "${s}"`); }));
  }
}

// 5 ── content CDN mirror (public/cdn): translations + paytable templates ─────
const CDN = resolve(ROOT, 'public/cdn');
const langs = existsSync(resolve(CDN, 'i18n')) ? readdirSync(resolve(CDN, 'i18n')) : [];
if (!langs.includes('en')) err(CDN, 'missing i18n/en (English is the fallback language)');
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
for (const ns of ['common', ...games]) {
  const enFile = resolve(CDN, 'i18n/en', `${ns}.json`);
  if (!existsSync(enFile)) { err(enFile, 'missing English translations'); continue; }
  const enKeys = Object.keys(readJson(enFile));
  for (const lang of langs.filter(l => l !== 'en')) {
    const f = resolve(CDN, 'i18n', lang, `${ns}.json`);
    if (!existsSync(f)) { warn.push(`${lang}: no ${ns}.json (falls back to English)`); continue; }
    const missing = enKeys.filter(k => !(k in readJson(f)));
    if (missing.length) warn.push(`${lang}/${ns}.json: missing ${missing.join(', ')}`);
  }
}
for (const id of games) {
  const cfgPath = resolve(gamesDir, id, 'config.json');
  if (!existsSync(cfgPath)) continue;
  const c = JSON.parse(readFileSync(cfgPath, 'utf8'));
  const ids = c.symbols.map(s => s.id);
  const dir = resolve(CDN, 'paytables', id);
  if (!existsSync(resolve(dir, 'en.html'))) { err(dir, 'missing en.html paytable template'); continue; }
  for (const f of readdirSync(dir).filter(f => f.endsWith('.html'))) {
    const html = readFileSync(resolve(dir, f), 'utf8');
    for (const [, kind, sym, n] of html.matchAll(/\{\{\s*(pay|mult|symbol):([^}:]+)(?::(\d+))?\s*\}\}/g)) {
      if (!ids.includes(sym)) err(resolve(dir, f), `{{${kind}:${sym}}} — unknown symbol "${sym}"`);
      else if (n && !c.paytable[sym]?.[n]) err(resolve(dir, f), `{{${kind}:${sym}:${n}}} — symbol has no ${n}-of-a-kind pay`);
    }
  }
}

for (const w of warn) console.warn(`warn  ${w}`);
if (errors.length) {
  console.error(errors.map(e => `error ${e}`).join('\n'));
  console.error(`\n✗ check failed: ${errors.length} problem(s)`);
  process.exit(1);
}
console.log(`✓ check passed: ${tsFiles.length} files, ${games.length} games`);

/**
 * Scaffold a new game by cloning an existing one.
 *
 *   npm run new-game -- <id> [--from classic] [--title "My Game"]
 *
 * Copies src/games/<from> → src/games/<id> (without art/ sources) and
 * public/games/<from> → public/games/<id> plus its content-CDN files
 * (public/cdn/paytables, public/cdn/i18n), rewrites ids/titles, registers the
 * manifest in src/games/registry.ts and resets GAME.md. Then: edit config.json,
 * views/, math/; run `npm run check`.
 */
import { cpSync, existsSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const id = args.find((a, i) => !a.startsWith('--') && !args[i - 1]?.startsWith('--'));
const from = opt('from', 'classic');
const title = opt('title', id && id[0].toUpperCase() + id.slice(1));

if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
  console.error('usage: npm run new-game -- <id> [--from classic] [--title "Title"]   (id: lowercase, a-z0-9-)');
  process.exit(1);
}
const src = resolve(ROOT, 'src/games', from);
const dst = resolve(ROOT, 'src/games', id);
if (!existsSync(src)) throw new Error(`no such game: ${from}`);
if (existsSync(dst)) throw new Error(`already exists: src/games/${id}`);

cpSync(src, dst, { recursive: true, filter: (p) => !p.includes(`${from}/art`) });
const pubSrc = resolve(ROOT, 'public/games', from);
if (existsSync(pubSrc)) cpSync(pubSrc, resolve(ROOT, 'public/games', id), { recursive: true });
rmSync(resolve(ROOT, 'public/games', id, 'thumb.jpg'), { force: true });

// Content CDN mirror: paytable templates + per-game translations
const cdn = resolve(ROOT, 'public/cdn');
if (existsSync(resolve(cdn, 'paytables', from))) cpSync(resolve(cdn, 'paytables', from), resolve(cdn, 'paytables', id), { recursive: true });
for (const lang of existsSync(resolve(cdn, 'i18n')) ? readdirSync(resolve(cdn, 'i18n')) : []) {
  const f = resolve(cdn, 'i18n', lang, `${from}.json`);
  if (!existsSync(f)) continue;
  const dict = JSON.parse(readFileSync(f, 'utf8'));
  dict['game.title'] = title;
  writeFileSync(resolve(cdn, 'i18n', lang, `${id}.json`), JSON.stringify(dict, null, 2) + '\n');
  const common = resolve(cdn, 'i18n', lang, 'common.json');
  if (existsSync(common)) {
    const c = JSON.parse(readFileSync(common, 'utf8'));
    c[`game.${id}.title`] = title;
    c[`game.${id}.subtitle`] = c[`game.${from}.subtitle`] ?? '';
    writeFileSync(common, JSON.stringify(c, null, 2) + '\n');
  }
}

const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));
edit(resolve(dst, 'config.json'), s => {
  const c = JSON.parse(s);
  return s.replace(`"id": "${c.id}"`, `"id": "${id}"`).replace(`"title": "${c.title}"`, `"title": "${title}"`);
});
edit(resolve(dst, 'manifest.ts'), s => s
  .replace(/id: '[^']*'/, `id: '${id}'`)
  .replace(/title: '[^']*'/, `title: '${title}'`)
  .replace(/thumbnail: '[^']*'/, `thumbnail: 'games/${id}/thumb.jpg'`));
writeFileSync(resolve(dst, 'GAME.md'), `# ${title} (\`${id}\`)\n\nCloned from \`${from}\`. Describe the design, math and asset pipeline here (see src/games/${from}/GAME.md for the format).\n`);

const camel = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
edit(resolve(ROOT, 'src/games/registry.ts'), s => s
  .replace('// @new-game-import', `import { manifest as ${camel} } from './${id}/manifest';\n// @new-game-import`)
  .replace('  // @new-game-entry', `  ${camel},\n  // @new-game-entry`));

console.log(`✓ created src/games/${id} (from ${from}) and registered it.
Next: edit config.json / views / math, then npm run check, npm run dev → ?game=${id}, npm run thumbnails -- ${id}`);

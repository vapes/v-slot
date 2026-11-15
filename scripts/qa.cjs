/**
 * Browser smoke test for every game (Playwright, Chromium preinstalled).
 *
 *   npm run qa                 all games, en + ru
 *   npm run qa -- dragon       one game
 *
 * Starts its own Vite dev server, then per game and language: idle screen,
 * one spin, paytable, forced anticipation, forced feature (if the game has
 * one), feature buy (games with config.buyFeature), plus the lobby. Waits on real game events via window.__vslot
 * (engine/core/qaHooks.ts). Screenshots → qa-shots/. Exits 1 on any console
 * error / page error / missing event.
 */
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const { readdirSync, mkdirSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const PORT = 3123;
const BASE = `http://localhost:${PORT}/v-slot/`;
const OUT = resolve(ROOT, 'qa-shots');
const LANGS = ['en', 'ru'];

const games = readdirSync(resolve(ROOT, 'src/games'), { withFileTypes: true })
  .filter(d => d.isDirectory() && existsSync(resolve(ROOT, 'src/games', d.name, 'config.json')))
  .map(d => d.name)
  .filter(id => process.argv.length <= 2 || process.argv.slice(2).includes(id));

function startServer() {
  return new Promise((ok, fail) => {
    // run Vite directly (no npx wrapper) in its own process group so it can be killed reliably
    const bin = resolve(ROOT, 'node_modules/.bin/vite');
    const vite = spawn(bin, ['--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const timer = setTimeout(() => fail(new Error('vite did not start')), 30000);
    vite.stdout.on('data', d => { if (String(d).includes('Local')) { clearTimeout(timer); ok(vite); } });
    vite.on('exit', code => fail(new Error(`vite exited ${code}`)));
  });
}

function stopServer(vite) {
  try { process.kill(-vite.pid, 'SIGTERM'); } catch { /* already gone */ }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const vite = await startServer();
  process.on('exit', () => stopServer(vite));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
  const problems = [];
  let where = '';
  page.on('pageerror', e => problems.push(`${where}: page error ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') problems.push(`${where}: console ${m.text()}`); });

  const shot = (name) => page.screenshot({ path: resolve(OUT, `${name}.png`) });
  const waitEvent = async (name, since, timeout = 30000) => {
    try {
      await page.waitForFunction(([n, t]) => window.__vslot?.events.some(e => e.name === n && e.at > t), [name, since], { timeout });
    } catch {
      problems.push(`${where}: no "${name}" event within ${timeout} ms`);
    }
  };
  const now = () => page.evaluate(() => performance.now());
  const open = async (query) => {
    await page.goto(`${BASE}?${query}`);
    await page.waitForFunction(() => window.__vslot && !window.__vslot.state().spinning, null, { timeout: 30000 });
    await page.waitForTimeout(800);
  };

  where = 'lobby';
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  await shot('lobby');

  for (const id of games) {
    for (const lang of LANGS) {
      where = `${id}/${lang}`;
      await open(`game=${id}&lang=${lang}&seed=1`);
      await shot(`${id}-${lang}-idle`);

      let t = await now();
      await page.evaluate(() => window.__vslot.spin());
      await waitEvent('reelsStopped', t);
      await page.waitForTimeout(600);
      await shot(`${id}-${lang}-spin`);

      await page.evaluate(() => window.__vslot.openPaytable());
      await page.waitForTimeout(1200);
      await shot(`${id}-${lang}-paytable`);
      await page.evaluate(() => window.__vslot.closePaytable());
    }

    where = `${id}/anticipation`;
    await open(`game=${id}&lang=en&force=anticipation`);
    let t = await now();
    await page.evaluate(() => window.__vslot.spin());
    await waitEvent('anticipationStart', t);
    await shot(`${id}-anticipation`);
    await waitEvent('reelsStopped', t);

    where = `${id}/feature`;
    await open(`game=${id}&lang=en&force=feature&seed=2`);
    t = await now();
    await page.evaluate(() => window.__vslot.spin());
    await waitEvent('reelsStopped', t);
    const hasFeature = await page.waitForFunction(
      (since) => window.__vslot.events.some(e => e.name === 'featureStart' && e.at > since), t, { timeout: 4000 },
    ).then(() => true, () => false);
    if (hasFeature) {
      await page.waitForTimeout(3500);
      await shot(`${id}-feature`);
      await waitEvent('featureEnd', t, 90000);
    }

    // feature buy (games with config.buyFeature): stake > bet, the feature always starts
    where = `${id}/buy`;
    await open(`game=${id}&lang=en&seed=3`);
    const before = await page.evaluate(() => window.__vslot.state());
    t = await now();
    await page.evaluate(() => window.__vslot.buyFeature());
    const bought = await page.waitForFunction(
      (since) => window.__vslot.events.some(e => e.name === 'spinStart' && e.at > since), t, { timeout: 3000 },
    ).then(() => true, () => false);
    if (bought) {
      const after = await page.evaluate(() => window.__vslot.state());
      if (before.balance - after.balance <= before.totalBet) problems.push(`${where}: buy took only ${before.balance - after.balance}`);
      await waitEvent('featureStart', t, 20000);
      await waitEvent('featureEnd', t, 90000);
    }
    console.log(`${id}: ok${hasFeature ? ' (feature played)' : ' (no feature in this game)'}${bought ? ', feature buy ok' : ''}`);
  }

  await browser.close();
  console.log(`screenshots: ${OUT}`);
  if (problems.length) {
    console.error(problems.map(p => `✗ ${p}`).join('\n'));
    process.exit(1);
  }
  console.log('✓ qa passed');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });

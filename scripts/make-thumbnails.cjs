/**
 * Lobby thumbnails: screenshots every game and writes
 * public/games/<id>/thumb.jpg (cover image of the lobby card).
 *
 * Needs a running dev server and Playwright (preinstalled in cloud sessions):
 *   npm run dev &   then   npm run thumbnails [-- <game-id> ...]
 * Crop band: config.thumbnailY (game px) if set, else centred on the reels.
 */
const { chromium } = require('playwright');
const { readdirSync, readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const URL = process.env.SLOT_URL || 'http://localhost:3000/v-slot/';
const ASPECT = 1.9; // lobby card thumbnail width / height

(async () => {
  const all = readdirSync(resolve(ROOT, 'src/games'), { withFileTypes: true })
    .filter(d => d.isDirectory() && existsSync(resolve(ROOT, 'src/games', d.name, 'config.json')))
    .map(d => d.name);
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;

  const browser = await chromium.launch();
  for (const id of ids) {
    const cfg = JSON.parse(readFileSync(resolve(ROOT, 'src/games', id, 'config.json'), 'utf8'));
    const { width: W, height: H } = cfg.canvas;
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    await page.goto(`${URL}?game=${id}`);
    await page.waitForTimeout(2500);
    const bandH = W / ASPECT;
    const reelMid = cfg.reelOffsetY + (cfg.grid.rows * (cfg.symbol.height + cfg.symbol.gap)) / 2;
    const y = Math.max(0, Math.min(H - bandH, cfg.thumbnailY ?? reelMid - bandH / 2));
    const out = resolve(ROOT, 'public/games', id, 'thumb.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 85, clip: { x: 0, y, width: W, height: bandH } });
    console.log(`${id}: ${out}`);
    await page.close();
  }
  await browser.close();
})();

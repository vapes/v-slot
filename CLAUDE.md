# CLAUDE.md

Guidance for Claude Code and other agents working in this repository.

V-Slot is a multi-game slot platform: a shared **engine** (reels, spin pipeline, line math, celebrations, HTML paytable overlay, i18n) plus self-contained **games** in `src/games/<id>/`, and a **lobby** that launches them. PixiJS v7.3.3, TypeScript 5.3 strict, Vite 5. Path alias `@/*` → `src/*`. Portrait mobile only.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server, http://localhost:3000/v-slot/ (lobby), `?game=<id>` opens a game |
| `npm run check` | **Run before every commit.** `tsc --noEmit` (src + tests) + `scripts/check.mjs` (file size, import boundaries, game layout, registry, config sanity, CDN content, no hardcoded UI text, no `Math.random` in math) |
| `npm test` | Unit tests (vitest, `tests/`): line evaluation, anticipation, RNG, money, i18n, paytable template, pipeline, events, wallet, dragon + classic math invariants. **Run before every commit.** |
| `npm run qa [-- <id>]` | Browser smoke test (Playwright): lobby + every game in en/ru — spin, paytable, forced anticipation, forced feature; waits on real game events; screenshots → `qa-shots/`; fails on console errors. Run after UI/engine changes (~2–3 min). |
| `npm run dev` + `?lang=ru` | Any page in another language (default: browser language, fallback `en`) |
| `npm run build` | tsc + Vite bundle → `dist/` (GitHub Pages deploys `main`) |
| `npm run new-game -- <id> [--from classic] [--title "T"]` | Scaffold + register a new game by cloning one |
| `npm run thumbnails [-- <id>]` | Lobby card images → `public/games/<id>/thumb.jpg` (needs dev server + Playwright) |
| `npm run classic:screens` | Regenerate classic `screens.bin` after classic math changes |
| `npm run classic:slice` | Re-slice classic art from `src/games/classic/art/source.jpg` (Pillow + numpy) |
| `npm run dragon:reels` | Rebuild dragon base + nest strips for both profiles into `strips.json`; exact base-game RTP per profile |
| `npm run dragon:sim [-- real\|demo spins features]` | Monte-Carlo of the full dragon math incl. Dragon's Nest respins (real TS math via tsx) + exact trigger rate |
| `npm run dragon:slice` | Re-slice dragon art from `src/games/dragon/art/source.png` (Pillow + numpy) |

Verification: `npm run check` + `npm test` always; `npm run qa` for anything visual. URL switches (see `engine/core/devFlags.ts`): `?force=feature,anticipation` and `?debug=pipeline` in dev builds, `?seed=<n>` for a reproducible math RNG (dev + demo), `?lang=`, `?mode=real`. In dev builds `window.__vslot` (`engine/core/qaHooks.ts`) exposes `spin()`, `openPaytable()`, `state()` and the event log for Playwright / agents.

## Hard Rules

1. **Paytables and translations come from the content CDN, not the bundle.** Paytable = HTML template `paytables/<gameId>/<lang>.html`, shown by the engine `HtmlPaytable` in a sandboxed iframe over the canvas (no scripts). User-facing text = `t('key')` with keys in `i18n/<lang>/{common,<gameId>}.json`; never hardcode UI strings in code (`npm run check` rejects `new Text('literal')`; engine fallbacks live in `ENGINE_STRINGS`). The buttons that open the paytable stay Pixi; all other game UI is Pixi too. Text baked into skin art must be erased by the game's slicer (`LABEL_BOXES`, inpainted) and drawn back as translated Text: panel captions via `skin.label()`, button captions via `skin.labelButton()` / `SpriteButton.setLabel()` (auto-shrinks with `fitText`). Only logos/brand names stay baked.
2. **Files ≤ 300 lines.** Split into focused modules by responsibility instead of compressing code (enforced by `npm run check`).
3. **Import boundaries** (enforced):
   - `src/engine/**` never imports from games or lobby.
   - `src/games/<id>/**` imports only `pixi.js`, `'@/engine'` (the barrel), `'@/engine/math'` (pure, Node-safe subset for math + tools) and files inside its own folder — never other deep paths. Need something new from the engine? Export it in `src/engine/index.ts` (or `math.ts` if it is pure).
   - `manifest.ts` stays light: `import type` + dynamic `import('./index')` only (keeps games code-split).
4. **Config-driven.** Game design numbers live in `src/games/<id>/config.json`; no magic numbers for math/timing in code.
5. **Money is integer minor units** everywhere (`currency.decimals` says how many). Format only via `formatMoney(cfg, value)`.
6. Changing math inputs requires regenerating derived data (`classic:screens`, `dragon:reels` → `strips.json`, never edited by hand) and updating `rtp` in the config and `GAME.md`.
7. **Play modes:** the platform runs in `demo` unless `?mode=real`. A game may ship a separate demo math profile (dragon: `config.json → demo`, RTP ≈421%); the paytable shows the active profile's RTP. Real-mode math must stay ≈96%.
8. **Randomness & numbers:** game outcomes use `random()` from `@/engine/math` (seedable), never `Math.random` (visual effects may). Engine fallback timings / feel values live only in `engine/config/defaults.ts` and are resolved into `cfg.timing`, `cfg.featureTiming`, `cfg.tease`.
9. **Observe, don't couple:** audio, analytics, tutorials and tests subscribe to `gameEvents` (`engine/core/GameEvents.ts`) instead of hooking into engine classes.

## Layout

```
src/
├── index.ts                 Router: ?game=<id> → SlotGame, else Lobby (switching = page reload)
├── engine/                  Game-agnostic core. Public API = engine/index.ts (+ engine/math.ts: pure, no Pixi)
│   ├── contracts.ts         ★ GameDefinition, GameView, Hud, SpinControl, SymbolRenderer, MathModel, GameManifest
│   ├── config/SlotConfig.ts ★ RawSlotConfig (JSON schema as a TS type) + resolveConfig (geometry + defaults)
│   ├── config/defaults.ts   ★ every engine fallback timing / feel value (TIMING_, FEATURE_TIMING_, ANTICIPATION_DEFAULTS)
│   ├── core/SlotGame.ts     Composition root: builds and wires every part below to the game's view + math
│   ├── core/SpinLoop.ts     Single spin, hold-to-turbo loop, autoplay; autoplay / quick-spin toggles
│   ├── core/Wallet.ts       Balance + bet selection (minor units)
│   ├── core/WinCycle.ts     Line-by-line win display after a spin
│   ├── core/GameEvents.ts   ★ typed event bus `gameEvents` (spinStart, reelLand, symbolLanding, reelsStopped, win, feature*, anticipation*, balance…)
│   ├── core/devFlags.ts     URL switches: ?force=, ?debug=, ?seed=
│   ├── core/qaHooks.ts      window.__vslot in dev builds (QA / agents)
│   ├── core/GameInput.ts    Spin pointer (hit test in game px) + spacebar; tracks buttonHeld
│   ├── core/fitCanvas.ts    Letterboxed canvas scaling, goToLobby()
│   ├── core/wakeLock.ts     Screen Wake Lock while a game is open (re-acquired on tab return / first tap)
│   ├── core/playMode.ts     detectPlayMode(): `demo` (default, no money backend) or `real` (`?mode=real`)
│   ├── pipeline/            SpinPipeline (pre → server → post middleware) + buildSpinPipeline (all stages)
│   ├── reels/               Reel (state machine, symbol recycling, boost), ReelController (spin control, layers),
│   │                        WinPresenter (promote / dim / pulse winners)
│   │                        + AnticipationDirector (extends/boosts teasing reels, drives the FX)
│   ├── fx/                  AnticipationFX (per-game style): flame = flameShader (GLSL Mesh) + Sparks;
│   │                        marquee = MarqueeColumn (chasing casino bulbs); dim veil
│   ├── symbols/             SlotSymbol (pulse + gold frame around a game SymbolView) + pool,
│   │                        LandingFX (symbol landing animation: pop, light sweeps, flash, hue shimmer)
│   ├── math/                evaluateLines (wild-aware), Paytable helpers, ReelStripMath, computeAnticipation, rng (seedable), types
│   ├── feature/             RespinPlayer (plays a FeatureRound), StickyLayer (sticky cells over reels), FeatureMeter,
│   │                        RespinFlyFX (added respins fly from a cell into the counter)
│   ├── content/cdn.ts       Content CDN base (VITE_CONTENT_CDN or ./cdn/), i18n + paytable URLs
│   ├── i18n/I18n.ts         i18n / t(): CDN translations, lang → en → fallback, detectLanguage()
│   ├── ui/                  WinCelebration, HtmlPaytable + paytableTemplate ({{…}} placeholders), HomeButton, BuyFeatureDialog,
│   │                        SpriteButton / SpriteSpinButton, skin (createSkin: anchors, scale, translated captions)
│   ├── audio/soundSettings.ts  Global sound on/off (localStorage); future audio must respect `muted` / `onChange`
│   └── utils/               Money (formatMoney, assetUrl), Random (blur symbol picker)
├── games/
│   ├── registry.ts          Lobby list (scaffold inserts at @new-game markers)
│   ├── classic/             5×3 777 Casino Classic, sliced fruit-machine skin, precomputed screens.bin math
│   └── dragon/              4×5 Dragon Hoard, sliced sprite skin, reel-strip math
│       ├── GAME.md          ★ read first when touching a game
│       ├── config.json      engine config + game-specific keys
│       ├── config.ts        typed import (`const raw: RawSlotConfig = json` validates it) + game helpers
│       ├── index.ts         default export GameDefinition
│       ├── manifest.ts      lobby entry (id, title, subtitle, thumbnail, accent, lazy load)
│       ├── math/ views/     MathModel / GameView / SymbolRenderer implementations
│       ├── tools/           offline generators (math tables, art slicing)
│       └── art/             source art (not shipped)
└── lobby/                   Lobby + GameCard (Pixi)
public/games/<id>/           Runtime assets per game (thumb.jpg, screens.bin, sprites…)
public/cdn/                  Local mirror of the content CDN (deploy it to the CDN as-is):
                             i18n/<lang>/common.json, i18n/<lang>/<gameId>.json, paytables/<gameId>/<lang>.html
scripts/                     check.mjs, new-game.mjs, make-thumbnails.cjs, qa.cjs, skin_tools.py (shared slicer helpers)
tests/                       vitest unit tests (helpers.ts builds a tiny test config)
```

## Engine ↔ game contract (src/engine/contracts.ts)

A game's `index.ts` default-exports:

```ts
const game: GameDefinition = {
  config,                                  // resolveConfig(raw)
  loadAssets?: () => Promise<void>,        // textures etc., before SlotGame is built
  createMath: () => MathModel,             // spin(): SpinResult; optional async load()
  createSymbolRenderer: () => SymbolRenderer, // createView(id) → { display, setSymbol(id) }
  createView: (actions: GameActions) => GameView,
};
```

`GameView` supplies `spinButton` (SpinControl with `hitTest`), `hud` (Hud), `mountBelowReels` / `mountAboveReels`, `setBetControls`, optional `setAutoplay` / `setQuickSpin` / `update`. Views call back through `GameActions` (`changeBet`, `openPaytable`, `togglePaytable`, `toggleAutoplay`, `toggleQuickSpin`, `buyFeature`). The engine adds reels, celebration, the HTML paytable overlay, the home button (top-left) and the sound toggle (top-right) itself — games only set their positions in config and must keep those corners free.

## Recipes

**New game:** `npm run new-game -- <id> --from classic` → edit `config.json` (id/title set for you) → replace `views/` and `math/` as needed (reuse `ReelStripMath` for strip math) → `npm run check` → `npm run dev`, open `?game=<id>` → `npm run thumbnails -- <id>` → fill `GAME.md`.

**Change a game:** read its `GAME.md`; stay inside its folder + `public/games/<id>/`.

**Skin from a mockup image:** put it in `art/`, copy a `tools/slice-skin.py` (it imports `scripts/skin_tools.py`: `erase_box`, `inpaint`), measure the reel grid and button centres in source pixels, store anchors in `config.json → skin.ui`, erase baked texts, then in `config.ts` `export const skin = createSkin(config.canvas.width, raw.skin)` and build buttons with the engine `SpriteButton` / `SpriteSpinButton` at `skin.scale`; captions via `skin.label()` / `skin.labelButton()` (see dragon/classic `GAME.md`).

**Paytable / translations:** edit `public/cdn/paytables/<id>/<lang>.html` and `public/cdn/i18n/<lang>/*.json` (later: the real CDN). Template placeholders: `{{title}} {{rtp}} {{lines}} {{bet}} {{lineBet}} {{pay:ID:N}} {{mult:ID:N}} {{symbol:ID}} {{asset:PATH}} {{t:KEY}} {{paylines}} {{buyCost}}` (see `engine/ui/paytableTemplate.ts`). New language = new `i18n/<lang>/` folder + `<lang>.html` per game; missing files fall back to English. `npm run check` validates English presence, key parity and template symbols. Production CDN: build with `VITE_CONTENT_CDN=https://…/` (CDN must allow CORS).

**Change the engine:** keep it game-agnostic; extend `contracts.ts` / `RawSlotConfig` with optional members so existing games keep compiling; verify every game in the browser.

**Bonus features (sticky respins):** the game's MathModel decides the whole round and returns it as `SpinResult.feature` (`FeatureRound`: trigger, initialSticky, steps with grid / newSticky / respinsLeft / line wins, collect, fullBonus, totalWin; values are × line bet). The engine plays it back in the pipeline stage `playFeature` (`RespinPlayer`): trigger pulse → intro window (`feature.title` header, `feature.intro` "CONGRATULATIONS!", `feature.won` "YOU WON {n} RESPINS") → optional initial sticky cells (values drawn by the game's `SymbolView.setValue`; value 0 = no label) → respins with a meter above the reels (respins added by a new sticky cell fly from it into the counter — `RespinFlyFX` comet + sparks — and the number ticks up on landing, `featureTiming.flyMs`) → cells with a value pay one by one → optional full-grid prize → "TOTAL WIN" window (`feature.total`) → base grid restored. Windows (`ui/FeatureBanner`) close by timer or a tap. Views may implement `GameView.setFeatureMode(on)` for mood changes. Timings: `config.feature`. Texts: `feature.*` i18n keys (engine fallbacks in `ENGINE_STRINGS`); a numeric `{n}` param picks plural forms `<key>.one|few|many|other` when present. Keep feature math pure and simulate it (`tools/simulate.ts`). Dev only: `?force=feature` (dragon) makes every spin trigger.

**Feature buy:** `config.buyFeature = { cost }` (× total bet; dragon picks the active profile's in `config.ts`). Views wire a button to `GameActions.buyFeature()` and enable it from `BetControlsState.canBuy`; the engine shows `ui/BuyFeatureDialog` (feature name, `buy.title`, price, `buy.confirm` / `buy.cancel`), then runs one spin with `ctx.buy` / `ctx.stake` = price (validate + deduct use the stake) and calls `math.spin({ buyFeature: true })` — the MathModel must return a result whose feature triggers. `spinStart` carries `buy` / `stake`; `{{buyCost}}` shows the price in paytables; `__vslot.buyFeature()` buys without the dialog (QA). Price it from the simulator (dragon: `npm run dragon:sim` prints "Feature buy … cost for 96%").

**Landing animations:** a symbol in `config.symbols[]` may declare `landing` (normal stop) and/or `turboLanding` (turbo / quick spins): `{ ms, sweeps, scale, hue, flash, color }`, missing fields from `LANDING_DEFAULTS` (`engine/config/defaults.ts`). When a reel stops, every visible cell whose symbol has the animation for that kind of stop plays it (`SlotSymbol.playLanding` → `LandingFX`: pop, diagonal light bands, flash, `hue` degrees of colour rotation = iridescent shimmer) and `gameEvents` emits `symbolLanding` (hook sounds there). No entry → no animation (a symbol with only `landing` stays still in turbo). Resolved via `cfg.landing(id, turbo)`.

**Anticipation (reel tease):** `config.anticipation` (startReel, minCategory, scatter / scatters[] / scatterTrigger, extraMs, speedBoost, colors, style `flame`|`marquee`, veil, sparks). `computeAnticipation(cfg, grid)` (pure) marks reel i when the reels left of it are one symbol short of the feature (trigger − 1 scatters) or of a `minCategory`+ line win (default HUGE ≈ MEGA). Decided from the final grid, so near misses tease too. Never in turbo / TURBO toggle; dropped if SPIN is held when the tease would start; slam-stop cancels it. The teasing reel gets extra distance + a speed boost, later reels wait; FX style per game: `flame` (GLSL flame border + rising sparks, default) or `marquee` (thin frame with chasing bulbs — light, for classic machines); plus a dim veil (`veil`). Dev only: `?force=anticipation`. `npm run dragon:sim` reports how often it fires.

**Tests:** pure logic gets a vitest test in `tests/` (engine → `tests/engine`, game math → `tests/games/<id>.test.ts`, seed with `createRng`). New game math must at least test its invariants (symbols per reel set, totals add up, reproducible with a seed).

**Sound / analytics:** subscribe to `gameEvents` and respect `soundSettings.muted`; nothing in the engine needs to change.

**New pipeline logic:** inject a `PipelineStage` via `pipeline.insertBefore/After()` in `engine/pipeline/buildSpinPipeline.ts`.

## Spin flow

`SpinPipeline.execute(ctx)`; `SpinContext = { balance, lineBet, totalBet, turbo, quick, buy, stake, result, winAmount, cancelled, meta }` (money in minor units).

1. **pre** — validate balance (≥ stake) → stop previous wins → deduct stake (bet, or the feature price) → stop-mode/disable bets → status "Good luck!"
2. **server** — `math.spin({ buyFeature: ctx.buy })` → `ctx.result`
3. **post** — reel animation (quick/turbo = fast; otherwise with anticipation from `computeAnticipation`) → resolve turbo flag → play feature (if `result.feature`) → wins = (base + feature totalWin) × lineBet → credit → HUD (win line, or "Place your bets" when nothing won) → win highlight + win cycle → celebration (thresholds `config.celebration`) → turbo delay → refresh balance → re-enable controls

## Rendering order

```
Stage
├── GameView.mountBelowReels   (e.g. dragon background sprite)
├── ReelController.container   at (reelOffsetX, reelOffsetY)
│   ├── optional reelStyle.background panel
│   ├── reelLayer (masked) → Reel[i].symbolContainer
│   ├── optional reelStyle.separators grid
│   ├── overlay (feature sticky cells)
│   ├── AnticipationFX (veil, flame meshes, sparks)
│   └── winLayer (unmasked; winning symbols promoted here)
├── GameView.mountAboveReels   (buttons, HUD)
├── HomeButton                 (config.homeButton — top-left corner in every game)
├── SoundButton                (config.soundButton — top-right corner; toggles soundSettings.muted)
├── FeatureBanner / FeatureMeter (feature intro/outro, respins + running total)
├── WinCelebration
└── (DOM) HtmlPaytable         iframe overlay placed over the canvas rect, hidden by default
```

## Key patterns

- **Symbol recycling:** symbols leaving the bottom jump to the top with a new id: blur zone = random ids at `blurAlpha`, target zone = result ids at full alpha (placed in reverse so they land in the right rows after `snapToTarget()`).
- **Win z-order:** winning symbols move from their reel container to `winLayer` (above the mask) and back before the next spin.
- **Win cycle:** all wins for `winAllDelay`, then each line every `winLineInterval` with a fresh pulse.
- **Turbo:** holding SPIN keeps `buttonHeld`; spins loop with abbreviated win display. TURBO toggle (`ctx.quick`) = fast reels, normal wins. AUTO = autoplay loop; SPIN or AUTO stops it.
- **Status line (all games):** engine-driven via `Hud.setStatus` — `status.idle` ("Place your bets") while idle (after load, after a losing spin, after a turbo loop), `status.spin` ("Good luck!") from the SPIN press until the result. Texts are i18n keys in `common.json`; views only render them.
- **Two-colour text:** Pixi v7 has no rich text; use two `Text` objects positioned from measured widths.
- `BlurFilter` darkens even at blur=0 — use alpha for spin blur.

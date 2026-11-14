# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Vite, port 3000)
- **Build:** `npm run build` (TypeScript compile + Vite bundle → `dist/`)
- **Preview:** `npm run preview`
- **Type check:** `npx tsc --noEmit`
- **Rebuild reel strips + exact math report:** `node scripts/build-reels.mjs` (`--report` to only report)
- **Re-slice skin art:** `python3 scripts/slice-skin.py` (Pillow + numpy; source `art/dragon-skin-source.png`)

No test framework is configured.

## Tech Stack

PixiJS v7.3.3, TypeScript 5.3 (strict), Vite 5, ES2020 target. Path alias `@/*` → `src/*`.

## Hard Rules

- **PaytableScreen and InfoButton MUST always be implemented as PixiJS objects** (Container, Graphics, Text). Never use HTML elements (`<div>`, `<button>`, `document.createElement`, etc.) for the paytable screen or its toggle button. Both must live entirely on the Pixi stage.
- **Keep files under 250 lines.** If a file grows beyond that, split it into focused modules.

## Architecture

4-reel, 5-row, 20-line "Dragon" slot rendered on HTML5 Canvas via PixiJS. Portrait mobile only: canvas 540×900, scaled to fit the window.

### Skin

All art is sliced from one mockup (`art/dragon-skin-source.png`, 971×1619) by `scripts/slice-skin.py` into `public/assets/`: `bg.jpg` (baked value texts erased, reel window darkened), `symbols/<id>.jpg` (opaque 242×180 tiles), `ui/<name>.png` (round buttons with alpha). UI anchors live in `gameConfig.skin.ui` in **source-image pixels**; `uiAnchor()` / `SKIN_SCALE` convert them to game pixels, so sprites land exactly over their baked spots. Sound/fullscreen icons are baked into the background (fullscreen has an invisible hit zone).

### Math

Live reel-strip RNG (`SlotMath`): each reel stops uniformly on its strip from `gameConfig.reels`. Strips are generated from `reelComposition` (+ `reelStacks`, WILD stacked ×3, reels 2–4 only) by `scripts/build-reels.mjs`, which also enumerates every stop combination: RTP 96.20%, hit rate 33.2%, max 239.85× bet. Paytable values are multiples of the line bet (total bet / 20). WILD substitutes for all symbols and pays nothing itself. Money is integer cents everywhere (`utils/Money.formatMoney`).

### Module Map

- **`core/Game.ts`** — Main orchestrator. Creates Pixi Application, instantiates all subsystems, wires `GameInput`, builds the spin pipeline, manages balance/bet (cents), autoplay and quick-spin (TURBO toggle) state. Owns `startWinCycle` / `stopWinCycle`.
- **`core/Config.ts`** — All game constants derived from `gameConfig.json` (dimensions, skin scale/anchors, symbol IDs, reel strips, paylines).
- **`core/SkinAssets.ts`** — Loads the sliced skin textures (`loadSkin()` runs before `new Game()` in `index.ts`).
- **`core/GameInput.ts`** — Centralises all input: pointer events on the spin button (with canvas-scale correction), spacebar, and bet button callbacks. Tracks `buttonHeld` for turbo detection; ignores input while the paytable is open.
- **`gameConfig.json`** — Single source of truth: canvas, skin anchors, grid, bets, spin timing, RTP, symbols, paytable, paylines, reel composition and generated reel strips.
- **`pipeline/SpinPipeline.ts`** — Generic async middleware pipeline with three ordered phases: `pre → server → post`. Supports `add`, `insertBefore`, `insertAfter`, `remove`, `replace`. Cancels remaining stages if `ctx.cancelled` is set.
- **`pipeline/buildSpinPipeline.ts`** — Wires concrete `PipelineStage` implementations into the pipeline. All spin flow logic lives here: balance validation, deduction, reel animation, win calculation, credit, UI updates, celebration, turbo handling.
- **`reels/ReelController.ts`** — Orchestrates 5 reels with staggered start/stop. Manages two display layers: masked `reelLayer` (clipped reel area) and unmasked `winLayer` (win symbols render above mask). Promotes/demotes symbols between layers for win animations. `showWins()` highlights all winning positions; `showWinLine()` highlights a single payline (used during win cycle); `showWinsTurbo()` / `clearWins()` for turbo mode.
- **`reels/Reel.ts`** — Single reel column. State machine: `Idle → BounceUp → SpinUp → Spinning → BounceDown → Settling → Idle`. Distance-based spinning with symbol recycling — symbols scrolling off top reposition at bottom. Two-zone recycling: blur zone (random symbols at reduced alpha) then target zone (final symbols at full alpha).
- **`math/SlotMath.ts`** — Picks random stops on the reel strips, evaluates all 20 paylines left-to-right with WILD substitution (`SlotMath.evaluate`).
- **`math/Paytable.ts`** — Payout multipliers for 3/4 symbol matches per symbol type.
- **`symbols/Symbol.ts`** — `SlotSymbol` extends Pixi Container with a symbol `Sprite`. Inner `content` container isolates win animation (scale pulse + gold frame) from positional transforms during spinning. `startWinAnimation(cycleMs)` drives exactly one sine pulse per `cycleMs` ms.
- **`symbols/SymbolFactory.ts`** — Object pool for `SlotSymbol` instances to avoid GC during spins.
- **`ui/SpriteButton.ts`** — Round sprite button (skin slice) positioned by centre: `enabled` (grey tint), `active` (pulsing glow for AUTO/TURBO), `onClick()`.
- **`ui/SpinButton.ts`** — Dragon-wing spin/stop button (extends `SpriteButton`). Exposes `isStopMode`, `setStopMode()`, `centerX/centerY/radius` for `GameInput` hit testing.
- **`ui/ControlPanel.ts`** — Creates and places all skin buttons: spin, bet −/+, coins (cycle bet), AUTO (autoplay), TURBO (quick spins), trophy (paytable), menu (`InfoButton`), fullscreen hit zone.
- **`ui/GameHUD.ts`** — Texts over the baked panels: BALANCE / LAST WIN / BET values and a message pill under the reels (win amount, line info).
- **`ui/PaytableScreen.ts`** — Pixi-based scrollable paytable overlay (drag + wheel); content rebuilt on `show(lineBet)` by **`ui/PaytableContent.ts`**. Also exports `InfoButton` — the Pixi menu button at top-left.
- **`ui/WinCelebration.ts`** — Big win banners (BIG/HUGE/EPIC/MAX WIN). `getWinCategory()` maps win/bet ratio to category. `play()` animates; `playStatic()` shows for fixed duration.
- **`ui/jsx.ts`** — Minimal JSX runtime (`h` factory) for building HTML DOM elements when HTML overlays are needed (not for game UI — see Hard Rules).

### Spin Flow

Every spin runs through `SpinPipeline.execute(ctx)` with a `SpinContext` carrying `{ balance, lineBet, totalBet, turbo, quick, result, winAmount, cancelled, meta }` (money in cents). Phases:

1. **pre** — validate balance → stop previous wins → deduct bet → disable controls → show UI
2. **server** — `slotMath.spin()` → `ctx.result` (reel-strip RNG)
3. **post** — reel animation → resolve turbo flag → calculate wins → credit balance → update UI → show win animations → play celebration → handle turbo delay → refresh balance → re-enable controls

To add game logic, inject a new `PipelineStage` via `pipeline.insertBefore/After()` in `buildSpinPipeline.ts`.

### Rendering Layer Order

```
Stage
├── Background sprite (bg.jpg — frame, panels, baked labels)
├── ReelController.container (positioned at REEL_OFFSET)
│   ├── reelLayer (masked to reel area)
│   │   └── Reel[0..3].symbolContainer (y-scrolled during spin)
│   ├── Reel separators (thin gold grid)
│   └── winLayer (unmasked — winning symbols promoted here)
├── ControlPanel buttons (spin, bet −/+, coins, auto, turbo, trophy, InfoButton, fullscreen zone)
├── GameHUD (balance / last win / bet values, message pill)
├── WinCelebration
└── PaytableScreen (full-canvas overlay, visible=false by default)
```

### Key Patterns

- **Symbol recycling:** During spin, symbols passing the bottom edge reposition to top with new identity. Blur zone → random IDs + reduced alpha; target zone → final result IDs + full alpha. Targets placed in reverse so they land in correct rows after `snapToTarget()`.
- **Win animation z-order:** Winning symbols are removed from their reel's `symbolContainer` and added to `winLayer` (above the mask), then demoted back before the next spin.
- **Config-driven animation:** All spin timing/easing parameters live in `gameConfig.json` under `"spin"` — no magic numbers in code.
- **Win cycle:** `startWinCycle()` first shows all winning symbols for `winAllDelay` ms, then cycles through each `WinResult` via `showWinLine()` every `winLineInterval` ms, resetting the pulse animation each time.
- **Turbo mode:** Holding the spin button sets `buttonHeld = true`. After each spin, if `buttonHeld` is still true the pipeline loops immediately without win animations (abbreviated 300 ms win delay only).
- **TURBO toggle (`ctx.quick`):** reels use the quick spin animation, wins are presented normally.
- **Autoplay:** AUTO toggles a loop in `Game.doSpin` with `autoplayWinPause` / `autoplayPause` between spins; tapping SPIN or AUTO stops it.
- **Two-color inline text:** PixiJS v7 has no rich text. Mixed-color labels use two separate `Text` objects with x positions recomputed from measured widths each update.

### PixiJS v7 Limitations

- `BlurFilter` causes darkening even at blur=0 — alpha-based approach used instead for blur symbols during spin.

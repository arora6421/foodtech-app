# M1.7 performance: before and after

All numbers from **production builds**, measured with the repeatable scripts in `scripts/`:

- `node scripts/bundle-report.mjs <label>`: shipped JS, what loads up front, and an exact per-source
  breakdown (each source group built into its own chunk, minified and gzipped in isolation).
- `node scripts/perf.mjs <label> --runs 5`: headless Chrome (puppeteer-core, the installed Chrome)
  on a phone profile: 390×844 @3x, touch, **CPU slowed ×4** (Lighthouse mobile), **slow 4G** (150 ms
  RTT, 1.6 Mbps) for the load metrics. A scripted session: load, craving → first card, 4 button
  swipes, 3 drags with release, "Decide for me" → Match reveal. Medians across runs. Raw data in
  `docs/perf/`.

To repeat on a real phone later: the same flow by hand with Chrome remote debugging; the numbers
here are the regression baseline for that.

## Results

| Metric | Before | After | Change |
|---|---|---|---|
| JS loaded up front (gzip) | 186.5 KB | **155.6 KB** | −17% (Motion's engine now lazy, 30 KB after first paint) |
| Fonts transferred | 947.8 KB (3 TTF) | **272.4 KB** (3 WOFF2) | −71% |
| First paint, slow 4G | 3.23 s | **3.04 s** | −0.2 s |
| Fonts ready, slow 4G | 8.07 s | **4.76 s** | −3.3 s |
| Tap "Show me dishes" → first card | 684 ms | 646 ms | ≈ (engine: session start, unchanged) |
| Swipe button latency p50 / p95 / worst | 128 / 360 / 360 ms | **104 / 168 / 208 ms** | worst −42% |
| Drag + fling: janky frames / worst frame | 2 / 267 ms | 2 / 133 ms | worst −50% |
| Match reveal: long tasks / worst frame | 319 / 316 ms | **164 / 200 ms** | −49% |
| Review images in production build | 9.4 MB | **0** | removed |
| Font files in the repo | ~2.7 MB (duplicated) | 1.4 MB sources + 271 KB WOFF2 | de-duplicated |

## What changed, and why

1. **Debug and review tools out of production.** The M0 engine panel, the `?debug=1` overlay and
   the image review tools are gated by `__DEBUG_TOOLS__`, a literal Vite substitutes at build time
   (true only for the dev server and `--mode review`). A constant exported from a module wasn't
   enough: Rolldown doesn't fold it across modules, so the chunks (and 9.4 MB of review images
   pulled in by `import.meta.glob`) survived.
2. **Motion split in two.** The app renders Motion's lightweight `m` components inside
   `<LazyMotion strict>`; the animation and drag engine (`domMax`) and the imperative `animate()`
   the swipe uses load in a separate chunk right after first paint (`design/motionRuntime.ts`).
3. **Fonts subset to WOFF2** (`scripts/subset-fonts.py`, fontTools): only characters that can reach
   the screen (scanned from copy, catalogue, CSS and HTML, plus Latin-1 and punctuation as a margin),
   only the variable-axis ranges the design uses (Instrument Sans' unused width axis pinned), no
   hinting. Sources kept once, in `docs/design/fonts/`.
4. **No font preload, on purpose.** Measured both ways: preloading all three faces delayed first
   paint from 3.0 s to 4.2 s (the fonts compete with the JS the app needs before it can paint at
   all) and made fonts ready no sooner (4.7 s either way). `font-display: swap` shows text at once.
5. **A forced layout on every swipe removed.** The fly-off distance read `window.innerWidth` right
   after React changed the DOM, forcing a synchronous layout of the whole page (~60 ms at ×4 CPU).
   It's now read once and on resize.
6. **Branch pre-computation split into two idle tasks** (YES, then NOPE), so a tap landing
   mid-precompute waits for one engine step, not two. Same engine calls, same results.

## Measured and deliberately not changed

- **Zod in the client: 23.4 KB gzip.** `MockCatalog` validates the whole catalogue with Zod at
  start-up, and the `domain` barrel export pulls the schemas in. The catalogue is already validated
  by tests. Removing it touches M0 catalogue/domain module structure, so it needs a product-owner
  decision. Likely saving: ~23 KB gzip up front plus the parse time at start-up.
- **Paint effects.** An A/B of the paper-grain overlays and card shadows showed no consistent effect
  on swipe latency (noise larger than any difference), so the visual design is unchanged.
- **First card (~650 ms at ×4).** Dominated by the engine starting a session (pool, first card by
  expected information gain). The engine is frozen; a future option is to start the session during
  idle time on the craving screen.

Current shipped JS by source (gzip): React + router 78.9 KB · Motion 44.3 KB (of which 30 KB lazy) ·
Zod 23.4 KB · app 12 KB · engine 11.9 KB · catalogue 11.1 KB.

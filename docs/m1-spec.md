# M1 spec: solo experience

*Draft, 2026-09-24. This plans M1 as defined in MVP_SPEC §24: the solo flow, fully polished. It covers component structure, state management and design tokens. No React code until approved. The engine (M0, closed) is used as-is. The MVP_SPEC sections referenced here remain the source of truth for behaviour.*

## 0. Scope and ground rules

- **In:** screens S1–S8 (MVP_SPEC §4), solo only. The "With friends" entry is hidden until M2. The debug panel becomes a `?debug=1` overlay.
- **The engine is a black box behind one adapter.** No component imports `src/engine/**`. Only `state/` and `services/` do, enforced by ESLint the same way M0's layers are.
- **Components are presentational.** They receive plain view models (§2.3), never `SoloState` or catalogue entities.
- **Performance budgets:**
  - A swipe commits inside the card's fling animation (engine ≈ 12–15 ms measured in-browser; budget 50 ms on a mid-range Android).
  - Next-card images are already loaded when the card appears.
  - JS ≤ 150 kB gzip for the solo flow. The M0 debug build is 119 kB including the engine.
- **Accessibility (MVP_SPEC §22) is built in from the first component**, not added in a later pass.

## 1. Routes

| Path | Screen | Guard |
|---|---|---|
| `/` | S1 Welcome | — |
| `/craving` | S2 Craving & settings | — |
| `/deck` | S3 Swipe deck (the "Tough crowd" stall screen is gone; S8 empty states render here) | no session → `/craving` |
| `/match` | S4 Match found (+ S5/S6 sheets) | no result → `/deck` or `/craving` |
| `/saved`, `/saved/:id` | S7 Saved / detail | — |

- **Sheets** (Diet, Order, Directions) are component state, not routes, so the back button doesn't dismantle a flow.
- **`?debug=1`** mounts the M0 debug panel as an overlay on any route.
- **Router:** React Router (MVP_SPEC §17).

## 2. Component structure

### 2.1 Folders

```
src/app/
  main.tsx · App.tsx              providers, router, catalogue bootstrap
  routes/                         route table + guards
  screens/                        WelcomeScreen · CravingScreen · DeckScreen · MatchScreen · SavedScreen · SavedDetailScreen
  components/
    primitives/                   Button · IconButton · Chip · ChipGroup · SegmentedControl · Sheet · VisuallyHidden
    food/                         DishCard · DishCardTypographic · DishImage · SpiceMeter · OfferingLine · TagList · AllergenDisclosure
    deck/                         SwipeDeck · SwipeCard · SwipeStamp · DeckActions · DeckTopBar · NarrowingCounter
    match/                        MatchReveal · MatchHero · ConfidenceBadge · Explanation · RunnerUpCard · AlsoAtList · MatchActions
    settings/                     SettingsRow · DietSheet · BudgetControl · FulfilmentControl
    handoff/                      OrderSheet · DirectionsSheet · PrototypeNotice
    feedback/                     EmptyState
  hooks/                          useSwipeGesture · useDeckKeyboard · useReducedMotion · useImagePrefetch · useAnnouncer · useFocusOnMount
  state/                          soloSessionStore · settingsStore · savedStore · viewModels
  services/                       engineAdapter · catalogueService · imageResolver · storage · analytics
  design/                         tokens.css · motion.ts
  copy/                           en-GB.ts
  debug/                          DebugPanel (from M0) · DebugOverlay
```

### 2.2 Key components

| Component | Responsibility | Notes |
|---|---|---|
| `SwipeDeck` | Stacks the current card over the pre-rendered next card; owns the fling animation; calls `onVerdict` | Gesture maths lives in `useSwipeGesture` |
| `SwipeCard` | Drag, tilt, commit threshold, spring-back | Commits past 30% of width or on a fling (see motion tokens); input locked during the fling |
| `DishCard` | Image, offering name, archetype, venue · price · distance, spice meter, 2–3 tags, allergen affordance | Falls back to `DishCardTypographic` when there's no image |
| `DeckActions` | NOPE / YES / That's the one | Icon + label (never colour alone); ← / → / Enter |
| `DeckTopBar` | Undo, `NarrowingCounter`, Decide for me | Counter is `aria-live="polite"` |
| `MatchReveal` | ≤ 900 ms entrance choreography | Collapses to a fade with reduced motion; never a fake loader |
| `MatchHero` | Archetype name, offering line, `ConfidenceBadge` | Heading receives focus on mount |
| `Explanation` | Headline, ≤ 3 reasons, optional "avoided" line | Renders `Explanation` from the engine verbatim; no rewording in the UI |
| `RunnerUpCard` | A compact alternative; tap to promote to hero | Promoting is UI state; the explanation regenerates for that archetype |
| `MatchActions` | Order / Directions / Save / Not quite | Primary action depends on eating context (MVP_SPEC §4 S4) |
| `OrderSheet` / `DirectionsSheet` | Prototype hand-off states | `PrototypeNotice` always visible; never opens a real address |
| `DietSheet` | Multi-select of the 5 constraints | Changing diet mid-session asks to restart (it changes the pool) |

### 2.3 View models (the only shapes components see)

```ts
interface DishCardModel {
  key: string                       // offeringId
  offeringName: string; archetypeName: string; venueName: string
  priceLabel: string                // "£13.95"
  distanceLabel: string             // "0.6 mi · 12 min walk" | "0.6 mi · ~20 min delivery"
  spiceLevel: 0 | 1 | 2 | 3 | 4
  tags: string[]                    // ≤ 3, from the vocabulary
  image: { src?: string; alt: string; dominantColour: string }
  allergens?: string[]              // only if declared
  a11yLabel: string                 // full sentence for screen readers (MVP_SPEC §22)
}

interface MatchModel {
  confidenceLabel: 'Strong match' | 'Good match' | 'Best guess'
  hero: DishCardModel
  explanation: { headline: string; reasons: string[]; avoided?: string }
  runnersUp: DishCardModel[]        // ≤ 2
  alsoAt: { venueName: string; priceLabel: string; distanceLabel: string }[]
  primaryAction: 'order' | 'directions'
  pickList?: DishCardModel[]        // after a second "Not quite"
}

interface CounterModel { total: number; likely: number; label: string }   // "108 dishes → 23 likely"
```

These are built in `state/viewModels.ts` from engine output plus the catalogue. That's the only place price, distance, walk-time and delivery formatting happens (domain `geo.ts` helpers).

### 2.4 Screen → component map

| Screen | Components |
|---|---|
| S1 Welcome | Button, (hero image), saved link |
| S2 Craving | ChipGroup (moods ≤ 2 + intents), SettingsRow → DietSheet / BudgetControl / FulfilmentControl, Button, EmptyState (filters too tight) |
| S3 Deck | DeckTopBar, NarrowingCounter, SwipeDeck → SwipeCard → DishCard, DeckActions, EmptyState |
| S4 Match | MatchReveal, MatchHero, Explanation, AlsoAtList, MatchActions, RunnerUpCard × 2 |
| S5/S6 | OrderSheet, DirectionsSheet, PrototypeNotice |
| S7 Saved | DishCard (compact variant), EmptyState |

## 3. State management

### 3.1 Stores (Zustand; MVP_SPEC §18)

| Store | Holds | Persisted | Actions |
|---|---|---|---|
| `soloSessionStore` | `input` (context, craving, seed), `state: SoloState \| null`, `prefetched: { yes?, no? }`, `displayedHeroId` | `sessionStorage` `fde.session.v1` = `{ versions, input, events }` | `start`, `swipe(verdict)`, `pick`, `decide`, `notQuite`, `undo`, `promoteRunnerUp`, `reset` |
| `settingsStore` | diet, budget, fulfilment | `localStorage` `fde.settings.v1` | setters |
| `savedStore` | `SavedMatch[]` (ids plus a display snapshot and `savedAt`) | `localStorage` `fde.saved.v1` | `save`, `remove` |

- **Component-local state:** drag position, open sheet, reveal phase.
- **Not persisted, by principle:** the taste profile, which only exists inside the session replay.

### 3.2 Engine adapter

`services/engineAdapter.ts` is the only caller of the engine API: `createSoloSession`, `soloReducer`, `undo`, `replay`, `explainResult`.

- **Clustering and catalogue:** loaded once by `catalogueService` at app start. Clustering takes about 180 ms in-browser, so it runs while S1 is on screen. A build-time precomputed clustering is **[DEFERRED]**.
- **Branch pre-computation (MVP_SPEC §9.6).**
  - When a card is shown, the adapter computes `soloReducer(state, yes)` and `soloReducer(state, no)` in an idle callback, and `useImagePrefetch` loads both next images.
  - On a swipe, the matching pre-computed state is used directly. The reducer is pure, so this is exactly equivalent to computing it fresh.
- **Main thread vs worker.** The engine stays on the main thread while it meets the 50 ms budget on a real mid-range Android (measured in M1). If it doesn't, it moves to a Web Worker unchanged, since the engine is already pure and portable.

### 3.3 Restore, versions, undo

- On load, a stored session with matching `ENGINE_VERSION` and catalogue version is **replayed** from its events. On a mismatch, it's discarded silently and the user starts fresh.
- **Undo** = the engine's `undo` (replay without the last event); works from the match screen too.
- **Storage wrapper:** `storage.ts` wraps every access in try/catch. With storage unavailable (private mode), everything still works; nothing persists.

### 3.4 Analytics

- Store actions emit the MVP_SPEC §21 events through `services/analytics.ts` into the `EventSink`. In M1 that's the local sink only.
- The adapter adds engine-derived properties (phase, slot, EIG, counter raw vs shown) so components never compute them.
- No personal data.

## 4. Design tokens

**Structure: three tiers.** Only tiers 2 and 3 are referenced in components.

1. **Primitive** values (raw colours, sizes). These change with the design direction.
2. **Semantic** roles (`--color-text`, `--space-4`). These are stable.
3. **Component** tokens where a component needs its own knob (`--card-radius`).

**Source of truth:** CSS custom properties in `design/tokens.css`, mapped into Tailwind v4's `@theme`. Motion values are mirrored in `design/motion.ts` for Motion springs.

**Values are provisional** until you pick one of the two design directions (M1 step 1). The names and roles below are what M1 builds against.

### 4.1 Colour (semantic roles)

| Token | Role | Constraint |
|---|---|---|
| `--color-bg` / `--color-bg-elevated` | Page / sheets | Food must look good against it: warm neutrals, no clinical white |
| `--color-surface-card` | Typographic card fallback | Tinted from the dish's `dominantColour` at runtime |
| `--color-text` / `--color-text-muted` / `--color-text-inverse` | Body / secondary / on imagery | WCAG AA against the backgrounds they're used on |
| `--color-border` | Hairlines only | — |
| `--color-accent` / `--color-on-accent` | Brand and primary action | One accent; no gradients as fills (brief) |
| `--color-yes` / `--color-no` | Swipe stamps, action buttons | Always paired with icon + label |
| `--color-badge-strong` / `-good` / `-guess` | Confidence label | Distinguishable in greyscale |
| `--color-focus` | Focus ring | ≥ 3:1 against adjacent colours |
| `--color-scrim` | Text-over-image protection | A subtle bottom fade, not a decorative gradient |

Dark mode is **[DEFERRED]**. Because components only use semantic roles, adding it later is just a `[data-theme="dark"]` block.

### 4.2 Typography

| Token | Use | Provisional (mobile, 360–430 px) |
|---|---|---|
| `--font-display` | Dish names, match hero, headlines | A characterful display face; chosen with the direction |
| `--font-text` | Everything else | A highly legible text face |
| `--text-display-xl` | Match hero dish name | 40/44, tight tracking |
| `--text-display-l` | Card offering name | 28/32 |
| `--text-title` | Section titles, sheet headers | 20/26 |
| `--text-body` / `--text-body-s` | Body / secondary | 16/24 · 14/20 |
| `--text-label` | Buttons, chips | 15/20, medium |
| `--text-caption` | Venue · price · distance, counter | 13/18, **tabular numerals** |

- Must survive 200% zoom and large system text without horizontal scroll (MVP_SPEC §22).
- Fonts are self-hosted or Google Fonts. Licence checked at selection.

### 4.3 Space, shape, elevation, layout

| Group | Tokens | Provisional |
|---|---|---|
| Space (4 pt base) | `--space-1` … `--space-10` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Gutter | `--gutter` | 16 minimum, 20 on wider phones |
| Radius | `--radius-s` · `--radius-m` · `--card-radius` · `--sheet-radius` · `--radius-pill` | 6 · 10 · 14 · 20 (top only) · 999 (chips only). Restrained, per the brief ("no excessive rounded cards") |
| Elevation | `--shadow-card` · `--shadow-sheet` | Two levels only |
| Layout | `--content-max` · `--card-aspect` · `--touch-min` | 480 px (phone column on desktop) · 4 / 5 · 44 px |
| Safe areas | `env(safe-area-inset-*)` | Applied to top bar and action row |
| Z-layers | `--z-deck` · `--z-topbar` · `--z-sheet` · `--z-toast` · `--z-debug` | 10 · 20 · 30 · 40 · 100 |

### 4.4 Motion

| Token | Use | Provisional |
|---|---|---|
| `--dur-fast` / `--dur-base` / `--dur-slow` | Micro / standard / sheets | 120 / 200 / 320 ms |
| `--dur-reveal` | Match reveal ceiling | ≤ 900 ms |
| `--ease-standard` / `--ease-emphasised` | CSS transitions | Provisional cubic-béziers |
| `spring.follow` | Card follows the finger | High stiffness, critically damped |
| `spring.return` | Snap back under threshold | Slightly bouncy |
| `spring.fling` | Exit off-screen | Fast, no bounce |
| `swipe.commitRatio` / `swipe.commitVelocity` / `swipe.maxRotate` | Gesture thresholds | 0.30 of width / 800 px/s / 12° |

**Reduced motion:** flings become 150 ms fades, no tilt, no parallax, and the reveal is a simple fade. `useReducedMotion` feeds both CSS and Motion.

### 4.5 Imagery

| Token | Value |
|---|---|
| `--image-aspect` | 4 / 5 |
| Responsive widths | 640w, 1080w (AVIF, then WebP) |
| Placeholder | `dominantColour` fill, then fade in (`--dur-base`) |
| Missing image | `DishCardTypographic` (a designed state, not an error) |

## 5. Dependencies to add in M1

Versions are pinned at the start of M1, as in M0:
- React Router, Zustand, Motion.
- Tailwind CSS v4 (+ `@tailwindcss/vite`).
- For component tests: `@testing-library/react` + `jsdom`.

## 6. Testing in M1

- **Store and adapter tests (Vitest):**
  - Restore via replay.
  - Version-mismatch discard.
  - The pre-computed branch equals a fresh reducer result.
  - The storage-unavailable path.
- **Component tests (Testing Library + jsdom):**
  - Keyboard controls, focus management, `aria-live` counter, labels never colour-only.
  - View-model formatting (prices, distances).
- **Manual device passes:** iOS Safari and Android Chrome, including the 50 ms engine budget on a mid-range Android.
- Playwright end-to-end tests remain in M3 (MVP_SPEC §24).

## 7. Sequence and decision gates

1. **Design direction.** 2 short directions (type, colour, texture, motion references; card and match screen in each). **Gate: you choose.** This sets the token values in §4.
2. **Image style guide + 6-image pilot.** **Gate: you approve**, which needs the image tool decision.
3. Tokens + primitives.
4. Stores, adapter, services, restore. *Can start in parallel with steps 1–2; it doesn't depend on the visual direction.*
5. Screens S1–S4, then S5–S8.
6. Gestures and motion polish, reveal choreography.
7. Accessibility pass, device testing, preview deploy.

**M1 exit criteria** (from MVP_SPEC §24): full solo loop on a phone; median time to decision ≤ 60 s in informal tests with 5 people; no accessibility blockers.

## 8. Open inputs

| Input | Needed by |
|---|---|
| Choice between the two design directions | Step 3 |
| Image generation tool (+ budget) | Step 2 |
| Working name (wordmark, S1) | Step 5 |
| Font choice and licence | Step 3 (follows the direction) |
| Hosting account for the preview deploy (e.g. Vercel) | Step 7 |

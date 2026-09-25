# Direction C: DESIGN.md (REFERENCE ONLY, NOT ADOPTED)

> **Status (2026-09-24):** This is the product owner's draft brief for **Direction C** in the M1.1 comparison (`docs/design/index.html`).
> It is **reference only**. The visual direction has **not** been chosen. Do **not** treat this file as binding for UI work
> until the product owner explicitly adopts a direction.

---

## The idea in one line

**The food is the only decoration.** Real dish photos sit on soft, pale, dish-coloured cards. Everything else is quiet: near-white canvas, one simple sans-serif, dark green ink, and plenty of space.

The feel we want is calm, fresh, appetising and easy, like a well-run café menu. It should not look loud, editorial, retro, textured or "designed".

## Colour

| Token | Hex | Use |
|---|---|---|
| `--canvas` | `#FCFBF8` | App background. Near-white, not cream. |
| `--surface` | `#FFFFFF` | Bottom sheets, inputs, raised panels |
| `--ink` | `#26302A` | All primary text, primary buttons, icons |
| `--ink-muted` | `#6B6F66` | Secondary text, captions |
| `--line` | `#E7E4DC` | Dividers and input borders only |
| `--olive` | `#55612F` | YES, selected states, focus ring, links |
| `--chilli` | `#B8502C` | Spice level only. Never used for buttons or headings. |

**Dish tints are the signature.** Every dish has a colour from the catalogue. Its card background is a pale version of that colour:
`--tint-bg: color-mix(in oklab, var(--dish) 18%, var(--canvas));`

Compute the contrast of `--ink` on each tint and increase the mix toward canvas until it passes 4.5:1.

Fallback tints, used when a dish has no colour: blush `#F3E3E2`, butter `#F2EDC8`, sage `#E3E9D8`, oat `#EDE2D0`, peach `#F6DCC8`.

Keep one tinted surface per screen area, with everything else on canvas. Never use gradients.

## Type

- **One family.** Use the system UI font: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. If a brand typeface is added later, it replaces this token and nothing else.
- Use sentence case everywhere. No all-caps labels and no letter-spacing tricks.
- Headings never style one word differently.
- Use tabular numerals for prices, distances and counts.

| Role | Size / line height | Weight |
|---|---|---|
| Screen title | 28 / 34 | 600 |
| Dish name (card, match) | 26 / 30 | 600 |
| Section heading | 18 / 24 | 600 |
| Body | 16 / 24 | 400 |
| Secondary | 14 / 20 | 400, `--ink-muted` |
| Small / meta | 13 / 18 | 500, `--ink-muted` |
| Price | 18 / 22 | 600 |

## Shape, space, depth

- **Radius:** bottom sheets and screen panels 28px; dish cards 22px; photo tiles and chips 14px; buttons are pills.
- **Spacing:** a 4px base, 20px screen padding, gaps of 8 / 12 / 16 / 24 / 32. Be generous.
- **Shadows:** only the soft shadow under a dish photo and one shadow under the top swipe card: `0 12px 28px -14px rgba(38,48,42,.35)`. Everything else is flat.
- Text is left-aligned. Centre only the single primary button row, if needed.

## Photography

- Top-down or a slight 3/4 angle, on a round plate or bowl, cut out on a transparent background.
- The same angle, lighting and scale across the catalogue. Consistency matters more than beauty.
- One soft contact shadow under each plate. Photos may slightly overflow the card top.
- No floating garnish, flying leaves, scattered crumbs, or lifestyle scenes.
- **No-photo fallback (current M1):** the same tinted card with the dish name large at the bottom left and the cuisine above it in `--ink-muted`. The photo area stays empty tint: no illustration, giant numeral or icon.

## Components

- **Primary button:** `--ink` background, white text, pill, 52px tall, full width at the bottom. One per screen.
- **Secondary button:** transparent with a 1.5px `--ink` border, pill.
- **Text button:** `--ink` text, underline on press only.
- **Chips:** pill, `--surface` fill, `--line` border. Selected: `--olive` fill, white text.
- **Meta rows:** a small icon plus text (clock "30 min", pin "2.2 mi"), separated by 16px of space, not dots.
- **Icons:** one outline set, 1.75px stroke, 20–24px, rounded caps.
- **Bottom nav (if used):** plain icons with labels; active in `--ink`, the rest in `--ink-muted`.

## Screens

- **Swipe deck:** the card behind is the next dish's tint, scaled to 0.96, with no rotation. While dragging, a "Yes" or "Nope" label fades in on the leading side, always with a word, a glyph and a side.
- **Match:** a large photo on the dish tint at the top. Below it, on canvas: dish name, restaurant and price, then the meta row. Then a "Why this one" heading with the engine's reasons (olive tick for positive, muted ✕ for avoided). Two "Or try" alternatives as small tinted tiles. Actions pinned at the bottom: Order (primary), Directions (secondary), Save (icon). "Show me something else" is a text button.
- **Craving:** the title "What do you feel like eating?", mood chips that wrap (up to two selected), settings as plain text rows with a chevron, and the primary button "Show me dishes".

## Motion

- **Drag:** tilt up to 6°.
- **Commit:** the card slides off over 280ms (ease-out); the next card settles to full size over 200ms.
- **Match:** the photo fades in and scales from 0.97 to 1 over 300ms, once.
- **Reduced motion:** 150ms opacity fades only.

## Copy

Plain, specific, sentence case; no filler and no cheeky asides. Buttons say exactly what happens.

## Accessibility (non-negotiable)

Targets ≥ 44px. Text contrast ≥ 4.5:1, including on every dish tint (checked programmatically). A 3px `--olive` focus ring. YES/NOPE never shown by colour alone. Reduced motion respected.

## Do not use

- Glassmorphism, blurred gradients, blobs, dots, confetti, floating garnish.
- Script, handwritten or italic accent fonts; a single coloured or italic word in a heading.
- All-caps tracked labels, eyebrow labels, "A · B · C" meta strings, "→" appended to button text.
- Paper grain or noise textures, hard offset shadows, rotated stickers, giant decorative numbers.
- Identical shadows on every card; star ratings without real data; fake greetings; emoji in UI copy.
- These fonts: Fraunces, Instrument Sans/Serif, Bricolage Grotesque, Playfair Display, Poppins, Gilroy, DM Sans, Space Grotesk, Satoshi.

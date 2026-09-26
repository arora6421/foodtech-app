import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { COVERS, coverFor } from '../design/covers'
import { loadCatalogue } from './catalogueService'

// WCAG 2.2 AA contrast for every text/icon role on every surface it can sit on (M1.7), including the
// dish-tinted surfaces: the swipe card, the Match ticket band, list tiles and the Welcome fan are the
// dish's colour mixed into paper with color-mix(in oklab, …). This reproduces that mix exactly, so
// it checks what's actually drawn. Colours come from tokens.css and the catalogue, so a palette
// change is checked automatically.
//   text: 4.5:1 (all our small text; nothing here qualifies as "large")  ·  icons/UI: 3:1 (1.4.11)

const css = readFileSync(resolve(process.cwd(), 'src/app/design/tokens.css'), 'utf8')
const token = (name: string) => {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(css)
  expect(m, `token --${name}`).not.toBeNull()
  return m![1]!.trim()
}
const C = {
  canvas: token('color-canvas'),
  raised: token('color-raised'),
  ink: token('color-ink'),
  muted: token('color-ink-muted'),
  accent: token('color-accent'),
  onAccent: token('color-on-accent'),
  yes: token('color-yes'),
  no: token('color-no'),
  heat: token('color-heat'),
  focus: token('color-focus'),
}
const tintStrength = Number.parseFloat(token('tint-strength')) / 100

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as RGB
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
function oklab([r, g, b]: RGB): RGB {
  const [R, G, B] = [r, g, b].map(toLinear) as RGB
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}
function fromOklab([L, a, b]: RGB): RGB {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
  return lin.map((c) => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255) / 255) as RGB
}
/** color-mix(in oklab, a p, b): p of a, the rest b. */
const mix = (a: string, p: number, b: string): RGB => {
  const [x, y] = [oklab(hex(a)), oklab(hex(b))]
  return fromOklab([0, 1, 2].map((i) => x[i]! * p + y[i]! * (1 - p)) as RGB)
}
const luminance = (c: RGB) => {
  const [r, g, b] = c.map(toLinear) as RGB
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (fg: RGB, bg: RGB) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number]
  return (a + 0.05) / (b + 0.05)
}

const loaded = await loadCatalogue()
const welcome = readFileSync(resolve(process.cwd(), 'src/app/screens/WelcomeScreen.tsx'), 'utf8')
const tints = [
  ...new Set([
    ...[...loaded.archetypes.values()].map((a) => a.image.dominantColour),
    ...(welcome.match(/#[0-9a-f]{6}/gi) ?? []),
  ]),
]

// Surfaces a role can sit on. Tinted: the dish colour mixed into raised paper at --tint-strength.
const plainSurfaces: Record<string, RGB> = { canvas: hex(C.canvas), raised: hex(C.raised) }
const tintedSurfaces: Record<string, RGB> = Object.fromEntries(
  tints.map((t) => [`tint ${t}`, mix(t, tintStrength, C.raised)]),
)

// Cover colours (Crave): each dish's bold cover, and the same colour under the grain. The grain is
// src/app/design/textures/grain-print.png multiplied in at --grain-opacity; a speck of grey g and
// alpha a scales the colour by 1 − opacity·a·(1 − g). Measured from the real tile, text must pass at
// the 95th-percentile speck (a realistic worst case for reading over texture, not the rarest pixel).
const grainOpacity = Number.parseFloat(/--grain-opacity:\s*([\d.]+)/.exec(css)![1]!)
const tile = await sharp(resolve(process.cwd(), 'src/app/design/textures/grain-print.png'))
  .raw()
  .toBuffer({ resolveWithObject: true })
const specks: number[] = []
for (let i = 0; i < tile.data.length; i += tile.info.channels)
  specks.push((tile.data[i + tile.info.channels - 1]! / 255) * (1 - tile.data[i]! / 255))
specks.sort((a, b) => a - b)
const grainScale = 1 - grainOpacity * specks[Math.floor(0.95 * (specks.length - 1))]!
const darkened = (c: RGB): RGB => c.map((v) => v * grainScale) as RGB
const coverSurfaces: Record<string, RGB> = Object.fromEntries(
  [...new Set(tints.map(coverFor))].flatMap((c) => [
    [`cover ${c}`, hex(c)],
    [`cover ${c} under grain`, darkened(hex(c))],
  ]),
)

function worst(fg: string, surfaces: Record<string, RGB>) {
  return Object.entries(surfaces)
    .map(([name, bg]) => ({ name, ratio: ratio(hex(fg), bg) }))
    .sort((a, b) => a.ratio - b.ratio)[0]!
}

describe('colour contrast (WCAG 2.2 AA)', () => {
  it('found the dish tints to check, and every one has a cover colour', () => {
    expect(tints.length).toBeGreaterThanOrEqual(16)
    const catalogueTints = new Set([...loaded.archetypes.values()].map((a) => a.image.dominantColour.toLowerCase()))
    for (const t of catalogueTints) expect(COVERS[t], `cover for ${t}`).toBeDefined()
  })

  const text: [string, string, Record<string, RGB>][] = [
    ['ink text on cream', C.ink, plainSurfaces],
    ['ink text on every dish cover, grain included (card, Match, tiles)', C.ink, coverSurfaces],
    ['muted text on cream (captions, labels)', C.muted, plainSurfaces],
    ['red text on cream (emphasis)', C.accent, plainSurfaces],
    ['ink text on the legacy tinted tiles (until step 2 restyles them)', C.ink, tintedSurfaces],
    ['muted text on the legacy tinted tiles', C.muted, tintedSurfaces],
  ]
  for (const [role, fg, surfaces] of text) {
    it(`${role} ≥ 4.5:1`, () => {
      const w = worst(fg, surfaces)
      expect(w.ratio, `${role}: worst ${w.ratio.toFixed(2)}:1 on ${w.name}`).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('sticker and button labels ≥ 4.5:1 (cream on the red sticker, cream on the ink YES button)', () => {
    expect(ratio(hex(C.onAccent), hex(C.accent))).toBeGreaterThanOrEqual(4.5)
    expect(ratio(hex(C.raised), hex(C.ink))).toBeGreaterThanOrEqual(4.5)
  })

  it('outlines and focus ring ≥ 3:1 on cream and on every cover', () => {
    const focus = worst(C.focus, { ...plainSurfaces, ...coverSurfaces })
    expect(focus.ratio, `focus ring: ${focus.ratio.toFixed(2)}:1 on ${focus.name}`).toBeGreaterThanOrEqual(3)
  })
})

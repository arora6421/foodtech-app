import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { COVERS, DEFAULT_COVER, coverFor } from '../design/covers'
import { loadCatalogue } from './catalogueService'

// WCAG 2.2 AA contrast for every text/icon role on every surface it can sit on (M1.7): cream pages,
// and every dish's cover colour (the swipe card, Match, Saved and pick-list tiles, the Welcome cover
// and the chosen craving row), with and without the print grain. Colours come from tokens.css, the
// catalogue and design/covers.ts, so a palette change is checked automatically.
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
  focus: token('color-focus'),
  chosen: token('color-chosen'),
}

type RGB = [number, number, number]
const hex = (h: string): RGB => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255) as RGB
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const luminance = (c: RGB) => {
  const [r, g, b] = c.map(toLinear) as RGB
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const ratio = (fg: RGB, bg: RGB) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number]
  return (a + 0.05) / (b + 0.05)
}

const loaded = await loadCatalogue()
const tints = [...new Set([...loaded.archetypes.values()].map((a) => a.image.dominantColour))]

// Surfaces a role can sit on.
const plainSurfaces: Record<string, RGB> = { canvas: hex(C.canvas), raised: hex(C.raised) }

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
  [...new Set([...tints.map(coverFor), DEFAULT_COVER])].flatMap((c) => [
    [`cover ${c}`, hex(c)],
    [`cover ${c} under grain`, darkened(hex(c))],
  ]),
)
coverSurfaces['chosen craving row'] = hex(C.chosen)

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
    ['ink text on every cover, grain included (card, Match, tiles, Welcome, chosen craving)', C.ink, coverSurfaces],
    ['muted text on cream (captions, labels)', C.muted, plainSurfaces],
    ['red text on cream (emphasis)', C.accent, plainSurfaces],
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

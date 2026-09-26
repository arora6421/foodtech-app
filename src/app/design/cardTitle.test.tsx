// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DishCard } from '../components/food/DishCard'
import { loadCatalogue } from '../services/catalogueService'
import type { DishCardModel } from '../state/viewModels'
import { NAME_TIERS, nameTier } from './nameFit'

// The deck card's dish name (Crave): Playfair Display Black at a tight 0.92 line height, two lines
// at most. A tight line height makes descenders (the g in "goong") hang below their line box, so the
// name must never be clipped, and the fixed name area must leave room for that overhang. jsdom can't
// lay text out, so this checks the real constraints: the font file's metrics against the real CSS,
// and the name-fitting arithmetic against every dish in the catalogue. The real browser check is
// scripts/card-layout-audit.mjs.

afterEach(cleanup)

const here = resolve(process.cwd(), 'src/app/design')
const css = readFileSync(resolve(here, 'cover.css'), 'utf8')

/** The base rule whose whole selector is exactly `selector`. */
function block(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = new RegExp(`\\n\\s*${escaped} \\{`).exec(css)
  expect(m, `${selector} rule`).not.toBeNull()
  return css.slice(m!.index, css.indexOf('}', m!.index))
}

/** Ascent + descent in em, from the metrics browsers use to size a line (typo when USE_TYPO_METRICS, else hhea). */
function contentArea(file: string) {
  const d = readFileSync(resolve(process.cwd(), 'docs/design/fonts', file))
  const tables = new Map<string, number>()
  for (let i = 0; i < d.readUInt16BE(4); i++)
    tables.set(d.toString('latin1', 12 + 16 * i, 16 + 16 * i), d.readUInt32BE(20 + 16 * i))
  const upm = d.readUInt16BE(tables.get('head')! + 18)
  const os2 = tables.get('OS/2')!
  const hhea = tables.get('hhea')!
  const useTypo = (d.readUInt16BE(os2 + 62) & 0x80) !== 0
  const [asc, desc] = useTypo
    ? [d.readInt16BE(os2 + 68), d.readInt16BE(os2 + 70)]
    : [d.readInt16BE(hhea + 4), d.readInt16BE(hhea + 6)]
  return (asc - desc) / upm
}

const playfair = contentArea('PlayfairDisplay.ttf')

describe('deck card name', () => {
  const name = block('.card-name')
  const [, size, lineHeight] = /font:\s*900\s+([\d.]+)cqw\/([\d.]+)/.exec(name)!.map(Number) as [number, number, number]

  it('is never clipped: no hidden overflow or line clamp on the name or its area', () => {
    expect(name).not.toMatch(/overflow:\s*(hidden|clip)|line-clamp/)
    expect(block('.card-name-zone')).not.toMatch(/overflow:\s*(hidden|clip)/)
  })

  it('has a fixed area that holds two lines plus the second line’s descender overhang', () => {
    // A line box centres the font's content area; with line-height < content area, the glyphs'
    // descent hangs (content − line-height) / 2 em below the last line box.
    const overhang = (playfair - lineHeight) / 2
    const zone = /height:\s*calc\(([\d.]+)cqw \* ([\d.]+)\)/.exec(block('.card-name-zone'))!
    expect(Number(zone[1])).toBe(size) // sized in units of the largest name size
    expect(Number(zone[2])).toBeGreaterThanOrEqual(2 * lineHeight + overhang)
  })

  it('gives every dish in the catalogue a size that fits it in two lines', async () => {
    const loaded = await loadCatalogue()
    const tiers = NAME_TIERS.map((t) => t.tier)
    for (const a of loaded.archetypes.values()) {
      const tier = nameTier(a.name)
      expect(tiers, a.name).toContain(tier)
    }
    // The longest names really do step down, and short ones get the full size.
    expect(nameTier('Smashed avocado & poached eggs')).not.toBe('xl')
    expect(nameTier('Tonkotsu ramen')).toBe('xl')
  })

  it('renders a long name with descenders whole', () => {
    const model = {
      key: 'x',
      archetypeId: 'tom-yum',
      offeringId: 'x',
      cardNumber: 3,
      offeringName: 'Tom Yum Goong',
      archetypeName: 'Tom yum goong with glass noodles',
      showArchetype: true,
      cuisineLabel: 'Thai',
      venueName: 'Lemongrass & Lime',
      priceLabel: '£11.50',
      timeLabel: '12 min walk',
      distanceLabel: '0.6 mi',
      spiceLevel: 3,
      spiceWord: 'Hot',
      spiceTag: 'Hot',
      tags: ['Brothy', 'Tangy'],
      kind: 'Thai soup',
      inside: ['prawns', 'lemongrass broth', 'chilli'],
      tint: '#c9783c',
      image: null,
      initial: 'T',
      allergens: [],
      a11yLabel: 'Tom Yum Goong. Tom yum goong with glass noodles, Thai.',
    } satisfies DishCardModel
    render(<DishCard model={model} />)
    const h2 = document.querySelector('.card-name-zone .card-name')!
    expect(h2.textContent).toBe('Tom yum goong with glass noodles')
    expect(h2.className).toMatch(/name-(l|m|s|xs)$/) // too long for the largest size
  })
})
